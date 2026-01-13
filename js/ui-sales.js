/**
 * ============================================================================
 * UI SALES - House sales and celebration system
 * ============================================================================
 * 
 * CONTENTS:
 * - Celebration banners
 * - Create sale celebration
 * - House sales system (log sale modal)
 * - Submit vehicle sale
 * - Ownership transfer system
 * - Admin XP adjustment
 * - Delete/reverse sale system
 * 
 * DEPENDENCIES: TierService, VehicleDataService, UserPreferencesService, GamificationService
 * ============================================================================
 */

// ==================== CELEBRATION BANNERS ====================

/**
 * Check for active celebration banners on dashboard load
 */
async function checkCelebrationBanners() {
    try {
        const doc = await db.collection('settings').doc('celebrations').get();
        if (!doc.exists) return;
        
        const data = doc.data();
        const active = data.active || [];
        
        // Filter to non-expired, non-dismissed celebrations
        const now = new Date();
        const validCelebrations = active.filter(cel => {
            if (!cel.expiresAt) return false;
            if (new Date(cel.expiresAt) < now) return false;
            
            // Check if user dismissed this one via UserPreferencesService
            const dismissedKey = `dismissed_${cel.id}`;
            if (window.UserPreferencesService && UserPreferencesService.isNotificationDismissed(dismissedKey)) {
                return false;
            }
            
            return true;
        });
        
        if (validCelebrations.length > 0) {
            // Show most recent celebration
            const latest = validCelebrations[validCelebrations.length - 1];
            showCelebrationBanner(latest);
        }
    } catch (e) {
        console.log('[Celebrations] Could not check banners:', e.message);
    }
}

/**
 * Create a vehicle sale celebration banner (24 hours)
 */
window.createSaleCelebration = async function(sellerDisplayName, vehicleTitle, salePrice, buyerName) {
    try {
        const celebrationId = `sale_${Date.now()}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
        
        // Determine article (a/an) based on first letter of vehicle title
        const firstChar = (vehicleTitle || '').charAt(0).toLowerCase();
        const vowels = ['a', 'e', 'i', 'o', 'u'];
        const article = vowels.includes(firstChar) ? 'an' : 'a';
        
        // Only show seller name and vehicle - no buyer or price for privacy
        const celebration = {
            id: celebrationId,
            type: 'house_sale',
            icon: '🏆',
            userName: sellerDisplayName,
            message: `just sold ${article} ${vehicleTitle}! 🎉`,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt
        };
        
        // Get existing celebrations
        const doc = await db.collection('settings').doc('celebrations').get();
        let active = [];
        if (doc.exists) {
            active = doc.data().active || [];
        }
        
        // Add new celebration
        active.push(celebration);
        
        // Clean up expired ones
        const now = new Date();
        active = active.filter(c => new Date(c.expiresAt) > now);
        
        // Save
        await db.collection('settings').doc('celebrations').set({ active }, { merge: true });
        
        console.log('[Celebrations] Created vehicle sale celebration:', celebrationId);
        return celebrationId;
    } catch (e) {
        console.error('[Celebrations] Error creating celebration:', e);
    }
};

// ==================== HOUSE SALES SYSTEM ====================

/**
 * Show the Log Vehicle Sale modal
 */
window.showLogSaleModal = function(vehicleId, financingContractId = null) {
    // Ensure numeric ID for comparison
    const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
    const p = vehicles.find(prop => prop.id === numericId);
    if (!p) {
        showToast('Vehicle not found', 'error');
        return;
    }
    
    const buyPrice = VehicleDataService.getValue(numericId, 'buyPrice', p.buyPrice || 0);
    const buyerName = VehicleDataService.getValue(numericId, 'buyerName', p.buyerName || '');
    const today = new Date().toISOString().split('T')[0];
    const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    
    // Determine if this is from Financing completion
    const isRTOCompletion = !!financingContractId;
    const saleType = isRTOCompletion ? 'financing_completion' : 'direct_sale';
    
    // Get current vehicle owner info
    const vehicleOwnerEmail = VehicleDataService.getValue(numericId, 'owner', p.owner || '');
    const currentUserEmail = auth.currentUser?.email || '';
    const currentUserDisplayName = window.currentUserData?.displayName || currentUserEmail.split('@')[0];
    
    // Build seller selection HTML for admins
    const sellerSelectionHTML = isAdmin ? `
        <div>
            <label class="block text-gray-400 text-sm mb-2">Seller (who sold the vehicle):</label>
            <select id="saleSellerSelect" class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-rose-500 focus:outline-none">
                <option value="">-- Select Seller --</option>
                <!-- Will be populated dynamically -->
            </select>
            <p class="text-gray-500 text-xs mt-1">Select the vehicle owner who made this sale</p>
        </div>
    ` : `
        <input type="hidden" id="saleSellerSelect" value="${currentUserEmail}">
    `;
    
    const modalHTML = `
        <div id="logSaleModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-900 rounded-2xl max-w-lg w-full border border-rose-500/50 shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto">
                <!-- X Close Button -->
                <button onclick="closeLogSaleModal()" class="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                
                <div class="bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <span>🚗</span>
                        Log Vehicle Sale
                    </h3>
                    <p class="text-rose-100 text-sm mt-1">${p.title}</p>
                </div>
                
                <div class="p-6 space-y-4">
                    ${isRTOCompletion ? `
                    <div class="bg-indigo-900/50 border border-indigo-500/50 rounded-xl p-3">
                        <div class="text-indigo-300 font-bold text-sm">📋 Financing Completion</div>
                        <p class="text-indigo-200 text-xs mt-1">This sale is being logged from a completed Financing Plan contract.</p>
                    </div>
                    ` : ''}
                    
                    ${sellerSelectionHTML}
                    
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Sale Price:</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                            <input type="number" id="salePriceInput" value="${buyPrice}" 
                                class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 pl-8 text-white text-lg font-bold focus:border-rose-500 focus:outline-none">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Buyer Name:</label>
                        <input type="text" id="saleBuyerInput" value="${buyerName}" placeholder="Enter buyer's name"
                            class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-rose-500 focus:outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Sale Date:</label>
                        <input type="date" id="saleDateInput" value="${today}"
                            class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-rose-500 focus:outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">City Sales Fee:</label>
                        <div id="salesFeeDisplay" class="bg-gray-800 rounded-xl py-3 px-4 text-amber-400 font-bold">
                            $25,000
                        </div>
                        <p class="text-gray-500 text-xs mt-1">Flat city tax paid at LUX</p>
                    </div>
                    
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Notes (optional):</label>
                        <textarea id="saleNotesInput" rows="2" placeholder="Any additional notes..."
                            class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-rose-500 focus:outline-none"></textarea>
                    </div>
                    
                    <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" id="transferOwnershipCheckbox" class="w-5 h-5 rounded accent-rose-500">
                            <div>
                                <label for="transferOwnershipCheckbox" class="text-white font-medium cursor-pointer">Request ownership transfer</label>
                                <p class="text-gray-500 text-xs">Transfer this vehicle to the buyer's account (requires admin approval)</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                    <button onclick="closeLogSaleModal()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button onclick="submitVehicleSale(${numericId}, '${saleType}', '${financingContractId || ''}')" class="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                        🏆 Complete Sale
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // City sales fee is always flat $25,000 - no need to update on price change
    // The fee display already shows the correct amount in the HTML
    
    // Populate seller dropdown for admins
    if (isAdmin) {
        populateSellerDropdown(vehicleId, vehicleOwnerEmail);
    }
};

window.closeLogSaleModal = function() {
    const modal = document.getElementById('logSaleModal');
    if (modal) modal.remove();
};

/**
 * Populate seller dropdown with vehicle owners (for admin use)
 */
async function populateSellerDropdown(vehicleId, defaultOwnerEmail) {
    const select = document.getElementById('saleSellerSelect');
    if (!select) return;
    
    try {
        // Get all users who own vehicles
        const usersSnapshot = await db.collection('users').get();
        const owners = [];
        
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                // Build display name: prefer firstName + lastName, then displayName, then username
                let displayName;
                if (data.firstName && data.lastName) {
                    displayName = data.firstName + ' ' + data.lastName;
                } else if (data.displayName) {
                    displayName = data.displayName;
                } else {
                    displayName = data.username || data.email.split('@')[0];
                }
                
                owners.push({
                    email: data.email,
                    displayName: displayName,
                    uid: doc.id
                });
            }
        });
        
        // Sort by display name
        owners.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        // Build options
        let optionsHTML = '<option value="">-- Select Seller --</option>';
        owners.forEach(owner => {
            const selected = owner.email.toLowerCase() === defaultOwnerEmail?.toLowerCase() ? 'selected' : '';
            optionsHTML += `<option value="${owner.email}" data-displayname="${owner.displayName}" data-uid="${owner.uid}" ${selected}>${owner.displayName}</option>`;
        });
        
        select.innerHTML = optionsHTML;
    } catch (e) {
        console.error('[PopulateSellerDropdown] Error:', e);
    }
}

