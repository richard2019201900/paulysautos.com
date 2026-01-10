/**
 * VEHICLE FILTERS - Button-Based Filter System
 */

// Filter state
window.activeInteriorFilter = null;
window.activeTypeFilter = null;

/**
 * Get vehicle value from Firestore-synced data
 */
function getVehicleValue(vehicle, field) {
    return VehicleDataService.getValue(vehicle.id, field, vehicle[field]);
}

/**
 * Browse vehicles - scroll to listings
 */
window.browseVehicles = function() {
    activeInteriorFilter = null;
    activeTypeFilter = null;
    updateFilterButtonStates();
    applyAllFilters();
    
    var vehiclesSection = $('vehicles');
    if (vehiclesSection) {
        vehiclesSection.scrollIntoView({ behavior: 'smooth' });
    }
};

// Alias for legacy code
window.browseProperties = window.browseVehicles;

/**
 * List vehicle - open create listing modal
 */
window.listYourVehicle = function() {
    if (typeof openModal === 'function') {
        openModal('createListingModal');
    } else if (typeof openCreateListingModal === 'function') {
        openCreateListingModal();
    } else if (!auth.currentUser && typeof openAuthModal === 'function') {
        openAuthModal();
    }
};

// Alias for legacy code
window.listYourProperty = window.listYourVehicle;

/**
 * Update button visual states
 */
function updateFilterButtonStates() {
    // Interior buttons (cyan)
    document.querySelectorAll('.interior-filter-btn').forEach(function(btn) {
        var filterValue = btn.dataset.filter;
        var isActive = activeInteriorFilter === filterValue;
        
        if (isActive) {
            btn.classList.add('border-cyan-400', 'bg-cyan-500/20', 'text-cyan-300');
            btn.classList.remove('border-gray-600', 'bg-gray-700', 'text-gray-200');
        } else {
            btn.classList.remove('border-cyan-400', 'bg-cyan-500/20', 'text-cyan-300');
            btn.classList.add('border-gray-600', 'bg-gray-700', 'text-gray-200');
        }
    });
    
    // Type buttons (purple/gradient)
    document.querySelectorAll('.type-filter-btn').forEach(function(btn) {
        var filterValue = btn.dataset.filter;
        var isAll = filterValue === 'all';
        var isActive = isAll 
            ? (activeTypeFilter === null && activeInteriorFilter === null)
            : activeTypeFilter === filterValue;
        
        if (isActive) {
            btn.classList.add('active', 'gradient-bg', 'text-white');
            btn.classList.remove('bg-gray-700', 'text-gray-200');
        } else {
            btn.classList.remove('active', 'gradient-bg', 'text-white');
            btn.classList.add('bg-gray-700', 'text-gray-200');
        }
    });
}

/**
 * Filter by interior type (Walk-in/Instance)
 */
window.filterByInterior = function(interiorType, btn) {
    if (activeInteriorFilter === interiorType) {
        activeInteriorFilter = null;
    } else {
        activeInteriorFilter = interiorType;
    }
    updateFilterButtonStates();
    applyAllFilters();
};

/**
 * Filter by vehicle type
 */
window.filterByType = function(type, btn) {
    if (type === 'all') {
        activeInteriorFilter = null;
        activeTypeFilter = null;
    } else {
        if (activeTypeFilter === type) {
            activeTypeFilter = null;
        } else {
            activeTypeFilter = type;
        }
    }
    updateFilterButtonStates();
    applyAllFilters();
};

// Legacy compatibility
window.filterProperties = function(type, btn) {
    filterByType(type, btn);
};

/**
 * Apply all active filters
 */
window.applyAllFilters = function() {
    // Debug: log current state
    console.log('[Filters] Applying filters, vehicles count:', vehicles.length, 'activeTypeFilter:', activeTypeFilter);
    
    var filtered = vehicles.slice();
    
    // Interior filter
    if (activeInteriorFilter) {
        filtered = filtered.filter(function(p) {
            return getVehicleValue(p, 'interiorType') === activeInteriorFilter;
        });
    }
    
    // Type filter (case-insensitive)
    if (activeTypeFilter) {
        filtered = filtered.filter(function(p) {
            var pType = (getVehicleValue(p, 'type') || '').toLowerCase();
            return pType === activeTypeFilter.toLowerCase();
        });
        console.log('[Filters] After type filter:', filtered.length);
    }
    
    // My Vehicles
    var showMyVehicles = $('showMyVehicles');
    if (showMyVehicles && showMyVehicles.checked && auth.currentUser) {
        var userEmail = auth.currentUser.email.toLowerCase();
        filtered = filtered.filter(function(p) {
            var ownerEmail = getVehicleValue(p, 'ownerEmail') || vehicleOwnerEmail[p.id];
            return ownerEmail && ownerEmail.toLowerCase() === userEmail;
        });
    }
    
    // Hide Unavailable/Sold
    var hideUnavailable = $('hideUnavailable');
    if (hideUnavailable && hideUnavailable.checked) {
        filtered = filtered.filter(function(p) {
            var availability = state.availability[p.id];
            if (availability !== undefined) {
                return availability !== false;
            }
            return getVehicleValue(p, 'availability') !== false;
        });
        console.log('[Filters] After hide sold filter:', filtered.length);
    }
    
    state.filteredVehicles = filtered;
    console.log('[Filters] Final filtered count:', filtered.length);
    renderVehicles(state.filteredVehicles);
};

/**
 * Toggle checkboxes
 */
window.toggleHideUnavailable = function() {
    applyAllFilters();
};

window.toggleMyVehicles = function() {
    applyAllFilters();
};

/**
 * Sort vehicles
 */
window.sortProperties = function() {
    var sortBy = $('sortBy');
    if (!sortBy || !sortBy.value) return;
    
    var sortValue = sortBy.value;
    
    state.filteredVehicles.sort(function(a, b) {
        if (sortValue === 'price-low') {
            return (getVehicleValue(a, 'buyPrice') || 0) - (getVehicleValue(b, 'buyPrice') || 0);
        } else if (sortValue === 'price-high') {
            return (getVehicleValue(b, 'buyPrice') || 0) - (getVehicleValue(a, 'buyPrice') || 0);
        } else if (sortValue === 'newest') {
            // Sort by createdAt timestamp, newest first
            var dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            var dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateB - dateA;
        }
        return 0;
    });
    
    renderVehicles(state.filteredVehicles);
};

// Alias for HTML compatibility
window.sortVehicles = window.sortProperties;

/**
 * Clear all filters
 */
window.clearFilters = function() {
    activeInteriorFilter = null;
    activeTypeFilter = null;
    
    var sortBy = $('sortBy');
    if (sortBy) sortBy.selectedIndex = 0;
    
    var hideUnavailable = $('hideUnavailable');
    if (hideUnavailable) hideUnavailable.checked = false;
    
    var showMyVehicles = $('showMyVehicles');
    if (showMyVehicles) showMyVehicles.checked = false;
    
    updateFilterButtonStates();
    applyAllFilters();
};

console.log('[Filters] Button-based filter system loaded');
