/**
 * ============================================================================
 * UI PROPERTY MANAGEMENT - Vehicle creation, deletion, and management
 * ============================================================================
 * 
 * CONTENTS:
 * - Create listing modal
 * - Delete vehicle
 * - Copy dashboard reminder
 * 
 * DEPENDENCIES: TierService, VehicleDataService, OwnershipService
 * ============================================================================
 */

// ==================== CREATE LISTING ====================
window.openCreateListingModal = async function() {
    hideElement($('mobileMenu'));
    
    // Check tier limits before opening
    const user = auth.currentUser;
    if (!user) {
        alert('Please sign in to create a listing.');
        return;
    }
    
    // Check profile completion first (skip for master owner)
    if (!TierService.isMasterAdmin(user.email) && !window.isProfileComplete) {
        showProfileCompletionOverlay();
        return;
    }
    
    const { canCreate, reason, tierInfo } = await TierService.canCreateListing(user.email);
    
    if (!canCreate) {
        // Show upgrade modal instead
        openUpgradeModal(reason, tierInfo.tier);
        return;
    }
    
    // Reset form
    const form = $('createListingForm');
    if (form) form.reset();
    
    // Explicitly clear all input values to prevent browser autocomplete
    const inputs = ['newListingTitle', 'newListingPlate', 'newListingLocation', 
                    'newListingBuyPrice', 'newListingImages'];
    inputs.forEach(id => {
        const el = $(id);
        if (el) el.value = '';
    });
    
    // Reset selects to first option
    const selects = ['newListingType', 'newListingUpgrades', 'newListingSpeed', 'newListingStorage', 'newListingSeats'];
    selects.forEach(id => {
        const el = $(id);
        if (el) el.selectedIndex = 0;
    });
    
    // Reset buttons to initial state
    const createBtn = $('createListingBtn');
    if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = '🚗 Create Listing';
    }
    const cancelBtn = $('cancelListingBtn');
    if (cancelBtn) showElement(cancelBtn);
    
    hideElement($('createListingError'));
    hideElement($('createListingSuccess'));
    hideElement($('priceWarning'));
    openModal('createListingModal');
};