/**
 * Submit vehicle sale to Firestore
 */
window.submitVehicleSale = async function(vehicleId, saleType, financingContractId) {
    const priceInput = document.getElementById('salePriceInput');
    const buyerInput = document.getElementById('saleBuyerInput');
    const dateInput = document.getElementById('saleDateInput');
    const notesInput = document.getElementById('saleNotesInput');
    const transferCheckbox = document.getElementById('transferOwnershipCheckbox');
    const sellerSelect = document.getElementById('saleSellerSelect');
    
    // Ensure numeric ID
    const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
    
    const salePrice = parseInt(priceInput?.value) || 0;
    const buyerName = buyerInput?.value?.trim() || '';
    const saleDate = dateInput?.value || '';
    const notes = notesInput?.value?.trim() || '';
    const requestTransfer = transferCheckbox?.checked || false;
    
    // Get seller info - from dropdown for admins, or current user for regular users
    let sellerEmail, sellerDisplayName, sellerUid;
    const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    
    if (isAdmin && sellerSelect && sellerSelect.value) {
        sellerEmail = sellerSelect.value;
        const selectedOption = sellerSelect.options[sellerSelect.selectedIndex];
        sellerDisplayName = selectedOption?.dataset?.displayname || sellerEmail.split('@')[0];
        sellerUid = selectedOption?.dataset?.uid || null;
    } else {
        sellerEmail = auth.currentUser?.email || '';
        sellerUid = auth.currentUser?.uid || null;
        
        // Get display name from Firestore (prefer firstName + lastName)
        try {
            const userDoc = await db.collection('users').doc(sellerUid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.firstName && userData.lastName) {
                    sellerDisplayName = userData.firstName + ' ' + userData.lastName;
                } else if (userData.displayName) {
                    sellerDisplayName = userData.displayName;
                } else {
                    sellerDisplayName = userData.username || sellerEmail.split('@')[0];
                }
            } else {
                sellerDisplayName = sellerEmail.split('@')[0];
            }
        } catch (e) {
            sellerDisplayName = window.currentUserData?.displayName || sellerEmail.split('@')[0];
        }
    }
    
    if (salePrice <= 0) {
        showToast('Please enter a valid sale price', 'error');
        return;
    }
    if (!buyerName) {
        showToast('Please enter the buyer name', 'error');
        return;
    }
    if (!saleDate) {
        showToast('Please select a sale date', 'error');
        return;
    }
    if (isAdmin && !sellerEmail) {
        showToast('Please select the seller', 'error');
        return;
    }
    
    try {
        showToast('🚗 Recording sale...', 'info');
        closeLogSaleModal();
        
        const p = vehicles.find(prop => prop.id === numericId);
        
        const salesFee = Math.round(salePrice * 0.10);
        const netProceeds = salePrice - salesFee;
        
        // Create sale record - NEVER store usernames, only display names
        const saleDoc = {
            vehicleId: numericId,
            vehicleTitle: p?.title || `Vehicle #${numericId}`,
            salePrice: salePrice,
            saleDate: saleDate,
            buyerName: buyerName,
            sellerDisplayName: sellerDisplayName,  // Display name only for public display
            sellerEmail: sellerEmail,              // Email for internal reference only
            sellerUid: sellerUid,                  // UID for XP awards
            saleType: saleType,
            financingContractId: financingContractId || null,
            salesFee: salesFee,
            salesFeePercent: 10,
            netProceeds: netProceeds,
            requestTransfer: requestTransfer,
            transferStatus: requestTransfer ? 'pending' : null,
            notes: notes,
            recordedAt: new Date().toISOString(),
            recordedBy: auth.currentUser?.email,  // Who logged it (for audit)
            // Keep vehicleId for backwards compatibility
            vehicleId: numericId
        };
        
        // Save to vehicleSales collection
        const saleRef = await db.collection('vehicleSales').add(saleDoc);
        console.log('[VehicleSale] Created sale record:', saleRef.id);
        
        // Mark vehicle as sold
        await VehicleDataService.writeMultiple(numericId, {
            isSold: true,
            soldDate: saleDate,
            soldTo: buyerName,
            soldPrice: salePrice,
            saleId: saleRef.id
        });
        
        // If Financing completion, update the contract status (legacy support)
        if (financingContractId) {
            try {
                await db.collection('financingContracts').doc(financingContractId).update({
                    status: 'completed',
                    completedDate: saleDate,
                    saleId: saleRef.id
                });
            } catch (e) {
                console.log('[VehicleSale] No Financing contract to update');
            }
        }
        
        // Award XP to the SELLER (not the person logging it)
        if (typeof GamificationService !== 'undefined' && GamificationService.awardXP && sellerUid) {
            await GamificationService.awardXP(sellerUid, 2500, `Sold ${p?.title} for $${salePrice.toLocaleString()}`);
        }
        
        // Create celebration banner - use display name only, no buyer or price
        await createSaleCelebration(sellerDisplayName, p?.title, salePrice, buyerName);
        
        // If transfer requested, create transfer request
        if (requestTransfer) {
            await createOwnershipTransferRequest(numericId, buyerName, currentUserEmail, saleRef.id);
        }
        
        showToast('🎉 Sale recorded! Congratulations!', 'success');
        
        // Refresh the vehicle stats page
        setTimeout(() => {
            if (typeof renderVehicleStatsContent === 'function') {
                renderVehicleStatsContent(numericId);
            }
            if (typeof renderOwnerDashboard === 'function') {
                renderOwnerDashboard();
            }
        }, 500);
        
    } catch (error) {
        console.error('Error recording sale:', error);
        showToast('Failed to record sale: ' + error.message, 'error');
    }
};

// ==================== OWNERSHIP TRANSFER SYSTEM ====================

/**
 * Create an ownership transfer request for admin approval
 */
async function createOwnershipTransferRequest(vehicleId, newOwnerName, currentOwnerEmail, saleId) {
    try {
        const p = vehicles.find(prop => prop.id === vehicleId);
        
        const transferRequest = {
            vehicleId: vehicleId,
            vehicleTitle: p?.title || `Vehicle #${vehicleId}`,
            currentOwnerEmail: currentOwnerEmail,
            newOwnerName: newOwnerName,
            newOwnerEmail: null, // To be filled by admin when approving
            saleId: saleId,
            status: 'pending',
            requestedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null
        };
        
        await db.collection('ownershipTransfers').add(transferRequest);
        console.log('[OwnershipTransfer] Created transfer request for vehicle', vehicleId);
        
        showToast('📝 Ownership transfer request submitted for admin review', 'info');
    } catch (e) {
        console.error('[OwnershipTransfer] Error creating request:', e);
    }
}

/**
 * Admin function to approve ownership transfer
 */
window.approveOwnershipTransfer = async function(transferId, newOwnerEmail) {
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        showToast('Only admins can approve transfers', 'error');
        return;
    }
    
    try {
        const transferDoc = await db.collection('ownershipTransfers').doc(transferId).get();
        if (!transferDoc.exists) {
            showToast('Transfer request not found', 'error');
            return;
        }
        
        const transfer = transferDoc.data();
        const vehicleId = transfer.vehicleId;
        
        // Update vehicle owner
        await VehicleDataService.write(vehicleId, 'owner', newOwnerEmail);
        
        // Update transfer status
        await db.collection('ownershipTransfers').doc(transferId).update({
            status: 'approved',
            newOwnerEmail: newOwnerEmail,
            reviewedAt: new Date().toISOString(),
            reviewedBy: auth.currentUser?.email
        });
        
        showToast('✅ Ownership transfer approved!', 'success');
    } catch (e) {
        console.error('[OwnershipTransfer] Error approving:', e);
        showToast('Failed to approve transfer', 'error');
    }
};

/**
 * Admin function to reject ownership transfer
 */
window.rejectOwnershipTransfer = async function(transferId, reason) {
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        showToast('Only admins can reject transfers', 'error');
        return;
    }
    
    try {
        await db.collection('ownershipTransfers').doc(transferId).update({
            status: 'rejected',
            rejectionReason: reason || 'No reason provided',
            reviewedAt: new Date().toISOString(),
            reviewedBy: auth.currentUser?.email
        });
        
        showToast('Transfer request rejected', 'info');
    } catch (e) {
        console.error('[OwnershipTransfer] Error rejecting:', e);
        showToast('Failed to reject transfer', 'error');
    }
};

// ==================== ADMIN XP ADJUSTMENT ====================

/**
 * Admin function to manually adjust a user's XP
 * Can be called from browser console: adminAdjustXP('user@email.com', -2500, 'Correction: sale was reversed')
 */
