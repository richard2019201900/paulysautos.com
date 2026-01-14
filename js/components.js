// ==================== DOM ELEMENTS ====================
const $ = id => document.getElementById(id);

// ==================== UTILITY FUNCTIONS ====================
const sanitize = str => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

const formatPrice = amt => amt >= 1e6 ? `$${(amt/1e6).toFixed(1)}M` : amt >= 1e3 ? `$${(amt/1e3).toFixed(0)}k` : `$${amt.toLocaleString()}`;

const showElement = el => el?.classList.remove('hidden');
const hideElement = el => el?.classList.add('hidden');
const toggleClass = (el, cls, add) => el?.classList.toggle(cls, add);

// ==================== CLIPBOARD ====================
window.copyToClipboard = function(elementId, btn) {
    const el = $(elementId);
    const text = el.value || el.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = orig, 2000);
    }).catch(() => {
        // Fallback for older browsers
        el.select?.();
        document.execCommand('copy');
    });
};

// ==================== MODAL FUNCTIONS ====================
window.openModal = function(id) {
    showElement($(id));
    
    // If opening login modal, clear all forms and show login options
    if (id === 'loginModal') {
        // Clear login form
        const ownerEmail = $('ownerEmail');
        const ownerPassword = $('ownerPassword');
        if (ownerEmail) ownerEmail.value = '';
        if (ownerPassword) ownerPassword.value = '';
        
        // Clear create account form
        const newAccountEmail = $('newAccountEmail');
        const newAccountPassword = $('newAccountPassword');
        const newAccountDisplayName = $('newAccountDisplayName');
        if (newAccountEmail) newAccountEmail.value = '';
        if (newAccountPassword) newAccountPassword.value = '';
        if (newAccountDisplayName) newAccountDisplayName.value = '';
        
        // Hide error messages
        hideElement($('loginError'));
        hideElement($('createAccountError'));
        
        // Reset button states
        const createBtn = $('createAccountBtn');
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.textContent = '🌱 Create Starter Account';
        }
        const loginBtn = $('loginSubmitBtn');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
        
        // Reset to show login options (not a specific form)
        showElement($('loginOptions'));
        hideElement($('ownerLoginForm'));
        hideElement($('createAccountForm'));
    }
};
window.closeModal = function(id) {
    hideElement($(id));
    
    // If closing login modal, clear all forms and reset buttons
    if (id === 'loginModal') {
        const ownerEmail = $('ownerEmail');
        const ownerPassword = $('ownerPassword');
        const newAccountEmail = $('newAccountEmail');
        const newAccountPassword = $('newAccountPassword');
        const newAccountDisplayName = $('newAccountDisplayName');
        if (ownerEmail) ownerEmail.value = '';
        if (ownerPassword) ownerPassword.value = '';
        if (newAccountEmail) newAccountEmail.value = '';
        if (newAccountPassword) newAccountPassword.value = '';
        if (newAccountDisplayName) newAccountDisplayName.value = '';
        
        // Reset button states
        const createBtn = $('createAccountBtn');
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.textContent = '🌱 Create Starter Account';
        }
        const loginBtn = $('loginSubmitBtn');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    }
};

