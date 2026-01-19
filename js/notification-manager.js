/**
 * ============================================================================
 * NOTIFICATION MANAGER - Enterprise Unified Notification System
 * ============================================================================
 * 
 * Single source of truth for all notification state and behavior.
 * 
 * NOTIFICATION TYPES:
 * - user: New user registrations
 * - listing: New vehicle listings
 * - photo: Photo service requests
 * - premium: Premium listing requests
 * - rent: Financing payment alerts (computed, not stored)
 * 
 * ARCHITECTURE:
 * - State: Single state object with all notification data
 * - Listeners: Firestore real-time listeners feed state
 * - Actions: Unified click routing for all notification types
 * - UI: Centralized badge and panel updates
 * 
 * ============================================================================
 */

(function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    
    const CONFIG = {
        // How long highlights last (ms)
        HIGHLIGHT_DURATION: 4000,
        
        // Polling interval for rent checks (ms)
        RENT_CHECK_INTERVAL: 60000,
        
        // Max notifications to keep in memory per type
        MAX_PER_TYPE: 50,
        
        // Colors for each notification type
        COLORS: {
            user: { primary: 'rgba(59, 130, 246, 0.7)', glow: 'rgba(59, 130, 246, 0.4)' },      // Blue
            listing: { primary: 'rgba(34, 197, 94, 0.7)', glow: 'rgba(34, 197, 94, 0.4)' },    // Green
            photo: { primary: 'rgba(168, 85, 247, 0.7)', glow: 'rgba(168, 85, 247, 0.4)' },    // Purple
            premium: { primary: 'rgba(245, 158, 11, 0.7)', glow: 'rgba(245, 158, 11, 0.4)' },  // Amber
            rent: { primary: 'rgba(239, 68, 68, 0.7)', glow: 'rgba(239, 68, 68, 0.4)' }        // Red
        },
        
        // Icons for each notification type
        ICONS: {
            user: '👤',
            listing: '🚗',
            photo: '📸',
            premium: '👑',
            rent: '💰'
        },
        
        // Urgency levels
        URGENCY: {
            CRITICAL: 'critical',   // Red - needs immediate action
            WARNING: 'warning',     // Orange/Yellow - needs attention soon
            INFO: 'info'            // Blue/Green - informational
        }
    };

    // =========================================================================
    // STATE
    // =========================================================================
    
    const state = {
        // All active notifications (unified schema)
        notifications: [],
        
        // Dismissed notification IDs - now managed by UserPreferencesService
        // Kept as Set for fast lookups, synced with Firestore via UserPreferencesService
        dismissed: new Set(),
        
        // Rent alerts (computed from vehicles, not stored in Firestore)
        rentAlerts: {
            overdue: [],    // Past due date
            today: [],      // Due today
            tomorrow: []    // Due tomorrow
        },
        
        // Listener unsubscribe functions
        listeners: {
            users: null,
            listings: null,
            rentInterval: null
        },
        
        // Initialization flags
        initialized: false,
        initialLoadComplete: {
            users: false,
            listings: false
        },
        
        // Session tracking (for "While You Were Away" detection)
        sessionStart: null,
        lastAdminVisit: null,
        
        // Known IDs to detect new items
        knownUserIds: new Set(),
        knownListingIds: new Set()
    };

    // =========================================================================
    // UNIFIED NOTIFICATION SCHEMA FACTORY
    // =========================================================================
    
    /**
     * Create a unified notification object from raw data
     */
    function createNotification(type, rawData, options = {}) {
        const id = options.id || `${type}-${rawData.id || Date.now()}`;
        const timestamp = options.timestamp || new Date().toISOString();
        const isMissed = options.isMissed || false;
        
        // Base notification structure
        const notification = {
            id,
            type,
            timestamp,
            isMissed,
            urgency: CONFIG.URGENCY.INFO,
            icon: CONFIG.ICONS[type],
            data: rawData
        };
        
        // Type-specific enrichment
        switch (type) {
            case 'user':
                notification.title = isMissed ? '📬 While You Were Away...' : '👤 New User Registered!';
                notification.subtitle = `${rawData.username || rawData.email?.split('@')[0] || 'Unknown'} created a Starter account`;
                notification.action = {
                    type: 'scrollToUser',
                    target: rawData.id,
                    tab: 'admin',
                    subtab: 'users',
                    highlightSelector: `.admin-user-card[data-userid="${rawData.id}"]`
                };
                break;
                
            case 'listing':
                const isPremium = rawData.isPremium && !rawData.premiumTrialEnds;
                const isPremiumTrial = rawData.isPremium && rawData.premiumTrialEnds;
                const ownerName = rawData.ownerName || rawData.ownerEmail?.split('@')[0] || 'Unknown';
                notification.title = isMissed 
                    ? (isPremiumTrial ? '🎁 Premium Trial Listing' : '📬 While You Were Away...')
                    : (isPremium ? '👑 New Premium Listing!' : isPremiumTrial ? '🎁 New Premium Trial!' : '🚗 New Listing Posted!');
                notification.subtitle = `${rawData.title || 'New Vehicle'} by ${ownerName}`;
                notification.ownerName = ownerName;
                notification.urgency = isPremium ? CONFIG.URGENCY.WARNING : CONFIG.URGENCY.INFO;
                notification.action = {
                    type: 'scrollToUserByEmail',
                    target: rawData.ownerEmail,
                    vehicleId: rawData.id,
                    tab: 'admin',
                    subtab: 'users',
                    highlightSelector: `.admin-user-card[data-email="${rawData.ownerEmail}"]`
                };
                notification.isPremium = isPremium;
                notification.isPremiumTrial = isPremiumTrial;
                break;
                
            case 'photo':
                notification.title = '📸 Photo Service Request';
                notification.subtitle = `${rawData.name || 'Someone'} requested photos for ${rawData.vehicleAddress || 'a vehicle'}`;
                notification.urgency = CONFIG.URGENCY.INFO;
                notification.action = {
                    type: 'scrollToSection',
                    target: 'photoRequestsSection',
                    tab: 'admin',
                    subtab: 'requests',
                    highlightSelector: '#photoRequestsSection'
                };
                break;
                
            case 'premium':
                notification.title = '👑 Premium Listing Request';
                notification.subtitle = `${rawData.title || 'Vehicle'} wants premium placement`;
                notification.urgency = CONFIG.URGENCY.WARNING;
                notification.action = {
                    type: 'scrollToSection',
                    target: 'pendingPremiumAlert',
                    tab: 'admin',
                    subtab: 'users',
                    highlightSelector: '#pendingPremiumAlert'
                };
                break;
                
            case 'rent':
                const daysOverdue = rawData.daysOverdue || 0;
                const isOverdue = daysOverdue > 0;
                const isToday = rawData.isToday;
                notification.title = isOverdue 
                    ? `🚨 OVERDUE: ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`
                    : isToday 
                        ? '⏰ Due Today'
                        : '📅 Due Tomorrow';
                notification.subtitle = `${rawData.title || rawData.vehicleId} - ${rawData.buyerName || 'Unknown'}`;
                notification.urgency = isOverdue ? CONFIG.URGENCY.CRITICAL : isToday ? CONFIG.URGENCY.WARNING : CONFIG.URGENCY.INFO;
                notification.action = {
                    type: 'scrollToRent',
                    target: rawData.vehicleId,
                    tab: 'myVehicles',
                    highlightSelector: `#rent-item-${rawData.vehicleId}`
                };
                break;
        }
        
        return notification;
    }

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================
    
    function addNotification(notification) {
        // Check if already dismissed - log for debugging
        if (state.dismissed.has(notification.id)) {
            return;
        }
        
        const exists = state.notifications.find(n => n.id === notification.id);
        if (exists) return;
        
        state.notifications.unshift(notification);
        
        // Trim if over max
        const byType = state.notifications.filter(n => n.type === notification.type);
        if (byType.length > CONFIG.MAX_PER_TYPE) {
            const oldest = byType[byType.length - 1];
            state.notifications = state.notifications.filter(n => n.id !== oldest.id);
        }
        
        refreshUI();
    }
    
    function dismissNotification(id) {
        state.dismissed.add(id);
        state.notifications = state.notifications.filter(n => n.id !== id);
        
        // Save to Firestore via UserPreferencesService
        if (window.UserPreferencesService) {
            UserPreferencesService.dismissNotification(id);
        }
        
        // Remove the notification card from DOM
        const card = document.getElementById(`notification-${id}`);
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(100px)';
            setTimeout(() => card.remove(), 300);
        }
        
        refreshUI();
    }
    
    function dismissAllOfType(type) {
        const toRemove = state.notifications.filter(n => n.type === type);
        toRemove.forEach(n => state.dismissed.add(n.id));
        state.notifications = state.notifications.filter(n => n.type !== type);
        
        // Save to Firestore via UserPreferencesService
        if (window.UserPreferencesService) {
            UserPreferencesService.dismissNotifications(toRemove.map(n => n.id));
        }
        
        refreshUI();
    }
    
    function getCounts() {
        const counts = {
            user: 0,
            listing: 0,
            photo: 0,
            premium: 0,
            rent: 0,
            subscription: 0,
            total: 0
        };
        
        state.notifications.forEach(n => {
            if (counts.hasOwnProperty(n.type)) {
                counts[n.type]++;
                counts.total++;
            }
        });
        
        // Payment alerts: pending down payments + financing payments
        counts.rent = (state.rentAlerts.pendingDownPayments?.length || 0) +
                      (state.rentAlerts.overdue?.length || 0) +
                      (state.rentAlerts.today?.length || 0) +
                      (state.rentAlerts.tomorrow?.length || 0);
        counts.total += counts.rent;
        
        // Subscription alerts (admin only, set by ui-admin.js)
        counts.subscription = window.subscriptionAlertCount || 0;
        counts.total += counts.subscription;
        
        return counts;
    }
    
    function getByType(type) {
        return state.notifications.filter(n => n.type === type);
    }

    // =========================================================================
    // CLICK ROUTING
    // =========================================================================
    
    async function handleClick(notificationOrId) {
        let notification;
        if (typeof notificationOrId === 'string') {
            notification = state.notifications.find(n => n.id === notificationOrId);
            if (!notification) {
                console.warn('[NotificationManager] Notification not found:', notificationOrId);
                return;
            }
        } else {
            notification = notificationOrId;
        }
        
        const { action } = notification;
        if (!action) {
            console.warn('[NotificationManager] Notification has no action:', notification);
            return;
        }
        
        
        // Step 1: Ensure dashboard is visible
        if (typeof window.goToDashboard === 'function') {
            window.goToDashboard();
        }
        await sleep(300);
        
        // Step 2: Switch to correct dashboard tab
        if (action.tab && typeof window.switchDashboardTab === 'function') {
            window.switchDashboardTab(action.tab);
            await sleep(200);
        }
        
        // Step 3: Switch to correct admin subtab (if applicable)
        if (action.subtab && typeof window.switchAdminTab === 'function') {
            window.switchAdminTab(action.subtab);
            await sleep(200);
        }
        
        // Step 4: Scroll and highlight
        if (action.highlightSelector) {
            await scrollToAndHighlight(action.highlightSelector, notification.type);
        }
    }
    
    /**
     * Handle badge click - navigates to appropriate section based on type
     * Used by dropdown and mobile badges
     */
    async function handleBadgeClick(type) {
        
        // Ensure dashboard is visible
        if (typeof window.goToDashboard === 'function') {
            window.goToDashboard();
        }
        await sleep(300);
        
        // Route based on notification type
        switch (type) {
            case 'user':
            case 'listing':
                // Navigate to admin panel, All Users tab, scroll to notification stack
                if (typeof window.switchDashboardTab === 'function') {
                    window.switchDashboardTab('admin');
                    await sleep(200);
                }
                if (typeof window.switchAdminTab === 'function') {
                    window.switchAdminTab('users');
                    await sleep(200);
                }
                // Highlight the first notification card (not the container)
                await scrollToAndHighlight('#adminNotificationsStack .admin-notification-new', type);
                break;
                
            case 'photo':
                // Navigate to admin panel, Requests tab, scroll to photo section
                if (typeof window.switchDashboardTab === 'function') {
                    window.switchDashboardTab('admin');
                    await sleep(200);
                }
                if (typeof window.switchAdminTab === 'function') {
                    window.switchAdminTab('requests');
                    await sleep(200);
                }
                await scrollToAndHighlight('#photoRequestsSection', type);
                break;
                
            case 'premium':
                // Navigate to admin panel, All Users tab, scroll to premium alert
                if (typeof window.switchDashboardTab === 'function') {
                    window.switchDashboardTab('admin');
                    await sleep(200);
                }
                if (typeof window.switchAdminTab === 'function') {
                    window.switchAdminTab('allUsers');
                    await sleep(200);
                }
                await scrollToAndHighlight('#pendingPremiumAlert', type);
                break;
                
            case 'rent':
                // Navigate to My Vehicles tab, scroll to payment alerts panel
                if (typeof window.switchDashboardTab === 'function') {
                    window.switchDashboardTab('myVehicles');
                    await sleep(200);
                }
                await scrollToAndHighlight('#paymentNotificationsPanel', type);
                break;
                
            case 'subscription':
                // Navigate to admin panel, scroll to subscription alerts
                if (typeof window.switchDashboardTab === 'function') {
                    window.switchDashboardTab('admin');
                    await sleep(200);
                }
                if (typeof window.switchAdminTab === 'function') {
                    window.switchAdminTab('users');
                    await sleep(200);
                }
                await scrollToAndHighlight('#subscriptionNotificationsPanel', type);
                break;
                
            default:
                console.warn('[NotificationManager] Unknown badge type:', type);
        }
    }
    
    async function scrollToAndHighlight(selector, type) {
        const colors = CONFIG.COLORS[type] || CONFIG.COLORS.user;
        
        const element = await waitForElement(selector, 5000);
        
        if (!element) {
            console.warn('[NotificationManager] Element not found:', selector);
            return;
        }
        
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Store original styles
        const originalBoxShadow = element.style.boxShadow;
        const originalTransition = element.style.transition;
        const originalBorderRadius = element.style.borderRadius;
        
        // Ensure border-radius is set for rounded highlight
        if (!element.style.borderRadius && !element.classList.contains('rounded-xl')) {
            element.style.borderRadius = '0.75rem'; // rounded-xl equivalent
        }
        
        // Apply highlight with animation
        element.style.transition = 'box-shadow 0.3s ease';
        element.style.boxShadow = `0 0 0 4px ${colors.primary}, 0 0 30px ${colors.glow}`;
        
        // Add pulse effect by toggling intensity
        let pulseCount = 0;
        const pulseInterval = setInterval(() => {
            pulseCount++;
            if (pulseCount % 2 === 0) {
                element.style.boxShadow = `0 0 0 4px ${colors.primary}, 0 0 30px ${colors.glow}`;
            } else {
                element.style.boxShadow = `0 0 0 3px ${colors.primary}, 0 0 20px ${colors.glow}`;
            }
            if (pulseCount >= 6) {
                clearInterval(pulseInterval);
            }
        }, 200);
        
        // Remove highlight after duration
        setTimeout(() => {
            clearInterval(pulseInterval);
            element.style.boxShadow = originalBoxShadow || '';
            element.style.transition = originalTransition || '';
            if (!originalBorderRadius) {
                element.style.borderRadius = '';
            }
        }, CONFIG.HIGHLIGHT_DURATION);
    }
    
    function waitForElement(selector, maxWait = 5000) {
        return new Promise(resolve => {
            const startTime = Date.now();
            
            function check() {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime > maxWait) {
                    resolve(null);
                } else {
                    setTimeout(check, 100);
                }
            }
            
            check();
        });
    }
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // =========================================================================
    // UI UPDATES
    // =========================================================================
    
    function refreshUI() {
        refreshBadges();
        refreshPanels();
    }
    
    function refreshBadges() {
        const counts = getCounts();
        
        // Dropdown badges
        updateBadge('dropdownUserBadge', 'dropdownUserCount', counts.user);
        updateBadge('dropdownListingBadge', 'dropdownListingCount', counts.listing);
        updateBadge('dropdownPhotoBadge', 'dropdownPhotoCount', counts.photo);
        updateBadge('dropdownPremiumBadge', 'dropdownPremiumCount', counts.premium);
        updateBadge('dropdownRentBadge', 'dropdownRentCount', counts.rent);
        updateBadge('dropdownSubscriptionBadge', 'dropdownSubscriptionCount', counts.subscription);
        
        // Mobile badges
        const mobileAdminTotal = counts.user + counts.listing + counts.photo + counts.premium;
        updateBadge('mobileAdminBadge', 'mobileAdminCount', mobileAdminTotal);
        updateBadge('mobileRentBadge', 'mobileRentCount', counts.rent);
        
        // Navbar notification dot (shows when any admin notification exists)
        const navDot = document.getElementById('navNotificationDot');
        if (navDot) {
            const totalAdminNotifs = counts.user + counts.listing + counts.photo + counts.premium + counts.subscription;
            if (totalAdminNotifs > 0) {
                navDot.classList.remove('hidden');
            } else {
                navDot.classList.add('hidden');
            }
        }
    }
    
    function updateBadge(badgeId, countId, count) {
        const badge = document.getElementById(badgeId);
        const countEl = document.getElementById(countId);
        
        if (!badge) return;
        
        if (count > 0) {
            badge.classList.remove('hidden');
            if (countEl) countEl.textContent = count;
        } else {
            badge.classList.add('hidden');
        }
    }
    
    function refreshPanels() {
        renderNotificationStack();
        renderPaymentAlertsPanel();
        
        // Subscription alerts are rendered by ui-admin.js when admin panel loads
        // Just trigger a refresh if the function exists
        if (typeof window.renderSubscriptionAlertsPanel === 'function') {
            window.renderSubscriptionAlertsPanel();
        }
    }
    
    function renderNotificationStack() {
        const stack = document.getElementById('adminNotificationsStack');
        if (!stack) return;
        
        if (!window.TierService?.isMasterAdmin(auth?.currentUser?.email)) {
            stack.classList.add('hidden');
            return;
        }
        
        const stackNotifications = state.notifications.filter(n => 
            n.type === 'user' || n.type === 'listing'
        );
        
        if (stackNotifications.length === 0) {
            stack.classList.add('hidden');
            return;
        }
        
        stack.classList.remove('hidden');
        
        let html = '';
        stackNotifications.forEach(notification => {
            html += renderNotificationCard(notification);
        });
        
        stack.innerHTML = html;
    }
    
    function renderNotificationCard(notification) {
        const { id, type, title, subtitle, timestamp, isMissed, isPremium, isPremiumTrial } = notification;
        
        let gradientClass, icon;
        
        if (type === 'user') {
            gradientClass = isMissed 
                ? 'from-orange-600 to-amber-600 border-orange-500'
                : 'from-cyan-600 to-blue-600 border-cyan-500';
            icon = isMissed ? '📬' : '👤';
        } else if (type === 'listing') {
            if (isPremium) {
                gradientClass = 'from-amber-600 to-yellow-500 border-amber-400';
                icon = '👑';
            } else if (isPremiumTrial) {
                gradientClass = 'from-cyan-600 to-blue-600 border-cyan-400';
                icon = '🎁';
            } else {
                gradientClass = isMissed 
                    ? 'from-emerald-700 to-green-600 border-emerald-500'
                    : 'from-green-600 to-teal-600 border-green-500';
                icon = isMissed ? '📬' : '🚗';
            }
        }
        
        const timeDisplay = new Date(timestamp).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
        
        let premiumBadge = '';
        if (isPremium) {
            premiumBadge = `
                <div class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded mt-2 animate-pulse">
                    ⚠️ COLLECT $10,000/week PAYMENT
                </div>
            `;
        } else if (isPremiumTrial) {
            premiumBadge = `<div class="text-cyan-300 text-xs mt-1">Free trial - no payment needed</div>`;
        }
        
        return `
            <div id="notification-${id}" 
                 class="bg-gradient-to-r ${gradientClass} rounded-xl p-4 border-2 shadow-lg relative admin-notification-new cursor-pointer" 
                 tabindex="-1"
                 onmousedown="event.preventDefault()"
                 onclick="NotificationManager.handleClick('${id}')">
                <button onclick="event.stopPropagation(); NotificationManager.dismiss('${id}')" 
                        class="absolute top-2 right-2 text-white/70 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition"
                        tabindex="-1"
                        onmousedown="event.preventDefault()">
                    ✕
                </button>
                <div class="flex items-center gap-4 pr-8">
                    <span class="text-3xl">${icon}</span>
                    <div class="flex-1">
                        <div class="text-white font-bold text-lg">${title}</div>
                        <div class="text-white/90">${subtitle}</div>
                        ${premiumBadge}
                        <div class="text-white/60 text-xs mt-1">${timeDisplay}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderPaymentAlertsPanel() {
        const panel = document.getElementById('paymentNotificationsPanel');
        if (!panel) return;
        
        if (!auth?.currentUser?.email) {
            panel.classList.add('hidden');
            return;
        }
        
        const { pendingDownPayments = [], overdue = [], today = [], tomorrow = [] } = state.rentAlerts;
        const totalFinancing = overdue.length + today.length + tomorrow.length;
        const total = pendingDownPayments.length + totalFinancing;
        
        if (total === 0) {
            panel.classList.add('hidden');
            return;
        }
        
        panel.classList.remove('hidden');
        
        const hasDownPayments = pendingDownPayments.length > 0;
        const isUrgent = overdue.length > 0;
        const isWarning = today.length > 0 || hasDownPayments;
        
        const borderColor = isUrgent ? 'border-red-500/70' : isWarning ? 'border-orange-500/70' : 'border-yellow-500/70';
        const headerGradient = isUrgent ? 'from-red-600 to-red-700' : isWarning ? 'from-orange-500 to-amber-500' : 'from-yellow-500 to-orange-400';
        const headerIcon = isUrgent ? '🚨' : hasDownPayments ? '💰' : isWarning ? '⏰' : '📅';
        
        let html = `
            <div class="glass-effect rounded-2xl shadow-2xl overflow-hidden border-2 ${borderColor}">
                <div class="bg-gradient-to-r ${headerGradient} px-6 py-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">${headerIcon}</span>
                            <div>
                                <h3 class="text-xl font-bold text-white">Payment Collection Alert</h3>
                                <p class="text-white/80 text-sm">${total} payment${total !== 1 ? 's' : ''} need${total === 1 ? 's' : ''} attention</p>
                            </div>
                        </div>
                        <button onclick="NotificationManager.togglePaymentPanel()" id="paymentPanelToggle" class="text-white/80 hover:text-white transition">
                            <svg class="w-6 h-6 transform transition-transform" id="paymentPanelArrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div id="paymentPanelContent" class="p-4 space-y-4">
        `;
        
        // Pending Down Payments section
        if (pendingDownPayments.length > 0) {
            html += `
                <div class="bg-amber-900/30 rounded-xl p-4 border border-amber-500/50">
                    <h4 class="text-amber-400 font-bold mb-3 flex items-center gap-2">
                        <span>💵</span> PENDING DOWN PAYMENTS (${pendingDownPayments.length})
                    </h4>
                    <div class="space-y-2">
                        ${pendingDownPayments.map(item => renderDownPaymentItem(item)).join('')}
                    </div>
                </div>
            `;
        }
        
        // Financing Overdue section
        if (overdue.length > 0) {
            html += `
                <div class="bg-red-900/30 rounded-xl p-4 border border-red-500/50">
                    <h4 class="text-red-400 font-bold mb-3 flex items-center gap-2">
                        <span>🚨</span> FINANCING OVERDUE (${overdue.length})
                    </h4>
                    <div class="space-y-2">
                        ${overdue.map(item => renderFinancingItem(item, 'overdue')).join('')}
                    </div>
                </div>
            `;
        }
        
        // Due Today section
        if (today.length > 0) {
            html += `
                <div class="bg-orange-900/30 rounded-xl p-4 border border-orange-500/50">
                    <h4 class="text-orange-400 font-bold mb-3 flex items-center gap-2">
                        <span>⏰</span> DUE TODAY (${today.length})
                    </h4>
                    <div class="space-y-2">
                        ${today.map(item => renderFinancingItem(item, 'today')).join('')}
                    </div>
                </div>
            `;
        }
        
        // Due Tomorrow section
        if (tomorrow.length > 0) {
            html += `
                <div class="bg-yellow-900/30 rounded-xl p-4 border border-yellow-500/50">
                    <h4 class="text-yellow-400 font-bold mb-3 flex items-center gap-2">
                        <span>📅</span> DUE TOMORROW (${tomorrow.length})
                    </h4>
                    <div class="space-y-2">
                        ${tomorrow.map(item => renderFinancingItem(item, 'tomorrow')).join('')}
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        panel.innerHTML = html;
    }
    
    function renderDownPaymentItem(item) {
        const vehicleId = item.propId || item.vehicleId || item.id;
        const vehicleTitle = item.description || item.title || `Vehicle ${vehicleId}`;
        const buyerName = item.buyerName || 'Unknown Buyer';
        const downPayment = item.downPayment || 0;
        const salePrice = item.salePrice || 0;
        
        // Generate reminder message
        const reminderMsg = `Hey ${buyerName}! 👋 Just a friendly reminder about your down payment of $${downPayment.toLocaleString()} for the ${vehicleTitle}. The total sale price is $${salePrice.toLocaleString()}. Let me know when you're ready to complete the payment!`;
        const escapedReminder = reminderMsg.replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        return `
            <div class="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between gap-3">
                <div class="flex-1 min-w-0 cursor-pointer" onclick="viewVehicleStats(${vehicleId})" style="outline: none;">
                    <div class="text-white font-medium truncate">🚗 ${vehicleTitle}</div>
                    <div class="text-gray-400 text-sm">Buyer: ${buyerName}</div>
                    <div class="text-amber-300 text-xs">Awaiting down payment</div>
                </div>
                <div class="text-right">
                    <div class="text-amber-400 font-bold">$${downPayment.toLocaleString()}</div>
                    <div class="text-gray-500 text-xs">of $${salePrice.toLocaleString()}</div>
                    <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${escapedReminder}').then(() => showToast('Reminder copied!', 'success'))" 
                            class="text-cyan-400 hover:text-cyan-300 text-xs mt-1 flex items-center gap-1"
                            style="outline: none;">
                        📋 Copy Reminder
                    </button>
                </div>
            </div>
        `;
    }
    
    function renderFinancingItem(item, status) {
        const statusColors = {
            overdue: 'text-red-300',
            today: 'text-orange-300',
            tomorrow: 'text-yellow-300'
        };
        
        const vehicleId = item.propId || item.vehicleId || item.id;
        const paymentAmount = item.paymentAmount || 0;
        const buyerName = item.buyerName || 'Unknown';
        const vehicleTitle = item.description || item.title || `Vehicle ${vehicleId}`;
        const dueDisplay = item.dueDate ? new Date(item.dueDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Unknown';
        const paymentInfo = item.totalPayments ? `Payment ${(item.currentPayment || 0) + 1} of ${item.totalPayments}` : '';
        
        return `
            <div id="payment-item-${vehicleId}" class="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between gap-3">
                <div class="flex-1 min-w-0 cursor-pointer" onclick="viewVehicleStats(${vehicleId})" style="outline: none;">
                    <div class="text-white font-medium truncate">🚗 ${vehicleTitle}</div>
                    <div class="text-gray-400 text-sm">Buyer: ${buyerName}</div>
                    <div class="${statusColors[status]} text-xs">Due: ${dueDisplay} ${paymentInfo ? `• ${paymentInfo}` : ''}</div>
                </div>
                <div class="text-right">
                    <div class="text-white font-bold">$${paymentAmount.toLocaleString()}</div>
                    <button onclick="event.stopPropagation(); this.blur(); NotificationManager.copyPaymentReminder('${vehicleId}', '${buyerName.replace(/'/g, "\\'")}', '${vehicleTitle.replace(/'/g, "\\'")}', ${paymentAmount})" 
                            class="text-cyan-400 hover:text-cyan-300 text-xs mt-1 flex items-center gap-1"
                            style="outline: none;">
                        📋 Copy Reminder
                    </button>
                </div>
            </div>
        `;
    }
    
    function togglePaymentPanel() {
        const content = document.getElementById('paymentPanelContent');
        const arrow = document.getElementById('paymentPanelArrow');
        
        if (content && arrow) {
            content.classList.toggle('hidden');
            arrow.classList.toggle('rotate-180');
        }
    }
    
    function copyPaymentReminder(vehicleId, buyerName, vehicleTitle, amount) {
        // Find the financing data to get full details
        const allFinancing = [...(state.rentAlerts.overdue || []), ...(state.rentAlerts.today || []), ...(state.rentAlerts.tomorrow || [])];
        const financingData = allFinancing.find(r => String(r.propId) === String(vehicleId) || String(r.id) === String(vehicleId));
        
        let message;
        
        if (financingData) {
            const frequency = financingData.paymentFrequency || 'monthly';
            const dueDate = financingData.dueDate;
            const daysOverdue = financingData.daysOverdue || 0;
            const paymentAmount = financingData.paymentAmount || amount;
            const paymentNum = financingData.currentPayment ? `(Payment ${financingData.currentPayment + 1} of ${financingData.totalPayments})` : '';
            
            const dueDateFormatted = dueDate ? new Date(dueDate + 'T12:00:00').toLocaleDateString('en-US', { 
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
            }) : 'soon';
            
            if (daysOverdue >= 2) {
                message = `Hey ${buyerName}, your ${frequency} financing payment of $${paymentAmount.toLocaleString()} ${paymentNum} was due on ${dueDateFormatted} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago). ⚠️ You are scheduled for repossession in 24 hours if payment is not received. Please make your payment immediately or contact me to discuss your situation.`;
            } else if (daysOverdue > 0) {
                message = `Hey ${buyerName}, your ${frequency} financing payment of $${paymentAmount.toLocaleString()} ${paymentNum} was due on ${dueDateFormatted} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago). Please make your payment as soon as possible. Let me know if you need to discuss anything!`;
            } else if (financingData.isToday) {
                message = `Hey ${buyerName}! 👋 Just a friendly reminder that your ${frequency} financing payment of $${paymentAmount.toLocaleString()} ${paymentNum} is due today (${dueDateFormatted}). Please make your payment when you get a chance. Thanks! 🚗`;
            } else {
                message = `Hey ${buyerName}! 👋 Just a heads up - your ${frequency} financing payment of $${paymentAmount.toLocaleString()} ${paymentNum} is due tomorrow (${dueDateFormatted}). Thanks! 🚗`;
            }
        } else {
            message = `Hey ${buyerName}! 👋 Just a friendly reminder about your financing payment for the ${vehicleTitle} ($${amount.toLocaleString()}). Please send payment when you get a chance. Thanks! 🚗`;
        }
        
        navigator.clipboard.writeText(message).then(() => {
            if (typeof window.showToast === 'function') {
                window.showToast('Reminder copied to clipboard!', 'success');
            } else {
                alert('Reminder copied to clipboard!');
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    // =========================================================================
    // DATA FETCHING & LISTENERS
    // =========================================================================
    
    let initPromise = null; // Prevent concurrent initialization
    
    async function init() {
        // If already initialized, skip
        if (state.initialized) {
            return;
        }
        
        // If initialization is in progress, wait for it
        if (initPromise) {
            return initPromise;
        }
        
        const currentUser = auth?.currentUser;
        if (!currentUser) {
            return;
        }
        
        // Create promise to prevent concurrent calls
        initPromise = (async () => {
            try {
                
                // CRITICAL: Force load preferences from Firestore (not cached)
                // This ensures cross-device sync between desktop/mobile/lb-phone
                if (window.UserPreferencesService) {
                    await UserPreferencesService.forceLoad();
                    
                    // Load dismissed notifications into local Set for fast lookups
                    const dismissedList = UserPreferencesService.getAll().dismissedNotifications || [];
                    state.dismissed = new Set(dismissedList);
                    
                    // Load last admin visit time
                    state.lastAdminVisit = UserPreferencesService.getAdminLastVisit();
                    
                    // Register for real-time sync - when another device dismisses, update here
                    UserPreferencesService.onPreferenceChange((key, value) => {
                        if (key === 'dismissedNotifications') {
                            state.dismissed = new Set(value);
                            
                            // Remove notifications that were dismissed on another device
                            state.notifications = state.notifications.filter(n => !state.dismissed.has(n.id));
                            
                            // Refresh UI to hide dismissed notifications
                            refreshUI();
                        }
                    });
                }
                
                state.sessionStart = new Date();
                
                const isAdmin = window.TierService?.isMasterAdmin(currentUser.email);
                
                if (isAdmin) {
                    startUserListener();
                    startListingListener();
                    
                    // Update admin visit time in Firestore
                    if (window.UserPreferencesService) {
                        UserPreferencesService.updateAdminLastVisit();
                    }
                }
                
                // Check for financing payment alerts (down payments + recurring financing)
                await checkPaymentAlerts();
                state.listeners.rentInterval = setInterval(checkPaymentAlerts, CONFIG.RENT_CHECK_INTERVAL);
                
                state.initialized = true;
                refreshUI();
                
            } catch (error) {
                console.error('[NotificationManager] Init error:', error);
                initPromise = null; // Allow retry on error
            }
        })();
        
        return initPromise;
    }
    
    function destroy() {
        if (state.listeners.users) state.listeners.users();
        if (state.listeners.listings) state.listeners.listings();
        if (state.listeners.rentInterval) clearInterval(state.listeners.rentInterval);
        
        state.notifications = [];
        state.rentAlerts = { overdue: [], today: [], tomorrow: [] };
        state.initialized = false;
        state.knownUserIds.clear();
        state.knownListingIds.clear();
        
    }
    
    function startUserListener() {
        if (state.listeners.users) state.listeners.users();
        
        state.listeners.users = db.collection('users')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .onSnapshot(snapshot => {
                snapshot.docs.forEach(doc => {
                    const userId = doc.id;
                    const user = { id: userId, ...doc.data() };
                    const createdAt = user.createdAt?.toDate?.();
                    
                    // Skip notifications for the current logged-in user's own account
                    const currentUserEmail = auth?.currentUser?.email?.toLowerCase();
                    const userEmail = (user.email || '').toLowerCase();
                    if (currentUserEmail && userEmail === currentUserEmail) {
                        state.knownUserIds.add(userId);
                        return;
                    }
                    
                    if (!state.initialLoadComplete.users) {
                        // Initial load - check for missed notifications
                        state.knownUserIds.add(userId);
                        
                        // Check if user was created after last admin visit
                        if (createdAt && state.lastAdminVisit && createdAt > state.lastAdminVisit) {
                            const notificationId = `user-${userId}`;
                            
                            const notification = createNotification('user', user, {
                                id: notificationId,
                                timestamp: createdAt.toISOString(),
                                isMissed: true
                            });
                            addNotification(notification);
                        }
                    } else {
                        // Real-time - check for new users
                        if (!state.knownUserIds.has(userId)) {
                            state.knownUserIds.add(userId);
                            const notification = createNotification('user', user, {
                                id: `user-${userId}`,
                                isMissed: false
                            });
                            addNotification(notification);
                        }
                    }
                });
                
                state.initialLoadComplete.users = true;
            }, error => {
                console.error('[NotificationManager] Users listener error:', error);
            });
    }
    
    function startListingListener() {
        if (state.listeners.listings) state.listeners.listings();
        
        state.listeners.listings = db.collection('settings').doc('properties')
            .onSnapshot(doc => {
                if (!doc.exists) return;
                
                const vehicles = doc.data();
                
                Object.entries(vehicles).forEach(([propId, prop]) => {
                    // Skip flat keys (e.g., "1.plate") and non-numeric IDs
                    if (propId.includes('.') || isNaN(parseInt(propId))) return;
                    
                    // Skip invalid vehicle data
                    if (!prop || typeof prop !== 'object') return;
                    
                    const createdAt = prop.createdAtTimestamp?.toDate?.() || 
                                     (prop.createdAt ? new Date(prop.createdAt) : null);
                    
                    if (!state.initialLoadComplete.listings) {
                        // Initial load
                        state.knownListingIds.add(propId);
                        
                        // Skip admin's own listings
                        if (prop.ownerEmail === auth?.currentUser?.email) return;
                        
                        if (createdAt && state.lastAdminVisit && createdAt > state.lastAdminVisit) {
                            const listing = { id: parseInt(propId), ...prop };
                            const notification = createNotification('listing', listing, {
                                id: `listing-${propId}`,
                                timestamp: createdAt.toISOString(),
                                isMissed: true
                            });
                            addNotification(notification);
                        }
                    } else {
                        // Real-time
                        if (!state.knownListingIds.has(propId)) {
                            state.knownListingIds.add(propId);
                            
                            // Skip admin's own listings
                            if (prop.ownerEmail === auth?.currentUser?.email) return;
                            
                            const listing = { id: parseInt(propId), ...prop };
                            const notification = createNotification('listing', listing, {
                                id: `listing-${propId}`,
                                isMissed: false
                            });
                            addNotification(notification);
                        }
                    }
                });
                
                state.initialLoadComplete.listings = true;
            }, error => {
                console.error('[NotificationManager] Listings listener error:', error);
            });
    }
    
    /**
     * Check for payment alerts: pending down payments + financing payments due
     * Shows alerts to vehicle OWNERS for their own vehicles
     */
    async function checkPaymentAlerts() {
        const currentUser = auth?.currentUser;
        if (!currentUser) return;
        
        try {
            const propsDoc = await db.collection('settings').doc('properties').get();
            if (!propsDoc.exists) return;
            
            const vehicles = propsDoc.data();
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            const pendingDownPayments = [];
            const financingOverdue = [];
            const financingDueToday = [];
            const financingDueTomorrow = [];
            
            Object.entries(vehicles).forEach(([propId, prop]) => {
                if (!prop) return;
                
                // Only show alerts for current user's vehicles
                if (prop.ownerEmail !== currentUser.email) return;
                
                // Check for pending down payments (active sale with downPaymentReceived: false)
                if (prop.pendingSale && !prop.pendingSale.downPaymentReceived && prop.pendingSale.downPayment > 0) {
                    pendingDownPayments.push({
                        propId,
                        vehicleId: propId,
                        id: propId,
                        title: prop.title || 'Vehicle',
                        description: prop.description || prop.title,
                        buyerName: prop.pendingSale.buyerName || 'Unknown Buyer',
                        buyerPhone: prop.pendingSale.buyerPhone || '',
                        downPayment: prop.pendingSale.downPayment,
                        salePrice: prop.pendingSale.salePrice || prop.buyPrice,
                        contractDate: prop.pendingSale.agreementDate || prop.pendingSale.createdAt,
                        contractId: prop.pendingSale.contractId
                    });
                }
                
                // Check for financing payments due (has active financing with lastPaymentDate)
                if (prop.hasActiveFinancing && prop.lastPaymentDate && prop.paymentFrequency && prop.buyerName) {
                    // Parse the lastPaymentDate (format: YYYY-MM-DD)
                    const lastDateParts = prop.lastPaymentDate.split('-');
                    const lastDate = new Date(
                        parseInt(lastDateParts[0]), 
                        parseInt(lastDateParts[1]) - 1, 
                        parseInt(lastDateParts[2])
                    );
                    lastDate.setHours(0, 0, 0, 0);
                    
                    const nextDate = new Date(lastDate);
                    if (prop.paymentFrequency === 'daily') {
                        nextDate.setDate(nextDate.getDate() + 1);
                    } else if (prop.paymentFrequency === 'weekly') {
                        nextDate.setDate(nextDate.getDate() + 7);
                    } else if (prop.paymentFrequency === 'biweekly') {
                        nextDate.setDate(nextDate.getDate() + 14);
                    } else {
                        // Monthly
                        nextDate.setMonth(nextDate.getMonth() + 1);
                    }
                    
                    const dueDate = nextDate.toISOString().split('T')[0];
                    const daysUntilDue = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    
                    // Get payment amount based on frequency
                    let paymentAmount = prop.weeklyPrice || 0;
                    if (prop.paymentFrequency === 'daily' && prop.dailyPrice) {
                        paymentAmount = prop.dailyPrice;
                    } else if (prop.paymentFrequency === 'biweekly' && prop.biweeklyPrice) {
                        paymentAmount = prop.biweeklyPrice;
                    } else if (prop.paymentFrequency === 'monthly' && prop.monthlyPrice) {
                        paymentAmount = prop.monthlyPrice;
                    } else if (prop.paymentFrequency === 'daily') {
                        paymentAmount = Math.round((prop.weeklyPrice || 0) / 7);
                    } else if (prop.paymentFrequency === 'biweekly') {
                        paymentAmount = (prop.weeklyPrice || 0) * 2;
                    } else if (prop.paymentFrequency === 'monthly') {
                        paymentAmount = (prop.weeklyPrice || 0) * 4;
                    }
                    
                    const financingData = {
                        propId,
                        vehicleId: propId,
                        id: propId,
                        title: prop.title || 'Vehicle',
                        description: prop.description || prop.title,
                        buyerName: prop.buyerName,
                        buyerPhone: prop.buyerPhone || '',
                        paymentFrequency: prop.paymentFrequency,
                        paymentAmount,
                        dueDate,
                        daysUntilDue,
                        currentPayment: prop.financingCurrentPayment || 0,
                        totalPayments: prop.financingTotalPayments || 0
                    };
                    
                    if (daysUntilDue < 0) {
                        financingData.daysOverdue = Math.abs(daysUntilDue);
                        financingOverdue.push(financingData);
                    } else if (daysUntilDue === 0) {
                        financingData.isToday = true;
                        financingDueToday.push(financingData);
                    } else if (daysUntilDue === 1) {
                        financingDueTomorrow.push(financingData);
                    }
                }
            });
            
            state.rentAlerts = {
                pendingDownPayments,
                overdue: financingOverdue,
                today: financingDueToday,
                tomorrow: financingDueTomorrow
            };
            
            refreshUI();
            
        } catch (error) {
            console.error('[NotificationManager] Error checking payment alerts:', error);
        }
    }

    // =========================================================================
    // BACKWARD COMPATIBILITY
    // =========================================================================
    
    const AdminNotificationsCompat = {
        get rentNotifications() { return state.rentAlerts; },
        get visible() {
            const map = new Map();
            state.notifications.forEach(n => {
                map.set(n.id, { type: `new-${n.type}-`, content: n });
            });
            return map;
        },
        dismissed: state.dismissed,
        get counts() { return getCounts(); }
    };
    
    const AdminNotifStateCompat = {
        get rentNotifications() { return state.rentAlerts; },
        get currentNotifications() { return state.notifications; },
        seenThisSession: { users: new Set(), listings: new Set(), photos: new Set(), premium: new Set() },
        listeners: state.listeners,
        initialized: {
            get users() { return state.initialized; },
            get listings() { return state.initialized; },
            get photos() { return state.initialized; },
            get premium() { return state.initialized; }
        }
    };

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    
    window.NotificationManager = {
        // State
        get state() { return state; },
        get notifications() { return state.notifications; },
        get rentAlerts() { return state.rentAlerts; },
        
        // Core
        init,
        destroy,
        
        // Notification management
        add: addNotification,
        dismiss: dismissNotification,
        dismissAll: dismissAllOfType,
        
        // Getters
        getCounts,
        getByType,
        
        // Actions
        handleClick,
        handleBadgeClick,
        
        // UI
        refreshUI,
        refreshBadges,
        refreshPanels,
        
        // Payment alerts (replaces rent)
        checkPaymentAlerts,
        togglePaymentPanel,
        copyPaymentReminder,
        
        // Utilities
        createNotification,
        scrollToAndHighlight,
        
        CONFIG
    };
    
    // Backward compatibility
    window.AdminNotifications = AdminNotificationsCompat;
    window.AdminNotifState = AdminNotifStateCompat;
    
    // Legacy aliases
    window.initAdminNotifications = init;
    window.initAdminNotificationSystem = init;
    window.initRentNotifications = checkPaymentAlerts;
    window.checkRentDueNotifications = checkPaymentAlerts;
    window.renderRentNotificationsPanel = renderPaymentAlertsPanel;
    window.updateMobileRentBadge = refreshBadges;
    window.updateMobileAdminBadges = refreshBadges;


})();
