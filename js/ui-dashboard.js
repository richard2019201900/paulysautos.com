/**
 * ============================================================================
 * UI DASHBOARD - Dashboard rendering and calculations
 * ============================================================================
 * 
 * CONTENTS:
 * - Auth UI functions (login/logout display)
 * - Revenue/rent calculations
 * - Dashboard card rendering
 * - Inline cell editing for property tiles
 * 
 * DEPENDENCIES: TierService, PropertyDataService, OwnershipService
 * ============================================================================
 */

// ==================== AUTH FUNCTIONS ====================
window.showOwnerLoginForm = function() {
    hideElement($('loginOptions'));
    showElement($('ownerLoginForm'));
    hideElement($('loginError'));
    
    // Clear form fields to prevent cached data
    const emailField = $('ownerEmail');
    const passwordField = $('ownerPassword');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
};

window.hideOwnerLoginForm = function() {
    showElement($('loginOptions'));
    hideElement($('ownerLoginForm'));
    
    // Clear form fields
    const emailField = $('ownerEmail');
    const passwordField = $('ownerPassword');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
};

window.loginAsRenter = function() {
    state.currentUser = 'renter';
    closeModal('loginModal');
    window.goHome();
};

window.logout = function() {
    state.currentUser = null;
    updateAuthButton(false);
    // Clear username field and status
    $('ownerUsername').value = '';
    hideElement($('usernameStatus'));
    // Reset account creation flag
    window.isCreatingAccount = false;
    // Clean up notification listener
    if (window.userNotificationUnsubscribe) {
        window.userNotificationUnsubscribe();
        window.userNotificationUnsubscribe = null;
    }
    // Clean up upgrade request listener
    if (window.upgradeRequestUnsubscribe) {
        window.upgradeRequestUnsubscribe();
        window.upgradeRequestUnsubscribe = null;
    }
    // Clean up admin polling interval
    if (window.adminPollInterval) {
        clearInterval(window.adminPollInterval);
        window.adminPollInterval = null;
    }
    // Clean up user tier listener
    if (window.userTierUnsubscribe) {
        window.userTierUnsubscribe();
        window.userTierUnsubscribe = null;
    }
    // Hide global alert
    dismissGlobalAlert();
    // Reset all admin alert state
    window.lastKnownRequestCount = -1;
    window.adminPendingRequests = [];
    window.adminAlertShownForRequests = new Set();
    
    auth.signOut().then(() => window.goHome()).catch(() => window.goHome());
};

// Force logout - used when user is deleted by admin
window.forceLogout = function() {
    // Clean up all listeners first (prevent further callbacks)
    if (window.userNotificationUnsubscribe) {
        window.userNotificationUnsubscribe();
        window.userNotificationUnsubscribe = null;
    }
    if (window.upgradeRequestUnsubscribe) {
        window.upgradeRequestUnsubscribe();
        window.upgradeRequestUnsubscribe = null;
    }
    if (window.adminPollInterval) {
        clearInterval(window.adminPollInterval);
        window.adminPollInterval = null;
    }
    if (window.userTierUnsubscribe) {
        window.userTierUnsubscribe();
        window.userTierUnsubscribe = null;
    }
    
    // Reset state
    state.currentUser = null;
    state.userTier = null;
    window.lastKnownRequestCount = -1;
    window.adminPendingRequests = [];
    window.adminAlertShownForRequests = new Set();
    
    // Update UI
    updateAuthButton(false);
    dismissGlobalAlert();
    
    // Sign out and go to home page as guest
    auth.signOut().then(() => {
        // Show a temporary toast message instead of blocking alert
        showDeletedAccountToast();
        goHome();
    }).catch(() => {
        showDeletedAccountToast();
        goHome();
    });
};

