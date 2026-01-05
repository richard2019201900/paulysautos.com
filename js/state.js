// ==================== STATE ====================
let state = {
    filteredProperties: [...properties],
    currentUser: null,
    currentPropertyId: null,
    currentImageIndex: 0,
    currentImages: [],
    availability: {},
    propertyOverrides: {} // Stores custom property values from Firestore
};

// Initialize availability defaults
properties.forEach(p => { state.availability[p.id] = true; });

// Make state accessible globally
window.state = state;
