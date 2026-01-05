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
    // Use owned properties for financial counts, not all visible properties
    const ownedProps = getOwnedProperties();
    return ownedProps.filter(p => state.availability[p.id] !== false).length;
}

/**
 * Calculate dashboard totals for active renters grouped by payment frequency
 * Shows current income rates (not historical), plus RTO and House Sales
 */
async function calculateTotalsAsync() {
    const ownedProps = getOwnedProperties();
    
    // Initialize data structure
    const data = {
        // Active renters by frequency (current income rates)
        activeRenters: {
            daily: [],    // { id, title, renterName, price }
            weekly: [],
            biweekly: [],
            monthly: []
        },
        // Income totals by frequency
        incomeByFrequency: {
            daily: 0,
            weekly: 0,
            biweekly: 0,
            monthly: 0
        },
        // Property info
        rented: [],
        available: [],
        premium: [],
        // RTO Income (historical - actual collected)
        rtoTotal: 0,
        rtoContracts: [],
        // House Sales (historical - actual collected)
        houseSalesTotal: 0,
        houseSales: []
    };
    
    // Process each owned property for active renters
    ownedProps.forEach(p => {
        const isRented = state.availability[p.id] === false;
        const paymentFrequency = PropertyDataService.getValue(p.id, 'paymentFrequency', p.paymentFrequency || '');
        const renterName = PropertyDataService.getValue(p.id, 'renterName', p.renterName || '');
        const isPremium = PropertyDataService.getValue(p.id, 'isPremium', p.isPremium || false);
        const isPremiumTrial = PropertyDataService.getValue(p.id, 'isPremiumTrial', p.isPremiumTrial || false);
        const premiumWeeklyFee = PropertyDataService.getValue(p.id, 'premiumWeeklyFee', p.premiumWeeklyFee || 10000);
        const isSold = PropertyDataService.getValue(p.id, 'isSold', p.isSold || false);
        
        // Get prices for each frequency
        const dailyPrice = PropertyDataService.getValue(p.id, 'dailyPrice', p.dailyPrice || 0);
        const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice || 0);
        const biweeklyPrice = PropertyDataService.getValue(p.id, 'biweeklyPrice', p.biweeklyPrice || 0);
        const monthlyPrice = PropertyDataService.getValue(p.id, 'monthlyPrice', p.monthlyPrice || 0);
        
        const propInfo = {
            id: p.id,
            title: p.title,
            renterName,
            isPremium,
            isPremiumTrial,
            premiumWeeklyFee,
            isSold
        };
        
        // Track premium properties
        if (isPremium) {
            data.premium.push(propInfo);
        }
        
        // Track rented vs available
        if (isRented) {
            data.rented.push(propInfo);
            
            // Only count active renters with a valid payment frequency
            if (paymentFrequency && ['daily', 'weekly', 'biweekly', 'monthly'].includes(paymentFrequency)) {
                let price = 0;
                
                // Get the price for this frequency
                switch (paymentFrequency) {
                    case 'daily':
                        price = dailyPrice;
                        break;
                    case 'weekly':
                        price = weeklyPrice;
                        break;
                    case 'biweekly':
                        price = biweeklyPrice;
                        break;
                    case 'monthly':
                        price = monthlyPrice;
                        break;
                }
                
                // Add to active renters for this frequency
                data.activeRenters[paymentFrequency].push({
                    id: p.id,
                    title: p.title,
                    renterName: renterName || 'Unknown',
                    price: price
                });
                
                // Add to income total for this frequency
                data.incomeByFrequency[paymentFrequency] += price;
            }
        } else {
            data.available.push(propInfo);
        }
    });
    
    // Fetch RTO contracts for this owner
    let rtoContracts = [];
    try {
        const currentUserEmail = auth.currentUser?.email;
        if (currentUserEmail) {
            const rtoSnapshot = await db.collection('rentToOwnContracts')
                .where('createdBy', '==', currentUserEmail)
                .get();
            rtoSnapshot.forEach(doc => {
                rtoContracts.push({ id: doc.id, ...doc.data() });
            });
        }
    } catch (e) {
        console.warn('[Dashboard] Could not fetch RTO contracts:', e);
    }
    
    // Fetch house sales for this owner
    let houseSales = [];
    try {
        const currentUserEmail = auth.currentUser?.email;
        if (currentUserEmail) {
            const salesSnapshot = await db.collection('houseSales')
                .where('sellerEmail', '==', currentUserEmail)
                .get();
            salesSnapshot.forEach(doc => {
                houseSales.push({ id: doc.id, ...doc.data() });
            });
        }
    } catch (e) {
        console.warn('[Dashboard] Could not fetch house sales:', e);
    }
    
    // Calculate RTO income (deposits + monthly payments - historical)
    rtoContracts.forEach(contract => {
        const history = contract.rtoPaymentHistory || [];
        const depositPaid = contract.depositPaid ? (contract.depositAmount || 0) : 0;
        const monthlyPayments = history.reduce((sum, pay) => sum + (pay.actual || 0), 0);
        const contractTotal = depositPaid + monthlyPayments;
        
        data.rtoTotal += contractTotal;
        if (contractTotal > 0 || contract.status === 'active') {
            data.rtoContracts.push({
                id: contract.documentId,
                propertyTitle: contract.propertyTitle,
                buyer: contract.buyer,
                total: contractTotal,
                depositPaid: depositPaid,
                monthlyPaid: monthlyPayments,
                status: contract.status
            });
        }
    });
    
    // Calculate house sales (historical)
    houseSales.forEach(sale => {
        data.houseSalesTotal += (sale.salePrice || 0);
        data.houseSales.push({
            id: sale.id,
            propertyTitle: sale.propertyTitle,
            salePrice: sale.salePrice,
            saleDate: sale.saleDate,
            buyerName: sale.buyerName,
            saleType: sale.saleType,
            sellerDisplayName: sale.sellerDisplayName || sale.sellerName || 'Unknown'
        });
    });
    
    // Store globally
    window.dashboardData = data;
    
    return {
        ownedCount: ownedProps.length,
        data
    };
}

