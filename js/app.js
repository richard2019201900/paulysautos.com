// ==================== FIVEM / LB-PHONE DETECTION ====================
// Auto-detect FiveM CEF browser environment and load compatibility styles
(function() {
    'use strict';
    
    // Detection methods for FiveM/CEF environment
    var isFiveM = (
        typeof GetParentResourceName === 'function' ||
        typeof invokeNative === 'function' ||
        (typeof navigator !== 'undefined' && (
            navigator.userAgent.indexOf('CitizenFX') !== -1 ||
            navigator.userAgent.indexOf('FiveM') !== -1
        ))
    );
    
    // Detection for lb-phone browser (runs inside iframe in FiveM)
    var isLbPhone = (
        window.parent !== window ||
        (document.referrer && document.referrer.indexOf('lb-phone') !== -1) ||
        window.location.href.indexOf('lb-phone') !== -1
    );
    
    // Additional CEF detection - check for missing features
    var isCEF = (
        typeof window.chrome !== 'undefined' &&
        !window.chrome.runtime
    );
    
    // Check for backdrop-filter support (CEF often lacks this)
    var hasBackdropFilter = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('backdrop-filter', 'blur(10px)');
    
    // Apply FiveM mode if detected
    if (isFiveM || isLbPhone || (isCEF && !hasBackdropFilter)) {
        console.log('[FiveM Compat] FiveM/lb-phone environment detected, loading compatibility styles');
        
        // Add class to document for CSS targeting
        document.documentElement.classList.add('fivem-mode');
        
        // Load compatibility stylesheet
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/fivem-compat.css';
        link.id = 'fivem-compat-css';
        document.head.appendChild(link);
        
        // Store detection result globally
        window.isFiveMMode = true;
    } else {
        window.isFiveMMode = false;
    }
})();

// ==================== DATE HELPER ====================
// Parse date string (YYYY-MM-DD) as local time, not UTC
window.parseLocalDate = function(dateStr) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// Format date for display
window.formatDate = function(dateStr, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
    const date = parseLocalDate(dateStr);
    return date ? date.toLocaleDateString('en-US', options) : '';
}