window.adminAdjustXP = async function(userEmail, xpAmount, reason) {
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        console.error('Only admins can adjust XP');
        return;
    }
    
    if (!userEmail || typeof xpAmount !== 'number' || !reason) {
        console.error('Usage: adminAdjustXP("user@email.com", -2500, "Reason for adjustment")');
        return;
    }
    
    try {
        // Find user by email
        const usersSnapshot = await db.collection('users').where('email', '==', userEmail.toLowerCase()).get();
        
        if (usersSnapshot.empty) {
            console.error('User not found:', userEmail);
            return;
        }
        
        const userDoc = usersSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        console.log(`[AdminXP] Adjusting XP for ${userData.displayName || userEmail} by ${xpAmount}`);
        
        if (xpAmount > 0) {
            await GamificationService.awardXP(userId, xpAmount, `Admin adjustment: ${reason}`);
        } else {
            await GamificationService.deductXP(userId, Math.abs(xpAmount), `Admin adjustment: ${reason}`);
        }
        
        console.log(`[AdminXP] Successfully adjusted XP by ${xpAmount} for ${userEmail}`);
        showToast(`XP adjusted by ${xpAmount} for ${userData.displayName || userEmail}`, 'success');
        
        // Log the adjustment
        await db.collection('adminLogs').add({
            action: 'xp_adjustment',
            userEmail: userEmail,
            userId: userId,
            amount: xpAmount,
            reason: reason,
            adjustedBy: auth.currentUser?.email,
            adjustedAt: new Date().toISOString()
        });
        
    } catch (e) {
        console.error('[AdminXP] Error:', e);
        showToast('Failed to adjust XP: ' + e.message, 'error');
    }
};

/**
 * Admin function to remove a specific activity log entry
 * Can be called from browser console: adminRemoveActivityEntry('user@email.com', 'Sold 125 Del Perro')
 */
window.adminRemoveActivityEntry = async function(userEmail, searchText) {
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        console.error('Only admins can modify activity logs');
        return;
    }
    
    try {
        const usersSnapshot = await db.collection('users').where('email', '==', userEmail.toLowerCase()).get();
        
        if (usersSnapshot.empty) {
            console.error('User not found:', userEmail);
            return;
        }
        
        const userDoc = usersSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();
        const activityLog = userData.gamification?.activityLog || [];
        
        const originalLength = activityLog.length;
        const filteredLog = activityLog.filter(entry => {
            return !entry.reason?.includes(searchText);
        });
        
        const removed = originalLength - filteredLog.length;
        
        if (removed === 0) {
            console.log(`No entries found containing "${searchText}"`);
            return;
        }
        
        await db.collection('users').doc(userId).update({
            'gamification.activityLog': filteredLog
        });
        
        console.log(`[AdminXP] Removed ${removed} activity entries containing "${searchText}" from ${userEmail}`);
        showToast(`Removed ${removed} activity entries`, 'success');
        
    } catch (e) {
        console.error('[AdminXP] Error:', e);
    }
};

// ==================== DELETE/REVERSE SALE SYSTEM ====================

/**
 * Show confirmation modal to delete a sale (admin only)
 */
window.showDeleteSaleModal = function(saleId, vehicleTitle, sellerDisplayName, salePrice) {
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        showToast('Only admins can delete sales', 'error');
        return;
    }
    
    const modalHTML = `
        <div id="deleteSaleModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-900 rounded-2xl max-w-lg w-full border border-red-500/50 shadow-2xl overflow-hidden">
                <div class="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <span>⚠️</span>
                        Delete Sale Record
                    </h3>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
                        <p class="text-red-200 font-medium">This will permanently reverse the following sale:</p>
                        <ul class="mt-3 space-y-1 text-gray-300 text-sm">
                            <li><strong>Vehicle:</strong> ${vehicleTitle}</li>
                            <li><strong>Seller:</strong> ${sellerDisplayName}</li>
                            <li><strong>Amount:</strong> $${salePrice?.toLocaleString() || 0}</li>
                        </ul>
                    </div>
                    
                    <div class="text-gray-400 text-sm space-y-2">
                        <p><strong>This action will:</strong></p>
                        <ul class="list-disc list-inside space-y-1">
                            <li>Delete the sale record from vehicleSales</li>
                            <li>Remove the sale celebration banner</li>
                            <li>Deduct 2,500 XP from the seller</li>
                            <li>Mark the vehicle as unsold</li>
                            <li>Clear sold date, buyer, and price</li>
                        </ul>
                    </div>
                    
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Reason for deletion (required):</label>
                        <textarea id="deleteSaleReason" rows="2" placeholder="e.g., Logged under wrong seller, duplicate entry..."
                            class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-red-500 focus:outline-none"></textarea>
                    </div>
                </div>
                
                <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                    <button onclick="closeDeleteSaleModal()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button onclick="confirmDeleteSale('${saleId}')" class="flex-1 bg-gradient-to-r from-red-500 to-red-700 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                        🗑️ Delete Sale
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closeDeleteSaleModal = function() {
    const modal = document.getElementById('deleteSaleModal');
    if (modal) modal.remove();
};

/**
 * Confirm and execute sale deletion with full reversal
 */
window.confirmDeleteSale = async function(saleId) {
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        showToast('Only admins can delete sales', 'error');
        return;
    }
    
    const reasonInput = document.getElementById('deleteSaleReason');
    const reason = reasonInput?.value?.trim() || '';
    
    if (!reason) {
        showToast('Please provide a reason for deletion', 'error');
        return;
    }
    
    try {
        showToast('🗑️ Reversing sale...', 'info');
        closeDeleteSaleModal();
        
        // 1. Get the sale record
        const saleDoc = await db.collection('vehicleSales').doc(saleId).get();
        if (!saleDoc.exists) {
            showToast('Sale record not found', 'error');
            return;
        }
        
        const sale = saleDoc.data();
        const vehicleId = sale.vehicleId;
        const sellerUid = sale.sellerUid;
        const sellerDisplayName = sale.sellerDisplayName || sale.sellerName;
        
        // 2. Deduct XP from seller
        if (sellerUid && typeof GamificationService !== 'undefined' && GamificationService.deductXP) {
            await GamificationService.deductXP(sellerUid, 2500, `Sale reversed: ${sale.vehicleTitle} (Admin: ${reason})`);
        }
        
        // 3. Remove celebration banner
        const celebDoc = await db.collection('settings').doc('celebrations').get();
        if (celebDoc.exists) {
            let active = celebDoc.data().active || [];
            // Remove any celebration matching this seller and vehicle
            active = active.filter(c => {
                if (c.type === 'house_sale' && c.userName === sellerDisplayName && c.message.includes(sale.vehicleTitle)) {
                    return false;
                }
                return true;
            });
            await db.collection('settings').doc('celebrations').set({ active }, { merge: true });
        }
        
        // 4. Unmark vehicle as sold and clear buyer info if RTO
        const vehicleUpdates = {
            isSold: false,
            soldDate: null,
            soldTo: null,
            soldPrice: null,
            saleId: null
        };
        
        // If this was an Financing completion, also clear buyer/payment info
        if (sale.saleType === 'financing_completion' || sale.financingContractId) {
            vehicleUpdates.buyerName = null;
            vehicleUpdates.buyerPhone = null;
            vehicleUpdates.buyerNotes = null;
            vehicleUpdates.paymentFrequency = null;
            vehicleUpdates.lastPaymentDate = null;
            vehicleUpdates.hasActiveFinancing = false;
            vehicleUpdates.financingContractId = null;
        }
        
        await VehicleDataService.writeMultiple(vehicleId, vehicleUpdates);
        
        // 5. If there was an Financing contract, fully delete it (not just revert)
        if (sale.financingContractId) {
            try {
                await db.collection('financingContracts').doc(sale.financingContractId).delete();
                console.log('[DeleteSale] Deleted Financing contract:', sale.financingContractId);
            } catch (rtoErr) {
                console.warn('[DeleteSale] Could not delete Financing contract:', rtoErr);
            }
        }
        
        // 6. Delete the sale record
        await db.collection('vehicleSales').doc(saleId).delete();
        
        // 7. Log the deletion for audit
        await db.collection('adminLogs').add({
            action: 'sale_deleted',
            saleId: saleId,
            saleData: sale,
            reason: reason,
            deletedBy: auth.currentUser?.email,
            deletedAt: new Date().toISOString()
        });
        
        console.log('[DeleteSale] Sale reversed successfully:', saleId);
        showToast('✅ Sale deleted and fully reversed', 'success');
        
        // Refresh dashboard
        if (typeof renderOwnerDashboard === 'function') {
            setTimeout(() => renderOwnerDashboard(), 500);
        }
        
    } catch (error) {
        console.error('[DeleteSale] Error:', error);
        showToast('Failed to delete sale: ' + error.message, 'error');
    }
};

// ==================== VEHICLE SALES TRACKER ====================
// For tracking sales with down payment calculations and contracts

const LUX_MAX_TRANSACTION = 750000;
const CITY_SALES_FEE = 25000;

/**
 * Calculate payment breakdown for a vehicle sale
 */
function calculateSaleBreakdown(vehiclePrice) {
    const needsDownPayment = vehiclePrice > LUX_MAX_TRANSACTION;
    const downPayment = needsDownPayment ? vehiclePrice - LUX_MAX_TRANSACTION : 0;
    const luxTransaction = needsDownPayment ? LUX_MAX_TRANSACTION : vehiclePrice;
    const totalWithFee = vehiclePrice + CITY_SALES_FEE;
    
    return {
        vehiclePrice,
        needsDownPayment,
        downPayment,
        luxTransaction,
        cityFee: CITY_SALES_FEE,
        totalWithFee
    };
}

/**
 * Show the Start Sale modal
 */
window.showStartSaleModal = function(vehicleId) {
    // Ensure numeric ID for comparison
    const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
    const p = vehicles.find(prop => prop.id === numericId);
    if (!p) {
        showToast('Vehicle not found', 'error');
        return;
    }
    
    const buyPrice = VehicleDataService.getValue(numericId, 'buyPrice', p.buyPrice || 0);
    
    // Set form values
    document.getElementById('saleVehicleId').value = numericId;
    document.getElementById('saleBuyerName').value = '';
    document.getElementById('saleBuyerPhone').value = '';
    document.getElementById('salePriceEdit').value = buyPrice;
    document.getElementById('saleAgreementDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('saleNotes').value = '';
    document.getElementById('saleAcknowledge').checked = false;
    
    // Update breakdown with initial price
    updateSaleBreakdown();
    
    openModal('startSaleModal');
};

/**
 * Update the payment breakdown when sale price changes
 */
window.updateSaleBreakdown = function() {
    const priceInput = document.getElementById('salePriceEdit');
    const vehicleId = document.getElementById('saleVehicleId').value;
    const price = parseInt(priceInput?.value) || 0;
    
    const breakdown = calculateSaleBreakdown(price);
    
    // Update the breakdown display
    const breakdownEl = document.getElementById('salePaymentBreakdown');
    if (!breakdownEl) return;
    
    if (breakdown.needsDownPayment) {
        breakdownEl.innerHTML = `
            <h4 class="text-white font-bold mb-3 flex items-center gap-2">
                <span class="text-xl">💰</span> Payment Breakdown
                <span class="text-amber-400 text-sm font-normal">(Down payment required)</span>
            </h4>
            <div class="grid grid-cols-3 gap-3 text-center">
                <div class="bg-gray-700/50 rounded-lg p-3">
                    <div class="text-gray-400 text-xs">Vehicle Price</div>
                    <div class="text-white text-xl font-bold">$${breakdown.vehiclePrice.toLocaleString()}</div>
                </div>
                <div class="bg-red-900/50 border border-red-500/50 rounded-lg p-3">
                    <div class="text-red-300 text-xs font-bold">💵 DOWN PAYMENT</div>
                    <div class="text-red-400 text-xl font-bold">$${breakdown.downPayment.toLocaleString()}</div>
                    <div class="text-red-300/70 text-[10px]">Cash before LUX</div>
                </div>
                <div class="bg-green-900/50 border border-green-500/50 rounded-lg p-3">
                    <div class="text-green-300 text-xs">LUX Transaction</div>
                    <div class="text-green-400 text-xl font-bold">$${breakdown.luxTransaction.toLocaleString()}</div>
                    <div class="text-green-300/70 text-[10px]">After down payment</div>
                </div>
            </div>
            <div class="mt-3 text-center text-gray-400 text-sm">
                + City Fee: <span class="text-amber-400 font-bold">$${breakdown.cityFee.toLocaleString()}</span> (buyer pays at LUX)
            </div>
        `;
    } else {
        breakdownEl.innerHTML = `
            <h4 class="text-white font-bold mb-3 flex items-center gap-2">
                <span class="text-xl">💰</span> Payment Breakdown
                <span class="text-green-400 text-sm font-normal">(No down payment needed)</span>
            </h4>
            <div class="grid grid-cols-2 gap-3 text-center">
                <div class="bg-green-900/50 border border-green-500/50 rounded-lg p-3">
                    <div class="text-green-300 text-xs">LUX Transaction</div>
                    <div class="text-green-400 text-xl font-bold">$${breakdown.vehiclePrice.toLocaleString()}</div>
                </div>
                <div class="bg-gray-700/50 rounded-lg p-3">
                    <div class="text-gray-400 text-xs">+ City Fee</div>
                    <div class="text-amber-400 text-xl font-bold">$${breakdown.cityFee.toLocaleString()}</div>
                </div>
            </div>
        `;
    }
    
    // Also update the vehicle's buy price in the background if changed significantly
    if (vehicleId && price > 0) {
        const numericId = parseInt(vehicleId);
        const p = vehicles.find(v => v.id === numericId);
        if (p) {
            const originalPrice = VehicleDataService.getValue(numericId, 'buyPrice', p.buyPrice || 0);
            // Store the negotiated price for contract generation
            window._negotiatedSalePrice = price;
        }
    }
};

/**
 * Generate a unique contract ID
 */
function generateContractId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `SC-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate sale contract HTML
 */
