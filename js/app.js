// ============================================================================
// PaulysAutos.com - Main Application
// Elite Luxury Vehicle Marketplace ($1M+)
// ============================================================================

// Global State
let vehicles = [];
let currentUser = null;
let currentFilter = 'all';
let currentVehicleId = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function $(id) {
    return document.getElementById(id);
}

function showElement(el) {
    if (el) el.classList.remove('hidden');
}

function hideElement(el) {
    if (el) el.classList.add('hidden');
}

function sanitize(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatPrice(price) {
    return '$' + Number(price).toLocaleString();
}

function showToast(message, type = 'success') {
    const toast = $('toast');
    const icon = $('toastIcon');
    const msg = $('toastMessage');
    
    icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    msg.textContent = message;
    
    showElement(toast);
    setTimeout(() => hideElement(toast), 3000);
}

function copyToClipboard(inputId) {
    const input = $(inputId);
    if (input) {
        const value = input.value || input.textContent;
        navigator.clipboard.writeText(value).then(() => {
            showToast('Copied to clipboard!');
        });
    }
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function openModal(modalId) {
    showElement($(modalId));
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    hideElement($(modalId));
    document.body.style.overflow = '';
}

function showAuthForm(form) {
    hideElement($('loginOptions'));
    hideElement($('loginForm'));
    hideElement($('registerForm'));
    
    if (form === 'login') showElement($('loginForm'));
    else if (form === 'register') showElement($('registerForm'));
    else showElement($('loginOptions'));
}

// ============================================================================
// NAVIGATION
// ============================================================================

function goHome() {
    hideElement($('dashboardSection'));
    hideElement($('vehicleDetailSection'));
    hideElement($('leaderboardSection'));
    showElement($('heroSection'));
    showElement($('vehiclesSection'));
    showElement($('about'));
    showElement($('contact'));
    window.scrollTo(0, 0);
}

function scrollToVehicles() {
    hideElement($('dashboardSection'));
    hideElement($('vehicleDetailSection'));
    hideElement($('leaderboardSection'));
    showElement($('heroSection'));
    showElement($('vehiclesSection'));
    $('vehiclesSection').scrollIntoView({ behavior: 'smooth' });
}

function showDashboard() {
    hideElement($('heroSection'));
    hideElement($('vehiclesSection'));
    hideElement($('vehicleDetailSection'));
    hideElement($('leaderboardSection'));
    hideElement($('about'));
    hideElement($('contact'));
    showElement($('dashboardSection'));
    renderDashboard();
    window.scrollTo(0, 0);
}

function showLeaderboard() {
    hideElement($('heroSection'));
    hideElement($('vehiclesSection'));
    hideElement($('dashboardSection'));
    hideElement($('vehicleDetailSection'));
    hideElement($('about'));
    hideElement($('contact'));
    showElement($('leaderboardSection'));
    renderLeaderboard();
    window.scrollTo(0, 0);
}

function toggleMobileMenu() {
    const menu = $('mobileMenu');
    menu.classList.toggle('hidden');
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function handleLogin(e) {
    e.preventDefault();
    const email = $('loginEmail').value;
    const password = $('loginPassword').value;
    const errorDiv = $('loginError');
    
    hideElement(errorDiv);
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        closeModal('loginModal');
        showToast('Welcome back!');
    } catch (error) {
        errorDiv.textContent = error.message;
        showElement(errorDiv);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = $('registerUsername').value.trim();
    const email = $('registerEmail').value;
    const phone = $('registerPhone').value.replace(/\D/g, '');
    const password = $('registerPassword').value;
    const errorDiv = $('registerError');
    
    hideElement(errorDiv);
    
    if (!username || !phone) {
        errorDiv.textContent = 'Please fill in all fields';
        showElement(errorDiv);
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Create user document
        await db.collection('users').doc(userCredential.user.uid).set({
            email: email.toLowerCase(),
            username: username,
            phone: phone,
            tier: 'starter',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            totalSales: 0,
            totalRevenue: 0
        });
        
        closeModal('loginModal');
        showToast('Account created successfully!');
    } catch (error) {
        errorDiv.textContent = error.message;
        showElement(errorDiv);
    }
}

function logout() {
    auth.signOut().then(() => {
        showToast('Logged out successfully');
        goHome();
    });
}

// Auth state listener
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    
    if (user) {
        hideElement($('authButtons'));
        showElement($('userMenu'));
        $('userMenu').classList.add('flex');
        
        // Load user data
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            $('navUsername').textContent = userData.username || user.email.split('@')[0];
            
            const tier = user.email === MASTER_ADMIN_EMAIL ? 'owner' : (userData.tier || 'starter');
            const tierData = TIERS[tier];
            $('navUserTier').textContent = tierData.icon + ' ' + tierData.name;
            $('navUserTier').className = `text-xs px-2 py-1 rounded-full text-white font-bold ${tierData.bgClass}`;
        }
    } else {
        showElement($('authButtons'));
        hideElement($('userMenu'));
        $('userMenu').classList.remove('flex');
    }
});