// Synchronous version for backward compatibility (uses cached data or basic calculation)
function calculateTotals() {
    const ownedProps = getOwnedProperties();
    
    // Data structure matching async version
    const data = {
        activeRenters: {
            daily: [],
            weekly: [],
            biweekly: [],
            monthly: []
        },
        incomeByFrequency: {
            daily: 0,
            weekly: 0,
            biweekly: 0,
            monthly: 0
        },
        rented: [],
        available: [],
        premium: [],
        rtoTotal: 0,
        rtoContracts: [],
        houseSalesTotal: 0,
        houseSales: []
    };
    
    ownedProps.forEach(p => {
        const isPremium = PropertyDataService.getValue(p.id, 'isPremium', p.isPremium || false);
        const isPremiumTrial = PropertyDataService.getValue(p.id, 'isPremiumTrial', p.isPremiumTrial || false);
        const premiumWeeklyFee = PropertyDataService.getValue(p.id, 'premiumWeeklyFee', p.premiumWeeklyFee || 10000);
        const renterName = PropertyDataService.getValue(p.id, 'renterName', p.renterName || '');
        const isSold = PropertyDataService.getValue(p.id, 'isSold', p.isSold || false);
        const isRented = state.availability[p.id] === false;
        const paymentFrequency = PropertyDataService.getValue(p.id, 'paymentFrequency', p.paymentFrequency || '');
        
        // Get prices
        const dailyPrice = PropertyDataService.getValue(p.id, 'dailyPrice', p.dailyPrice || 0);
        const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice || 0);
        const biweeklyPrice = PropertyDataService.getValue(p.id, 'biweeklyPrice', p.biweeklyPrice || 0);
        const monthlyPrice = PropertyDataService.getValue(p.id, 'monthlyPrice', p.monthlyPrice || 0);
        
        const propInfo = {
            id: p.id,
            title: p.title,
            renterName,
            isPremium,
            isPremiumTrial,
            premiumWeeklyFee,
            isSold
        };
        
        if (isPremium) {
            data.premium.push(propInfo);
        }
        
        if (isRented) {
            data.rented.push(propInfo);
            
            // Track active renters by frequency
            if (paymentFrequency && ['daily', 'weekly', 'biweekly', 'monthly'].includes(paymentFrequency)) {
                let price = 0;
                switch (paymentFrequency) {
                    case 'daily': price = dailyPrice; break;
                    case 'weekly': price = weeklyPrice; break;
                    case 'biweekly': price = biweeklyPrice; break;
                    case 'monthly': price = monthlyPrice; break;
                }
                
                data.activeRenters[paymentFrequency].push({
                    id: p.id,
                    title: p.title,
                    renterName: renterName || 'Unknown',
                    price: price
                });
                data.incomeByFrequency[paymentFrequency] += price;
            }
        } else {
            data.available.push(propInfo);
        }
    });
    
    window.dashboardData = data;
    
    return {
        ownedCount: ownedProps.length,
        data
    };
}

// Flip card toggle
window.flipCard = function(card) {
    card.classList.toggle('flipped');
};