function generateSaleContractHTML(data) {
    const date = new Date(data.agreementDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    
    // Preview HTML for modal display (responsive, dark theme)
    return `
<div style="font-family: Arial, sans-serif; padding: 20px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; border-radius: 12px;">
    <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #D4AF37; padding-bottom: 15px;">
        <div style="font-size: 20px; font-weight: bold; color: #D4AF37;">🚗 PAULYSAUTOS.COM</div>
        <div style="font-size: 16px; font-weight: bold; letter-spacing: 2px; margin-top: 5px;">VEHICLE SALE CONTRACT</div>
        <div style="font-size: 10px; color: #888; margin-top: 8px;">Contract ID: ${data.contractId}</div>
    </div>
    
    <div style="text-align: center; margin-bottom: 15px;">
        <div style="font-size: 11px; color: #888;">Agreement Date</div>
        <div style="font-size: 13px; font-weight: bold;">${date}</div>
    </div>
    
    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <div style="flex: 1; background: rgba(212, 175, 55, 0.15); border: 2px solid #D4AF37; border-radius: 8px; padding: 10px;">
            <div style="font-size: 9px; color: #D4AF37; font-weight: bold;">👤 SELLER</div>
            <div style="font-size: 14px; font-weight: bold;">${data.sellerName}</div>
            <div style="font-size: 10px; color: #888;">📱 ${data.sellerPhone || 'N/A'}</div>
        </div>
        <div style="flex: 1; background: rgba(74, 222, 128, 0.15); border: 2px solid #4ade80; border-radius: 8px; padding: 10px;">
            <div style="font-size: 9px; color: #4ade80; font-weight: bold;">🤝 BUYER</div>
            <div style="font-size: 14px; font-weight: bold;">${data.buyerName}</div>
            <div style="font-size: 10px; color: #888;">📱 ${data.buyerPhone || 'N/A'}</div>
        </div>
    </div>
    
    <div style="background: rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; margin-bottom: 15px;">
        <div style="font-size: 9px; color: #D4AF37; font-weight: bold; margin-bottom: 8px;">🚙 VEHICLE INFORMATION</div>
        <div style="font-size: 13px;"><strong>Vehicle:</strong> ${data.vehicleTitle}</div>
        <div style="font-size: 12px; color: #60a5fa;"><strong>Plate:</strong> ${data.vehiclePlate || 'N/A'}</div>
        <div style="font-size: 12px; color: #D4AF37;"><strong>Type:</strong> ${(data.vehicleType || 'N/A').toUpperCase()}</div>
    </div>
    
    <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(255, 200, 50, 0.1)); border-radius: 8px; padding: 12px; margin-bottom: 15px; border: 2px solid #D4AF37;">
        <div style="font-size: 10px; color: #D4AF37; font-weight: bold; margin-bottom: 10px;">💰 PAYMENT TERMS</div>
        <div style="display: flex; gap: 8px; text-align: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 80px; background: rgba(255,255,255,0.1); border-radius: 6px; padding: 8px;">
                <div style="font-size: 8px; color: #888;">PRICE</div>
                <div style="font-size: 16px; font-weight: bold;">$${data.vehiclePrice.toLocaleString()}</div>
            </div>
            ${data.downPayment > 0 ? `
            <div style="flex: 1; min-width: 80px; background: rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 8px; border: 1px solid #ef4444;">
                <div style="font-size: 8px; color: #f87171;">⚠️ DOWN</div>
                <div style="font-size: 16px; font-weight: bold; color: #ef4444;">$${data.downPayment.toLocaleString()}</div>
            </div>
            <div style="flex: 1; min-width: 80px; background: rgba(34, 197, 94, 0.2); border-radius: 6px; padding: 8px; border: 1px solid #22c55e;">
                <div style="font-size: 8px; color: #4ade80;">LUX</div>
                <div style="font-size: 16px; font-weight: bold; color: #22c55e;">$${data.luxTransaction.toLocaleString()}</div>
            </div>
            ` : `
            <div style="flex: 1; min-width: 80px; background: rgba(34, 197, 94, 0.2); border-radius: 6px; padding: 8px; border: 1px solid #22c55e;">
                <div style="font-size: 8px; color: #4ade80;">LUX</div>
                <div style="font-size: 16px; font-weight: bold; color: #22c55e;">$${data.vehiclePrice.toLocaleString()}</div>
            </div>
            `}
        </div>
        <div style="text-align: center; margin-top: 8px; font-size: 10px; color: #D4AF37;">
            + City Fee: $${data.cityFee.toLocaleString()} (buyer pays at LUX)
        </div>
    </div>
    
    ${data.downPayment > 0 ? `
    <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 8px; padding: 10px; margin-bottom: 15px;">
        <div style="font-size: 9px; color: #ef4444; font-weight: bold;">⚠️ DOWN PAYMENT AGREEMENT</div>
        <div style="font-size: 9px; color: #fca5a5; margin-top: 5px;">
            Buyer pays $${data.downPayment.toLocaleString()} cash BEFORE LUX transfer.
            Failure to complete = FRAUD.
        </div>
    </div>
    ` : ''}
    
    <div style="text-align: center; font-size: 9px; color: #666; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
        <div>Click "Download Image" for the full contract with signatures</div>
        <div style="margin-top: 5px; color: #4b5563;">The image includes cursive signatures for both parties.</div>
    </div>
</div>
    `;
}

/**
 * Handle Start Sale form submission
 */
document.addEventListener('DOMContentLoaded', function() {
    const startSaleForm = document.getElementById('startSaleForm');
    if (startSaleForm) {
        startSaleForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const vehicleId = parseInt(document.getElementById('saleVehicleId').value);
            const buyerName = document.getElementById('saleBuyerName').value.trim();
            const buyerPhone = document.getElementById('saleBuyerPhone').value.trim();
            const salePrice = parseInt(document.getElementById('salePriceEdit').value) || 0;
            const agreementDate = document.getElementById('saleAgreementDate').value;
            const notes = document.getElementById('saleNotes').value.trim();
            const acknowledged = document.getElementById('saleAcknowledge').checked;
            
            if (!acknowledged) {
                showToast('Please acknowledge the terms before proceeding', 'error');
                return;
            }
            
            if (!salePrice || salePrice <= 0) {
                showToast('Please enter a valid sale price', 'error');
                return;
            }
            
            const p = vehicles.find(prop => prop.id === vehicleId);
            if (!p) {
                showToast('Vehicle not found', 'error');
                return;
            }
            
            // Use the negotiated sale price from the form
            const breakdown = calculateSaleBreakdown(salePrice);
            const contractId = generateContractId();
            
            // Get seller info including phone
            let sellerName = 'Unknown Seller';
            let sellerPhone = '';
            try {
                const usersSnapshot = await db.collection('users')
                    .where('email', '==', p.ownerEmail)
                    .limit(1)
                    .get();
                if (!usersSnapshot.empty) {
                    const sellerData = usersSnapshot.docs[0].data();
                    // Prefer firstName + lastName, then username
                    if (sellerData.firstName && sellerData.lastName) {
                        sellerName = sellerData.firstName + ' ' + sellerData.lastName;
                    } else {
                        sellerName = sellerData.username || p.ownerEmail;
                    }
                    sellerPhone = sellerData.phone || '';
                }
            } catch (err) {
                console.log('[Sale] Could not fetch seller info');
            }
            
            // Create contract data with negotiated price
            const contractData = {
                contractId,
                vehicleId,
                vehicleTitle: p.title,
                vehiclePlate: VehicleDataService.getValue(vehicleId, 'plate', p.plate || ''),
                vehicleType: VehicleDataService.getValue(vehicleId, 'type', p.type || ''),
                sellerName,
                sellerEmail: p.ownerEmail,
                sellerPhone,
                buyerName,
                buyerPhone,
                vehiclePrice: salePrice,
                downPayment: breakdown.downPayment,
                luxTransaction: breakdown.luxTransaction,
                cityFee: breakdown.cityFee,
                agreementDate,
                notes,
                createdAt: new Date().toISOString(),
                status: 'pending',
                downPaymentReceived: false
            };
            
            // Save pending sale to vehicle
            const pendingSaleData = {
                contractId,
                buyerName,
                buyerPhone,
                downPayment: breakdown.downPayment,
                luxAmount: breakdown.luxTransaction,
                downPaymentReceived: false,
                createdAt: new Date().toISOString()
            };
            
            try {
                // Save contract to Firestore
                await db.collection('saleContracts').doc(contractId).set(contractData);
                
                // Update vehicle with pending sale
                await VehicleDataService.write(vehicleId, 'pendingSale', pendingSaleData);
                
                showToast('✅ Sale contract generated!', 'success');
                closeModal('startSaleModal');
                
                // Show the contract
                viewSaleContract(contractId);
                
                // Refresh the stats view
                if (typeof renderVehicleStatsContent === 'function') {
                    setTimeout(() => renderVehicleStatsContent(vehicleId), 500);
                }
                
            } catch (error) {
                console.error('[Sale] Error creating sale:', error);
                showToast('Failed to create sale: ' + error.message, 'error');
            }
        });
    }
});