// ============================================================================
// VEHICLE DATA
// ============================================================================

async function loadVehicles() {
    try {
        const doc = await db.collection('settings').doc('vehicles').get();
        if (doc.exists) {
            const data = doc.data();
            vehicles = Object.entries(data).map(([id, v]) => ({ id: parseInt(id), ...v }));
            vehicles.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } else {
            vehicles = [];
        }
        applyFilters();
    } catch (error) {
        console.error('Error loading vehicles:', error);
        vehicles = [];
        applyFilters();
    }
}

// Real-time listener
function startVehicleListener() {
    db.collection('settings').doc('vehicles').onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            vehicles = Object.entries(data).map(([id, v]) => ({ id: parseInt(id), ...v }));
            vehicles.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } else {
            vehicles = [];
        }
        applyFilters();
    });
}

// ============================================================================
// FILTERING & RENDERING
// ============================================================================

function filterByCategory(category) {
    currentFilter = category;
    
    // Update button states
    document.querySelectorAll('#categoryFilters button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });
    
    applyFilters();
}

function applyFilters() {
    let filtered = [...vehicles];
    
    // Category filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(v => v.category === currentFilter);
    }
    
    // Hide sold
    if ($('hideSold')?.checked) {
        filtered = filtered.filter(v => !v.isSold);
    }
    
    // My listings
    if ($('myListings')?.checked && currentUser) {
        filtered = filtered.filter(v => v.ownerEmail === currentUser.email);
    }
    
    // Sort
    const sortBy = $('sortBy')?.value || 'newest';
    if (sortBy === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
    } else {
        // Newest first (default), but premium always on top
        filtered.sort((a, b) => {
            if (a.isPremium && !b.isPremium) return -1;
            if (!a.isPremium && b.isPremium) return 1;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
    }
    
    renderVehicles(filtered);
}

function renderVehicles(list) {
    const grid = $('vehiclesGrid');
    const emptyState = $('emptyState');
    
    $('vehicleCount').textContent = `(${list.length})`;
    
    if (list.length === 0) {
        grid.innerHTML = '';
        showElement(emptyState);
        return;
    }
    
    hideElement(emptyState);
    
    const categoryIcons = {
        car: '🚗',
        suv: '🚙',
        truck: '🚚',
        motorcycle: '🏍️',
        boat: '🚤'
    };
    
    grid.innerHTML = list.map(v => {
        const isPremium = v.isPremium;
        const isSold = v.isSold;
        const hasImage = v.images && v.images.length > 0 && v.images[0];
        const categoryIcon = categoryIcons[v.category] || '🚗';
        
        const cardClass = isPremium ? 'gold-border premium-glow' : 'border border-gray-700';
        const premiumBadge = isPremium ? `
            <div class="absolute top-0 left-0 right-0 gold-gradient text-black text-center py-1.5 font-black text-sm">
                👑 PREMIUM LISTING 👑
            </div>
        ` : '';
        const soldOverlay = isSold ? `
            <div class="unavailable-overlay">
                <div class="unavailable-text">SOLD</div>
            </div>
        ` : '';
        
        const imageHtml = hasImage 
            ? `<img src="${v.images[0]}" alt="${sanitize(v.make)}" class="w-full h-48 object-cover" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22><rect fill=%22%231a1a1a%22 width=%22400%22 height=%22300%22/><text x=%22200%22 y=%22150%22 text-anchor=%22middle%22 fill=%22%23D4AF37%22 font-size=%2260%22>🚗</text></svg>'">`
            : `<div class="w-full h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <span class="text-6xl">${categoryIcon}</span>
               </div>`;
        
        const upgradeBadge = v.isUpgraded === 'yes' ? `
            <span class="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-bold">⚡ UPGRADED</span>
        ` : '';
        
        return `
            <article class="vehicle-card bg-gray-800 rounded-2xl overflow-hidden cursor-pointer ${cardClass} relative" onclick="viewVehicle(${v.id})">
                ${premiumBadge}
                <div class="relative ${isPremium ? 'mt-8' : ''}">
                    ${soldOverlay}
                    ${imageHtml}
                    ${upgradeBadge}
                </div>
                <div class="p-5">
                    <div class="flex justify-between items-start gap-2 mb-3">
                        <h4 class="text-xl font-bold ${isPremium ? 'text-gold-400' : 'text-white'}">${sanitize(v.make)}</h4>
                        <span class="badge text-xs font-bold px-2 py-1 rounded-full uppercase">${categoryIcon} ${v.category}</span>
                    </div>
                    <p class="text-gray-400 text-sm mb-3">Plate: ${sanitize(v.plate)}</p>
                    ${v.storage ? `<p class="text-gray-500 text-sm mb-3">Storage: ${v.storage}</p>` : ''}
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-2xl font-black ${isPremium ? 'text-gold-400' : 'text-green-400'}">${formatPrice(v.price)}</span>
                    </div>
                    <button onclick="event.stopPropagation(); openContactModalForVehicle(${v.id})" class="w-full btn-gold py-3 rounded-xl font-bold ${isSold ? 'opacity-50 cursor-not-allowed' : ''}" ${isSold ? 'disabled' : ''}>
                        📞 Contact Seller
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

// ============================================================================
// VEHICLE DETAIL VIEW
// ============================================================================

function viewVehicle(id) {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return;
    
    currentVehicleId = id;
    
    hideElement($('heroSection'));
    hideElement($('vehiclesSection'));
    hideElement($('dashboardSection'));
    hideElement($('leaderboardSection'));
    hideElement($('about'));
    hideElement($('contact'));
    showElement($('vehicleDetailSection'));
    
    const isPremium = vehicle.isPremium;
    const isSold = vehicle.isSold;
    const categoryIcons = { car: '🚗', suv: '🚙', truck: '🚚', motorcycle: '🏍️', boat: '🚤' };
    const categoryIcon = categoryIcons[vehicle.category] || '🚗';
    
    const premiumBanner = isPremium ? `
        <div class="gold-gradient text-black text-center py-3 font-black text-lg">
            👑 PREMIUM LISTING 👑
        </div>
    ` : '';
    
    const soldBanner = isSold ? `
        <div class="bg-red-600 text-white text-center py-3 font-black text-lg">
            🚫 SOLD
        </div>
    ` : '';
    
    const hasImages = vehicle.images && vehicle.images.length > 0;
    const imageSection = hasImages ? `
        <div class="relative">
            <img id="mainVehicleImage" src="${vehicle.images[0]}" alt="${sanitize(vehicle.make)}" class="w-full h-64 md:h-96 object-cover">
            ${vehicle.isUpgraded === 'yes' ? '<span class="absolute top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-full font-bold">⚡ UPGRADED</span>' : ''}
        </div>
        ${vehicle.images.length > 1 ? `
            <div class="flex gap-2 p-4 overflow-x-auto hide-scrollbar bg-gray-900">
                ${vehicle.images.map((img, i) => `
                    <img src="${img}" alt="Image ${i+1}" class="w-24 h-24 object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-gold-500" onclick="document.getElementById('mainVehicleImage').src='${img}'">
                `).join('')}
            </div>
        ` : ''}
    ` : `
        <div class="w-full h-64 md:h-96 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <span class="text-8xl">${categoryIcon}</span>
        </div>
    `;
    
    const upgradePhotosSection = vehicle.isUpgraded === 'yes' && vehicle.upgradePhotos && vehicle.upgradePhotos.length > 0 ? `
        <div class="mt-6 bg-green-900/20 border border-green-600/30 rounded-xl p-4">
            <h4 class="text-green-400 font-bold mb-3">⚡ Upgrade Photos</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                ${vehicle.upgradePhotos.map(img => `
                    <img src="${img}" alt="Upgrade" class="w-full h-24 object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-green-500" onclick="window.open('${img}', '_blank')">
                `).join('')}
            </div>
        </div>
    ` : '';
    
    const canEdit = currentUser && (vehicle.ownerEmail === currentUser.email || currentUser.email === MASTER_ADMIN_EMAIL);
    const editButtons = canEdit ? `
        <div class="flex gap-2 mt-4">
            ${!isSold ? `<button onclick="openSaleContractModal(${id})" class="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold transition">📝 Generate Sale Contract</button>` : ''}
            ${!isSold ? `<button onclick="markAsSold(${id})" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold transition">✅ Mark as Sold</button>` : ''}
            <button onclick="deleteListing(${id})" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-xl font-bold transition">🗑️</button>
        </div>
    ` : '';
    
    $('vehicleDetailContent').innerHTML = `
        ${soldBanner}
        ${premiumBanner}
        ${imageSection}
        <div class="p-6 md:p-8">
            <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                    <h2 class="text-3xl md:text-4xl font-black ${isPremium ? 'text-gold-400' : 'text-white'}">${sanitize(vehicle.make)}</h2>
                    <p class="text-gray-400 mt-2">Plate: <span class="text-white font-mono">${sanitize(vehicle.plate)}</span></p>
                </div>
                <div class="text-right">
                    <span class="badge text-sm font-bold px-3 py-1 rounded-full">${categoryIcon} ${vehicle.category.toUpperCase()}</span>
                    <div class="text-3xl font-black ${isPremium ? 'text-gold-400' : 'text-green-400'} mt-2">${formatPrice(vehicle.price)}</div>
                </div>
            </div>
            
            ${vehicle.description ? `
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-gold-400 mb-2">Description</h3>
                    <p class="text-gray-300">${sanitize(vehicle.description)}</p>
                </div>
            ` : ''}
            
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-gray-800 rounded-xl p-4 text-center">
                    <div class="text-2xl mb-1">${categoryIcon}</div>
                    <div class="text-gray-400 text-sm">Category</div>
                    <div class="text-white font-bold capitalize">${vehicle.category}</div>
                </div>
                ${vehicle.storage ? `
                    <div class="bg-gray-800 rounded-xl p-4 text-center">
                        <div class="text-2xl mb-1">📦</div>
                        <div class="text-gray-400 text-sm">Storage</div>
                        <div class="text-white font-bold">${vehicle.storage}</div>
                    </div>
                ` : ''}
                <div class="bg-gray-800 rounded-xl p-4 text-center">
                    <div class="text-2xl mb-1">${vehicle.isUpgraded === 'yes' ? '⚡' : '📋'}</div>
                    <div class="text-gray-400 text-sm">Status</div>
                    <div class="text-white font-bold">${vehicle.isUpgraded === 'yes' ? 'Upgraded' : 'Stock'}</div>
                </div>
            </div>
            
            ${upgradePhotosSection}
            
            ${vehicle.videoUrl ? `
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-gold-400 mb-2">🎥 Video Tour</h3>
                    <video controls class="w-full rounded-xl" src="${vehicle.videoUrl}"></video>
                </div>
            ` : ''}
            
            <div class="flex gap-4">
                <button onclick="openContactModalForVehicle(${id})" class="flex-1 btn-gold py-4 rounded-xl font-bold text-lg ${isSold ? 'opacity-50 cursor-not-allowed' : ''}" ${isSold ? 'disabled' : ''}>
                    📞 Contact Seller
                </button>
            </div>
            
            ${editButtons}
        </div>
    `;
    
    window.scrollTo(0, 0);
}

// ============================================================================
// CREATE LISTING
// ============================================================================

// Show/hide upgrade photos based on selection
document.addEventListener('DOMContentLoaded', () => {
    const upgradeSelect = $('vehicleUpgraded');
    if (upgradeSelect) {
        upgradeSelect.addEventListener('change', (e) => {
            const section = $('upgradePhotosSection');
            if (e.target.value === 'yes') {
                showElement(section);
            } else {
                hideElement(section);
            }
        });
    }
});

async function handleCreateListing(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showToast('Please sign in to create a listing', 'error');
        return;
    }
    
    const errorDiv = $('createListingError');
    hideElement(errorDiv);
    
    const make = $('vehicleMake').value.trim();
    const plate = $('vehiclePlate').value.trim().toUpperCase();
    const category = $('vehicleCategory').value;
    const price = parseInt($('vehiclePrice').value);
    const storage = $('vehicleStorage').value ? parseInt($('vehicleStorage').value) : null;
    const isUpgraded = $('vehicleUpgraded').value;
    const description = $('vehicleDescription').value.trim();
    const imagesText = $('vehicleImages').value.trim();
    const upgradePhotosText = $('upgradePhotos')?.value.trim() || '';
    const videoUrl = $('vehicleVideo').value.trim();
    const isPremium = $('vehiclePremium').checked;
    
    // Validate
    if (!make || !plate || !category || !price) {
        errorDiv.textContent = 'Please fill in all required fields';
        showElement(errorDiv);
        return;
    }
    
    if (price < MIN_VEHICLE_PRICE) {
        errorDiv.textContent = `Minimum price is ${formatPrice(MIN_VEHICLE_PRICE)}. This is an elite marketplace.`;
        showElement(errorDiv);
        return;
    }
    
    // Parse images
    const images = imagesText ? imagesText.split('\n').map(url => url.trim()).filter(url => url) : [];
    const upgradePhotos = upgradePhotosText ? upgradePhotosText.split('\n').map(url => url.trim()).filter(url => url) : [];
    
    // Check listing limit
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data() || {};
    const tier = currentUser.email === MASTER_ADMIN_EMAIL ? 'owner' : (userData.tier || 'starter');
    const tierData = TIERS[tier];
    
    const userListings = vehicles.filter(v => v.ownerEmail === currentUser.email && !v.isSold);
    if (userListings.length >= tierData.maxListings) {
        errorDiv.textContent = `You've reached your listing limit (${tierData.maxListings}). Upgrade your tier for more listings.`;
        showElement(errorDiv);
        return;
    }
    
    try {
        // Generate new ID
        const maxId = vehicles.reduce((max, v) => Math.max(max, v.id || 0), 0);
        const newId = maxId + 1;
        
        const newVehicle = {
            make,
            plate,
            category,
            price,
            storage,
            isUpgraded,
            description,
            images,
            upgradePhotos,
            videoUrl: videoUrl || null,
            isPremium,
            isSold: false,
            ownerEmail: currentUser.email.toLowerCase(),
            ownerPhone: userData.phone || '',
            ownerUsername: userData.username || currentUser.email.split('@')[0],
            createdAt: Date.now()
        };
        
        await db.collection('settings').doc('vehicles').set({
            [newId]: newVehicle
        }, { merge: true });
        
        closeModal('createListingModal');
        showToast('Vehicle listed successfully!');
        
        // Reset form
        e.target.reset();
        hideElement($('upgradePhotosSection'));
        
    } catch (error) {
        console.error('Error creating listing:', error);
        errorDiv.textContent = 'Failed to create listing: ' + error.message;
        showElement(errorDiv);
    }
}

// ============================================================================
// CONTACT MODAL
// ============================================================================

function openContactModalForVehicle(id) {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle || vehicle.isSold) return;
    
    $('contactModalTitle').textContent = 'Contact Seller';
    $('contactModalVehicle').textContent = vehicle.make;
    $('contactPhone').value = vehicle.ownerPhone || '2057028233';
    $('contactMessage').value = `Hello! I came across your listing for ${vehicle.make} on PaulysAutos.com and I'm interested in purchasing it. Please contact me ASAP to discuss further.`;
    
    openModal('contactModal');
}

// ============================================================================
// SALE CONTRACT
// ============================================================================

function openSaleContractModal(id) {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return;
    
    currentVehicleId = id;
    
    $('contractVehicleInfo').innerHTML = `
        <strong>${sanitize(vehicle.make)}</strong><br>
        Plate: ${sanitize(vehicle.plate)}<br>
        Category: ${vehicle.category.toUpperCase()}<br>
        Listed Price: ${formatPrice(vehicle.price)}
    `;
    
    $('contractPrice').value = vehicle.price;
    $('contractDate').value = new Date().toISOString().split('T')[0];
    
    // Show upgrades if applicable
    if (vehicle.isUpgraded === 'yes' && vehicle.upgradePhotos && vehicle.upgradePhotos.length > 0) {
        showElement($('contractUpgradesSection'));
        $('contractUpgradesList').innerHTML = `
            <p class="text-green-400 font-bold mb-2">⚡ Vehicle includes upgrades (${vehicle.upgradePhotos.length} photos attached)</p>
            <div class="flex gap-2 overflow-x-auto">
                ${vehicle.upgradePhotos.map(img => `
                    <img src="${img}" class="w-16 h-16 object-cover rounded">
                `).join('')}
            </div>
        `;
    } else {
        hideElement($('contractUpgradesSection'));
    }
    
    // Pre-fill seller info if current user is owner
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).get().then(doc => {
            if (doc.exists) {
                const data = doc.data();
                $('sellerName').value = data.username || '';
                $('sellerPhone').value = data.phone || '';
            }
        });
    }
    
    openModal('saleContractModal');
}