// ==================== VIEW PROPERTY ====================
window.viewProperty = function(id) {
    const p = properties.find(prop => prop.id === id);
    if (!p) return;
    
    // Save scroll position before navigating away
    window.savedScrollPosition = window.scrollY || window.pageYOffset;
    
    state.currentPropertyId = id;
    state.currentImages = p.images || [];
    
    // Check if property has valid images
    const hasImages = p.images && Array.isArray(p.images) && p.images.length > 0;
    const firstImage = hasImages ? p.images[0] : '';
    
    // Get premium status early for all styling
    const isPremium = PropertyDataService.getValue(id, 'isPremium', p.isPremium || false);
    
    // Image placeholder HTML
    const imagePlaceholder = `
        <div class="w-full h-60 md:h-80 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex flex-col items-center justify-center rounded-xl shadow-lg border border-gray-600">
            <span class="text-7xl mb-4">🚗</span>
            <span class="text-gray-400 font-semibold text-lg">Photos Coming Soon</span>
            <span class="text-gray-500 text-sm mt-1">Check back later for vehicle images</span>
        </div>
    `;
    
    // Image error handler
    const imgErrorHandler = "this.onerror=null; this.style.display='none'; this.insertAdjacentHTML('afterend', `<div class='w-full h-60 md:h-80 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex flex-col items-center justify-center rounded-xl shadow-lg border border-gray-600'><span class='text-7xl mb-4'>🚗</span><span class='text-gray-400 font-semibold text-lg'>Photo Unavailable</span></div>`);";
    
    hideElement($('renterSection'));
    hideElement($('ownerDashboard'));
    hideElement($('vehicleStatsPage'));
    hideElement($('leaderboardPage'));
    hideElement($('blogPage'));
    showElement($('vehicleDetailPage'));
    
    // Update navigation counter
    if (typeof updatePropertyNavCounter === 'function') {
        updatePropertyNavCounter();
    }
    
    const luxuryFeatures = p.features ? `
        <div class="bg-gradient-to-br from-amber-900 via-orange-900 to-red-900 p-6 md:p-10 rounded-2xl md:rounded-3xl mb-8 border-2 md:border-4 border-amber-700 shadow-2xl">
            <h3 class="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mb-6 md:mb-8 flex items-center">
                <svg class="w-8 h-8 md:w-10 md:h-10 text-amber-400 mr-3 md:mr-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                Luxury Estate Features
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                ${[
                    {icon:'Fish', title:'500-Gallon Aquarium', desc:'Giant indoor aquarium with exotic marine life'},
                    {icon:'Kitchen', title:'Outdoor Kitchen', desc:'Professional-grade outdoor cooking station'},
                    {icon:'Pool', title:'Infinity Pool', desc:'Stunning infinity edge pool with ocean views'},
                    {icon:'Helicopter', title:'Helicopter Pad', desc:'Private landing pad for ultimate convenience'}
                ].map(f => `
                    <div class="flex items-start space-x-3 md:space-x-4 bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-amber-600/30">
                        <div class="text-3xl md:text-5xl">${f.icon}</div>
                        <div><h4 class="text-lg md:text-xl font-black text-white mb-1">${f.title}</h4><p class="text-gray-300 font-medium text-sm md:text-base">${f.desc}</p></div>
                    </div>
                `).join('')}
                <div class="flex items-start space-x-3 md:space-x-4 bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl md:col-span-2 border border-amber-600/30">
                    <div class="text-3xl md:text-5xl">Road</div>
                    <div><h4 class="text-lg md:text-xl font-black text-white mb-1">Private Driveway</h4><p class="text-gray-300 font-medium text-sm md:text-base">Long, gated driveway ensuring complete privacy and exclusivity</p></div>
                </div>
            </div>
        </div>` : '';

    // Generate owner tabs if user is owner of this property
    const ownerTabs = (state.currentUser === 'owner' && ownsProperty(id)) ? `
        <div class="flex border-b border-gray-700">
            <button onclick="viewProperty(${id})" class="flex-1 py-4 px-6 text-center font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 border-b-2 border-purple-400">
                <svg class="w-5 h-5 inline-block mr-2 -mt-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
                Vehicle View
            </button>
            <button onclick="viewPropertyStats(${id})" class="flex-1 py-4 px-6 text-center font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition">
                <svg class="w-5 h-5 inline-block mr-2 -mt-1" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                Owner Stats
            </button>
        </div>` : '';

    // Premium badge for images section
    const premiumImageBadge = isPremium 
        ? '<div class="absolute top-4 left-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2"><span>👑</span> Premium</div>' 
        : '';

    // Build images section - horizontal scroll layout with large main image and thumbnails below
    const imagesSection = hasImages 
        ? `<div class="relative p-4 md:p-6">
            ${premiumImageBadge}
            <!-- Main large image -->
            <div class="mb-4">
                <img src="${p.images[0]}" alt="${sanitize(p.title)} - Main Image" onclick="openLightbox(state.currentImages, 0)" class="img-clickable w-full h-72 md:h-[500px] object-cover rounded-xl shadow-lg border border-gray-600" loading="lazy" onerror="${imgErrorHandler}">
            </div>
            <!-- Horizontal scroll thumbnails -->
            ${p.images.length > 1 ? `
            <div class="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                ${p.images.slice(1).map((img, i) => `
                    <div class="flex-shrink-0">
                        <img src="${img}" alt="${sanitize(p.title)} - Image ${i+2}" onclick="openLightbox(state.currentImages, ${i+1})" class="img-clickable h-48 md:h-64 w-72 md:w-96 object-cover rounded-xl shadow-lg border border-gray-600 hover:border-purple-500 transition" loading="lazy" onerror="${imgErrorHandler}">
                    </div>
                `).join('')}
            </div>
            ` : ''}
           </div>`
        : `<div class="relative p-4 md:p-6">
            ${premiumImageBadge}
            <div class="md:col-span-2 w-full h-72 md:h-96 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex flex-col items-center justify-center rounded-xl shadow-lg border border-gray-600">
                <span class="text-8xl mb-4">🚗</span>
                <span class="text-gray-400 font-semibold text-xl">Photos Coming Soon</span>
                <span class="text-gray-500 text-sm mt-2">Check back later for vehicle images</span>
            </div>
           </div>`;
    
    // Video poster - use first image or empty
    const videoPoster = firstImage || '';

    // Premium styling - apply to container
    const detailContainer = $('vehicleDetailContent');
    if (detailContainer) {
        if (isPremium) {
            detailContainer.className = 'glass-effect rounded-2xl shadow-2xl overflow-hidden border-2 border-amber-500 ring-2 ring-amber-500/50 shadow-amber-500/30';
        } else {
            detailContainer.className = 'glass-effect rounded-2xl shadow-2xl overflow-hidden';
        }
    }

    // Premium banner for top of page - same style as Owner Stats
    // Note: rounded-t-2xl for top corners when there are no owner tabs above
    const premiumBanner = isPremium 
        ? `<div class="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-gray-900 text-center py-2 font-black text-sm tracking-wider flex items-center justify-center gap-2">
            <span>👑</span> PREMIUM LISTING <span>👑</span>
           </div>` 
        : '';

    $('vehicleDetailContent').innerHTML = `
        ${premiumBanner}
        ${ownerTabs}
        ${p.videoUrl ? `
        <div class="p-4 md:p-6 bg-gradient-to-r from-red-900 to-pink-900 border-b border-gray-700">
            <div class="flex items-center space-x-3 mb-4">
                <svg class="w-6 h-6 md:w-8 md:h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg>
                <h3 class="text-xl md:text-2xl font-black text-white">Virtual Video Tour</h3>
            </div>
            <video controls autoplay muted playsinline class="w-full rounded-xl shadow-2xl border border-gray-600" ${videoPoster ? `poster="${videoPoster}"` : ''}>
                <source src="${p.videoUrl}" type="video/mp4">
            </video>
        </div>` : ''}
        ${imagesSection}
        <div class="p-5 md:p-8">
            <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                    <h2 class="text-2xl md:text-4xl font-black text-white mb-2">✨ ${sanitize(p.title)}</h2>
                    <p class="text-lg md:text-xl text-gray-300 font-semibold">📝 Description: ${sanitize(p.location)}</p>
                    <p id="propertyOwnerDisplay" class="text-blue-400 font-semibold mt-1">👤 Owner: Loading...</p>
                </div>
                <span class="badge text-white text-sm font-bold px-4 py-2 rounded-full uppercase">${PropertyDataService.getValue(id, 'type', p.type)}</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-8">
                ${[
                    {icon:'🔖', val:PropertyDataService.getValue(id, 'plate', p.plate) || 'N/A', label:'Plate'},
                    {icon:'🔧', val:PropertyDataService.getValue(id, 'upgrades', p.upgrades) || 'N/A', label:'Upgrades'},
                    {icon:'⚡', val:PropertyDataService.getValue(id, 'speed', p.speed) || 'N/A', label:'Speed'},
                    {icon:'📦', val:PropertyDataService.getValue(id, 'storage', p.storage) || 'N/A', label:'Storage'},
                    {icon:'💺', val:PropertyDataService.getValue(id, 'seats', p.seats) || 'N/A', label:'Seats'},
                    {icon:'💰', val:'$' + (PropertyDataService.getValue(id, 'buyPrice', p.buyPrice) || 0).toLocaleString(), label:'Price'}
                ].map(s => `
                    <div class="text-center p-3 md:p-4 bg-gray-700 rounded-xl border border-gray-600">
                        <div class="text-2xl md:text-3xl mb-2">${s.icon}</div>
                        <div class="text-lg md:text-xl font-bold text-white">${s.val}</div>
                        <div class="text-xs md:text-sm text-gray-300 font-semibold">${s.label}</div>
                    </div>
                `).join('')}
            </div>
            ${luxuryFeatures}
            <div class="bg-gray-800 p-5 md:p-8 rounded-2xl mb-8 border border-gray-700">
                <h3 class="text-xl font-bold text-white mb-4">💰 Price</h3>
                ${(() => {
                    const buyPrice = PropertyDataService.getValue(id, 'buyPrice', p.buyPrice || 0);
                    
                    let html = '<div class="flex justify-center">';
                    
                    if (buyPrice > 0) {
                        html += '<div class="bg-gradient-to-br from-amber-600/20 to-orange-700/20 border-2 border-amber-500 rounded-xl p-6 text-center max-w-md w-full">';
                        html += '<div class="text-amber-400 text-sm font-bold mb-2">🚗 VEHICLE PRICE</div>';
                        html += '<div class="text-amber-400 text-3xl md:text-4xl font-black">$' + buyPrice.toLocaleString() + '</div>';
                        html += '<div class="text-amber-400/60 text-sm mt-2">+$25k one-time city sales fee</div>';
                        html += '</div>';
                    } else {
                        html += '<div class="text-gray-400 text-center p-4">Price not set</div>';
                    }
                    
                    html += '</div>';
                    return html;
                })()}
            </div>
            <button id="offerPurchaseBtn" onclick="openContactModal('offer', '${sanitize(p.title)}', ${id})" class="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-black text-lg md:text-xl hover:opacity-90 transition shadow-lg">📞 Contact Seller</button>
        </div>`;
    
    // Load and display owner username with tier badge
    getPropertyOwnerWithTier(id).then(ownerInfo => {
        const ownerEl = $('propertyOwnerDisplay');
        if (ownerEl) {
            const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
            
            // Use different label based on whether property is managed by agent
            if (ownerInfo.isManaged) {
                // Managed by agent - show agent info, hide actual owner from public
                if (isAdmin) {
                    ownerEl.innerHTML = `${ownerInfo.display} <button onclick="openReassignModal(${id})" class="ml-2 text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded transition">✏️ Change Owner</button>`;
                } else {
                    ownerEl.innerHTML = ownerInfo.display;
                }
            } else {
                // No agent - show owner
                if (isAdmin) {
                    ownerEl.innerHTML = `👤 Owner: ${ownerInfo.display} <button onclick="openReassignModal(${id})" class="ml-2 text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded transition">✏️ Change</button>`;
                } else {
                    ownerEl.innerHTML = `👤 Owner: ${ownerInfo.display}`;
                }
            }
        }
    });
    
    window.scrollTo(0, 0);
};

// Navigate to property page and highlight the offer button
window.viewPropertyAndHighlightOffers = function(id) {
    viewProperty(id);
    
    // Wait for DOM to update, then highlight the offer button
    setTimeout(() => {
        const purchaseBtn = $('offerPurchaseBtn');
        
        if (purchaseBtn) {
            // Add highlight animation class
            const highlightClass = 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-gray-900 animate-pulse';
            
            purchaseBtn.className += ' ' + highlightClass;
            
            // Scroll to button
            purchaseBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add a tooltip/label
            const tipHtml = `
                <div id="offerTip" class="bg-yellow-500 text-gray-900 font-bold px-4 py-2 rounded-lg mb-4 text-center animate-bounce shadow-lg">
                    👇 Contact the seller below 👇
                </div>
            `;
            purchaseBtn.insertAdjacentHTML('beforebegin', tipHtml);
            
            // Remove highlight after 5 seconds
            setTimeout(() => {
                purchaseBtn.className = purchaseBtn.className.replace(/ ring-4 ring-yellow-400 ring-offset-2 ring-offset-gray-900 animate-pulse/g, '');
                const tip = $('offerTip');
                if (tip) tip.remove();
            }, 5000);
        }
    }, 100);
};

// ==================== PROPERTY STATS PAGE ====================
/**
 * Renders the property stats page with EDITABLE tiles
 * All editable fields sync in real-time with Firestore
 */
window.viewPropertyStats = async function(id) {
    const p = properties.find(prop => prop.id === id);
    if (!p) {
        console.error('[viewPropertyStats] Property not found:', id);
        return;
    }
    
    // Check if owner owns this property
    if (!ownsProperty(id)) {
        console.warn('[viewPropertyStats] Access denied for property:', id);
        alert('You do not have access to this property.');
        return;
    }
    state.currentPropertyId = id;
    state.currentImages = p.images;
    
    // Fetch fresh data from Firestore and sync to local properties array
    try {
        const freshData = await PropertyDataService.read(id);
        if (freshData.exists) {
            // Data is automatically synced to properties array by PropertyDataService.read()
            // Debug log removed
        }
    } catch (error) {
        console.error('Error fetching property data:', error);
    }
    
    // Set up real-time listener for all properties
    PropertyDataService.subscribeAll((data) => {
        // Re-render when data changes from another source
        if (state.currentPropertyId === id) {
            renderPropertyStatsContent(id);
            loadStatsOwnerName(id);
        }
    });
    
    // Note: Property deletion notifications are handled by the global listener
    // in setupGlobalPropertiesListener() which watches the propertyDeletions collection
    // filtered by the logged-in user's email - so only the OWNER sees the notification
    
    renderPropertyStatsContent(id);
    loadStatsOwnerName(id);
    
    // Load property analytics (async - will populate the analytics section)
    setTimeout(() => {
        if (typeof renderPropertyAnalytics === 'function') {
            renderPropertyAnalytics(id);
        }
    }, 100);
    
    hideElement($('ownerDashboard'));
    hideElement($('renterSection'));
    hideElement($('vehicleDetailPage'));
    hideElement($('leaderboardPage'));
    hideElement($('blogPage'));
    showElement($('vehicleStatsPage'));
    window.scrollTo(0, 0);
    
    // Update stats navigation counter
    if (typeof updateStatsNavCounter === 'function') {
        updateStatsNavCounter();
    }
};

// Load owner name for stats page (always shows real owner, not anonymized)
async function loadStatsOwnerName(propertyId) {
    const ownerEl = $(`stats-owner-${propertyId}`);
    if (!ownerEl) return;
    
    try {
        // Use tier-aware username lookup with forceShowOwner to bypass agent anonymization
        const ownerInfo = await getPropertyOwnerWithTier(propertyId, { forceShowOwner: true });
        const spanEl = ownerEl.querySelector('span');
        if (spanEl) {
            spanEl.textContent = ownerInfo.display;
        }
    } catch (error) {
        console.error('Error loading owner name:', error);
        const ownerEmail = propertyOwnerEmail[propertyId];
        const spanEl = ownerEl.querySelector('span');
        if (spanEl) {
            spanEl.textContent = ownerEmail ? ownerEmail.split('@')[0] : 'Unknown';
        }
    }
}

/**
 * Renders the property stats content with editable tiles
 */
function renderPropertyStatsContent(id) {
    const p = properties.find(prop => prop.id === id);
    if (!p) return;
    
    const isAvailable = state.availability[id] !== false;
    const statusClass = isAvailable ? 'from-green-600 to-emerald-600' : 'from-red-600 to-pink-600';
    const statusText = isAvailable ? 'Available' : 'Sold';
    
    // Get premium status
    const isPremium = PropertyDataService.getValue(id, 'isPremium', p.isPremium || false);
    const isPremiumTrial = PropertyDataService.getValue(id, 'isPremiumTrial', p.isPremiumTrial || false);
    const premiumStartDate = PropertyDataService.getValue(id, 'premiumStartDate', p.premiumStartDate || '');
    const premiumLastPayment = PropertyDataService.getValue(id, 'premiumLastPayment', p.premiumLastPayment || '');
    
    // Calculate premium next due date (weekly)
    let premiumNextDue = '';
    let premiumDaysUntilDue = null;
    if (isPremium && !isPremiumTrial && premiumLastPayment) {
        const lastDate = parseLocalDate(premiumLastPayment);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 7); // Weekly premium fee
        premiumNextDue = nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        nextDate.setHours(0, 0, 0, 0);
        premiumDaysUntilDue = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
    }
    
    // Get effective values (overrides or defaults) - Benny's app style
    const plate = PropertyDataService.getValue(id, 'plate', p.plate || '');
    const upgrades = PropertyDataService.getValue(id, 'upgrades', p.upgrades || '');
    const speed = PropertyDataService.getValue(id, 'speed', p.speed || '');
    const storage = PropertyDataService.getValue(id, 'storage', p.storage || '');
    const seats = PropertyDataService.getValue(id, 'seats', p.seats || '');
    const propertyType = PropertyDataService.getValue(id, 'type', p.type);
    const buyPrice = PropertyDataService.getValue(id, 'buyPrice', p.buyPrice || 0);
    
    // Legacy price variables (for backwards compatibility with existing code)
    const dailyPrice = PropertyDataService.getValue(id, 'dailyPrice', p.dailyPrice || 0);
    const weeklyPrice = PropertyDataService.getValue(id, 'weeklyPrice', p.weeklyPrice || 0);
    const biweeklyPrice = PropertyDataService.getValue(id, 'biweeklyPrice', p.biweeklyPrice || 0);
    const monthlyPrice = PropertyDataService.getValue(id, 'monthlyPrice', p.monthlyPrice || 0);
    
    // Renter & Payment info
    const renterName = PropertyDataService.getValue(id, 'renterName', p.renterName || '');
    const renterPhoneRaw = PropertyDataService.getValue(id, 'renterPhone', p.renterPhone || '');
    const renterPhone = renterPhoneRaw ? renterPhoneRaw.replace(/\D/g, '') : '';
    const renterNotes = PropertyDataService.getValue(id, 'renterNotes', p.renterNotes || '');
    const paymentFrequency = PropertyDataService.getValue(id, 'paymentFrequency', p.paymentFrequency || '');
    const lastPaymentDate = PropertyDataService.getValue(id, 'lastPaymentDate', p.lastPaymentDate || '');
    
    // DEBUG: Log property render (without sensitive renter data)
    // Debug log removed
    
    // NOTE: Removed AUTO-FIX logic that was causing race conditions with lease completion
    // The availability status should be explicitly managed via toggleAvailability/saveAvailability
    // and the completeLease flow, not auto-corrected based on potentially stale data
    
    // Calculate next due date and days until due
    let nextDueDate = '';
    let daysUntilDue = null;
    let reminderScript = '';
    
    // Check for active RTO
    const hasActiveRTO = PropertyDataService.getValue(id, 'hasActiveRTO', p.hasActiveRTO || false);
    const rtoCurrentPayment = PropertyDataService.getValue(id, 'rtoCurrentPayment', p.rtoCurrentPayment || 0);
    const rtoTotalPayments = PropertyDataService.getValue(id, 'rtoTotalPayments', p.rtoTotalPayments || 0);
    const rtoPaymentInfo = hasActiveRTO ? ` (Payment ${rtoCurrentPayment + 1} of ${rtoTotalPayments} - Rent-to-Own)` : '';
    
    // Check if property is sold
    const isSold = PropertyDataService.getValue(id, 'isSold', p.isSold || false);
    const soldTo = PropertyDataService.getValue(id, 'soldTo', p.soldTo || '');
    const soldDate = PropertyDataService.getValue(id, 'soldDate', p.soldDate || '');
    const soldPrice = PropertyDataService.getValue(id, 'soldPrice', p.soldPrice || 0);
    
    // Check if user can access RTO (Elite or Admin only)
    const isRTOAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    const isRTOElite = state.userTier === 'elite';
    const canAccessRTO = isRTOAdmin || isRTOElite;
    
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
        nextDueDate = nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        nextDate.setHours(0, 0, 0, 0);
        daysUntilDue = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
        
        // Generate reminder script if 1 day away or overdue
        // Determine amount based on frequency
        const biweeklyPrice = PropertyDataService.getValue(id, 'biweeklyPrice', p.biweeklyPrice || 0);
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
            amountDue = weeklyPrice * 2;
        } else if (paymentFrequency === 'monthly') {
            amountDue = weeklyPrice * 4;
        }
        
        if (renterName && daysUntilDue <= 1) {
            if (daysUntilDue === 1) {
                reminderScript = `Hey ${renterName}! 👋 Just a friendly reminder that your ${paymentFrequency} rent payment of $${amountDue.toLocaleString()}${rtoPaymentInfo} is due tomorrow (${nextDueDate}). Let me know if you have any questions!`;
            } else if (daysUntilDue === 0) {
                reminderScript = `Hey ${renterName}! 👋 Just a friendly reminder that your ${paymentFrequency} rent payment of $${amountDue.toLocaleString()}${rtoPaymentInfo} is due today (${nextDueDate}). Let me know if you have any questions!`;
            } else {
                const daysOverdue = Math.abs(daysUntilDue);
                if (daysOverdue >= 3) {
                    // 3+ days overdue - eviction warning
                    reminderScript = `Hey ${renterName}, your ${paymentFrequency} rent payment of $${amountDue.toLocaleString()}${rtoPaymentInfo} was due on ${nextDueDate} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago). ⚠️ You are scheduled for eviction in 24 hours if payment is not received. Please make your payment immediately or contact me to discuss your situation.`;
                } else {
                    reminderScript = `Hey ${renterName}, your ${paymentFrequency} rent payment of $${amountDue.toLocaleString()}${rtoPaymentInfo} was due on ${nextDueDate} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago). Please make your payment as soon as possible. Let me know if you need to discuss anything!`;
                }
            }
        }
    }
    
    const showReminderSection = renterName && (daysUntilDue !== null && daysUntilDue <= 1);
    
    // Premium styling - apply to container (same approach as Vehicle View)
    const statsContainer = $('vehicleStatsContent');
    if (statsContainer) {
        if (isPremium) {
            statsContainer.className = 'glass-effect rounded-2xl shadow-2xl overflow-hidden border-2 border-amber-500 ring-2 ring-amber-500/50 shadow-amber-500/30';
        } else {
            statsContainer.className = 'glass-effect rounded-2xl shadow-2xl overflow-hidden';
        }
    }
    
    // Premium banner inside container (same as Vehicle View)
    const premiumBanner = isPremium 
        ? `<div class="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-gray-900 text-center py-2 font-black text-sm tracking-wider flex items-center justify-center gap-2">
            <span>👑</span> PREMIUM LISTING <span>👑</span>
           </div>` 
        : '';
    
    // Sold banner - unique celebration style
    const soldBanner = isSold 
        ? `<div class="relative overflow-hidden bg-gradient-to-r from-rose-600 via-pink-500 to-rose-600 text-white text-center py-3 font-black text-sm tracking-wider">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.1\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
            <div class="relative flex items-center justify-center gap-3">
                <span class="text-2xl">🏆</span>
                <span class="text-lg">SOLD</span>
                <span class="text-2xl">🏆</span>
            </div>
            <div class="relative text-xs font-medium text-rose-100 mt-1">
                Sold to ${soldTo || 'New Owner'} ${soldDate ? 'on ' + formatDate(soldDate) : ''} ${soldPrice ? 'for $' + soldPrice.toLocaleString() : ''}
            </div>
           </div>` 
        : '';

    $('vehicleStatsContent').innerHTML = `
        ${soldBanner}
        ${premiumBanner}
        <!-- View Toggle Tabs - full width, no padding needed -->
        <div class="flex border-b border-gray-700">
            <button onclick="viewProperty(${id})" class="flex-1 py-4 px-6 text-center font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition">
                <svg class="w-5 h-5 inline-block mr-2 -mt-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
                Vehicle View
            </button>
            <button onclick="viewPropertyStats(${id})" class="flex-1 py-4 px-6 text-center font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 border-b-2 border-amber-400">
                <svg class="w-5 h-5 inline-block mr-2 -mt-1" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                Owner Stats
            </button>
        </div>
        
        <!-- Property Header -->
        <div class="relative">
            ${p.images && p.images.length > 0 && p.images[0] 
                ? `<img src="${p.images[0]}" alt="${sanitize(p.title)}" class="w-full h-64 md:h-80 object-cover cursor-pointer hover:opacity-90 transition" onclick="scrollToImagesSection(${id})" title="Click to view all images" onerror="this.onerror=null; this.parentElement.querySelector('.stats-img-container').innerHTML=this.parentElement.querySelector('.stats-img-container').dataset.placeholder;" >
                   <div class="stats-img-container hidden" data-placeholder="<div class='w-full h-64 md:h-80 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex flex-col items-center justify-center'><span class='text-8xl mb-4'>🚗</span><span class='text-gray-400 font-semibold text-xl'>Photos Coming Soon</span><span class='text-gray-500 text-sm mt-2'>Check back later for vehicle images</span></div>"></div>`
                : `<div class="w-full h-64 md:h-80 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex flex-col items-center justify-center">
                       <span class="text-8xl mb-4">🚗</span>
                       <span class="text-gray-400 font-semibold text-xl">Photos Coming Soon</span>
                       <span class="text-gray-500 text-sm mt-2">Check back later for vehicle images</span>
                   </div>`}
            <div class="absolute top-4 right-4 bg-gradient-to-r ${statusClass} text-white px-4 py-2 rounded-xl font-bold shadow-lg">
                ${statusText}
            </div>
            ${isPremium ? '<div class="absolute top-4 left-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2"><span>👑</span> Premium</div>' : ''}
            </div>
            
            <div class="p-6 md:p-8">
                <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">✨</span>
                            <h2 id="editable-title-${id}" 
                                class="text-3xl md:text-4xl font-black ${isPremium ? 'text-amber-300' : 'text-white'} cursor-pointer hover:text-purple-300 transition inline-block"
                                onclick="startEditField('title', ${id}, this)"
                                title="Click to edit address">
                                ${sanitize(p.title)}
                            </h2>
                            <span class="text-purple-400 text-sm">✏️</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span>📝</span>
                            <span class="text-lg text-gray-300 font-semibold">Description:</span>
                            <span id="editable-location-${id}" 
                                  class="text-lg text-gray-300 font-semibold cursor-pointer hover:text-purple-300 transition"
                                  onclick="startEditField('location', ${id}, this)"
                                  title="Click to edit description">
                                ${sanitize(p.location)}
                            </span>
                            <span class="text-purple-400 text-sm">✏️</span>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span id="tile-type-${id}" 
                              class="badge text-white text-sm font-bold px-4 py-2 rounded-full uppercase cursor-pointer hover:ring-2 hover:ring-purple-400 transition flex items-center gap-2"
                              onclick="startEditPropertyType(${id})"
                              data-field="type"
                              data-original-value="${propertyType}"
                              title="Click to change property type">
                            ${propertyType}
                            <svg class="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </span>
                        <span id="stats-owner-${id}" class="bg-blue-600/80 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            <span>Loading...</span>
                        </span>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl p-4 mb-6">
                    <p class="text-purple-200 font-semibold text-center">Click any tile below to edit - Changes sync in real-time across all pages</p>
                </div>
                
                <!-- EDITABLE Quick Stats Grid - Benny's Style -->
                <h3 class="text-xl font-bold text-gray-200 mb-4">Vehicle Details <span class="text-sm text-purple-400">(Click to edit)</span></h3>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8" id="editableStatsGrid">
                    <!-- Plate Tile -->
                    <div id="tile-plate-${id}" 
                         class="stat-tile text-center p-4 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl border border-slate-500 cursor-pointer"
                         onclick="startEditTile('plate', ${id}, 'text')"
                         data-field="plate"
                         data-original-value="${sanitize(plate)}">
                        <div class="text-2xl mb-2">🔖</div>
                        <div id="value-plate-${id}" class="text-lg font-bold text-white">${plate || 'N/A'}</div>
                        <div class="text-sm text-slate-200">Plate</div>
                        <div class="text-xs text-slate-300 mt-1 opacity-70">Click to edit</div>
                    </div>
                    
                    <!-- Upgrades Tile -->
                    <div id="tile-upgrades-${id}" 
                         class="stat-tile text-center p-4 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl border border-indigo-500 cursor-pointer"
                         onclick="startEditTile('upgrades', ${id}, 'select')"
                         data-field="upgrades"
                         data-original-value="${upgrades}">
                        <div class="text-2xl mb-2">🔧</div>
                        <div id="value-upgrades-${id}" class="text-lg font-bold text-white">${upgrades || 'N/A'}</div>
                        <div class="text-sm text-indigo-200">Upgrades</div>
                        <div class="text-xs text-indigo-300 mt-1 opacity-70">Click to edit</div>
                    </div>
                    
                    <!-- Speed Tile -->
                    <div id="tile-speed-${id}" 
                         class="stat-tile text-center p-4 bg-gradient-to-br from-cyan-600 to-cyan-800 rounded-xl border border-cyan-500 cursor-pointer"
                         onclick="startEditTile('speed', ${id}, 'select')"
                         data-field="speed"
                         data-original-value="${speed}">
                        <div class="text-2xl mb-2">⚡</div>
                        <div id="value-speed-${id}" class="text-lg font-bold text-white">${speed || 'N/A'}</div>
                        <div class="text-sm text-cyan-200">Speed</div>
                        <div class="text-xs text-cyan-300 mt-1 opacity-70">Click to edit</div>
                    </div>
                    
                    <!-- Storage Tile -->
                    <div id="tile-storage-${id}" 
                         class="stat-tile text-center p-4 bg-gradient-to-br from-amber-600 to-amber-800 rounded-xl border border-amber-500 cursor-pointer"
                         onclick="startEditTile('storage', ${id}, 'select')"
                         data-field="storage"
                         data-original-value="${storage}">
                        <div class="text-2xl mb-2">📦</div>
                        <div id="value-storage-${id}" class="text-lg font-bold text-white">${storage || 'N/A'}</div>
                        <div class="text-sm text-amber-200">Storage</div>
                        <div class="text-xs text-amber-300 mt-1 opacity-70">Click to edit</div>
                    </div>
                    
                    <!-- Seats Tile -->
                    <div id="tile-seats-${id}" 
                         class="stat-tile text-center p-4 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl border border-purple-500 cursor-pointer"
                         onclick="startEditTile('seats', ${id}, 'select')"
                         data-field="seats"
                         data-original-value="${seats}">
                        <div class="text-2xl mb-2">💺</div>
                        <div id="value-seats-${id}" class="text-lg font-bold text-white">${seats || 'N/A'}</div>
                        <div class="text-sm text-purple-200">Seats</div>
                        <div class="text-xs text-purple-300 mt-1 opacity-70">Click to edit</div>
                    </div>
                    
                    <!-- Price Tile -->
                    <div id="tile-buyPrice-${id}" 
                         class="stat-tile text-center p-4 bg-gradient-to-br from-green-600 to-green-800 rounded-xl border border-green-500 cursor-pointer"
                         onclick="startEditTile('buyPrice', ${id}, 'number')"
                         data-field="buyPrice"
                         data-original-value="${buyPrice}">
                        <div class="text-2xl mb-2">💰</div>
                        <div id="value-buyPrice-${id}" class="text-lg font-bold text-white">$${buyPrice?.toLocaleString() || '0'}</div>
                        <div class="text-sm text-green-200">Price</div>
                        <div class="text-xs text-green-300 mt-1 opacity-70">Click to edit</div>
                    </div>
                </div>
                
                <!-- Vehicle Images Gallery with Drag & Drop -->
                <div id="property-images-section-${id}" class="glass-effect rounded-2xl shadow-2xl p-6 md:p-8 mb-8 transition-all duration-500">
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <h3 class="text-2xl font-bold text-gray-200">📸 Vehicle Images</h3>
                            <p class="text-gray-400 text-sm mt-1">Drag to reorder • First image is the main photo</p>
                        </div>
                        <button onclick="openAddImageModal(${id})" class="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:opacity-90 transition shadow-lg flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            Add Images
                        </button>
                    </div>
                    <div class="flex gap-4 overflow-x-auto pb-4" id="images-grid-${id}" data-property-id="${id}">
                        ${p.images.map((img, i) => `
                            <div class="relative group flex-shrink-0 draggable-image" draggable="true" data-index="${i}" data-property-id="${id}">
                                <div class="absolute top-2 left-2 z-10 bg-black/60 text-white text-xs px-2 py-1 rounded-lg font-bold cursor-grab active:cursor-grabbing">
                                    ${i === 0 ? '⭐ Main' : `#${i + 1}`}
                                </div>
                                <img src="${img}" alt="${sanitize(p.title)} - Image ${i+1}" onclick="openLightbox(state.currentImages, ${i})" class="img-clickable h-40 w-56 object-cover rounded-xl shadow-lg border-2 border-gray-600 hover:border-purple-500 transition pointer-events-auto" loading="lazy">
                                <button onclick="event.stopPropagation(); deletePropertyImage(${id}, ${i}, '${img.replace(/'/g, "\\'")}')" class="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg z-10" title="Delete image">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    ${p.images.length === 0 ? '<p class="text-gray-500 text-center py-8">No images yet. Click "Add Images" to showcase your property!</p>' : ''}
                </div>
                
                <!-- Sales Tracker Section -->
                <h3 class="text-xl font-bold text-gray-200 mb-4">🚗 Sales Tracker</h3>
                
                <!-- Payment Breakdown Calculator -->
                <div class="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-600 rounded-xl p-5 mb-4">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="text-2xl">💰</span>
                        <div>
                            <h4 class="text-white font-bold text-lg">Payment Breakdown</h4>
                            <p class="text-gray-400 text-sm">LUX app max transaction: $750,000</p>
                        </div>
                    </div>
                    
                    ${(() => {
                        const LUX_MAX = 750000;
                        const CITY_FEE = 25000;
                        const totalWithFee = buyPrice + CITY_FEE;
                        const needsDownPayment = buyPrice > LUX_MAX;
                        const downPayment = needsDownPayment ? buyPrice - LUX_MAX : 0;
                        const luxTransaction = needsDownPayment ? LUX_MAX : buyPrice;
                        
                        if (needsDownPayment) {
                            return `
                            <div class="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4 mb-4">
                                <div class="flex items-start gap-3 mb-3">
                                    <span class="text-amber-400 text-xl">⚠️</span>
                                    <div>
                                        <p class="text-amber-300 font-bold">Down Payment Required</p>
                                        <p class="text-amber-200/80 text-sm">This vehicle exceeds the $750k LUX transaction limit</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div class="bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div class="text-gray-400 text-sm mb-1">Vehicle Price</div>
                                    <div class="text-white text-2xl font-black">$${buyPrice.toLocaleString()}</div>
                                </div>
                                <div class="bg-red-900/50 border border-red-500/50 rounded-lg p-4 text-center">
                                    <div class="text-red-300 text-sm mb-1 font-bold">💵 DOWN PAYMENT</div>
                                    <div class="text-red-400 text-2xl font-black">$${downPayment.toLocaleString()}</div>
                                    <div class="text-red-300/70 text-xs mt-1">Cash before LUX transfer</div>
                                </div>
                                <div class="bg-green-900/50 border border-green-500/50 rounded-lg p-4 text-center">
                                    <div class="text-green-300 text-sm mb-1">LUX Transaction</div>
                                    <div class="text-green-400 text-2xl font-black">$${luxTransaction.toLocaleString()}</div>
                                    <div class="text-green-300/70 text-xs mt-1">After down payment received</div>
                                </div>
                            </div>
                            
                            <div class="bg-gray-700/30 rounded-lg p-3 text-center">
                                <span class="text-gray-400 text-sm">+ City Sales Fee: </span>
                                <span class="text-amber-400 font-bold">$${CITY_FEE.toLocaleString()}</span>
                                <span class="text-gray-500 text-sm"> (paid by buyer at LUX)</span>
                            </div>
                            `;
                        } else {
                            return `
                            <div class="bg-green-900/30 border border-green-500/50 rounded-lg p-4 mb-4">
                                <div class="flex items-center gap-3">
                                    <span class="text-green-400 text-xl">✅</span>
                                    <div>
                                        <p class="text-green-300 font-bold">No Down Payment Needed</p>
                                        <p class="text-green-200/80 text-sm">This vehicle can be sold in a single LUX transaction</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div class="bg-green-900/50 border border-green-500/50 rounded-lg p-4 text-center">
                                    <div class="text-green-300 text-sm mb-1">LUX Transaction</div>
                                    <div class="text-green-400 text-2xl font-black">$${buyPrice.toLocaleString()}</div>
                                </div>
                                <div class="bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div class="text-gray-400 text-sm mb-1">+ City Sales Fee</div>
                                    <div class="text-amber-400 text-2xl font-black">$${CITY_FEE.toLocaleString()}</div>
                                </div>
                            </div>
                            `;
                        }
                    })()}
                </div>
                
                <!-- Trust Warning Banner -->
                ${buyPrice > 750000 ? `
                <div class="bg-gradient-to-r from-red-900/60 to-orange-900/60 border-2 border-red-500 rounded-xl p-5 mb-4">
                    <div class="flex items-start gap-4">
                        <div class="text-4xl">🚨</div>
                        <div>
                            <h4 class="text-red-300 font-black text-lg mb-2">⚠️ DOWN PAYMENT TRUST WARNING</h4>
                            <ul class="text-red-200/90 text-sm space-y-2">
                                <li>• <strong>VERIFY BUYER IDENTITY</strong> - Meet in person, confirm their character name matches their ID</li>
                                <li>• <strong>GENERATE A CONTRACT</strong> - Always create a written agreement before accepting any cash</li>
                                <li>• <strong>SCREENSHOT EVERYTHING</strong> - Document the cash handoff, contract signing, and LUX transfer</li>
                                <li>• <strong>USE PUBLIC LOCATIONS</strong> - Meet at Legion Square, MRPD, or other populated areas</li>
                                <li>• <strong>BRING WITNESSES</strong> - Have a trusted friend present during the transaction</li>
                            </ul>
                            <p class="text-red-300 font-bold mt-3 text-sm">
                                🏛️ PaulysAutos.com is NOT responsible for any disputes. The contract generated is for your protection in city court.
                            </p>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <!-- Pending Sale Tracking -->
                ${(() => {
                    const pendingSale = PropertyDataService.getValue(id, 'pendingSale', p.pendingSale || null);
                    if (pendingSale) {
                        return `
                        <div class="bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border-2 border-amber-500/50 rounded-xl p-5 mb-4">
                            <div class="flex items-center justify-between mb-4">
                                <h4 class="text-amber-300 font-bold flex items-center gap-2">
                                    <span class="text-xl">📋</span>
                                    Pending Sale in Progress
                                    <span class="text-[10px] bg-amber-900/50 text-amber-200 px-2 py-0.5 rounded-full animate-pulse">PENDING</span>
                                </h4>
                            </div>
                            
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                                <div class="bg-gray-800/50 rounded-lg p-3">
                                    <div class="text-gray-400 text-xs">Buyer</div>
                                    <div class="text-white font-bold">${pendingSale.buyerName || 'Unknown'}</div>
                                </div>
                                <div class="bg-gray-800/50 rounded-lg p-3">
                                    <div class="text-gray-400 text-xs">Down Payment</div>
                                    <div class="text-${pendingSale.downPaymentReceived ? 'green' : 'amber'}-400 font-bold">
                                        $${(pendingSale.downPayment || 0).toLocaleString()}
                                        ${pendingSale.downPaymentReceived ? '✓' : '⏳'}
                                    </div>
                                </div>
                                <div class="bg-gray-800/50 rounded-lg p-3">
                                    <div class="text-gray-400 text-xs">LUX Remaining</div>
                                    <div class="text-cyan-400 font-bold">$${(pendingSale.luxAmount || 0).toLocaleString()}</div>
                                </div>
                                <div class="bg-gray-800/50 rounded-lg p-3">
                                    <div class="text-gray-400 text-xs">Contract</div>
                                    <div class="text-green-400 font-bold">${pendingSale.contractId ? '✓ Generated' : 'None'}</div>
                                </div>
                            </div>
                            
                            <div class="flex flex-wrap gap-2">
                                ${pendingSale.contractId ? `
                                <button onclick="viewSaleContract('${pendingSale.contractId}')" class="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                    View Contract
                                </button>
                                ` : ''}
                                ${!pendingSale.downPaymentReceived && pendingSale.downPayment > 0 ? `
                                <button onclick="confirmDownPaymentReceived(${id})" class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                    Confirm Down Payment Received
                                </button>
                                ` : ''}
                                <button onclick="cancelPendingSale(${id})" class="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Cancel Sale
                                </button>
                            </div>
                        </div>
                        `;
                    }
                    return '';
                })()}
                
                <!-- Start New Sale / Complete Sale Actions -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="bg-gradient-to-r from-emerald-900/40 to-green-900/40 border border-emerald-500/50 rounded-xl p-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h4 class="text-emerald-300 font-bold flex items-center gap-2">
                                    <span class="text-xl">📝</span>
                                    Start New Sale
                                </h4>
                                <p class="text-gray-400 text-sm mt-1">Generate contract & track down payment</p>
                            </div>
                            <button onclick="showStartSaleModal(${id})" class="bg-gradient-to-r from-emerald-500 to-green-600 hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 whitespace-nowrap shadow-lg">
                                <span>📄</span>
                                Start Sale
                            </button>
                        </div>
                    </div>
                    
                    <div class="bg-gradient-to-r from-rose-900/40 to-pink-900/40 border border-rose-500/50 rounded-xl p-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h4 class="text-rose-300 font-bold flex items-center gap-2">
                                    <span class="text-xl">🏆</span>
                                    Log Completed Sale
                                </h4>
                                <p class="text-gray-400 text-sm mt-1">Record a sale that's already done</p>
                            </div>
                            <button onclick="showLogSaleModal(${id})" class="bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 whitespace-nowrap shadow-lg">
                                <span>✓</span>
                                Log Sale
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Wrapper for remaining sections with proper padding -->
        <div class="px-6 md:px-8 pb-8">
        
        <!-- EDITABLE Pricing & Status -->
        <h3 class="text-xl font-bold text-gray-200 mb-4">Pricing & Status <span class="text-sm text-purple-400">(Click to edit)</span></h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <!-- Buy Price Tile -->
            <div id="tile-buyPrice-${id}" 
                 class="stat-tile bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white border border-amber-400 cursor-pointer"
                 onclick="startEditTile('buyPrice', ${id}, 'number')"
                 data-field="buyPrice"
                 data-original-value="${buyPrice}">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-sm font-bold opacity-90">💰 Vehicle Price</h3>
                    <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div id="value-buyPrice-${id}" class="text-3xl font-black">$${buyPrice > 0 ? buyPrice.toLocaleString() : '0'}</div>
                <div class="text-xs text-amber-200 mt-2 opacity-80">+$25k city sales fee</div>
                <div class="text-xs mt-1 opacity-70">Click to edit</div>
            </div>
            
            <!-- Status Tile (toggles availability) -->
            <div id="tile-status-${id}" 
                 class="stat-tile bg-gradient-to-br ${isAvailable ? 'from-emerald-600 to-teal-800 border-emerald-500' : 'from-red-600 to-pink-800 border-red-500'} rounded-2xl shadow-xl p-6 text-white border cursor-pointer"
                 onclick="togglePropertyStatus(${id})">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-sm font-bold opacity-90">📊 Status</h3>
                    <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div class="text-3xl font-black">${isAvailable ? 'Available' : 'SOLD'}</div>
                <div class="text-xs opacity-80 mt-2">${isAvailable ? 'Accepting inquiries' : 'No longer for sale'}</div>
                <div class="text-xs mt-1 opacity-70">Click to toggle</div>
            </div>
        </div>
        
        <!-- Premium Advertising Info (only shows if premium is enabled) -->
        ${isPremium ? `
        <h3 class="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">👑 Premium Advertising <span class="text-sm text-amber-300/70">(Click to edit)</span></h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <!-- Premium Status -->
            <div class="stat-tile p-4 bg-gradient-to-br from-amber-600 to-yellow-700 rounded-xl border border-amber-500">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">👑</span>
                    <span class="text-amber-100 font-semibold">Premium Status</span>
                </div>
                <div class="text-lg font-bold text-white">${isPremiumTrial ? '🎁 Free Trial' : '💰 Paid'}</div>
                <div class="text-xs text-amber-200 mt-2">${isPremiumTrial ? 'No charge' : '$10,000/week'}</div>
                ${TierService.isMasterAdmin(auth.currentUser?.email) ? `
                <button onclick="togglePremiumTrialStatus(${id})" class="mt-2 text-xs bg-amber-800 hover:bg-amber-700 px-2 py-1 rounded text-amber-100">
                    ${isPremiumTrial ? 'Convert to Paid' : 'Convert to Trial'}
                </button>
                ` : ''}
            </div>
            
            <!-- Premium Start Date -->
            <div id="tile-premiumStartDate-${id}"
                 class="stat-tile p-4 bg-gradient-to-br from-amber-700 to-orange-800 rounded-xl border border-amber-600 cursor-pointer"
                 onclick="startEditTile('premiumStartDate', ${id}, 'date')"
                 data-field="premiumStartDate"
                 data-original-value="${premiumStartDate}">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">📅</span>
                    <span class="text-amber-100 font-semibold">Start Date</span>
                </div>
                <div id="value-premiumStartDate-${id}" class="text-lg font-bold text-white">${premiumStartDate ? formatDate(premiumStartDate) : '<span class="opacity-70">Not set</span>'}</div>
                <div class="text-xs text-amber-200 mt-2 opacity-70">Click to edit</div>
            </div>
            
            <!-- Premium Last Payment (only for paid) -->
            <div id="tile-premiumLastPayment-${id}"
                 class="stat-tile p-4 bg-gradient-to-br ${isPremiumTrial ? 'from-gray-600 to-gray-700 border-gray-500' : 'from-green-600 to-emerald-700 border-green-500'} rounded-xl border cursor-pointer"
                 onclick="${isPremiumTrial ? '' : `startEditTile('premiumLastPayment', ${id}, 'date')`}"
                 data-field="premiumLastPayment"
                 data-original-value="${premiumLastPayment}">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">💵</span>
                    <span class="${isPremiumTrial ? 'text-gray-300' : 'text-green-100'} font-semibold">Last Payment</span>
                </div>
                <div id="value-premiumLastPayment-${id}" class="text-lg font-bold text-white">
                    ${isPremiumTrial ? '<span class="opacity-50">N/A (Trial)</span>' : (premiumLastPayment ? formatDate(premiumLastPayment) : '<span class="opacity-70">Not set</span>')}
                </div>
                <div class="text-xs ${isPremiumTrial ? 'text-gray-400' : 'text-green-200'} mt-2 opacity-70">${isPremiumTrial ? 'Free trial active' : 'Click to edit'}</div>
            </div>
            
            <!-- Premium Next Due (calculated) -->
            <div class="stat-tile p-4 bg-gradient-to-br ${isPremiumTrial ? 'from-gray-600 to-gray-700 border-gray-500' : (premiumDaysUntilDue !== null && premiumDaysUntilDue <= 1 ? 'from-red-600 to-red-800 border-red-500' : 'from-orange-600 to-orange-800 border-orange-500')} rounded-xl border">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">⏰</span>
                    <span class="${isPremiumTrial ? 'text-gray-300' : (premiumDaysUntilDue !== null && premiumDaysUntilDue <= 1 ? 'text-red-100' : 'text-orange-100')} font-semibold">Next Due</span>
                </div>
                <div class="text-lg font-bold text-white">
                    ${isPremiumTrial ? '<span class="opacity-50">N/A (Trial)</span>' : (premiumNextDue || '<span class="opacity-70">Set last payment</span>')}
                </div>
                ${!isPremiumTrial && premiumDaysUntilDue !== null ? `
                <div class="text-xs ${premiumDaysUntilDue <= 1 ? 'text-red-200 font-bold' : 'text-orange-200'} mt-2">
                    ${premiumDaysUntilDue === 0 ? '⚠️ Due today!' : premiumDaysUntilDue === 1 ? '⚠️ Due tomorrow!' : premiumDaysUntilDue < 0 ? '🚨 ' + Math.abs(premiumDaysUntilDue) + ' day(s) overdue!' : premiumDaysUntilDue + ' days remaining'}
                </div>
                ` : '<div class="text-xs text-gray-400 mt-2">Auto-calculated weekly</div>'}
            </div>
        </div>
        ` : ''}
        
        <!-- Agent Management Section -->
        <div id="propertyAgentSection" class="glass-effect rounded-2xl shadow-2xl p-6 md:p-8 mb-8">
            <!-- Content loaded dynamically by renderPropertyAgentSection() -->
            <p class="text-gray-500 italic">Loading agent section...</p>
        </div>
        
        <!-- Sales History Section -->
        <div id="salesHistorySection-${id}" class="glass-effect rounded-2xl shadow-2xl p-6 md:p-8 mb-8">
            <h3 class="text-2xl font-bold text-gray-200 mb-4 flex items-center gap-3">
                <span>📜</span> Sales History
            </h3>
            <div id="salesHistoryContent-${id}">
                <p class="text-gray-500 italic">Loading sales history...</p>
            </div>
        </div>
        
        <!-- Actions -->
        <div class="glass-effect rounded-2xl shadow-2xl p-6 md:p-8 mb-8">
            <h3 class="text-2xl font-bold text-gray-200 mb-6">⚡ Quick Actions</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onclick="toggleAvailability(${id}); setTimeout(() => renderPropertyStatsContent(${id}), 100);" class="flex items-center justify-center space-x-3 ${isAvailable ? 'bg-gradient-to-r from-red-500 to-pink-600' : 'bg-gradient-to-r from-green-500 to-emerald-600'} text-white px-6 py-4 rounded-xl font-bold hover:opacity-90 transition shadow-lg">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                    <span>${isAvailable ? 'Mark as Sold' : 'Mark as Available'}</span>
                </button>
                <button onclick="togglePremiumStatus(${id})" class="flex items-center justify-center space-x-3 ${isPremium ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900' : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-amber-600 hover:to-yellow-600 text-white'} px-6 py-4 rounded-xl font-bold transition shadow-lg">
                    <span class="text-xl">👑</span>
                    <span>${isPremium ? 'Premium Active ($10k)' : 'Enable Premium'}</span>
                </button>
                <button onclick="viewProperty(${id})" class="flex items-center justify-center space-x-3 gradient-bg text-white px-6 py-4 rounded-xl font-bold hover:opacity-90 transition shadow-lg">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    <span>View Public Listing</span>
                </button>
                <button onclick="confirmDeleteProperty(${id}, '${sanitize(p.title).replace(/'/g, "\\'")}')" class="flex items-center justify-center space-x-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-red-600 hover:to-red-700 text-white px-6 py-4 rounded-xl font-bold transition shadow-lg">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    <span>Delete Vehicle</span>
                </button>
            </div>
        </div>
        
        </div><!-- End of padding wrapper for Pricing & Quick Actions sections -->
        
        </div><!-- End of main card -->
    `;
    
    // Render agent section dynamically
    if (typeof renderPropertyAgentSection === 'function') {
        renderPropertyAgentSection(id).then(function(html) {
            var agentSection = $('propertyAgentSection');
            if (agentSection && html) {
                agentSection.innerHTML = html;
            }
        });
    }
    
    // Load sales history for this vehicle
    loadVehicleSalesHistory(id);
}

/**
 * Load and display sales history for a vehicle
 */
async function loadVehicleSalesHistory(vehicleId) {
    const contentEl = document.getElementById(`salesHistoryContent-${vehicleId}`);
    if (!contentEl) return;
    
    try {
        // Query houseSales collection for this vehicle
        const salesSnapshot = await db.collection('houseSales')
            .where('propertyId', '==', vehicleId)
            .orderBy('recordedAt', 'desc')
            .limit(10)
            .get();
        
        if (salesSnapshot.empty) {
            contentEl.innerHTML = `
                <div class="text-center py-6">
                    <div class="text-4xl mb-3">🚗</div>
                    <p class="text-gray-400">No sales recorded for this vehicle yet</p>
                    <p class="text-gray-500 text-sm mt-2">Sales will appear here when you log a completed sale</p>
                </div>
            `;
            return;
        }
        
        const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        contentEl.innerHTML = `
            <div class="space-y-4">
                ${sales.map((sale, index) => `
                    <div class="bg-gray-800/50 rounded-xl p-4 border ${index === 0 ? 'border-green-500/50' : 'border-gray-700'}">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xl">
                                    ${index === 0 ? '🏆' : '💰'}
                                </div>
                                <div>
                                    <div class="text-white font-bold text-lg">$${(sale.salePrice || 0).toLocaleString()}</div>
                                    <div class="text-gray-400 text-sm">${sale.saleDate ? formatDate(sale.saleDate) : 'Unknown date'}</div>
                                </div>
                            </div>
                            ${index === 0 ? '<span class="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">LATEST</span>' : ''}
                        </div>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-gray-500">Buyer:</span>
                                <span class="text-white ml-2">${sale.buyerName || 'Unknown'}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Seller:</span>
                                <span class="text-white ml-2">${sale.sellerDisplayName || 'Unknown'}</span>
                            </div>
                        </div>
                        ${sale.notes ? `
                            <div class="mt-3 text-sm text-gray-400 italic border-t border-gray-700 pt-3">
                                📝 ${sale.notes}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('[SalesHistory] Error loading sales:', error);
        contentEl.innerHTML = `
            <div class="text-center py-6 text-gray-500">
                <p>Could not load sales history</p>
                <p class="text-sm mt-1">${error.message}</p>
            </div>
        `;
    }
}

window.loadVehicleSalesHistory = loadVehicleSalesHistory;

/**
 * Start editing a tile - shows inline input
 */
window.startEditTile = function(field, propertyId, type) {
    const tileId = `tile-${field}-${propertyId}`;
    const valueId = `value-${field}-${propertyId}`;
    const tile = $(tileId);
    const valueEl = $(valueId);
    
    if (!tile || !valueEl || tile.classList.contains('editing')) return;
    
    // VALIDATION: Block lastPaymentDate if frequency is not set (unless clearing)
    if (field === 'lastPaymentDate') {
        const p = properties.find(prop => prop.id === propertyId);
        const frequency = PropertyDataService.getValue(propertyId, 'paymentFrequency', p?.paymentFrequency || '');
        const currentValue = PropertyDataService.getValue(propertyId, 'lastPaymentDate', p?.lastPaymentDate || '');
        
        // If frequency not set, only allow if we're clearing an existing value
        if (!frequency && !currentValue) {
            alert('⚠️ Please set the Payment Frequency first!\n\nThe frequency determines how the next due date is calculated and how payments are logged.\n\n1. Click on "Payment Frequency"\n2. Select: Daily, Weekly, Biweekly, or Monthly\n3. Then you can set the Last Payment date');
            return;
        }
        
        // If frequency not set but there IS a value, allow editing so user can clear it
        if (!frequency && currentValue) {
            // Show a modified editor that allows clearing
            tile.classList.add('editing');
            const inputHtml = `
                <input type="date" id="input-${field}-${propertyId}" class="stat-input text-lg" value="${currentValue}">
                <div class="text-xs text-yellow-300 mt-1">⚠️ Set frequency first, or clear this field</div>
            `;
            valueEl.innerHTML = inputHtml;
            const input = $(`input-${field}-${propertyId}`);
            if (input) {
                input.focus();
                input.addEventListener('blur', () => saveTileEdit(field, propertyId, type));
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveTileEdit(field, propertyId, type);
                    if (e.key === 'Escape') cancelTileEdit(field, propertyId);
                });
            }
            return;
        }
        
        // Check if this is an RTO property - show custom RTO payment modal instead
        const hasActiveRTO = PropertyDataService.getValue(propertyId, 'hasActiveRTO', p?.hasActiveRTO || false);
        if (hasActiveRTO) {
            showRTOPaymentModal(propertyId);
            return; // Don't continue with normal tile editing
        }
    }
    
    tile.classList.add('editing');
    
    const currentValue = PropertyDataService.getValue(propertyId, field, tile.dataset.originalValue);
    
    let inputHtml;
    if (type === 'select' && field === 'upgrades') {
        inputHtml = `
            <select id="input-${field}-${propertyId}" class="stat-input text-lg w-full">
                <option value="None" ${currentValue === 'None' ? 'selected' : ''}>None</option>
                <option value="Some" ${currentValue === 'Some' ? 'selected' : ''}>Some</option>
                <option value="Max" ${currentValue === 'Max' ? 'selected' : ''}>Max</option>
            </select>
        `;
    } else if (type === 'select' && field === 'speed') {
        inputHtml = `
            <select id="input-${field}-${propertyId}" class="stat-input text-lg w-full">
                <option value="Normal" ${currentValue === 'Normal' ? 'selected' : ''}>Normal</option>
                <option value="Fast" ${currentValue === 'Fast' ? 'selected' : ''}>Fast</option>
                <option value="Ludicrous" ${currentValue === 'Ludicrous' ? 'selected' : ''}>Ludicrous</option>
            </select>
        `;
    } else if (type === 'select' && field === 'storage') {
        inputHtml = `
            <select id="input-${field}-${propertyId}" class="stat-input text-lg w-full">
                <option value="Low" ${currentValue === 'Low' ? 'selected' : ''}>Low</option>
                <option value="Medium" ${currentValue === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="High" ${currentValue === 'High' ? 'selected' : ''}>High</option>
            </select>
        `;
    } else if (type === 'select' && field === 'seats') {
        inputHtml = `
            <select id="input-${field}-${propertyId}" class="stat-input text-lg w-full">
                <option value="Two" ${currentValue === 'Two' ? 'selected' : ''}>Two</option>
                <option value="Four" ${currentValue === 'Four' ? 'selected' : ''}>Four</option>
                <option value="Five" ${currentValue === 'Five' ? 'selected' : ''}>Five</option>
                <option value="Six" ${currentValue === 'Six' ? 'selected' : ''}>Six</option>
            </select>
        `;
    } else if (type === 'frequency') {
        inputHtml = `
            <select id="input-${field}-${propertyId}" class="stat-input text-lg w-full">
                <option value="" ${!currentValue ? 'selected' : ''}>-- Select Frequency --</option>
                <option value="daily" ${currentValue === 'daily' ? 'selected' : ''}>Daily</option>
                <option value="weekly" ${currentValue === 'weekly' ? 'selected' : ''}>Weekly</option>
                <option value="biweekly" ${currentValue === 'biweekly' ? 'selected' : ''}>Biweekly</option>
                <option value="monthly" ${currentValue === 'monthly' ? 'selected' : ''}>Monthly</option>
            </select>
        `;
    } else if (type === 'date') {
        inputHtml = `
            <input type="date" 
                   id="input-${field}-${propertyId}"
                   class="stat-input text-lg"
                   value="${currentValue || ''}">
        `;
    } else if (type === 'textarea') {
        inputHtml = `
            <textarea id="input-${field}-${propertyId}"
                   class="stat-input text-sm w-full"
                   rows="3"
                   placeholder="Add notes about this renter...">${currentValue || ''}</textarea>
        `;
    } else {
        const rawValue = typeof currentValue === 'number' ? currentValue : String(currentValue || '').replace(/[$,]/g, '');
        const inputType = type === 'number' ? 'number' : (type === 'tel' ? 'tel' : 'text');
        const placeholder = field === 'ownerName' ? 'Enter contact name' : 
                           field === 'ownerPhone' ? 'Enter phone number' : 
                           field === 'renterName' ? 'Enter renter name' : 
                           field === 'renterPhone' ? 'Enter renter phone' : '';
        const phoneHandler = type === 'tel' ? 'oninput="this.value = this.value.replace(/\\D/g, \'\')" maxlength="10"' : '';
        
        // Add minimum price info for buyPrice field
        let minPriceNote = '';
        if (field === 'buyPrice') {
            const p = properties.find(prop => prop.id === propertyId);
            if (p) {
                const minInfo = getMinimumBuyPrice(p);
                minPriceNote = `
                    <div class="bg-amber-900/50 border border-amber-500/50 rounded-lg p-2 mt-2 text-xs">
                        <div class="text-amber-300 font-bold mb-1">📋 PMA Government Minimum</div>
                        <div class="text-amber-200">Category: ${minInfo.category}</div>
                        <div class="text-amber-200">Min Price: <span class="font-bold">$${minInfo.min.toLocaleString()}</span></div>
                    </div>
                `;
            }
        }
        
        inputHtml = `
            <input type="${inputType}" 
                   id="input-${field}-${propertyId}"
                   class="stat-input text-lg"
                   value="${rawValue}"
                   ${type === 'number' ? 'min="0"' : ''}
                   ${phoneHandler}
                   placeholder="${placeholder}">
            ${minPriceNote}
        `;
    }
    
    valueEl.innerHTML = `
        ${inputHtml}
        <div class="flex gap-2 mt-3">
            <button onclick="event.stopPropagation(); saveTileEdit('${field}', ${propertyId}, '${type}')" 
                    class="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg font-bold text-xs transition">
                Save
            </button>
            <button onclick="event.stopPropagation(); cancelTileEdit('${field}', ${propertyId})" 
                    class="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg font-bold text-xs transition">
                Cancel
            </button>
        </div>
    `;
    
    const input = $(`input-${field}-${propertyId}`);
    if (input) {
        input.focus();
        if (input.select) input.select();
        input.onclick = (e) => e.stopPropagation();
        input.onkeydown = (e) => {
            e.stopPropagation();
            // For textarea, don't save on Enter (allow multi-line)
            if (e.key === 'Enter' && type !== 'textarea') saveTileEdit(field, propertyId, type);
            if (e.key === 'Escape') cancelTileEdit(field, propertyId);
        };
    }
};

/**
 * Save tile edit - writes to Firestore with optimistic UI
 */
window.saveTileEdit = async function(field, propertyId, type) {
    const tileId = `tile-${field}-${propertyId}`;
    const valueId = `value-${field}-${propertyId}`;
    const inputId = `input-${field}-${propertyId}`;
    
    const tile = $(tileId);
    const valueEl = $(valueId);
    const input = $(inputId);
    
    if (!tile || !valueEl || !input) return;
    
    let newValue;
    if (type === 'number') {
        newValue = parseInt(input.value, 10);
        if (isNaN(newValue) || newValue < 0) {
            tile.classList.add('error');
            setTimeout(() => tile.classList.remove('error'), 500);
            return;
        }
    } else if (type === 'tel') {
        // Remove all non-digit characters from phone numbers
        newValue = input.value.replace(/\D/g, '');
        input.value = newValue; // Update input to show cleaned number
    } else if (type === 'text') {
        // Allow empty values for owner/renter info
        newValue = input.value.trim();
        // For non-contact fields, require a value
        if (!newValue && field !== 'ownerName' && field !== 'ownerPhone' && field !== 'renterName' && field !== 'renterPhone') {
            tile.classList.add('error');
            setTimeout(() => tile.classList.remove('error'), 500);
            return;
        }
    } else if (type === 'textarea') {
        // Allow empty values for notes
        newValue = input.value.trim();
    } else if (type === 'frequency') {
        newValue = input.value;
    } else if (type === 'date') {
        newValue = input.value; // Keep as YYYY-MM-DD format
    } else {
        newValue = input.value.trim();
        if (!newValue && field !== 'upgraded') {
            tile.classList.add('error');
            setTimeout(() => tile.classList.remove('error'), 500);
            return;
        }
    }
    
    // PRICE VALIDATION - check if price values are logical
    if (field === 'weeklyPrice' || field === 'biweeklyPrice' || field === 'monthlyPrice') {
        const p = properties.find(prop => prop.id === propertyId);
        if (p) {
            const weekly = field === 'weeklyPrice' ? newValue : PropertyDataService.getValue(propertyId, 'weeklyPrice', p.weeklyPrice);
            const biweekly = field === 'biweeklyPrice' ? newValue : PropertyDataService.getValue(propertyId, 'biweeklyPrice', p.biweeklyPrice || 0);
            const monthly = field === 'monthlyPrice' ? newValue : PropertyDataService.getValue(propertyId, 'monthlyPrice', p.monthlyPrice);
            
            const warnings = validatePriceLogic(weekly, biweekly, monthly);
            
            if (warnings.length > 0) {
                // Store the save parameters for after confirmation
                const saveParams = { field, propertyId, type, newValue, tile, valueEl };
                
                showPriceWarningModal(warnings, 
                    () => {
                        // User confirmed - proceed with save
                        executeTileSave(saveParams.field, saveParams.propertyId, saveParams.type, saveParams.newValue, saveParams.tile, saveParams.valueEl);
                    },
                    () => {
                        // User cancelled - just cancel the edit
                        cancelTileEdit(field, propertyId);
                    }
                );
                return; // Don't save yet, wait for confirmation
            }
        }
    }
    
    // Proceed with normal save
    executeTileSave(field, propertyId, type, newValue, tile, valueEl);
};

/**
 * Execute tile save - writes to Firestore with optimistic UI
 * (Separated from saveTileEdit to allow price warning confirmation)
 */
window.executeTileSave = async function(field, propertyId, type, newValue, tile, valueEl) {
    if (!tile || !valueEl) {
        tile = $(`tile-${field}-${propertyId}`);
        valueEl = $(`value-${field}-${propertyId}`);
    }
    
    const originalValue = tile.dataset.originalValue;
    
    // Optimistic UI update
    tile.classList.remove('editing');
    tile.classList.add('saving');
    
    let displayValue;
    if (type === 'number') {
        if (field === 'biweeklyPrice' && (newValue === 0 || !newValue)) {
            displayValue = 'Not set';
        } else {
            displayValue = field === 'weeklyPrice' || field === 'biweeklyPrice' || field === 'monthlyPrice' ? `${newValue.toLocaleString()}` : newValue.toLocaleString();
        }
    } else if ((field === 'ownerName' || field === 'ownerPhone' || field === 'renterName' || field === 'renterPhone') && !newValue) {
        displayValue = '<span class="opacity-70">Not set</span>';
    } else if (field === 'renterNotes' && !newValue) {
        displayValue = '<span class="opacity-70">Add notes...</span>';
    } else if (field === 'renterNotes' && newValue) {
        // Show full text - CSS line-clamp will handle overflow
        displayValue = newValue;
    } else if (type === 'date' && newValue) {
        displayValue = formatDate(newValue);
    } else if (type === 'frequency') {
        displayValue = newValue.charAt(0).toUpperCase() + newValue.slice(1);
    } else {
        displayValue = newValue || '<span class="opacity-70">Not set</span>';
    }
    valueEl.innerHTML = `<span class="opacity-70">${displayValue}</span><div class="text-xs mt-1">Saving...</div>`;
    
    try {
        // CRITICAL: Write to Firestore (includes fresh read before write)
        await PropertyDataService.write(propertyId, field, newValue);
        
        // LOG PAYMENT when lastPaymentDate is updated
        if (field === 'lastPaymentDate' && newValue) {
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
            
            // Check for RTO - handle deposit vs monthly payments
            const hasActiveRTO = PropertyDataService.getValue(propertyId, 'hasActiveRTO', p?.hasActiveRTO || false);
            let isDepositPayment = false;
            let rtoPaymentInfo = null;
            
            if (hasActiveRTO) {
                const rtoDepositPaid = PropertyDataService.getValue(propertyId, 'rtoDepositPaid', p?.rtoDepositPaid || false);
                const rtoContractId = PropertyDataService.getValue(propertyId, 'rtoContractId', p?.rtoContractId || '');
                
                if (!rtoDepositPaid) {
                    // DEPOSIT NOT YET PAID - record deposit payment
                    isDepositPayment = true;
                    const rtoDepositAmount = PropertyDataService.getValue(propertyId, 'rtoDepositAmount', p?.rtoDepositAmount || 0);
                    paymentAmount = rtoDepositAmount; // Override payment amount to deposit
                    
                    // Mark deposit as paid on property
                    await PropertyDataService.writeMultiple(propertyId, {
                        rtoDepositPaid: true,
                        rtoDepositPaidDate: newValue
                    });
                    
                    // Update the RTO contract in Firestore
                    if (rtoContractId) {
                        try {
                            await db.collection('rentToOwnContracts').doc(rtoContractId).update({
                                depositPaid: true,
                                depositPaidDate: newValue,
                                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        } catch (e) {
                            console.warn('[RTO] Could not update contract deposit status:', e);
                        }
                    }
                    console.log(`[RTO] Deposit of $${rtoDepositAmount.toLocaleString()} recorded for contract ${rtoContractId}`);
                    
                    // Store info for confirmation modal
                    const rtoTotalPayments = PropertyDataService.getValue(propertyId, 'rtoTotalPayments', p?.rtoTotalPayments || 0);
                    rtoPaymentInfo = { 
                        isDeposit: true, 
                        depositAmount: rtoDepositAmount,
                        monthlyAmount: monthlyPrice,
                        totalPayments: rtoTotalPayments
                    };
                } else {
                    // DEPOSIT ALREADY PAID - record monthly payment
                    const rtoCurrentPayment = PropertyDataService.getValue(propertyId, 'rtoCurrentPayment', p?.rtoCurrentPayment || 0);
                    const newPaymentNumber = rtoCurrentPayment + 1;
                    await PropertyDataService.write(propertyId, 'rtoCurrentPayment', newPaymentNumber);
                    
                    // Update the RTO contract in Firestore
                    if (rtoContractId) {
                        try {
                            await db.collection('rentToOwnContracts').doc(rtoContractId).update({
                                currentPaymentNumber: newPaymentNumber,
                                lastPaymentDate: newValue,
                                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        } catch (e) {
                            console.warn('[RTO] Could not update contract payment number:', e);
                        }
                    }
                    console.log(`[RTO] Monthly payment ${newPaymentNumber} recorded for contract ${rtoContractId}`);
                    
                    // Store info for confirmation modal
                    const rtoTotalPayments = PropertyDataService.getValue(propertyId, 'rtoTotalPayments', p?.rtoTotalPayments || 0);
                    rtoPaymentInfo = { 
                        isDeposit: false, 
                        current: newPaymentNumber, 
                        total: rtoTotalPayments 
                    };
                }
            }
            
            // Log payment to Firestore
            const logSuccess = await logPayment(propertyId, {
                paymentDate: newValue,
                recordedAt: new Date().toISOString(),
                renterName: renterName,
                frequency: isDepositPayment ? 'deposit' : paymentFrequency,
                amount: paymentAmount,
                recordedBy: auth.currentUser?.email || 'owner',
                isRTOPayment: hasActiveRTO,
                isRTODeposit: isDepositPayment
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
            if (logSuccess) {
                showPaymentConfirmationModal(renterName, nextDueDateStr, paymentAmount, rtoPaymentInfo);
                
                // Award XP for logging a payment
                if (typeof GamificationService !== 'undefined' && GamificationService.awardXP) {
                    const userId = auth.currentUser?.uid;
                    if (userId) {
                        const propertyTitle = p?.title || `Property #${propertyId}`;
                        await GamificationService.awardXP(userId, 100, `Collected $${paymentAmount.toLocaleString()} rent on ${propertyTitle}`);
                    }
                }
            }
        }
        
        // Auto-flip to "rented" when setting renter name or phone
        if ((field === 'renterName' || field === 'renterPhone') && newValue) {
            if (state.availability[propertyId] !== false) {
                // Property is currently available, flip to rented
                state.availability[propertyId] = false;
                await saveAvailability(propertyId, false);
                
                // End any ongoing vacancy period
                await endVacancyPeriod(propertyId);
            }
        }
        
        // If payment frequency changed to weekly, auto-adjust monthly price
        if (field === 'paymentFrequency' && newValue === 'weekly') {
            const p = properties.find(prop => prop.id === propertyId);
            const weeklyPrice = PropertyDataService.getValue(propertyId, 'weeklyPrice', p?.weeklyPrice || 0);
            const newMonthlyPrice = weeklyPrice * 4;
            await PropertyDataService.write(propertyId, 'monthlyPrice', newMonthlyPrice);
        }
        
        // Success feedback
        tile.classList.remove('saving');
        tile.classList.add('success');
        tile.dataset.originalValue = newValue;
        
        // Update display
        valueEl.innerHTML = displayValue;
        
        // Show success briefly
        setTimeout(() => {
            tile.classList.remove('success');
            // Refresh the entire stats page to show synced data
            renderPropertyStatsContent(propertyId);
            
            // Refresh analytics if payment was logged
            if (field === 'lastPaymentDate' && typeof renderPropertyAnalytics === 'function') {
                setTimeout(() => renderPropertyAnalytics(propertyId), 200);
            }
        }, 1000);
        
        // Update filtered properties to reflect changes
        state.filteredProperties = [...properties];
        
        // Also refresh properties grid and dashboard if they're using this data
        renderProperties(state.filteredProperties);
        if (state.currentUser === 'owner') renderOwnerDashboard();
        
    } catch (error) {
        console.error('Save failed, rolling back:', error);
        
        // Rollback on failure
        tile.classList.remove('saving');
        tile.classList.add('error');
        
        const rollbackValue = type === 'number'
            ? (field === 'weeklyPrice' || field === 'biweeklyPrice' || field === 'monthlyPrice' ? `${parseInt(originalValue).toLocaleString()}` : parseInt(originalValue).toLocaleString())
            : originalValue;
        valueEl.innerHTML = `${rollbackValue}<div class="text-xs mt-1 text-red-300">Error! Try again</div>`;
        
        setTimeout(() => {
            tile.classList.remove('error');
            renderPropertyStatsContent(propertyId);
        }, 2000);
    }
};

