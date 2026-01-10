/**
 * ============================================================================
 * USER PREFERENCES SERVICE - Enterprise Firestore-Based User Preferences
 * ============================================================================
 * 
 * Single source of truth for all user preferences stored in Firestore.
 * Replaces all localStorage usage for user-specific data.
 * 
 * STORED PREFERENCES:
 * - dismissedNotifications: Array of dismissed notification IDs
 * - dashboardTab: Last active dashboard tab ('myProperties' or 'admin')
 * - lastSeenSiteUpdate: Version string of last seen site update
 * - adminLastVisit: ISO timestamp of admin's last visit (for "new" badges)
 * - pendingUserNotifications: Array of pending user notification IDs
 * - pendingListingNotifications: Array of pending listing notification IDs
 * 
 * ARCHITECTURE:
 * - All preferences stored in users/{uid}.preferences object
 * - In-memory cache for fast reads
 * - Async writes with optimistic UI updates
 * - Graceful fallbacks for logged-out users (session-only memory)
 * 
 * ============================================================================
 */

const UserPreferencesService = (function() {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================
    
    // In-memory cache of preferences
    let cache = {
        dismissedNotifications: [],
        dashboardTab: 'myProperties',
        lastSeenSiteUpdate: null,
        adminLastVisit: null,
        pendingUserNotifications: [],
        pendingListingNotifications: [],
        adminActivityLog: []
    };
    
    // Track if we've loaded from Firestore
    let isLoaded = false;
    let isLoading = false;
    let loadPromise = null;
    
    // Current user ID (for Firestore path)
    let currentUserId = null;

    // =========================================================================
    // FIRESTORE OPERATIONS
    // =========================================================================
    
    /**
     * Load preferences from Firestore for the current user
     * @returns {Promise<Object>} The preferences object
     */
    async function load() {
        const user = auth?.currentUser;
        if (!user) {
            console.log('[UserPreferences] No user logged in, using memory-only mode');
            isLoaded = true;
            return cache;
        }
        
        // Return existing promise if already loading
        if (isLoading && loadPromise) {
            return loadPromise;
        }
        
        // Return cache if already loaded for this user
        if (isLoaded && currentUserId === user.uid) {
            return cache;
        }
        
        isLoading = true;
        currentUserId = user.uid;
        
        loadPromise = (async () => {
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                
                if (doc.exists) {
                    const data = doc.data();
                    const prefs = data.preferences || {};
                    
                    // Merge with defaults
                    cache = {
                        dismissedNotifications: prefs.dismissedNotifications || [],
                        dashboardTab: prefs.dashboardTab || 'myProperties',
                        lastSeenSiteUpdate: prefs.lastSeenSiteUpdate || null,
                        adminLastVisit: prefs.adminLastVisit || null,
                        pendingUserNotifications: prefs.pendingUserNotifications || [],
                        pendingListingNotifications: prefs.pendingListingNotifications || [],
                        adminActivityLog: prefs.adminActivityLog || []
                    };
                    
                    console.log('[UserPreferences] Loaded from Firestore:', Object.keys(cache));
                }
                
                isLoaded = true;
                isLoading = false;
                return cache;
                
            } catch (error) {
                console.error('[UserPreferences] Error loading:', error);
                isLoading = false;
                isLoaded = true; // Mark as loaded to prevent infinite retries
                return cache;
            }
        })();
        
        return loadPromise;
    }
    
    /**
     * Save a single preference to Firestore
     * @param {string} key - Preference key
     * @param {any} value - Preference value
     */
    async function save(key, value) {
        // Update cache immediately (optimistic update)
        cache[key] = value;
        
        const user = auth?.currentUser;
        if (!user) {
            console.log('[UserPreferences] No user, preference saved to memory only:', key);
            return;
        }
        
        try {
            await db.collection('users').doc(user.uid).set({
                preferences: {
                    [key]: value
                }
            }, { merge: true });
            
            console.log('[UserPreferences] Saved to Firestore:', key);
            
        } catch (error) {
            console.error('[UserPreferences] Error saving:', key, error);
        }
    }
    
    /**
     * Save multiple preferences at once
     * @param {Object} prefs - Object with key-value pairs
     */
    async function saveMultiple(prefs) {
        // Update cache immediately
        Object.assign(cache, prefs);
        
        const user = auth?.currentUser;
        if (!user) {
            console.log('[UserPreferences] No user, preferences saved to memory only');
            return;
        }
        
        try {
            await db.collection('users').doc(user.uid).set({
                preferences: prefs
            }, { merge: true });
            
            console.log('[UserPreferences] Saved multiple to Firestore:', Object.keys(prefs));
            
        } catch (error) {
            console.error('[UserPreferences] Error saving multiple:', error);
        }
    }

    // =========================================================================
    // NOTIFICATION PREFERENCES
    // =========================================================================
    
    /**
     * Check if a notification has been dismissed
     * @param {string} notificationId 
     * @returns {boolean}
     */
    function isNotificationDismissed(notificationId) {
        return cache.dismissedNotifications.includes(notificationId);
    }
    
    /**
     * Dismiss a notification
     * @param {string} notificationId 
     */
    async function dismissNotification(notificationId) {
        console.log('[UserPreferences] Dismissing notification:', notificationId);
        if (!cache.dismissedNotifications.includes(notificationId)) {
            cache.dismissedNotifications.push(notificationId);
            console.log('[UserPreferences] Added to cache, now have:', cache.dismissedNotifications.length, 'dismissed');
            
            // Also remove from pending if present
            cache.pendingUserNotifications = cache.pendingUserNotifications.filter(id => id !== notificationId);
            cache.pendingListingNotifications = cache.pendingListingNotifications.filter(id => id !== notificationId);
            
            await saveMultiple({
                dismissedNotifications: cache.dismissedNotifications,
                pendingUserNotifications: cache.pendingUserNotifications,
                pendingListingNotifications: cache.pendingListingNotifications
            });
            console.log('[UserPreferences] Saved dismissal to Firestore');
        } else {
            console.log('[UserPreferences] Already dismissed');
        }
    }
    
    /**
     * Dismiss multiple notifications at once
     * @param {Array<string>} notificationIds 
     */
    async function dismissNotifications(notificationIds) {
        let changed = false;
        notificationIds.forEach(id => {
            if (!cache.dismissedNotifications.includes(id)) {
                cache.dismissedNotifications.push(id);
                changed = true;
            }
            // Remove from pending
            cache.pendingUserNotifications = cache.pendingUserNotifications.filter(pid => pid !== id);
            cache.pendingListingNotifications = cache.pendingListingNotifications.filter(pid => pid !== id);
        });
        
        if (changed) {
            await saveMultiple({
                dismissedNotifications: cache.dismissedNotifications,
                pendingUserNotifications: cache.pendingUserNotifications,
                pendingListingNotifications: cache.pendingListingNotifications
            });
        }
    }
    
    /**
     * Add a pending notification (to show again on next visit)
     * @param {string} notificationId 
     * @param {string} type - 'user' or 'listing'
     */
    async function addPendingNotification(notificationId, type = 'user') {
        const key = type === 'listing' ? 'pendingListingNotifications' : 'pendingUserNotifications';
        
        if (!cache[key].includes(notificationId) && !cache.dismissedNotifications.includes(notificationId)) {
            cache[key].push(notificationId);
            await save(key, cache[key]);
        }
    }
    
    /**
     * Get all pending notifications
     * @param {string} type - 'user' or 'listing' (optional, returns all if not specified)
     * @returns {Array<string>}
     */
    function getPendingNotifications(type) {
        if (type === 'user') return [...cache.pendingUserNotifications];
        if (type === 'listing') return [...cache.pendingListingNotifications];
        return [...cache.pendingUserNotifications, ...cache.pendingListingNotifications];
    }
    
    /**
     * Clear stale pending notifications (for deleted users/listings)
     * @param {Array<string>} validIds - IDs that still exist
     * @param {string} type - 'user' or 'listing'
     */
    async function cleanupStalePending(validIds, type = 'user') {
        const key = type === 'listing' ? 'pendingListingNotifications' : 'pendingUserNotifications';
        const prefix = type === 'listing' ? 'new-listing-' : 'new-user-';
        
        const before = cache[key].length;
        cache[key] = cache[key].filter(id => {
            if (!id.startsWith(prefix)) return true;
            const entityId = id.replace(prefix, '');
            return validIds.includes(entityId);
        });
        
        if (cache[key].length !== before) {
            await save(key, cache[key]);
            console.log(`[UserPreferences] Cleaned up ${before - cache[key].length} stale ${type} notifications`);
        }
    }

    // =========================================================================
    // DASHBOARD PREFERENCES
    // =========================================================================
    
    /**
     * Get the saved dashboard tab
     * @returns {string} 'myProperties' or 'admin'
     */
    function getDashboardTab() {
        return cache.dashboardTab || 'myProperties';
    }
    
    /**
     * Save the dashboard tab preference
     * @param {string} tabName 
     */
    async function setDashboardTab(tabName) {
        if (tabName === 'myProperties' || tabName === 'admin') {
            await save('dashboardTab', tabName);
        }
    }

    // =========================================================================
    // SITE UPDATE PREFERENCES
    // =========================================================================
    
    /**
     * Check if user has seen the latest site update
     * @param {string} latestVersion - Current site update version string
     * @returns {boolean}
     */
    function hasSeenSiteUpdate(latestVersion) {
        return cache.lastSeenSiteUpdate === latestVersion;
    }
    
    /**
     * Mark site update as seen
     * @param {string} version - Version string to mark as seen
     */
    async function markSiteUpdateSeen(version) {
        await save('lastSeenSiteUpdate', version);
    }

    // =========================================================================
    // ADMIN VISIT TRACKING
    // =========================================================================
    
    /**
     * Get the admin's last visit time
     * @returns {Date|null}
     */
    function getAdminLastVisit() {
        if (cache.adminLastVisit) {
            return new Date(cache.adminLastVisit);
        }
        return null;
    }
    
    /**
     * Update admin's last visit time to now
     */
    async function updateAdminLastVisit() {
        const now = new Date().toISOString();
        await save('adminLastVisit', now);
    }

    // =========================================================================
    // ADMIN ACTIVITY LOG
    // =========================================================================
    
    /**
     * Add an entry to the admin activity log
     * @param {Object} entry - Activity entry
     */
    async function addActivityLogEntry(entry) {
        cache.adminActivityLog.unshift(entry);
        // Keep only last 100 entries
        cache.adminActivityLog = cache.adminActivityLog.slice(0, 100);
        await save('adminActivityLog', cache.adminActivityLog);
    }
    
    /**
     * Get the admin activity log
     * @returns {Array}
     */
    function getActivityLog() {
        return [...cache.adminActivityLog];
    }
    
    /**
     * Clear the admin activity log
     */
    async function clearActivityLog() {
        cache.adminActivityLog = [];
        await save('adminActivityLog', []);
    }

    // =========================================================================
    // LIFECYCLE
    // =========================================================================
    
    /**
     * Reset the service (call on logout)
     */
    function reset() {
        cache = {
            dismissedNotifications: [],
            dashboardTab: 'myProperties',
            lastSeenSiteUpdate: null,
            adminLastVisit: null,
            pendingUserNotifications: [],
            pendingListingNotifications: [],
            adminActivityLog: []
        };
        isLoaded = false;
        isLoading = false;
        loadPromise = null;
        currentUserId = null;
        console.log('[UserPreferences] Reset');
    }
    
    /**
     * Get all cached preferences (for debugging)
     * @returns {Object}
     */
    function getAll() {
        return { ...cache };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    
    return {
        // Core
        load,
        reset,
        getAll,
        
        // Notifications
        isNotificationDismissed,
        dismissNotification,
        dismissNotifications,
        addPendingNotification,
        getPendingNotifications,
        cleanupStalePending,
        
        // Dashboard
        getDashboardTab,
        setDashboardTab,
        
        // Site Updates
        hasSeenSiteUpdate,
        markSiteUpdateSeen,
        
        // Admin Visit
        getAdminLastVisit,
        updateAdminLastVisit,
        
        // Activity Log
        addActivityLogEntry,
        getActivityLog,
        clearActivityLog
    };
})();

// Make globally available
window.UserPreferencesService = UserPreferencesService;

console.log('[UserPreferencesService] Loaded');