// Update all 8 dashboard tiles with active renter income by frequency
function updateDashboardTiles(totals) {
    const { ownedCount, data } = totals;
    
    // Get income and renter counts by frequency
    const income = data.incomeByFrequency || { daily: 0, weekly: 0, biweekly: 0, monthly: 0 };
    const renters = data.activeRenters || { daily: [], weekly: [], biweekly: [], monthly: [] };
    
    // Calculate total rental income (sum of all frequencies)
    const totalRentalIncome = income.daily + income.weekly + income.biweekly + income.monthly;
    const totalRenters = renters.daily.length + renters.weekly.length + renters.biweekly.length + renters.monthly.length;
    
    // === ROW 1: INCOME BY FREQUENCY (Active Renters Only) ===
    
    // Daily Rentals
    $('dailyIncomeDisplay').textContent = formatPrice(income.daily);
    $('dailyIncomeCount').textContent = renters.daily.length > 0 
        ? `${renters.daily.length} renter${renters.daily.length > 1 ? 's' : ''}` 
        : 'No daily renters';
    $('dailyBreakdown').innerHTML = renderActiveRentersBreakdown(renters.daily, 'daily');
    
    // Weekly Rentals
    $('weeklyIncomeDisplay').textContent = formatPrice(income.weekly);
    $('weeklyIncomeCount').textContent = renters.weekly.length > 0 
        ? `${renters.weekly.length} renter${renters.weekly.length > 1 ? 's' : ''}` 
        : 'No weekly renters';
    $('weeklyBreakdown').innerHTML = renderActiveRentersBreakdown(renters.weekly, 'weekly');
    
    // Biweekly Rentals
    $('biweeklyIncomeDisplay').textContent = formatPrice(income.biweekly);
    $('biweeklyIncomeCount').textContent = renters.biweekly.length > 0 
        ? `${renters.biweekly.length} renter${renters.biweekly.length > 1 ? 's' : ''}` 
        : 'No biweekly renters';
    $('biweeklyBreakdown').innerHTML = renderActiveRentersBreakdown(renters.biweekly, 'biweekly');
    
    // Monthly Rentals
    $('monthlyIncomeDisplay').textContent = formatPrice(income.monthly);
    $('monthlyIncomeCount').textContent = renters.monthly.length > 0 
        ? `${renters.monthly.length} renter${renters.monthly.length > 1 ? 's' : ''}` 
        : 'No monthly renters';
    $('monthlyBreakdown').innerHTML = renderActiveRentersBreakdown(renters.monthly, 'monthly');
    
    // === ROW 2: TOTALS & OTHER INCOME ===
    
    // Total Rental Income
    const totalIncomeEl = $('totalRentalIncomeDisplay');
    const totalCountEl = $('totalRentalIncomeCount');
    const totalBreakdownEl = $('totalRentalIncomeBreakdown');
    if (totalIncomeEl) {
        totalIncomeEl.textContent = formatPrice(totalRentalIncome);
    }
    if (totalCountEl) {
        totalCountEl.textContent = totalRenters > 0 
            ? `${totalRenters} renter${totalRenters > 1 ? 's' : ''} total` 
            : 'No active renters';
    }
    if (totalBreakdownEl) {
        totalBreakdownEl.innerHTML = renderTotalIncomeBreakdown(income, renters, data);
    }
    
    // Properties (Combined)
    const rentedCount = data.rented?.length || 0;
    const availableCount = data.available?.length || 0;
    const soldCount = [...(data.rented || []), ...(data.available || [])].filter(p => p.isSold).length;
    $('totalListingsDisplay').textContent = ownedCount;
    $('propertiesSubtitle').textContent = `${rentedCount} rented • ${availableCount} available${soldCount > 0 ? ` • ${soldCount} sold` : ''}`;
    $('totalListingsBreakdown').innerHTML = renderAllPropertiesListNew([...(data.rented || []), ...(data.available || [])]);
    
    // RTO Income
    const rtoIncomeEl = $('rtoIncomeDisplay');
    const rtoCountEl = $('rtoIncomeCount');
    const rtoBreakdownEl = $('rtoIncomeBreakdown');
    if (rtoIncomeEl) {
        rtoIncomeEl.textContent = formatPrice(data.rtoTotal || 0);
    }
    if (rtoCountEl) {
        const activeContracts = (data.rtoContracts || []).filter(c => c.status === 'active').length;
        rtoCountEl.textContent = activeContracts > 0 
            ? `Rent-to-Own • ${activeContracts} active` 
            : 'Rent-to-Own income';
    }
    if (rtoBreakdownEl) {
        rtoBreakdownEl.innerHTML = renderRTOBreakdown(data.rtoContracts || []);
    }
    
    // House Sales
    const houseSalesEl = $('houseSalesDisplay');
    const houseSalesCountEl = $('houseSalesCount');
    const houseSalesBreakdownEl = $('houseSalesBreakdown');
    if (houseSalesEl) {
        houseSalesEl.textContent = formatPrice(data.houseSalesTotal || 0);
    }
    if (houseSalesCountEl) {
        const salesCount = (data.houseSales || []).length;
        houseSalesCountEl.textContent = salesCount > 0 
            ? `${salesCount} sale${salesCount > 1 ? 's' : ''} completed` 
            : 'No sales yet';
    }
    if (houseSalesBreakdownEl) {
        houseSalesBreakdownEl.innerHTML = renderHouseSalesBreakdown(data.houseSales || []);
    }
}

