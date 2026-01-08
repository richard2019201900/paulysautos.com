/**
 * ============================================================================
 * UI PROFILE - User profile and property navigation
 * ============================================================================
 * 
 * CONTENTS:
 * - Property navigation (next/prev property)
 * - Username functions
 * - Profile completion check
 * - Tier badge updates
 * - Save username/phone
 * 
 * DEPENDENCIES: TierService, PropertyDataService, UserPreferencesService
 * ============================================================================
 */

// ==================== PROPERTY NAVIGATION ====================
// Navigate between properties (prev/next)
window.navigateProperty = function(direction) {
    const currentId = state.currentPropertyId;
    if (!currentId) return;
    
    // Get the current list of visible/filtered properties
    const visibleProperties = getVisibleProperties();
    
    if (visibleProperties.length === 0) return;
    
    // Find current property index
    const currentIndex = visibleProperties.findIndex(p => p.id === currentId);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : visibleProperties.length - 1;
    } else {
        newIndex = currentIndex < visibleProperties.length - 1 ? currentIndex + 1 : 0;
    }
    
    const newProperty = visibleProperties[newIndex];
    if (newProperty) {
        // Navigate to the new property
        viewProperty(newProperty.id);
        // Scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Alias for vehicle navigation
window.navigateVehicle = window.navigateProperty;

// Get list of currently visible properties (respecting filters)
window.getVisibleProperties = function() {
    // If we have filtered properties, use those, otherwise use all
    if (state.filteredProperties && state.filteredProperties.length > 0) {
        return state.filteredProperties;
    }
    return properties;
};

// Update the property navigation counter
window.updatePropertyNavCounter = function() {
    const counter = $('propertyNavCounter');
    const prevBtn = $('prevPropertyBtn');
    const nextBtn = $('nextPropertyBtn');
    
    if (!counter) return;
    
    const currentId = state.currentPropertyId;
    const visibleProperties = getVisibleProperties();
    const currentIndex = visibleProperties.findIndex(p => p.id === currentId);
    
    if (currentIndex !== -1 && visibleProperties.length > 0) {
        counter.textContent = `${currentIndex + 1} of ${visibleProperties.length}`;
        
        // Show/hide nav buttons based on property count
        if (prevBtn) prevBtn.style.display = visibleProperties.length > 1 ? 'block' : 'none';
        if (nextBtn) nextBtn.style.display = visibleProperties.length > 1 ? 'block' : 'none';
    } else {
        counter.textContent = '';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }
};

// Keyboard navigation for properties
document.addEventListener('keydown', function(e) {
    const detailPage = $('propertyDetailPage');
    const statsPage = $('propertyStatsPage');
    
    // Don't navigate if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    
    // Handle property detail page navigation
    if (detailPage && !detailPage.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateProperty('prev');
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateProperty('next');
        } else if (e.key === 'Escape') {
            e.preventDefault();
            goBack();
        }
    }
    
    // Handle stats page navigation
    if (statsPage && !statsPage.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateStats('prev');
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateStats('next');
        } else if (e.key === 'Escape') {
            e.preventDefault();
            backToDashboard();
        }
    }
});