/**
 * View a sale contract
 */
window.viewSaleContract = async function(contractId) {
    try {
        const doc = await db.collection('saleContracts').doc(contractId).get();
        if (!doc.exists) {
            showToast('Contract not found', 'error');
            return;
        }
        
        const data = doc.data();
        
        // Fetch seller phone if not in contract data (for old contracts)
        if (!data.sellerPhone && data.sellerEmail) {
            try {
                const sellerSnapshot = await db.collection('users')
                    .where('email', '==', data.sellerEmail.toLowerCase())
                    .limit(1)
                    .get();
                if (!sellerSnapshot.empty) {
                    data.sellerPhone = sellerSnapshot.docs[0].data().phone || '';
                }
            } catch (e) {
                console.log('[Contract] Could not fetch seller phone for preview');
            }
        }
        
        const contractHTML = generateSaleContractHTML(data);
        
        document.getElementById('saleContractContent').innerHTML = contractHTML;
        window.currentSaleContractId = contractId;
        
        openModal('viewSaleContractModal');
        
    } catch (error) {
        console.error('[Sale] Error viewing contract:', error);
        showToast('Failed to load contract', 'error');
    }
};

/**
 * Copy sale contract to clipboard
 */
window.copySaleContract = function() {
    const contractEl = document.getElementById('saleContractContent');
    if (!contractEl) return;
    
    // Get text content
    const text = contractEl.innerText;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ Contract copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy contract', 'error');
    });
};

/**
 * Print sale contract
 */