// Render active renters breakdown for a frequency tile flip
function renderActiveRentersBreakdown(renters, frequency) {
    if (!renters || renters.length === 0) {
        return `<div class="opacity-70 italic">No ${frequency} renters</div>`;
    }
    
    const freqLabel = frequency === 'daily' ? '/day' : 
                      frequency === 'weekly' ? '/wk' : 
                      frequency === 'biweekly' ? '/2wk' : '/mo';
    
    return renters.map(r => `
        <div class="flex justify-between items-center py-1 border-b border-white/10">
            <div class="truncate pr-2">
                <div class="font-medium truncate">🏠 ${sanitize(r.title)}</div>
                <div class="opacity-70 text-[10px]">${sanitize(r.renterName)}</div>
            </div>
            <div class="text-right font-bold whitespace-nowrap">$${(r.price || 0).toLocaleString()}${freqLabel}</div>
        </div>
    `).join('');
}

// Render total income breakdown for the Total Rental Income tile flip
function renderTotalIncomeBreakdown(income, renters, data) {
    const lines = [];
    
    // Rental income by frequency
    lines.push('<div class="font-bold text-amber-300 mb-2">📊 Rental Income</div>');
    
    const frequencies = [
        { key: 'daily', label: 'Daily', icon: '📅' },
        { key: 'weekly', label: 'Weekly', icon: '📆' },
        { key: 'biweekly', label: 'Biweekly', icon: '📊' },
        { key: 'monthly', label: 'Monthly', icon: '🗓️' }
    ];
    
    frequencies.forEach(f => {
        const amount = income[f.key] || 0;
        const count = renters[f.key]?.length || 0;
        lines.push(`
            <div class="flex justify-between py-1 border-b border-white/10">
                <span>${f.icon} ${f.label}</span>
                <span class="font-medium">$${amount.toLocaleString()} <span class="opacity-60">(${count})</span></span>
            </div>
        `);
    });
    
    // RTO Income
    if (data.rtoTotal > 0) {
        lines.push(`
            <div class="flex justify-between py-1 border-b border-white/10 mt-2">
                <span>📋 RTO Income</span>
                <span class="font-medium">$${(data.rtoTotal || 0).toLocaleString()}</span>
            </div>
        `);
    }
    
    // House Sales
    if (data.houseSalesTotal > 0) {
        lines.push(`
            <div class="flex justify-between py-1 border-b border-white/10">
                <span>🏡 House Sales</span>
                <span class="font-medium">$${(data.houseSalesTotal || 0).toLocaleString()}</span>
            </div>
        `);
    }
    
    return lines.join('');
}

// Render frequency breakdown (converts monthly totals to other frequencies)
function renderFrequencyBreakdown(properties, divisor, suffix) {
    if (!properties || properties.length === 0) {
        return '<div class="opacity-70 italic">No rental income collected yet</div>';
    }
    
    return properties.map((p, i) => {
        const equiv = Math.round(p.total / divisor);
        return `
            <div class="flex justify-between py-1 border-b border-white/10 last:border-0">
                <span class="truncate mr-2">${i + 1}. ${p.title}</span>
                <span class="font-bold whitespace-nowrap">$${equiv.toLocaleString()}${suffix}</span>
            </div>
        `;
    }).join('');
}

// Render monthly breakdown (shows actual totals)
function renderMonthlyBreakdown(properties) {
    if (!properties || properties.length === 0) {
        return '<div class="opacity-70 italic">No rental income collected yet</div>';
    }
    
    return properties.map((p, i) => {
        return `
            <div class="flex justify-between py-1 border-b border-white/10 last:border-0">
                <span class="truncate mr-2">${i + 1}. ${p.title}</span>
                <span class="font-bold whitespace-nowrap">$${p.total.toLocaleString()}</span>
            </div>
        `;
    }).join('');
}

// Render RTO income breakdown
function renderRTOBreakdown(contracts) {
    if (!contracts || contracts.length === 0) {
        return '<div class="opacity-70 italic">No RTO contracts</div>';
    }
    
    return contracts.map((c, i) => {
        const statusBadge = c.status === 'active' 
            ? '<span class="text-green-400 text-[10px]">●</span>' 
            : '<span class="text-gray-400 text-[10px]">○</span>';
        return `
            <div class="flex justify-between py-1 border-b border-white/10 last:border-0">
                <span class="truncate mr-2">${statusBadge} ${c.propertyTitle}</span>
                <span class="font-bold whitespace-nowrap">$${c.total.toLocaleString()}</span>
            </div>
        `;
    }).join('');
}

// Render house sales breakdown
function renderHouseSalesBreakdown(sales) {
    if (!sales || sales.length === 0) {
        return '<div class="opacity-70 italic">No house sales yet</div>';
    }
    
    const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    
    return sales.map((s, i) => {
        const typeIcon = s.saleType === 'rto_completion' ? '📋' : '🏡';
        const sellerName = s.sellerDisplayName || s.sellerName || 'Unknown';
        const deleteBtn = isAdmin && s.id ? `
            <button onclick="event.stopPropagation(); showDeleteSaleModal('${s.id}', '${(s.propertyTitle || '').replace(/'/g, "\\'")}', '${sellerName.replace(/'/g, "\\'")}', ${s.salePrice || 0})" 
                    class="ml-2 text-red-400 hover:text-red-300 text-xs" title="Delete/Reverse Sale">
                🗑️
            </button>
        ` : '';
        return `
            <div class="flex justify-between items-center py-1 border-b border-white/10 last:border-0">
                <span class="truncate mr-2">${typeIcon} ${s.propertyTitle}</span>
                <span class="flex items-center">
                    <span class="font-bold whitespace-nowrap">$${s.salePrice.toLocaleString()}</span>
                    ${deleteBtn}
                </span>
            </div>
        `;
    }).join('');
}

