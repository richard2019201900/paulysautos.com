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
        
        // Only show seller name and vehicle - no buyer or price for privacy
        const celebration = {
            id: celebrationId,
            type: 'house_sale',
            icon: '🏆',
            userName: sellerDisplayName,
            message: `just sold ${vehicleTitle}! 🎉`,
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
    
    // Update realtor fee on price change
    const priceInput = document.getElementById('salePriceInput');
    const feeDisplay = document.getElementById('salesFeeDisplay');
    if (priceInput && feeDisplay) {
        priceInput.addEventListener('input', () => {
            const price = parseInt(priceInput.value) || 0;
            feeDisplay.textContent = `$${Math.round(price * 0.10).toLocaleString()}`;
        });
    }
    
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
    
    return `
<div style="font-family: 'Courier New', monospace; padding: 20px; max-width: 700px; margin: 0 auto;">
    <div style="text-align: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">VEHICLE SALE CONTRACT</h1>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Contract ID: ${data.contractId}</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Generated via PaulysAutos.com</p>
    </div>
    
    <div style="margin-bottom: 20px;">
        <p style="margin: 0;"><strong>Date:</strong> ${date}</p>
    </div>
    
    <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">PARTIES</h3>
        <p style="margin: 5px 0;"><strong>SELLER:</strong> ${data.sellerName}</p>
        <p style="margin: 5px 0;"><strong>BUYER:</strong> ${data.buyerName}</p>
        <p style="margin: 5px 0;"><strong>BUYER PHONE:</strong> ${data.buyerPhone}</p>
    </div>
    
    <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">VEHICLE INFORMATION</h3>
        <p style="margin: 5px 0;"><strong>Vehicle:</strong> ${data.vehicleTitle}</p>
        <p style="margin: 5px 0;"><strong>License Plate:</strong> ${data.vehiclePlate || 'N/A'}</p>
        <p style="margin: 5px 0;"><strong>Vehicle Type:</strong> ${data.vehicleType || 'N/A'}</p>
    </div>
    
    <div style="margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border: 2px solid #ffc107;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #ffc107; padding-bottom: 5px;">💰 PAYMENT TERMS</h3>
        <p style="margin: 5px 0;"><strong>Vehicle Price:</strong> $${data.vehiclePrice.toLocaleString()}</p>
        ${data.downPayment > 0 ? `
        <p style="margin: 5px 0; color: #dc3545;"><strong>⚠️ DOWN PAYMENT (Cash):</strong> $${data.downPayment.toLocaleString()}</p>
        <p style="margin: 5px 0; color: #28a745;"><strong>LUX Transaction:</strong> $${data.luxTransaction.toLocaleString()}</p>
        ` : `
        <p style="margin: 5px 0; color: #28a745;"><strong>LUX Transaction:</strong> $${data.vehiclePrice.toLocaleString()}</p>
        `}
        <p style="margin: 5px 0;"><strong>City Sales Fee:</strong> $${data.cityFee.toLocaleString()} (paid by buyer)</p>
    </div>
    
    ${data.downPayment > 0 ? `
    <div style="margin-bottom: 20px; padding: 15px; background: #f8d7da; border-radius: 8px; border: 2px solid #dc3545;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #dc3545;">⚠️ DOWN PAYMENT AGREEMENT</h3>
        <p style="margin: 5px 0; font-size: 12px;">The BUYER agrees to pay the SELLER a cash down payment of <strong>$${data.downPayment.toLocaleString()}</strong> before the vehicle transfer occurs via LUX.</p>
        <p style="margin: 5px 0; font-size: 12px;">The SELLER agrees that upon receipt of the down payment, they will complete the vehicle transfer via the LUX app for the remaining <strong>$${data.luxTransaction.toLocaleString()}</strong>.</p>
        <p style="margin: 10px 0 5px 0; font-size: 12px;"><strong>Down Payment Status:</strong> ☐ Pending  ☐ Received</p>
    </div>
    ` : ''}
    
    <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">TERMS & CONDITIONS</h3>
        <ol style="margin: 0; padding-left: 20px; font-size: 11px; line-height: 1.6;">
            <li>This agreement is binding upon both parties once signed.</li>
            <li>The vehicle is sold "AS-IS" with no warranties unless otherwise stated.</li>
            <li>The seller certifies they have legal ownership and authority to sell.</li>
            <li>The buyer acknowledges inspection of the vehicle prior to purchase.</li>
            <li>Transfer of ownership occurs upon completion of LUX transaction.</li>
            ${data.downPayment > 0 ? `
            <li><strong>The seller must complete the LUX transfer within 24 hours of receiving down payment.</strong></li>
            <li><strong>Failure to complete transfer after receiving down payment constitutes FRAUD.</strong></li>
            ` : ''}
        </ol>
    </div>
    
    ${data.notes ? `
    <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">ADDITIONAL NOTES</h3>
        <p style="margin: 0; font-size: 12px;">${data.notes}</p>
    </div>
    ` : ''}
    
    <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div style="border-top: 2px solid #333; padding-top: 10px;">
            <p style="margin: 0; font-size: 12px;"><strong>SELLER SIGNATURE</strong></p>
            <p style="margin: 20px 0 5px 0; font-size: 11px;">Name: ${data.sellerName}</p>
            <p style="margin: 0; font-size: 11px;">Date: _________________</p>
        </div>
        <div style="border-top: 2px solid #333; padding-top: 10px;">
            <p style="margin: 0; font-size: 12px;"><strong>BUYER SIGNATURE</strong></p>
            <p style="margin: 20px 0 5px 0; font-size: 11px;">Name: ${data.buyerName}</p>
            <p style="margin: 0; font-size: 11px;">Date: _________________</p>
        </div>
    </div>
    
    <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 15px;">
        <p style="margin: 0;">This contract was generated via PaulysAutos.com</p>
        <p style="margin: 5px 0 0 0;">Contract ID: ${data.contractId} | Generated: ${new Date().toLocaleString()}</p>
        <p style="margin: 5px 0 0 0; font-weight: bold;">PaulysAutos.com is not liable for disputes. This document is for city court records.</p>
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
            
            // Get seller info
            let sellerName = 'Unknown Seller';
            try {
                const usersSnapshot = await db.collection('users')
                    .where('email', '==', p.ownerEmail)
                    .limit(1)
                    .get();
                if (!usersSnapshot.empty) {
                    sellerName = usersSnapshot.docs[0].data().username || p.ownerEmail;
                }
            } catch (err) {
                console.log('[Sale] Could not fetch seller name');
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