// Handle create listing form submission
document.addEventListener('DOMContentLoaded', function() {
    const createForm = $('createListingForm');
    if (createForm) {
        createForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const errorDiv = $('createListingError');
            const successDiv = $('createListingSuccess');
            const btn = $('createListingBtn');
            
            hideElement(errorDiv);
            hideElement(successDiv);
            
            // Get form values - Benny's app style
            const title = $('newListingTitle').value.trim(); // Model name
            const plate = $('newListingPlate')?.value.trim().toUpperCase() || '';
            const type = $('newListingType').value;
            const location = $('newListingLocation').value.trim(); // Additional info
            const upgrades = $('newListingUpgrades')?.value || '';
            const speed = $('newListingSpeed')?.value || '';
            const storage = $('newListingStorage')?.value || '';
            const seats = $('newListingSeats')?.value || '';
            const buyPrice = parseInt($('newListingBuyPrice')?.value) || 0;
            const imagesText = $('newListingImages').value.trim();
            const isPremium = $('newListingPremium')?.checked || false;
            const warningDiv = $('createListingWarning');
            
            // Hide warning div if it exists
            if (warningDiv) hideElement(warningDiv);
            
            // Parse images - empty array will trigger the card's built-in placeholder
            const images = imagesText 
                ? imagesText.split('\n').map(url => url.trim()).filter(url => url)
                : [];
            
            // Validate required fields
            if (!title || !type || !plate || !upgrades || !speed || !storage || !seats || !buyPrice) {
                errorDiv.textContent = 'Please fill in all required fields.';
                showElement(errorDiv);
                return;
            }
            
            // Validate image URLs if provided
            if (images.length > 0) {
                // Check for local file paths (block completely)
                const localFilePaths = images.filter(url => url.startsWith('file:///') || url.match(/^[A-Za-z]:\\/));
                if (localFilePaths.length > 0) {
                    errorDiv.innerHTML = `<strong>❌ Local file paths don't work!</strong><br>
                        Files on your computer (like <code class="text-red-300">C:\\Users\\...</code>) can't be seen by other users.<br>
                        <span class="text-cyan-400">Please upload to <a href="https://fivemanage.com" target="_blank" class="underline">fivemanage.com</a> first, then paste the link here.</span>`;
                    showElement(errorDiv);
                    return;
                }
                
                // Check for invalid URLs
                const invalidUrls = images.filter(url => !url.startsWith('http://') && !url.startsWith('https://'));
                if (invalidUrls.length > 0) {
                    errorDiv.textContent = `Invalid URL(s): ${invalidUrls.slice(0, 2).join(', ')}${invalidUrls.length > 2 ? '...' : ''}. URLs must start with http:// or https://`;
                    showElement(errorDiv);
                    return;
                }
                
                // Check for Discord links (warning, not error)
                const discordUrls = images.filter(url => url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net'));
                if (discordUrls.length > 0 && warningDiv && !window.createListingDiscordWarningAcknowledged) {
                    warningDiv.innerHTML = `<div class="flex items-start gap-2">
                        <span class="text-yellow-400">⚠️</span>
                        <div>
                            <strong class="text-yellow-300">Warning: Discord links expire!</strong><br>
                            <span class="text-gray-300">Discord image links stop working after a few weeks. Your vehicle photos will break.</span><br>
                            <span class="text-cyan-400">We recommend using <a href="https://fivemanage.com" target="_blank" class="underline font-semibold">fivemanage.com</a> instead (it's free!).</span>
                        </div>
                    </div>
                    <div class="mt-2 flex gap-2">
                        <button type="button" onclick="window.createListingDiscordWarningAcknowledged=true; document.getElementById('createListingWarning').classList.add('hidden'); document.getElementById('createListingBtn').click();" class="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded text-sm font-bold">Create Anyway</button>
                        <button type="button" onclick="document.getElementById('createListingWarning').classList.add('hidden');" class="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm font-bold">Let Me Fix It</button>
                    </div>`;
                    showElement(warningDiv);
                    return;
                }
            }
            
            // Reset Discord warning flag for next time
            window.createListingDiscordWarningAcknowledged = false;
            
            btn.disabled = true;
            btn.textContent = 'Creating...';
            
            // Hide cancel button immediately to prevent accidental clicks
            const cancelBtn = $('cancelListingBtn');
            if (cancelBtn) hideElement(cancelBtn);
            
            try {
                // Generate new ID (find max ID + 1)
                const maxId = vehicles.reduce((max, p) => Math.max(max, p.id), 0);
                const newId = maxId + 1;
                
                // Get owner email first (lowercase for consistency)
                const ownerEmail = (auth.currentUser?.email || 'richard2019201900@gmail.com').toLowerCase();
                
                // Create new vehicle object - Benny's app style
                const newVehicle = {
                    id: newId,
                    title: title, // Model name
                    plate: plate, // License plate
                    type: type,
                    location: location, // Additional info
                    upgrades: upgrades,
                    speed: speed,
                    storage: storage,
                    seats: seats,
                    buyPrice: buyPrice,
                    images: images,
                    videoUrl: null,
                    features: false,
                    ownerEmail: ownerEmail,
                    isPremium: isPremium,
                    premiumRequestedAt: isPremium ? new Date().toISOString() : null,
                    createdAt: new Date().toISOString(),
                    createdAtTimestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Add to local vehicles array
                vehicles.push(newVehicle);
                
                // Add to owner map
                if (!ownerVehicleMap[ownerEmail]) {
                    ownerVehicleMap[ownerEmail] = [];
                }
                ownerVehicleMap[ownerEmail].push(newId);
                vehicleOwnerEmail[newId] = ownerEmail;
                
                // Set availability to true
                state.availability[newId] = true;
                await db.collection('settings').doc('vehicleAvailability').set({ [newId]: true }, { merge: true });
                
                // Save vehicle to Firestore (ownerEmail field is the source of truth)
                await db.collection('settings').doc('properties').set({
                    [newId]: newVehicle
                }, { merge: true });
                
                // Track last vehicle posted time for this user
                try {
                    const user = auth.currentUser;
                    if (user) {
                        await db.collection('users').doc(user.uid).set({
                            lastPropertyPostedAt: new Date().toISOString(),
                            lastPropertyPosted: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    }
                } catch (e) {
                    console.warn('[CreateListing] Could not update lastPropertyPosted:', e);
                }
                
                // Log premium listing fee if premium was selected
                if (isPremium && typeof logPayment === 'function') {
                    try {
                        await logPayment(newId, {
                            paymentDate: new Date().toISOString().split('T')[0],
                            amount: 10000,
                            frequency: 'premium',
                            buyerName: '👑 Premium Listing Fee',
                            type: 'premium_fee',
                            notes: 'Premium listing activation - weekly fee',
                            recordedAt: new Date().toISOString()
                        });
                    } catch (e) {
                        console.warn('[CreateListing] Could not log premium fee:', e);
                    }
                }
                
                // Update filtered vehicles
                state.filteredVehicles = [...vehicles];
                
                // Re-render
                renderVehicles(state.filteredVehicles);
                renderOwnerDashboard();
                
                // Update tier badge to reflect new listing count
                updateTierBadge(state.userTier || 'starter', ownerEmail);
                
                successDiv.textContent = '✓ Listing created successfully!';
                showElement(successDiv);
                
                // Award XP for new listing (gamification)
                if (typeof GamificationService !== 'undefined') {
                    const user = auth.currentUser;
                    if (user) {
                        // Check if this is their first listing
                        const currentListingCount = OwnershipService.getListingCount(ownerEmail);
                        if (currentListingCount === 1) {
                            // First listing - award 500 XP
                            GamificationService.awardAchievement(user.uid, 'first_listing', 500, {
                                statUpdate: { vehiclesPosted: 1 }
                            }).then(result => {
                                if (result && !result.alreadyEarned) {
                                    console.log('[Gamification] Awarded 500 XP for first listing');
                                }
                            }).catch(err => console.error('[Gamification] Error:', err));
                        } else {
                            // Additional listing - award 250 XP
                            GamificationService.awardXP(user.uid, 250, 'additional_listing').then(() => {
                                console.log('[Gamification] Awarded 250 XP for additional listing');
                                // Update stats
                                db.collection('users').doc(user.uid).update({
                                    'gamification.stats.vehiclesPosted': firebase.firestore.FieldValue.increment(1)
                                }).catch(e => console.warn('[Gamification] Could not update stats:', e));
                            }).catch(err => console.error('[Gamification] Error:', err));
                        }
                        
                        // If premium was selected, award premium XP
                        if (isPremium) {
                            GamificationService.awardAchievement(user.uid, 'premium_listing', 200).then(result => {
                                if (result && !result.alreadyEarned) {
                                    console.log('[Gamification] Awarded 200 XP for premium listing');
                                }
                            }).catch(err => console.error('[Gamification] Error:', err));
                        }
                    }
                }
                
                // Change button to show success
                btn.textContent = '✓ Created!';
                btn.classList.remove('from-amber-500', 'to-yellow-500');
                btn.classList.add('from-green-500', 'to-emerald-500');
                
                // Close modal after delay
                setTimeout(() => {
                    closeModal('createListingModal');
                    goToDashboard();
                    // Reset button state for next time
                    btn.disabled = false;
                    btn.textContent = '🏠 Create Listing';
                    btn.classList.remove('from-green-500', 'to-emerald-500');
                    btn.classList.add('from-amber-500', 'to-yellow-500');
                }, 1500);
                
            } catch (error) {
                console.error('Error creating listing:', error);
                errorDiv.textContent = 'Failed to create listing. Please try again.';
                showElement(errorDiv);
                // Show cancel button again on error
                const cancelBtn = $('cancelListingBtn');
                if (cancelBtn) showElement(cancelBtn);
                // Reset button on error
                btn.disabled = false;
                btn.textContent = '🏠 Create Listing';
            }
        });
    }
});

// ==================== DELETE PROPERTY ====================
window.confirmDeleteProperty = function(vehicleId, vehicleTitle) {
    // Store the vehicle info for deletion
    window.pendingDeleteVehicle = { id: vehicleId, title: vehicleTitle };
    
    // Update modal content
    $('deletePropertyName').textContent = vehicleTitle;
    
    // Show the modal
    openModal('deleteConfirmModal');
};

window.cancelDelete = function() {
    window.pendingDeleteVehicle = null;
    closeModal('deleteConfirmModal');
};

window.executeDeleteProperty = async function() {
    if (!window.pendingDeleteVehicle) return;
    
    const vehicleId = window.pendingDeleteVehicle.id;
    const vehicleTitle = window.pendingDeleteVehicle.title;
    const btn = $('confirmDeleteBtn');
    
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    
    try {
        // Get the ACTUAL vehicle owner's email (not the current user - could be admin)
        const actualOwnerEmail = (vehicleOwnerEmail[vehicleId] || '').toLowerCase();
        const currentUserEmail = (auth.currentUser?.email || '').toLowerCase();
        const isAdminDeleting = currentUserEmail !== actualOwnerEmail && actualOwnerEmail !== '';
        // Remove from local vehicles array
        const propIndex = vehicles.findIndex(p => p.id === vehicleId);
        if (propIndex !== -1) {
            vehicles.splice(propIndex, 1);
        }
        
        // Remove from owner map (use actual owner's email)
        const ownerForMap = actualOwnerEmail || currentUserEmail;
        if (ownerVehicleMap[ownerForMap]) {
            const idx = ownerVehicleMap[ownerForMap].indexOf(vehicleId);
            if (idx !== -1) {
                ownerVehicleMap[ownerForMap].splice(idx, 1);
            }
        }
        delete vehicleOwnerEmail[vehicleId];
        
        // Remove from availability
        delete state.availability[vehicleId];
        
        // Remove from Firestore - vehicles doc (single source of truth)
        await db.collection('settings').doc('properties').update({
            [vehicleId]: firebase.firestore.FieldValue.delete()
        });
        
        // Remove availability
        await db.collection('settings').doc('vehicleAvailability').update({
            [vehicleId]: firebase.firestore.FieldValue.delete()
        });
        
        // CREATE DELETION NOTIFICATION for the vehicle owner (if admin is deleting someone else's vehicle)
        if (isAdminDeleting && actualOwnerEmail) {
            // Find the owner's user document and set deletedProperty field
            // This triggers their existing user document listener
            const ownerSnapshot = await db.collection('users')
                .where('email', '==', actualOwnerEmail)
                .get();
            
            if (!ownerSnapshot.empty) {
                const ownerDoc = ownerSnapshot.docs[0];
                await db.collection('users').doc(ownerDoc.id).update({
                    deletedProperty: {
                        vehicleId: vehicleId,
                        vehicleTitle: vehicleTitle,
                        deletedBy: currentUserEmail,
                        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        acknowledged: false
                    }
                });
            }
        }
        
        // Update filtered vehicles
        state.filteredVehicles = [...vehicles];
        
        // Re-render
        renderVehicles(state.filteredVehicles);
        renderOwnerDashboard();
        
        // Update tier badge to reflect new listing count
        updateTierBadge(state.userTier || 'starter', currentUserEmail);
        
        // Close modal and go to dashboard
        closeModal('deleteConfirmModal');
        window.pendingDeleteVehicle = null;
        
        // If we're on the stats page for this vehicle, go back to dashboard
        if (state.currentVehicleId === vehicleId) {
            goToDashboard();
        }
        
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        alert('Failed to delete vehicle. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = '🗑️ Yes, Delete';
    }
};

// ==================== COPY DASHBOARD REMINDER ====================
window.copyDashboardReminder = function(vehicleId, btn) {
    const reminderText = window.dashboardReminders && window.dashboardReminders[vehicleId];
    if (!reminderText) {
        alert('No reminder text found.');
        return;
    }
    
    const originalHtml = btn.innerHTML;
    
    navigator.clipboard.writeText(reminderText).then(() => {
        // Show success feedback
        btn.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            ✓ Copied!
        `;
        btn.classList.remove('from-blue-500', 'to-blue-600');
        btn.classList.add('from-green-500', 'to-emerald-500');
        
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('from-green-500', 'to-emerald-500');
            btn.classList.add('from-blue-500', 'to-blue-600');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = reminderText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            btn.innerHTML = `
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                ✓ Copied!
            `;
            btn.classList.remove('from-blue-500', 'to-blue-600');
            btn.classList.add('from-green-500', 'to-emerald-500');
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('from-green-500', 'to-emerald-500');
                btn.classList.add('from-blue-500', 'to-blue-600');
            }, 2000);
        } catch (e) {
            alert('Failed to copy. Please copy manually.');
        }
        document.body.removeChild(textArea);
    });
};