/**
 * Cancel tile edit - restores original value
 */
window.cancelTileEdit = function(field, propertyId) {
    const tileId = `tile-${field}-${propertyId}`;
    const tile = $(tileId);
    
    if (!tile || !tile.classList.contains('editing')) return;
    
    tile.classList.remove('editing');
    
    // Re-render to restore original display
    renderPropertyStatsContent(propertyId);
};

/**
 * Edit property type on stats page
 */
window.startEditPropertyType = function(propertyId) {
    const tile = $(`tile-type-${propertyId}`);
    if (!tile) return;
    
    const currentValue = tile.dataset.originalValue || tile.textContent.trim().toLowerCase();
    
    // Create dropdown in place
    tile.outerHTML = `
        <div id="type-edit-container-${propertyId}" class="flex flex-col items-end gap-2">
            <select id="type-select-${propertyId}" 
                    class="bg-gray-800 border-2 border-purple-500 rounded-full px-4 py-2 text-white text-sm font-bold uppercase cursor-pointer focus:ring-2 focus:ring-purple-400"
                    onchange="savePropertyType(${propertyId}, this.value)">
                <option value="apartment" ${currentValue === 'apartment' ? 'selected' : ''}>Apartment</option>
                <option value="house" ${currentValue === 'house' ? 'selected' : ''}>House</option>
                <option value="condo" ${currentValue === 'condo' ? 'selected' : ''}>Condo</option>
                <option value="villa" ${currentValue === 'villa' ? 'selected' : ''}>Villa</option>
                <option value="hotel" ${currentValue === 'hotel' ? 'selected' : ''}>Hotel</option>
                <option value="office" ${currentValue === 'office' ? 'selected' : ''}>Office</option>
                <option value="warehouse" ${currentValue === 'warehouse' ? 'selected' : ''}>Warehouse</option>
                <option value="hideout" ${currentValue === 'hideout' ? 'selected' : ''}>Hideout</option>
            </select>
            <button onclick="renderPropertyStatsContent(${propertyId})" class="text-xs text-gray-400 hover:text-white">Cancel</button>
        </div>
    `;
    
    // Focus the select
    setTimeout(() => {
        const select = $(`type-select-${propertyId}`);
        if (select) select.focus();
    }, 50);
};

/**
 * Save property type change
 */
window.savePropertyType = async function(propertyId, newValue) {
    try {
        await PropertyDataService.write(propertyId, 'type', newValue);
        
        // Update filtered properties
        state.filteredProperties = [...properties];
        
        // Refresh all views
        renderPropertyStatsContent(propertyId);
        renderProperties(state.filteredProperties);
        if (state.currentUser === 'owner') renderOwnerDashboard();
        
        showToast('Property type updated!', 'success');
    } catch (error) {
        console.error('Failed to save property type:', error);
        showToast('Failed to update property type', 'error');
        renderPropertyStatsContent(propertyId);
    }
};

/**
 * Toggle property status (available/rented)
 */
window.togglePropertyStatus = async function(propertyId) {
    await toggleAvailability(propertyId);
    setTimeout(() => renderPropertyStatsContent(propertyId), 100);
};

// Toggle Premium listing status
window.togglePremiumStatus = async function(propertyId) {
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) return;
    
    const currentPremium = PropertyDataService.getValue(propertyId, 'isPremium', p.isPremium || false);
    const newPremium = !currentPremium;
    
    if (newPremium) {
        // Show premium enable modal instead of simple confirm
        showPremiumEnableModal(propertyId, p.title);
        return;
    }
    
    // Disabling premium - simple confirm
    if (!confirm('Disable Premium Listing?\n\nThis will remove the premium status and featured placement.')) {
        return;
    }
    
    try {
        await PropertyDataService.write(propertyId, 'isPremium', false);
        await PropertyDataService.write(propertyId, 'premiumUpdatedAt', new Date().toISOString());
        
        p.isPremium = false;
        renderPropertyStatsContent(propertyId);
        
        if (typeof renderProperties === 'function') {
            state.filteredProperties = [...properties];
            renderProperties(state.filteredProperties);
        }
        
        showToast('Premium Listing Deactivated', 'info');
        
    } catch (error) {
        console.error('Error toggling premium status:', error);
        alert('Failed to update premium status. Please try again.');
    }
};

// Show modal to enable premium with trial option
window.showPremiumEnableModal = function(propertyId, propertyTitle) {
    const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    
    // Free Trial section - only visible to admin
    const freeTrialSection = isAdmin ? `
                <!-- Free Trial Checkbox - Admin Only -->
                <div class="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-xl p-4 mb-4">
                    <label class="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" id="premiumTrialCheckbox" class="w-5 h-5 rounded border-cyan-500 text-cyan-500 focus:ring-cyan-500 cursor-pointer">
                        <div>
                            <span class="text-cyan-300 font-bold">🎁 Free Trial</span>
                            <p class="text-cyan-400/70 text-sm">Grant free premium trial (won't count as revenue)</p>
                        </div>
                    </label>
                </div>
    ` : '';
    
    // Payment notice for non-admin users
    const paymentNotice = !isAdmin ? `
                <div class="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-4">
                    <div class="flex items-center gap-2 text-red-300">
                        <span class="text-xl">⚠️</span>
                        <p class="text-sm"><strong>Weekly payment required</strong> - Pauly will contact you in-city to collect $10k payment</p>
                    </div>
                </div>
    ` : '';
    
    const modalHTML = `
        <div id="premiumEnableModal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onclick="if(event.target.id === 'premiumEnableModal') closePremiumEnableModal()">
            <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-amber-700/50" onclick="event.stopPropagation()">
                <h3 class="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">👑 Enable Premium Listing</h3>
                
                <div class="bg-gray-900/50 rounded-xl p-4 mb-4">
                    <p class="text-gray-300 mb-2"><strong>Property:</strong> ${propertyTitle}</p>
                    <p class="text-gray-300"><strong>Fee:</strong> <span class="text-amber-400 font-bold">$10,000/week</span></p>
                </div>
                
                <div class="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4 mb-4">
                    <div class="text-amber-300 font-bold mb-2">✨ Premium Benefits:</div>
                    <ul class="text-amber-200/80 text-sm space-y-1">
                        <li>✓ Top placement on Vehicles page</li>
                        <li>✓ Gold border and FEATURED badge</li>
                        <li>✓ Stand out from other listings</li>
                    </ul>
                </div>
                
                ${freeTrialSection}
                ${paymentNotice}
                
                <!-- Buttons -->
                <div class="flex gap-3">
                    <button onclick="confirmPremiumEnable(${propertyId})" 
                            class="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 py-3 rounded-xl font-bold hover:opacity-90 transition">
                        ✓ Enable Premium
                    </button>
                    <button onclick="closePremiumEnableModal()" 
                            class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closePremiumEnableModal = function() {
    const modal = $('premiumEnableModal');
    if (modal) modal.remove();
};

window.confirmPremiumEnable = async function(propertyId) {
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) return;
    
    const isTrial = $('premiumTrialCheckbox')?.checked || false;
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // Save premium status
        await PropertyDataService.write(propertyId, 'isPremium', true);
        await PropertyDataService.write(propertyId, 'isPremiumTrial', isTrial);
        await PropertyDataService.write(propertyId, 'premiumUpdatedAt', new Date().toISOString());
        await PropertyDataService.write(propertyId, 'premiumStartDate', today);
        
        // If not trial, set last payment date to today
        if (!isTrial) {
            await PropertyDataService.write(propertyId, 'premiumLastPayment', today);
        }
        
        // Update local property
        p.isPremium = true;
        p.isPremiumTrial = isTrial;
        
        // Create admin notification if NOT admin enabling it
        const currentUserEmail = auth.currentUser?.email?.toLowerCase();
        const ownerEmail = (p.ownerEmail || propertyOwnerEmail[propertyId] || '').toLowerCase();
        
        // Get owner display name if available
        let ownerDisplayName = '';
        try {
            const userDoc = await db.collection('users').doc(currentUserEmail).get();
            if (userDoc.exists) {
                ownerDisplayName = userDoc.data().displayName || currentUserEmail.split('@')[0];
            } else {
                ownerDisplayName = currentUserEmail.split('@')[0];
            }
        } catch (e) {
            ownerDisplayName = currentUserEmail.split('@')[0];
        }
        
        if (!TierService.isMasterAdmin(currentUserEmail)) {
            // Property owner enabled premium - notify admin
            try {
                await db.collection('adminNotifications').add({
                    type: 'premium_request',
                    propertyId: propertyId,
                    propertyTitle: p.title,
                    ownerEmail: ownerEmail,
                    ownerDisplayName: ownerDisplayName,
                    isTrial: isTrial,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    dismissed: false,
                    message: `${p.title} enabled premium${isTrial ? ' (trial)' : ' - collect $10k/week'}`
                });
            } catch (e) {
                console.error('[Premium] Failed to create admin notification:', e);
                // Non-critical error - don't block the premium activation
            }
        }
        
        closePremiumEnableModal();
        renderPropertyStatsContent(propertyId);
        
        if (typeof renderProperties === 'function') {
            state.filteredProperties = [...properties];
            renderProperties(state.filteredProperties);
        }
        
        if (isTrial) {
            showToast('🎁 Premium Trial Activated!', 'success');
        } else {
            showToast('👑 Premium Listing Activated!', 'success');
        }
        
    } catch (error) {
        console.error('Error enabling premium:', error);
        alert('Failed to enable premium. Please try again.');
    }
};

// Toggle premium between trial and paid
window.togglePremiumTrialStatus = async function(propertyId) {
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) return;
    
    const currentTrial = PropertyDataService.getValue(propertyId, 'isPremiumTrial', p.isPremiumTrial || false);
    const newTrial = !currentTrial;
    
    const action = newTrial ? 'Convert to Free Trial?' : 'Convert to Paid ($10k/week)?';
    if (!confirm(action + '\n\nThis will update the premium status.')) {
        return;
    }
    
    try {
        await PropertyDataService.write(propertyId, 'isPremiumTrial', newTrial);
        
        // If converting to paid, set last payment to today
        if (!newTrial) {
            const today = new Date().toISOString().split('T')[0];
            await PropertyDataService.write(propertyId, 'premiumLastPayment', today);
        }
        
        p.isPremiumTrial = newTrial;
        renderPropertyStatsContent(propertyId);
        
        if (newTrial) {
            showToast('🎁 Converted to Free Trial', 'info');
        } else {
            showToast('💰 Converted to Paid Premium', 'success');
        }
        
    } catch (error) {
        console.error('Error toggling premium trial:', error);
        alert('Failed to update. Please try again.');
    }
};

// ==================== PAYMENT LEDGER SYSTEM ====================

// Log a payment to the property's payment history
window.logPayment = async function(propertyId, paymentData) {
    try {
        // Get existing payment history
        const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
        let payments = [];
        
        if (historyDoc.exists) {
            payments = historyDoc.data().payments || [];
        } else {
        }
        
        // Add new payment
        const newPayment = {
            ...paymentData,
            id: Date.now().toString() // Unique ID for this payment
        };
        payments.push(newPayment);
        // Save back to Firestore
        await db.collection('paymentHistory').doc(String(propertyId)).set({
            propertyId: propertyId,
            payments: payments,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('[PaymentLog] Error logging payment:', error);
        console.error('[PaymentLog] Error details:', error.code, error.message);
        
        // Show error toast if available
        if (typeof showToast === 'function') {
            showToast('⚠️ Payment may not have been logged: ' + error.message, 'error');
        }
        return false;
    }
};

// Show payment confirmation modal with copyable thank you message
window.showPaymentConfirmationModal = function(renterName, nextDueDate, amount, rtoInfo = null) {
    // Get display name - handle titles like Dr., Mr., Mrs., Ms.
    const nameParts = renterName.trim().split(' ');
    const titles = ['dr.', 'dr', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms', 'miss', 'prof.', 'prof'];
    let displayName;
    
    if (nameParts.length >= 2 && titles.includes(nameParts[0].toLowerCase())) {
        // Has a title - use "Title Lastname" (e.g., "Dr. Smith")
        const title = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        displayName = `${title} ${lastName}`;
    } else {
        // No title - just use first name
        displayName = nameParts[0];
    }
    
    let thankYouMessage;
    let headerSubtext;
    let rtoBadge = '';
    
    if (rtoInfo && rtoInfo.isDeposit) {
        // DEPOSIT PAYMENT MESSAGE
        thankYouMessage = `Thanks ${displayName}! 🙏 Your deposit of $${amount.toLocaleString()} for your Rent-to-Own agreement has been received. Your first monthly payment of $${rtoInfo.monthlyAmount.toLocaleString()} will be due on ${nextDueDate}. Let me know if you have any questions!`;
        headerSubtext = `$${amount.toLocaleString()} deposit from ${renterName}`;
        rtoBadge = `<p class="text-emerald-400 text-sm mt-1">💰 RTO Deposit Received</p>`;
    } else if (rtoInfo && !rtoInfo.isDeposit) {
        // MONTHLY RTO PAYMENT MESSAGE
        const rtoPaymentStr = ` (Payment ${rtoInfo.current} of ${rtoInfo.total} in your Rent-to-Own agreement)`;
        thankYouMessage = `Thanks ${displayName}! 🙏 Your payment of $${amount.toLocaleString()}${rtoPaymentStr} has been received. Your next payment is due on ${nextDueDate}. Let me know if you have any questions!`;
        headerSubtext = `$${amount.toLocaleString()} from ${renterName}`;
        rtoBadge = `<p class="text-amber-400 text-sm mt-1">📋 RTO Payment ${rtoInfo.current} of ${rtoInfo.total}</p>`;
    } else {
        // REGULAR (NON-RTO) PAYMENT MESSAGE
        thankYouMessage = `Thanks ${displayName}! 🙏 Your payment of $${amount.toLocaleString()} has been received. Your next payment is due on ${nextDueDate}. Let me know if you have any questions!`;
        headerSubtext = `$${amount.toLocaleString()} from ${renterName}`;
    }
    
    // Create modal HTML
    const modalHTML = `
        <div id="paymentConfirmModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) closePaymentConfirmModal()">
            <div class="bg-gray-900 rounded-2xl max-w-lg w-full p-6 border border-green-500/30 shadow-2xl" onclick="event.stopPropagation()">
                <div class="text-center mb-4">
                    <div class="text-5xl mb-3">✅</div>
                    <h3 class="text-2xl font-bold text-green-400">${rtoInfo && rtoInfo.isDeposit ? 'Deposit Received!' : 'Payment Logged!'}</h3>
                    <p class="text-gray-400 mt-1">${headerSubtext}</p>
                    ${rtoBadge}
                </div>
                
                <div class="bg-gray-800 rounded-xl p-4 mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm text-gray-400 font-medium">📋 Copy this message to send to ${displayName}:</span>
                    </div>
                    <div id="thankYouMessageText" class="bg-gray-700/50 rounded-lg p-3 text-white text-sm leading-relaxed border border-gray-600">
                        ${thankYouMessage}
                    </div>
                </div>
                
                <div class="flex gap-3">
                    <button onclick="copyThankYouMessage()" class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2">
                        <span>📋</span> Copy Message
                    </button>
                    <button onclick="closePaymentConfirmModal()" class="flex-1 bg-gray-700 text-white py-3 px-4 rounded-xl font-bold hover:bg-gray-600 transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modal
    const existing = document.getElementById('paymentConfirmModal');
    if (existing) existing.remove();
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Store message for copy function
    window.currentThankYouMessage = thankYouMessage;
};

window.copyThankYouMessage = async function() {
    try {
        await navigator.clipboard.writeText(window.currentThankYouMessage);
        
        // Update button to show success
        const btn = document.querySelector('#paymentConfirmModal button');
        if (btn) {
            btn.innerHTML = '<span>✅</span> Copied!';
            btn.classList.remove('from-green-500', 'to-emerald-600');
            btn.classList.add('from-blue-500', 'to-purple-600');
        }
        
        if (typeof showToast === 'function') {
            showToast('📋 Message copied to clipboard!', 'success');
        }
    } catch (e) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = window.currentThankYouMessage;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (typeof showToast === 'function') {
            showToast('📋 Message copied!', 'success');
        }
    }
};

window.closePaymentConfirmModal = function() {
    const modal = document.getElementById('paymentConfirmModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.2s';
        setTimeout(() => modal.remove(), 200);
    }
};

// Get payment history for a property
window.getPaymentHistory = async function(propertyId) {
    try {
        const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
        if (historyDoc.exists) {
            const payments = historyDoc.data().payments || [];
            return payments;
        }
        return [];
    } catch (error) {
        console.error('[PaymentLog] Error fetching history:', error);
        console.error('[PaymentLog] Error code:', error.code);
        
        // If permission denied, show a warning
        if (error.code === 'permission-denied') {
            console.warn('[PaymentLog] Permission denied - check Firestore rules for paymentHistory collection');
        }
        return [];
    }
};

