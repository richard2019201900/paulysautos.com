/**
 * ============================================================================
 * UI PROFILE - User profile and vehicle navigation
 * ============================================================================
 * 
 * CONTENTS:
 * - Vehicle navigation (next/prev vehicle)
 * - Username functions
 * - Profile completion check
 * - Tier badge updates
 * - Save username/phone
 * 
 * DEPENDENCIES: TierService, VehicleDataService, UserPreferencesService
 * ============================================================================
 */

// ==================== PROPERTY NAVIGATION ====================
// Navigate between vehicles (prev/next)
window.navigateProperty = function(direction) {
    const currentId = state.currentVehicleId;
    if (!currentId) return;
    
    // Get the current list of visible/filtered vehicles
    const visibleVehicles = getVisibleProperties();
    
    if (visibleVehicles.length === 0) return;
    
    // Find current vehicle index
    const currentIndex = visibleVehicles.findIndex(p => p.id === currentId);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : visibleVehicles.length - 1;
    } else {
        newIndex = currentIndex < visibleVehicles.length - 1 ? currentIndex + 1 : 0;
    }
    
    const newVehicle = visibleVehicles[newIndex];
    if (newVehicle) {
        // Navigate to the new vehicle
        viewVehicle(newVehicle.id);
        // Scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Alias for vehicle navigation
window.navigateVehicle = window.navigateProperty;

// Get list of currently visible vehicles (respecting filters)
window.getVisibleProperties = function() {
    // If we have filtered vehicles, use those, otherwise use all
    if (state.filteredVehicles && state.filteredVehicles.length > 0) {
        return state.filteredVehicles;
    }
    return vehicles;
};

// Update the vehicle navigation counter
window.updatePropertyNavCounter = function() {
    const counter = $('vehicleNavCounter');
    const prevBtn = $('prevPropertyBtn');
    const nextBtn = $('nextPropertyBtn');
    
    if (!counter) return;
    
    const currentId = state.currentVehicleId;
    const visibleVehicles = getVisibleProperties();
    const currentIndex = visibleVehicles.findIndex(p => p.id === currentId);
    
    if (currentIndex !== -1 && visibleVehicles.length > 0) {
        counter.textContent = `${currentIndex + 1} of ${visibleVehicles.length}`;
        
        // Show/hide nav buttons based on vehicle count
        if (prevBtn) prevBtn.style.display = visibleVehicles.length > 1 ? 'block' : 'none';
        if (nextBtn) nextBtn.style.display = visibleVehicles.length > 1 ? 'block' : 'none';
    } else {
        counter.textContent = '';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }
};

// Keyboard navigation for vehicles
document.addEventListener('keydown', function(e) {
    const detailPage = $('vehicleDetailPage');
    const statsPage = $('vehicleStatsPage');
    
    // Don't navigate if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    
    // Handle vehicle detail page navigation
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

// Navigate between vehicles on stats page
window.navigateStats = function(direction) {
    const currentId = state.currentVehicleId;
    if (!currentId) return;
    
    // Get owner's vehicles (or all if admin)
    const userEmail = auth.currentUser?.email?.toLowerCase();
    const isMasterAdmin = TierService.isMasterAdmin(userEmail);
    
    let userVehicles;
    if (isMasterAdmin) {
        // Admin can navigate all vehicles
        userVehicles = vehicles;
    } else {
        // Regular user can only navigate their own vehicles
        userVehicles = OwnershipService.getVehiclesForOwner(userEmail);
    }
    
    if (userVehicles.length === 0) return;
    
    // Find current vehicle index
    const currentIndex = userVehicles.findIndex(p => p.id === currentId);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : userVehicles.length - 1;
    } else {
        newIndex = currentIndex < userVehicles.length - 1 ? currentIndex + 1 : 0;
    }
    
    const newVehicle = userVehicles[newIndex];
    if (newVehicle) {
        viewVehicleStats(newVehicle.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Update the stats navigation counter
window.updateStatsNavCounter = function() {
    const counter = $('statsNavCounter');
    const prevBtn = $('prevStatsBtn');
    const nextBtn = $('nextStatsBtn');
    
    if (!counter) return;
    
    const currentId = state.currentVehicleId;
    const userEmail = auth.currentUser?.email?.toLowerCase();
    const isMasterAdmin = TierService.isMasterAdmin(userEmail);
    
    let userVehicles;
    if (isMasterAdmin) {
        userVehicles = vehicles;
    } else {
        userVehicles = OwnershipService.getVehiclesForOwner(userEmail);
    }
    
    const currentIndex = userVehicles.findIndex(p => p.id === currentId);
    
    if (currentIndex !== -1 && userVehicles.length > 0) {
        counter.textContent = `${currentIndex + 1} of ${userVehicles.length}`;
        
        // Show/hide nav buttons based on vehicle count
        if (prevBtn) prevBtn.style.display = userVehicles.length > 1 ? 'block' : 'none';
        if (nextBtn) nextBtn.style.display = userVehicles.length > 1 ? 'block' : 'none';
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
            
            // ============================================================
            // DISPLAY NAME HIERARCHY (single source of truth)
            // Priority: displayName > firstName+lastName > BLANK (for new users)
            // NEVER auto-populate from email - user must enter their real name
            // ============================================================
            let displayNameToShow = '';
            
            if (data.displayName && data.displayName.trim().length > 0) {
                // User has already set a display name
                displayNameToShow = data.displayName;
            } else if (data.firstName && data.lastName) {
                displayNameToShow = data.firstName + ' ' + data.lastName;
            } else if (data.firstName) {
                displayNameToShow = data.firstName;
            }
            // If none of the above, leave blank - don't auto-populate from email
            
            // Populate the input field with the resolved display name
            const inputEl = $('ownerUsername');
            if (inputEl) {
                inputEl.value = displayNameToShow;
            }
            
            // Pre-populate cache with the same value
            window.ownerUsernameCache = window.ownerUsernameCache || {};
            window.ownerUsernameCache[user.email.toLowerCase()] = displayNameToShow;
            
            if (data.phone) {
                // Sanitize phone - remove all non-digits
                $('ownerPhone').value = data.phone.replace(/\D/g, '');
            }
            
            // Update tier badge
            const tier = data.tier || 'starter';
            updateTierBadge(tier, user.email);
            
            // Check profile completion (skip for master owner)
            if (!TierService.isMasterAdmin(user.email)) {
                checkProfileCompletion(displayNameToShow, data.phone);
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
            if (tier === 'elite') {
                badgeEl.classList.add('border-amber-600');
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
    
    // ============================================================
    // DISPLAY NAME SAVE LOGIC
    // This saves to 'displayName' field ONLY
    // Auto-capitalizes first letter of each word
    // ============================================================
    
    let rawName = $('ownerUsername').value.trim();
    
    // Auto-capitalize first letter of each word
    const newDisplayName = rawName
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    // Update the input field with capitalized version
    $('ownerUsername').value = newDisplayName;
    
    const btn = $('saveUsernameBtn');
    const status = $('usernameStatus');
    
    if (!newDisplayName) {
        status.textContent = 'Please enter your first and last name';
        status.className = 'text-yellow-400 text-sm mt-3';
        showElement(status);
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    try {
        // ONLY update displayName - never touch the internal username field
        await db.collection('users').doc(user.uid).set({
            displayName: newDisplayName,
            email: user.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Sync display name to all user's vehicles (for permission-denied fallback)
        const phone = $('ownerPhone')?.value?.replace(/\D/g, '') || '';
        await syncOwnerProfileToProperties(user.email, newDisplayName, phone);
        
        status.textContent = 'Display name saved successfully!';
        status.className = 'text-green-400 text-sm mt-3';
        showElement(status);
        
        // Update cache with the new display name
        window.ownerUsernameCache = window.ownerUsernameCache || {};
        window.ownerUsernameCache[user.email.toLowerCase()] = newDisplayName;
        
        // Update nav bar display
        updateNavUserDisplay();
        
        // Sync everywhere (updates any visible UI elements)
        syncOwnerNameEverywhere(user.email, newDisplayName);
        
        // Update admin user list if visible
        const adminCard = document.querySelector(`[data-userid]`);
        if (adminCard) {
            const inputField = document.querySelector(`[id^="adminName_"]`);
            if (inputField && inputField.closest('[data-email]')?.dataset.email === user.email) {
                inputField.value = newDisplayName;
            }
        }
        
        // Re-check profile completion
        checkProfileCompletion(newDisplayName, phone);
        
        // Clear new user welcome styling if profile is now complete
        if (newDisplayName && phone && phone.length >= 7) {
            if (typeof clearNewUserWelcome === 'function') {
                clearNewUserWelcome();
            }
        }
        
        // Award XP for adding display name (gamification)
        if (typeof GamificationService !== 'undefined') {
            GamificationService.awardAchievement(user.uid, 'display_name', 50).then(result => {
                if (result && !result.alreadyEarned) {
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
        
        // IMPORTANT: Sync phone to all user's vehicles for public visibility
        // This allows non-admin users to see owner contact info
        const displayName = $('ownerUsername')?.value?.trim() || '';
        await syncOwnerProfileToProperties(user.email, displayName, phone);
        
        status.textContent = 'Phone number saved successfully!';
        status.className = 'text-green-400 text-sm mt-3';
        showElement(status);
        
        // Re-check profile completion
        const username = $('ownerUsername')?.value?.trim() || '';
        checkProfileCompletion(username, phone);
        
        // Clear new user welcome styling if profile is now complete
        if (username && phone && phone.length >= 7) {
            if (typeof clearNewUserWelcome === 'function') {
                clearNewUserWelcome();
            }
        }
        
        // Award XP for adding phone number (gamification)
        if (typeof GamificationService !== 'undefined') {
            GamificationService.awardAchievement(user.uid, 'phone_added', 150).then(result => {
                if (result && !result.alreadyEarned) {
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

