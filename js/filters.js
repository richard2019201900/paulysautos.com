/**
 * PROPERTY FILTERS - Button-Based Filter System
 * Dual-filter: Interior (Walk-in/Instance) + Type (Houses/Apartments/etc)
 */

// Filter state
window.activeInteriorFilter = null;
window.activeTypeFilter = null;

/**
 * Get property value from Firestore-synced data
 */
function getPropertyValue(property, field) {
    return PropertyDataService.getValue(property.id, field, property[field]);
}

/**
 * Browse properties - scroll to listings
 */
window.browseProperties = function() {
    activeInteriorFilter = null;
    activeTypeFilter = null;
    updateFilterButtonStates();
    applyAllFilters();
    
    var propertiesSection = $('properties');
    if (propertiesSection) {
        propertiesSection.scrollIntoView({ behavior: 'smooth' });
    }
};

/**
 * List property - open create listing modal
 */
window.listYourProperty = function() {
    if (typeof openCreateListingModal === 'function') {
        openCreateListingModal();
    } else if (!auth.currentUser && typeof openAuthModal === 'function') {
        openAuthModal();
    }
};

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
 * Filter by property type
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
    var filtered = properties.slice();
    
    // Interior filter
    if (activeInteriorFilter) {
        filtered = filtered.filter(function(p) {
            return getPropertyValue(p, 'interiorType') === activeInteriorFilter;
        });
    }
    
    // Type filter
    if (activeTypeFilter) {
        filtered = filtered.filter(function(p) {
            return getPropertyValue(p, 'type') === activeTypeFilter;
        });
    }
    
    // My Properties
    var showMyProperties = $('showMyProperties');
    if (showMyProperties && showMyProperties.checked && auth.currentUser) {
        var userEmail = auth.currentUser.email.toLowerCase();
        filtered = filtered.filter(function(p) {
            var ownerEmail = getPropertyValue(p, 'ownerEmail') || propertyOwnerEmail[p.id];
            return ownerEmail && ownerEmail.toLowerCase() === userEmail;
        });
    }
    
    // Hide Unavailable
    var hideUnavailable = $('hideUnavailable');
    if (hideUnavailable && hideUnavailable.checked) {
        filtered = filtered.filter(function(p) {
            var availability = state.availability[p.id];
            if (availability !== undefined) {
                return availability !== false;
            }
            return getPropertyValue(p, 'availability') !== false;
        });
    }
    
    state.filteredProperties = filtered;
    renderProperties(state.filteredProperties);
};

/**
 * Toggle checkboxes
 */
window.toggleHideUnavailable = function() {
    applyAllFilters();
};

window.toggleMyProperties = function() {
    applyAllFilters();
};

/**
 * Sort properties
 */
window.sortProperties = function() {
    var sortBy = $('sortBy');
    if (!sortBy || !sortBy.value) return;
    
    var sortValue = sortBy.value;
    
    state.filteredProperties.sort(function(a, b) {
        if (sortValue === 'price-low') {
            return (getPropertyValue(a, 'weeklyPrice') || 0) - (getPropertyValue(b, 'weeklyPrice') || 0);
        } else if (sortValue === 'price-high') {
            return (getPropertyValue(b, 'weeklyPrice') || 0) - (getPropertyValue(a, 'weeklyPrice') || 0);
        } else if (sortValue === 'bedrooms') {
            return (getPropertyValue(b, 'bedrooms') || 0) - (getPropertyValue(a, 'bedrooms') || 0);
        } else if (sortValue === 'interior') {
            return (getPropertyValue(a, 'interiorType') || '').localeCompare(getPropertyValue(b, 'interiorType') || '');
        } else if (sortValue === 'storage') {
            return (getPropertyValue(b, 'storage') || 0) - (getPropertyValue(a, 'storage') || 0);
        }
        return 0;
    });
    
    renderProperties(state.filteredProperties);
};

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
    
    var showMyProperties = $('showMyProperties');
    if (showMyProperties) showMyProperties.checked = false;
    
    updateFilterButtonStates();
    applyAllFilters();
};

console.log('[Filters] Button-based filter system loaded');