window.printSaleContract = function() {
    const contractEl = document.getElementById('saleContractContent');
    if (!contractEl) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Vehicle Sale Contract</title>
            <style>
                body { margin: 0; padding: 20px; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${contractEl.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
};

/**
 * Download contract as PNG using canvas (1000x1000 square) - matches PaulysProperties style
 * Compact layout with cursive signatures and dates
 */
window.downloadContractAsPNG = async function() {
    const contractId = window.currentSaleContractId;
    if (!contractId) {
        showToast('No contract loaded', 'error');
        return;
    }
    
    try {
        // Get contract data from Firestore
        const doc = await db.collection('saleContracts').doc(contractId).get();
        if (!doc.exists) {
            showToast('Contract not found', 'error');
            return;
        }
        
        const data = doc.data();
        showToast('🖼️ Generating contract image...', 'info');
        
        // Fetch seller phone from their profile if not in contract data
        let sellerPhone = data.sellerPhone || '';
        if (!sellerPhone && data.sellerEmail) {
            try {
                const sellerSnapshot = await db.collection('users')
                    .where('email', '==', data.sellerEmail.toLowerCase())
                    .limit(1)
                    .get();
                if (!sellerSnapshot.empty) {
                    sellerPhone = sellerSnapshot.docs[0].data().phone || '';
                }
            } catch (e) {
                console.log('[Contract] Could not fetch seller phone');
            }
        }
        
        // Load cursive font with proper waiting
        let fontLoaded = false;
        try {
            const cursiveFont = new FontFace('DancingScript', 'url(https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup6hNX6plRP.woff2)');
            await cursiveFont.load();
            document.fonts.add(cursiveFont);
            await document.fonts.ready; // Wait for fonts to be ready
            fontLoaded = true;
            console.log('[Contract] Dancing Script font loaded');
        } catch (fontErr) {
            console.log('[Contract] Font load failed, using fallback');
        }
        
        // Create canvas - SQUARE format (1000x1000)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 1000;
        canvas.width = size;
        canvas.height = size;
        
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        let y = 35;
        const margin = 50;
        const contentWidth = canvas.width - (margin * 2);
        const goldColor = '#D4AF37';
        const greenColor = '#4ade80';
        const redColor = '#ef4444';
        const blueColor = '#60a5fa';
        
        // Helper: draw horizontal line
        const drawLine = (color = goldColor, width = 1) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(canvas.width - margin, y);
            ctx.stroke();
            y += 12;
        };
        
        // === HEADER ===
        ctx.textAlign = 'center';
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = goldColor;
        ctx.fillText('🚗 PAULYSAUTOS.COM', canvas.width / 2, y);
        y += 32;
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('VEHICLE SALE CONTRACT', canvas.width / 2, y);
        y += 22;
        ctx.font = '11px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText(`Contract ID: ${data.contractId}`, canvas.width / 2, y);
        y += 18;
        drawLine(goldColor, 2);
        
        // === AGREEMENT DATE ===
        const dateStr = new Date(data.agreementDate).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        ctx.textAlign = 'center';
        ctx.font = '10px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('Agreement Date', canvas.width / 2, y);
        y += 16;
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(dateStr, canvas.width / 2, y);
        y += 22;
        
        // === PARTIES (Side by Side Boxes) ===
        const boxWidth = 420;
        const boxHeight = 60; // Slightly taller for phone numbers
        const boxGap = 20;
        const startX = margin;
        
        // Seller box
        ctx.strokeStyle = goldColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, y, boxWidth, boxHeight);
        ctx.fillStyle = 'rgba(212, 175, 55, 0.1)';
        ctx.fillRect(startX, y, boxWidth, boxHeight);
        ctx.font = '9px Arial';
        ctx.fillStyle = goldColor;
        ctx.textAlign = 'left';
        ctx.fillText('👤 SELLER', startX + 12, y + 16);
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(data.sellerName, startX + 12, y + 38);
        ctx.font = '10px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('📱 ' + (sellerPhone || 'N/A'), startX + 12, y + 52);
        
        // Buyer box
        const buyerBoxX = startX + boxWidth + boxGap;
        ctx.strokeStyle = greenColor;
        ctx.strokeRect(buyerBoxX, y, boxWidth, boxHeight);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.1)';
        ctx.fillRect(buyerBoxX, y, boxWidth, boxHeight);
        ctx.font = '9px Arial';
        ctx.fillStyle = greenColor;
        ctx.fillText('🤝 BUYER', buyerBoxX + 12, y + 16);
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(data.buyerName, buyerBoxX + 12, y + 38);
        ctx.font = '10px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('📱 ' + (data.buyerPhone || 'N/A'), buyerBoxX + 12, y + 52);
        
        y += boxHeight + 18;
        
        // === VEHICLE INFORMATION ===
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(margin, y, contentWidth, 65);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, y, contentWidth, 65);
        
        ctx.textAlign = 'left';
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = goldColor;
        ctx.fillText('🚙 VEHICLE INFORMATION', margin + 12, y + 16);
        
        // Vehicle details in a row
        const vehY = y + 38;
        ctx.font = '11px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('Vehicle', margin + 12, vehY);
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(data.vehicleTitle, margin + 12, vehY + 16);
        
        ctx.font = '11px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('License Plate', margin + 300, vehY);
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = blueColor;
        ctx.fillText(data.vehiclePlate || 'N/A', margin + 300, vehY + 16);
        
        ctx.font = '11px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('Type', margin + 500, vehY);
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = goldColor;
        ctx.fillText((data.vehicleType || 'N/A').toUpperCase(), margin + 500, vehY + 16);
        
        y += 75;
        
        // === PAYMENT TERMS ===
        ctx.fillStyle = 'rgba(212, 175, 55, 0.12)';
        ctx.fillRect(margin, y, contentWidth, data.downPayment > 0 ? 95 : 85);
        ctx.strokeStyle = goldColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(margin, y, contentWidth, data.downPayment > 0 ? 95 : 85);
        
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = goldColor;
        ctx.textAlign = 'left';
        ctx.fillText('💰 PAYMENT TERMS', margin + 12, y + 16);
        
        // Payment boxes
        const payBoxY = y + 28;
        const payBoxHeight = 55;
        const payBoxWidth = data.downPayment > 0 ? 280 : 400;
        const payBoxGap = 15;
        
        // Vehicle Price box
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(margin + 10, payBoxY, payBoxWidth, payBoxHeight);
        ctx.textAlign = 'center';
        ctx.font = '9px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('VEHICLE PRICE', margin + 10 + payBoxWidth/2, payBoxY + 18);
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('$' + data.vehiclePrice.toLocaleString(), margin + 10 + payBoxWidth/2, payBoxY + 42);
        
        if (data.downPayment > 0) {
            // Down Payment box
            const dpX = margin + 10 + payBoxWidth + payBoxGap;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            ctx.fillRect(dpX, payBoxY, payBoxWidth, payBoxHeight);
            ctx.strokeStyle = redColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(dpX, payBoxY, payBoxWidth, payBoxHeight);
            ctx.font = '9px Arial';
            ctx.fillStyle = '#f87171';
            ctx.fillText('⚠️ DOWN PAYMENT', dpX + payBoxWidth/2, payBoxY + 18);
            ctx.font = 'bold 22px Arial';
            ctx.fillStyle = redColor;
            ctx.fillText('$' + data.downPayment.toLocaleString(), dpX + payBoxWidth/2, payBoxY + 42);
            ctx.font = '8px Arial';
            ctx.fillStyle = '#f87171';
            ctx.fillText('Cash Before LUX', dpX + payBoxWidth/2, payBoxY + 53);
            
            // LUX Transaction box
            const luxX = dpX + payBoxWidth + payBoxGap;
            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.fillRect(luxX, payBoxY, payBoxWidth, payBoxHeight);
            ctx.strokeStyle = greenColor;
            ctx.strokeRect(luxX, payBoxY, payBoxWidth, payBoxHeight);
            ctx.font = '9px Arial';
            ctx.fillStyle = '#4ade80';
            ctx.fillText('LUX TRANSACTION', luxX + payBoxWidth/2, payBoxY + 18);
            ctx.font = 'bold 22px Arial';
            ctx.fillStyle = greenColor;
            ctx.fillText('$' + data.luxTransaction.toLocaleString(), luxX + payBoxWidth/2, payBoxY + 42);
            ctx.font = '8px Arial';
            ctx.fillStyle = '#4ade80';
            ctx.fillText('After Down Payment', luxX + payBoxWidth/2, payBoxY + 53);
        } else {
            // LUX Transaction box (full price)
            const luxX = margin + 10 + payBoxWidth + payBoxGap;
            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.fillRect(luxX, payBoxY, payBoxWidth, payBoxHeight);
            ctx.strokeStyle = greenColor;
            ctx.strokeRect(luxX, payBoxY, payBoxWidth, payBoxHeight);
            ctx.font = '9px Arial';
            ctx.fillStyle = '#4ade80';
            ctx.fillText('LUX TRANSACTION', luxX + payBoxWidth/2, payBoxY + 18);
            ctx.font = 'bold 22px Arial';
            ctx.fillStyle = greenColor;
            ctx.fillText('$' + data.vehiclePrice.toLocaleString(), luxX + payBoxWidth/2, payBoxY + 42);
        }
        
        y += data.downPayment > 0 ? 105 : 95;
        
        // City Sales Fee line
        ctx.textAlign = 'center';
        ctx.font = '11px Arial';
        ctx.fillStyle = goldColor;
        ctx.fillText('+ City Sales Fee: $' + data.cityFee.toLocaleString() + ' (paid by buyer at LUX)', canvas.width / 2, y);
        y += 18;
        
        // === DOWN PAYMENT AGREEMENT (if applicable) ===
        if (data.downPayment > 0) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
            ctx.fillRect(margin, y, contentWidth, 48);
            ctx.strokeStyle = redColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(margin, y, contentWidth, 48);
            
            ctx.textAlign = 'left';
            ctx.font = 'bold 10px Arial';
            ctx.fillStyle = redColor;
            ctx.fillText('⚠️ DOWN PAYMENT AGREEMENT', margin + 12, y + 14);
            ctx.font = '9px Arial';
            ctx.fillStyle = '#fca5a5';
            ctx.fillText('The BUYER agrees to pay $' + data.downPayment.toLocaleString() + ' in cash BEFORE the LUX transfer.', margin + 12, y + 28);
            ctx.fillText('The SELLER must complete the LUX transfer within 24 hours of receiving the down payment.', margin + 12, y + 40);
            
            y += 58;
        }
        
        // === ADDITIONAL NOTES (if any) ===
        if (data.notes && data.notes.trim()) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(margin, y, contentWidth, 45);
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 1;
            ctx.strokeRect(margin, y, contentWidth, 45);
            
            ctx.textAlign = 'left';
            ctx.font = 'bold 9px Arial';
            ctx.fillStyle = '#9ca3af';
            ctx.fillText('📝 ADDITIONAL NOTES', margin + 12, y + 14);
            ctx.font = '10px Arial';
            ctx.fillStyle = '#d1d5db';
            // Truncate notes if too long
            const notesText = data.notes.length > 100 ? data.notes.substring(0, 100) + '...' : data.notes;
            ctx.fillText(notesText, margin + 12, y + 32);
            
            y += 55;
        }
        
        // === SIGNATURES ===
        y += 5;
        ctx.textAlign = 'left';
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('SELLER SIGNATURE', margin, y);
        ctx.fillText('BUYER SIGNATURE', canvas.width / 2 + 20, y);
        y += 12;
        
        // Signature boxes
        const sigBoxWidth = 410;
        const sigBoxHeight = 50;
        
        // Determine cursive font to use
        const cursiveFontName = fontLoaded ? 'DancingScript' : 'Brush Script MT, cursive';
        
        // Seller signature box
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, y, sigBoxWidth, sigBoxHeight);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(margin + 1, y + 1, sigBoxWidth - 2, sigBoxHeight - 2);
        
        // Cursive seller signature
        ctx.font = `32px ${cursiveFontName}`;
        ctx.fillStyle = '#3b82f6';
        ctx.textAlign = 'left';
        ctx.fillText(data.sellerName, margin + 15, y + 36);
        
        // Buyer signature box
        const buyerSigX = canvas.width / 2 + 20;
        ctx.strokeStyle = '#4b5563';
        ctx.strokeRect(buyerSigX, y, sigBoxWidth, sigBoxHeight);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(buyerSigX + 1, y + 1, sigBoxWidth - 2, sigBoxHeight - 2);
        
        // Cursive buyer signature
        ctx.font = `32px ${cursiveFontName}`;
        ctx.fillStyle = '#3b82f6';
        ctx.fillText(data.buyerName, buyerSigX + 15, y + 36);
        
        y += sigBoxHeight + 8;
        
        // Signature labels with DATES
        const sigDate = new Date(data.agreementDate).toLocaleDateString('en-US', {
            month: 'numeric', day: 'numeric', year: 'numeric'
        });
        
        ctx.font = '10px Arial';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'left';
        ctx.fillText(data.sellerName, margin, y);
        ctx.fillStyle = '#6b7280';
        ctx.fillText('Date: ' + sigDate, margin + 250, y);
        
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(data.buyerName, buyerSigX, y);
        ctx.fillStyle = '#6b7280';
        ctx.fillText('Date: ' + sigDate, buyerSigX + 250, y);
        
        y += 25;
        
        // === FOOTER ===
        ctx.textAlign = 'center';
        ctx.font = '9px Arial';
        ctx.fillStyle = '#4b5563';
        const genDate = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        ctx.fillText('Generated via PaulysAutos.com | ' + genDate, canvas.width / 2, y);
        y += 12;
        ctx.font = '8px Arial';
        ctx.fillStyle = '#374151';
        ctx.fillText('PaulysAutos.com is NOT responsible for disputes. This document is for city court records only.', canvas.width / 2, y);
        
        // Convert to blob and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${data.contractId}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('📥 Contract image downloaded!', 'success');
        }, 'image/png');
        
    } catch (error) {
        console.error('[Contract] Error generating PNG:', error);
        showToast('Failed to generate contract image', 'error');
    }
};