// Navigate between properties on stats page
window.navigateStats = function(direction) {
    const currentId = state.currentPropertyId;
    if (!currentId) return;
    
    // Get owner's properties (or all if admin)
    const userEmail = auth.currentUser?.email?.toLowerCase();
    const isMasterAdmin = TierService.isMasterAdmin(userEmail);
    
    let userProperties;
    if (isMasterAdmin) {
        // Admin can navigate all properties
        userProperties = properties;
    } else {
        // Regular user can only navigate their own properties
        userProperties = OwnershipService.getPropertiesForOwner(userEmail);
    }
    
    if (userProperties.length === 0) return;
    
    // Find current property index
    const currentIndex = userProperties.findIndex(p => p.id === currentId);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : userProperties.length - 1;
    } else {
        newIndex = currentIndex < userProperties.length - 1 ? currentIndex + 1 : 0;
    }
    
    const newProperty = userProperties[newIndex];
    if (newProperty) {
        viewPropertyStats(newProperty.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Update the stats navigation counter
window.updateStatsNavCounter = function() {
    const counter = $('statsNavCounter');
    const prevBtn = $('prevStatsBtn');
    const nextBtn = $('nextStatsBtn');
    
    if (!counter) return;
    
    const currentId = state.currentPropertyId;
    const userEmail = auth.currentUser?.email?.toLowerCase();
    const isMasterAdmin = TierService.isMasterAdmin(userEmail);
    
    let userProperties;
    if (isMasterAdmin) {
        userProperties = properties;
    } else {
        userProperties = OwnershipService.getPropertiesForOwner(userEmail);
    }
    
    const currentIndex = userProperties.findIndex(p => p.id === currentId);
    
    if (currentIndex !== -1 && userProperties.length > 0) {
        counter.textContent = `${currentIndex + 1} of ${userProperties.length}`;
        
        // Show/hide nav buttons based on property count
        if (prevBtn) prevBtn.style.display = userProperties.length > 1 ? 'block' : 'none';
        if (nextBtn) nextBtn.style.display = userProperties.length > 1 ? 'block' : 'none';
    } else {
        counter.textContent = '';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }
};

// ==================== USERNAME FUNCTIONS ====================
window.loadUsername = async function() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            if (data.username) {
                $('ownerUsername').value = data.username;
                // Pre-populate cache for this user
                window.ownerUsernameCache = window.ownerUsernameCache || {};
                window.ownerUsernameCache[user.email.toLowerCase()] = data.username;
            }
            if (data.phone) {
                // Sanitize phone - remove all non-digits
                $('ownerPhone').value = data.phone.replace(/\D/g, '');
            }
            
            // Update tier badge
            const tier = data.tier || 'starter';
            updateTierBadge(tier, user.email);
            
            // Check profile completion (skip for master owner)
            if (!TierService.isMasterAdmin(user.email)) {
                checkProfileCompletion(data.username, data.phone);
            }
        } else {
            // New user with no document - show profile completion
            if (!TierService.isMasterAdmin(user.email)) {
                checkProfileCompletion(null, null);
            }
        }
    } catch (error) {
        console.error('Error loading user settings:', error);
    }
}

// ==================== PROFILE COMPLETION CHECK ====================
window.isProfileComplete = false;

window.checkProfileCompletion = function(username, phone) {
    const hasUsername = username && username.trim().length > 0;
    const hasPhone = phone && phone.replace(/\D/g, '').length > 0;
    
    window.isProfileComplete = hasUsername && hasPhone;
    
    // Update checkmarks in overlay
    const nameCheck = $('profileCheckName');
    const phoneCheck = $('profileCheckPhone');
    
    if (nameCheck) {
        if (hasUsername) {
            nameCheck.className = 'w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center text-xs';
            nameCheck.innerHTML = '<span class="text-white">✓</span>';
        } else {
            nameCheck.className = 'w-6 h-6 rounded-full border-2 border-gray-500 flex items-center justify-center text-xs';
            nameCheck.innerHTML = '<span class="text-gray-500">✗</span>';
        }
    }
    
    if (phoneCheck) {
        if (hasPhone) {
            phoneCheck.className = 'w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center text-xs';
            phoneCheck.innerHTML = '<span class="text-white">✓</span>';
        } else {
            phoneCheck.className = 'w-6 h-6 rounded-full border-2 border-gray-500 flex items-center justify-center text-xs';
            phoneCheck.innerHTML = '<span class="text-gray-500">✗</span>';
        }
    }
    
    if (!window.isProfileComplete) {
        showProfileCompletionOverlay();
    } else {
        hideProfileCompletionOverlay();
    }
}

window.showProfileCompletionOverlay = function() {
    let overlay = $('profileCompletionOverlay');
    if (overlay) {
        showElement(overlay);
    }
}

window.hideProfileCompletionOverlay = function() {
    let overlay = $('profileCompletionOverlay');
    if (overlay) {
        hideElement(overlay);
    }
}