window.openContactModal = async function(type, vehicleTitle, vehicleId) {
    // For vehicles, type is always 'purchase' (no financing)
    const colors = ['amber', 'orange'];
    const defaultPhone = '2057028233'; // Pauly's number as fallback
    let usedFallback = false; // Track if we had to use fallback
    
    const modalTitle = $('modalTitle');
    const modalVehicleName = $('modalVehicleName');
    const modalMessage = $('modalMessage');
    const modalPhone = $('modalPhone');
    const accent = $('modalAccent');
    
    // Safety check - ensure modal elements exist
    if (!modalTitle || !modalVehicleName || !modalMessage || !modalPhone || !accent) {
        console.error('[Contact] Modal elements not found in DOM');
        alert('Unable to open contact modal. Please refresh the page.');
        return;
    }
    
    modalTitle.textContent = 'Purchase This Vehicle';
    modalTitle.className = `text-3xl font-black bg-gradient-to-r from-${colors[0]}-500 to-${colors[1]}-600 bg-clip-text text-transparent mb-4 text-center`;
    modalVehicleName.textContent = 'Vehicle: ' + vehicleTitle;
    modalMessage.value = `Hello! I came across your listing for ${vehicleTitle} on PaulysAutos.com and I'm interested in purchasing it. Please contact me ASAP to discuss further.`;
    
    accent.className = `bg-gradient-to-r from-${colors[0]}-900 to-${colors[1]}-900 p-4 rounded-xl mb-6 text-center border border-${colors[0]}-700`;
    
    // Show vehicle purchase disclaimer
    const disclaimer = $('modalDisclaimer');
    if (disclaimer) {
        disclaimer.innerHTML = `
            <div class="text-xs text-gray-400 mt-2 space-y-1">
                <div><strong>📋 Note:</strong> All communications, vehicle viewings, and transactions are conducted in-city. This website serves as a listing platform only.</div>
                <div><strong>💰 City Fee:</strong> The government charges an additional <span class="text-amber-400 font-bold">$25,000</span> when selling vehicles through the LUX app. This fee goes directly to the city and is not charged by PaulysAutos.com.</div>
            </div>
        `;
    }
    
    // Reset to default phone first
    modalPhone.value = defaultPhone;
    usedFallback = true; // Assume fallback until we find a better contact
    
    // Check for assigned agents first
    let agentContacts = [];
    if (typeof getAgentContactsForProperty === 'function') {
        try {
            agentContacts = await getAgentContactsForProperty(vehicleId);
        } catch (e) {
        }
    }
    
    // If agents are assigned, show their contact info
    if (agentContacts.length > 0) {
        usedFallback = false;
        if (agentContacts.length === 1) {
            // Single agent
            modalPhone.value = agentContacts[0].phone.replace(/\D/g, '');
        } else {
            // Multiple agents - show all phones
            const phonesHtml = agentContacts.map(a => 
                `<div class="bg-gray-700 rounded-lg p-2 text-center">
                    <div class="text-white font-bold">${a.username}</div>
                    <div class="text-cyan-400 font-mono text-lg">${a.phone}</div>
                </div>`
            ).join('');
            
            // Update the accent section to show multiple contacts
            accent.innerHTML = `
                <div class="text-gray-300 text-sm mb-3">
                    <strong>🏢 Multiple Sales Agents</strong><br>
                    This vehicle has ${agentContacts.length} agents. Text <strong>ALL</strong> of them for the quickest response!
                </div>
                <div class="grid grid-cols-${Math.min(agentContacts.length, 3)} gap-2">
                    ${phonesHtml}
                </div>
            `;
            
            // Set the first agent's phone in the input
            modalPhone.value = agentContacts[0].phone.replace(/\D/g, '');
        }
    } else {
        // No agents - use owner contact (existing behavior)
        try {
            if (vehicleId && typeof db !== 'undefined') {
                // Get vehicle data to find owner contact info
                const propsDoc = await db.collection('settings').doc('properties').get();
                if (propsDoc.exists) {
                    const vehicles = propsDoc.data();
                    const vehicle = vehicles[vehicleId] || vehicles[String(vehicleId)];
                    
                    if (vehicle) {
                        // Check ownerContactPhone first (synced from user profile)
                        if (vehicle.ownerContactPhone) {
                            modalPhone.value = vehicle.ownerContactPhone.replace(/\D/g, '');
                            usedFallback = false;
                        }
                        // Then check legacy ownerPhone field
                        else if (vehicle.ownerPhone) {
                            modalPhone.value = vehicle.ownerPhone.replace(/\D/g, '');
                            usedFallback = false;
                        }
                        // Finally try user doc (may fail for non-admins due to permissions)
                        else if (vehicle.ownerEmail) {
                            try {
                                const usersSnapshot = await db.collection('users')
                                    .where('email', '==', vehicle.ownerEmail.toLowerCase())
                                    .limit(1)
                                    .get();
                                
                                if (!usersSnapshot.empty) {
                                    const userData = usersSnapshot.docs[0].data();
                                    if (userData.phone) {
                                        modalPhone.value = userData.phone.replace(/\D/g, '');
                                        usedFallback = false;
                                    }
                                }
                            } catch (permError) {
                                // Permission denied - expected for non-admins
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('[Contact] Could not fetch owner phone, using default:', error);
        }
    }
    
    // If we used the fallback, notify admin via activity log
    if (usedFallback) {
        console.warn('[Contact] FALLBACK USED: Vehicle', vehicleId, '(' + vehicleTitle + ') - Missing owner contact info');
        
        // Log to activity log if admin is logged in
        if (typeof logActivity === 'function' && auth.currentUser) {
            logActivity('contact_fallback', 'Fallback phone used for: ' + vehicleTitle + ' (ID: ' + vehicleId + ') - Owner contact info missing');
        }
        
        // Also create an admin notification in Firestore
        try {
            if (typeof db !== 'undefined') {
                await db.collection('adminNotifications').add({
                    type: 'missing_contact',
                    vehicleId: vehicleId,
                    vehicleTitle: vehicleTitle,
                    message: 'Vehicle is using fallback contact number - owner phone/agent not configured',
                    timestamp: new Date().toISOString(),
                    resolved: false
                });
            }
        } catch (notifError) {
            // Non-critical, just log it
        }
    }
    
    openModal('contactModal');
};

window.openRegisterContactModal = function() {
    closeModal('loginModal');
    
    const defaultPhone = '2057028233';
    
    $('modalTitle').textContent = 'Request New Account';
    $('modalTitle').className = 'text-3xl font-black bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent mb-4 text-center';
    $('modalVehicleName').innerHTML = `
        <label class="block text-gray-300 font-bold mb-2 text-left text-base">Account Type:</label>
        <select id="accountTypeSelect" onchange="updateRegisterMessage()" class="w-full px-4 py-3 border-2 border-gray-600 rounded-xl bg-gray-700 text-white focus:ring-2 focus:ring-cyan-500 font-medium transition">
            <option value="Seller">Seller (List Vehicles)</option>
            <option value="Buyer">Buyer (Browse Only)</option>
        </select>
    `;
    $('modalMessage').value = "Hi! I'm interested in creating a new account as a Seller. Please contact me to get started. Thank you!";
    $('modalPhone').value = defaultPhone;
    
    // Clear disclaimer for registration
    const disclaimer = $('modalDisclaimer');
    if (disclaimer) disclaimer.innerHTML = '';
    
    const accent = $('modalAccent');
    accent.className = 'bg-gradient-to-r from-cyan-900 to-blue-900 p-4 rounded-xl mb-6 text-center border border-cyan-700';
    
    openModal('contactModal');
};

// ==================== PHOTO SERVICES ====================
window.openPhotoServicesModal = function() {
    openModal('photoServicesModal');
    // Update opt-in content based on login status
    updateManagedServicesOptIn();
    
    // Reset package selection
    window.selectedPhotoPackage = null;
    
    // Reset UI state for package options
    const singleOption = document.getElementById('photoOptionSingle');
    const bundleOption = document.getElementById('photoOptionBundle');
    const singleCheck = document.getElementById('photoSingleCheck');
    const bundleCheck = document.getElementById('photoBundleCheck');
    
    if (singleOption) {
        singleOption.classList.remove('border-green-500', 'ring-2', 'ring-green-500/50');
        singleOption.classList.add('border-gray-600');
    }
    if (bundleOption) {
        bundleOption.classList.remove('ring-2', 'ring-amber-500/50');
    }
    if (singleCheck) singleCheck.classList.add('hidden');
    if (bundleCheck) bundleCheck.classList.add('hidden');
    
    // Reset the copy button state
    const btn = document.getElementById('photoServicesCopyBtn');
    if (btn) {
        btn.innerHTML = '<span>📱</span> Select a Package Above';
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
};

// Initialize photo package click handlers using event delegation
(function initPhotoPackageHandlers() {
    function setupDelegation() {
        // Use event delegation on document to catch clicks on photo package options
        document.addEventListener('click', function(e) {
            // Check if clicked element or its parent is a photo option
            const singleOption = e.target.closest('#photoOptionSingle');
            const bundleOption = e.target.closest('#photoOptionBundle');
            
            if (singleOption) {
                e.preventDefault();
                e.stopPropagation();
                window.selectPhotoPackage('single');
            } else if (bundleOption) {
                e.preventDefault();
                e.stopPropagation();
                window.selectPhotoPackage('bundle');
            }
        });
    }
    
    // Run immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupDelegation);
    } else {
        setupDelegation();
    }
})();

// Collapse photo promo bar (desktop) - shows minimal tab
window.collapsePhotoPromoBar = function() {
    const expanded = $('photoPromoExpanded');
    const collapsed = $('photoPromoCollapsed');
    if (expanded && collapsed) {
        expanded.classList.add('hidden');
        collapsed.classList.remove('hidden');
        sessionStorage.setItem('photoPromoBarCollapsed', 'true');
    }
};

// Expand photo promo bar (desktop)
window.expandPhotoPromoBar = function() {
    const expanded = $('photoPromoExpanded');
    const collapsed = $('photoPromoCollapsed');
    if (expanded && collapsed) {
        expanded.classList.remove('hidden');
        collapsed.classList.add('hidden');
        sessionStorage.removeItem('photoPromoBarCollapsed');
    }
};

// Collapse mobile photo promo bar
window.collapseMobilePhotoPromoBar = function() {
    const bar = $('mobilePhotoPromoBar');
    const collapsed = $('mobilePhotoPromoCollapsed');
    if (bar && collapsed) {
        bar.classList.add('hidden');
        collapsed.classList.remove('hidden');
        sessionStorage.setItem('mobilePhotoPromoBarCollapsed', 'true');
    }
};

// Expand mobile photo promo bar
window.expandMobilePhotoPromoBar = function() {
    const bar = $('mobilePhotoPromoBar');
    const collapsed = $('mobilePhotoPromoCollapsed');
    if (bar && collapsed) {
        bar.classList.remove('hidden');
        collapsed.classList.add('hidden');
        sessionStorage.removeItem('mobilePhotoPromoBarCollapsed');
    }
};

// Check if promo bars should be collapsed (on page load)
window.checkPhotoPromoBarState = function() {
    // Desktop
    if (sessionStorage.getItem('photoPromoBarCollapsed') === 'true') {
        const expanded = $('photoPromoExpanded');
        const collapsed = $('photoPromoCollapsed');
        if (expanded && collapsed) {
            expanded.classList.add('hidden');
            collapsed.classList.remove('hidden');
        }
    }
    // Mobile
    if (sessionStorage.getItem('mobilePhotoPromoBarCollapsed') === 'true') {
        const bar = $('mobilePhotoPromoBar');
        const collapsed = $('mobilePhotoPromoCollapsed');
        if (bar && collapsed) {
            bar.classList.add('hidden');
            collapsed.classList.remove('hidden');
        }
    }
};

// Call on page load
document.addEventListener('DOMContentLoaded', function() {
    checkPhotoPromoBarState();
});

window.updateManagedServicesOptIn = async function() {
    const container = $('optInContent');
    if (!container) return;
    
    const user = auth.currentUser;
    
    if (!user) {
        // Not logged in
        container.innerHTML = `
            <div class="text-center">
                <p class="text-gray-300 text-sm mb-3">🔒 Log in to get notified when managed services launch!</p>
                <button onclick="closeModal('photoServicesModal'); openModal('loginModal');" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
                    Log In to Opt-In
                </button>
            </div>
        `;
        return;
    }
    
    // Check if user is already opted in
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        const isOptedIn = userData?.managedServicesInterest === true;
        
        if (isOptedIn) {
            container.innerHTML = `
                <div class="text-center">
                    <div class="flex items-center justify-center gap-2 text-green-400 mb-2">
                        <span class="text-2xl">✅</span>
                        <span class="font-bold">You're on the list!</span>
                    </div>
                    <p class="text-gray-300 text-sm mb-3">We'll contact you when managed services launch.</p>
                    <button onclick="optOutManagedServices()" class="text-gray-400 hover:text-red-400 text-xs underline transition">
                        Remove me from the list
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-center">
                    <p class="text-gray-300 text-sm mb-3">🔔 Want to be notified when this launches?</p>
                    <button onclick="optInManagedServices()" class="bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-90 text-gray-900 px-6 py-3 rounded-lg font-bold transition shadow-lg flex items-center gap-2 mx-auto">
                        <span>🚀</span> Yes, I'm Interested!
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error checking opt-in status:', error);
        container.innerHTML = `<p class="text-gray-400 text-sm text-center">Error loading status</p>`;
    }
};

window.optInManagedServices = async function() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        await db.collection('users').doc(user.uid).update({
            managedServicesInterest: true,
            managedServicesOptInDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('🚀 You\'re on the list! We\'ll notify you when managed services launch.', 'success');
        updateManagedServicesOptIn();
        
        // Log to activity
        if (typeof logAdminActivity === 'function') {
            logAdminActivity('managed_services_optin', {
                email: user.email,
                username: user.displayName || user.email?.split('@')[0]
            });
        }
    } catch (error) {
        console.error('Error opting in:', error);
        showToast('Error saving preference. Please try again.', 'error');
    }
};

window.optOutManagedServices = async function() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        await db.collection('users').doc(user.uid).update({
            managedServicesInterest: false,
            managedServicesOptOutDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('You\'ve been removed from the list.', 'info');
        updateManagedServicesOptIn();
    } catch (error) {
        console.error('Error opting out:', error);
        showToast('Error saving preference. Please try again.', 'error');
    }
};

// Track selected photo package
window.selectedPhotoPackage = null;

// Select a photo package
window.selectPhotoPackage = function(packageType) {
    window.selectedPhotoPackage = packageType;
    
    const singleOption = document.getElementById('photoOptionSingle');
    const bundleOption = document.getElementById('photoOptionBundle');
    const consignmentOption = document.getElementById('consignmentOption');
    const copyBtn = document.getElementById('photoServicesCopyBtn');
    
    // Reset all options
    const allOptions = [singleOption, bundleOption, consignmentOption].filter(Boolean);
    allOptions.forEach(opt => {
        opt.classList.remove('ring-2', 'ring-green-500/50', 'ring-amber-500/50', 'border-green-500');
        if (opt.id === 'photoOptionBundle') {
            opt.classList.add('border-amber-500');
        } else {
            opt.classList.add('border-gray-600');
        }
    });
    
    // Highlight selected option
    const selectedOption = document.getElementById(
        packageType === 'single' ? 'photoOptionSingle' : 
        packageType === 'bundle' ? 'photoOptionBundle' : 'consignmentOption'
    );
    
    if (selectedOption) {
        selectedOption.classList.remove('border-gray-600');
        selectedOption.classList.add('border-green-500', 'ring-2', 'ring-green-500/50');
    }
    
    // Update button text based on selection
    if (copyBtn) {
        const buttonTexts = {
            'single': '📷 Copy Number & Request Photos',
            'bundle': '🎬 Copy Number & Request Bundle',
            'consignment': '🔑 Copy Number & Request Consignment'
        };
        copyBtn.innerHTML = buttonTexts[packageType] || 'Select an option above';
    }
};

// Alias for HTML onclick
window.selectPhotoOption = window.selectPhotoPackage;

window.copyAndNotifyPhotoServices = async function() {
    const user = auth.currentUser;
    const btn = document.getElementById('photoServicesCopyBtn');
    
    // Check if package is selected
    if (!window.selectedPhotoPackage) {
        showToast('⚠️ Please select a service option first', 'warning');
        return;
    }
    
    const packageType = window.selectedPhotoPackage;
    const packageNames = {
        'single': 'Per Photo service',
        'bundle': 'Premium Bundle',
        'consignment': 'Consignment Sales'
    };
    const packageEmojis = {
        'single': '📷',
        'bundle': '🎬',
        'consignment': '🔑'
    };
    const packageName = packageNames[packageType] || packageType;
    const packageEmoji = packageEmojis[packageType] || '📸';
    
    // Copy phone number to clipboard
    try {
        await navigator.clipboard.writeText('2057028233');
    } catch (e) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = '2057028233';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
    
    // Create notification for admin
    try {
        const userEmail = user?.email || 'Anonymous Visitor';
        const username = user?.displayName || user?.email?.split('@')[0] || 'Anonymous';
        
        // Save to Firestore photoServiceRequests collection
        await db.collection('photoServiceRequests').add({
            userEmail: userEmail,
            username: username,
            userId: user?.uid || null,
            requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
            type: packageType === 'consignment' ? 'consignment_inquiry' : 'photo_inquiry',
            packageType: packageType,
            packageName: packageName,
            status: 'pending',
            viewed: false
        });
        // Update button to show success
        if (btn) {
            btn.innerHTML = `✅ Number Copied - Text us in city!`;
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        showToast(`📱 Phone number copied! Text 205-702-8233 in city to schedule your ${packageName}`, 'success');
        
    } catch (error) {
        // Still show success for copy even if notification failed
        showToast('📱 Phone number copied! Text 205-702-8233 in city to schedule', 'success');
        if (btn) {
            btn.innerHTML = '✅ Number Copied - Text us in city!';
        }
    }
};

// Legacy function for backwards compatibility
window.copyPhotoServicePhone = function() {
    copyAndNotifyPhotoServices();
};

window.updateRegisterMessage = function() {
    const accountType = $('accountTypeSelect')?.value || 'Seller';
    $('modalMessage').value = `Hi! I'm interested in creating a new account as a ${accountType}. Please contact me to get started. Thank you!`;
};

// ==================== LIGHTBOX ====================
window.openLightbox = function(images, index) {
    state.currentImages = images;
    state.currentImageIndex = index;
    $('lightboxImage').src = images[index];
    $('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeLightbox = function() {
    $('lightbox').classList.remove('active');
    document.body.style.overflow = '';
};

window.changeImage = function(dir) {
    const len = state.currentImages.length;
    state.currentImageIndex = (state.currentImageIndex + dir + len) % len;
    $('lightboxImage').src = state.currentImages[state.currentImageIndex];
};

// Keyboard navigation for lightbox
document.addEventListener('keydown', e => {
    if (!$('lightbox').classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') changeImage(1);
    if (e.key === 'ArrowLeft') changeImage(-1);
});

// ==================== EDITABLE STAT TILE COMPONENT ====================
/**
 * Creates an interactive, editable stat tile
 * Features:
 * - Click to edit inline
 * - Optimistic UI with rollback on failure
 * - Real-time sync to Firestore
 * - Visual feedback for saving/success/error states
 */
const EditableStatTile = {
    /**
     * Render a stat tile
     * @param {Object} config - Tile configuration
     */
    render(config) {
        const { id, vehicleId, field, label, value, icon, gradient, prefix = '', suffix = '', type = 'number' } = config;
        
        return `
            <div id="tile-${id}" 
                 class="stat-tile bg-gradient-to-br ${gradient} rounded-2xl shadow-xl p-6 text-white border cursor-pointer"
                 onclick="EditableStatTile.startEdit('${id}', ${vehicleId}, '${field}', '${type}')"
                 data-vehicle-id="${vehicleId}"
                 data-field="${field}"
                 data-original-value="${value}">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-bold opacity-90">${label}</h3>
                    ${icon}
                    <span class="sync-indicator synced" id="sync-${id}">
                        <span class="dot"></span>
                        <span>Synced</span>
                    </span>
                </div>
                <div id="value-${id}" class="text-3xl font-black">
                    ${prefix}${typeof value === 'number' ? value.toLocaleString() : value}${suffix}
                </div>
                <p class="text-sm opacity-60 mt-2">Click to edit</p>
            </div>
        `;
    },
    
    /**
     * Start editing a tile
     */
    async startEdit(tileId, vehicleId, field, type) {
        const tile = $(`tile-${tileId}`);
        const valueEl = $(`value-${tileId}`);
        
        if (tile.classList.contains('editing')) return;
        
        // Get current value from Firestore (fresh read)
        const currentValue = VehicleDataService.getValue(vehicleId, field, tile.dataset.originalValue);
        
        tile.classList.add('editing');
        
        const inputType = type === 'number' ? 'number' : 'text';
        const rawValue = typeof currentValue === 'number' ? currentValue : currentValue.replace(/[$,]/g, '');
        
        valueEl.innerHTML = `
            <input type="${inputType}" 
                   id="input-${tileId}"
                   class="stat-input text-2xl"
                   value="${rawValue}"
                   onkeydown="EditableStatTile.handleKeydown(event, '${tileId}', ${vehicleId}, '${field}', '${type}')"
                   onblur="EditableStatTile.cancelEdit('${tileId}', ${vehicleId}, '${field}')">
            <div class="flex gap-2 mt-3">
                <button onclick="event.stopPropagation(); EditableStatTile.saveEdit('${tileId}', ${vehicleId}, '${field}', '${type}')" 
                        class="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg font-bold text-sm transition">
                    Save
                </button>
                <button onclick="event.stopPropagation(); EditableStatTile.cancelEdit('${tileId}', ${vehicleId}, '${field}')" 
                        class="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition">
                    Cancel
                </button>
            </div>
        `;
        
        const input = $(`input-${tileId}`);
        input.focus();
        input.select();
        
        // Prevent tile click from interfering
        input.onclick = (e) => e.stopPropagation();
    },
    
    /**
     * Handle keyboard events in edit mode
     */
    handleKeydown(event, tileId, vehicleId, field, type) {
        event.stopPropagation();
        if (event.key === 'Enter') {
            this.saveEdit(tileId, vehicleId, field, type);
        } else if (event.key === 'Escape') {
            this.cancelEdit(tileId, vehicleId, field);
        }
    },
    
    /**
     * Save the edited value
     * Implements optimistic UI with automatic rollback on failure
     */
    async saveEdit(tileId, vehicleId, field, type) {
        const tile = $(`tile-${tileId}`);
        const valueEl = $(`value-${tileId}`);
        const input = $(`input-${tileId}`);
        const syncIndicator = $(`sync-${tileId}`);
        
        if (!input) return;
        
        const newValue = type === 'number' ? parseInt(input.value, 10) : input.value;
        const originalValue = tile.dataset.originalValue;
        
        // Validation
        if (type === 'number' && (isNaN(newValue) || newValue < 0)) {
            tile.classList.add('error');
            setTimeout(() => tile.classList.remove('error'), 500);
            return;
        }
        
        // Optimistic UI update
        tile.classList.remove('editing');
        tile.classList.add('saving');
        syncIndicator.className = 'sync-indicator syncing';
        syncIndicator.innerHTML = '<span class="dot"></span><span>Saving...</span>';
        
        const displayValue = type === 'number' 
            ? `${newValue.toLocaleString()}`
            : newValue;
        valueEl.innerHTML = displayValue;
        
        try {
            // Write to Firestore (includes fresh read before write)
            await VehicleDataService.write(vehicleId, field, newValue);
            
            // Success feedback
            tile.classList.remove('saving');
            tile.classList.add('success');
            syncIndicator.className = 'sync-indicator synced';
            syncIndicator.innerHTML = '<span class="dot"></span><span>Saved!</span>';
            tile.dataset.originalValue = newValue;
            
            setTimeout(() => {
                tile.classList.remove('success');
                syncIndicator.innerHTML = '<span class="dot"></span><span>Synced</span>';
            }, 2000);
            
        } catch (error) {
            // Rollback on failure
            console.error('Save failed, rolling back:', error);
            tile.classList.remove('saving');
            tile.classList.add('error');
            syncIndicator.className = 'sync-indicator error';
            syncIndicator.innerHTML = '<span class="dot"></span><span>Error!</span>';
            
            // Restore original value
            const rollbackValue = type === 'number'
                ? `${parseInt(originalValue).toLocaleString()}`
                : originalValue;
            valueEl.innerHTML = rollbackValue;
            
            setTimeout(() => {
                tile.classList.remove('error');
                syncIndicator.className = 'sync-indicator synced';
                syncIndicator.innerHTML = '<span class="dot"></span><span>Synced</span>';
            }, 3000);
        }
    },
    
    /**
     * Cancel editing and restore original value
     */
    cancelEdit(tileId, vehicleId, field) {
        const tile = $(`tile-${tileId}`);
        const valueEl = $(`value-${tileId}`);
        
        if (!tile.classList.contains('editing')) return;
        
        tile.classList.remove('editing');
        
        const originalValue = VehicleDataService.getValue(vehicleId, field, tile.dataset.originalValue);
        const displayValue = typeof originalValue === 'number'
            ? `${originalValue.toLocaleString()}`
            : originalValue;
            
        valueEl.innerHTML = displayValue;
    }
};

// Make EditableStatTile globally accessible
window.EditableStatTile = EditableStatTile;
