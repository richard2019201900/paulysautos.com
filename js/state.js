// ==================== STATE ====================
let state = {
    filteredVehicles: [...vehicles],
    currentUser: null,
    currentVehicleId: null,
    currentImageIndex: 0,
    currentImages: [],
    availability: {},
    vehicleOverrides: {} // Stores custom vehicle values from Firestore
};

// Initialize availability defaults
vehicles.forEach(p => { state.availability[p.id] = true; });

// Make state accessible globally
window.state = state;
