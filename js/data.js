// ==================== VEHICLE DATA ====================
// PaulysAutos.com - Elite Luxury Vehicle Marketplace ($1M+)

// Empty vehicles array - all data comes from Firestore
const vehicles = [];

// ==================== OWNER VEHICLE ASSIGNMENTS ====================
// Maps owner emails to their vehicle IDs (populated from Firestore)
const ownerVehicleMap = {
    'richard2019201900@gmail.com': [] // Master admin
};

// Create reverse map: vehicleId -> ownerEmail
const vehicleOwnerEmail = {};

Object.keys(ownerVehicleMap).forEach(email => {
    ownerVehicleMap[email].forEach(vehicleId => {
        vehicleOwnerEmail[vehicleId] = email;
    });
});

// Cache for owner usernames (global for access from other modules)
window.ownerUsernameCache = window.ownerUsernameCache || {};

// Get owner email for a vehicle
function getVehicleOwnerEmail(vehicleId) {
    const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
    
    // FIRST check the vehicle object itself (most authoritative source from Firestore)
    const vehicle = vehicles.find(v => v.id === numericId);
    if (vehicle && vehicle.ownerEmail) {
        const email = vehicle.ownerEmail.toLowerCase();
        vehicleOwnerEmail[numericId] = email;
        return email;
    }
    
    // Then check the direct vehicle->email mapping
    if (vehicleOwnerEmail[numericId]) {
        return vehicleOwnerEmail[numericId];
    }
    
    // Also check ownerVehicleMap (reverse lookup)
    for (const email in ownerVehicleMap) {
        if (ownerVehicleMap[email] && ownerVehicleMap[email].includes(numericId)) {
            vehicleOwnerEmail[numericId] = email.toLowerCase();
            return email.toLowerCase();
        }
    }
    
    return null;
}

// Alias for backwards compatibility
const getPropertyOwnerEmail = getVehicleOwnerEmail;

// Fetch username by email from Firestore
async function getUsernameByEmail(email) {
    if (!email) return 'Unassigned';
    
    const normalizedEmail = email.toLowerCase();
    
    // Check cache first
    if (window.ownerUsernameCache[normalizedEmail]) {
        return window.ownerUsernameCache[normalizedEmail];
    }

    try {
        const querySnapshot = await db.collection('users').where('email', '==', normalizedEmail).get();
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            // NEVER use username - prefer displayName, then firstName+lastName, then email prefix
            let displayName;
            if (userData.displayName) {
                displayName = userData.displayName;
            } else if (userData.firstName && userData.lastName) {
                displayName = userData.firstName + ' ' + userData.lastName;
            } else if (userData.firstName) {
                displayName = userData.firstName;
            } else {
                // Final fallback - email prefix, NEVER username
                displayName = email.split('@')[0];
            }
            window.ownerUsernameCache[normalizedEmail] = displayName;
            return displayName;
        }
    } catch (error) {
        // Permission denied - try getting from vehicle data
        if (error.code === 'permission-denied') {
            // Check if we have ownerDisplayName stored on any vehicle in Firestore settings
            try {
                const vehiclesDoc = await db.collection('settings').doc('properties').get();
                if (vehiclesDoc.exists) {
                    const vehiclesData = vehiclesDoc.data();
                    for (const vehicleId in vehiclesData) {
                        const vehicle = vehiclesData[vehicleId];
                        if (vehicle.ownerEmail && vehicle.ownerEmail.toLowerCase() === normalizedEmail) {
                            if (vehicle.ownerDisplayName) {
                                window.ownerUsernameCache[normalizedEmail] = vehicle.ownerDisplayName;
                                return vehicle.ownerDisplayName;
                            }
                        }
                    }
                }
            } catch (e) {
                // Can't read settings either, fall through to other fallbacks
            }
            
            // Check local OwnershipService for ownerDisplayName
            const userVehicles = typeof OwnershipService !== 'undefined' 
                ? OwnershipService.getVehiclesForOwner(normalizedEmail)
                : [];
            
            // Look for ownerDisplayName on any of their vehicles
            for (const vehicle of userVehicles) {
                if (vehicle.ownerDisplayName) {
                    window.ownerUsernameCache[normalizedEmail] = vehicle.ownerDisplayName;
                    return vehicle.ownerDisplayName;
                }
            }
            
            // Check if master admin
            if (typeof TierService !== 'undefined' && TierService.isMasterAdmin(normalizedEmail)) {
                const fallback = 'Pauly Amato';
                window.ownerUsernameCache[normalizedEmail] = fallback;
                return fallback;
            }
            
            // Final fallback to email prefix
            const fallback = email.split('@')[0];
            window.ownerUsernameCache[normalizedEmail] = fallback;
            return fallback;
        }
        console.error('Error fetching username:', error);
    }
    
    return 'Unassigned';
}