/**
 * Confirm down payment received
 */
window.confirmDownPaymentReceived = async function(vehicleId) {
    const confirmed = confirm(
        '⚠️ CONFIRM DOWN PAYMENT RECEIVED\n\n' +
        'By clicking OK, you confirm that:\n' +
        '• You have PHYSICALLY received the cash down payment\n' +
        '• You are ready to complete the LUX transfer\n' +
        '• You understand this action cannot be undone\n\n' +
        'Are you sure you want to proceed?'
    );
    
    if (!confirmed) return;
    
    try {
        const p = vehicles.find(prop => prop.id === vehicleId);
        if (!p) throw new Error('Vehicle not found');
        
        const pendingSale = VehicleDataService.getValue(vehicleId, 'pendingSale', p.pendingSale || null);
        if (!pendingSale) throw new Error('No pending sale found');
        
        // Update pending sale
        pendingSale.downPaymentReceived = true;
        pendingSale.downPaymentReceivedAt = new Date().toISOString();
        
        await VehicleDataService.write(vehicleId, 'pendingSale', pendingSale);
        
        // Update contract in Firestore
        if (pendingSale.contractId) {
            await db.collection('saleContracts').doc(pendingSale.contractId).update({
                downPaymentReceived: true,
                downPaymentReceivedAt: new Date().toISOString()
            });
        }
        
        showToast('✅ Down payment confirmed! Complete the LUX transfer now.', 'success');
        
        // Refresh stats view
        if (typeof renderVehicleStatsContent === 'function') {
            renderVehicleStatsContent(vehicleId);
        }
        
    } catch (error) {
        console.error('[Sale] Error confirming down payment:', error);
        showToast('Failed to confirm: ' + error.message, 'error');
    }
};

/**
 * Show modal to complete a pending sale (with seller dropdown for admins)
 */