async function generateSaleContract(e) {
    e.preventDefault();
    
    const vehicle = vehicles.find(v => v.id === currentVehicleId);
    if (!vehicle) return;
    
    const errorDiv = $('contractError');
    hideElement(errorDiv);
    
    const buyerName = $('buyerName').value.trim();
    const buyerSSN = $('buyerSSN').value.trim();
    const buyerPhone = $('buyerPhone').value.trim();
    const sellerName = $('sellerName').value.trim();
    const sellerSSN = $('sellerSSN').value.trim();
    const sellerPhone = $('sellerPhone').value.trim();
    const salePrice = parseInt($('contractPrice').value);
    const saleDate = $('contractDate').value;
    
    if (!buyerName || !buyerSSN || !buyerPhone || !sellerName || !sellerSSN || !sellerPhone || !salePrice || !saleDate) {
        errorDiv.textContent = 'Please fill in all fields';
        showElement(errorDiv);
        return;
    }
    
    // Generate contract
    const contractData = {
        vehicleId: currentVehicleId,
        vehicleMake: vehicle.make,
        vehiclePlate: vehicle.plate,
        vehicleCategory: vehicle.category,
        isUpgraded: vehicle.isUpgraded,
        upgradePhotos: vehicle.upgradePhotos || [],
        buyer: { name: buyerName, ssn: buyerSSN, phone: buyerPhone },
        seller: { name: sellerName, ssn: sellerSSN, phone: sellerPhone },
        salePrice,
        saleDate,
        createdAt: Date.now(),
        createdBy: currentUser?.email || 'unknown'
    };
    
    // Save to Firestore
    try {
        const contractRef = await db.collection('saleContracts').add(contractData);
        
        closeModal('saleContractModal');
        showContractPreview(contractData, contractRef.id);
        
    } catch (error) {
        console.error('Error saving contract:', error);
        errorDiv.textContent = 'Failed to save contract: ' + error.message;
        showElement(errorDiv);
    }
}

