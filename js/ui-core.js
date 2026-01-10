/**
 * ============================================================================
 * UI CORE - Core UI utilities and site-wide features
 * ============================================================================
 * 
 * CONTENTS:
 * - Site update notifications
 * - Dashboard tab switching
 * - Toast notifications
 * - Pricing tiers renderer
 * - Price warning system
 * - Buy price validation
 * 
 * DEPENDENCIES: UserPreferencesService, TierService
 * ============================================================================
 */

// ==================== SITE UPDATE NOTIFICATIONS ====================
// Change this version string whenever you publish a new site update
const LATEST_SITE_UPDATE_VERSION = '2024-12-30-v1';

// Check if user has seen the latest site update
window.hasUnreadSiteUpdate = function() {
    // Use UserPreferencesService if available
    if (window.UserPreferencesService) {
        return !UserPreferencesService.hasSeenSiteUpdate(LATEST_SITE_UPDATE_VERSION);
    }
    // Fallback for logged-out users (always show)
    return true;
};

// Mark site update as read
window.markSiteUpdateAsRead = function() {
    // Save to Firestore via UserPreferencesService
    if (window.UserPreferencesService) {
        UserPreferencesService.markSiteUpdateSeen(LATEST_SITE_UPDATE_VERSION);
    }
    // Hide both badges
    const navBadge = $('siteUpdateNavBadge');
    const dropdownBadge = $('siteUpdateBadge');
    if (navBadge) navBadge.classList.add('hidden');
    if (dropdownBadge) dropdownBadge.classList.add('hidden');
    // Remove site update notification from dashboard
    const siteUpdateNotif = $('siteUpdateNotification');
    if (siteUpdateNotif) {
        siteUpdateNotif.style.transition = 'all 0.3s ease';
        siteUpdateNotif.style.opacity = '0';
        siteUpdateNotif.style.transform = 'translateX(20px)';
        setTimeout(() => siteUpdateNotif.remove(), 300);
    }
};

// Update site update badge visibility
window.updateSiteUpdateBadge = function() {
    const navBadge = $('siteUpdateNavBadge');
    const dropdownBadge = $('siteUpdateBadge');
    const mobileBadge = $('mobileSiteUpdateBadge');
    const dropdownMenu = $('userDropdownMenu');
    const isDropdownOpen = dropdownMenu && !dropdownMenu.classList.contains('hidden');
    
    if (hasUnreadSiteUpdate()) {
        // If dropdown is open, show badge in dropdown, hide nav badge
        if (isDropdownOpen) {
            if (navBadge) navBadge.classList.add('hidden');
            if (dropdownBadge) dropdownBadge.classList.remove('hidden');
        } else {
            // If dropdown is closed, show nav badge, hide dropdown badge
            if (navBadge) navBadge.classList.remove('hidden');
            if (dropdownBadge) dropdownBadge.classList.add('hidden');
        }
        // Always show mobile badge when there's an unread update
        if (mobileBadge) mobileBadge.classList.remove('hidden');
    } else {
        if (navBadge) navBadge.classList.add('hidden');
        if (dropdownBadge) dropdownBadge.classList.add('hidden');
        if (mobileBadge) mobileBadge.classList.add('hidden');
    }
};

