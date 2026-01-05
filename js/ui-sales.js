/**
 * ============================================================================
 * UI SALES - House sales and celebration system
 * ============================================================================
 * 
 * CONTENTS:
 * - Celebration banners
 * - Create sale celebration
 * - House sales system (log sale modal)
 * - Submit house sale
 * - Ownership transfer system
 * - Admin XP adjustment
 * - Delete/reverse sale system
 * 
 * DEPENDENCIES: TierService, PropertyDataService, UserPreferencesService, GamificationService
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
 * Create a house sale celebration banner (24 hours)
 */
window.createSaleCelebration = async function(sellerDisplayName, propertyTitle, salePrice, buyerName) {
    try {
        const celebrationId = `sale_${Date.now()}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
        
        // Only show seller name and property - no buyer or price for privacy
        const celebration = {
            id: celebrationId,
            type: 'house_sale',
            icon: '🏆',
            userName: sellerDisplayName,
            message: `just sold ${propertyTitle}! 🎉`,
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
        
        console.log('[Celebrations] Created house sale celebration:', celebrationId);
        return celebrationId;
    } catch (e) {
        console.error('[Celebrations] Error creating celebration:', e);
    }
};

// ==================== HOUSE SALES SYSTEM ====================

/**
 * Show the Log House Sale modal
 */
window.showLogSaleModal = function(propertyId, rtoContractId = null) {
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) {
        showToast('Property not found', 'error');
        return;
    }
    
    const buyPrice = PropertyDataService.getValue(propertyId, 'buyPrice', p.buyPrice || 0);
    const renterName = PropertyDataService.getValue(propertyId, 'renterName', p.renterName || '');
    const today = new Date().toISOString().split('T')[0];
    const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    
    // Determine if this is from RTO completion
    const isRTOCompletion = !!rtoContractId;
    const saleType = isRTOCompletion ? 'rto_completion' : 'direct_sale';
    
    // Get current property owner info
    const propertyOwnerEmail = PropertyDataService.getValue(propertyId, 'owner', p.owner || '');
    const currentUserEmail = auth.currentUser?.email || '';
    const currentUserDisplayName = window.currentUserData?.displayName || currentUserEmail.split('@')[0];
    
    // Build seller selection HTML for admins
    const sellerSelectionHTML = isAdmin ? `
        <div>
            <label class="block text-gray-400 text-sm mb-2">Seller (who sold the property):</label>
            <select id="saleSellerSelect" class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-rose-500 focus:outline-none">
                <option value="">-- Select Seller --</option>
                <!-- Will be populated dynamically -->
            </select>
            <p class="text-gray-500 text-xs mt-1">Select the property owner who made this sale</p>
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
                        <span>🏡</span>
                        Log House Sale
                    </h3>
                    <p class="text-rose-100 text-sm mt-1">${p.title}</p>
                </div>
                
                <div class="p-6 space-y-4">
                    ${isRTOCompletion ? `
                    <div class="bg-indigo-900/50 border border-indigo-500/50 rounded-xl p-3">
                        <div class="text-indigo-300 font-bold text-sm">📋 RTO Completion</div>
                        <p class="text-indigo-200 text-xs mt-1">This sale is being logged from a completed Rent-to-Own contract.</p>
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
                        <input type="text" id="saleBuyerInput" value="${renterName}" placeholder="Enter buyer's name"
                            class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-rose-500 focus:outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Sale Date:</label>
                        <input type="date" id="saleDateInput" value="${today}"
                            class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-rose-500 focus:outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">PMA Realtor Fee (10%):</label>
                        <div id="realtorFeeDisplay" class="bg-gray-800 rounded-xl py-3 px-4 text-amber-400 font-bold">
                            $${Math.round(buyPrice * 0.10).toLocaleString()}
                        </div>
                        <p class="text-gray-500 text-xs mt-1">Auto-calculated from sale price</p>
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
                                <p class="text-gray-500 text-xs">Transfer this property to the buyer's account (requires admin approval)</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                    <button onclick="closeLogSaleModal()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button onclick="submitHouseSale(${propertyId}, '${saleType}', '${rtoContractId || ''}')" class="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                        🏆 Complete Sale
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Update realtor fee on price change
    const priceInput = document.getElementById('salePriceInput');
    const feeDisplay = document.getElementById('realtorFeeDisplay');
    if (priceInput && feeDisplay) {
        priceInput.addEventListener('input', () => {
            const price = parseInt(priceInput.value) || 0;
            feeDisplay.textContent = `$${Math.round(price * 0.10).toLocaleString()}`;
        });
    }
    
    // Populate seller dropdown for admins
    if (isAdmin) {
        populateSellerDropdown(propertyId, propertyOwnerEmail);
    }
};

window.closeLogSaleModal = function() {
    const modal = document.getElementById('logSaleModal');
    if (modal) modal.remove();
};

/**
 * Populate seller dropdown with property owners (for admin use)
 */
async function populateSellerDropdown(propertyId, defaultOwnerEmail) {
    const select = document.getElementById('saleSellerSelect');
    if (!select) return;
    
    try {
        // Get all users who own properties
        const usersSnapshot = await db.collection('users').get();
        const owners = [];
        
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                owners.push({
                    email: data.email,
                    displayName: data.displayName || data.username || data.email.split('@')[0],
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
 * Submit house sale to Firestore
 */
window.submitHouseSale = async function(propertyId, saleType, rtoContractId) {
    const priceInput = document.getElementById('salePriceInput');
    const buyerInput = document.getElementById('saleBuyerInput');
    const dateInput = document.getElementById('saleDateInput');
    const notesInput = document.getElementById('saleNotesInput');
    const transferCheckbox = document.getElementById('transferOwnershipCheckbox');
    const sellerSelect = document.getElementById('saleSellerSelect');
    
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
        sellerDisplayName = window.currentUserData?.displayName || sellerEmail.split('@')[0];
        sellerUid = auth.currentUser?.uid || null;
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
        showToast('🏡 Recording sale...', 'info');
        closeLogSaleModal();
        
        const p = properties.find(prop => prop.id === propertyId);
        
        const realtorFee = Math.round(salePrice * 0.10);
        const netProceeds = salePrice - realtorFee;
        
        // Create sale record - NEVER store usernames, only display names
        const saleDoc = {
            propertyId: propertyId,
            propertyTitle: p?.title || `Property #${propertyId}`,
            salePrice: salePrice,
            saleDate: saleDate,
            buyerName: buyerName,
            sellerDisplayName: sellerDisplayName,  // Display name only for public display
            sellerEmail: sellerEmail,              // Email for internal reference only
            sellerUid: sellerUid,                  // UID for XP awards
            saleType: saleType,
            rtoContractId: rtoContractId || null,
            realtorFee: realtorFee,
            realtorFeePercent: 10,
            netProceeds: netProceeds,
            requestTransfer: requestTransfer,
            transferStatus: requestTransfer ? 'pending' : null,
            notes: notes,
            recordedAt: new Date().toISOString(),
            recordedBy: auth.currentUser?.email  // Who logged it (for audit)
        };
        
        // Save to houseSales collection
        const saleRef = await db.collection('houseSales').add(saleDoc);
        console.log('[HouseSale] Created sale record:', saleRef.id);
        
        // Mark property as sold
        await PropertyDataService.writeMultiple(propertyId, {
            isSold: true,
            soldDate: saleDate,
            soldTo: buyerName,
            soldPrice: salePrice,
            saleId: saleRef.id
        });
        
        // If RTO completion, update the contract status
        if (rtoContractId) {
            await db.collection('rentToOwnContracts').doc(rtoContractId).update({
                status: 'completed',
                completedDate: saleDate,
                saleId: saleRef.id
            });
        }
        
        // Award XP to the SELLER (not the person logging it)
        if (typeof GamificationService !== 'undefined' && GamificationService.awardXP && sellerUid) {
            await GamificationService.awardXP(sellerUid, 2500, `Sold ${p?.title} for $${salePrice.toLocaleString()}`);
        }
        
        // Create celebration banner - use display name only, no buyer or price
        await createSaleCelebration(sellerDisplayName, p?.title, salePrice, buyerName);
        
        // If transfer requested, create transfer request
        if (requestTransfer) {
            await createOwnershipTransferRequest(propertyId, buyerName, currentUserEmail, saleRef.id);
        }
        
        showToast('🎉 Sale recorded! Congratulations!', 'success');
        
        // Refresh the property stats page
        setTimeout(() => {
            if (typeof renderPropertyStatsContent === 'function') {
                renderPropertyStatsContent(propertyId);
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
async function createOwnershipTransferRequest(propertyId, newOwnerName, currentOwnerEmail, saleId) {
    try {
        const p = properties.find(prop => prop.id === propertyId);
        
        const transferRequest = {
            propertyId: propertyId,
            propertyTitle: p?.title || `Property #${propertyId}`,
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
        console.log('[OwnershipTransfer] Created transfer request for property', propertyId);
        
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
        const propertyId = transfer.propertyId;
        
        // Update property owner
        await PropertyDataService.write(propertyId, 'owner', newOwnerEmail);
        
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
window.showDeleteSaleModal = function(saleId, propertyTitle, sellerDisplayName, salePrice) {
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
                            <li><strong>Property:</strong> ${propertyTitle}</li>
                            <li><strong>Seller:</strong> ${sellerDisplayName}</li>
                            <li><strong>Amount:</strong> $${salePrice?.toLocaleString() || 0}</li>
                        </ul>
                    </div>
                    
                    <div class="text-gray-400 text-sm space-y-2">
                        <p><strong>This action will:</strong></p>
                        <ul class="list-disc list-inside space-y-1">
                            <li>Delete the sale record from houseSales</li>
                            <li>Remove the sale celebration banner</li>
                            <li>Deduct 2,500 XP from the seller</li>
                            <li>Mark the property as unsold</li>
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
        const saleDoc = await db.collection('houseSales').doc(saleId).get();
        if (!saleDoc.exists) {
            showToast('Sale record not found', 'error');
            return;
        }
        
        const sale = saleDoc.data();
        const propertyId = sale.propertyId;
        const sellerUid = sale.sellerUid;
        const sellerDisplayName = sale.sellerDisplayName || sale.sellerName;
        
        // 2. Deduct XP from seller
        if (sellerUid && typeof GamificationService !== 'undefined' && GamificationService.deductXP) {
            await GamificationService.deductXP(sellerUid, 2500, `Sale reversed: ${sale.propertyTitle} (Admin: ${reason})`);
        }
        
        // 3. Remove celebration banner
        const celebDoc = await db.collection('settings').doc('celebrations').get();
        if (celebDoc.exists) {
            let active = celebDoc.data().active || [];
            // Remove any celebration matching this seller and property
            active = active.filter(c => {
                if (c.type === 'house_sale' && c.userName === sellerDisplayName && c.message.includes(sale.propertyTitle)) {
                    return false;
                }
                return true;
            });
            await db.collection('settings').doc('celebrations').set({ active }, { merge: true });
        }
        
        // 4. Unmark property as sold and clear renter info if RTO
        const propertyUpdates = {
            isSold: false,
            soldDate: null,
            soldTo: null,
            soldPrice: null,
            saleId: null
        };
        
        // If this was an RTO completion, also clear renter/payment info
        if (sale.saleType === 'rto_completion' || sale.rtoContractId) {
            propertyUpdates.renterName = null;
            propertyUpdates.renterPhone = null;
            propertyUpdates.renterNotes = null;
            propertyUpdates.paymentFrequency = null;
            propertyUpdates.lastPaymentDate = null;
            propertyUpdates.hasActiveRTO = false;
            propertyUpdates.rtoContractId = null;
        }
        
        await PropertyDataService.writeMultiple(propertyId, propertyUpdates);
        
        // 5. If there was an RTO contract, fully delete it (not just revert)
        if (sale.rtoContractId) {
            try {
                await db.collection('rentToOwnContracts').doc(sale.rtoContractId).delete();
                console.log('[DeleteSale] Deleted RTO contract:', sale.rtoContractId);
            } catch (rtoErr) {
                console.warn('[DeleteSale] Could not delete RTO contract:', rtoErr);
            }
        }
        
        // 6. Delete the sale record
        await db.collection('houseSales').doc(saleId).delete();
        
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