function showContractPreview(data, contractId) {
    const upgradesHtml = data.isUpgraded === 'yes' && data.upgradePhotos.length > 0 ? `
        <div style="margin-top: 20px; padding: 15px; background: #f0f9f0; border: 1px solid #22c55e; border-radius: 8px;">
            <h4 style="color: #16a34a; margin-bottom: 10px;">⚡ Upgrades Included</h4>
            <p>This vehicle includes ${data.upgradePhotos.length} documented upgrade(s). Photos attached to this contract.</p>
        </div>
    ` : '';
    
    $('contractPreviewContent').innerHTML = `
        <div style="font-family: 'Times New Roman', serif; color: #000;">
            <div style="text-align: center; border-bottom: 3px solid #D4AF37; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="font-size: 28px; color: #000; margin-bottom: 5px;">VEHICLE SALE CONTRACT</h1>
                <p style="color: #666; font-size: 14px;">PaulysAutos.com - Elite Luxury Vehicle Marketplace</p>
                <p style="color: #999; font-size: 12px;">Contract ID: ${contractId}</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3 style="color: #D4AF37; border-bottom: 1px solid #ddd; padding-bottom: 5px;">VEHICLE INFORMATION</h3>
                <table style="width: 100%; margin-top: 10px;">
                    <tr><td style="padding: 5px 0; color: #666;">Make/Model:</td><td style="padding: 5px 0; font-weight: bold;">${sanitize(data.vehicleMake)}</td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">Plate Number:</td><td style="padding: 5px 0; font-weight: bold;">${sanitize(data.vehiclePlate)}</td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">Category:</td><td style="padding: 5px 0; font-weight: bold;">${data.vehicleCategory.toUpperCase()}</td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">Condition:</td><td style="padding: 5px 0; font-weight: bold;">${data.isUpgraded === 'yes' ? 'UPGRADED' : 'STOCK'}</td></tr>
                </table>
            </div>
            
            <div style="display: flex; gap: 40px; margin-bottom: 30px;">
                <div style="flex: 1;">
                    <h3 style="color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 5px;">BUYER</h3>
                    <table style="width: 100%; margin-top: 10px;">
                        <tr><td style="padding: 5px 0; color: #666;">Name:</td><td style="padding: 5px 0; font-weight: bold;">${sanitize(data.buyer.name)}</td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Citizen SSN:</td><td style="padding: 5px 0; font-weight: bold;">${sanitize(data.buyer.ssn)}</td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Phone:</td><td style="padding: 5px 0; font-weight: bold;">${sanitize(data.buyer.phone)}</td></tr>
                    </table>
                </div>
                <div style="flex: 1;">
                    <h3 style="color: #16a34a; border-bottom: 1px solid #ddd; padding-bottom: 5px;">SELLER</h3>
                    <table style="width: 100%; margin-top: 10px;">
                        <tr><td style="padding: 5px 0; color: #666;">Name:</td><td style="padding: 5px 0; font-weight: bold;">${sanitize(data.seller.name)}</td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Citizen SSN:</td><td style="padding: 5px 0; font-weight: bold;">${sanitize(data.seller.ssn)}</td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Phone:</td><td style="padding: 5px 0; font-weight: bold;">${sanitize(data.seller.phone)}</td></tr>
                    </table>
                </div>
            </div>
            
            <div style="margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px;">
                <h3 style="color: #D4AF37; margin-bottom: 15px;">SALE DETAILS</h3>
                <table style="width: 100%;">
                    <tr><td style="padding: 8px 0; color: #666; font-size: 18px;">Sale Price:</td><td style="padding: 8px 0; font-weight: bold; font-size: 24px; color: #16a34a;">${formatPrice(data.salePrice)}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Date of Sale:</td><td style="padding: 8px 0; font-weight: bold;">${data.saleDate}</td></tr>
                </table>
            </div>
            
            ${upgradesHtml}
            
            <div style="margin-top: 30px; padding: 20px; background: #fffbeb; border: 1px solid #D4AF37; border-radius: 8px;">
                <h4 style="color: #92400e; margin-bottom: 10px;">TERMS & CONDITIONS</h4>
                <ol style="color: #666; font-size: 12px; line-height: 1.8; padding-left: 20px;">
                    <li>The Seller agrees to transfer full ownership of the above vehicle to the Buyer upon receipt of the agreed sale price.</li>
                    <li>The Buyer acknowledges they have inspected the vehicle and accepts it in its current condition.</li>
                    <li>Both parties agree that this contract is legally binding and can be used as evidence in any legal proceedings.</li>
                    <li>Any disputes arising from this sale shall be resolved through proper legal channels in-city.</li>
                    <li>This contract was generated through PaulysAutos.com and serves as proof of agreement between both parties.</li>
                </ol>
            </div>
            
            <div style="margin-top: 40px; display: flex; gap: 40px;">
                <div style="flex: 1; text-align: center;">
                    <div style="border-top: 2px solid #000; margin-top: 60px; padding-top: 10px;">
                        <p style="font-weight: bold; margin-bottom: 5px;">BUYER SIGNATURE</p>
                        <p style="color: #666; font-size: 12px;">${sanitize(data.buyer.name)}</p>
                    </div>
                </div>
                <div style="flex: 1; text-align: center;">
                    <div style="border-top: 2px solid #000; margin-top: 60px; padding-top: 10px;">
                        <p style="font-weight: bold; margin-bottom: 5px;">SELLER SIGNATURE</p>
                        <p style="color: #666; font-size: 12px;">${sanitize(data.seller.name)}</p>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 40px; text-align: center; color: #999; font-size: 11px;">
                <p>Generated by PaulysAutos.com | Contract ID: ${contractId}</p>
                <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
    
    openModal('contractPreviewModal');
}

function printContract() {
    const content = $('contractPreviewContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Vehicle Sale Contract - PaulysAutos.com</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ============================================================================
// MARK AS SOLD / DELETE
// ============================================================================

async function markAsSold(id) {
    if (!confirm('Mark this vehicle as SOLD? This will remove it from active listings.')) return;
    
    try {
        await db.collection('settings').doc('vehicles').update({
            [`${id}.isSold`]: true,
            [`${id}.soldAt`]: Date.now()
        });
        
        // Update user stats
        const vehicle = vehicles.find(v => v.id === id);
        if (vehicle) {
            const userQuery = await db.collection('users').where('email', '==', vehicle.ownerEmail).get();
            if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                const userData = userDoc.data();
                await userDoc.ref.update({
                    totalSales: (userData.totalSales || 0) + 1,
                    totalRevenue: (userData.totalRevenue || 0) + vehicle.price
                });
            }
        }
        
        showToast('Vehicle marked as sold!');
        goHome();
    } catch (error) {
        console.error('Error marking as sold:', error);
        showToast('Failed to update listing', 'error');
    }
}

async function deleteListing(id) {
    if (!confirm('Are you sure you want to DELETE this listing? This cannot be undone.')) return;
    
    try {
        await db.collection('settings').doc('vehicles').update({
            [id]: firebase.firestore.FieldValue.delete()
        });
        
        showToast('Listing deleted');
        goHome();
    } catch (error) {
        console.error('Error deleting listing:', error);
        showToast('Failed to delete listing', 'error');
    }
}

// ============================================================================
// DASHBOARD
// ============================================================================

function renderDashboard() {
    if (!currentUser) return;
    
    const myVehicles = vehicles.filter(v => v.ownerEmail === currentUser.email);
    const active = myVehicles.filter(v => !v.isSold);
    const sold = myVehicles.filter(v => v.isSold);
    const totalValue = active.reduce((sum, v) => sum + v.price, 0);
    
    $('dashMyListings').textContent = myVehicles.length;
    $('dashSold').textContent = sold.length;
    $('dashActive').textContent = active.length;
    $('dashTotalValue').textContent = formatPrice(totalValue);
    
    const grid = $('myListingsGrid');
    
    if (myVehicles.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-4xl mb-4">🚗</div>
                <p class="text-gray-400">You don't have any listings yet.</p>
                <button onclick="openModal('createListingModal')" class="btn-gold px-6 py-3 rounded-xl font-bold mt-4">
                    + Create Your First Listing
                </button>
            </div>
        `;
        return;
    }
    
    const categoryIcons = { car: '🚗', suv: '🚙', truck: '🚚', motorcycle: '🏍️', boat: '🚤' };
    
    grid.innerHTML = myVehicles.map(v => {
        const categoryIcon = categoryIcons[v.category] || '🚗';
        const statusBadge = v.isSold 
            ? '<span class="bg-red-600 text-white text-xs px-2 py-1 rounded-full">SOLD</span>'
            : '<span class="bg-green-600 text-white text-xs px-2 py-1 rounded-full">ACTIVE</span>';
        const premiumBadge = v.isPremium ? '<span class="bg-gold-500 text-black text-xs px-2 py-1 rounded-full ml-1">👑 PREMIUM</span>' : '';
        
        return `
            <div class="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-700 transition" onclick="viewVehicle(${v.id})">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="text-white font-bold">${sanitize(v.make)}</h4>
                        <p class="text-gray-400 text-sm">${categoryIcon} ${v.category}</p>
                    </div>
                    <div class="text-right">
                        ${statusBadge}${premiumBadge}
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gold-400 font-bold">${formatPrice(v.price)}</span>
                    <span class="text-gray-500 text-sm">Plate: ${sanitize(v.plate)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// LEADERBOARD
// ============================================================================

async function renderLeaderboard() {
    const content = $('leaderboardContent');
    content.innerHTML = '<div class="text-center py-8"><div class="text-4xl animate-pulse">🏆</div><p class="text-gray-400 mt-2">Loading leaderboard...</p></div>';
    
    try {
        const usersSnapshot = await db.collection('users').orderBy('totalRevenue', 'desc').limit(20).get();
        
        if (usersSnapshot.empty) {
            content.innerHTML = '<div class="text-center py-8"><p class="text-gray-400">No sales yet. Be the first!</p></div>';
            return;
        }
        
        let rank = 0;
        let html = '<div class="space-y-3">';
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            if (!user.totalRevenue || user.totalRevenue === 0) return;
            
            rank++;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
            const tier = user.email === MASTER_ADMIN_EMAIL ? 'owner' : (user.tier || 'starter');
            const tierData = TIERS[tier];
            
            html += `
                <div class="flex items-center justify-between bg-gray-800 rounded-xl p-4 ${rank <= 3 ? 'gold-border' : ''}">
                    <div class="flex items-center space-x-4">
                        <span class="text-2xl font-bold ${rank <= 3 ? 'text-gold-400' : 'text-gray-500'}">${medal}</span>
                        <div>
                            <p class="text-white font-bold">${sanitize(user.username || 'Unknown')}</p>
                            <p class="text-gray-400 text-sm">${tierData.icon} ${tierData.name} • ${user.totalSales || 0} sales</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-gold-400 font-bold text-lg">${formatPrice(user.totalRevenue || 0)}</p>
                        <p class="text-gray-500 text-xs">Total Revenue</p>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        if (rank === 0) {
            content.innerHTML = '<div class="text-center py-8"><p class="text-gray-400">No sales yet. Be the first!</p></div>';
        } else {
            content.innerHTML = html;
        }
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        content.innerHTML = '<div class="text-center py-8"><p class="text-red-400">Failed to load leaderboard</p></div>';
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[PaulysAutos] Initializing...');
    loadVehicles();
    startVehicleListener();
    console.log('[PaulysAutos] Ready!');
});

console.log('[PaulysAutos] App loaded');