// Get vehicle owner with tier info (for display)
async function getVehicleOwnerWithTier(vehicleId, options = {}) {
    const forceShowOwner = options.forceShowOwner || false;
    
    // Check if vehicle is managed by agent(s) - unless we need to show real owner
    if (!forceShowOwner) {
        const agents = getVehicleAgents(vehicleId);
        if (agents && agents.length > 0) {
            // Vehicle is managed by agent(s) - anonymize owner
            if (agents.length === 1) {
                const agentEmail = agents[0];
                let agentName = 'Agent';
                
                // Try to get agent display name from vehicle data
                const agentDisplayNames = VehicleDataService.getValue(vehicleId, 'agentDisplayNames', null);
                if (agentDisplayNames && agentDisplayNames[agentEmail.toLowerCase()]) {
                    agentName = agentDisplayNames[agentEmail.toLowerCase()];
                }
                else if (typeof agentsCache !== 'undefined' && agentsCache.length > 0) {
                    const agent = agentsCache.find(a => a.email.toLowerCase() === agentEmail.toLowerCase());
                    if (agent) {
                        agentName = agent.username;
                    }
                } 
                else if (typeof loadAgents === 'function' && auth?.currentUser) {
                    try {
                        const loadedAgents = await loadAgents();
                        const agent = loadedAgents.find(a => a.email.toLowerCase() === agentEmail.toLowerCase());
                        if (agent) {
                            agentName = agent.username;
                        }
                    } catch (e) {
                        // Silent fail for anonymous users
                    }
                }
                
                // Special case: master admin always shows "Pauly Amato"
                if (agentEmail.toLowerCase() === 'richard2019201900@gmail.com') {
                    agentName = 'Pauly Amato';
                }
                
                return {
                    username: agentName,
                    tier: 'agent',
                    tierData: { icon: '🏢', name: 'Agent' },
                    display: `🏢 Managed by: ${agentName}`,
                    isManaged: true,
                    agentCount: 1
                };
            } else {
                return {
                    username: `${agents.length} Agents`,
                    tier: 'agent',
                    tierData: { icon: '🏢', name: 'Agents' },
                    display: `🏢 Managed by: ${agents.length} Agents`,
                    isManaged: true,
                    agentCount: agents.length
                };
            }
        }
    }
    
    const email = getVehicleOwnerEmail(vehicleId);
    const username = await getUsernameByEmail(email);
    
    // Handle unassigned vehicles
    if (username === 'Unassigned' || !email) {
        return {
            username: 'Unassigned',
            tier: null,
            tierData: null,
            display: '🚫 Unassigned'
        };
    }
    
    // Get tier from user doc
    let tier = 'starter';
    try {
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            tier = userData.tier || 'starter';
            if (TierService.isMasterAdmin(email)) {
                return {
                    username,
                    tier: 'owner',
                    tierData: { icon: '👑', name: 'Owner' },
                    display: `👑 ${username}`
                };
            }
        }
    } catch (error) {
        if (error.code === 'permission-denied') {
            if (TierService.isMasterAdmin(email)) {
                return {
                    username,
                    tier: 'owner',
                    tierData: { icon: '👑', name: 'Owner' },
                    display: `👑 ${username}`
                };
            }
            tier = 'starter';
        } else {
            console.error('[getVehicleOwnerWithTier] Error:', error);
        }
    }
    
    const tierData = TIERS[tier] || TIERS.starter;
    return {
        username,
        tier,
        tierData,
        display: `${tierData.icon} ${username}`
    };
}

// Alias for backwards compatibility
const getPropertyOwnerWithTier = getVehicleOwnerWithTier;

// Helper function to get vehicle agents (will be defined in agent-management.js)
function getVehicleAgents(vehicleId) {
    if (typeof getPropertyAgents === 'function') {
        return getPropertyAgents(vehicleId);
    }
    return [];
}

// Preload usernames for all vehicle owners
async function preloadOwnerUsernames() {
    const uniqueEmails = [...new Set(Object.values(vehicleOwnerEmail))];
    await Promise.all(uniqueEmails.map(email => getUsernameByEmail(email)));
}

// Get vehicles for the current logged-in owner
function getOwnerVehicles() {
    const user = auth.currentUser;
    if (!user) return [];
    const email = user.email.toLowerCase();
    return vehicles.filter(v => v.ownerEmail && v.ownerEmail.toLowerCase() === email);
}

// Alias for backwards compatibility
const getOwnerProperties = getOwnerVehicles;

// Check if current owner owns a specific vehicle
function ownsVehicle(vehicleId) {
    const user = auth.currentUser;
    if (!user) return false;
    
    // Master owner can access all vehicles
    if (TierService.isMasterAdmin(user.email)) {
        return true;
    }
    
    const email = user.email.toLowerCase();
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle && vehicle.ownerEmail && vehicle.ownerEmail.toLowerCase() === email;
}

// Alias for backwards compatibility
const ownsProperty = ownsVehicle;

console.log('[Data] PaulysAutos vehicle data module loaded');