// Render all properties list with status indicators (new version)
function renderAllPropertiesListNew(properties) {
    if (!properties || properties.length === 0) {
        return '<div class="opacity-70 italic">No properties</div>';
    }
    
    return properties.map((p, i) => {
        let status = '🟢'; // available
        if (p.isSold) {
            status = '🏆'; // sold
        } else if (state.availability[p.id] === false) {
            status = '🔴'; // rented
        }
        return `
            <div class="flex justify-between py-1 border-b border-white/10 last:border-0">
                <span class="truncate mr-2">${i + 1}. ${p.title}</span>
                <span>${status}</span>
            </div>
        `;
    }).join('');
}

// Render all properties list (for Total Listings tile)
function renderAllPropertiesList(properties) {
    if (properties.length === 0) {
        return '<div class="opacity-70 italic">No properties</div>';
    }
    
    return properties.map((p, i) => {
        const status = state.availability[p.id] === false ? '🔴' : '🟢';
        return `
            <div class="flex justify-between py-1 border-b border-white/10 last:border-0">
                <span class="truncate mr-2">${i + 1}. ${p.title}</span>
                <span>${status}</span>
            </div>
        `;
    }).join('');
}

// Render rented properties list
function renderRentedList(properties) {
    if (properties.length === 0) {
        return '<div class="opacity-70 italic">No rented properties</div>';
    }
    
    return properties.map((p, i) => `
        <div class="flex justify-between py-1 border-b border-white/10 last:border-0">
            <span class="truncate mr-2">${i + 1}. ${p.title}</span>
            <span class="text-sky-300 truncate max-w-[80px]">${p.renterName || 'Unknown'}</span>
        </div>
    `).join('');
}

// Render available properties list
function renderAvailableList(properties) {
    if (properties.length === 0) {
        return '<div class="opacity-70 italic">All properties rented!</div>';
    }
    
    return properties.map((p, i) => `
        <div class="py-1 border-b border-white/10 last:border-0 truncate">
            ${i + 1}. ${p.title}
        </div>
    `).join('');
}

// Render premium properties list (handles trials)
function renderPremiumList(properties) {
    if (properties.length === 0) {
        return '<div class="opacity-70 italic">No premium listings</div>';
    }
    
    return properties.map((p, i) => {
        const feeDisplay = p.isPremiumTrial ? 
            '<span class="text-cyan-300">Free Trial</span>' : 
            `<span class="text-amber-300">$${(p.premiumWeeklyFee || 10000).toLocaleString()}/wk</span>`;
        return `
            <div class="flex justify-between py-1 border-b border-white/10 last:border-0">
                <span class="truncate mr-2">${i + 1}. ${p.title}</span>
                ${feeDisplay}
            </div>
        `;
    }).join('');
}