// Render site update notification for dashboard
window.renderSiteUpdateNotification = function() {
    if (!hasUnreadSiteUpdate()) return '';
    
    return `
        <div id="siteUpdateNotification" class="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 rounded-xl p-4 flex items-start justify-between gap-4 mb-4">
            <div class="flex items-start gap-3 cursor-pointer" onclick="goToBlog()">
                <span class="text-2xl">📰</span>
                <div>
                    <h4 class="text-white font-bold">New Site Update Available!</h4>
                    <p class="text-gray-300 text-sm mt-1">Check out the latest features and improvements we've added to PaulysAutos.com</p>
                    <p class="text-purple-400 text-xs mt-2 font-medium hover:text-purple-300">Click to view Site Updates →</p>
                </div>
            </div>
            <button onclick="event.stopPropagation(); dismissSiteUpdateNotification()" 
                class="text-gray-400 hover:text-white transition p-1 flex-shrink-0"
                title="Dismiss notification">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
};

// Dismiss site update notification (X button)
window.dismissSiteUpdateNotification = function() {
    markSiteUpdateAsRead();
};

// ==================== DASHBOARD TAB SWITCHING ====================
// Track current dashboard tab
window.currentDashboardTab = 'myProperties';

// Switch between My Properties and Admin Panel tabs
window.switchDashboardTab = function(tabName) {
    const myVehiclesContent = $('myVehiclesTabContent');
    const adminContent = $('adminTabContent');
    const myVehiclesTab = $('dashboardTab-myVehicles');
    const adminTab = $('dashboardTab-admin');
    
    if (!myVehiclesContent || !adminContent) return;
    
    // Update current tab
    window.currentDashboardTab = tabName;
    
    // Save preference to Firestore via UserPreferencesService
    if (window.UserPreferencesService) {
        UserPreferencesService.setDashboardTab(tabName);
    }
    
    if (tabName === 'myVehicles') {
        // Show My Vehicles, hide Admin
        myVehiclesContent.classList.remove('hidden');
        adminContent.classList.add('hidden');
        
        // Update tab styles
        if (myVehiclesTab) {
            myVehiclesTab.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
            myVehiclesTab.classList.add('bg-gradient-to-r', 'from-amber-600', 'to-yellow-600', 'text-black');
        }
        if (adminTab) {
            adminTab.classList.remove('bg-gradient-to-r', 'from-red-600', 'to-orange-600', 'text-white');
            adminTab.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
        }
    } else if (tabName === 'admin') {
        // Show Admin, hide My Vehicles
        myVehiclesContent.classList.add('hidden');
        adminContent.classList.remove('hidden');
        
        // Update tab styles
        if (adminTab) {
            adminTab.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
            adminTab.classList.add('bg-gradient-to-r', 'from-red-600', 'to-orange-600', 'text-white');
        }
        if (myVehiclesTab) {
            myVehiclesTab.classList.remove('bg-gradient-to-r', 'from-amber-600', 'to-yellow-600', 'text-black');
            myVehiclesTab.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
        }
    }
};

// Initialize dashboard tabs (call when dashboard loads)
window.initDashboardTabs = function() {
    const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    const dashboardTabs = $('dashboardTabs');
    const adminTabContent = $('adminTabContent');
    const myVehiclesTabContent = $('myVehiclesTabContent');
    
    if (isAdmin && dashboardTabs) {
        // Show tabs for admin
        dashboardTabs.classList.remove('hidden');
        
        // Restore last used tab from Firestore via UserPreferencesService, default to myVehicles
        let savedTab = window.UserPreferencesService 
            ? UserPreferencesService.getDashboardTab() 
            : 'myVehicles';
        // Convert old myProperties to myVehicles
        if (savedTab === 'myProperties') savedTab = 'myVehicles';
        switchDashboardTab(savedTab);
        
        // Show admin content container (the inner adminSection visibility is handled separately)
        if (adminTabContent) {
            // Don't show yet - switchDashboardTab handles visibility
        }
    } else {
        // Not admin - hide tabs and admin content
        if (dashboardTabs) dashboardTabs.classList.add('hidden');
        if (adminTabContent) adminTabContent.classList.add('hidden');
        if (myVehiclesTabContent) myVehiclesTabContent.classList.remove('hidden');
    }
};

// Update admin tab badge count (for notifications)
window.updateAdminTabBadge = function(count) {
    const badge = $('adminTabBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
};

// ==================== TOAST NOTIFICATIONS ====================
window.showToast = function(message, type = 'info') {
    const bgColors = {
        success: 'from-green-600 to-emerald-600',
        error: 'from-red-600 to-pink-600',
        info: 'from-blue-600 to-cyan-600',
        warning: 'from-yellow-600 to-orange-600'
    };
    
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        warning: '⚠'
    };
    
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 bg-gradient-to-r ${bgColors[type] || bgColors.info} text-white px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 animate-pulse`;
    toast.innerHTML = `<span class="text-lg">${icons[type] || icons.info}</span> ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ==================== PRICING TIERS RENDERER ====================
// Renders all pricing options with discount badges for property cards
window.renderPricingTiers = function(p, isPremium) {
    const dailyPrice = PropertyDataService.getValue(p.id, 'dailyPrice', p.dailyPrice || 0);
    const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice || 0);
    const biweeklyPrice = PropertyDataService.getValue(p.id, 'biweeklyPrice', p.biweeklyPrice || 0);
    const monthlyPrice = PropertyDataService.getValue(p.id, 'monthlyPrice', p.monthlyPrice || 0);
    const buyPrice = PropertyDataService.getValue(p.id, 'buyPrice', p.buyPrice || 0);
    
    // Calculate discounts based on daily rate (or weekly/7 if no daily)
    const baseDaily = dailyPrice > 0 ? dailyPrice : Math.round(weeklyPrice / 7);
    
    const calcDiscount = (actualPrice, equivalentDays) => {
        if (baseDaily <= 0 || actualPrice <= 0) return 0;
        const fullPrice = baseDaily * equivalentDays;
        const discount = Math.round(((fullPrice - actualPrice) / fullPrice) * 100);
        return discount > 0 ? discount : 0;
    };
    
    const weeklyDiscount = calcDiscount(weeklyPrice, 7);
    const biweeklyDiscount = calcDiscount(biweeklyPrice, 14);
    const monthlyDiscount = calcDiscount(monthlyPrice, 30);
    
    let html = '<div class="space-y-1.5 mb-3">';
    
    // Daily
    if (dailyPrice > 0) {
        html += '<div class="flex items-center justify-between text-xs">';
        html += '<span class="text-gray-400">Daily:</span>';
        html += '<span class="text-cyan-400 font-bold">$' + dailyPrice.toLocaleString() + '</span>';
        html += '</div>';
    }
    
    // Weekly
    if (weeklyPrice > 0) {
        html += '<div class="flex items-center justify-between text-xs">';
        html += '<span class="text-gray-400">Weekly:</span>';
        html += '<div class="flex items-center gap-1.5">';
        if (weeklyDiscount > 0) {
            html += '<span class="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-bold">-' + weeklyDiscount + '%</span>';
        }
        html += '<span class="text-blue-400 font-bold">$' + weeklyPrice.toLocaleString() + '</span>';
        html += '</div></div>';
    }
    
    // Biweekly
    if (biweeklyPrice > 0) {
        html += '<div class="flex items-center justify-between text-xs">';
        html += '<span class="text-gray-400">Biweekly:</span>';
        html += '<div class="flex items-center gap-1.5">';
        if (biweeklyDiscount > 0) {
            html += '<span class="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded font-bold">-' + biweeklyDiscount + '%</span>';
        }
        html += '<span class="text-purple-400 font-bold">$' + biweeklyPrice.toLocaleString() + '</span>';
        html += '</div></div>';
    }
    
    // Monthly (featured - larger)
    if (monthlyPrice > 0) {
        html += '<div class="flex items-center justify-between">';
        html += '<span class="text-gray-400 text-xs">Monthly:</span>';
        html += '<div class="flex items-center gap-1.5">';
        if (monthlyDiscount > 0) {
            html += '<span class="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded font-bold">-' + monthlyDiscount + '%</span>';
        }
        const monthlyColor = isPremium ? 'text-amber-400' : 'text-green-400';
        html += '<span class="' + monthlyColor + ' font-black text-lg">$' + monthlyPrice.toLocaleString() + '</span>';
        html += '</div></div>';
    } else if (weeklyPrice > 0) {
        // Estimate monthly if not set
        const estimatedMonthly = Math.round(weeklyPrice * 3.5);
        html += '<div class="flex items-center justify-between">';
        html += '<span class="text-gray-400 text-xs">Monthly:</span>';
        const monthlyColor = isPremium ? 'text-amber-400' : 'text-green-400';
        html += '<span class="' + monthlyColor + ' font-black text-lg">~$' + estimatedMonthly.toLocaleString() + '</span>';
        html += '</div>';
    }
    
    // Buy Price
    if (buyPrice > 0) {
        html += '<div class="flex items-center justify-between border-t border-gray-700 pt-1.5 mt-1.5">';
        html += '<span class="text-amber-400 text-xs font-semibold" title="$25k one-time city sales fee">🚗 Price:</span>';
        html += '<div class="text-right"><span class="text-amber-400 font-black text-lg">$' + buyPrice.toLocaleString() + '</span><span class="text-amber-400/60 text-[9px] block">+$25k city fee</span></div>';
        html += '</div>';
    }
    
    html += '</div>';
    return html;
};

// ==================== PRICE WARNING SYSTEM ====================
// Check if biweekly/monthly prices are suspiciously low
window.checkPriceWarning = function(weeklyEl, biweeklyEl, monthlyEl, warningEl) {
    // Handle both element IDs and elements directly
    // If called without arguments (from create listing form oninput), use default form IDs
    const weekly = weeklyEl ? (typeof weeklyEl === 'string' ? $(weeklyEl) : weeklyEl) : $('newListingWeekly');
    const biweekly = biweeklyEl ? (typeof biweeklyEl === 'string' ? $(biweeklyEl) : biweeklyEl) : $('newListingBiweekly');
    const monthly = monthlyEl ? (typeof monthlyEl === 'string' ? $(monthlyEl) : monthlyEl) : $('newListingMonthly');
    const warning = warningEl ? (typeof warningEl === 'string' ? $(warningEl) : warningEl) : $('priceWarning');
    
    if (!weekly || !warning) return;
    
    const weeklyVal = parseInt(weekly.value) || 0;
    const biweeklyVal = parseInt(biweekly?.value) || 0;
    const monthlyVal = parseInt(monthly?.value) || 0;
    
    let hasIssue = false;
    let suggestions = [];
    
    // Check if there are pricing issues
    if (biweeklyVal > 0 && biweeklyVal < weeklyVal) {
        hasIssue = true;
    }
    if (monthlyVal > 0 && (monthlyVal < weeklyVal || (biweeklyVal > 0 && monthlyVal < biweeklyVal))) {
        hasIssue = true;
    }
    
    // Generate suggested prices (longer terms = slight discount)
    if (hasIssue && weeklyVal > 0) {
        const suggestedBiweekly = Math.round(weeklyVal * 1.8 / 1000) * 1000; // ~10% discount vs 2x weekly
        const suggestedMonthly = Math.round(weeklyVal * 3.5 / 1000) * 1000;  // ~12% discount vs 4x weekly
        suggestions.push(`Weekly: $${weeklyVal.toLocaleString()}`);
        if (biweeklyVal > 0) suggestions.push(`Biweekly: $${suggestedBiweekly.toLocaleString()}`);
        if (monthlyVal > 0) suggestions.push(`Monthly: $${suggestedMonthly.toLocaleString()}`);
    }
    
    const warningText = $('priceWarningText') || warning.querySelector('p:last-child');
    
    if (hasIssue) {
        if (warningText) {
            warningText.textContent = 'Longer terms should cost more. Try: ' + suggestions.join(', ');
        }
        showElement(warning);
    } else {
        hideElement(warning);
    }
    
    return !hasIssue;
};

// Generic price warning check for any set of inputs (used in stats page edits)
window.validatePriceLogic = function(weekly, biweekly, monthly) {
    const warnings = [];
    
    if (biweekly > 0 && biweekly < weekly) {
        warnings.push(`Biweekly ($${biweekly.toLocaleString()}) < Weekly ($${weekly.toLocaleString()})`);
    }
    
    if (monthly > 0) {
        if (monthly < weekly) {
            warnings.push(`Monthly ($${monthly.toLocaleString()}) < Weekly ($${weekly.toLocaleString()})`);
        }
        if (biweekly > 0 && monthly < biweekly) {
            warnings.push(`Monthly ($${monthly.toLocaleString()}) < Biweekly ($${biweekly.toLocaleString()})`);
        }
    }
    
    return warnings;
};

// ==================== BUY PRICE VALIDATION ====================
// Validates buy price against city minimums based on property type and storage

/**
 * Get minimum buy price based on property type and storage (for create listing form)
 * Uses the same logic as getMinimumBuyPrice in app.js
 */
window.getMinimumBuyPriceForForm = function() {
    const type = ($('newListingType')?.value || '').toLowerCase();
    const interiorType = ($('newListingInterior')?.value || '').toLowerCase();
    const storage = parseInt($('newListingStorage')?.value) || 0;
    const title = ($('newListingTitle')?.value || '').toLowerCase();
    
    // Check for walk-in house first (highest tier) - $1.5M
    if (interiorType.includes('walk') || title.includes('walk in') || title.includes('walk-in') || title.includes('walkin')) {
        return { min: 1500000, category: 'Walk-In House', storage: storage ? storage + ' storage' : 'N/A' };
    }
    
    // Check for hotel
    if (type === 'hotel' || title.includes('hotel')) {
        if (storage >= 1050) return { min: 900000, category: 'Hotel 1050+ Storage', storage: storage + ' storage' };
        if (storage >= 800) return { min: 750000, category: 'Hotel 800+ Storage', storage: storage + ' storage' };
        return { min: 750000, category: 'Hotel', storage: storage ? storage + ' storage' : 'Unknown' };
    }
    
    // Check for apartment
    if (type === 'apartment' || title.includes('apartment') || title.includes('apt')) {
        return { min: 700000, category: 'Apartment', storage: storage ? storage + ' storage' : '600 storage' };
    }
    
    // Check for instance house (or default house type)
    if (interiorType === 'instance' || type === 'house' || title.includes('instance') || title.includes('house')) {
        if (storage >= 1000) return { min: 1200000, category: 'Instance House 1000+', storage: storage + ' storage' };
        if (storage >= 800) return { min: 800000, category: 'Instance House 800-900', storage: storage + ' storage' };
        return { min: 1200000, category: 'Instance House 1000+', storage: storage ? storage + ' storage' : 'Unknown' };
    }
    
    // Default to walk-in tier (safest)
    return { min: 1500000, category: 'Walk-In House (Default)', storage: storage ? storage + ' storage' : 'N/A' };
};

/**
 * Validate buy price against city minimum - called on input change
 * Updates hint text and shows warning if price is below minimum
 */
window.validateBuyPrice = function() {
    const buyPriceInput = $('newListingBuyPrice');
    const warningDiv = $('buyPriceWarning');
    const warningText = $('buyPriceWarningText');
    const hintDiv = $('buyPriceHint');
    
    if (!buyPriceInput) return true;
    
    const buyPrice = parseInt(buyPriceInput.value) || 0;
    
    // If no buy price entered, just show hint and return valid
    if (buyPrice === 0) {
        if (hintDiv) {
            const minInfo = getMinimumBuyPriceForForm();
            hintDiv.innerHTML = `Enter a price if for sale. <span class="text-amber-400">City min for ${minInfo.category}: $${minInfo.min.toLocaleString()}</span>`;
        }
        if (warningDiv) hideElement(warningDiv);
        buyPriceInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500');
        return true;
    }
    
    // Get minimum price based on form values
    const minInfo = getMinimumBuyPriceForForm();
    
    // Update hint with detected category
    if (hintDiv) {
        hintDiv.innerHTML = `Detected: <span class="text-cyan-400">${minInfo.category}</span> (${minInfo.storage}) → <span class="text-amber-400">City min: $${minInfo.min.toLocaleString()}</span>`;
    }
    
    // Check if below minimum
    if (buyPrice < minInfo.min) {
        if (warningText) {
            warningText.innerHTML = `
                <strong>${minInfo.category}</strong> requires minimum <strong>$${minInfo.min.toLocaleString()}</strong>.<br>
                Your price: <span class="text-red-400">$${buyPrice.toLocaleString()}</span> 
                (Short by <span class="text-red-400">$${(minInfo.min - buyPrice).toLocaleString()}</span>)
            `;
        }
        if (warningDiv) showElement(warningDiv);
        buyPriceInput.classList.add('border-red-500', 'ring-2', 'ring-red-500');
        return false;
    }
    
    // Valid price
    if (warningDiv) hideElement(warningDiv);
    buyPriceInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500');
    buyPriceInput.classList.add('border-green-500');
    setTimeout(() => buyPriceInput.classList.remove('border-green-500'), 1000);
    return true;
};

// Show price warning modal (for stats page edits)
window.showPriceWarningModal = function(warnings, onConfirm, onCancel) {
    const modalHTML = `
        <div id="priceWarningModal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-orange-500">
                <div class="text-center mb-4">
                    <span class="text-5xl">⚠️</span>
                    <h3 class="text-xl font-bold text-orange-400 mt-2">Unusual Pricing Detected</h3>
                </div>
                
                <div class="bg-orange-900/30 border border-orange-600/50 rounded-xl p-4 mb-4">
                    <p class="text-orange-200 text-sm mb-2">The following pricing seems unusual:</p>
                    <ul class="text-orange-300 text-sm space-y-1">
                        ${warnings.map(w => `<li>• ${w}</li>`).join('')}
                    </ul>
                    <p class="text-orange-200/70 text-xs mt-3">Usually, longer financing terms (biweekly, monthly) cost more, not less.</p>
                </div>
                
                <div class="flex gap-3">
                    <button onclick="closePriceWarningModal(true)" 
                            class="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition">
                        Save Anyway
                    </button>
                    <button onclick="closePriceWarningModal(false)" 
                            class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Store callbacks
    window._priceWarningConfirm = onConfirm;
    window._priceWarningCancel = onCancel;
    
    // Remove existing modal if any
    const existing = $('priceWarningModal');
    if (existing) existing.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closePriceWarningModal = function(confirmed) {
    const modal = $('priceWarningModal');
    if (modal) modal.remove();
    
    if (confirmed && window._priceWarningConfirm) {
        window._priceWarningConfirm();
    } else if (!confirmed && window._priceWarningCancel) {
        window._priceWarningCancel();
    }
    
    window._priceWarningConfirm = null;
    window._priceWarningCancel = null;
};