// Delete a payment from the ledger
window.deletePayment = async function(propertyId, paymentId) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this payment? This will update all financial stats and reverse any XP earned.')) {
        return;
    }
    try {
        // Get existing payment history
        const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
        
        if (!historyDoc.exists) {
            showToast('❌ Payment history not found', 'error');
            return;
        }
        
        let payments = historyDoc.data().payments || [];
        const originalCount = payments.length;
        
        // Find and remove the payment
        payments = payments.filter(p => p.id !== paymentId);
        
        if (payments.length === originalCount) {
            showToast('❌ Payment not found', 'error');
            return;
        }
        
        // Save back to Firestore
        await db.collection('paymentHistory').doc(String(propertyId)).set({
            propertyId: propertyId,
            payments: payments,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Reverse the XP that was awarded for this payment
        const user = auth.currentUser;
        if (user && typeof GamificationService !== 'undefined') {
            try {
                const property = properties.find(p => p.id === propertyId);
                const propertyTitle = property?.title || `Property ${propertyId}`;
                await GamificationService.deductXP(user.uid, 100, `Payment deleted for ${propertyTitle}`);
                showToast('🗑️ Payment deleted, 100 XP reversed', 'success');
            } catch (xpError) {
                console.error('[PaymentLog] Error reversing XP:', xpError);
                showToast('🗑️ Payment deleted (XP reversal failed)', 'warning');
            }
        } else {
            showToast('🗑️ Payment deleted - refreshing stats...', 'success');
        }
        
        // Refresh the analytics view
        await refreshPropertyAnalytics(propertyId);
        
    } catch (error) {
        console.error('[PaymentLog] Error deleting payment:', error);
        showToast('❌ Error deleting payment: ' + error.message, 'error');
    }
};

// Refresh property analytics after payment changes
window.refreshPropertyAnalytics = async function(propertyId) {
    // Find the property
    const property = properties.find(p => p.id === propertyId);
    if (!property) {
        console.error('[Analytics] Property not found:', propertyId);
        return;
    }
    
    // Re-fetch payment history
    const payments = await getPaymentHistory(propertyId);
    
    // Recalculate analytics
    const analytics = calculatePropertyAnalytics(payments, property);
    
    // Update the analytics container if it exists
    const analyticsContainer = document.getElementById(`propertyAnalytics-${propertyId}`);
    if (analyticsContainer) {
        analyticsContainer.innerHTML = renderPropertyAnalytics(property, payments, analytics);
    }
    
    // Also refresh the stats page if we're viewing this property
    if (state && state.currentPropertyId === propertyId) {
        // Re-render the stats page content
        renderPropertyStatsContent(propertyId);
    }
};

// Calculate property analytics from payment history
window.calculatePropertyAnalytics = function(payments, property) {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    
    // Filter out premium_fee payments - these are fees the owner PAYS, not income they receive
    const rentPayments = payments.filter(p => p.type !== 'premium_fee');
    
    // Sort payments by date
    const sortedPayments = [...rentPayments].sort((a, b) => 
        new Date(a.paymentDate) - new Date(b.paymentDate)
    );
    
    // YTD calculations
    const ytdPayments = sortedPayments.filter(p => new Date(p.paymentDate) >= yearStart);
    const totalEarnings = sortedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const ytdEarnings = ytdPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Payment counts
    const totalPayments = sortedPayments.length;
    const ytdPaymentCount = ytdPayments.length;
    
    // Average rent calculation
    const avgRent = totalPayments > 0 ? Math.round(totalEarnings / totalPayments) : 0;
    
    // Renter breakdown - also filter out premium_fee entries
    const renterStats = {};
    sortedPayments.forEach(p => {
        const name = p.renterName || 'Unknown';
        if (!renterStats[name]) {
            renterStats[name] = { count: 0, total: 0, payments: [] };
        }
        renterStats[name].count++;
        renterStats[name].total += (p.amount || 0);
        renterStats[name].payments.push(p);
    });
    
    // Monthly breakdown for charting
    const monthlyData = {};
    sortedPayments.forEach(p => {
        const date = new Date(p.paymentDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { earnings: 0, payments: 0 };
        }
        monthlyData[monthKey].earnings += (p.amount || 0);
        monthlyData[monthKey].payments++;
    });
    
    // Calculate rental period (time since first payment or first renter set)
    let firstPaymentDate = null;
    if (sortedPayments.length > 0) {
        firstPaymentDate = new Date(sortedPayments[0].paymentDate);
    }
    
    const daysSinceFirstPayment = firstPaymentDate 
        ? Math.floor((now - firstPaymentDate) / (1000 * 60 * 60 * 24))
        : 0;
    
    // Calculate occupancy rate (payments made / payments expected)
    // This measures payment consistency - 100% means all expected payments were made
    let expectedPayments = 0;
    let occupancyRate = 0;
    
    if (firstPaymentDate && totalPayments > 0) {
        const frequency = PropertyDataService.getValue(property?.id, 'paymentFrequency', 'weekly');
        let daysBetweenPayments = 7; // default weekly
        if (frequency === 'biweekly') daysBetweenPayments = 14;
        else if (frequency === 'monthly') daysBetweenPayments = 30;
        
        // Expected payments = (days since first payment / days between payments) + 1 (for the first payment)
        // Use ceiling to account for current period
        expectedPayments = Math.max(1, Math.ceil(daysSinceFirstPayment / daysBetweenPayments) + 1);
        
        // Calculate occupancy - cap at 100%
        occupancyRate = Math.min(100, Math.round((totalPayments / expectedPayments) * 100));
        
        // If only 1 payment and it's recent (within one payment cycle), show 100%
        if (totalPayments === 1 && daysSinceFirstPayment < daysBetweenPayments) {
            occupancyRate = 100;
        }
    }
    
    return {
        totalEarnings,
        ytdEarnings,
        totalPayments,
        ytdPaymentCount,
        avgRent,
        renterStats,
        monthlyData,
        firstPaymentDate,
        daysSinceFirstPayment,
        occupancyRate,
        sortedPayments
    };
};

// Render analytics section on property stats page
window.renderPropertyAnalytics = async function(propertyId) {
    const container = $('propertyAnalyticsSection');
    if (!container) return;
    
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) return;
    
    // Show loading
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="text-4xl mb-4 animate-pulse">📊</div>
            <p class="text-gray-400">Loading analytics...</p>
        </div>
    `;
    
    // Fetch payment history (includes tenure history)
    const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
    const historyData = historyDoc.exists ? historyDoc.data() : { payments: [], tenureHistory: [], vacancyPeriods: [] };
    const payments = historyData.payments || [];
    const tenureHistory = historyData.tenureHistory || [];
    const vacancyPeriods = historyData.vacancyPeriods || [];
    
    const analytics = calculatePropertyAnalytics(payments, p);
    
    // Generate monthly chart data
    const months = Object.keys(analytics.monthlyData).sort();
    const lastSixMonths = months.slice(-6);
    
    // Calculate current vacancy duration if applicable
    let currentVacancy = null;
    const ongoingVacancy = vacancyPeriods.find(v => v.status === 'ongoing');
    if (ongoingVacancy && state.availability[propertyId] === true) {
        const startDate = new Date(ongoingVacancy.startDate);
        const today = new Date();
        const vacancyDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
        currentVacancy = {
            days: vacancyDays,
            startDate: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
    }
    
    container.innerHTML = `
        <!-- Summary Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-4 border border-green-600/30 cursor-help" title="Total rent collected from this property since tracking began">
                <div class="text-green-400 text-sm font-semibold">💰 Total Earnings</div>
                <div class="text-2xl font-black text-white">$${analytics.totalEarnings.toLocaleString()}</div>
                <div class="text-green-300/70 text-xs">${analytics.totalPayments} payment${analytics.totalPayments !== 1 ? 's' : ''}</div>
            </div>
            <div class="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 rounded-xl p-4 border border-blue-600/30 cursor-help" title="Rent collected in ${new Date().getFullYear()} only">
                <div class="text-blue-400 text-sm font-semibold">📅 YTD Earnings</div>
                <div class="text-2xl font-black text-white">$${analytics.ytdEarnings.toLocaleString()}</div>
                <div class="text-blue-300/70 text-xs">${analytics.ytdPaymentCount} payment${analytics.ytdPaymentCount !== 1 ? 's' : ''} this year</div>
            </div>
            <div class="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-4 border border-purple-600/30 cursor-help" title="Average amount per payment (Total ÷ # of payments)">
                <div class="text-purple-400 text-sm font-semibold">💵 Avg Payment</div>
                <div class="text-2xl font-black text-white">$${analytics.avgRent.toLocaleString()}</div>
                <div class="text-purple-300/70 text-xs">per payment cycle</div>
            </div>
            <div class="bg-gradient-to-br from-amber-900/50 to-orange-900/50 rounded-xl p-4 border border-amber-600/30 cursor-help" title="Payment consistency: 100% = all expected payments made on time. Calculated as (payments received ÷ payments expected) based on payment frequency.">
                <div class="text-amber-400 text-sm font-semibold">📈 Occupancy</div>
                <div class="text-2xl font-black text-white">${analytics.occupancyRate}%</div>
                <div class="text-amber-300/70 text-xs">${analytics.daysSinceFirstPayment} day${analytics.daysSinceFirstPayment !== 1 ? 's' : ''} tracked</div>
            </div>
        </div>
        
        ${currentVacancy ? `
        <!-- Current Vacancy Alert -->
        <div class="bg-gradient-to-r from-gray-800/80 to-gray-900/80 border border-gray-600 rounded-xl p-4 mb-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="text-3xl">🚗</div>
                    <div>
                        <div class="text-gray-200 font-bold">Currently Vacant</div>
                        <div class="text-gray-400 text-sm">Since ${currentVacancy.startDate} • ${currentVacancy.days} day${currentVacancy.days !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-gray-400 text-xs uppercase">Potential Lost Revenue</div>
                    <div class="text-red-400 font-bold">$${Math.round((p.weeklyPrice / 7) * currentVacancy.days).toLocaleString()}</div>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Monthly Earnings Chart -->
        <div class="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700">
            <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span> Monthly Earnings Trend
            </h4>
            <div id="earningsChart-${propertyId}" class="h-48">
                ${renderEarningsChart(lastSixMonths, analytics.monthlyData)}
            </div>
        </div>
        
        ${tenureHistory.length > 0 ? `
        <!-- Completed Tenures -->
        <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-4 mb-6 border border-green-600/30">
            <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>📜</span> Completed Tenures
                <span class="text-xs font-normal text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full">${tenureHistory.length} former renter${tenureHistory.length !== 1 ? 's' : ''}</span>
            </h4>
            <div class="space-y-3">
                ${tenureHistory.slice().reverse().map(tenure => `
                    <div class="bg-gray-900/70 rounded-xl p-4 border border-gray-700 group relative">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                                    ${tenure.renterName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div class="text-white font-bold">${tenure.renterName}</div>
                                    <div class="text-gray-400 text-sm">
                                        ${tenure.paymentCount || 0} × $${(tenure.avgPayment || tenure.totalCollected / (tenure.paymentCount || 1)).toLocaleString()} 
                                        <span class="capitalize">${tenure.paymentFrequency || 'payment'}${tenure.paymentCount !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                    Lease Completed
                                </div>
                                <button onclick="deleteTenureRecord(${propertyId}, '${tenure.id}')" 
                                    class="sm:opacity-0 sm:group-hover:opacity-100 p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-all"
                                    title="Delete this tenure record">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div class="bg-gray-800/50 rounded-lg p-2">
                                <div class="text-gray-400 text-xs uppercase">Total Collected</div>
                                <div class="text-green-400 font-bold">$${(tenure.totalCollected || 0).toLocaleString()}</div>
                            </div>
                            <div class="bg-gray-800/50 rounded-lg p-2">
                                <div class="text-gray-400 text-xs uppercase">Tenure</div>
                                <div class="text-white font-bold">${tenure.tenureDays || 0} days</div>
                                <div class="text-gray-500 text-xs">${tenure.tenureWeeks || Math.round((tenure.tenureDays || 0) / 7 * 10) / 10} weeks</div>
                            </div>
                            <div class="bg-gray-800/50 rounded-lg p-2">
                                <div class="text-gray-400 text-xs uppercase">Started</div>
                                <div class="text-white font-bold text-sm">${tenure.startDate || 'N/A'}</div>
                            </div>
                            <div class="bg-gray-800/50 rounded-lg p-2">
                                <div class="text-gray-400 text-xs uppercase">Ended</div>
                                <div class="text-white font-bold text-sm">${tenure.endDate || 'N/A'}</div>
                            </div>
                        </div>
                        ${tenure.renterNotes ? `
                        <div class="mt-3 pt-3 border-t border-gray-700">
                            <div class="text-gray-400 text-xs uppercase mb-1">Notes</div>
                            <div class="text-gray-300 text-sm">${tenure.renterNotes}</div>
                        </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- Renter Breakdown -->
        <div class="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700">
            <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>👥</span> Renter History
            </h4>
            <div class="space-y-3">
                ${Object.entries(analytics.renterStats).length > 0 
                    ? Object.entries(analytics.renterStats).map(([name, stats]) => `
                        <div class="bg-gray-900/50 rounded-lg p-3 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                    ${name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div class="text-white font-semibold">${name}</div>
                                    <div class="text-gray-400 text-sm">${stats.count} payment${stats.count > 1 ? 's' : ''}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-green-400 font-bold">$${stats.total.toLocaleString()}</div>
                                <div class="text-gray-500 text-xs">total paid</div>
                            </div>
                        </div>
                    `).join('')
                    : '<p class="text-gray-500 text-center py-4">No renter history yet</p>'
                }
            </div>
        </div>
        
        <!-- Payment Ledger -->
        <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div class="flex items-center justify-between mb-4">
                <h4 class="text-lg font-bold text-white flex items-center gap-2">
                    <span>📒</span> Payment Ledger
                </h4>
                <button onclick="toggleLedgerExpand(${propertyId})" class="text-purple-400 hover:text-purple-300 text-sm font-semibold">
                    ${payments.length > 5 ? 'View All (' + payments.length + ')' : ''}
                </button>
            </div>
            <div id="paymentLedger-${propertyId}" class="space-y-2 max-h-80 overflow-y-auto">
                ${payments.length > 0 
                    ? analytics.sortedPayments
                        .slice().reverse()
                        .filter(p => p.type !== 'eviction' && (p.amount || 0) > 0) // Filter out evictions and $0 entries
                        .slice(0, 10).map((p, i) => `
                        <div class="bg-gray-900/50 rounded-lg p-3 flex items-center justify-between text-sm ${i === 0 ? 'ring-2 ring-green-500/50' : ''} group">
                            <div class="flex items-center gap-3">
                                <div class="text-2xl">${i === 0 ? '✅' : '💵'}</div>
                                <div>
                                    <div class="text-white font-medium">${p.renterName || 'Unknown'}</div>
                                    <div class="text-gray-400 text-xs">
                                        Paid for: ${formatDate(p.paymentDate)} 
                                        <span class="text-gray-600">•</span> 
                                        ${p.frequency || 'weekly'}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-right">
                                    <div class="text-green-400 font-bold">$${(p.amount || 0).toLocaleString()}</div>
                                    <div class="text-gray-500 text-xs">
                                        ${p.recordedAt && !isNaN(new Date(p.recordedAt)) 
                                            ? new Date(p.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                            : (p.paymentDate || 'Unknown date')}
                                    </div>
                                </div>
                                <button onclick="deletePayment(${propertyId}, '${p.id}')" 
                                    class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-all"
                                    title="Delete this payment">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `).join('')
                    : `
                        <div class="text-center py-8">
                            <div class="text-4xl mb-2">📭</div>
                            <p class="text-gray-500">No payments recorded yet</p>
                            <p class="text-gray-600 text-sm mt-1">Payments are logged when you update the "Last Payment" date</p>
                        </div>
                    `
                }
            </div>
            ${payments.length > 10 ? `
                <button onclick="showFullLedger(${propertyId})" class="w-full mt-4 py-2 text-center text-purple-400 hover:text-purple-300 font-semibold border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition">
                    View Full Ledger (${payments.length} entries)
                </button>
            ` : ''}
        </div>
    `;
};

// Render simple bar chart for earnings
window.renderEarningsChart = function(months, monthlyData) {
    if (months.length === 0) {
        return `
            <div class="flex items-center justify-center h-full text-gray-500">
                <div class="text-center">
                    <div class="text-3xl mb-2">📊</div>
                    <p>No earnings data yet</p>
                </div>
            </div>
        `;
    }
    
    const maxEarnings = Math.max(...months.map(m => monthlyData[m]?.earnings || 0), 1);
    
    return `
        <div class="flex items-end justify-around h-full gap-2 px-4">
            ${months.map(month => {
                const data = monthlyData[month] || { earnings: 0, payments: 0 };
                const heightPercent = (data.earnings / maxEarnings) * 100;
                const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' });
                return `
                    <div class="flex-1 flex flex-col items-center gap-2">
                        <div class="text-xs text-green-400 font-bold">$${(data.earnings / 1000).toFixed(0)}k</div>
                        <div class="w-full bg-gray-700 rounded-t-lg relative" style="height: 120px;">
                            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-600 to-emerald-500 rounded-t-lg transition-all duration-500" 
                                 style="height: ${Math.max(heightPercent, 5)}%;">
                            </div>
                        </div>
                        <div class="text-xs text-gray-400">${monthLabel}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
};

// Show full ledger modal
window.showFullLedger = async function(propertyId) {
    const payments = await getPaymentHistory(propertyId);
    const p = properties.find(prop => prop.id === propertyId);
    
    const sortedPayments = [...payments].sort((a, b) => 
        new Date(b.paymentDate) - new Date(a.paymentDate)
    );
    
    const totalEarnings = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const modalHTML = `
        <div id="fullLedgerModal" class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-purple-700">
                <div class="bg-gradient-to-r from-purple-900 to-pink-900 p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-xl font-bold text-white flex items-center gap-2">
                                <span>📒</span> Complete Payment Ledger
                            </h3>
                            <p class="text-purple-200 text-sm mt-1">${p?.title || 'Property'}</p>
                        </div>
                        <button onclick="closeFullLedger()" class="text-white/70 hover:text-white text-2xl">&times;</button>
                    </div>
                    <div class="mt-4 flex gap-4 text-sm">
                        <div class="bg-white/10 rounded-lg px-4 py-2">
                            <span class="text-purple-200">Total Payments:</span>
                            <span class="text-white font-bold ml-2">${payments.length}</span>
                        </div>
                        <div class="bg-white/10 rounded-lg px-4 py-2">
                            <span class="text-purple-200">Total Earned:</span>
                            <span class="text-green-400 font-bold ml-2">$${totalEarnings.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto max-h-[60vh]">
                    <table class="w-full">
                        <thead>
                            <tr class="text-left text-gray-400 text-sm border-b border-gray-700">
                                <th class="pb-3">Date</th>
                                <th class="pb-3">Renter</th>
                                <th class="pb-3">Frequency</th>
                                <th class="pb-3 text-right">Amount</th>
                                <th class="pb-3 text-right">Recorded</th>
                                <th class="pb-3 text-center w-16">Delete</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm">
                            ${sortedPayments.map((payment, i) => `
                                <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 group">
                                    <td class="py-3 text-white font-medium">${formatDate(payment.paymentDate)}</td>
                                    <td class="py-3 text-gray-300">${payment.renterName || 'Unknown'}</td>
                                    <td class="py-3">
                                        <span class="px-2 py-1 rounded-full text-xs font-semibold ${
                                            payment.frequency === 'monthly' ? 'bg-purple-500/20 text-purple-300' :
                                            payment.frequency === 'biweekly' ? 'bg-blue-500/20 text-blue-300' :
                                            payment.frequency === 'daily' ? 'bg-cyan-500/20 text-cyan-300' :
                                            'bg-green-500/20 text-green-300'
                                        }">
                                            ${payment.frequency || 'weekly'}
                                        </span>
                                    </td>
                                    <td class="py-3 text-right text-green-400 font-bold">$${(payment.amount || 0).toLocaleString()}</td>
                                    <td class="py-3 text-right text-gray-500 text-xs">
                                        ${new Date(payment.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                                    </td>
                                    <td class="py-3 text-center">
                                        <button onclick="deletePaymentFromModal(${propertyId}, '${payment.id}')" 
                                            class="opacity-50 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-all"
                                            title="Delete this payment">
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existing = $('fullLedgerModal');
    if (existing) existing.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Delete payment from the full ledger modal (refreshes modal after)
window.deletePaymentFromModal = async function(propertyId, paymentId) {
    if (!confirm('Are you sure you want to delete this payment? This will update all financial stats and reverse any XP earned.')) {
        return;
    }
    try {
        const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
        
        if (!historyDoc.exists) {
            showToast('❌ Payment history not found', 'error');
            return;
        }
        
        let payments = historyDoc.data().payments || [];
        const originalCount = payments.length;
        payments = payments.filter(p => p.id !== paymentId);
        
        if (payments.length === originalCount) {
            showToast('❌ Payment not found', 'error');
            return;
        }
        
        await db.collection('paymentHistory').doc(String(propertyId)).set({
            propertyId: propertyId,
            payments: payments,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Reverse the XP that was awarded for this payment
        const user = auth.currentUser;
        if (user && typeof GamificationService !== 'undefined') {
            try {
                const property = properties.find(p => p.id === propertyId);
                const propertyTitle = property?.title || `Property ${propertyId}`;
                await GamificationService.deductXP(user.uid, 100, `Payment deleted for ${propertyTitle}`);
                showToast('🗑️ Payment deleted, 100 XP reversed', 'success');
            } catch (xpError) {
                console.error('[PaymentLog] Error reversing XP:', xpError);
                showToast('🗑️ Payment deleted (XP reversal failed)', 'warning');
            }
        } else {
            showToast('🗑️ Payment deleted', 'success');
        }
        
        // Refresh the modal
        await showFullLedger(propertyId);
        
        // Also refresh analytics
        await refreshPropertyAnalytics(propertyId);
        
    } catch (error) {
        console.error('[PaymentLog] Error deleting payment:', error);
        showToast('❌ Error: ' + error.message, 'error');
    }
};

window.closeFullLedger = function() {
    const modal = $('fullLedgerModal');
    if (modal) modal.remove();
};

// ==================== EVENT LISTENERS ====================
// Firebase login form
document.addEventListener('DOMContentLoaded', function() {
    // Set footer year dynamically
    const footerYearEl = document.getElementById('footerYear');
    if (footerYearEl) {
        footerYearEl.textContent = new Date().getFullYear();
    }
    
    const loginForm = $('firebaseLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            let email = $('ownerEmail').value.trim().toLowerCase();
            const password = $('ownerPassword').value;
            const btn = $('loginSubmitBtn');
            const errorDiv = $('loginError');
            
            // Auto-append @pma.network if no @ symbol
            if (!email.includes('@')) {
                email = email + '@pma.network';
            }
            
            btn.disabled = true;
            btn.textContent = 'Signing In...';
            hideElement(errorDiv);
            
            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    state.currentUser = 'owner';
                    closeModal('loginModal');
                    hideOwnerLoginForm();
                    hideElement($('renterSection'));
                    hideElement($('vehicleDetailPage'));
                    hideElement($('vehicleStatsPage'));
                    showElement($('ownerDashboard'));
                    updateAuthButton(true);
                    renderOwnerDashboard();
                    loadUsername();
                    window.scrollTo(0, 0);
                })
                .catch(error => {
                    const messages = {
                        'auth/user-not-found': 'No account found with this username.',
                        'auth/wrong-password': 'Incorrect password. Please try again.',
                        'auth/invalid-credential': 'Invalid username or password.',
                        'auth/too-many-requests': 'Too many failed attempts. Please try again later.'
                    };
                    errorDiv.textContent = messages[error.code] || 'Invalid username or password. Please try again.';
                    showElement(errorDiv);
                })
                .finally(() => {
                    btn.disabled = false;
                    btn.textContent = 'Sign In';
                });
        });
    }
    
    // Mobile menu
    const menuBtn = $('menuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => $('mobileMenu').classList.toggle('hidden'));
    }
});

// ==================== EDIT TITLE/LOCATION ====================
window.startEditField = function(field, propertyId, element) {
    const currentValue = PropertyDataService.getValue(propertyId, field, properties.find(p => p.id === propertyId)?.[field]);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'bg-gray-800 border-2 border-purple-500 rounded-lg px-3 py-2 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400';
    input.style.width = Math.max(200, element.offsetWidth + 50) + 'px';
    
    const originalContent = element.innerHTML;
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();
    
    const saveField = async () => {
        const newValue = input.value.trim();
        if (newValue && newValue !== currentValue) {
            element.innerHTML = '<span class="text-gray-400">Saving...</span>';
            try {
                await PropertyDataService.write(propertyId, field, newValue);
                
                // Update local property object
                const prop = properties.find(p => p.id === propertyId);
                if (prop) prop[field] = newValue;
                
                // Update Firestore properties doc for user-created properties
                await db.collection('settings').doc('properties').set({
                    [propertyId]: properties.find(p => p.id === propertyId)
                }, { merge: true });
                
                renderPropertyStatsContent(propertyId);
                renderProperties(state.filteredProperties);
            } catch (error) {
                console.error('Failed to save:', error);
                element.innerHTML = originalContent;
            }
        } else {
            element.innerHTML = currentValue;
        }
    };
    
    input.addEventListener('blur', saveField);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            element.innerHTML = currentValue;
        }
    });
};

// ==================== IMAGE MANAGEMENT ====================
window.openAddImageModal = function(propertyId) {
    window.currentImagePropertyId = propertyId;
    const textarea = $('newImageUrls');
    if (textarea) textarea.value = '';
    hideElement($('addImageError'));
    openModal('addImageModal');
};

window.closeAddImageModal = function() {
    closeModal('addImageModal');
    window.currentImagePropertyId = null;
};

// Updated to handle multiple image URLs (bulk paste)
window.saveNewImages = async function() {
    const propertyId = window.currentImagePropertyId;
    if (!propertyId) return;
    
    const textarea = $('newImageUrls');
    const rawText = textarea ? textarea.value.trim() : '';
    const errorDiv = $('addImageError');
    const warningDiv = $('addImageWarning');
    
    // Hide previous messages
    hideElement(errorDiv);
    if (warningDiv) hideElement(warningDiv);
    
    if (!rawText) {
        errorDiv.textContent = 'Please enter at least one image URL';
        showElement(errorDiv);
        return;
    }
    
    // Parse URLs - split by newlines and filter empty lines
    const urls = rawText.split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    if (urls.length === 0) {
        errorDiv.textContent = 'Please enter at least one image URL';
        showElement(errorDiv);
        return;
    }
    
    // Check for local file paths (these won't work at all)
    const localFilePaths = urls.filter(url => url.startsWith('file:///') || url.match(/^[A-Za-z]:\\/));
    if (localFilePaths.length > 0) {
        errorDiv.innerHTML = `<strong>❌ Local file paths don't work!</strong><br>
            Files on your computer (like <code class="text-red-300">C:\\Users\\...</code>) can't be seen by other users.<br>
            <span class="text-cyan-400">Please upload to <a href="https://fivemanage.com" target="_blank" class="underline">fivemanage.com</a> first, then paste the link here.</span>`;
        showElement(errorDiv);
        return;
    }
    
    // Validate all URLs start with http/https
    const invalidUrls = urls.filter(url => !url.startsWith('http://') && !url.startsWith('https://'));
    if (invalidUrls.length > 0) {
        errorDiv.textContent = `Invalid URL(s): ${invalidUrls.slice(0, 2).join(', ')}${invalidUrls.length > 2 ? '...' : ''}. URLs must start with http:// or https://`;
        showElement(errorDiv);
        return;
    }
    
    // Check for Discord links (warning, not error - they might still want to use them)
    const discordUrls = urls.filter(url => url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net'));
    if (discordUrls.length > 0 && warningDiv) {
        warningDiv.innerHTML = `<div class="flex items-start gap-2">
            <span class="text-yellow-400">⚠️</span>
            <div>
                <strong class="text-yellow-300">Warning: Discord links expire!</strong><br>
                <span class="text-gray-300">Discord image links stop working after a few weeks. Your property photos will break.</span><br>
                <span class="text-cyan-400">We recommend using <a href="https://fivemanage.com" target="_blank" class="underline font-semibold">fivemanage.com</a> instead (it's free!).</span>
            </div>
        </div>
        <div class="mt-2 flex gap-2">
            <button onclick="document.getElementById('addImageWarning').classList.add('hidden'); saveNewImagesConfirmed();" class="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded text-sm font-bold">Add Anyway</button>
            <button onclick="document.getElementById('addImageWarning').classList.add('hidden');" class="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm font-bold">Let Me Fix It</button>
        </div>`;
        showElement(warningDiv);
        return;
    }
    
    // No warnings, proceed with save
    await saveNewImagesConfirmed();
};

// Actual save function (called after warnings acknowledged)
window.saveNewImagesConfirmed = async function() {
    const propertyId = window.currentImagePropertyId;
    if (!propertyId) return;
    
    const textarea = $('newImageUrls');
    const rawText = textarea ? textarea.value.trim() : '';
    const errorDiv = $('addImageError');
    
    const urls = rawText.split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    
    const btn = $('saveImageBtn');
    btn.disabled = true;
    btn.textContent = `Adding ${urls.length} image${urls.length > 1 ? 's' : ''}...`;
    
    try {
        const prop = properties.find(p => p.id === propertyId);
        if (!prop) throw new Error('Property not found');
        
        // Initialize images array if needed
        if (!prop.images) prop.images = [];
        
        // Add all new images to array
        prop.images.push(...urls);
        state.currentImages = prop.images;
        
        // Ensure owner info is set
        if (!prop.ownerEmail) {
            prop.ownerEmail = (auth.currentUser?.email || 'richard2019201900@gmail.com').toLowerCase();
        }
        
        // Save to Firestore
        await db.collection('settings').doc('properties').set({
            [propertyId]: prop
        }, { merge: true });
        
        // Re-render
        renderPropertyStatsContent(propertyId);
        closeAddImageModal();
        
        // Show success toast
        if (typeof showToast === 'function') {
            showToast(`Added ${urls.length} image${urls.length > 1 ? 's' : ''} successfully!`, 'success');
        }
        
    } catch (error) {
        console.error('Failed to add images:', error);
        errorDiv.textContent = 'Failed to add images. Please try again.';
        showElement(errorDiv);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add Images';
    }
};

// Keep old function for backwards compatibility
window.saveNewImage = window.saveNewImages;

window.deletePropertyImage = async function(propertyId, imageIndex, imageUrl) {
    const prop = properties.find(p => p.id === propertyId);
    if (!prop || !prop.images) {
        alert('No images to delete.');
        return;
    }
    
    // Different confirmation message for last image
    const isLastImage = prop.images.length === 1;
    const confirmMessage = isLastImage 
        ? 'This is the last image. Deleting it will show a placeholder instead.\n\nAre you sure you want to delete this image?'
        : 'Are you sure you want to delete this image?';
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // Remove image from array
        prop.images.splice(imageIndex, 1);
        state.currentImages = prop.images;
        
        // Ensure owner info is set (especially for base properties being edited)
        if (!prop.ownerEmail) {
            prop.ownerEmail = (auth.currentUser?.email || 'richard2019201900@gmail.com').toLowerCase();
        }
        
        // Save to Firestore
        await db.collection('settings').doc('properties').set({
            [propertyId]: prop
        }, { merge: true });
        
        // Re-render
        renderPropertyStatsContent(propertyId);
        
        // Show toast
        if (typeof showToast === 'function') {
            if (isLastImage) {
                showToast('Image deleted. Add a new image to replace the placeholder.', 'info');
            } else {
                showToast('Image deleted successfully!', 'success');
            }
        }
        
    } catch (error) {
        console.error('Failed to delete image:', error);
        alert('Failed to delete image. Please try again.');
    }
};

// ==================== IMAGE DRAG & DROP REORDERING ====================
// Initialize drag and drop for image reordering
(function initImageDragDrop() {
    let draggedElement = null;
    let draggedIndex = null;
    let draggedPropertyId = null;
    
    // Use event delegation on document
    document.addEventListener('dragstart', function(e) {
        const draggable = e.target.closest('.draggable-image');
        if (!draggable) return;
        
        draggedElement = draggable;
        draggedIndex = parseInt(draggable.dataset.index);
        draggedPropertyId = parseInt(draggable.dataset.propertyId);
        
        // Add visual feedback
        setTimeout(() => {
            draggable.style.opacity = '0.5';
        }, 0);
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedIndex);
    });
    
    document.addEventListener('dragend', function(e) {
        const draggable = e.target.closest('.draggable-image');
        if (!draggable) return;
        
        draggable.style.opacity = '1';
        
        // Remove all drag-over styling
        document.querySelectorAll('.draggable-image').forEach(el => {
            el.classList.remove('drag-over-left', 'drag-over-right');
        });
        
        draggedElement = null;
        draggedIndex = null;
        draggedPropertyId = null;
    });
    
    document.addEventListener('dragover', function(e) {
        const dropTarget = e.target.closest('.draggable-image');
        if (!dropTarget || !draggedElement || dropTarget === draggedElement) return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Determine if dropping before or after
        const rect = dropTarget.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        
        // Remove previous drag-over styling from all
        document.querySelectorAll('.draggable-image').forEach(el => {
            el.classList.remove('drag-over-left', 'drag-over-right');
        });
        
        // Add styling based on drop position
        if (e.clientX < midpoint) {
            dropTarget.classList.add('drag-over-left');
        } else {
            dropTarget.classList.add('drag-over-right');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        const dropTarget = e.target.closest('.draggable-image');
        if (!dropTarget) return;
        
        // Only remove if actually leaving the element
        if (!dropTarget.contains(e.relatedTarget)) {
            dropTarget.classList.remove('drag-over-left', 'drag-over-right');
        }
    });
    
    document.addEventListener('drop', async function(e) {
        const dropTarget = e.target.closest('.draggable-image');
        if (!dropTarget || !draggedElement || dropTarget === draggedElement) return;
        
        e.preventDefault();
        
        const targetIndex = parseInt(dropTarget.dataset.index);
        const targetPropertyId = parseInt(dropTarget.dataset.propertyId);
        
        // Must be same property
        if (draggedPropertyId !== targetPropertyId) return;
        
        // Determine final position based on drop location
        const rect = dropTarget.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        let newIndex = e.clientX < midpoint ? targetIndex : targetIndex + 1;
        
        // Adjust for moving from before to after
        if (draggedIndex < newIndex) {
            newIndex--;
        }
        
        // Remove drag-over styling
        dropTarget.classList.remove('drag-over-left', 'drag-over-right');
        
        // Reorder the images
        await reorderPropertyImages(draggedPropertyId, draggedIndex, newIndex);
    });
})();

// Reorder images and save to Firestore
window.reorderPropertyImages = async function(propertyId, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    
    const prop = properties.find(p => p.id === propertyId);
    if (!prop || !prop.images) return;
    
    console.log(`[Images] Reordering: moving index ${fromIndex} to ${toIndex}`);
    
    try {
        // Remove from old position and insert at new position
        const [movedImage] = prop.images.splice(fromIndex, 1);
        prop.images.splice(toIndex, 0, movedImage);
        state.currentImages = prop.images;
        
        // Ensure owner info is set
        if (!prop.ownerEmail) {
            prop.ownerEmail = (auth.currentUser?.email || 'richard2019201900@gmail.com').toLowerCase();
        }
        
        // Save to Firestore
        await db.collection('settings').doc('properties').set({
            [propertyId]: prop
        }, { merge: true });
        
        // Re-render
        renderPropertyStatsContent(propertyId);
        
        // Show success feedback
        if (typeof showToast === 'function') {
            showToast('Image order updated!', 'success');
        }
        
    } catch (error) {
        console.error('Failed to reorder images:', error);
        alert('Failed to reorder images. Please try again.');
    }
};

// ==================== COPY REMINDER SCRIPT ====================
window.copyReminderScript = function(propertyId, btn) {
    const scriptElement = $(`reminderScript-${propertyId}`);
    if (!scriptElement) return;
    
    // Get value from textarea (or textContent if it's a div)
    const text = scriptElement.value || scriptElement.textContent;
    const originalHtml = btn.innerHTML;
    
    navigator.clipboard.writeText(text).then(() => {
        // Show success feedback
        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Copied!
        `;
        btn.classList.remove('from-green-500', 'to-emerald-600');
        btn.classList.add('from-purple-500', 'to-purple-600');
        
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('from-purple-500', 'to-purple-600');
            btn.classList.add('from-green-500', 'to-emerald-600');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            btn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Copied!
            `;
            btn.classList.remove('from-green-500', 'to-emerald-600');
            btn.classList.add('from-purple-500', 'to-purple-600');
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('from-purple-500', 'to-purple-600');
                btn.classList.add('from-green-500', 'to-emerald-600');
            }, 2000);
        } catch(e) {
            alert('Failed to copy. Please select and copy manually.');
        }
        document.body.removeChild(textArea);
    });
};

// ==================== EDIT REMINDER SCRIPT ====================
window.startEditReminderScript = function(propertyId) {
    const tile = $(`tile-reminderScript-${propertyId}`);
    const scriptDiv = $(`reminderScript-${propertyId}`);
    if (!tile || !scriptDiv) return;
    
    const currentValue = scriptDiv.textContent;
    
    tile.innerHTML = `
        <textarea id="input-reminderScript-${propertyId}"
                  class="w-full bg-gray-800 border-2 border-purple-500 rounded-lg p-3 text-gray-200 font-medium resize-y"
                  rows="4"
                  onclick="event.stopPropagation()">${currentValue}</textarea>
        <div class="flex gap-2 mt-3">
            <button onclick="event.stopPropagation(); saveReminderScript(${propertyId})" 
                    class="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg font-bold text-sm transition">
                Save
            </button>
            <button onclick="event.stopPropagation(); cancelReminderEdit(${propertyId})" 
                    class="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition">
                Cancel
            </button>
        </div>
    `;
    
    const input = $(`input-reminderScript-${propertyId}`);
    if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
};

window.saveReminderScript = async function(propertyId) {
    const tile = $(`tile-reminderScript-${propertyId}`);
    const input = $(`input-reminderScript-${propertyId}`);
    if (!tile || !input) return;
    
    const newValue = input.value.trim();
    
    // Show saving state
    tile.innerHTML = `<div id="reminderScript-${propertyId}" class="text-gray-200 font-medium opacity-70">Saving...</div>`;
    
    try {
        await PropertyDataService.write(propertyId, 'customReminderScript', newValue);
        
        // Refresh the stats page to show updated content
        viewPropertyStats(propertyId);
    } catch (error) {
        console.error('Failed to save reminder script:', error);
        alert('Failed to save. Please try again.');
        // Restore the input
        startEditReminderScript(propertyId);
    }
};

window.cancelReminderEdit = function(propertyId) {
    const tile = $(`tile-reminderScript-${propertyId}`);
    if (!tile) return;
    
    const originalValue = tile.dataset.originalValue || '';
    tile.innerHTML = `<div id="reminderScript-${propertyId}" class="text-gray-200 font-medium whitespace-pre-wrap">${originalValue}</div>`;
};

window.resetReminderScript = async function(propertyId) {
    if (!confirm('Reset to the auto-generated reminder script?')) return;
    
    try {
        await PropertyDataService.write(propertyId, 'customReminderScript', '');
        viewPropertyStats(propertyId);
    } catch (error) {
        console.error('Failed to reset reminder script:', error);
        alert('Failed to reset. Please try again.');
    }
};

// ==================== SCROLL TO IMAGES SECTION ====================
window.scrollToImagesSection = function(propertyId) {
    const imagesSection = document.getElementById(`property-images-section-${propertyId}`);
    if (imagesSection) {
        // Scroll to the section with offset for header
        imagesSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight effect
        imagesSection.classList.add('ring-4', 'ring-purple-500', 'ring-opacity-75');
        
        // Remove highlight after 2 seconds
        setTimeout(() => {
            imagesSection.classList.remove('ring-4', 'ring-purple-500', 'ring-opacity-75');
        }, 2000);
    }
};

// ==================== COPY RENTER PHONE ====================
window.copyRenterPhone = function(phoneNumber, btn) {
    // Sanitize phone number - remove all non-digits
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const originalHtml = btn.innerHTML;
    
    navigator.clipboard.writeText(cleanPhone).then(() => {
        // Show success feedback
        btn.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Copied!
        `;
        btn.classList.remove('bg-pink-500', 'hover:bg-pink-400');
        btn.classList.add('bg-green-500');
        
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('bg-green-500');
            btn.classList.add('bg-pink-500', 'hover:bg-pink-400');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = cleanPhone;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            btn.innerHTML = `
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Copied!
            `;
            btn.classList.remove('bg-pink-500', 'hover:bg-pink-400');
            btn.classList.add('bg-green-500');
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('bg-green-500');
                btn.classList.add('bg-pink-500', 'hover:bg-pink-400');
            }, 2000);
        } catch(e) {
            alert('Failed to copy phone number.');
        }
        document.body.removeChild(textArea);
    });
};

// ==================== INITIALIZE ====================
async function init() {
    await initFirestore();
    setupRealtimeListener();
    
    // Listen for auth state changes (including on page load)
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in - restore owner session
            state.currentUser = 'owner';
            updateAuthButton(true);
            
            // Ensure user has tier set (default to starter for new users)
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists || !userDoc.data()?.tier) {
                    // New user or missing tier - set to starter
                    await db.collection('users').doc(user.uid).set({
                        email: user.email.toLowerCase(),
                        tier: 'starter',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
                
                // Store user tier in state for quick access
                const updatedDoc = await db.collection('users').doc(user.uid).get();
                state.userTier = updatedDoc.data()?.tier || 'starter';
            } catch (error) {
                console.error('[Auth] Error checking user tier:', error);
                state.userTier = 'starter';
            }
            
            // Track last login time
            try {
                await db.collection('users').doc(user.uid).set({
                    lastLoginAt: new Date().toISOString(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (e) {
                console.warn('[Auth] Could not update last login:', e);
            }
            
            renderOwnerDashboard();
            loadUsername();
            
            // Initialize NotificationManager immediately on login for real-time notifications
            // This ensures we start listening for new users/listings right away, not just when dashboard opens
            if (typeof NotificationManager !== 'undefined' && !NotificationManager.state?.initialized) {
                console.log('[Auth] Initializing NotificationManager on login');
                NotificationManager.init();
            }
            
            // Start real-time property sync listener (all users)
            if (typeof startPropertySyncListener === 'function') {
                startPropertySyncListener();
            }
            
            // Start real-time celebration listener (gamification banners)
            if (typeof setupCelebrationListener === 'function') {
                setupCelebrationListener();
            }
            
            // Start real-time listener for upgrade requests (admin only)
            if (typeof loadPendingUpgradeRequests === 'function') {
                loadPendingUpgradeRequests();
            }
        } else {
            // No user signed in
            state.currentUser = null;
            state.userTier = null;
            updateAuthButton(false);
            
            // Stop property sync listener
            if (typeof stopPropertySyncListener === 'function') {
                stopPropertySyncListener();
            }
        }
    });
    
    // Apply all filters (including hideUnavailable which is checked by default)
    // This ensures the initial render respects the default filter state
    if (typeof applyAllFilters === 'function') {
        applyAllFilters();
    } else {
        renderProperties(properties);
    }
}

// ============================================================================
// LEASE COMPLETION SYSTEM
// ============================================================================

/**
 * Show the Complete Lease confirmation modal
 * Displays tenure summary and confirmation before completing
 */
window.showCompleteLeaseModal = async function(propertyId) {
    // Prevent opening multiple modals
    if (document.getElementById('completeLeaseModal')) {
        console.warn('[CompleteLease] Modal already open');
        return;
    }
    
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) return;
    
    // Get FRESH data from PropertyDataService
    const renterName = PropertyDataService.getValue(propertyId, 'renterName', p.renterName || '');
    const renterPhone = PropertyDataService.getValue(propertyId, 'renterPhone', p.renterPhone || '');
    const paymentFrequency = PropertyDataService.getValue(propertyId, 'paymentFrequency', p.paymentFrequency || '');
    
    if (!renterName) {
        showToast('No renter assigned to this property. The lease may have already been completed.', 'error');
        // Refresh the page to show correct state
        viewPropertyStats(propertyId);
        return;
    }
    
    // Calculate tenure summary from payment history
    const tenureSummary = await calculateTenureSummary(propertyId, renterName);
    
    const modalHTML = `
        <div id="completeLeaseModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) closeCompleteLeaseModal()">
            <div class="bg-gray-900 rounded-2xl max-w-lg w-full border border-orange-500/50 shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Complete Lease
                    </h3>
                    <p class="text-orange-100 text-sm mt-1">${p.title}</p>
                </div>
                
                <!-- Content -->
                <div class="p-6">
                    <!-- Renter Summary -->
                    <div class="bg-gray-800 rounded-xl p-4 mb-4">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                                ${renterName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="text-white font-bold">${renterName}</div>
                                <div class="text-gray-400 text-sm">${renterPhone || 'No phone on file'}</div>
                            </div>
                        </div>
                        <div class="text-gray-400 text-sm capitalize">${paymentFrequency || 'Unknown'} payment schedule</div>
                    </div>
                    
                    <!-- Tenure Statistics -->
                    <div class="bg-gradient-to-br from-green-900/50 to-emerald-900/50 border border-green-500/30 rounded-xl p-4 mb-4">
                        <h4 class="text-green-400 font-bold mb-3 flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            Tenure Summary
                        </h4>
                        
                        <!-- Payment breakdown - more prominent -->
                        <div class="bg-gray-800/50 rounded-lg p-3 mb-3">
                            <div class="flex items-center justify-between">
                                <div class="text-gray-300">
                                    <span class="text-2xl font-bold text-white">${tenureSummary.paymentCount}</span>
                                    <span class="text-gray-400"> × </span>
                                    <span class="text-xl font-bold text-green-400">$${tenureSummary.avgPayment.toLocaleString()}</span>
                                    <span class="text-gray-400 capitalize"> ${tenureSummary.frequency}</span>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-gray-500 uppercase">Total</div>
                                    <div class="text-xl font-bold text-green-400">$${tenureSummary.totalCollected.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div class="bg-gray-800/30 rounded-lg p-2">
                                <div class="text-gray-500 text-xs uppercase">First Payment</div>
                                <div class="text-white font-semibold">${tenureSummary.firstPayment || 'N/A'}</div>
                            </div>
                            <div class="bg-gray-800/30 rounded-lg p-2">
                                <div class="text-gray-500 text-xs uppercase">Last Payment</div>
                                <div class="text-white font-semibold">${tenureSummary.lastPayment || 'N/A'}</div>
                            </div>
                        </div>
                        
                        ${tenureSummary.tenureDays > 0 ? `
                        <div class="mt-3 pt-3 border-t border-green-500/30">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs uppercase">Tenure Duration</div>
                                    <div class="text-white font-semibold">${tenureSummary.tenureDays} days (${tenureSummary.tenureWeeks} weeks)</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-gray-500 text-xs uppercase">Coverage Through</div>
                                    <div class="text-white font-semibold">${tenureSummary.coverageEnd || 'N/A'}</div>
                                </div>
                            </div>
                            <div class="text-xs text-gray-500 mt-2">
                                Based on ${tenureSummary.paymentCount} ${tenureSummary.frequency} payment${tenureSummary.paymentCount !== 1 ? 's' : ''} (${tenureSummary.daysPerCycle} days each)
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Warning -->
                    <div class="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 mb-4">
                        <div class="flex items-start gap-3">
                            <svg class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            <div>
                                <div class="text-yellow-400 font-bold text-sm">This will:</div>
                                <ul class="text-yellow-200/80 text-sm mt-1 space-y-1">
                                    <li>• Archive ${renterName}'s tenure to payment history</li>
                                    <li>• Clear renter name, phone, notes, and payment schedule</li>
                                    <li>• Mark property as <span class="text-green-400 font-semibold">Available</span></li>
                                    <li>• Begin tracking vacancy period</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Remove Keys checkbox -->
                    <label class="flex items-center gap-3 cursor-pointer mb-3 bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <input type="checkbox" id="confirmKeysRemoved" class="w-5 h-5 rounded border-gray-600 text-amber-500 focus:ring-amber-500 bg-gray-700">
                        <div>
                            <span class="text-amber-400 font-semibold">🔑 Keys Removed</span>
                            <p class="text-gray-400 text-xs">Confirm renter has returned all keys/access</p>
                        </div>
                    </label>
                    
                    <!-- Confirmation checkbox -->
                    <label class="flex items-center gap-3 cursor-pointer mb-4">
                        <input type="checkbox" id="confirmLeaseComplete" class="w-5 h-5 rounded border-gray-600 text-green-500 focus:ring-green-500 bg-gray-700">
                        <span class="text-gray-300">I confirm ${renterName} is moving out and the lease is complete</span>
                    </label>
                    
                    <!-- Actions -->
                    <div class="flex gap-3">
                        <button onclick="closeCompleteLeaseModal()" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-bold transition">
                            Cancel
                        </button>
                        <button id="completeLeaseBtn" onclick="completeLease(${propertyId})" disabled class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-xl font-bold transition opacity-50 cursor-not-allowed flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            Complete Lease
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add checkbox listeners - both must be checked to enable button
    const keysCheckbox = document.getElementById('confirmKeysRemoved');
    const confirmCheckbox = document.getElementById('confirmLeaseComplete');
    const btn = document.getElementById('completeLeaseBtn');
    
    const updateButtonState = () => {
        if (keysCheckbox.checked && confirmCheckbox.checked) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.classList.add('hover:from-green-600', 'hover:to-emerald-700');
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.classList.remove('hover:from-green-600', 'hover:to-emerald-700');
        }
    };
    
    keysCheckbox.addEventListener('change', updateButtonState);
    confirmCheckbox.addEventListener('change', updateButtonState);
};

/**
 * Show the Eviction modal
 * For non-payment evictions with final message to renter
 */
window.showEvictionModal = async function(propertyId) {
    // Prevent opening multiple modals
    if (document.getElementById('evictionModal')) {
        console.warn('[Eviction] Modal already open');
        return;
    }
    
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) return;
    
    const renterName = PropertyDataService.getValue(propertyId, 'renterName', p.renterName || '');
    
    if (!renterName) {
        showToast('No renter assigned to this property.', 'error');
        viewPropertyStats(propertyId);
        return;
    }
    
    // Generate eviction message
    const evictionMessage = `Hey ${renterName}, thank you for renting with us. Unfortunately, due to non-payment your property has been cleaned out and placed back on the market for rent. If you have any questions or believe this was done in error, please contact me.`;
    
    const modalHTML = `
        <div id="evictionModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) closeEvictionModal()">
            <div class="bg-gray-900 rounded-2xl max-w-lg w-full border border-red-500/50 shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                        Evict Renter
                    </h3>
                    <p class="text-red-100 text-sm mt-1">${p.title}</p>
                </div>
                
                <!-- Content -->
                <div class="p-6">
                    <!-- Renter Info -->
                    <div class="bg-gray-800 rounded-xl p-4 mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-lg">
                                ${renterName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="text-white font-bold">${renterName}</div>
                                <div class="text-red-400 text-sm">Being evicted for non-payment</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Eviction Message -->
                    <div class="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-red-400 font-bold flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                                Eviction Message
                            </h4>
                            <button onclick="copyEvictionMessage()" class="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1">
                                📋 Copy
                            </button>
                        </div>
                        <textarea id="evictionMessageText" class="w-full bg-gray-800 text-gray-200 rounded-lg p-3 text-sm resize-none" rows="4">${evictionMessage}</textarea>
                    </div>
                    
                    <!-- Warning -->
                    <div class="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 mb-4">
                        <div class="flex items-start gap-3">
                            <svg class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            <div>
                                <div class="text-yellow-400 font-bold text-sm">This will:</div>
                                <ul class="text-yellow-200/80 text-sm mt-1 space-y-1">
                                    <li>• Record eviction in payment history</li>
                                    <li>• Clear renter name, phone, notes, and payment schedule</li>
                                    <li>• Mark property as <span class="text-green-400 font-semibold">Available</span></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Remove Keys checkbox -->
                    <label class="flex items-center gap-3 cursor-pointer mb-3 bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <input type="checkbox" id="confirmEvictionKeysRemoved" class="w-5 h-5 rounded border-gray-600 text-amber-500 focus:ring-amber-500 bg-gray-700">
                        <div>
                            <span class="text-amber-400 font-semibold">🔑 Keys Removed / Changed Locks</span>
                            <p class="text-gray-400 text-xs">Confirm renter no longer has access</p>
                        </div>
                    </label>
                    
                    <!-- Confirmation checkbox -->
                    <label class="flex items-center gap-3 cursor-pointer mb-4">
                        <input type="checkbox" id="confirmEviction" class="w-5 h-5 rounded border-gray-600 text-red-500 focus:ring-red-500 bg-gray-700">
                        <span class="text-gray-300">I confirm ${renterName} is being evicted for non-payment</span>
                    </label>
                    
                    <!-- Actions -->
                    <div class="flex gap-3">
                        <button onclick="closeEvictionModal()" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-bold transition">
                            Cancel
                        </button>
                        <button id="evictBtn" onclick="processEviction(${propertyId})" disabled class="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 rounded-xl font-bold transition opacity-50 cursor-not-allowed flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                            Evict Renter
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add checkbox listeners - both must be checked to enable button
    const keysCheckbox = document.getElementById('confirmEvictionKeysRemoved');
    const confirmCheckbox = document.getElementById('confirmEviction');
    const btn = document.getElementById('evictBtn');
    
    const updateButtonState = () => {
        if (keysCheckbox.checked && confirmCheckbox.checked) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.classList.add('hover:from-red-700', 'hover:to-red-800');
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.classList.remove('hover:from-red-700', 'hover:to-red-800');
        }
    };
    
    keysCheckbox.addEventListener('change', updateButtonState);
    confirmCheckbox.addEventListener('change', updateButtonState);
};

/**
 * Close eviction modal
 */
window.closeEvictionModal = function() {
    const modal = document.getElementById('evictionModal');
    if (modal) modal.remove();
};

/**
 * Copy eviction message to clipboard
 */
window.copyEvictionMessage = function() {
    const textarea = document.getElementById('evictionMessageText');
    if (textarea) {
        navigator.clipboard.writeText(textarea.value).then(() => {
            showToast('Eviction message copied!', 'success');
        }).catch(() => {
            textarea.select();
            document.execCommand('copy');
            showToast('Eviction message copied!', 'success');
        });
    }
};

/**
 * Process eviction - same as completeLease but with eviction flag
 */
window.processEviction = async function(propertyId) {
    const btn = document.getElementById('evictBtn');
    btn.disabled = true;
    btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Processing...';
    
    try {
        const p = properties.find(prop => prop.id === propertyId);
        const renterName = PropertyDataService.getValue(propertyId, 'renterName', '');
        const paymentFrequency = PropertyDataService.getValue(propertyId, 'paymentFrequency', '');
        
        // Calculate tenure summary before clearing renter
        const tenure = await calculateTenureSummary(propertyId, renterName);
        
        // Record eviction in tenure history (NOT payment history)
        try {
            const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
            let tenureHistory = [];
            if (historyDoc.exists) {
                tenureHistory = historyDoc.data().tenureHistory || [];
            }
            
            tenureHistory.push({
                renterName: renterName,
                startDate: tenure.firstPayment ? tenure.firstPayment.toISOString().split('T')[0] : null,
                endDate: new Date().toISOString().split('T')[0],
                endReason: 'eviction',
                totalCollected: tenure.totalCollected,
                paymentCount: tenure.paymentCount,
                tenureDays: tenure.tenureDays,
                frequency: paymentFrequency,
                recordedAt: new Date().toISOString()
            });
            
            await db.collection('paymentHistory').doc(String(propertyId)).set({
                tenureHistory: tenureHistory
            }, { merge: true });
        } catch (e) {
            console.warn('[Eviction] Could not record tenure history:', e);
        }
        
        // Clear renter info (same as completeLease)
        await PropertyDataService.write(propertyId, 'renterName', '');
        await PropertyDataService.write(propertyId, 'renterPhone', '');
        await PropertyDataService.write(propertyId, 'renterNotes', '');
        await PropertyDataService.write(propertyId, 'lastPaymentDate', '');
        await PropertyDataService.write(propertyId, 'paymentFrequency', '');
        
        // Mark as available
        state.availability[propertyId] = true;
        await saveAvailability(propertyId, true);
        
        closeEvictionModal();
        showToast(`${renterName} has been evicted. Property marked as available.`, 'success');
        
        // Refresh the page
        viewPropertyStats(propertyId);
        renderOwnerDashboard();
        
    } catch (error) {
        console.error('[Eviction] Error:', error);
        showToast('Error processing eviction. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg> Evict Renter';
    }
};

/**
 * Calculate tenure summary from payment history
 * Properly accounts for payment frequency to determine actual tenure duration
 */
async function calculateTenureSummary(propertyId, renterName) {
    const payments = await getPaymentHistory(propertyId);
    const p = properties.find(prop => prop.id === propertyId);
    
    // Get current payment frequency
    const paymentFrequency = PropertyDataService.getValue(propertyId, 'paymentFrequency', p?.paymentFrequency || 'weekly');
    
    // Filter payments for this renter (case-insensitive match)
    const renterPayments = payments.filter(pay => 
        pay.renterName && pay.renterName.toLowerCase() === renterName.toLowerCase()
    );
    
    if (renterPayments.length === 0) {
        return {
            totalCollected: 0,
            paymentCount: 0,
            firstPayment: null,
            lastPayment: null,
            tenureDays: 0,
            tenureWeeks: 0,
            frequency: paymentFrequency,
            avgPayment: 0
        };
    }
    
    // Sort by paymentDate
    renterPayments.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));
    
    const totalCollected = renterPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
    const firstDate = new Date(renterPayments[0].paymentDate);
    const lastPaymentDate = new Date(renterPayments[renterPayments.length - 1].paymentDate);
    
    // Calculate days per payment cycle based on frequency
    let daysPerCycle = 7; // default weekly
    if (paymentFrequency === 'daily') daysPerCycle = 1;
    else if (paymentFrequency === 'weekly') daysPerCycle = 7;
    else if (paymentFrequency === 'biweekly') daysPerCycle = 14;
    else if (paymentFrequency === 'monthly') daysPerCycle = 30;
    
    // Calculate actual tenure: from first payment through end of last payment period
    // If they paid once biweekly, they stayed for 2 weeks (14 days)
    // Tenure = (number of payments) × (days per payment cycle)
    const tenureDays = renterPayments.length * daysPerCycle;
    const tenureWeeks = Math.round(tenureDays / 7 * 10) / 10; // Round to 1 decimal
    
    // Calculate the coverage end date (when the last payment period ends)
    const coverageEndDate = new Date(lastPaymentDate);
    coverageEndDate.setDate(coverageEndDate.getDate() + daysPerCycle);
    
    // Average payment amount
    const avgPayment = Math.round(totalCollected / renterPayments.length);
    
    return {
        totalCollected: totalCollected,
        paymentCount: renterPayments.length,
        firstPayment: firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        lastPayment: lastPaymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        coverageEnd: coverageEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        tenureDays: tenureDays,
        tenureWeeks: tenureWeeks,
        frequency: paymentFrequency,
        daysPerCycle: daysPerCycle,
        avgPayment: avgPayment,
        payments: renterPayments
    };
}

/**
 * Complete the lease - archive tenure, clear renter, mark available
 */
window.completeLease = async function(propertyId) {
    const btn = document.getElementById('completeLeaseBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...';
    }
    
    try {
        const p = properties.find(prop => prop.id === propertyId);
        if (!p) throw new Error('Property not found');
        
        const renterName = PropertyDataService.getValue(propertyId, 'renterName', p.renterName || '');
        const renterPhone = PropertyDataService.getValue(propertyId, 'renterPhone', p.renterPhone || '');
        const paymentFrequency = PropertyDataService.getValue(propertyId, 'paymentFrequency', p.paymentFrequency || '');
        const renterNotes = PropertyDataService.getValue(propertyId, 'renterNotes', p.renterNotes || '');
        
        // Get tenure summary
        const tenureSummary = await calculateTenureSummary(propertyId, renterName);
        
        // Create tenure record with all details
        const tenureRecord = {
            id: Date.now().toString(),
            renterName: renterName,
            renterPhone: renterPhone,
            paymentFrequency: paymentFrequency,
            renterNotes: renterNotes,
            startDate: tenureSummary.firstPayment,
            endDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            coverageEnd: tenureSummary.coverageEnd,
            completedAt: new Date().toISOString(),
            totalCollected: tenureSummary.totalCollected,
            paymentCount: tenureSummary.paymentCount,
            avgPayment: tenureSummary.avgPayment,
            tenureDays: tenureSummary.tenureDays,
            tenureWeeks: tenureSummary.tenureWeeks,
            daysPerCycle: tenureSummary.daysPerCycle,
            status: 'completed'
        };
        
        // Save tenure to history
        await saveTenureHistory(propertyId, tenureRecord);
        
        // Award XP for completing a lease
        if (typeof GamificationService !== 'undefined' && GamificationService.awardXP) {
            const userId = auth.currentUser?.uid;
            if (userId) {
                const propertyTitle = p?.title || `Property #${propertyId}`;
                await GamificationService.awardXP(userId, 100, `Completed lease on ${propertyTitle} - $${tenureSummary.totalCollected.toLocaleString()} collected`);
            }
        }
        
        // Clear renter data (this clears BOTH Firestore docs and all local caches)
        await clearRenterData(propertyId);
        
        // Mark property as available
        state.availability[propertyId] = true;
        await saveAvailability(propertyId, true);
        
        // Log vacancy start
        await logVacancyStart(propertyId);
        
        // Update button to show success (prevent double-click)
        if (btn) {
            btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Completed!';
            btn.classList.remove('from-orange-500', 'to-red-500');
            btn.classList.add('from-green-500', 'to-green-600');
        }
        
        // Close modal and show success after a brief delay for Firestore to propagate
        setTimeout(async () => {
            closeCompleteLeaseModal();
            
            // Show thank you message modal for owner to copy
            showLeaseCompletionMessage(renterName, p.title, tenureSummary.totalCollected);
            
            // Force refresh ALL data - clear local property object
            const numericId = typeof propertyId === 'string' ? parseInt(propertyId) : propertyId;
            const prop = properties.find(p => p.id === numericId);
            if (prop) {
                prop.renterName = '';
                prop.renterPhone = '';
                prop.renterNotes = '';
                prop.paymentFrequency = '';
                prop.lastPaymentDate = '';
            }
            
            console.log('[CompleteLease] Pre-refresh state clear done');
            
            // Update all relevant UI components
            renderProperties(state.filteredProperties);
            if (state.currentUser === 'owner') renderOwnerDashboard();
            
            // Force re-render the stats page with guaranteed clean data
            renderPropertyStatsContent(propertyId);
        }, 1200);
        
    } catch (error) {
        console.error('[CompleteLease] Error:', error);
        showToast('Error completing lease: ' + error.message, 'error');
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Complete Lease';
        }
    }
};

/**
 * Save tenure record to Firestore
 */
async function saveTenureHistory(propertyId, tenureRecord) {
    try {
        const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
        let data = historyDoc.exists ? historyDoc.data() : { payments: [] };
        
        // Initialize tenureHistory array if doesn't exist
        if (!data.tenureHistory) {
            data.tenureHistory = [];
        }
        
        // Add new tenure record
        data.tenureHistory.push(tenureRecord);
        
        // Save back
        await db.collection('paymentHistory').doc(String(propertyId)).set({
            ...data,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return true;
    } catch (error) {
        console.error('[TenureHistory] Error saving:', error);
        throw error;
    }
}

/**
 * Delete a tenure record from Firestore
 * @param {number} propertyId - The property ID
 * @param {string} tenureId - The tenure record ID to delete
 */
window.deleteTenureRecord = async function(propertyId, tenureId) {
    // Confirm deletion
    const confirmed = confirm('Are you sure you want to delete this tenure record?\n\nThis will remove the historical data for this renter\'s lease period.\n\nNote: This will also clear any associated vacancy tracking.\n\nThis action cannot be undone.');
    
    if (!confirmed) return;
    
    try {
        const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
        if (!historyDoc.exists) {
            showToast('Error: Payment history not found', 'error');
            return;
        }
        
        let data = historyDoc.data();
        
        if (!data.tenureHistory || data.tenureHistory.length === 0) {
            showToast('Error: No tenure records found', 'error');
            return;
        }
        
        // Find the tenure record to get its completion date
        const tenureToDelete = data.tenureHistory.find(t => t.id === tenureId);
        
        // Find and remove the tenure record
        const originalLength = data.tenureHistory.length;
        data.tenureHistory = data.tenureHistory.filter(t => t.id !== tenureId);
        
        if (data.tenureHistory.length === originalLength) {
            showToast('Error: Tenure record not found', 'error');
            return;
        }
        
        // Also remove any ongoing vacancy period that was created when this lease completed
        // This helps with testing and data consistency
        if (data.vacancyPeriods && data.vacancyPeriods.length > 0) {
            // Remove ongoing vacancy periods (usually there should only be one)
            data.vacancyPeriods = data.vacancyPeriods.filter(v => v.status !== 'ongoing');
        }
        
        // Save back to Firestore
        await db.collection('paymentHistory').doc(String(propertyId)).set({
            ...data,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('✅ Tenure record deleted successfully', 'success');
        
        // Refresh the analytics section
        if (typeof renderPropertyAnalytics === 'function') {
            renderPropertyAnalytics(propertyId);
        }
        
        console.log('[TenureHistory] Deleted tenure:', tenureId, 'from property:', propertyId);
        
    } catch (error) {
        console.error('[TenureHistory] Error deleting:', error);
        showToast('Error deleting tenure record: ' + error.message, 'error');
    }
};

/**
 * Clear all renter-related data from property
 * UNIFIED ARCHITECTURE: All data writes to settings/properties
 */
async function clearRenterData(propertyId) {
    const fieldsToClean = [
        'renterName',
        'renterPhone', 
        'renterNotes',
        'paymentFrequency',
        'lastPaymentDate'
    ];
    
    const numericId = typeof propertyId === 'string' ? parseInt(propertyId) : propertyId;
    const prop = properties.find(p => p.id === numericId);
    
    console.log('[ClearRenterData] Starting clear for property:', numericId);
    
    // STEP 1: Clear local property object immediately
    if (prop) {
        prop.renterName = '';
        prop.renterPhone = '';
        prop.renterNotes = '';
        prop.paymentFrequency = '';
        prop.lastPaymentDate = '';
    }
    
    console.log('[ClearRenterData] Local state cleared');
    
    try {
        // UNIFIED: All properties write to settings/properties
        const updateData = {};
        fieldsToClean.forEach(field => {
            updateData[`${numericId}.${field}`] = '';
        });
        updateData[`${numericId}.updatedAt`] = firebase.firestore.FieldValue.serverTimestamp();
        updateData[`${numericId}.clearedBy`] = auth.currentUser?.email || 'system-clear';
        
        await db.collection('settings').doc('properties').update(updateData);
        
        console.log('[ClearRenterData] Successfully cleared all renter data for property:', numericId);
        console.log('[ClearRenterData] property object:', prop ? { renterName: prop.renterName, paymentFrequency: prop.paymentFrequency } : 'not found');
        
    } catch (error) {
        console.error('[ClearRenterData] Error clearing data:', error);
        throw error;
    }
}

/**
 * Log vacancy start date for tracking
 */
async function logVacancyStart(propertyId) {
    try {
        const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
        let data = historyDoc.exists ? historyDoc.data() : { payments: [] };
        
        // Initialize vacancyPeriods array if doesn't exist
        if (!data.vacancyPeriods) {
            data.vacancyPeriods = [];
        }
        
        // Add new vacancy period (start only, endDate will be set when new renter moves in)
        data.vacancyPeriods.push({
            startDate: new Date().toISOString(),
            endDate: null,
            status: 'ongoing'
        });
        
        // Save back
        await db.collection('paymentHistory').doc(String(propertyId)).set({
            ...data,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
    } catch (error) {
        console.warn('[VacancyLog] Error logging vacancy start:', error);
    }
}

/**
 * End vacancy period when new renter moves in
 */
async function endVacancyPeriod(propertyId) {
    try {
        const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
        if (!historyDoc.exists) return;
        
        let data = historyDoc.data();
        if (!data.vacancyPeriods || data.vacancyPeriods.length === 0) return;
        
        // Find and update the ongoing vacancy period
        const ongoingIndex = data.vacancyPeriods.findIndex(v => v.status === 'ongoing');
        if (ongoingIndex !== -1) {
            data.vacancyPeriods[ongoingIndex].endDate = new Date().toISOString();
            data.vacancyPeriods[ongoingIndex].status = 'completed';
            
            // Calculate vacancy duration
            const startDate = new Date(data.vacancyPeriods[ongoingIndex].startDate);
            const endDate = new Date();
            data.vacancyPeriods[ongoingIndex].durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            
            // Save back
            await db.collection('paymentHistory').doc(String(propertyId)).set({
                ...data,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
    } catch (error) {
        console.warn('[VacancyLog] Error ending vacancy period:', error);
    }
}

// Make endVacancyPeriod available globally for use in other files
window.endVacancyPeriod = endVacancyPeriod;

/**
 * Close the complete lease modal
 */
window.closeCompleteLeaseModal = function() {
    const modal = document.getElementById('completeLeaseModal');
    if (modal) modal.remove();
};

/**
 * Show thank you message modal after lease completion
 * Gives owner a copy-paste message to send to the renter
 */
window.showLeaseCompletionMessage = function(renterName, propertyTitle, totalCollected) {
    // Remove any existing modal
    const existing = document.getElementById('leaseCompletionMessageModal');
    if (existing) existing.remove();
    
    const thankYouMessage = `Hey ${renterName}, thank you so much for renting ${propertyTitle} with us! It was a pleasure having you as a tenant. Your total payments of $${totalCollected.toLocaleString()} have all been recorded. If you ever need a place again, hit me up anytime - you're always welcome back! 🚗`;
    
    const modalHTML = `
        <div id="leaseCompletionMessageModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) closeLeaseCompletionMessageModal()">
            <div class="bg-gray-900 rounded-2xl max-w-lg w-full border border-green-500/50 shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Lease Completed Successfully!
                    </h3>
                    <p class="text-green-100 text-sm mt-1">${propertyTitle}</p>
                </div>
                
                <div class="p-6">
                    <!-- Success Summary -->
                    <div class="bg-green-900/30 border border-green-500/30 rounded-xl p-4 mb-4">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-2xl">
                                🎉
                            </div>
                            <div>
                                <div class="text-white font-bold">${renterName}'s lease complete</div>
                                <div class="text-green-400 text-sm">Total collected: $${totalCollected.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Thank You Message -->
                    <div class="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-green-400 font-bold flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                                Thank You Message
                            </h4>
                            <button onclick="copyLeaseCompletionMessage()" class="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1">
                                📋 Copy
                            </button>
                        </div>
                        <textarea id="leaseCompletionMessageText" class="w-full bg-gray-900 text-gray-200 rounded-lg p-3 text-sm resize-none border border-gray-600" rows="5">${thankYouMessage}</textarea>
                        <p class="text-gray-500 text-xs mt-2">Send this message to thank your renter for their business!</p>
                    </div>
                    
                    <!-- XP Earned -->
                    <div class="bg-amber-900/30 border border-amber-500/30 rounded-xl p-3 mb-4">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">⭐</span>
                            <div>
                                <div class="text-amber-400 font-bold text-sm">+100 XP Earned!</div>
                                <div class="text-amber-200/70 text-xs">For completing a lease successfully</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Close Button -->
                    <button onclick="closeLeaseCompletionMessageModal()" class="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-bold transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Done
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.copyLeaseCompletionMessage = function() {
    const textarea = document.getElementById('leaseCompletionMessageText');
    if (textarea) {
        textarea.select();
        document.execCommand('copy');
        showToast('📋 Thank you message copied!', 'success');
    }
};

window.closeLeaseCompletionMessageModal = function() {
    const modal = document.getElementById('leaseCompletionMessageModal');
    if (modal) modal.remove();
};

// ============================================================================
// RENT-TO-OWN CONTRACT WIZARD
// ============================================================================

// Store wizard state
window.rtoWizardState = {
    propertyId: null,
    step: 1,
    property: null,
    buyer: {
        name: '',
        useExisting: true
    },
    seller: '',
    financial: {
        purchasePrice: 0,
        downPaymentPercent: 10,
        downPayment: 0,
        termMonths: 24,
        finalPaymentBase: 1500000,
        finalPaymentFee: 150000,
        finalPaymentTotal: 1650000
    }
};

/**
 * Show the Rent-to-Own Wizard
 */
window.showRentToOwnWizard = async function(propertyId) {
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) {
        showToast('Property not found', 'error');
        return;
    }
    
    // Check if user is Elite or Admin
    const isAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    const isElite = state.userTier === 'elite';
    
    if (!isAdmin && !isElite) {
        // Show upgrade required modal
        showRTOUpgradeRequired();
        return;
    }
    
    // Get the PROPERTY OWNER's display name using the same method as owner badge
    let sellerName = '';
    try {
        const ownerInfo = await getPropertyOwnerWithTier(propertyId);
        sellerName = ownerInfo.display || ownerInfo.username || '';
        console.log('[RTO] Got owner from getPropertyOwnerWithTier:', sellerName);
    } catch (e) {
        console.warn('Could not get seller name from getPropertyOwnerWithTier:', e);
    }
    
    // Fallback to PropertyDataService
    if (!sellerName || sellerName === 'Unassigned') {
        sellerName = PropertyDataService.getValue(propertyId, 'ownerName', p.ownerName || '');
    }
    
    // Get renter name
    const renterName = PropertyDataService.getValue(propertyId, 'renterName', p.renterName || '');
    
    // Get property description - stored in 'location' field in the database
    // Try multiple sources to find the description
    let propertyDescription = '';
    try {
        // Try PropertyDataService first
        propertyDescription = PropertyDataService.getValue(propertyId, 'location', '');
        console.log('[RTO] Description from PropertyDataService:', propertyDescription);
        
        // Fallback to property object
        if (!propertyDescription) {
            propertyDescription = p.location || '';
            console.log('[RTO] Description from p.location:', propertyDescription);
        }
        
        // Last fallback - try description field
        if (!propertyDescription) {
            propertyDescription = PropertyDataService.getValue(propertyId, 'description', '') || p.description || '';
            console.log('[RTO] Description from description field:', propertyDescription);
        }
    } catch (e) {
        propertyDescription = p.location || p.description || '';
        console.log('[RTO] Description from fallback:', propertyDescription);
    }
    console.log('[RTO] Final property description:', propertyDescription);
    
    // Get buy price
    let buyPrice = 0;
    try {
        buyPrice = parseInt(PropertyDataService.getValue(propertyId, 'buyPrice', 0)) || parseInt(p.buyPrice) || 0;
    } catch (e) {
        buyPrice = parseInt(p.buyPrice) || 0;
    }
    
    // Get PMA Government minimum final payment based on property type
    const minPriceInfo = getMinimumBuyPrice(p);
    const finalPaymentBase = minPriceInfo.min;
    const finalPaymentFee = Math.round(finalPaymentBase * 0.10);
    const finalPaymentTotal = finalPaymentBase + finalPaymentFee;
    
    // Default values
    const defaultDownPaymentPercent = 10;
    const defaultDownPayment = Math.round(buyPrice * (defaultDownPaymentPercent / 100));
    const defaultTermMonths = buyPrice <= 5000000 ? 12 : 24;
    
    // Initialize wizard state
    window.rtoWizardState = {
        propertyId: propertyId,
        step: 1,
        property: { ...p, description: propertyDescription },
        existingRenter: renterName,
        existingSeller: sellerName,
        buyer: {
            name: renterName,
            useExisting: true
        },
        seller: sellerName,
        financial: {
            purchasePrice: buyPrice,
            downPaymentPercent: defaultDownPaymentPercent,
            downPayment: defaultDownPayment,
            termMonths: defaultTermMonths,
            finalPaymentBase: finalPaymentBase,
            finalPaymentFee: finalPaymentFee,
            finalPaymentTotal: finalPaymentTotal,
            propertyCategory: minPriceInfo.category
        }
    };
    
    console.log('[RTO] Wizard initialized:', {
        seller: sellerName,
        renter: renterName,
        buyPrice: buyPrice,
        finalPayment: finalPaymentBase,
        category: minPriceInfo.category
    });
    
    renderRTOWizardStep(1);
};

/**
 * Show upgrade required modal for non-Elite users
 */
function showRTOUpgradeRequired() {
    const modalHTML = `
        <div id="rtoUpgradeModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-900 rounded-2xl max-w-md w-full border border-purple-500/50 shadow-2xl overflow-hidden">
                <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        Elite Feature
                    </h3>
                    <button onclick="document.getElementById('rtoUpgradeModal').remove()" class="bg-white/20 hover:bg-white/30 p-2 rounded-full transition">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div class="p-6 text-center">
                    <div class="text-6xl mb-4">👑</div>
                    <h4 class="text-2xl font-bold text-white mb-2">Rent-to-Own Contracts</h4>
                    <p class="text-gray-400 mb-6">
                        This premium feature is exclusively available to <span class="text-purple-400 font-bold">Elite</span> subscription members.
                    </p>
                    <div class="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4 mb-6">
                        <div class="text-purple-300 font-bold mb-2">Elite Benefits Include:</div>
                        <ul class="text-gray-300 text-sm space-y-1 text-left">
                            <li>✓ Unlimited property listings</li>
                            <li>✓ Rent-to-Own contract generator</li>
                            <li>✓ Priority support</li>
                            <li>✓ Advanced analytics</li>
                        </ul>
                    </div>
                    <button onclick="document.getElementById('rtoUpgradeModal').remove(); showUpgradeModal && showUpgradeModal();" class="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 px-6 rounded-xl font-bold hover:opacity-90 transition">
                        Upgrade to Elite
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Get PMA Government minimum final payment based on property type
 * These are FINAL PAYMENT minimums, not buy prices
 * Apartments 600 storage - $700k
 * Hotel 800 Storage - $750k
 * Instance House 800-900 Storage - $800K
 * Hotel 1050 Storage - $900k
 * Instance House 1000+ - $1.2 Mil
 * Walk In House - $1.5m
 */
function getMinimumBuyPrice(property) {
    const title = (property.title || '').toLowerCase();
    const type = (property.type || '').toLowerCase();
    const description = (property.description || '').toLowerCase();
    
    // Get interiorType from property - try PropertyDataService first, then property object
    let interiorType = '';
    if (property.id) {
        interiorType = (PropertyDataService.getValue(property.id, 'interiorType', property.interiorType || '') || '').toLowerCase();
    } else {
        interiorType = (property.interiorType || '').toLowerCase();
    }
    
    // Get storage space - check multiple sources
    let storageSpace = 0;
    if (property.id) {
        storageSpace = parseInt(PropertyDataService.getValue(property.id, 'storageSpace', property.storageSpace || 0)) || 0;
    } else {
        storageSpace = parseInt(property.storageSpace) || 0;
    }
    
    // Also try to find storage in title/description
    if (!storageSpace) {
        const storageMatch = (title + ' ' + description).match(/(\d+)\s*storage/i);
        if (storageMatch) {
            storageSpace = parseInt(storageMatch[1]);
        }
    }
    
    console.log('[RTO] Detecting property type:', { interiorType, type, storageSpace, title });
    
    // Check for walk-in house first (highest tier) - $1.5M
    // Case-insensitive check for any variation of "walk-in" or "walkin"
    if (interiorType.includes('walk') || 
        title.includes('walk in') || title.includes('walk-in') || title.includes('walkin') ||
        description.includes('walk in') || description.includes('walk-in') || description.includes('walkin') ||
        type.includes('walk')) {
        return { min: 1500000, category: 'Walk-In House', storage: storageSpace ? storageSpace + ' storage' : 'N/A' };
    }
    
    // Check for hotel
    if (type === 'hotel' || title.includes('hotel')) {
        if (storageSpace >= 1050) return { min: 900000, category: 'Hotel 1050 Storage', storage: storageSpace + ' storage' };
        if (storageSpace >= 800) return { min: 750000, category: 'Hotel 800 Storage', storage: storageSpace + ' storage' };
        return { min: 750000, category: 'Hotel', storage: storageSpace ? storageSpace + ' storage' : 'Unknown' };
    }
    
    // Check for apartment
    if (type === 'apartment' || title.includes('apartment') || title.includes('apt')) {
        return { min: 700000, category: 'Apartment 600 Storage', storage: storageSpace ? storageSpace + ' storage' : '600 storage' };
    }
    
    // Check for instance house (or default house type)
    if (interiorType === 'instance' || type === 'instance house' || type === 'instance' || 
        type === 'house' || title.includes('instance') || title.includes('house')) {
        if (storageSpace >= 1000) return { min: 1200000, category: 'Instance House 1000+', storage: storageSpace + ' storage' };
        if (storageSpace >= 800) return { min: 800000, category: 'Instance House 800-900', storage: storageSpace + ' storage' };
        // Default instance house to 1000+ tier
        return { min: 1200000, category: 'Instance House 1000+', storage: storageSpace ? storageSpace + ' storage' : 'Unknown' };
    }
    
    // Default to walk-in house tier (highest/safest)
    return { min: 1500000, category: 'Walk-In House (Default)', storage: storageSpace ? storageSpace + ' storage' : 'N/A' };
}

/**
 * Render the current wizard step
 */
function renderRTOWizardStep(step) {
    const state = window.rtoWizardState;
    state.step = step;
    
    // Remove existing modal
    const existingModal = document.getElementById('rtoWizardModal');
    if (existingModal) existingModal.remove();
    
    let content = '';
    let title = '';
    let stepIndicator = `
        <div class="flex items-center justify-center gap-2 mb-6">
            ${[1, 2, 3, 4].map(s => `
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${s === step ? 'bg-amber-500 text-gray-900' : s < step ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}">
                        ${s < step ? '✓' : s}
                    </div>
                    ${s < 4 ? '<div class="w-8 h-0.5 bg-gray-700"></div>' : ''}
                </div>
            `).join('')}
        </div>
    `;
    
    if (step === 1) {
        title = 'Step 1: Parties Information';
        const existingRenter = state.existingRenter || '';
        const existingSeller = state.existingSeller || '';
        const hasExisting = existingRenter && existingSeller;
        
        content = `
            <div class="space-y-4">
                <p class="text-gray-400 text-sm">Who are the parties for this rent-to-own agreement?</p>
                
                <!-- Option A: Use Current Renter & Seller -->
                <label class="block p-4 bg-gray-800 rounded-xl cursor-pointer border-2 ${state.buyer.useExisting ? 'border-amber-500' : 'border-transparent'} hover:border-amber-500 transition" onclick="selectRTOPartiesOption(true)">
                    <div class="flex items-center gap-3">
                        <input type="radio" name="partiesSource" id="useExisting" ${state.buyer.useExisting ? 'checked' : ''} class="w-5 h-5 text-amber-500">
                        <div class="flex-1">
                            <div class="text-white font-semibold">Use Current Renter & Owner</div>
                            <div class="text-gray-400 text-xs">Use the existing property parties</div>
                        </div>
                    </div>
                    ${hasExisting ? `
                    <div class="mt-3 pl-8 grid grid-cols-2 gap-4">
                        <div class="bg-gray-700/50 rounded-lg p-3">
                            <div class="text-gray-500 text-xs mb-1">Buyer/Tenant</div>
                            <div class="text-green-400 font-semibold">👤 ${existingRenter}</div>
                        </div>
                        <div class="bg-gray-700/50 rounded-lg p-3">
                            <div class="text-gray-500 text-xs mb-1">Seller/Landlord</div>
                            <div class="text-amber-400 font-semibold">👤 ${existingSeller}</div>
                        </div>
                    </div>
                    ` : `
                    <div class="mt-3 pl-8 text-red-400 text-sm">
                        ⚠️ ${!existingRenter ? 'No renter assigned. ' : ''}${!existingSeller ? 'No owner found.' : ''}
                    </div>
                    `}
                </label>
                
                <!-- Option B: Enter Manually -->
                <label class="block p-4 bg-gray-800 rounded-xl cursor-pointer border-2 ${!state.buyer.useExisting ? 'border-amber-500' : 'border-transparent'} hover:border-amber-500 transition" onclick="selectRTOPartiesOption(false)">
                    <div class="flex items-center gap-3">
                        <input type="radio" name="partiesSource" id="enterManually" ${!state.buyer.useExisting ? 'checked' : ''} class="w-5 h-5 text-amber-500">
                        <div class="flex-1">
                            <div class="text-white font-semibold">Enter Manually</div>
                            <div class="text-gray-400 text-xs">Manually enter buyer and seller names</div>
                        </div>
                    </div>
                </label>
                
                <!-- Manual Entry Fields (shown when Option B selected) -->
                <div id="manualPartyInputs" class="${state.buyer.useExisting ? 'hidden' : ''} space-y-3 mt-4">
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Buyer/Tenant Name</label>
                        <input type="text" id="rtoBuyerName" value="${state.buyer.name}" 
                               class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
                               placeholder="Enter buyer's full name">
                    </div>
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Seller/Landlord Name</label>
                        <input type="text" id="rtoSellerName" value="${state.seller}" 
                               class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
                               placeholder="Enter seller's full name">
                    </div>
                </div>
            </div>
        `;
    } else if (step === 2) {
        title = 'Step 2: Financial Terms';
        const f = state.financial;
        
        // Determine recommended term based on price
        const recommendedTerm = f.purchasePrice <= 5000000 ? 12 : 24;
        const termLabel = f.purchasePrice <= 5000000 ? '(≤$5M: 12 months recommended)' : '(>$5M: 24 months recommended)';
        
        content = `
            <div class="space-y-4">
                <p class="text-gray-400 text-sm">Set the financial structure for this rent-to-own agreement.</p>
                
                <!-- Purchase Price (auto-populated from Buy Price) -->
                <div>
                    <label class="block text-gray-400 text-sm mb-2">Total Purchase Price</label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input type="number" id="rtoPurchasePrice" value="${f.purchasePrice || ''}" 
                               class="w-full pl-8 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-amber-500"
                               placeholder="20,000,000" oninput="updateRTOCalculations()">
                    </div>
                    <p class="text-gray-500 text-xs mt-1">Auto-populated from Buy Price. Edit if needed.</p>
                </div>
                
                <!-- Down Payment Slider with Manual Input -->
                <div class="bg-gray-800/50 rounded-xl p-4">
                    <div class="flex items-center justify-between mb-2">
                        <label class="text-gray-400 text-sm">Down Payment</label>
                        <div class="text-right flex items-center gap-2">
                            <span id="rtoDownPaymentPercent" class="text-amber-400 font-bold">${f.downPaymentPercent ?? 10}%</span>
                            <span class="text-gray-500">=</span>
                            <span class="text-gray-400">$</span>
                            <input type="number" id="rtoDownPaymentManual" value="${f.downPayment || 0}" 
                                   class="w-28 px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-green-400 font-bold text-right focus:ring-2 focus:ring-amber-500"
                                   oninput="updateRTODownPaymentManual(this.value)">
                        </div>
                    </div>
                    <input type="range" id="rtoDownPaymentSlider" value="${f.downPaymentPercent ?? 10}" min="0" max="99" step="1"
                           class="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                           oninput="updateRTODownPayment(this.value)">
                    <div class="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1%</span>
                        <span>50%</span>
                        <span>99%</span>
                    </div>
                </div>
                
                <!-- Term Length Slider -->
                <div class="bg-gray-800/50 rounded-xl p-4">
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <label class="text-gray-400 text-sm">Term Length</label>
                            <p class="text-gray-500 text-xs">${termLabel}</p>
                        </div>
                        <span id="rtoTermMonthsDisplay" class="text-amber-400 font-bold text-lg">${f.termMonths} months</span>
                    </div>
                    <input type="range" id="rtoTermMonthsSlider" value="${f.termMonths}" min="6" max="48" step="1"
                           class="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                           oninput="updateRTOTermMonths(this.value)">
                    <div class="flex justify-between text-xs text-gray-500 mt-1">
                        <span>6 mo</span>
                        <span>24 mo</span>
                        <span>48 mo</span>
                    </div>
                </div>
                
                <!-- Final Payment Section (PMA Government Minimum) -->
                <div class="bg-gradient-to-br from-amber-900/30 to-yellow-900/30 border border-amber-500/30 rounded-xl p-4">
                    <h4 class="text-amber-400 font-bold mb-2 flex items-center gap-2">
                        💰 Final Payment (Month <span id="rtoFinalMonth">${f.termMonths}</span>)
                    </h4>
                    <div class="bg-amber-900/40 border border-amber-600/50 rounded-lg p-2 mb-3">
                        <div class="text-amber-300 text-xs font-bold">📋 PMA Government Minimum</div>
                        <div class="text-amber-200 text-xs">Category: <span id="rtoPropertyCategory">${f.propertyCategory || 'Detecting...'}</span></div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-400 text-sm">Base Final Payment:</span>
                            <span id="rtoFinalPaymentBase" class="text-white font-bold">$${(f.finalPaymentBase || 0).toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-400">+ PMA Realtor Fee (10%):</span>
                            <span id="rtoFinalFee" class="text-amber-400 font-semibold">$${(f.finalPaymentFee || 0).toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between pt-2 border-t border-amber-500/30">
                            <span class="text-white font-bold">Total Final Payment:</span>
                            <span id="rtoFinalTotal" class="text-green-400 font-bold text-lg">$${(f.finalPaymentTotal || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    <p class="text-gray-500 text-xs mt-2">Final payment set by PMA Government regulations based on property type.</p>
                </div>
                
                <!-- Calculated Summary -->
                <div id="rtoCalculationSummary" class="bg-gray-800 rounded-xl p-4">
                    <h4 class="text-cyan-400 font-bold mb-3">📊 Monthly Payment Calculation</h4>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Purchase Price:</span>
                            <span id="rtoCalcPurchase" class="text-white">$${(f.purchasePrice || 0).toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">− Down Payment:</span>
                            <span id="rtoCalcDown" class="text-red-400">−$${(f.downPayment || 0).toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">− Final Payment (PMA Min):</span>
                            <span id="rtoCalcFinalMin" class="text-red-400">−$${(f.finalPaymentBase || 0).toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between pt-2 border-t border-gray-700">
                            <span class="text-gray-400">= Remaining Balance to Finance:</span>
                            <span id="rtoCalcFinance" class="text-white font-semibold">$0</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">÷ <span id="rtoCalcMonthsCount">${f.termMonths - 1}</span> months:</span>
                            <span id="rtoMonthlyPayment" class="text-green-400 font-bold text-lg">$0/mo</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (step === 3) {
        title = 'Step 3: Review Agreement';
        const calc = calculateRTOTerms();
        
        content = `
            <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                <!-- Property Info -->
                <div class="bg-gray-800 rounded-xl p-4">
                    <h4 class="text-amber-400 font-bold mb-2 flex items-center gap-2">
                        <span>🚗</span> Property
                    </h4>
                    <div class="text-white font-semibold">${state.property.title}</div>
                    <div class="text-gray-400 text-sm mt-1">${state.property.description || 'No description available'}</div>
                </div>
                
                <!-- Parties -->
                <div class="bg-gray-800 rounded-xl p-4">
                    <h4 class="text-amber-400 font-bold mb-2 flex items-center gap-2">
                        <span>👥</span> Parties Involved
                    </h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-gray-400">Seller/Landlord:</span>
                            <div class="text-white font-semibold">${state.seller}</div>
                        </div>
                        <div>
                            <span class="text-gray-400">Buyer/Tenant:</span>
                            <div class="text-white font-semibold">${state.buyer.name}</div>
                        </div>
                    </div>
                    <div class="text-gray-400 text-sm mt-2">Realtor/Brokerage: <span class="text-white">${state.seller} / PaulysAutos.com</span></div>
                </div>
                
                <!-- Financial Structure -->
                <div class="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-4">
                    <h4 class="text-green-400 font-bold mb-3 flex items-center gap-2">
                        <span>💰</span> Financial Structure
                    </h4>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Total Purchase Price</span>
                            <span class="text-white font-bold">$${calc.purchasePrice.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Down Payment (${calc.downPaymentPercent}%)</span>
                            <span class="text-green-400 font-semibold">$${calc.downPayment.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between border-t border-gray-700 pt-2">
                            <span class="text-gray-400">Amount to Finance</span>
                            <span class="text-white font-bold">$${calc.remainingBalance.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Term Length</span>
                            <span class="text-white">${calc.termMonths} Months</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Monthly Payments (Months 1-${calc.termMonths - 1})</span>
                            <span class="text-green-400 font-semibold">$${calc.monthlyPayment.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between border-t border-gray-700 pt-2">
                            <span class="text-gray-400">Final Payment Base (PMA Min)</span>
                            <span class="text-white">$${calc.finalPaymentBase.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">+ PMA Realtor Fee (10%)</span>
                            <span class="text-amber-400">$${calc.finalPaymentFee.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between bg-amber-900/30 p-2 rounded-lg">
                            <span class="text-amber-300 font-bold">= Total Final Payment (Month ${calc.termMonths})</span>
                            <span class="text-amber-300 font-bold">$${calc.finalPaymentTotal.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="mt-2 text-xs text-amber-400">📋 Property Category: ${calc.propertyCategory}</div>
                </div>
                
                <!-- Agreement Date -->
                <div class="bg-gray-800 rounded-xl p-4">
                    <label class="block text-gray-400 text-sm mb-2">Agreement Start Date</label>
                    <input type="date" id="rtoStartDate" value="${new Date().toISOString().split('T')[0]}" 
                           class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-amber-500">
                </div>
            </div>
        `;
    } else if (step === 4) {
        title = 'Contract Generated';
        const contract = generateRTOContract();
        
        content = `
            <div class="space-y-4">
                <div class="flex items-center justify-center gap-3 text-green-400 mb-4">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span class="text-xl font-bold">Contract Ready!</span>
                </div>
                
                <div class="bg-gray-800 rounded-xl p-4 max-h-[35vh] overflow-y-auto">
                    <div id="rtoContractPreview" class="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                        ${contract.preview}
                    </div>
                </div>
                
                <div class="text-gray-400 text-xs text-center">
                    Document ID: ${contract.documentId}
                </div>
                
                <!-- Primary Actions -->
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="copyRTOContract()" class="bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 px-4 rounded-xl font-bold transition hover:opacity-90 flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        Copy Text
                    </button>
                    <button onclick="downloadRTOContractImage()" class="bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 px-4 rounded-xl font-bold transition hover:opacity-90 flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        Download Image
                    </button>
                </div>
                
                <!-- Save Action -->
                <button onclick="saveRTOContract()" class="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-xl font-bold transition hover:opacity-90 flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                    Save to Firestore & Close
                </button>
                
                <p class="text-gray-500 text-xs text-center">
                    Saving stores the contract in your database for future reference.<br>
                    The image includes cursive signatures for both parties.
                </p>
            </div>
        `;
    }
    
    const modalHTML = `
        <div id="rtoWizardModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-gray-900 rounded-2xl max-w-2xl w-full border border-amber-500/50 shadow-2xl overflow-hidden my-4">
                <!-- Header with Close Button -->
                <div class="bg-gradient-to-r from-amber-600 to-yellow-600 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-bold text-gray-900 flex items-center gap-3">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Rent-to-Own Contract
                        </h3>
                        <p class="text-gray-900/70 text-sm mt-1">${state.property.title}</p>
                    </div>
                    <button onclick="closeRTOWizard()" class="bg-gray-900/30 hover:bg-gray-900/50 text-gray-900 p-2 rounded-full transition" title="Close">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                <!-- Content -->
                <div class="p-6 max-h-[70vh] overflow-y-auto">
                    ${stepIndicator}
                    <h4 class="text-lg font-bold text-white mb-4">${title}</h4>
                    ${content}
                    
                    <!-- Navigation -->
                    <div class="flex gap-3 mt-6 pt-4 border-t border-gray-700">
                        ${step > 1 ? `
                            <button onclick="renderRTOWizardStep(${step - 1})" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-bold transition">
                                ← Back
                            </button>
                        ` : ''}
                        ${step < 3 ? `
                            <button onclick="nextRTOStep()" class="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 py-3 px-4 rounded-xl font-bold transition hover:opacity-90">
                                Next →
                            </button>
                        ` : step === 3 ? `
                            <button onclick="generateAndShowContract()" class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-xl font-bold transition hover:opacity-90 flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                Generate Contract
                            </button>
                        ` : `
                            <button onclick="closeRTOWizard()" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-bold transition">
                                Close
                            </button>
                        `}
                        ${step === 1 ? `
                            <button onclick="closeRTOWizard()" class="px-6 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold transition">
                                Cancel
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Run calculations if on step 2
    if (step === 2) {
        setTimeout(updateRTOCalculations, 100);
    }
}

/**
 * Select buyer option (existing renter or manual entry)
 */
/**
 * Select parties option (use existing or manual entry)
 */
window.selectRTOPartiesOption = function(useExisting) {
    const state = window.rtoWizardState;
    state.buyer.useExisting = useExisting;
    
    const manualInputs = document.getElementById('manualPartyInputs');
    const useExistingRadio = document.getElementById('useExisting');
    const enterManuallyRadio = document.getElementById('enterManually');
    
    // Update visual selection
    const labels = document.querySelectorAll('label[onclick*="selectRTOPartiesOption"]');
    labels.forEach(label => {
        label.classList.remove('border-amber-500');
        label.classList.add('border-transparent');
    });
    
    if (useExisting) {
        if (useExistingRadio) {
            useExistingRadio.checked = true;
            useExistingRadio.closest('label')?.classList.add('border-amber-500');
            useExistingRadio.closest('label')?.classList.remove('border-transparent');
        }
        if (enterManuallyRadio) enterManuallyRadio.checked = false;
        if (manualInputs) manualInputs.classList.add('hidden');
        
        // Use existing names
        state.buyer.name = state.existingRenter || '';
        state.seller = state.existingSeller || '';
    } else {
        if (useExistingRadio) useExistingRadio.checked = false;
        if (enterManuallyRadio) {
            enterManuallyRadio.checked = true;
            enterManuallyRadio.closest('label')?.classList.add('border-amber-500');
            enterManuallyRadio.closest('label')?.classList.remove('border-transparent');
        }
        if (manualInputs) manualInputs.classList.remove('hidden');
    }
};

/**
 * Move to next step with validation
 */
window.nextRTOStep = function() {
    const state = window.rtoWizardState;
    
    if (state.step === 1) {
        // Validate parties
        let buyerName, sellerName;
        
        if (state.buyer.useExisting) {
            buyerName = state.existingRenter;
            sellerName = state.existingSeller;
        } else {
            buyerName = document.getElementById('rtoBuyerName')?.value?.trim();
            sellerName = document.getElementById('rtoSellerName')?.value?.trim();
        }
        
        if (!buyerName) {
            showToast('Please enter or select a buyer name', 'error');
            return;
        }
        if (!sellerName) {
            showToast('Please enter or select a seller name', 'error');
            return;
        }
        
        state.buyer.name = buyerName;
        state.seller = sellerName;
    } else if (state.step === 2) {
        // Validate and save financial terms
        const purchasePrice = parseInt(document.getElementById('rtoPurchasePrice')?.value) || 0;
        const termMonths = parseInt(document.getElementById('rtoTermMonthsSlider')?.value) || 24;
        
        // Use manual input as source of truth for down payment (preserves exact dollar amount)
        const manualDownPayment = document.getElementById('rtoDownPaymentManual');
        let downPayment, downPaymentPercent;
        
        if (manualDownPayment && manualDownPayment.value !== '') {
            downPayment = parseInt(manualDownPayment.value) || 0;
            downPaymentPercent = purchasePrice > 0 ? (downPayment / purchasePrice) * 100 : 0;
        } else {
            // Fallback to slider if manual input is empty
            downPaymentPercent = parseInt(document.getElementById('rtoDownPaymentSlider')?.value) ?? 10;
            downPayment = Math.round(purchasePrice * (downPaymentPercent / 100));
        }
        
        if (purchasePrice <= 0) {
            showToast('Please enter a valid purchase price', 'error');
            return;
        }
        if (termMonths < 6 || termMonths > 48) {
            showToast('Term must be between 6 and 48 months', 'error');
            return;
        }
        
        // Calculate monthly payment from amount to finance
        const amountToFinance = purchasePrice - downPayment;
        // Final payment uses PMA Government minimum (already set in state.financial.finalPaymentBase)
        const finalPaymentBase = state.financial.finalPaymentBase;
        const finalPaymentFee = Math.round(finalPaymentBase * 0.10);
        const finalPaymentTotal = finalPaymentBase + finalPaymentFee;
        
        // Monthly payment covers (Amount to Finance - Final Payment Base) over (termMonths - 1) months
        const amountForMonthly = amountToFinance - finalPaymentBase;
        const monthlyPayments = termMonths - 1;
        const monthlyPayment = monthlyPayments > 0 ? Math.round(amountForMonthly / monthlyPayments) : 0;
        
        state.financial = {
            ...state.financial,
            purchasePrice,
            downPaymentPercent,
            downPayment,
            termMonths,
            amountToFinance,
            monthlyPayment,
            finalPaymentBase,
            finalPaymentFee,
            finalPaymentTotal
        };
    }
    
    renderRTOWizardStep(state.step + 1);
};

/**
 * Update down payment when slider changes
 */
window.updateRTODownPayment = function(percent) {
    const purchasePrice = parseInt(document.getElementById('rtoPurchasePrice')?.value) || 0;
    const downPayment = Math.round(purchasePrice * (percent / 100));
    
    const percentEl = document.getElementById('rtoDownPaymentPercent');
    const amountEl = document.getElementById('rtoDownPaymentAmount');
    
    if (percentEl) percentEl.textContent = percent + '%';
    
    // Update manual input field
    const manualInput = document.getElementById('rtoDownPaymentManual');
    if (manualInput) manualInput.value = downPayment;
    
    // Update state
    if (window.rtoWizardState) {
        window.rtoWizardState.financial.downPaymentPercent = parseInt(percent);
        window.rtoWizardState.financial.downPayment = downPayment;
    }
    
    updateRTOCalculations();
};

/**
 * Update down payment when manual input changes
 */
window.updateRTODownPaymentManual = function(amount) {
    const purchasePrice = parseInt(document.getElementById('rtoPurchasePrice')?.value) || 0;
    const downPayment = parseInt(amount) || 0;
    
    // Calculate percentage with decimals for accuracy
    const exactPercent = purchasePrice > 0 ? (downPayment / purchasePrice) * 100 : 0;
    const displayPercent = exactPercent % 1 === 0 ? exactPercent.toFixed(0) : exactPercent.toFixed(2);
    const sliderPercent = Math.round(exactPercent);
    
    const percentEl = document.getElementById('rtoDownPaymentPercent');
    const slider = document.getElementById('rtoDownPaymentSlider');
    
    if (percentEl) percentEl.textContent = displayPercent + '%';
    if (slider) slider.value = Math.min(99, Math.max(0, sliderPercent));
    
    // Update state with exact percentage
    if (window.rtoWizardState) {
        window.rtoWizardState.financial.downPaymentPercent = exactPercent;
        window.rtoWizardState.financial.downPayment = downPayment;
    }
    
    updateRTOCalculations();
};

/**
 * Update term months when slider changes
 */
window.updateRTOTermMonths = function(months) {
    const termDisplay = document.getElementById('rtoTermMonthsDisplay');
    const finalMonth = document.getElementById('rtoFinalMonth');
    const calcMonthsCount = document.getElementById('rtoCalcMonthsCount');
    
    if (termDisplay) termDisplay.textContent = months + ' months';
    if (finalMonth) finalMonth.textContent = months;
    if (calcMonthsCount) calcMonthsCount.textContent = (parseInt(months) - 1);
    
    // Update state
    if (window.rtoWizardState) {
        window.rtoWizardState.financial.termMonths = parseInt(months);
    }
    
    updateRTOCalculations();
};

/**
 * Update calculations in real-time
 * Logic:
 * - Final Payment = PMA Government Minimum (based on property type) + 10% PMA Realtor Fee
 * - Amount for Monthly = Purchase Price - Down Payment - Final Payment Base
 * - Monthly Payment = Amount for Monthly / (Term Months - 1)
 */
window.updateRTOCalculations = function() {
    const state = window.rtoWizardState;
    if (!state) return;
    
    const purchasePrice = parseInt(document.getElementById('rtoPurchasePrice')?.value) || state.financial.purchasePrice || 0;
    
    // Get down payment from manual input field if available, else use stored values
    const manualDownPayment = document.getElementById('rtoDownPaymentManual');
    let downPayment, downPaymentPercent, displayPercent;
    
    if (manualDownPayment) {
        downPayment = parseInt(manualDownPayment.value) || 0;
        // Calculate exact percentage with decimals
        const exactPercent = purchasePrice > 0 ? (downPayment / purchasePrice) * 100 : 0;
        downPaymentPercent = exactPercent;
        // Display with decimals if not a whole number
        displayPercent = exactPercent % 1 === 0 ? exactPercent.toFixed(0) : exactPercent.toFixed(2);
    } else {
        // No manual input field (e.g., on Step 3) - use stored values from state
        // IMPORTANT: Use dollar amount as source of truth, not percentage
        // Use ?? instead of || because 0 is a valid value (0 || 10 = 10, but 0 ?? 10 = 0)
        downPayment = state.financial.downPayment ?? 0;
        downPaymentPercent = state.financial.downPaymentPercent ?? 10;
        displayPercent = downPaymentPercent % 1 === 0 ? downPaymentPercent.toFixed(0) : downPaymentPercent.toFixed(2);
    }
    
    const termMonths = parseInt(document.getElementById('rtoTermMonthsSlider')?.value) || state.financial.termMonths || 24;
    
    // Final payment uses PMA Government minimum (already stored in state)
    const finalPaymentBase = state.financial.finalPaymentBase || 1500000;
    const finalPaymentFee = Math.round(finalPaymentBase * 0.10);
    const finalPaymentTotal = finalPaymentBase + finalPaymentFee;
    
    // Calculate amount for monthly payments (excluding final payment)
    const amountToFinance = purchasePrice - downPayment;
    const amountForMonthly = amountToFinance - finalPaymentBase;
    const monthlyPayments = termMonths - 1;
    const monthlyPayment = monthlyPayments > 0 ? Math.round(amountForMonthly / monthlyPayments) : 0;
    
    // Update down payment display with decimal percentage
    const percentEl = document.getElementById('rtoDownPaymentPercent');
    if (percentEl) percentEl.textContent = displayPercent + '%';
    
    // Update final payment display (PMA Government minimum - fixed)
    const finalBaseEl = document.getElementById('rtoFinalPaymentBase');
    const feeEl = document.getElementById('rtoFinalFee');
    const totalEl = document.getElementById('rtoFinalTotal');
    const finalMonthEl = document.getElementById('rtoFinalMonth');
    if (finalBaseEl) finalBaseEl.textContent = '$' + finalPaymentBase.toLocaleString();
    if (feeEl) feeEl.textContent = '$' + finalPaymentFee.toLocaleString();
    if (totalEl) totalEl.textContent = '$' + finalPaymentTotal.toLocaleString();
    if (finalMonthEl) finalMonthEl.textContent = termMonths;
    
    // Update calculation breakdown
    const calcPurchase = document.getElementById('rtoCalcPurchase');
    const calcDown = document.getElementById('rtoCalcDown');
    const calcFinalMin = document.getElementById('rtoCalcFinalMin');
    const calcFinance = document.getElementById('rtoCalcFinance');
    const calcMonthsCount = document.getElementById('rtoCalcMonthsCount');
    const monthlyEl = document.getElementById('rtoMonthlyPayment');
    
    if (calcPurchase) calcPurchase.textContent = '$' + purchasePrice.toLocaleString();
    if (calcDown) calcDown.textContent = '−$' + downPayment.toLocaleString();
    if (calcFinalMin) calcFinalMin.textContent = '−$' + finalPaymentBase.toLocaleString();
    if (calcFinance) calcFinance.textContent = '$' + amountForMonthly.toLocaleString();
    if (calcMonthsCount) calcMonthsCount.textContent = monthlyPayments;
    if (monthlyEl) monthlyEl.textContent = '$' + monthlyPayment.toLocaleString() + '/mo';
    
    // Update state (preserve propertyCategory)
    state.financial = {
        ...state.financial,
        purchasePrice,
        downPaymentPercent,
        downPayment,
        termMonths,
        monthlyPayment,
        amountToFinance,
        amountForMonthly
    };
};

/**
 * Calculate RTO terms for contract generation
 * Uses PMA Government minimum for final payment + 10% PMA Realtor Fee
 */
function calculateRTOTerms() {
    const state = window.rtoWizardState;
    const f = state.financial;
    
    const remainingBalance = f.purchasePrice - f.downPayment;
    const finalPaymentBase = f.finalPaymentBase || 1500000;
    const finalPaymentFee = Math.round(finalPaymentBase * 0.10);
    const finalPaymentTotal = finalPaymentBase + finalPaymentFee;
    
    // Monthly payment covers (remaining - final) over (term - 1) months
    const amountForMonthly = remainingBalance - finalPaymentBase;
    const monthlyPayments = f.termMonths - 1;
    const monthlyPayment = f.monthlyPayment || (monthlyPayments > 0 ? Math.round(amountForMonthly / monthlyPayments) : 0);
    
    // Format percentage for display (show decimals if not whole number)
    const rawPercent = f.downPaymentPercent || 0;
    const formattedPercent = rawPercent % 1 === 0 ? rawPercent.toFixed(0) : rawPercent.toFixed(2);
    
    return {
        purchasePrice: f.purchasePrice,
        downPayment: f.downPayment,
        downPaymentPercent: formattedPercent,
        downPaymentPercentRaw: rawPercent,
        remainingBalance,
        amountToFinance: remainingBalance,
        amountForMonthly,
        termMonths: f.termMonths,
        monthlyPayment,
        lastMonthlyPayment: monthlyPayment,
        finalPaymentBase,
        finalPaymentFee,
        finalPaymentTotal,
        propertyCategory: f.propertyCategory || 'Unknown',
        realtorFeePercent: 10
    };
}

/**
 * Generate the contract and show step 4
 */
window.generateAndShowContract = function() {
    // Save the start date
    const startDate = document.getElementById('rtoStartDate')?.value;
    window.rtoWizardState.startDate = startDate || new Date().toISOString().split('T')[0];
    
    renderRTOWizardStep(4);
};

/**
 * Generate the full RTO contract
 */
function generateRTOContract() {
    const state = window.rtoWizardState;
    const calc = calculateRTOTerms();
    const startDate = new Date(state.startDate);
    
    // Generate document ID
    const dateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const sellerInitials = state.seller.split(' ').map(n => n[0]).join('').toUpperCase();
    const buyerInitials = state.buyer.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const documentId = `SA-RTO-${dateStr.substring(0, 4)}-${dateStr.substring(4, 8)}-${sellerInitials}-${buyerInitials}`;
    
    // Generate payment schedule
    // All monthly payments are equal, final payment has 10% realtor fee added
    let schedule = [];
    let runningBalance = calc.amountToFinance;
    
    // Down payment entry
    schedule.push({
        num: 'Down Payment',
        date: formatDateForContract(startDate),
        amount: calc.downPayment,
        type: `Down Payment (${calc.downPaymentPercent}%)`,
        balance: runningBalance
    });
    
    // Monthly payments
    for (let i = 1; i <= calc.termMonths; i++) {
        const paymentDate = new Date(startDate);
        paymentDate.setMonth(paymentDate.getMonth() + i);
        
        let amount, type;
        if (i < calc.termMonths) {
            // Regular monthly payment
            amount = calc.monthlyPayment;
            type = 'Monthly';
            runningBalance -= amount;
        } else {
            // Final payment = monthly payment + 10% realtor fee
            amount = calc.finalPaymentTotal;
            type = `Final + 10% Fee`;
            runningBalance = 0;
        }
        
        schedule.push({
            num: i,
            date: formatDateForContract(paymentDate),
            amount: amount,
            type: type,
            balance: Math.max(0, runningBalance)
        });
    }
    
    // Build preview text - use location as fallback for description
    const propertyDesc = state.property.description || state.property.location || 'N/A';
    const preview = `
═══════════════════════════════════════════════════════════════
                    RENT-TO-OWN AGREEMENT
                     PaulysAutos.com
═══════════════════════════════════════════════════════════════

PROPERTY INFORMATION
────────────────────────────────────────────────────────────────
Address: ${state.property.title}
Property Description: ${propertyDesc}
Listing Type: Rent-to-Own
Property Category: ${calc.propertyCategory}

PARTIES INVOLVED
────────────────────────────────────────────────────────────────
Seller/Landlord: ${state.seller}
Buyer/Tenant: ${state.buyer.name}
Realtor/Brokerage: ${state.seller} / PaulysAutos.com

FINANCIAL STRUCTURE
────────────────────────────────────────────────────────────────
Item                              Amount
─────────────────────────────────────────────────────
Total Purchase Price              $${calc.purchasePrice.toLocaleString()}
Down Payment (${calc.downPaymentPercent}%)              $${calc.downPayment.toLocaleString()}
Remaining Balance to Finance      $${calc.remainingBalance.toLocaleString()}
Term Length                       ${calc.termMonths} Months
Monthly Payments (×${calc.termMonths - 1})         $${calc.monthlyPayment.toLocaleString()}
Final Payment Base (PMA Min)      $${calc.finalPaymentBase.toLocaleString()}
+ PMA Realtor Fee (10%)           $${calc.finalPaymentFee.toLocaleString()}
= Total Final Payment             $${calc.finalPaymentTotal.toLocaleString()}

COMPLETE PAYMENT SCHEDULE
────────────────────────────────────────────────────────────────
Agreement Start Date: ${formatDateForContract(startDate)}

${schedule.map(p => 
    `${String(p.num).padEnd(12)} ${p.date.padEnd(14)} $${p.amount.toLocaleString().padStart(12)} ${p.type.padEnd(20)} $${p.balance.toLocaleString()}`
).join('\n')}

FINAL PAYMENT BREAKDOWN
────────────────────────────────────────────────────────────────
• Base Final Payment (PMA Min): $${calc.finalPaymentBase.toLocaleString()}
• PMA Realtor Fee (10%): $${calc.finalPaymentFee.toLocaleString()}
• Total Final Payment: $${calc.finalPaymentTotal.toLocaleString()}
• Property Category: ${calc.propertyCategory}

CONTRACT TERMS
────────────────────────────────────────────────────────────────
Payment Terms:
• Monthly payments of $${calc.monthlyPayment.toLocaleString()} due on the ${startDate.getDate()}${getOrdinalSuffix(startDate.getDate())} of each month
• Final payment of $${calc.finalPaymentTotal.toLocaleString()} due on ${formatDateForContract(new Date(startDate.setMonth(startDate.getMonth() + calc.termMonths)))}
• 3-day grace period before late fees apply

Late Payment:
• $50,000 late fee after 3 days
• Default possible after 14 days late

Default:
• Two consecutive missed payments = default
• Seller retains all previous payments as liquidated damages
• Buyer must vacate within 72 hours of default notice

Property Maintenance:
• Buyer responsible for all maintenance
• No major modifications without seller consent

Transfer of Ownership:
• Full ownership transfers upon final payment completion
• Title transfer within 7 days of final payment
• PaulysAutos.com facilitates transfer

Early Payoff:
• Allowed without penalty
• $${calc.finalPaymentFee.toLocaleString()} PMA Realtor Fee still applies upon transfer

DOCUMENT IDENTIFIERS
────────────────────────────────────────────────────────────────
• Document ID: ${documentId}
• Jurisdiction: State of San Andreas
• Generated: ${new Date().toLocaleString()}

═══════════════════════════════════════════════════════════════
                    SIGNATURES REQUIRED
═══════════════════════════════════════════════════════════════

Seller/Landlord: _________________________ Date: ___________
                 ${state.seller}

Buyer/Tenant:    _________________________ Date: ___________
                 ${state.buyer.name}

PaulysAutos.com: ____________________ Date: ___________
                      Authorized Representative

═══════════════════════════════════════════════════════════════
`;

    // Store for later use
    window.rtoGeneratedContract = {
        documentId,
        preview,
        data: {
            ...state,
            calculations: calc,
            schedule,
            generatedAt: new Date().toISOString()
        }
    };
    
    return { documentId, preview };
}

/**
 * Format date for contract display
 */
function formatDateForContract(date) {
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

/**
 * Get ordinal suffix for day
 */
function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

/**
 * Copy contract to clipboard
 */
window.copyRTOContract = function() {
    const contract = window.rtoGeneratedContract;
    if (!contract) {
        showToast('No contract generated', 'error');
        return;
    }
    
    navigator.clipboard.writeText(contract.preview).then(() => {
        showToast('📋 Contract copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Failed to copy', 'error');
    });
};

/**
 * Save contract to Firestore
 */
window.saveRTOContract = async function() {
    const contract = window.rtoGeneratedContract;
    if (!contract) {
        showToast('No contract generated', 'error');
        return;
    }
    
    try {
        const state = window.rtoWizardState;
        const calc = contract.data.calculations;
        
        // Calculate initial remaining balance and expected monthly
        const initialRemainingBalance = calc.purchasePrice - calc.downPayment;
        const finalPaymentBase = calc.finalPaymentBase || 1500000;
        const remainingMonths = calc.termMonths - 1; // -1 for final payment month
        const amountForMonthly = initialRemainingBalance - finalPaymentBase;
        const initialExpectedMonthly = remainingMonths > 0 ? Math.round(amountForMonthly / remainingMonths) : 0;
        
        // Auto-mark $0 deposit as paid
        const isZeroDeposit = calc.downPayment === 0;
        const depositPaidStatus = isZeroDeposit;
        const depositPaidDate = isZeroDeposit ? state.startDate : null;
        
        // Save contract to Firestore
        await db.collection('rentToOwnContracts').doc(contract.documentId).set({
            documentId: contract.documentId,
            propertyId: state.propertyId,
            propertyTitle: state.property.title,
            propertyDescription: state.property.description,
            seller: state.seller,
            buyer: state.buyer.name,
            financial: state.financial,
            calculations: calc,
            schedule: contract.data.schedule,
            startDate: state.startDate,
            currentPaymentNumber: 0, // Will be 1 after first monthly payment
            totalPayments: calc.termMonths,
            // Deposit tracking - auto-mark $0 deposit as paid
            depositAmount: calc.downPayment,
            depositPaid: depositPaidStatus,
            depositPaidDate: depositPaidDate,
            // Balance tracking for dynamic recalculation
            remainingBalance: initialRemainingBalance,
            expectedMonthlyPayment: initialExpectedMonthly,
            finalPaymentBase: finalPaymentBase,
            // Payment history array for tracking expected vs actual
            rtoPaymentHistory: [],
            status: 'active',
            createdBy: auth.currentUser?.email || 'unknown',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            contractText: contract.preview
        });
        
        // Update property with RTO info and clear daily/biweekly, set monthly to contract payment
        const propertyUpdates = {
            // Clear daily and biweekly
            dailyPrice: 0,
            biweeklyPrice: 0,
            weeklyPrice: 0,
            // Set monthly to the contract's monthly payment
            monthlyPrice: calc.monthlyPayment,
            // Mark RTO active
            hasActiveRTO: true,
            rtoContractId: contract.documentId,
            rtoCurrentPayment: 0,
            rtoTotalPayments: calc.termMonths,
            rtoBuyer: state.buyer.name,
            rtoStartDate: state.startDate,
            // Deposit tracking - auto-mark $0 deposit as paid
            rtoDepositAmount: calc.downPayment,
            rtoDepositPaid: depositPaidStatus,
            rtoDepositPaidDate: depositPaidDate,
            // Balance tracking for dynamic recalculation
            rtoRemainingBalance: initialRemainingBalance,
            rtoExpectedMonthly: initialExpectedMonthly,
            rtoFinalPaymentBase: finalPaymentBase,
            // Set payment frequency to monthly
            paymentFrequency: 'monthly'
        };
        
        // Update property via PropertyDataService (writes to settings/properties)
        await PropertyDataService.writeMultiple(state.propertyId, propertyUpdates);
        
        const depositMsg = isZeroDeposit ? ' ($0 deposit auto-marked as waived)' : '';
        showToast(`✅ Contract saved!${depositMsg} Property updated to RTO monthly payments.`, 'success');
        
        // Award XP for creating RTO contract
        if (typeof GamificationService !== 'undefined' && GamificationService.awardXP) {
            const userId = auth.currentUser?.uid;
            if (userId) {
                await GamificationService.awardXP(userId, 150, `Created rent-to-own contract: ${contract.documentId}`);
            }
        }
        
        // Close the modal after a short delay and refresh the page
        setTimeout(() => {
            closeRTOWizard();
            // Refresh the property stats page
            if (typeof showPropertyStats === 'function') {
                showPropertyStats(state.propertyId);
            }
        }, 1500);
        
    } catch (error) {
        console.error('Error saving contract:', error);
        showToast('Failed to save contract: ' + error.message, 'error');
    }
};

/**
 * Generate contract image with cursive signatures
 */
window.downloadRTOContractImage = async function() {
    const contract = window.rtoGeneratedContract;
    const state = window.rtoWizardState;
    if (!contract || !state) {
        showToast('No contract generated', 'error');
        return;
    }
    
    showToast('🖼️ Generating contract image...', 'info');
    
    const calc = contract.data.calculations;
    const startDate = new Date(state.startDate);
    
    // Create canvas - SQUARE format
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to square
    const size = 1000;
    canvas.width = size;
    canvas.height = size;
    
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle texture/gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    let y = 50;
    const margin = 60;
    const contentWidth = canvas.width - (margin * 2);
    
    // Helper functions
    const drawText = (text, x, fontSize, color, font = 'Arial') => {
        ctx.font = `${fontSize}px ${font}`;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        y += fontSize + 6;
    };
    
    const drawLine = () => {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(canvas.width - margin, y);
        ctx.stroke();
        y += 12;
    };
    
    const drawCursiveSignature = (name, x, signatureY) => {
        ctx.font = 'italic 24px Georgia, serif';
        ctx.fillStyle = '#3b82f6';
        ctx.fillText(name, x, signatureY);
    };
    
    // === HEADER ===
    ctx.textAlign = 'center';
    drawText('RENT-TO-OWN AGREEMENT', canvas.width / 2, 26, '#f59e0b', 'Arial Black');
    drawText('PaulysAutos.com', canvas.width / 2, 18, '#fbbf24', 'Arial');
    y += 8;
    drawLine();
    
    // === PROPERTY INFORMATION ===
    ctx.textAlign = 'left';
    y += 8;
    drawText('PROPERTY INFORMATION', margin, 16, '#f59e0b', 'Arial Black');
    drawText(`Address: ${state.property.title}`, margin, 13, '#ffffff');
    
    // Description - use location field
    const desc = state.property.description || state.property.location || 'N/A';
    ctx.font = '11px Arial';
    const words = desc.split(' ');
    let line = 'Description: ';
    for (let word of words) {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > contentWidth) {
            ctx.fillStyle = '#9ca3af';
            ctx.fillText(line, margin, y);
            y += 14;
            line = word + ' ';
        } else {
            line = testLine;
        }
    }
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(line, margin, y);
    y += 16;
    
    drawText('Listing Type: Rent-to-Own', margin, 12, '#ffffff');
    drawText(`Property Category: ${calc.propertyCategory}`, margin, 11, '#fbbf24');
    y += 6;
    
    // === PARTIES INVOLVED ===
    drawLine();
    y += 4;
    drawText('PARTIES INVOLVED', margin, 16, '#f59e0b', 'Arial Black');
    drawText(`Seller/Landlord: 👑 ${state.seller}`, margin, 12, '#ffffff');
    drawText(`Buyer/Tenant: ${state.buyer.name}`, margin, 12, '#ffffff');
    drawText(`Realtor/Brokerage: 👑 ${state.seller} / PaulysAutos.com`, margin, 12, '#ffffff');
    y += 6;
    
    // === FINANCIAL STRUCTURE ===
    drawLine();
    y += 4;
    drawText('FINANCIAL STRUCTURE', margin, 16, '#f59e0b', 'Arial Black');
    
    const financialItems = [
        ['Total Purchase Price', `$${calc.purchasePrice.toLocaleString()}`],
        [`Down Payment (${calc.downPaymentPercent ?? 10}%)`, `$${calc.downPayment.toLocaleString()}`],
        ['Remaining Balance to Finance', `$${calc.remainingBalance.toLocaleString()}`],
        ['Term Length', `${calc.termMonths} Months`],
        [`Monthly Payments (×${calc.termMonths - 1})`, `$${calc.monthlyPayment.toLocaleString()}`],
        ['Final Payment Base (PMA Min)', `$${calc.finalPaymentBase.toLocaleString()}`],
        ['+ PMA Realtor Fee (10%)', `$${calc.finalPaymentFee.toLocaleString()}`],
        ['= Total Final Payment', `$${calc.finalPaymentTotal.toLocaleString()}`]
    ];
    
    financialItems.forEach(([label, value]) => {
        ctx.font = '12px Arial';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(label, margin, y);
        ctx.fillStyle = '#10b981';
        ctx.fillText(value, margin + 280, y);
        y += 18;
    });
    
    y += 6;
    
    // === CONTRACT TERMS SUMMARY ===
    drawLine();
    y += 4;
    drawText('KEY CONTRACT TERMS', margin, 16, '#f59e0b', 'Arial Black');
    drawText(`• Monthly payments due on the ${startDate.getDate()}${getOrdinalSuffix(startDate.getDate())} of each month`, margin, 11, '#ffffff');
    drawText('• 3-day grace period before $50,000 late fee', margin, 11, '#ffffff');
    drawText('• Two consecutive missed payments = default', margin, 11, '#ffffff');
    drawText('• Full ownership transfers upon final payment', margin, 11, '#ffffff');
    y += 10;
    
    // === DOCUMENT ID ===
    drawLine();
    y += 4;
    drawText(`Document ID: ${contract.documentId}`, margin, 12, '#9ca3af');
    drawText(`Generated: ${new Date().toLocaleDateString()}`, margin, 10, '#6b7280');
    y += 12;
    
    // === SIGNATURES SECTION ===
    drawLine();
    y += 8;
    ctx.textAlign = 'center';
    drawText('SIGNATURES', canvas.width / 2, 18, '#f59e0b', 'Arial Black');
    ctx.textAlign = 'left';
    y += 12;
    
    // Signature boxes - side by side
    const sigBoxWidth = 380;
    const sigBoxHeight = 60;
    const sigSpacing = 20;
    
    // Seller signature
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, sigBoxWidth, sigBoxHeight);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(margin + 1, y + 1, sigBoxWidth - 2, sigBoxHeight - 2);
    
    // Draw cursive signature for seller with crown
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('👑 ' + state.seller, margin + 15, y + 38);
    
    ctx.font = '10px Arial';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Seller/Landlord', margin, y + sigBoxHeight + 12);
    ctx.fillText('👑 ' + state.seller, margin, y + sigBoxHeight + 24);
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, margin + 180, y + sigBoxHeight + 12);
    
    // Buyer signature
    const buyerX = margin + sigBoxWidth + sigSpacing;
    ctx.strokeStyle = '#4b5563';
    ctx.strokeRect(buyerX, y, sigBoxWidth, sigBoxHeight);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(buyerX + 1, y + 1, sigBoxWidth - 2, sigBoxHeight - 2);
    
    // Draw cursive signature for buyer
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(state.buyer.name, buyerX + 15, y + 38);
    
    ctx.font = '10px Arial';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Buyer/Tenant', buyerX, y + sigBoxHeight + 12);
    ctx.fillText(state.buyer.name, buyerX, y + sigBoxHeight + 24);
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, buyerX + 180, y + sigBoxHeight + 12);
    
    y += sigBoxHeight + 45;
    
    // Footer
    ctx.textAlign = 'center';
    ctx.font = '9px Arial';
    ctx.fillStyle = '#4b5563';
    ctx.fillText('This document is a legally binding agreement in the State of San Andreas', canvas.width / 2, y);
    ctx.fillText('© PaulysAutos.com - All Rights Reserved', canvas.width / 2, y + 12);
    
    // Convert to blob and download
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${contract.documentId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('📥 Contract image downloaded!', 'success');
    }, 'image/png');
};

/**
 * Close the RTO wizard
 */
window.closeRTOWizard = function() {
    const modal = document.getElementById('rtoWizardModal');
    if (modal) modal.remove();
    window.rtoWizardState = null;
    window.rtoGeneratedContract = null;
};

/**
 * View an existing RTO contract
 */
window.viewRTOContract = async function(contractId) {
    if (!contractId) {
        showToast('No contract ID provided', 'error');
        return;
    }
    
    try {
        showToast('📄 Loading contract...', 'info');
        
        const doc = await db.collection('rentToOwnContracts').doc(contractId).get();
        if (!doc.exists) {
            showToast('Contract not found', 'error');
            return;
        }
        
        const contract = doc.data();
        
        // Show contract in a modal
        const modalHTML = `
            <div id="viewContractModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) this.remove()">
                <div class="bg-gray-900 rounded-2xl max-w-3xl w-full border border-cyan-500/50 shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
                    <div class="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
                        <h3 class="text-xl font-bold text-white flex items-center gap-3">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Rent-to-Own Contract
                        </h3>
                        <p class="text-cyan-100 text-sm mt-1">${contract.propertyTitle}</p>
                    </div>
                    
                    <div class="p-6 max-h-[70vh] overflow-y-auto">
                        <div class="grid grid-cols-2 gap-4 mb-6">
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="text-gray-400 text-xs mb-1">Document ID</div>
                                <div class="text-white font-mono text-sm">${contract.documentId}</div>
                            </div>
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="text-gray-400 text-xs mb-1">Status</div>
                                <div class="text-green-400 font-bold">${contract.status || 'Active'}</div>
                            </div>
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="text-gray-400 text-xs mb-1">Seller</div>
                                <div class="text-white font-semibold">${contract.seller}</div>
                            </div>
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="text-gray-400 text-xs mb-1">Buyer</div>
                                <div class="text-white font-semibold">${contract.buyer}</div>
                            </div>
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="text-gray-400 text-xs mb-1">Payment Progress</div>
                                <div class="text-amber-400 font-bold">${contract.currentPaymentNumber || 0} of ${contract.totalPayments || contract.calculations?.termMonths || 24}</div>
                            </div>
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="text-gray-400 text-xs mb-1">Monthly Payment</div>
                                <div class="text-green-400 font-bold">$${(contract.calculations?.monthlyPayment || 0).toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <div class="bg-gray-800 rounded-xl p-4 mb-4">
                            <h4 class="text-amber-400 font-bold mb-2">Full Contract Text</h4>
                            <div class="bg-gray-900 rounded-lg p-4 max-h-60 overflow-y-auto">
                                <pre class="text-xs text-gray-300 whitespace-pre-wrap font-mono">${contract.contractText || 'Contract text not available'}</pre>
                            </div>
                        </div>
                    </div>
                    
                    <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                        <button onclick="navigator.clipboard.writeText(document.querySelector('#viewContractModal pre').textContent).then(() => showToast('📋 Contract copied!', 'success'))" class="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                            📋 Copy Contract
                        </button>
                        <button onclick="document.getElementById('viewContractModal').remove()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Error loading contract:', error);
        showToast('Failed to load contract: ' + error.message, 'error');
    }
};

/**
 * Show confirmation modal before deleting RTO contract
 */
window.confirmDeleteRTOContract = function(propertyId, contractId) {
    if (!contractId) {
        showToast('No contract ID provided', 'error');
        return;
    }
    
    const modalHTML = `
        <div id="deleteRTOConfirmModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) this.remove()">
            <div class="bg-gray-900 rounded-2xl max-w-md w-full border border-red-500/50 shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
                <div class="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        Delete RTO Contract?
                    </h3>
                </div>
                
                <div class="p-6">
                    <p class="text-gray-300 mb-4">Are you sure you want to delete this Rent-to-Own contract? This will:</p>
                    <ul class="text-gray-400 text-sm space-y-2 mb-6">
                        <li class="flex items-start gap-2">
                            <span class="text-red-400">✗</span>
                            <span>Remove the contract from the database</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-red-400">✗</span>
                            <span>Clear all RTO status from the property</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-red-400">✗</span>
                            <span>Reset payment tracking to zero</span>
                        </li>
                    </ul>
                    <p class="text-amber-400 text-sm font-medium">⚠️ This action cannot be undone!</p>
                </div>
                
                <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                    <button onclick="document.getElementById('deleteRTOConfirmModal').remove()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button onclick="deleteRTOContract(${propertyId}, '${contractId}')" class="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                        🗑️ Delete Contract
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modal
    const existing = document.getElementById('deleteRTOConfirmModal');
    if (existing) existing.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

/**
 * Delete RTO contract and clear all related property data
 */
window.deleteRTOContract = async function(propertyId, contractId) {
    try {
        showToast('🗑️ Deleting contract...', 'info');
        
        // Close the confirmation modal
        const modal = document.getElementById('deleteRTOConfirmModal');
        if (modal) modal.remove();
        
        // 1. Delete the contract document from Firestore
        if (contractId) {
            await db.collection('rentToOwnContracts').doc(contractId).delete();
            console.log(`[RTO] Deleted contract document: ${contractId}`);
        }
        
        // 2. Remove last RTO-related payment(s) from payment history
        try {
            const historyDoc = await db.collection('paymentHistory').doc(String(propertyId)).get();
            if (historyDoc.exists) {
                let payments = historyDoc.data().payments || [];
                const originalCount = payments.length;
                
                // Filter out any payments that were RTO payments (deposit or monthly)
                payments = payments.filter(p => !p.isRTOPayment && !p.isRTODeposit);
                
                const removedCount = originalCount - payments.length;
                if (removedCount > 0) {
                    await db.collection('paymentHistory').doc(String(propertyId)).set({
                        propertyId: propertyId,
                        payments: payments,
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`[RTO] Removed ${removedCount} RTO payment(s) from history`);
                }
            }
        } catch (e) {
            console.warn('[RTO] Could not clean up payment history:', e);
        }
        
        // 3. Clear all RTO-related fields from the property (including monthlyPrice)
        const rtoFieldsToClear = {
            hasActiveRTO: false,
            rtoContractId: '',
            rtoCurrentPayment: 0,
            rtoTotalPayments: 0,
            rtoBuyer: '',
            rtoStartDate: '',
            rtoDepositAmount: 0,
            rtoDepositPaid: false,
            rtoDepositPaidDate: '',
            // Clear balance tracking fields
            rtoRemainingBalance: 0,
            rtoExpectedMonthly: 0,
            rtoFinalPaymentBase: 0,
            // Reset monthly price since RTO set it
            monthlyPrice: 0
        };
        
        await PropertyDataService.writeMultiple(propertyId, rtoFieldsToClear);
        console.log(`[RTO] Cleared RTO fields and monthlyPrice from property ${propertyId}`);
        
        // 4. Update local properties array
        const prop = properties.find(p => p.id === propertyId);
        if (prop) {
            Object.assign(prop, rtoFieldsToClear);
        }
        
        showToast('✅ Contract deleted successfully!', 'success');
        
        // 5. Refresh the property stats page
        if (typeof renderPropertyStatsContent === 'function') {
            renderPropertyStatsContent(propertyId);
        }
        
    } catch (error) {
        console.error('Error deleting RTO contract:', error);
        showToast('Failed to delete contract: ' + error.message, 'error');
    }
};

// ==================== RTO PAYMENT MODAL ====================

/**
 * Show the RTO Payment Modal for logging payments with custom amounts
 */
window.showRTOPaymentModal = function(propertyId) {
    const p = properties.find(prop => prop.id === propertyId);
    if (!p) {
        showToast('Property not found', 'error');
        return;
    }
    
    const renterName = PropertyDataService.getValue(propertyId, 'renterName', p?.renterName || 'Unknown');
    const rtoDepositPaid = PropertyDataService.getValue(propertyId, 'rtoDepositPaid', p?.rtoDepositPaid || false);
    const rtoDepositAmount = PropertyDataService.getValue(propertyId, 'rtoDepositAmount', p?.rtoDepositAmount || 0);
    const rtoCurrentPayment = PropertyDataService.getValue(propertyId, 'rtoCurrentPayment', p?.rtoCurrentPayment || 0);
    const rtoTotalPayments = PropertyDataService.getValue(propertyId, 'rtoTotalPayments', p?.rtoTotalPayments || 24);
    const rtoRemainingBalance = PropertyDataService.getValue(propertyId, 'rtoRemainingBalance', p?.rtoRemainingBalance || 0);
    const rtoExpectedMonthly = PropertyDataService.getValue(propertyId, 'rtoExpectedMonthly', p?.rtoExpectedMonthly || 0);
    const rtoFinalPaymentBase = PropertyDataService.getValue(propertyId, 'rtoFinalPaymentBase', p?.rtoFinalPaymentBase || 1650000);
    
    // Determine what type of payment this is
    let paymentType, paymentNumber, expectedAmount, maxPayment;
    
    if (!rtoDepositPaid && rtoDepositAmount > 0) {
        // Deposit not yet paid
        paymentType = 'deposit';
        paymentNumber = 0;
        expectedAmount = rtoDepositAmount;
        maxPayment = rtoDepositAmount * 10; // Allow overpayment on deposit
    } else {
        // Monthly payment
        paymentType = 'monthly';
        paymentNumber = rtoCurrentPayment + 1;
        expectedAmount = rtoExpectedMonthly;
        // Max payment = remaining balance minus final payment (to prevent negative recalculation)
        const amountForMonthly = rtoRemainingBalance - rtoFinalPaymentBase;
        maxPayment = Math.max(0, amountForMonthly);
    }
    
    const today = new Date().toISOString().split('T')[0];
    const titleText = paymentType === 'deposit' 
        ? 'Log RTO Deposit Payment' 
        : `Log RTO Payment - Month ${paymentNumber} of ${rtoTotalPayments - 1}`;
    
    const modalHTML = `
        <div id="rtoPaymentModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-900 rounded-2xl max-w-md w-full border border-amber-500/50 shadow-2xl overflow-hidden relative">
                <!-- X Close Button -->
                <button onclick="closeRTOPaymentModal()" class="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                
                <div class="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-3">
                        <span>💰</span>
                        ${titleText}
                    </h3>
                    <p class="text-amber-100 text-sm mt-1">Renter: ${renterName}</p>
                </div>
                
                <div class="p-6 space-y-4">
                    <!-- Expected Amount Display -->
                    <div class="bg-gray-800 rounded-xl p-4">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-400">Expected Amount:</span>
                            <span class="text-green-400 font-bold text-xl">$${expectedAmount.toLocaleString()}</span>
                        </div>
                        ${paymentType === 'monthly' ? `
                        <div class="flex justify-between items-center mt-2 text-sm">
                            <span class="text-gray-500">Remaining Balance:</span>
                            <span class="text-gray-400">$${rtoRemainingBalance.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-500">Max Payment Allowed:</span>
                            <span class="text-amber-400">$${maxPayment.toLocaleString()}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Actual Amount Input -->
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Actual Amount Received:</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                            <input type="number" 
                                   id="rtoPaymentAmount" 
                                   value="${expectedAmount}" 
                                   min="1"
                                   max="${maxPayment}"
                                   class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 pl-8 text-white text-lg font-bold focus:border-amber-500 focus:outline-none">
                        </div>
                        <p class="text-gray-500 text-xs mt-1">Pre-filled with expected amount. Edit if different.</p>
                    </div>
                    
                    <!-- Payment Date -->
                    <div>
                        <label class="block text-gray-400 text-sm mb-2">Payment Date:</label>
                        <input type="date" 
                               id="rtoPaymentDate" 
                               value="${today}"
                               class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-amber-500 focus:outline-none">
                    </div>
                    
                    ${paymentType === 'monthly' ? `
                    <!-- Overpayment Warning -->
                    <div id="rtoPaymentWarning" class="hidden bg-red-900/50 border border-red-500/50 rounded-xl p-3 text-sm">
                        <span class="text-red-400">⚠️ Payment exceeds maximum allowed. This would cause negative remaining balance for monthly payments.</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                    <button onclick="closeRTOPaymentModal()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button onclick="submitRTOPayment(${propertyId}, '${paymentType}', ${expectedAmount}, ${maxPayment})" class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                        ✓ Log Payment
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modal
    const existing = document.getElementById('rtoPaymentModal');
    if (existing) existing.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add input validation listener
    const amountInput = document.getElementById('rtoPaymentAmount');
    const warningEl = document.getElementById('rtoPaymentWarning');
    if (amountInput && paymentType === 'monthly') {
        amountInput.addEventListener('input', () => {
            const amount = parseInt(amountInput.value) || 0;
            if (amount > maxPayment && warningEl) {
                warningEl.classList.remove('hidden');
            } else if (warningEl) {
                warningEl.classList.add('hidden');
            }
        });
    }
};

window.closeRTOPaymentModal = function() {
    const modal = document.getElementById('rtoPaymentModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.2s';
        setTimeout(() => modal.remove(), 200);
    }
};

/**
 * Submit RTO Payment - handles both deposit and monthly payments
 */
window.submitRTOPayment = async function(propertyId, paymentType, expectedAmount, maxPayment) {
    const amountInput = document.getElementById('rtoPaymentAmount');
    const dateInput = document.getElementById('rtoPaymentDate');
    
    if (!amountInput || !dateInput) {
        showToast('Error: Missing form fields', 'error');
        return;
    }
    
    const actualAmount = parseInt(amountInput.value) || 0;
    const paymentDate = dateInput.value;
    
    // Validation
    if (actualAmount <= 0) {
        showToast('Please enter a valid payment amount', 'error');
        return;
    }
    
    if (!paymentDate) {
        showToast('Please select a payment date', 'error');
        return;
    }
    
    // For monthly payments, check max payment limit
    if (paymentType === 'monthly' && actualAmount > maxPayment) {
        showToast(`Payment exceeds maximum allowed ($${maxPayment.toLocaleString()}). This would cause negative remaining balance.`, 'error');
        return;
    }
    
    try {
        showToast('💰 Recording payment...', 'info');
        closeRTOPaymentModal();
        
        const p = properties.find(prop => prop.id === propertyId);
        const renterName = PropertyDataService.getValue(propertyId, 'renterName', p?.renterName || 'Unknown');
        const rtoContractId = PropertyDataService.getValue(propertyId, 'rtoContractId', p?.rtoContractId || '');
        const rtoTotalPayments = PropertyDataService.getValue(propertyId, 'rtoTotalPayments', p?.rtoTotalPayments || 24);
        const rtoFinalPaymentBase = PropertyDataService.getValue(propertyId, 'rtoFinalPaymentBase', p?.rtoFinalPaymentBase || 1650000);
        
        if (paymentType === 'deposit') {
            // Record deposit payment
            await PropertyDataService.writeMultiple(propertyId, {
                rtoDepositPaid: true,
                rtoDepositPaidDate: paymentDate,
                lastPaymentDate: paymentDate
            });
            
            // Update contract
            if (rtoContractId) {
                await db.collection('rentToOwnContracts').doc(rtoContractId).update({
                    depositPaid: true,
                    depositPaidDate: paymentDate,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Log to payment history
            await logPayment(propertyId, {
                paymentDate: paymentDate,
                recordedAt: new Date().toISOString(),
                renterName: renterName,
                frequency: 'deposit',
                amount: actualAmount,
                expectedAmount: expectedAmount,
                recordedBy: auth.currentUser?.email || 'owner',
                isRTOPayment: true,
                isRTODeposit: true
            });
            
            // Calculate next due date (1 month from payment)
            const nextDate = new Date(paymentDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            const nextDueDateStr = nextDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            
            // Get expected monthly for message
            const rtoExpectedMonthly = PropertyDataService.getValue(propertyId, 'rtoExpectedMonthly', p?.rtoExpectedMonthly || 0);
            const rtoRemainingBalance = PropertyDataService.getValue(propertyId, 'rtoRemainingBalance', p?.rtoRemainingBalance || 0);
            
            // Show confirmation
            showRTOPaymentConfirmation(renterName, actualAmount, expectedAmount, {
                type: 'deposit',
                nextDueDate: nextDueDateStr,
                nextExpectedAmount: rtoExpectedMonthly,
                remainingBalance: rtoRemainingBalance
            });
            
        } else {
            // Record monthly payment with recalculation
            const rtoCurrentPayment = PropertyDataService.getValue(propertyId, 'rtoCurrentPayment', p?.rtoCurrentPayment || 0);
            const rtoRemainingBalance = PropertyDataService.getValue(propertyId, 'rtoRemainingBalance', p?.rtoRemainingBalance || 0);
            
            const newPaymentNumber = rtoCurrentPayment + 1;
            const newRemainingBalance = rtoRemainingBalance - actualAmount;
            
            // Calculate new expected monthly (only recalculate for next payment, not historical)
            const remainingMonths = (rtoTotalPayments - 1) - newPaymentNumber; // -1 for final payment month
            const amountForMonthly = newRemainingBalance - rtoFinalPaymentBase;
            const newExpectedMonthly = remainingMonths > 0 ? Math.round(amountForMonthly / remainingMonths) : 0;
            
            // Update property
            await PropertyDataService.writeMultiple(propertyId, {
                rtoCurrentPayment: newPaymentNumber,
                rtoRemainingBalance: newRemainingBalance,
                rtoExpectedMonthly: newExpectedMonthly,
                monthlyPrice: newExpectedMonthly, // Update displayed monthly price
                lastPaymentDate: paymentDate
            });
            
            // Update contract
            if (rtoContractId) {
                // Get existing payment history from contract
                const contractDoc = await db.collection('rentToOwnContracts').doc(rtoContractId).get();
                let rtoPaymentHistory = [];
                if (contractDoc.exists) {
                    rtoPaymentHistory = contractDoc.data().rtoPaymentHistory || [];
                }
                
                // Add new payment record
                rtoPaymentHistory.push({
                    month: newPaymentNumber,
                    expected: expectedAmount,
                    actual: actualAmount,
                    date: paymentDate,
                    remainingBalanceAfter: newRemainingBalance,
                    recordedBy: auth.currentUser?.email || 'owner',
                    recordedAt: new Date().toISOString()
                });
                
                await db.collection('rentToOwnContracts').doc(rtoContractId).update({
                    currentPaymentNumber: newPaymentNumber,
                    remainingBalance: newRemainingBalance,
                    expectedMonthlyPayment: newExpectedMonthly,
                    rtoPaymentHistory: rtoPaymentHistory,
                    lastPaymentDate: paymentDate,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Log to payment history
            await logPayment(propertyId, {
                paymentDate: paymentDate,
                recordedAt: new Date().toISOString(),
                renterName: renterName,
                frequency: 'monthly',
                amount: actualAmount,
                expectedAmount: expectedAmount,
                rtoMonth: newPaymentNumber,
                recordedBy: auth.currentUser?.email || 'owner',
                isRTOPayment: true,
                isRTODeposit: false
            });
            
            // Calculate next due date (1 month from payment)
            const nextDate = new Date(paymentDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            const nextDueDateStr = nextDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            
            // Show confirmation
            showRTOPaymentConfirmation(renterName, actualAmount, expectedAmount, {
                type: 'monthly',
                paymentNumber: newPaymentNumber,
                totalPayments: rtoTotalPayments - 1, // -1 for final payment
                nextDueDate: nextDueDateStr,
                nextExpectedAmount: newExpectedMonthly,
                remainingBalance: newRemainingBalance
            });
            
            // Check if RTO is complete (remaining balance is 0 or less)
            if (newRemainingBalance <= 0) {
                // Delay to let confirmation modal show first, then prompt for sale
                setTimeout(() => {
                    showRTOCompletionPrompt(propertyId, rtoContractId, renterName, p?.title);
                }, 2000);
            }
        }
        
        // Refresh the property stats page
        setTimeout(() => {
            if (typeof renderPropertyStatsContent === 'function') {
                renderPropertyStatsContent(propertyId);
            }
        }, 500);
        
    } catch (error) {
        console.error('Error recording RTO payment:', error);
        showToast('Failed to record payment: ' + error.message, 'error');
    }
};

/**
 * Show RTO payment confirmation modal with detailed message
 */
window.showRTOPaymentConfirmation = function(renterName, actualAmount, expectedAmount, info) {
    // Get display name - handle titles like Dr., Mr., Mrs., Ms.
    const nameParts = renterName.trim().split(' ');
    const titles = ['dr.', 'dr', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms', 'miss', 'prof.', 'prof'];
    let displayName;
    
    if (nameParts.length >= 2 && titles.includes(nameParts[0].toLowerCase())) {
        // Has a title - use "Title Lastname" (e.g., "Dr. Smith")
        const title = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        displayName = `${title} ${lastName}`;
    } else {
        // No title - just use first name
        displayName = nameParts[0];
    }
    
    let thankYouMessage, headerText, badgeText;
    
    if (info.type === 'deposit') {
        headerText = 'Deposit Received!';
        badgeText = '💰 RTO Deposit';
        thankYouMessage = `Thanks ${displayName}! 🙏 Your deposit of $${actualAmount.toLocaleString()} for your Rent-to-Own agreement has been received. Your remaining balance is $${info.remainingBalance.toLocaleString()}. Your first monthly payment of $${info.nextExpectedAmount.toLocaleString()} is due on ${info.nextDueDate}. Let me know if you have any questions!`;
    } else {
        headerText = 'Payment Logged!';
        badgeText = `📋 Month ${info.paymentNumber} of ${info.totalPayments}`;
        thankYouMessage = `Thanks ${displayName}! 🙏 Your payment of $${actualAmount.toLocaleString()} (Month ${info.paymentNumber} of ${info.totalPayments} in your Rent-to-Own agreement) has been received. Your remaining balance is now $${info.remainingBalance.toLocaleString()}. Your next payment of $${info.nextExpectedAmount.toLocaleString()} is due on ${info.nextDueDate}. Let me know if you have any questions!`;
    }
    
    // Show variance if different from expected
    const varianceHtml = actualAmount !== expectedAmount ? `
        <div class="text-xs mt-1 ${actualAmount > expectedAmount ? 'text-green-400' : 'text-amber-400'}">
            ${actualAmount > expectedAmount ? '↑' : '↓'} ${actualAmount > expectedAmount ? 'Overpaid' : 'Underpaid'} by $${Math.abs(actualAmount - expectedAmount).toLocaleString()} (Expected: $${expectedAmount.toLocaleString()})
        </div>
    ` : '';
    
    const modalHTML = `
        <div id="paymentConfirmModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-900 rounded-2xl max-w-lg w-full p-6 border border-green-500/30 shadow-2xl relative">
                <!-- X Close Button -->
                <button onclick="closePaymentConfirmModal()" class="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                
                <div class="text-center mb-4">
                    <div class="text-5xl mb-3">✅</div>
                    <h3 class="text-2xl font-bold text-green-400">${headerText}</h3>
                    <p class="text-gray-400 mt-1">$${actualAmount.toLocaleString()} from ${renterName}</p>
                    ${varianceHtml}
                    <p class="text-amber-400 text-sm mt-2">${badgeText}</p>
                </div>
                
                <div class="bg-gray-800 rounded-xl p-4 mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm text-gray-400 font-medium">📋 Copy this message to send to ${displayName}:</span>
                    </div>
                    <div id="thankYouMessageText" class="bg-gray-700/50 rounded-lg p-3 text-white text-sm leading-relaxed border border-gray-600">
                        ${thankYouMessage}
                    </div>
                </div>
                
                <div class="flex gap-3">
                    <button onclick="copyThankYouMessage()" class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2">
                        <span>📋</span> Copy Message
                    </button>
                    <button onclick="closePaymentConfirmModal()" class="flex-1 bg-gray-700 text-white py-3 px-4 rounded-xl font-bold hover:bg-gray-600 transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modal
    const existing = document.getElementById('paymentConfirmModal');
    if (existing) existing.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Store message for copy function
    window.currentThankYouMessage = thankYouMessage;
};

/**
 * Show RTO Completion prompt when contract is fully paid
 */
window.showRTOCompletionPrompt = function(propertyId, rtoContractId, buyerName, propertyTitle) {
    const modalHTML = `
        <div id="rtoCompletionModal" class="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
            <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-lg w-full border-2 border-amber-500 shadow-2xl shadow-amber-500/20 overflow-hidden relative">
                <!-- Confetti effect -->
                <div class="absolute inset-0 overflow-hidden pointer-events-none">
                    <div class="absolute top-0 left-1/4 w-2 h-2 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
                    <div class="absolute top-0 left-1/2 w-3 h-3 bg-pink-400 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
                    <div class="absolute top-0 left-3/4 w-2 h-2 bg-green-400 rounded-full animate-bounce" style="animation-delay: 0.3s;"></div>
                </div>
                
                <!-- X Close Button -->
                <button onclick="closeRTOCompletionModal()" class="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                
                <div class="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-6 py-6 text-center">
                    <div class="text-5xl mb-2">🎉🏆🎉</div>
                    <h3 class="text-2xl font-black text-gray-900">RTO CONTRACT COMPLETE!</h3>
                    <p class="text-gray-800 font-medium mt-1">${propertyTitle}</p>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="bg-green-900/30 border border-green-500/50 rounded-xl p-4 text-center">
                        <div class="text-green-400 font-bold text-lg">✅ All Payments Received!</div>
                        <p class="text-gray-300 text-sm mt-2">
                            Congratulations! <span class="text-white font-bold">${buyerName}</span> has completed all payments 
                            for this Rent-to-Own agreement.
                        </p>
                    </div>
                    
                    <div class="text-gray-300 text-sm">
                        <p class="mb-3">Would you like to finalize this as a house sale? This will:</p>
                        <ul class="space-y-2 text-sm">
                            <li class="flex items-start gap-2">
                                <span class="text-amber-400">•</span>
                                <span>Mark the property as <span class="text-rose-400 font-bold">SOLD</span></span>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="text-amber-400">•</span>
                                <span>Add to your House Sales records</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="text-amber-400">•</span>
                                <span>Award you <span class="text-green-400 font-bold">+1000 XP</span> 🎮</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="text-amber-400">•</span>
                                <span>Display a celebration banner for 24 hours 🎊</span>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                    <button onclick="closeRTOCompletionModal()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Later
                    </button>
                    <button onclick="finalizeRTOSale(${propertyId}, '${rtoContractId}')" class="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 py-3 rounded-xl font-black hover:opacity-90 transition flex items-center justify-center gap-2">
                        <span>🏆</span> Finalize Sale
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closeRTOCompletionModal = function() {
    const modal = document.getElementById('rtoCompletionModal');
    if (modal) modal.remove();
};

/**
 * Finalize RTO as a house sale
 */
window.finalizeRTOSale = function(propertyId, rtoContractId) {
    closeRTOCompletionModal();
    // Open the log sale modal pre-filled for RTO completion
    showLogSaleModal(propertyId, rtoContractId);
};

// ==================== RTO PAYMENT HISTORY ====================

/**
 * Show RTO Payment History modal with edit/delete capabilities
 */
window.showRTOPaymentHistory = async function(propertyId) {
    const p = properties.find(prop => prop.id === propertyId);
    const rtoContractId = PropertyDataService.getValue(propertyId, 'rtoContractId', p?.rtoContractId || '');
    
    if (!rtoContractId) {
        showToast('No active RTO contract found', 'error');
        return;
    }
    
    try {
        showToast('📜 Loading payment history...', 'info');
        
        const contractDoc = await db.collection('rentToOwnContracts').doc(rtoContractId).get();
        if (!contractDoc.exists) {
            showToast('Contract not found', 'error');
            return;
        }
        
        const contract = contractDoc.data();
        const history = contract.rtoPaymentHistory || [];
        const depositPaid = contract.depositPaid;
        const depositAmount = contract.depositAmount;
        const depositPaidDate = contract.depositPaidDate;
        
        // Build payment rows
        let historyRows = '';
        
        // Add deposit row if applicable
        if (depositAmount > 0) {
            historyRows += `
                <tr class="border-b border-gray-700">
                    <td class="py-3 px-4 text-gray-400">Deposit</td>
                    <td class="py-3 px-4 text-white">$${depositAmount.toLocaleString()}</td>
                    <td class="py-3 px-4 text-white">$${depositAmount.toLocaleString()}</td>
                    <td class="py-3 px-4 text-gray-400">${depositPaidDate || 'N/A'}</td>
                    <td class="py-3 px-4">
                        ${depositPaid ? '<span class="text-green-400">✓ Paid</span>' : '<span class="text-amber-400">Pending</span>'}
                    </td>
                    <td class="py-3 px-4 text-right">
                        ${depositPaid ? `
                            <button onclick="editRTODeposit(${propertyId}, '${rtoContractId}')" class="text-blue-400 hover:text-blue-300 text-sm mr-2">Edit</button>
                            <button onclick="deleteRTODeposit(${propertyId}, '${rtoContractId}')" class="text-red-400 hover:text-red-300 text-sm">Delete</button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }
        
        // Add monthly payment rows
        history.forEach((payment, index) => {
            const variance = payment.actual - payment.expected;
            const varianceClass = variance > 0 ? 'text-green-400' : variance < 0 ? 'text-red-400' : 'text-gray-400';
            const varianceText = variance !== 0 ? ` (${variance > 0 ? '+' : ''}$${variance.toLocaleString()})` : '';
            
            historyRows += `
                <tr class="border-b border-gray-700">
                    <td class="py-3 px-4 text-gray-400">Month ${payment.month}</td>
                    <td class="py-3 px-4 text-gray-400">$${payment.expected.toLocaleString()}</td>
                    <td class="py-3 px-4 text-white">$${payment.actual.toLocaleString()} <span class="${varianceClass} text-xs">${varianceText}</span></td>
                    <td class="py-3 px-4 text-gray-400">${payment.date}</td>
                    <td class="py-3 px-4 text-green-400">✓ Paid</td>
                    <td class="py-3 px-4 text-right">
                        <button onclick="editRTOPaymentEntry(${propertyId}, '${rtoContractId}', ${index})" class="text-blue-400 hover:text-blue-300 text-sm mr-2">Edit</button>
                        <button onclick="deleteRTOPaymentEntry(${propertyId}, '${rtoContractId}', ${index})" class="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        if (historyRows === '') {
            historyRows = '<tr><td colspan="6" class="py-8 text-center text-gray-500">No payments recorded yet</td></tr>';
        }
        
        const modalHTML = `
            <div id="rtoHistoryModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div class="bg-gray-900 rounded-2xl max-w-4xl w-full border border-cyan-500/50 shadow-2xl overflow-hidden relative">
                    <!-- X Close Button -->
                    <button onclick="document.getElementById('rtoHistoryModal').remove()" class="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    
                    <div class="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
                        <h3 class="text-xl font-bold text-white flex items-center gap-3">
                            <span>📜</span>
                            RTO Payment History
                        </h3>
                        <p class="text-cyan-100 text-sm mt-1">${contract.propertyTitle}</p>
                    </div>
                    
                    <div class="p-6 max-h-[60vh] overflow-y-auto">
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="text-gray-400 text-sm">Remaining Balance</div>
                                <div class="text-2xl font-bold text-white">$${(contract.remainingBalance || 0).toLocaleString()}</div>
                            </div>
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="text-gray-400 text-sm">Next Expected Payment</div>
                                <div class="text-2xl font-bold text-green-400">$${(contract.expectedMonthlyPayment || 0).toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-gray-600 text-left">
                                    <th class="py-3 px-4 text-gray-400 font-medium">Payment</th>
                                    <th class="py-3 px-4 text-gray-400 font-medium">Expected</th>
                                    <th class="py-3 px-4 text-gray-400 font-medium">Actual</th>
                                    <th class="py-3 px-4 text-gray-400 font-medium">Date</th>
                                    <th class="py-3 px-4 text-gray-400 font-medium">Status</th>
                                    <th class="py-3 px-4 text-gray-400 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${historyRows}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="px-6 py-4 bg-gray-800/50">
                        <button onclick="document.getElementById('rtoHistoryModal').remove()" class="w-full bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Error loading payment history:', error);
        showToast('Failed to load payment history: ' + error.message, 'error');
    }
};

/**
 * Edit a monthly payment entry
 */
window.editRTOPaymentEntry = async function(propertyId, contractId, paymentIndex) {
    try {
        const contractDoc = await db.collection('rentToOwnContracts').doc(contractId).get();
        if (!contractDoc.exists) {
            showToast('Contract not found', 'error');
            return;
        }
        
        const contract = contractDoc.data();
        const payment = contract.rtoPaymentHistory[paymentIndex];
        
        if (!payment) {
            showToast('Payment not found', 'error');
            return;
        }
        
        const modalHTML = `
            <div id="editPaymentModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div class="bg-gray-900 rounded-2xl max-w-md w-full border border-blue-500/50 shadow-2xl overflow-hidden relative">
                    <!-- X Close Button -->
                    <button onclick="document.getElementById('editPaymentModal').remove()" class="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    
                    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <h3 class="text-xl font-bold text-white">Edit Payment - Month ${payment.month}</h3>
                    </div>
                    
                    <div class="p-6 space-y-4">
                        <div>
                            <label class="block text-gray-400 text-sm mb-2">Amount:</label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input type="number" id="editPaymentAmount" value="${payment.actual}" 
                                    class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 pl-8 text-white focus:border-blue-500 focus:outline-none">
                            </div>
                        </div>
                        <div>
                            <label class="block text-gray-400 text-sm mb-2">Date:</label>
                            <input type="date" id="editPaymentDate" value="${payment.date}"
                                class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:outline-none">
                        </div>
                    </div>
                    
                    <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                        <button onclick="document.getElementById('editPaymentModal').remove()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                            Cancel
                        </button>
                        <button onclick="saveRTOPaymentEdit(${propertyId}, '${contractId}', ${paymentIndex})" class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Error loading payment for edit:', error);
        showToast('Failed to load payment: ' + error.message, 'error');
    }
};

/**
 * Save edited payment
 */
window.saveRTOPaymentEdit = async function(propertyId, contractId, paymentIndex) {
    const amountInput = document.getElementById('editPaymentAmount');
    const dateInput = document.getElementById('editPaymentDate');
    
    if (!amountInput || !dateInput) return;
    
    const newAmount = parseInt(amountInput.value) || 0;
    const newDate = dateInput.value;
    
    if (newAmount <= 0 || !newDate) {
        showToast('Please enter valid amount and date', 'error');
        return;
    }
    
    try {
        showToast('💾 Saving changes...', 'info');
        
        // Get contract
        const contractDoc = await db.collection('rentToOwnContracts').doc(contractId).get();
        const contract = contractDoc.data();
        const history = contract.rtoPaymentHistory || [];
        const oldPayment = history[paymentIndex];
        
        // Calculate difference
        const amountDiff = newAmount - oldPayment.actual;
        
        // Update payment in history
        history[paymentIndex] = {
            ...oldPayment,
            actual: newAmount,
            date: newDate
        };
        
        // Recalculate remaining balance
        const newRemainingBalance = contract.remainingBalance - amountDiff;
        
        // Recalculate expected monthly for next payment
        const currentPaymentNumber = contract.currentPaymentNumber;
        const remainingMonths = (contract.totalPayments - 1) - currentPaymentNumber;
        const amountForMonthly = newRemainingBalance - contract.finalPaymentBase;
        const newExpectedMonthly = remainingMonths > 0 ? Math.round(amountForMonthly / remainingMonths) : 0;
        
        // Update remaining balance after for this payment
        history[paymentIndex].remainingBalanceAfter = newRemainingBalance;
        
        // Update contract
        await db.collection('rentToOwnContracts').doc(contractId).update({
            rtoPaymentHistory: history,
            remainingBalance: newRemainingBalance,
            expectedMonthlyPayment: newExpectedMonthly,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update property
        await PropertyDataService.writeMultiple(propertyId, {
            rtoRemainingBalance: newRemainingBalance,
            rtoExpectedMonthly: newExpectedMonthly,
            monthlyPrice: newExpectedMonthly
        });
        
        // Close modals
        document.getElementById('editPaymentModal')?.remove();
        document.getElementById('rtoHistoryModal')?.remove();
        
        showToast('✅ Payment updated successfully!', 'success');
        
        // Refresh
        setTimeout(() => {
            showRTOPaymentHistory(propertyId);
            if (typeof renderPropertyStatsContent === 'function') {
                renderPropertyStatsContent(propertyId);
            }
        }, 300);
        
    } catch (error) {
        console.error('Error saving payment edit:', error);
        showToast('Failed to save: ' + error.message, 'error');
    }
};

/**
 * Delete a monthly payment entry
 */
window.deleteRTOPaymentEntry = async function(propertyId, contractId, paymentIndex) {
    if (!confirm('Are you sure you want to delete this payment? This will recalculate the remaining balance.')) {
        return;
    }
    
    try {
        showToast('🗑️ Deleting payment...', 'info');
        
        // Get contract
        const contractDoc = await db.collection('rentToOwnContracts').doc(contractId).get();
        const contract = contractDoc.data();
        const history = contract.rtoPaymentHistory || [];
        const deletedPayment = history[paymentIndex];
        
        // Remove payment from history
        history.splice(paymentIndex, 1);
        
        // Recalculate remaining balance (add back the deleted payment)
        const newRemainingBalance = contract.remainingBalance + deletedPayment.actual;
        
        // Update payment counter
        const newPaymentNumber = contract.currentPaymentNumber - 1;
        
        // Recalculate expected monthly
        const remainingMonths = (contract.totalPayments - 1) - newPaymentNumber;
        const amountForMonthly = newRemainingBalance - contract.finalPaymentBase;
        const newExpectedMonthly = remainingMonths > 0 ? Math.round(amountForMonthly / remainingMonths) : 0;
        
        // Renumber remaining payments
        history.forEach((p, i) => {
            p.month = i + 1;
        });
        
        // Update contract
        await db.collection('rentToOwnContracts').doc(contractId).update({
            rtoPaymentHistory: history,
            currentPaymentNumber: newPaymentNumber,
            remainingBalance: newRemainingBalance,
            expectedMonthlyPayment: newExpectedMonthly,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update property
        await PropertyDataService.writeMultiple(propertyId, {
            rtoCurrentPayment: newPaymentNumber,
            rtoRemainingBalance: newRemainingBalance,
            rtoExpectedMonthly: newExpectedMonthly,
            monthlyPrice: newExpectedMonthly
        });
        
        // Close history modal
        document.getElementById('rtoHistoryModal')?.remove();
        
        showToast('✅ Payment deleted successfully!', 'success');
        
        // Refresh
        setTimeout(() => {
            showRTOPaymentHistory(propertyId);
            if (typeof renderPropertyStatsContent === 'function') {
                renderPropertyStatsContent(propertyId);
            }
        }, 300);
        
    } catch (error) {
        console.error('Error deleting payment:', error);
        showToast('Failed to delete: ' + error.message, 'error');
    }
};

/**
 * Edit deposit payment
 */
window.editRTODeposit = async function(propertyId, contractId) {
    try {
        const contractDoc = await db.collection('rentToOwnContracts').doc(contractId).get();
        if (!contractDoc.exists) {
            showToast('Contract not found', 'error');
            return;
        }
        
        const contract = contractDoc.data();
        
        const modalHTML = `
            <div id="editDepositModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div class="bg-gray-900 rounded-2xl max-w-md w-full border border-green-500/50 shadow-2xl overflow-hidden relative">
                    <!-- X Close Button -->
                    <button onclick="document.getElementById('editDepositModal').remove()" class="absolute top-3 right-3 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    
                    <div class="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                        <h3 class="text-xl font-bold text-white">Edit Deposit Payment</h3>
                    </div>
                    
                    <div class="p-6 space-y-4">
                        <div>
                            <label class="block text-gray-400 text-sm mb-2">Deposit Amount:</label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input type="number" id="editDepositAmount" value="${contract.depositAmount}" 
                                    class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 pl-8 text-white focus:border-green-500 focus:outline-none">
                            </div>
                        </div>
                        <div>
                            <label class="block text-gray-400 text-sm mb-2">Date Paid:</label>
                            <input type="date" id="editDepositDate" value="${contract.depositPaidDate || ''}"
                                class="w-full bg-gray-800 border border-gray-600 rounded-xl py-3 px-4 text-white focus:border-green-500 focus:outline-none">
                        </div>
                    </div>
                    
                    <div class="px-6 py-4 bg-gray-800/50 flex gap-3">
                        <button onclick="document.getElementById('editDepositModal').remove()" class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                            Cancel
                        </button>
                        <button onclick="saveRTODepositEdit(${propertyId}, '${contractId}')" class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Error loading deposit for edit:', error);
        showToast('Failed to load deposit: ' + error.message, 'error');
    }
};

/**
 * Save edited deposit
 */
window.saveRTODepositEdit = async function(propertyId, contractId) {
    const amountInput = document.getElementById('editDepositAmount');
    const dateInput = document.getElementById('editDepositDate');
    
    if (!amountInput || !dateInput) return;
    
    const newAmount = parseInt(amountInput.value) || 0;
    const newDate = dateInput.value;
    
    try {
        showToast('💾 Saving deposit changes...', 'info');
        
        // Update contract
        await db.collection('rentToOwnContracts').doc(contractId).update({
            depositAmount: newAmount,
            depositPaidDate: newDate,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update property
        await PropertyDataService.writeMultiple(propertyId, {
            rtoDepositAmount: newAmount,
            rtoDepositPaidDate: newDate
        });
        
        // Close modals
        document.getElementById('editDepositModal')?.remove();
        document.getElementById('rtoHistoryModal')?.remove();
        
        showToast('✅ Deposit updated successfully!', 'success');
        
        // Refresh
        setTimeout(() => {
            showRTOPaymentHistory(propertyId);
        }, 300);
        
    } catch (error) {
        console.error('Error saving deposit edit:', error);
        showToast('Failed to save: ' + error.message, 'error');
    }
};

/**
 * Delete deposit payment (reset to unpaid)
 */
window.deleteRTODeposit = async function(propertyId, contractId) {
    if (!confirm('Are you sure you want to delete this deposit payment? It will be marked as unpaid.')) {
        return;
    }
    
    try {
        showToast('🗑️ Deleting deposit...', 'info');
        
        // Update contract
        await db.collection('rentToOwnContracts').doc(contractId).update({
            depositPaid: false,
            depositPaidDate: null,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update property
        await PropertyDataService.writeMultiple(propertyId, {
            rtoDepositPaid: false,
            rtoDepositPaidDate: ''
        });
        
        // Close history modal
        document.getElementById('rtoHistoryModal')?.remove();
        
        showToast('✅ Deposit deleted - now marked as unpaid', 'success');
        
        // Refresh
        setTimeout(() => {
            showRTOPaymentHistory(propertyId);
            if (typeof renderPropertyStatsContent === 'function') {
                renderPropertyStatsContent(propertyId);
            }
        }, 300);
        
    } catch (error) {
        console.error('Error deleting deposit:', error);
        showToast('Failed to delete: ' + error.message, 'error');
    }
};

// Start the app
init();