// ==================== RENDER FUNCTIONS ====================
function renderOwnerDashboard() {
    // Load user notifications
    loadUserNotifications();
    
    // Initialize NotificationManager (handles rent alerts, badges, etc.)
    // Only init once - the init function handles all setup including rent checks
    if (typeof NotificationManager !== 'undefined' && auth?.currentUser) {
        NotificationManager.init(); // Safe to call - has internal guard against duplicates
    }
    
    // Initialize dashboard tabs (shows tabs for admin, handles tab switching)
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
    
    // Properties user actually OWNS (dashboard should only show your properties)
    const ownedProps = getOwnedProperties();
    
    // Calculate and update all 8 dashboard tiles
    // First show basic sync data, then fetch async data for accurate totals
    const basicTotals = calculateTotals();
    updateDashboardTiles(basicTotals);
    
    // Then fetch actual payment history asynchronously for accurate income totals
    calculateTotalsAsync().then(asyncTotals => {
        updateDashboardTiles(asyncTotals);
    }).catch(err => {
        console.warn('[Dashboard] Could not load payment history:', err);
    });
    
    // Check for active celebration banners
    checkCelebrationBanners();
    
    if (ownedProps.length === 0) {
        $('ownerPropertiesTable').innerHTML = `
            <tr>
                <td colspan="11" class="px-6 py-12 text-center text-gray-400">
                    <div class="text-4xl mb-4">🏠</div>
                    <p class="text-xl font-semibold">No properties assigned to this account</p>
                    <p class="text-sm mt-2">Contact the administrator to get properties assigned to your account.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // AUTO-FIX: Check all properties for inconsistent renter/availability status
    ownedProps.forEach(p => {
        const renterName = PropertyDataService.getValue(p.id, 'renterName', p.renterName || '');
        const renterPhone = PropertyDataService.getValue(p.id, 'renterPhone', p.renterPhone || '');
        const lastPaymentDate = PropertyDataService.getValue(p.id, 'lastPaymentDate', p.lastPaymentDate || '');
        if ((renterName || renterPhone || lastPaymentDate) && state.availability[p.id] !== false) {
            state.availability[p.id] = false;
            saveAvailability(p.id, false);
        }
    });
    
    $('ownerPropertiesTable').innerHTML = ownedProps.map((p, index) => {
        // Get renter and payment info
        const renterName = PropertyDataService.getValue(p.id, 'renterName', p.renterName || '');
        const paymentFrequency = PropertyDataService.getValue(p.id, 'paymentFrequency', p.paymentFrequency || '');
        const lastPaymentDate = PropertyDataService.getValue(p.id, 'lastPaymentDate', p.lastPaymentDate || '');
        const dailyPrice = PropertyDataService.getValue(p.id, 'dailyPrice', p.dailyPrice || 0);
        const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice);
        const biweeklyPrice = PropertyDataService.getValue(p.id, 'biweeklyPrice', p.biweeklyPrice || 0);
        const monthlyPrice = PropertyDataService.getValue(p.id, 'monthlyPrice', p.monthlyPrice || 0);
        
        // Check if property is sold
        const isSold = PropertyDataService.getValue(p.id, 'isSold', p.isSold || false);
        const soldTo = PropertyDataService.getValue(p.id, 'soldTo', p.soldTo || '');
        
        // Calculate next due date
        let nextDueDate = '';
        let daysUntilDue = null;
        let reminderScript = '';
        let dueDateDisplay = '';
        
        if (lastPaymentDate) {
            const lastDate = parseLocalDate(lastPaymentDate);
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
            nextDueDate = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            nextDate.setHours(0, 0, 0, 0);
            daysUntilDue = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilDue < 0) {
                dueDateDisplay = `<span class="text-red-400 font-bold">${Math.abs(daysUntilDue)}d overdue</span>`;
            } else if (daysUntilDue === 0) {
                dueDateDisplay = `<span class="text-red-400 font-bold">Due today</span>`;
            } else if (daysUntilDue === 1) {
                dueDateDisplay = `<span class="text-orange-400 font-bold">Due tomorrow</span>`;
            } else if (daysUntilDue <= 3) {
                dueDateDisplay = `<span class="text-yellow-400">${daysUntilDue}d left</span>`;
            } else {
                dueDateDisplay = `<span class="text-green-400">${daysUntilDue}d left</span>`;
            }
            
            // Generate reminder script - determine amount based on frequency
            let amountDue = weeklyPrice;
            if (paymentFrequency === 'daily' && dailyPrice > 0) {
                amountDue = dailyPrice;
            } else if (paymentFrequency === 'biweekly' && biweeklyPrice > 0) {
                amountDue = biweeklyPrice;
            } else if (paymentFrequency === 'monthly' && monthlyPrice > 0) {
                amountDue = monthlyPrice;
            } else if (paymentFrequency === 'daily') {
                amountDue = Math.round(weeklyPrice / 7);
            } else if (paymentFrequency === 'biweekly') {
                // If no biweekly price set, use weekly * 2
                amountDue = weeklyPrice * 2;
            } else if (paymentFrequency === 'monthly') {
                // If no monthly price set, use weekly * 4
                amountDue = weeklyPrice * 4;
            }
            
            if (renterName && daysUntilDue <= 1) {
                const fullNextDate = nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                if (daysUntilDue === 1) {
                    reminderScript = `Hey ${renterName}! 👋 Just a friendly reminder that your ${paymentFrequency} rent payment of $${amountDue.toLocaleString()} is due tomorrow (${fullNextDate}). Let me know if you have any questions!`;
                } else if (daysUntilDue === 0) {
                    reminderScript = `Hey ${renterName}! 👋 Just a friendly reminder that your ${paymentFrequency} rent payment of $${amountDue.toLocaleString()} is due today (${fullNextDate}). Let me know if you have any questions!`;
                } else {
                    const daysOverdue = Math.abs(daysUntilDue);
                    if (daysOverdue >= 3) {
                        // 3+ days overdue - eviction warning
                        reminderScript = `Hey ${renterName}, your ${paymentFrequency} rent payment of $${amountDue.toLocaleString()} was due on ${fullNextDate} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago). ⚠️ You are scheduled for eviction in 24 hours if payment is not received. Please make your payment immediately or contact me to discuss your situation.`;
                    } else {
                        reminderScript = `Hey ${renterName}, your ${paymentFrequency} rent payment of $${amountDue.toLocaleString()} was due on ${fullNextDate} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago). Please make your payment as soon as possible. Let me know if you need to discuss anything!`;
                    }
                }
            }
        }
        
        const lastPaidDisplay = lastPaymentDate ? formatDate(lastPaymentDate, { month: 'short', day: 'numeric' }) : '-';
        
        // Store reminder for this property
        if (reminderScript) {
            window.dashboardReminders = window.dashboardReminders || {};
            window.dashboardReminders[p.id] = reminderScript;
        }
        
        // Alternating color scheme - solid backgrounds for clarity
        const isEven = index % 2 === 0;
        const mainBg = isEven ? 'bg-slate-800' : 'bg-gray-800';
        const subBg = isEven ? 'bg-slate-900/80' : 'bg-gray-900/80';
        const accentColor = isEven ? 'border-l-purple-500' : 'border-l-blue-500';
        
        return `
        <tbody class="property-group">
            <tr class="${mainBg} border-l-4 ${accentColor}">
                <td class="px-3 py-4 text-center text-white font-bold text-lg" rowspan="2">${index + 1}</td>
                <td class="px-4 py-4"><div class="toggle-switch ${state.availability[p.id] !== false ? 'active' : ''}" onclick="toggleAvailability(${p.id})" role="switch" aria-checked="${state.availability[p.id] !== false}" tabindex="0"></div></td>
                <td class="px-4 py-4">
                    <span class="property-name-link font-bold text-white text-base" onclick="viewPropertyStats(${p.id})" role="button" tabindex="0" title="Click to view property stats">${sanitize(p.title)}</span>
                    ${isSold ? `<span class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 animate-pulse">🏆 SOLD</span>` : ''}
                </td>
                <td class="px-4 py-4 text-gray-300 capitalize hidden md:table-cell editable-cell" onclick="startCellEdit(${p.id}, 'type', this, 'propertyType')" title="Click to edit">
                    <span class="cell-value">${PropertyDataService.getValue(p.id, 'type', p.type)}</span>
                </td>
                <td class="px-4 py-4 text-gray-300 hidden lg:table-cell editable-cell text-center" onclick="startCellEdit(${p.id}, 'bedrooms', this, 'number')" title="Click to edit">
                    <span class="cell-value">${PropertyDataService.getValue(p.id, 'bedrooms', p.bedrooms)}</span>
                </td>
                <td class="px-4 py-4 text-gray-300 hidden lg:table-cell editable-cell text-center" onclick="startCellEdit(${p.id}, 'bathrooms', this, 'number')" title="Click to edit">
                    <span class="cell-value">${PropertyDataService.getValue(p.id, 'bathrooms', p.bathrooms)}</span>
                </td>
                <td class="px-4 py-4 text-gray-300 hidden lg:table-cell editable-cell text-center" onclick="startCellEdit(${p.id}, 'interiorType', this, 'select')" title="Click to edit">
                    <span class="cell-value">${PropertyDataService.getValue(p.id, 'interiorType', p.interiorType)}</span>
                </td>
                <td class="px-4 py-4 text-gray-300 hidden lg:table-cell editable-cell text-center" onclick="startCellEdit(${p.id}, 'storage', this, 'number')" title="Click to edit">
                    <span class="cell-value">${PropertyDataService.getValue(p.id, 'storage', p.storage).toLocaleString()}</span>
                </td>
                <td class="px-4 py-4 text-green-400 font-bold editable-cell text-center" onclick="startCellEdit(${p.id}, 'weeklyPrice', this, 'number')" title="Click to edit">
                    <span class="cell-value">${weeklyPrice.toLocaleString()}</span>
                </td>
                <td class="px-4 py-4 text-purple-400 font-bold editable-cell text-center" onclick="startCellEdit(${p.id}, 'monthlyPrice', this, 'number')" title="Click to edit">
                    <span class="cell-value">${monthlyPrice.toLocaleString()}</span>
                </td>
                <td class="px-3 py-4 text-center" rowspan="2">
                    <button onclick="confirmDeleteProperty(${p.id}, '${sanitize(p.title).replace(/'/g, "\\'")}')" class="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-2 rounded-lg transition" title="Delete property">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
            <tr class="${subBg} border-l-4 ${accentColor}">
                <td colspan="9" class="px-4 py-3">
                    <div class="flex flex-wrap items-center text-sm gap-x-6 gap-y-2">
                        <div class="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-3 py-1.5 rounded-lg min-w-[280px] border border-transparent hover:border-gray-600" onclick="startCellEdit(${p.id}, 'renterName', this, 'text')" title="Click to edit renter name">
                            <svg class="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            <span class="text-gray-500">Renter:</span>
                            <span class="cell-value text-white font-medium">${renterName || '<span class="text-gray-600 italic">Not set</span>'}</span>
                            <svg class="w-3 h-3 text-gray-600 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </div>
                        <div class="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-600" onclick="startCellEdit(${p.id}, 'paymentFrequency', this, 'frequency')" title="Click to edit payment frequency">
                            <svg class="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span class="text-gray-500">Frequency:</span>
                            <span class="cell-value text-white font-medium capitalize">${paymentFrequency || '<span class="text-orange-400 italic">⚠️ Not set</span>'}</span>
                            <svg class="w-3 h-3 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                        <div class="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-600" onclick="startCellEdit(${p.id}, 'lastPaymentDate', this, 'date')" title="Click to edit last payment date">
                            <svg class="w-4 h-4 text-lime-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            <span class="text-gray-500">Paid:</span>
                            <span class="cell-value text-white font-medium">${lastPaidDisplay !== '-' ? lastPaidDisplay : '<span class="text-gray-600 italic">-</span>'}</span>
                            <svg class="w-3 h-3 text-gray-600 flex-shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </div>
                        <div class="flex items-center gap-2 px-3 py-1.5">
                            <svg class="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span class="text-gray-500">Due:</span>
                            <span class="font-medium text-white">${nextDueDate || '<span class="text-gray-600">-</span>'}</span>
                            ${dueDateDisplay ? `<span class="ml-1">(${dueDateDisplay})</span>` : ''}
                        </div>
                        ${reminderScript ? `
                        <div class="ml-auto">
                            <button onclick="copyDashboardReminder(${p.id}, this)" class="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:opacity-90 transition flex items-center gap-1 shadow-lg" title="Copy reminder - text in city for fastest response">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                                📋 Copy Text
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </td>
            </tr>
        </tbody>
        <tbody><tr class="h-2"><td colspan="11"></td></tr></tbody>
    `;
    }).join('');
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
    
    if (type === 'select' && field === 'interiorType') {
        inputHTML = `
            <select class="cell-input bg-gray-800 border border-purple-500 rounded px-2 py-1 text-white text-sm w-full" 
                    onchange="saveCellEdit(this, ${propertyId}, '${field}', '${type}')"
                    onblur="setTimeout(() => cancelCellEdit(this), 150)">
                <option value="Instance" ${currentValue === 'Instance' ? 'selected' : ''}>Instance</option>
                <option value="Walk-in" ${currentValue === 'Walk-in' ? 'selected' : ''}>Walk-in</option>
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
    // Update property count
    $('propertyCount').textContent = `(${list.length})`;
    
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
            <span class="text-6xl mb-3">🏠</span>
            <span class="text-gray-400 font-semibold text-sm">Photos Coming Soon</span>
        </div>
    `;
    
    // Image error handler function name
    const imgErrorHandler = "this.onerror=null; this.parentElement.innerHTML=`<div class='w-full h-64 md:h-72 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex flex-col items-center justify-center'><span class='text-6xl mb-3'>🏠</span><span class='text-gray-400 font-semibold text-sm'>Photos Coming Soon</span></div>`;";
    
    // First render with placeholder owner - include ALL properties, even those without images
    $('propertiesGrid').innerHTML = sortedList.filter(p => p).map(p => {
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
                ${!available ? '<div class="unavailable-overlay"><div class="unavailable-text">UNAVAILABLE</div></div>' : ''}
                ${imageElement}
                ${p.videoUrl ? '<div class="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full font-bold text-xs md:text-sm shadow-lg flex items-center space-x-1 md:space-x-2"><svg class="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg><span>Video Tour</span></div>' : ''}
                ${isPremium ? '<div class="absolute top-4 right-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 px-3 py-1 rounded-full font-bold text-xs shadow-lg">⭐ FEATURED</div>' : ''}
            </div>
            <div class="p-5 md:p-6">
                <div class="flex justify-between items-start gap-2 mb-3">
                    <h4 class="text-xl md:text-2xl font-bold ${isPremium ? 'text-amber-300' : 'text-white'} min-h-[3.5rem] md:min-h-[4rem] line-clamp-2">${sanitize(p.title)}</h4>
                    <span class="badge text-white text-xs font-bold px-2 md:px-3 py-1 rounded-full uppercase shrink-0">${PropertyDataService.getValue(p.id, 'type', p.type)}</span>
                </div>
                <p class="text-gray-300 mb-2 font-medium text-sm md:text-base">📝 ${sanitize(p.location)}</p>
                <p class="text-xs md:text-sm text-gray-400 mb-2 font-semibold">Interior: ${PropertyDataService.getValue(p.id, 'interiorType', p.interiorType)}</p>
                <p id="owner-${p.id}" class="text-xs md:text-sm text-blue-400 mb-4 font-semibold">👤 Owner: Loading...</p>
                <div class="grid grid-cols-3 gap-2 mb-3 text-xs md:text-sm text-gray-300 font-semibold">
                    <div>${PropertyDataService.getValue(p.id, 'bedrooms', p.bedrooms)} Beds</div>
                    <div>${PropertyDataService.getValue(p.id, 'bathrooms', p.bathrooms)} Baths</div>
                    <div>${PropertyDataService.getValue(p.id, 'storage', p.storage).toLocaleString()}</div>
                </div>
                
                <!-- Pricing Tiers with Discount Badges -->
                ${renderPricingTiers(p, isPremium)}
                
                <button onclick="viewProperty(${p.id})" class="w-full ${isPremium ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900' : 'gradient-bg text-white'} px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg mb-2 text-sm md:text-base">View Details</button>
                <button onclick="event.stopPropagation(); viewPropertyAndHighlightOffers(${p.id})" class="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg text-sm md:text-base">📞 Contact Owner</button>
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