window.completePendingSale = async function(vehicleId) {
    const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
    
    try {
        const p = vehicles.find(prop => prop.id === numericId);
        if (!p) throw new Error('Vehicle not found');
        
        const pendingSale = VehicleDataService.getValue(numericId, 'pendingSale', p.pendingSale || null);
        if (!pendingSale) {
            showToast('No pending sale found', 'error');
            return;
        }
        
        // Get contract data for full details
        let contractData = null;
        if (pendingSale.contractId) {
            try {
                const contractDoc = await db.collection('saleContracts').doc(pendingSale.contractId).get();
                if (contractDoc.exists) {
                    contractData = contractDoc.data();
                }
            } catch (e) {
                console.log('[CompleteSale] Could not fetch contract data');
            }
        }
        
        // Calculate sale price from pending sale or contract
        const salePrice = contractData?.vehiclePrice || pendingSale.luxAmount + (pendingSale.downPayment || 0);
        const buyerName = pendingSale.buyerName || contractData?.buyerName || 'Unknown';
        const ownerEmail = VehicleDataService.getValue(numericId, 'ownerEmail', p.ownerEmail);
        
        const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
        
        // Build seller dropdown HTML for admins
        let sellerDropdownHTML = '';
        if (isAdmin) {
            sellerDropdownHTML = `
                <div class="mb-4">
                    <label class="text-gray-400 text-sm block mb-2">🏆 Award XP & Credit Sale To:</label>
                    <select id="completeSaleSellerSelect" class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-amber-500 focus:outline-none">
                        <option value="">Loading sellers...</option>
                    </select>
                    <p class="text-gray-500 text-xs mt-1">Select who should receive XP and be credited for this sale</p>
                </div>
            `;
        }
        
        // Create modal HTML
        const modalHTML = `
            <div id="completePendingSaleModal" class="complete-sale-modal fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) closeCompleteSaleModal()">
                <div class="bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full border-2 border-amber-500/50 relative overflow-hidden" onclick="event.stopPropagation()">
                    <button onclick="closeCompleteSaleModal()" class="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    
                    <div class="bg-gradient-to-r from-amber-600 to-yellow-600 px-6 py-4">
                        <h3 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                            🎉 Complete Pending Sale
                        </h3>
                        <p class="text-amber-900 text-sm">Finalize this sale and award XP</p>
                    </div>
                    
                    <div class="p-6">
                        <!-- Sale Summary -->
                        <div class="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700">
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div class="text-gray-400">Vehicle</div>
                                    <div class="text-white font-bold">${p.title}</div>
                                </div>
                                <div>
                                    <div class="text-gray-400">Buyer</div>
                                    <div class="text-green-400 font-bold">${buyerName}</div>
                                </div>
                                <div>
                                    <div class="text-gray-400">Sale Price</div>
                                    <div class="text-amber-400 font-bold text-lg">$${salePrice.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div class="text-gray-400">Down Payment</div>
                                    <div class="text-${pendingSale.downPaymentReceived ? 'green' : 'amber'}-400 font-bold">
                                        $${(pendingSale.downPayment || 0).toLocaleString()}
                                        ${pendingSale.downPaymentReceived ? '✓' : '⏳'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${sellerDropdownHTML}
                        
                        <!-- What happens -->
                        <div class="bg-green-900/20 border border-green-500/30 rounded-xl p-4 mb-4">
                            <div class="text-green-400 font-bold text-sm mb-2">✓ This will:</div>
                            <ul class="text-green-300 text-sm space-y-1">
                                <li>• Mark vehicle as <strong>SOLD</strong></li>
                                <li>• Award <strong>2,500 XP</strong> to seller</li>
                                <li>• Create celebration banner</li>
                                <li>• Close pending sale & update contract</li>
                            </ul>
                        </div>
                        
                        <!-- Action Buttons -->
                        <div class="flex gap-3">
                            <button onclick="closeCompleteSaleModal()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                                Cancel
                            </button>
                            <button onclick="submitCompletePendingSale(${numericId})" class="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 text-gray-900 py-3 rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Complete Sale
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('completePendingSaleModal');
        if (existingModal) existingModal.remove();
        document.querySelectorAll('.complete-sale-modal').forEach(el => el.remove());
        
        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add escape key listener
        document.addEventListener('keydown', window._completeSaleEscHandler);
        
        // Populate seller dropdown for admins
        if (isAdmin) {
            await populateCompleteSaleSellerDropdown(ownerEmail);
        }
        
    } catch (error) {
        console.error('[CompleteSale] Error:', error);
        showToast('Error: ' + error.message, 'error');
    }
};

/**
 * Populate the seller dropdown in Complete Sale modal
 */
async function populateCompleteSaleSellerDropdown(defaultOwnerEmail) {
    const select = document.getElementById('completeSaleSellerSelect');
    if (!select) return;
    
    try {
        const usersSnapshot = await db.collection('users').get();
        const owners = [];
        
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                let displayName;
                if (data.firstName && data.lastName) {
                    displayName = data.firstName + ' ' + data.lastName;
                } else if (data.displayName) {
                    displayName = data.displayName;
                } else {
                    displayName = data.username || data.email.split('@')[0];
                }
                
                owners.push({
                    email: data.email,
                    displayName: displayName,
                    uid: doc.id
                });
            }
        });
        
        owners.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        let optionsHTML = '<option value="">-- Select Seller --</option>';
        owners.forEach(owner => {
            const selected = owner.email.toLowerCase() === defaultOwnerEmail?.toLowerCase() ? 'selected' : '';
            optionsHTML += `<option value="${owner.email}" data-displayname="${owner.displayName}" data-uid="${owner.uid}" ${selected}>${owner.displayName} (${owner.email})</option>`;
        });
        
        select.innerHTML = optionsHTML;
    } catch (e) {
        console.error('[CompleteSale] Error loading sellers:', e);
        select.innerHTML = '<option value="">Error loading sellers</option>';
    }
}

/**
 * Close the Complete Sale modal
 */
window.closeCompleteSaleModal = function() {
    console.log('[CompleteSale] Closing modal...');
    
    // Remove by ID
    const modal = document.getElementById('completePendingSaleModal');
    if (modal) {
        modal.style.display = 'none';
        modal.remove();
        console.log('[CompleteSale] Modal removed by ID');
    }
    
    // Also remove by class (fallback)
    document.querySelectorAll('.complete-sale-modal').forEach(el => {
        el.style.display = 'none';
        el.remove();
    });
    
    // Remove escape key listener
    document.removeEventListener('keydown', window._completeSaleEscHandler);
};

// Escape key handler for modal
window._completeSaleEscHandler = function(e) {
    if (e.key === 'Escape') {
        closeCompleteSaleModal();
    }
};

/**
 * Submit the pending sale completion
 */
window.submitCompletePendingSale = async function(vehicleId) {
    const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
    
    try {
        const p = vehicles.find(prop => prop.id === numericId);
        if (!p) throw new Error('Vehicle not found');
        
        const pendingSale = VehicleDataService.getValue(numericId, 'pendingSale', p.pendingSale || null);
        if (!pendingSale) {
            showToast('No pending sale found', 'error');
            return;
        }
        
        // Get contract data
        let contractData = null;
        if (pendingSale.contractId) {
            try {
                const contractDoc = await db.collection('saleContracts').doc(pendingSale.contractId).get();
                if (contractDoc.exists) {
                    contractData = contractDoc.data();
                }
            } catch (e) {}
        }
        
        // Calculate sale price with multiple fallbacks
        const vehiclePrice = VehicleDataService.getValue(numericId, 'price', p.price || 0);
        let salePrice = contractData?.vehiclePrice || 0;
        if (!salePrice) {
            salePrice = (pendingSale.luxAmount || 0) + (pendingSale.downPayment || 0);
        }
        if (!salePrice) {
            salePrice = vehiclePrice;
        }
        
        const buyerName = pendingSale.buyerName || contractData?.buyerName || 'Unknown';
        const saleDate = new Date().toISOString().split('T')[0];
        
        // Get seller info - from dropdown for admins, or vehicle owner
        let sellerEmail, sellerDisplayName, sellerUid;
        const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
        const sellerSelect = document.getElementById('completeSaleSellerSelect');
        
        if (isAdmin && sellerSelect && sellerSelect.value) {
            sellerEmail = sellerSelect.value;
            const selectedOption = sellerSelect.options[sellerSelect.selectedIndex];
            sellerDisplayName = selectedOption?.dataset?.displayname || sellerEmail.split('@')[0];
            sellerUid = selectedOption?.dataset?.uid || null;
        } else {
            // Get from vehicle owner
            sellerEmail = VehicleDataService.getValue(numericId, 'ownerEmail', p.ownerEmail);
            
            if (sellerEmail) {
                try {
                    const usersSnapshot = await db.collection('users')
                        .where('email', '==', sellerEmail.toLowerCase())
                        .limit(1)
                        .get();
                    if (!usersSnapshot.empty) {
                        const userData = usersSnapshot.docs[0].data();
                        sellerUid = usersSnapshot.docs[0].id;
                        if (userData.firstName && userData.lastName) {
                            sellerDisplayName = userData.firstName + ' ' + userData.lastName;
                        } else {
                            sellerDisplayName = userData.username || sellerEmail.split('@')[0];
                        }
                    }
                } catch (e) {
                    sellerDisplayName = sellerEmail?.split('@')[0] || 'Unknown';
                }
            }
        }
        
        if (isAdmin && !sellerEmail) {
            showToast('Please select who should be credited for this sale', 'error');
            return;
        }
        
        showToast('🚗 Completing sale...', 'info');
        
        // Close modal immediately with fallback
        try {
            closeCompleteSaleModal();
        } catch (e) {
            console.error('[CompleteSale] Error closing modal:', e);
        }
        // Force remove any lingering modals
        document.querySelectorAll('#completePendingSaleModal, .complete-sale-modal').forEach(el => {
            el.style.display = 'none';
            el.remove();
        });
        
        // Create sale record
        const saleDoc = {
            vehicleId: numericId,
            vehicleTitle: p.title,
            salePrice: salePrice,
            saleDate: saleDate,
            buyerName: buyerName,
            sellerDisplayName: sellerDisplayName,
            sellerEmail: sellerEmail,
            sellerUid: sellerUid,
            saleType: 'pending_completed',
            contractId: pendingSale.contractId || null,
            salesFee: 25000,
            netProceeds: salePrice,
            recordedAt: new Date().toISOString(),
            recordedBy: auth.currentUser?.email
        };
        
        const saleRef = await db.collection('vehicleSales').add(saleDoc);
        console.log('[CompleteSale] Created sale record:', saleRef.id);
        
        // Mark vehicle as sold
        await VehicleDataService.writeMultiple(numericId, {
            isSold: true,
            soldDate: saleDate,
            soldTo: buyerName,
            soldPrice: salePrice,
            saleId: saleRef.id,
            pendingSale: null
        });
        
        // Update contract status
        if (pendingSale.contractId) {
            await db.collection('saleContracts').doc(pendingSale.contractId).update({
                status: 'completed',
                completedAt: new Date().toISOString()
            });
        }
        
        // Award XP to selected seller
        if (typeof GamificationService !== 'undefined' && GamificationService.awardXP && sellerUid) {
            await GamificationService.awardXP(sellerUid, 2500, `Sold ${p.title} for $${salePrice.toLocaleString()}`);
        }
        
        // Create celebration banner
        if (typeof createSaleCelebration === 'function') {
            await createSaleCelebration(sellerDisplayName, p.title, salePrice, buyerName);
        }
        
        showToast('🎉 Sale completed! Congratulations!', 'success');
        
        // Refresh views
        setTimeout(() => {
            if (typeof renderVehicleStatsContent === 'function') {
                renderVehicleStatsContent(numericId);
            }
            if (typeof renderOwnerDashboard === 'function') {
                renderOwnerDashboard();
            }
        }, 500);
        
    } catch (error) {
        console.error('[CompleteSale] Error:', error);
        showToast('Failed to complete sale: ' + error.message, 'error');
    }
};

/**
 * Cancel a pending sale
 */
window.cancelPendingSale = async function(vehicleId) {
    const confirmed = confirm(
        '⚠️ CANCEL PENDING SALE\n\n' +
        'This will:\n' +
        '• Remove the pending sale from this vehicle\n' +
        '• Mark the contract as cancelled\n\n' +
        'Are you sure you want to cancel this sale?'
    );
    
    if (!confirmed) return;
    
    try {
        const p = vehicles.find(prop => prop.id === vehicleId);
        if (!p) throw new Error('Vehicle not found');
        
        const pendingSale = VehicleDataService.getValue(vehicleId, 'pendingSale', p.pendingSale || null);
        
        // Update contract status if exists
        if (pendingSale && pendingSale.contractId) {
            await db.collection('saleContracts').doc(pendingSale.contractId).update({
                status: 'cancelled',
                cancelledAt: new Date().toISOString()
            });
        }
        
        // Remove pending sale from vehicle
        await VehicleDataService.write(vehicleId, 'pendingSale', null);
        
        showToast('✅ Sale cancelled', 'success');
        
        // Refresh stats view
        if (typeof renderVehicleStatsContent === 'function') {
            renderVehicleStatsContent(vehicleId);
        }
        
    } catch (error) {
        console.error('[Sale] Error cancelling sale:', error);
        showToast('Failed to cancel: ' + error.message, 'error');
    }
};

console.log('[UI-Sales] Vehicle sales tracker loaded');