window.scrollToProfileSettings = function() {
    hideProfileCompletionOverlay();
    
    // Navigate to dashboard first
    goToDashboard();
    
    // Wait for dashboard to render, then scroll and highlight
    setTimeout(() => {
        const profileSection = $('profileSettingsSection');
        if (profileSection) {
            profileSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add gold border effect to draw attention
            profileSection.classList.add('ring-4', 'ring-yellow-500', 'ring-opacity-100');
            profileSection.style.boxShadow = '0 0 20px rgba(234, 179, 8, 0.5)';
            setTimeout(() => {
                profileSection.classList.remove('ring-4', 'ring-yellow-500', 'ring-opacity-100');
                profileSection.style.boxShadow = '';
            }, 5000);
        } else {
            // Fallback - scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, 300);
}

// Check if navigation should be blocked
window.canNavigateAway = function() {
    const user = auth.currentUser;
    if (!user) return true; // Not logged in, can navigate
    if (TierService.isMasterAdmin(user.email)) return true; // Owner can always navigate
    return window.isProfileComplete;
}


window.updateTierBadge = function(tier, email) {
    const isMasterAdmin = TierService.isMasterAdmin(email);
    // CRITICAL: Use OwnershipService for consistent listing count
    const listingCount = OwnershipService.getListingCount(email);
    
    const iconEl = $('tierIcon');
    const nameEl = $('tierName');
    const listingsEl = $('tierListings');
    const badgeEl = $('userTierBadge');
    const upgradeBtn = $('tierUpgradeBtn');
    const pendingBadge = $('tierPendingBadge');
    
    if (isMasterAdmin) {
        // Master admin gets special display
        if (iconEl) iconEl.textContent = '👑';
        if (nameEl) nameEl.textContent = 'Owner';
        if (listingsEl) listingsEl.textContent = `${listingCount}/∞ Listings`;
        if (upgradeBtn) hideElement(upgradeBtn);
        if (pendingBadge) hideElement(pendingBadge);
        
        if (badgeEl) {
            badgeEl.className = badgeEl.className.replace(/border-\w+-\d+/g, '');
            badgeEl.classList.add('border-red-600');
        }
    } else {
        const tierData = TIERS[tier] || TIERS.starter;
        const maxListings = tierData.maxListings === Infinity ? '∞' : tierData.maxListings;
        
        if (iconEl) iconEl.textContent = tierData.icon;
        if (nameEl) nameEl.textContent = tierData.name;
        if (listingsEl) listingsEl.textContent = `${listingCount}/${maxListings} Listings`;
        
        // Hide upgrade button if already at Elite (max tier)
        if (upgradeBtn) {
            if (tier === 'elite') {
                hideElement(upgradeBtn);
            } else {
                showElement(upgradeBtn);
            }
        }
        
        // Update badge background based on tier
        if (badgeEl) {
            badgeEl.className = badgeEl.className.replace(/border-\w+-\d+/g, '');
            if (tier === 'pro') {
                badgeEl.classList.add('border-yellow-600');
            } else if (tier === 'elite') {
                badgeEl.classList.add('border-purple-600');
            } else {
                badgeEl.classList.add('border-gray-600');
            }
        }
        
        // Check for pending upgrade request
        checkPendingUpgradeRequest(email);
    }
    
    // Show/hide admin section
    const adminSection = $('adminSection');
    if (adminSection) {
        if (isMasterAdmin) {
            showElement(adminSection);
            resetAdminTiles(); // Reset tiles to front view
            loadPendingUpgradeRequests();
            loadAllUsers(); // Load users immediately when dashboard loads
            
            // Start real-time users listener for new user notifications
            if (typeof startAdminUsersListener === 'function') {
                startAdminUsersListener();
            }
            
            // Also check for subscription alerts after a delay (to allow user list to load)
            setTimeout(() => {
                if (window.adminUsersData) {
                    showSubscriptionAlert();
                }
            }, 2000);
        } else {
            hideElement(adminSection);
        }
    }
}

window.saveUsername = async function() {
    const user = auth.currentUser;
    if (!user) return;
    
    const username = $('ownerUsername').value.trim();
    const btn = $('saveUsernameBtn');
    const status = $('usernameStatus');
    
    if (!username) {
        status.textContent = 'Please enter a display name';
        status.className = 'text-yellow-400 text-sm mt-3';
        showElement(status);
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    try {
        await db.collection('users').doc(user.uid).set({
            username: username,
            email: user.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // IMPORTANT: Sync display name (and phone if available) to all user's properties
        // This allows non-admin users to see owner info without permission issues
        const phone = $('ownerPhone')?.value?.replace(/\D/g, '') || '';
        await syncOwnerProfileToProperties(user.email, username, phone);
        
        status.textContent = 'Display name saved successfully!';
        status.className = 'text-green-400 text-sm mt-3';
        showElement(status);
        
        // Update cache
        window.ownerUsernameCache = window.ownerUsernameCache || {};
        window.ownerUsernameCache[user.email.toLowerCase()] = username;
        
        // Update nav bar display
        updateNavUserDisplay();
        
        // Sync everywhere
        syncOwnerNameEverywhere(user.email, username);
        
        // Update admin user list if visible
        const adminCard = document.querySelector(`[data-userid]`);
        if (adminCard) {
            const inputField = document.querySelector(`[id^="adminName_"]`);
            if (inputField && inputField.closest('[data-email]')?.dataset.email === user.email) {
                inputField.value = username;
            }
        }
        
        // Re-check profile completion (reuse phone variable from sync call above)
        checkProfileCompletion(username, phone);
        
        // Award XP for adding display name (gamification)
        if (typeof GamificationService !== 'undefined') {
            GamificationService.awardAchievement(user.uid, 'display_name', 50).then(result => {
                if (result && !result.alreadyEarned) {
                    console.log('[Gamification] Awarded 50 XP for display name');
                    // Check if profile is now complete
                    if (phone && phone.length === 10) {
                        GamificationService.awardAchievement(user.uid, 'profile_complete', 100);
                    }
                }
            }).catch(err => console.error('[Gamification] Error:', err));
        }
        
        setTimeout(() => hideElement(status), 3000);
    } catch (error) {
        console.error('Error saving username:', error);
        status.textContent = 'Error saving display name. Please try again.';
        status.className = 'text-red-400 text-sm mt-3';
        showElement(status);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Name';
    }
};

window.saveOwnerPhone = async function() {
    const user = auth.currentUser;
    if (!user) return;
    
    // Remove all non-digit characters from phone
    const phone = $('ownerPhone').value.replace(/\D/g, '');
    $('ownerPhone').value = phone; // Update the field to show cleaned number
    
    const btn = $('savePhoneBtn');
    const status = $('phoneStatus');
    
    if (!phone) {
        status.textContent = 'Please enter a phone number';
        status.className = 'text-yellow-400 text-sm mt-3';
        showElement(status);
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    try {
        await db.collection('users').doc(user.uid).set({
            phone: phone,
            email: user.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // IMPORTANT: Sync phone to all user's properties for public visibility
        // This allows non-admin users to see owner contact info
        const displayName = $('ownerUsername')?.value?.trim() || '';
        await syncOwnerProfileToProperties(user.email, displayName, phone);
        
        status.textContent = 'Phone number saved successfully!';
        status.className = 'text-green-400 text-sm mt-3';
        showElement(status);
        
        // Re-check profile completion
        const username = $('ownerUsername')?.value?.trim() || '';
        checkProfileCompletion(username, phone);
        
        // Award XP for adding phone number (gamification)
        if (typeof GamificationService !== 'undefined') {
            GamificationService.awardAchievement(user.uid, 'phone_added', 150).then(result => {
                if (result && !result.alreadyEarned) {
                    console.log('[Gamification] Awarded 150 XP for phone number');
                    // Check if profile is now complete
                    if (username) {
                        GamificationService.awardAchievement(user.uid, 'profile_complete', 100);
                    }
                }
            }).catch(err => console.error('[Gamification] Error:', err));
        }
        
        setTimeout(() => hideElement(status), 3000);
    } catch (error) {
        console.error('Error saving phone:', error);
        status.textContent = 'Error saving phone number. Please try again.';
        status.className = 'text-red-400 text-sm mt-3';
        showElement(status);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Phone';
    }
};