// Show toast message when account is deleted
window.showDeletedAccountToast = function() {
    // Remove any existing deleted account toast first
    const existingToast = document.getElementById('deletedAccountToast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Don't show if we're in the middle of creating an account
    if (window.isCreatingAccount) {
        return;
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'deletedAccountToast';
    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3';
    toast.innerHTML = `
        <span class="text-2xl">👋</span>
        <div>
            <div class="font-bold">Account Removed</div>
            <div class="text-sm opacity-90">Your account has been deleted by an administrator.</div>
        </div>
    `;
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
};

// ==================== CALCULATIONS ====================
function getAvailableCount() {
    // Use owned vehicles for counts
    const ownedVehicles = getOwnedProperties();
    return ownedVehicles.filter(v => state.availability[v.id] !== false && !v.isSold).length;
}

/**
 * Calculate dashboard totals for vehicle sales marketplace
 * Shows: Total Sales Revenue, Active Listings, Pending Contracts, Sold Vehicles, Portfolio Value, Premium Listings
 */
async function calculateTotalsAsync() {
    const ownedVehicles = getOwnedProperties();
    
    // Initialize data structure for vehicle sales
    const data = {
        // Vehicle counts
        totalListings: ownedVehicles.length,
        activeListings: [],      // Available for sale
        pendingContracts: [],    // Sale in progress
        soldVehicles: [],        // Completed sales
        premiumListings: [],     // Featured/premium
        
        // Financial totals
        totalSalesRevenue: 0,    // From completed sales
        portfolioValue: 0,       // Total value of active listings
        pendingContractsValue: 0, // Value of pending sales
        
        // For backwards compatibility with existing tile system
        activeRenters: { daily: [], weekly: [], biweekly: [], monthly: [] },
        incomeByFrequency: { daily: 0, weekly: 0, biweekly: 0, monthly: 0 },
        rented: [],
        available: [],
        premium: [],
        rtoTotal: 0,
        rtoContracts: [],
        houseSalesTotal: 0,
        houseSales: []
    };
    
    // Process each owned vehicle
    ownedVehicles.forEach(v => {
        const isSold = PropertyDataService.getValue(v.id, 'isSold', v.isSold || false);
        const isPremium = PropertyDataService.getValue(v.id, 'isPremium', v.isPremium || false);
        const isPremiumTrial = PropertyDataService.getValue(v.id, 'isPremiumTrial', v.isPremiumTrial || false);
        const salePrice = PropertyDataService.getValue(v.id, 'price', v.price || 0);
        const pendingSale = PropertyDataService.getValue(v.id, 'pendingSale', v.pendingSale || false);
        
        const vehicleInfo = {
            id: v.id,
            title: v.title || v.make || 'Unknown Vehicle',
            price: salePrice,
            isPremium: isPremium || isPremiumTrial,
            isSold: isSold,
            pendingSale: pendingSale
        };
        
        if (isSold) {
            // Completed sale
            data.soldVehicles.push(vehicleInfo);
            data.totalSalesRevenue += salePrice;
            // Also add to houseSales for backwards compatibility
            data.houseSales.push({
                id: v.id,
                propertyTitle: vehicleInfo.title,
                salePrice: salePrice,
                saleDate: PropertyDataService.getValue(v.id, 'soldDate', ''),
                buyerName: PropertyDataService.getValue(v.id, 'buyerName', 'Unknown')
            });
            data.houseSalesTotal += salePrice;
        } else if (pendingSale) {
            // Pending contract
            data.pendingContracts.push(vehicleInfo);
            data.pendingContractsValue += salePrice;
        } else {
            // Active listing
            data.activeListings.push(vehicleInfo);
            data.portfolioValue += salePrice;
            data.available.push(vehicleInfo);
        }
        
        // Track premium listings
        if (isPremium || isPremiumTrial) {
            data.premiumListings.push(vehicleInfo);
            data.premium.push(vehicleInfo);
        }
    });
    
    // Fetch additional sales from vehicleSales collection (if exists)
    try {
        const currentUserEmail = auth.currentUser?.email;
        if (currentUserEmail) {
            const salesSnapshot = await db.collection('vehicleSales')
                .where('sellerEmail', '==', currentUserEmail)
                .get();
            salesSnapshot.forEach(doc => {
                const sale = doc.data();
                // Only add if not already counted from vehicle isSold flag
                if (!data.soldVehicles.find(v => v.id === sale.vehicleId)) {
                    data.totalSalesRevenue += (sale.salePrice || 0);
                    data.soldVehicles.push({
                        id: doc.id,
                        title: sale.vehicleTitle || 'Vehicle',
                        price: sale.salePrice || 0,
                        isSold: true
                    });
                    data.houseSales.push({
                        id: doc.id,
                        propertyTitle: sale.vehicleTitle || 'Vehicle',
                        salePrice: sale.salePrice || 0,
                        saleDate: sale.saleDate || '',
                        buyerName: sale.buyerName || 'Unknown'
                    });
                    data.houseSalesTotal += (sale.salePrice || 0);
                }
            });
        }
    } catch (e) {
        console.warn('[Dashboard] Could not fetch vehicle sales:', e);
    }
    
    // Store globally
    window.dashboardData = data;
    
    return {
        ownedCount: ownedVehicles.length,
        data
    };
}

// Synchronous version for backward compatibility (uses cached data or basic calculation)
function calculateTotals() {
    const ownedVehicles = getOwnedProperties();
    
    // Data structure for vehicle sales
    const data = {
        activeRenters: { daily: [], weekly: [], biweekly: [], monthly: [] },
        incomeByFrequency: { daily: 0, weekly: 0, biweekly: 0, monthly: 0 },
        rented: [],
        available: [],
        premium: [],
        rtoTotal: 0,
        rtoContracts: [],
        houseSalesTotal: 0,
        houseSales: [],
        // Vehicle sales specific
        totalSalesRevenue: 0,
        portfolioValue: 0,
        activeListings: [],
        soldVehicles: [],
        premiumListings: []
    };
    
    ownedVehicles.forEach(v => {
        const isPremium = PropertyDataService.getValue(v.id, 'isPremium', v.isPremium || false);
        const isSold = PropertyDataService.getValue(v.id, 'isSold', v.isSold || false);
        const price = PropertyDataService.getValue(v.id, 'price', v.price || 0);
        
        const vehicleInfo = {
            id: v.id,
            title: v.title || v.make || 'Unknown Vehicle',
            price: price,
            isPremium: isPremium,
            isSold: isSold
        };
        
        if (isPremium) {
            data.premium.push(vehicleInfo);
            data.premiumListings.push(vehicleInfo);
        }
        
        if (isSold) {
            data.soldVehicles.push(vehicleInfo);
            data.houseSalesTotal += price;
            data.totalSalesRevenue += price;
        } else {
            data.available.push(vehicleInfo);
            data.activeListings.push(vehicleInfo);
            data.portfolioValue += price;
        }
    });
    
    // Store globally
    window.dashboardData = data;
    
    return {
        ownedCount: ownedVehicles.length,
        data
    };
}

// Flip card toggle
window.flipCard = function(card) {
    card.classList.toggle('flipped');
};

// Update all dashboard tiles with vehicle sales data
function updateDashboardTiles(totals) {
    // Defensive check - totals might be undefined or not in expected format
    if (!totals) {
        console.warn('[Dashboard] updateDashboardTiles called with no data');
        return;
    }
    
    const ownedCount = totals.ownedCount || 0;
    const data = totals.data || totals || {};
    
    // For backwards compatibility, map new data to old element IDs
    const totalSales = data.totalSalesRevenue || data.houseSalesTotal || 0;
    const activeCount = data.activeListings?.length || data.available?.length || 0;
    const pendingCount = data.pendingContracts?.length || 0;
    const soldCount = data.soldVehicles?.length || data.houseSales?.length || 0;
    const portfolioValue = data.portfolioValue || 0;
    const premiumCount = data.premiumListings?.length || data.premium?.length || 0;
    
    // === ROW 1: Vehicle Sales Stats ===
    
    // Total Sales (using dailyIncomeDisplay for backwards compat)
    const totalSalesEl = $('dailyIncomeDisplay');
    const totalSalesCountEl = $('dailyIncomeCount');
    if (totalSalesEl) totalSalesEl.textContent = formatPrice(totalSales);
    if (totalSalesCountEl) totalSalesCountEl.textContent = soldCount > 0 
        ? `${soldCount} sale${soldCount > 1 ? 's' : ''} completed` 
        : 'No sales yet';
    
    // Active Listings (using weeklyIncomeDisplay)
    const activeEl = $('weeklyIncomeDisplay');
    const activeCountEl = $('weeklyIncomeCount');
    if (activeEl) activeEl.textContent = activeCount.toString();
    if (activeCountEl) activeCountEl.textContent = activeCount > 0 
        ? `Vehicles for sale` 
        : 'No active listings';
    
    // Pending Contracts (using biweeklyIncomeDisplay)
    const pendingEl = $('biweeklyIncomeDisplay');
    const pendingCountEl = $('biweeklyIncomeCount');
    if (pendingEl) pendingEl.textContent = pendingCount.toString();
    if (pendingCountEl) pendingCountEl.textContent = pendingCount > 0 
        ? `Awaiting completion` 
        : 'No pending contracts';
    
    // Sold Vehicles (using monthlyIncomeDisplay)
    const soldEl = $('monthlyIncomeDisplay');
    const soldCountEl = $('monthlyIncomeCount');
    if (soldEl) soldEl.textContent = soldCount.toString();
    if (soldCountEl) soldCountEl.textContent = soldCount > 0 
        ? `Completed sales` 
        : 'No sales yet';
    
    // === ROW 2: Portfolio Stats ===
    
    // Portfolio Value (using totalRentalIncomeDisplay)
    const portfolioEl = $('totalRentalIncomeDisplay');
    const portfolioCountEl = $('totalRentalIncomeCount');
    if (portfolioEl) portfolioEl.textContent = formatPrice(portfolioValue);
    if (portfolioCountEl) portfolioCountEl.textContent = `Total listing value`;
    
    // All Vehicles count
    const totalListingsEl = $('totalListingsDisplay');
    const totalSubtitleEl = $('propertiesSubtitle');
    if (totalListingsEl) totalListingsEl.textContent = ownedCount.toString();
    if (totalSubtitleEl) totalSubtitleEl.textContent = `${activeCount} active • ${soldCount} sold`;
    
    // Premium Listings (using rtoIncomeDisplay)
    const premiumEl = $('rtoIncomeDisplay');
    const premiumCountEl = $('rtoIncomeCount');
    if (premiumEl) premiumEl.textContent = premiumCount.toString();
    if (premiumCountEl) premiumCountEl.textContent = premiumCount > 0 
        ? `Featured listings` 
        : 'No premium listings';
    
    // Sales Revenue (using houseSalesDisplay)
    const salesRevEl = $('houseSalesDisplay');
    const salesRevCountEl = $('houseSalesCount');
    if (salesRevEl) salesRevEl.textContent = formatPrice(totalSales);
    if (salesRevCountEl) salesRevCountEl.textContent = soldCount > 0 
        ? `From ${soldCount} completed sale${soldCount > 1 ? 's' : ''}` 
        : 'No sales yet';
}

// Render vehicle sales breakdown for tile flip (backwards compat with old function name)
function renderActiveRentersBreakdown(vehicles, type) {
    if (!vehicles || vehicles.length === 0) {
        return `<div class="opacity-70 italic">No vehicles</div>`;
    }
    
    return vehicles.map(v => `
        <div class="flex justify-between items-center py-1 border-b border-white/10">
            <div class="truncate pr-2">
                <div class="font-medium truncate">🚗 ${sanitize(v.title || 'Vehicle')}</div>
            </div>
            <div class="text-right font-bold whitespace-nowrap">${formatPrice(v.price || 0)}</div>
        </div>
    `).join('');
}

// Render total income/portfolio breakdown for tile flip
function renderTotalIncomeBreakdown(income, renters, data) {
    const items = [];
    
    if (data.activeListings?.length > 0) {
        items.push(`<div class="flex justify-between"><span>Active Listings</span><span>${data.activeListings.length}</span></div>`);
    }
    if (data.soldVehicles?.length > 0) {
        items.push(`<div class="flex justify-between"><span>Sold Vehicles</span><span>${data.soldVehicles.length}</span></div>`);
    }
    if (data.portfolioValue > 0) {
        items.push(`<div class="flex justify-between"><span>Portfolio Value</span><span>${formatPrice(data.portfolioValue)}</span></div>`);
    }
    if (data.totalSalesRevenue > 0) {
        items.push(`<div class="flex justify-between"><span>Sales Revenue</span><span>${formatPrice(data.totalSalesRevenue)}</span></div>`);
    }
    
    return items.length > 0 ? items.join('') : '<div class="opacity-70 italic">No data yet</div>';
}

// Render all vehicles list for tile flip
function renderAllPropertiesListNew(vehicles) {
    if (!vehicles || vehicles.length === 0) {
        return `<div class="opacity-70 italic">No vehicles</div>`;
    }
    
    return vehicles.slice(0, 10).map(v => `
        <div class="flex justify-between items-center py-1 border-b border-white/10">
            <div class="truncate pr-2">
                <div class="font-medium truncate">🚗 ${sanitize(v.title || 'Vehicle')}</div>
                <div class="opacity-70 text-[10px]">${v.isSold ? '✅ Sold' : '🟢 Available'}</div>
            </div>
            <div class="text-right font-bold whitespace-nowrap">${formatPrice(v.price || 0)}</div>
        </div>
    `).join('') + (vehicles.length > 10 ? `<div class="text-center opacity-70 text-xs mt-2">+${vehicles.length - 10} more</div>` : '');
}

// Render RTO breakdown - stub for backwards compat (not used in vehicle sales)
function renderRTOBreakdown(contracts) {
    return `<div class="opacity-70 italic">Premium listings info</div>`;
}

// Render vehicle sales breakdown for tile flip
function renderHouseSalesBreakdown(sales) {
    if (!sales || sales.length === 0) {
        return `<div class="opacity-70 italic">No completed sales</div>`;
    }
    
    return sales.slice(0, 5).map(s => `
        <div class="flex justify-between items-center py-1 border-b border-white/10">
            <div class="truncate pr-2">
                <div class="font-medium truncate">🚗 ${sanitize(s.propertyTitle || s.title || 'Vehicle')}</div>
                <div class="opacity-70 text-[10px]">${s.buyerName ? `Buyer: ${sanitize(s.buyerName)}` : ''}</div>
            </div>
            <div class="text-right font-bold whitespace-nowrap">${formatPrice(s.salePrice || s.price || 0)}</div>
        </div>
    `).join('') + (sales.length > 5 ? `<div class="text-center opacity-70 text-xs mt-2">+${sales.length - 5} more</div>` : '');
}

// Render frequency breakdown - stub for backwards compatibility
function renderFrequencyBreakdown(vehicles, divisor, suffix) {
    if (!vehicles || vehicles.length === 0) {
        return '<div class="opacity-70 italic">No vehicles</div>';
    }
    
    return vehicles.map((v, i) => `
        <div class="flex justify-between py-1 border-b border-white/10 last:border-0">
            <span class="truncate mr-2">${i + 1}. ${v.title || 'Vehicle'}</span>
            <span class="font-bold whitespace-nowrap">${formatPrice(v.price || 0)}</span>
        </div>
    `).join('');
}

// ==================== RENDER FUNCTIONS ====================
function renderOwnerDashboard() {
    // loadUserNotifications() - removed, not needed for vehicle sales marketplace
    
    // Initialize NotificationManager (handles alerts, badges, etc.)
    if (typeof NotificationManager !== 'undefined' && auth?.currentUser) {
        NotificationManager.init();
    }
    
    // Initialize dashboard tabs
    if (typeof initDashboardTabs === 'function') {
        initDashboardTabs();
    }
    
    // Render site update notification if there's a new one
    const siteUpdateContainer = $('siteUpdateNotificationContainer');
    if (siteUpdateContainer) {
        siteUpdateContainer.innerHTML = renderSiteUpdateNotification();
    }
    updateSiteUpdateBadge();
    
    // Render gamification XP widget
    if (typeof renderGamificationWidget === 'function' && window.currentUserData) {
        renderGamificationWidget(window.currentUserData);
    }
    
    // Show Elite Reports button if user is Elite tier
    updateEliteReportsButton();
    
    // Vehicles user actually OWNS (dashboard should only show your vehicles)
    const ownedVehicles = getOwnedProperties();
    
    // Calculate and update dashboard tiles
    const basicTotals = calculateTotals();
    updateDashboardTiles(basicTotals);
    
    // Then fetch actual sales data asynchronously for accurate totals
    calculateTotalsAsync().then(asyncTotals => {
        updateDashboardTiles(asyncTotals);
    }).catch(err => {
        console.warn('[Dashboard] Could not load sales data:', err);
    });
    
    // Check for active celebration banners
    checkCelebrationBanners();
    
    if (ownedVehicles.length === 0) {
        const tableEl = $('ownerVehiclesTable');
        if (tableEl) {
            tableEl.innerHTML = `
                <tr>
                    <td colspan="11" class="px-6 py-12 text-center text-gray-400">
                        <div class="text-4xl mb-4">🚗</div>
                        <p class="text-xl font-semibold">No vehicles assigned to this account</p>
                        <p class="text-sm mt-2">Contact the administrator to get vehicles assigned to your account.</p>
                    </td>
                </tr>
            `;
        }
        return;
    }
    
    // Render vehicles table - for vehicle sales, this shows listing info
    const tableEl = $('ownerVehiclesTable');
    if (tableEl) {
        tableEl.innerHTML = ownedVehicles.map((v, index) => {
            const price = PropertyDataService.getValue(v.id, 'price', v.price || 0);
            const isSold = PropertyDataService.getValue(v.id, 'isSold', v.isSold || false);
            const isPremium = PropertyDataService.getValue(v.id, 'isPremium', v.isPremium || false);
            const isAvailable = state.availability[v.id] !== false && !isSold;
            
            // Status display
            let statusBadge = '';
            if (isSold) {
                statusBadge = '<span class="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">SOLD</span>';
            } else if (isPremium) {
                statusBadge = '<span class="bg-amber-500 text-black text-xs px-2 py-0.5 rounded-full">PREMIUM</span>';
            } else if (isAvailable) {
                statusBadge = '<span class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">AVAILABLE</span>';
            } else {
                statusBadge = '<span class="bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full">RESERVED</span>';
            }
            
            return `
                <tr class="border-b border-gray-700 hover:bg-gray-800/50 transition">
                    <td class="px-4 py-3 font-medium">${index + 1}</td>
                    <td class="px-4 py-3">
                        <div class="font-semibold text-white">${sanitize(v.title || 'Vehicle')}</div>
                    </td>
                    <td class="px-4 py-3 text-right font-bold text-green-400">${formatPrice(price)}</td>
                    <td class="px-4 py-3 text-center">${statusBadge}</td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="viewProperty(${v.id})" class="text-blue-400 hover:text-blue-300 text-sm">
                            View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// Helper functions for dashboard
function checkCelebrationBanners() {
    // Check for any active celebration banners to display
    if (typeof GamificationService !== 'undefined' && GamificationService.checkActiveCelebrations) {
        GamificationService.checkActiveCelebrations();
    }
}

function updateEliteReportsButton() {
    // Show reports button for Elite tier users
    const btn = $('eliteReportsBtn');
    if (!btn) return;
    
    const userTier = state.userTier || 'starter';
    if (userTier === 'elite' || TierService.isMasterAdmin(auth.currentUser?.email)) {
        showElement(btn);
    } else {
        hideElement(btn);
    }
}

// Render site update notification
function renderSiteUpdateNotification() {
    // Placeholder for site update notifications
    return '';
}

function updateSiteUpdateBadge() {
    // Placeholder for site update badge
}

// ==================== INLINE CELL EDITING ====================
window.startCellEdit = function(propertyId, field, cell, type) {
    // Don't start if already editing
    if (cell.querySelector('input, select')) return;
    
    // VALIDATION: Block lastPaymentDate if frequency is not set
    if (field === 'lastPaymentDate') {
        const p = properties.find(prop => prop.id === propertyId);
        const frequency = PropertyDataService.getValue(propertyId, 'paymentFrequency', p?.paymentFrequency || '');
        if (!frequency) {
            alert('⚠️ Please set the Payment Frequency first!\n\nThe frequency determines how the next due date is calculated and how payments are logged.\n\nClick on "Frequency" in the row above to set it.');
            return;
        }
    }
    
    const currentValue = PropertyDataService.getValue(propertyId, field, properties.find(p => p.id === propertyId)?.[field]) || '';
    const originalHTML = cell.innerHTML;
    
    cell.dataset.originalHTML = originalHTML;
    cell.dataset.propertyId = propertyId;
    cell.dataset.field = field;
    cell.dataset.type = type;
    
    let inputHTML = '';
    
    if (type === 'select' && field === 'upgraded') {
        inputHTML = `
            <select class="cell-input bg-gray-800 border border-purple-500 rounded px-2 py-1 text-white text-sm w-full" 
                    onchange="saveCellEdit(this, ${propertyId}, '${field}', '${type}')"
                    onblur="setTimeout(() => cancelCellEdit(this), 150)">
                <option value="Yes" ${currentValue === 'Yes' ? 'selected' : ''}>Yes</option>
                <option value="No" ${currentValue === 'No' ? 'selected' : ''}>No</option>
            </select>
        `;
    } else if (type === 'propertyType') {
        inputHTML = `
            <select class="cell-input bg-gray-800 border border-purple-500 rounded px-2 py-1 text-white text-sm w-full" 
                    onchange="saveCellEdit(this, ${propertyId}, '${field}', '${type}')"
                    onblur="setTimeout(() => cancelCellEdit(this), 150)">
                <option value="apartment" ${currentValue === 'apartment' ? 'selected' : ''}>Apartment</option>
                <option value="house" ${currentValue === 'house' ? 'selected' : ''}>House</option>
                <option value="condo" ${currentValue === 'condo' ? 'selected' : ''}>Condo</option>
                <option value="villa" ${currentValue === 'villa' ? 'selected' : ''}>Villa</option>
                <option value="hotel" ${currentValue === 'hotel' ? 'selected' : ''}>Hotel</option>
                <option value="warehouse" ${currentValue === 'warehouse' ? 'selected' : ''}>Warehouse</option>
                <option value="hideout" ${currentValue === 'hideout' ? 'selected' : ''}>Hideout</option>
            </select>
        `;
    } else if (type === 'frequency') {
        inputHTML = `
            <select class="cell-input bg-gray-800 border border-purple-500 rounded px-2 py-1 text-white text-sm" 
                    onchange="saveCellEdit(this, ${propertyId}, '${field}', '${type}')"
                    onblur="setTimeout(() => cancelCellEdit(this), 150)">
                <option value="" ${!currentValue ? 'selected' : ''}>-- Select --</option>
                <option value="daily" ${currentValue === 'daily' ? 'selected' : ''}>Daily</option>
                <option value="weekly" ${currentValue === 'weekly' ? 'selected' : ''}>Weekly</option>
                <option value="biweekly" ${currentValue === 'biweekly' ? 'selected' : ''}>Biweekly</option>
                <option value="monthly" ${currentValue === 'monthly' ? 'selected' : ''}>Monthly</option>
            </select>
        `;
    } else if (type === 'date') {
        inputHTML = `
            <input type="date" 
                   class="cell-input bg-gray-800 border border-purple-500 rounded px-2 py-1 text-white text-sm" 
                   value="${currentValue}"
                   onkeydown="handleCellKeydown(event, this, ${propertyId}, '${field}', '${type}')"
                   onblur="saveCellEdit(this, ${propertyId}, '${field}', '${type}')">
        `;
    } else if (type === 'text') {
        inputHTML = `
            <input type="text" 
                   class="cell-input bg-gray-800 border border-purple-500 rounded px-2 py-1 text-white text-sm w-32" 
                   value="${currentValue}"
                   placeholder="Enter name..."
                   onkeydown="handleCellKeydown(event, this, ${propertyId}, '${field}', '${type}')"
                   onblur="saveCellEdit(this, ${propertyId}, '${field}', '${type}')">
        `;
    } else {
        // number type
        inputHTML = `
            <input type="number" 
                   class="cell-input bg-gray-800 border border-purple-500 rounded px-2 py-1 text-white text-sm w-20" 
                   value="${currentValue}"
                   onkeydown="handleCellKeydown(event, this, ${propertyId}, '${field}', '${type}')"
                   onblur="saveCellEdit(this, ${propertyId}, '${field}', '${type}')">
        `;
    }
    
    cell.innerHTML = inputHTML;
    
    const input = cell.querySelector('input, select');
    input.focus();
    if (input.select) input.select();
};

window.handleCellKeydown = function(event, input, propertyId, field, type) {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveCellEdit(input, propertyId, field, type);
    } else if (event.key === 'Escape') {
        cancelCellEdit(input);
    }
};

window.saveCellEdit = async function(input, propertyId, field, type) {
    const cell = input.closest('td, div');
    let newValue = input.value;
    const originalHTML = cell.dataset.originalHTML;
    
    // Parse value based on type
    if (type === 'number') {
        newValue = parseInt(newValue);
        if (isNaN(newValue)) {
            cell.innerHTML = originalHTML;
            return;
        }
    } else if (type === 'text' || type === 'date' || type === 'frequency' || type === 'select' || type === 'propertyType') {
        // Keep as string, allow empty for text and date fields (so they can be cleared)
        if (!newValue && type !== 'text' && type !== 'date') {
            cell.innerHTML = originalHTML;
            return;
        }
    }
    
    // Show saving state
    cell.innerHTML = `<span class="text-gray-500">Saving...</span>`;
    
    try {
        // For empty date values, save empty string to clear the field
        await PropertyDataService.write(propertyId, field, newValue);
        
        // LOG PAYMENT when lastPaymentDate is updated (same as property detail page)
        if (field === 'lastPaymentDate' && newValue && typeof logPayment === 'function') {
            const p = properties.find(prop => prop.id === propertyId);
            const renterName = PropertyDataService.getValue(propertyId, 'renterName', p?.renterName || 'Unknown');
            const paymentFrequency = PropertyDataService.getValue(propertyId, 'paymentFrequency', p?.paymentFrequency || 'weekly');
            const dailyPrice = PropertyDataService.getValue(propertyId, 'dailyPrice', p?.dailyPrice || 0);
            const weeklyPrice = PropertyDataService.getValue(propertyId, 'weeklyPrice', p?.weeklyPrice || 0);
            const biweeklyPrice = PropertyDataService.getValue(propertyId, 'biweeklyPrice', p?.biweeklyPrice || 0);
            const monthlyPrice = PropertyDataService.getValue(propertyId, 'monthlyPrice', p?.monthlyPrice || 0);
            
            // Calculate payment amount based on frequency
            let paymentAmount = weeklyPrice;
            if (paymentFrequency === 'daily') {
                paymentAmount = dailyPrice > 0 ? dailyPrice : Math.round(weeklyPrice / 7);
            } else if (paymentFrequency === 'biweekly') {
                paymentAmount = biweeklyPrice > 0 ? biweeklyPrice : weeklyPrice * 2;
            } else if (paymentFrequency === 'monthly') {
                paymentAmount = monthlyPrice > 0 ? monthlyPrice : weeklyPrice * 4;
            }
            
            // Log payment to Firestore
            const logSuccess = await logPayment(propertyId, {
                paymentDate: newValue,
                recordedAt: new Date().toISOString(),
                renterName: renterName,
                frequency: paymentFrequency,
                amount: paymentAmount,
                recordedBy: auth.currentUser?.email || 'owner'
            });
            // Calculate next due date for thank you message
            const lastDate = parseLocalDate(newValue);
            const nextDate = new Date(lastDate);
            if (paymentFrequency === 'daily') {
                nextDate.setDate(nextDate.getDate() + 1);
            } else if (paymentFrequency === 'weekly') {
                nextDate.setDate(nextDate.getDate() + 7);
            } else if (paymentFrequency === 'biweekly') {
                nextDate.setDate(nextDate.getDate() + 14);
            } else {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
            const nextDueDateStr = nextDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            
            // Show thank you message popup with copy functionality
            if (logSuccess && typeof showPaymentConfirmationModal === 'function') {
                showPaymentConfirmationModal(renterName, nextDueDateStr, paymentAmount);
            }
        }
        
        // Auto-flip to "rented" when setting renter name, phone, or payment date
        if ((field === 'renterName' || field === 'renterPhone' || field === 'lastPaymentDate') && newValue) {
            if (state.availability[propertyId] !== false) {
                // Property is currently available, flip to rented - this is a NEW rental!
                state.availability[propertyId] = false;
                await saveAvailability(propertyId, false);
                
                // Award XP for new rental (gamification)
                if (typeof GamificationService !== 'undefined' && field === 'renterName') {
                    const user = auth.currentUser;
                    if (user) {
                        // Get current rental count
                        const userData = window.currentUserData || {};
                        const totalRentals = userData.gamification?.stats?.totalRentals || 0;
                        
                        if (totalRentals === 0) {
                            // First rental ever - award 1000 XP and create celebration
                            GamificationService.awardAchievement(user.uid, 'first_rental', 1000, {
                                statUpdate: { totalRentals: 1 }
                            }).then(async (result) => {
                                if (result && !result.alreadyEarned) {
                                    console.log('[Gamification] Awarded 1000 XP for first rental');
                                    // Create celebration
                                    const userName = userData.username || user.email.split('@')[0];
                                    const propTitle = p?.title || 'a property';
                                    await GamificationService.createCelebration({
                                        type: 'rental',
                                        userId: user.uid,
                                        userName: userName,
                                        propertyTitle: propTitle,
                                        icon: '🤝',
                                        message: `just leased ${propTitle}!`
                                    });
                                }
                            }).catch(err => console.error('[Gamification] Error:', err));
                        } else {
                            // Additional rental - award 500 XP and create celebration
                            GamificationService.awardXP(user.uid, 500, 'additional_rental').then(async () => {
                                console.log('[Gamification] Awarded 500 XP for additional rental');
                                // Update stats
                                await db.collection('users').doc(user.uid).update({
                                    'gamification.stats.totalRentals': firebase.firestore.FieldValue.increment(1)
                                }).catch(e => console.warn('[Gamification] Could not update stats:', e));
                                
                                // Create celebration
                                const userName = userData.username || user.email.split('@')[0];
                                const propTitle = p?.title || 'a property';
                                await GamificationService.createCelebration({
                                    type: 'rental',
                                    userId: user.uid,
                                    userName: userName,
                                    propertyTitle: propTitle,
                                    icon: '🤝',
                                    message: `just leased ${propTitle}!`
                                });
                            }).catch(err => console.error('[Gamification] Error:', err));
                        }
                    }
                }
            }
        }
        
        // Update filtered properties to reflect changes
        state.filteredProperties = [...properties];
        
        // Re-render dashboard to show updated values
        renderOwnerDashboard();
        renderProperties(state.filteredProperties);
        
    } catch (error) {
        console.error('Save failed:', error);
        cell.innerHTML = originalHTML;
        alert('Failed to save. Please try again.');
    }
};

window.cancelCellEdit = function(input) {
    if (!input) return;
    const cell = input.closest('td');
    if (cell && cell.dataset.originalHTML) {
        cell.innerHTML = cell.dataset.originalHTML;
    }
};

async function renderProperties(list) {
    // Update vehicle count
    const countEl = $('vehicleCount') || $('propertyCount');
    if (countEl) {
        countEl.textContent = `(${list.length})`;
    }
    
    // Sort premium listings to the top
    const sortedList = [...list].sort((a, b) => {
        const aPremium = PropertyDataService.getValue(a.id, 'isPremium', a.isPremium || false);
        const bPremium = PropertyDataService.getValue(b.id, 'isPremium', b.isPremium || false);
        if (aPremium && !bPremium) return -1;
        if (!aPremium && bPremium) return 1;
        return 0;
    });
    
    // Placeholder for properties with no/broken images
    const imagePlaceholder = `
        <div class="w-full h-64 md:h-72 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex flex-col items-center justify-center">
            <span class="text-6xl mb-3">🚗</span>
            <span class="text-gray-400 font-semibold text-sm">Photos Coming Soon</span>
        </div>
    `;
    
    // Image error handler function name
    const imgErrorHandler = "this.onerror=null; this.parentElement.innerHTML=`<div class='w-full h-64 md:h-72 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex flex-col items-center justify-center'><span class='text-6xl mb-3'>🚗</span><span class='text-gray-400 font-semibold text-sm'>Photos Coming Soon</span></div>`;";
    
    // First render with placeholder owner - include ALL properties, even those without images
    $('vehiclesGrid').innerHTML = sortedList.filter(p => p).map(p => {
        // Ensure property ID is numeric for consistent lookup
        const propId = typeof p.id === 'string' ? parseInt(p.id) : p.id;
        const available = state.availability[propId] !== false;
        const isPremium = PropertyDataService.getValue(propId, 'isPremium', p.isPremium || false);
        const hasImages = p.images && Array.isArray(p.images) && p.images.length > 0 && p.images[0];
        
        // Premium styling
        const cardBorder = isPremium 
            ? 'border-2 border-amber-500 ring-2 ring-amber-500/50 shadow-amber-500/20 shadow-2xl' 
            : 'border border-gray-700';
        const premiumBadge = isPremium 
            ? `<div class="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-gray-900 text-center py-1.5 font-black text-sm tracking-wider flex items-center justify-center gap-2">
                <span>👑</span> PREMIUM LISTING <span>👑</span>
               </div>` 
            : '';
        const premiumGlow = isPremium ? 'premium-glow' : '';
        const imageMargin = isPremium ? 'mt-8' : '';
        
        // Image element - use placeholder if no images, add error handler for broken images
        const imageElement = hasImages 
            ? `<img src="${p.images[0]}" alt="${sanitize(p.title)}" class="w-full h-64 md:h-72 object-cover" loading="lazy" onerror="${imgErrorHandler}">`
            : imagePlaceholder;
        
        return `
        <article class="property-card bg-gray-800 rounded-2xl shadow-xl overflow-hidden cursor-pointer ${cardBorder} ${premiumGlow} relative" onclick="viewProperty(${p.id})">
            ${premiumBadge}
            <div class="relative ${imageMargin}">
                ${!available ? '<div class="unavailable-overlay"><div class="unavailable-text">SOLD</div></div>' : ''}
                ${imageElement}
                ${p.videoUrl ? '<div class="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full font-bold text-xs md:text-sm shadow-lg flex items-center space-x-1 md:space-x-2"><svg class="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg><span>Video Tour</span></div>' : ''}
                ${isPremium ? '<div class="absolute top-4 right-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 px-3 py-1 rounded-full font-bold text-xs shadow-lg">⭐ FEATURED</div>' : ''}
            </div>
            <div class="p-5 md:p-6">
                <div class="flex justify-between items-start gap-2 mb-3">
                    <h4 class="text-xl md:text-2xl font-bold ${isPremium ? 'text-amber-300' : 'text-white'} min-h-[2rem] line-clamp-2">${sanitize(p.title)}</h4>
                    <span class="badge text-white text-xs font-bold px-2 md:px-3 py-1 rounded-full uppercase shrink-0">${PropertyDataService.getValue(p.id, 'type', p.type)}</span>
                </div>
                <p class="text-gray-300 mb-2 font-medium text-sm">🔖 Plate: <span class="text-white">${PropertyDataService.getValue(p.id, 'plate', p.plate) || 'N/A'}</span></p>
                ${p.location ? `<p class="text-gray-400 mb-2 text-xs">📝 ${sanitize(p.location)}</p>` : ''}
                <p id="owner-${p.id}" class="text-xs text-blue-400 mb-3 font-semibold">👤 Owner: Loading...</p>
                
                <!-- Vehicle Specs Grid - Benny's Style -->
                <div class="grid grid-cols-4 gap-2 mb-3 text-xs text-gray-300 font-semibold bg-gray-900/50 rounded-lg p-2">
                    <div class="text-center">
                        <div class="text-amber-400">🔧</div>
                        <div>${PropertyDataService.getValue(p.id, 'upgrades', p.upgrades) || 'N/A'}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-cyan-400">⚡</div>
                        <div>${PropertyDataService.getValue(p.id, 'speed', p.speed) || 'N/A'}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-amber-400">📦</div>
                        <div>${PropertyDataService.getValue(p.id, 'storage', p.storage) || 'N/A'}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-purple-400">💺</div>
                        <div>${PropertyDataService.getValue(p.id, 'seats', p.seats) || 'N/A'}</div>
                    </div>
                </div>
                
                <!-- Price Display -->
                <div class="bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-500/50 rounded-lg p-3 mb-3 text-center">
                    <div class="text-green-400 text-2xl font-black">$${(PropertyDataService.getValue(p.id, 'buyPrice', p.buyPrice) || 0).toLocaleString()}</div>
                    <div class="text-green-400/60 text-xs">+$25k city sales fee</div>
                </div>
                
                <button onclick="viewProperty(${p.id})" class="w-full ${isPremium ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900' : 'gradient-bg text-white'} px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg mb-2 text-sm md:text-base">View Details</button>
                <button onclick="event.stopPropagation(); viewPropertyAndHighlightOffers(${p.id})" class="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg text-sm md:text-base">📞 Contact Seller</button>
            </div>
        </article>`;
    }).join('');
    
    // Then fetch and update owner names with tier icons asynchronously
    for (const p of sortedList) {
        const ownerInfo = await getPropertyOwnerWithTier(p.id);
        const ownerEl = $(`owner-${p.id}`);
        if (ownerEl) {
            // Use different label based on whether property is managed by agent
            if (ownerInfo.isManaged) {
                ownerEl.innerHTML = ownerInfo.display;
            } else {
                ownerEl.innerHTML = `👤 Owner: ${ownerInfo.display}`;
            }
        }
    }
}

