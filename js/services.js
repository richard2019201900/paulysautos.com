// ==================== TIER SYSTEM ====================
/**
 * User Tiers Configuration - PaulysAutos.com
 * - Starter (free): 1 listing
 * - Elite ($25k/month): Unlimited listings
 */
const TIERS = {
    starter: { 
        maxListings: 1, 
        icon: '🌱', 
        name: 'Starter',
        color: 'text-gray-400',
        bgColor: 'bg-gray-600',
        price: 0
    },
    elite: { 
        maxListings: Infinity, 
        icon: '👑', 
        name: 'Elite',
        color: 'text-amber-400',
        bgColor: 'bg-amber-600',
        price: 25000
    }
};

// Master admin email
// Master admin email - PaulysAutos.com owner
const MASTER_ADMIN_EMAIL = 'pauly@pma.network';

/**
 * OwnershipService - SINGLE SOURCE OF TRUTH for vehicle ownership
 * All ownership queries should go through this service to ensure consistency
 */
const OwnershipService = {
    /**
     * Get vehicles owned by a specific email
     * Priority:
     * 1. prop.ownerEmail field (Firestore data)
     * 2. vehicleOwnerEmail map (for static vehicles without ownerEmail)
     * @param {string} email - Owner email
     * @returns {Array} - Array of vehicle objects owned by this email
     */
    getVehiclesForOwner(email) {
        if (!email) return [];
        const normalizedEmail = email.toLowerCase();
        return vehicles.filter(p => {
            // Primary check: ownerEmail field on vehicle
            const propOwner = (p.ownerEmail || '').toLowerCase();
            if (propOwner) {
                return propOwner === normalizedEmail;
            }
            
            // Secondary check: vehicleOwnerEmail reverse map (for static vehicles)
            const mappedOwner = (vehicleOwnerEmail[p.id] || '').toLowerCase();
            return mappedOwner === normalizedEmail;
        });
    },
    
    /**
     * Count listings for an owner
     * @param {string} email - Owner email
     * @returns {number} - Number of vehicles owned
     */
    getListingCount(email) {
        return this.getVehiclesForOwner(email).length;
    },
    
    /**
     * Check if a user owns a specific vehicle
     * @param {string} email - User email
     * @param {number} vehicleId - Vehicle ID
     * @returns {boolean}
     */
    ownsProperty(email, vehicleId) {
        if (!email) return false;
        const normalizedEmail = email.toLowerCase();
        const prop = vehicles.find(p => p.id === vehicleId);
        if (!prop) return false;
        
        // Primary check: ownerEmail field
        const propOwner = (prop.ownerEmail || '').toLowerCase();
        if (propOwner) {
            return propOwner === normalizedEmail;
        }
        
        // Secondary check: vehicleOwnerEmail map
        const mappedOwner = (vehicleOwnerEmail[vehicleId] || '').toLowerCase();
        return mappedOwner === normalizedEmail;
    },
    
    /**
     * Rebuild ownerVehicleMap from vehicles array
     * This ensures the cached map stays in sync with actual vehicle data
     */
    rebuildOwnerPropertyMap() {
        // Clear existing entries for emails we've seen
        const emailsToClean = new Set(Object.keys(ownerVehicleMap));
        
        // Rebuild from vehicles
        vehicles.forEach(p => {
            if (p) {
                // Check ownerEmail first (Firestore data)
                let email = (p.ownerEmail || '').toLowerCase();
                
                // Fallback to vehicleOwnerEmail map (for static vehicles)
                if (!email && vehicleOwnerEmail[p.id]) {
                    email = vehicleOwnerEmail[p.id].toLowerCase();
                }
                
                if (email) {
                    if (!ownerVehicleMap[email]) {
                        ownerVehicleMap[email] = [];
                    }
                    if (!ownerVehicleMap[email].includes(p.id)) {
                        ownerVehicleMap[email].push(p.id);
                    }
                    emailsToClean.delete(email);
                    
                    // Update reverse map
                    vehicleOwnerEmail[p.id] = email;
                }
            }
        });
        
        // Clean up ownerVehicleMap entries for emails that no longer own anything
        // But preserve the admin email's static vehicles
        emailsToClean.forEach(email => {
            const adminEmail = 'richard2019201900@gmail.com';
            if (email !== adminEmail) {
                // Filter out vehicles this email doesn't actually own
                ownerVehicleMap[email] = (ownerVehicleMap[email] || []).filter(propId => {
                    const prop = vehicles.find(p => p.id === propId);
                    if (prop && prop.ownerEmail) {
                        return prop.ownerEmail.toLowerCase() === email;
                    }
                    // Keep if vehicleOwnerEmail says so
                    return vehicleOwnerEmail[propId]?.toLowerCase() === email;
                });
            }
        });
    }
};

// Make it globally available
window.OwnershipService = OwnershipService;

/**
 * TierService - Handles user tier operations
 */
const TierService = {
    /**
     * Get user's tier info
     * @param {string} email - User email
     * @returns {Promise<Object>} - Tier info {tier, tierData, listingCount}
     */
    async getUserTier(email) {
        if (!email) return { tier: 'starter', tierData: TIERS.starter, listingCount: 0 };
        
        try {
            const normalizedEmail = email.toLowerCase();
            const snapshot = await db.collection('users').where('email', '==', normalizedEmail).get();
            
            let tier = 'starter';
            if (!snapshot.empty) {
                const userData = snapshot.docs[0].data();
                tier = userData.tier || 'starter';
            }
            
            // Count user's listings from FRESH Firestore data (not cached map)
            // This ensures accurate count even after deletions
            let listingCount = 0;
            try {
                const propsDoc = await db.collection('settings').doc('vehicles').get();
                if (propsDoc.exists) {
                    const propsData = propsDoc.data();
                    listingCount = Object.values(propsData).filter(p => 
                        p && p.ownerEmail && p.ownerEmail.toLowerCase() === normalizedEmail
                    ).length;
                }
            } catch (e) {
                // Fallback to cached map if Firestore query fails
                listingCount = (ownerVehicleMap[normalizedEmail] || []).length;
                console.warn('[TierService] Using cached listing count:', listingCount);
            }
            
            return {
                tier,
                tierData: TIERS[tier] || TIERS.starter,
                listingCount
            };
        } catch (error) {
            console.error('[TierService] Error getting user tier:', error);
            return { tier: 'starter', tierData: TIERS.starter, listingCount: 0 };
        }
    },
    
    /**
     * Check if user can create more listings
     * @param {string} email - User email
     * @returns {Promise<{canCreate: boolean, reason: string, tierInfo: Object}>}
     */
    async canCreateListing(email) {
        const tierInfo = await this.getUserTier(email);
        const { tier, tierData, listingCount } = tierInfo;
        
        // Master admin always can create
        if (email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
            return { canCreate: true, reason: '', tierInfo };
        }
        
        if (listingCount >= tierData.maxListings) {
            return {
                canCreate: false,
                reason: `Your ${tierData.name} plan allows ${tierData.maxListings} listing${tierData.maxListings > 1 ? 's' : ''}. You currently have ${listingCount}.`,
                tierInfo
            };
        }
        
        return { canCreate: true, reason: '', tierInfo };
    },
    
    /**
     * Set user's tier (admin only) - tracks history
     * @param {string} userEmail - Target user email
     * @param {string} newTier - New tier: 'starter', 'pro', 'elite'
     * @param {string} previousTier - Previous tier for history
     * @param {string} paymentNote - Optional payment/note info
     */
    async setUserTier(userEmail, newTier, previousTier = null, paymentNote = '', isFreeTrial = false) {
        if (!TIERS[newTier]) {
            throw new Error('Invalid tier');
        }
        
        const normalizedEmail = userEmail.toLowerCase();
        const snapshot = await db.collection('users').where('email', '==', normalizedEmail).get();
        
        if (snapshot.empty) {
            throw new Error('User not found');
        }
        
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        const oldTier = previousTier || userData.tier || 'starter';
        
        // Update user tier
        await userDoc.ref.update({
            tier: newTier,
            tierUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            tierUpdatedBy: auth.currentUser?.email || 'system'
        });
        
        // Add to upgrade history
        await db.collection('upgradeHistory').add({
            userEmail: normalizedEmail,
            previousTier: oldTier,
            newTier: newTier,
            upgradedAt: firebase.firestore.FieldValue.serverTimestamp(),
            upgradedBy: auth.currentUser?.email || 'system',
            paymentNote: paymentNote,
            price: isFreeTrial ? 0 : (newTier === 'pro' ? 25000 : (newTier === 'elite' ? 50000 : 0)),
            isFreeTrial: isFreeTrial
        });
    },
    
    /**
     * Get all users with their tier info
     */
    async getAllUsers() {
        const snapshot = await db.collection('users').orderBy('email').get();
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email,
                username: data.username || data.email?.split('@')[0],
                displayName: data.displayName || data.username || data.email?.split('@')[0],
                phone: data.phone || '',  // Phone number for admin contact
                tier: data.tier || 'starter',
                tierUpdatedAt: data.tierUpdatedAt,
                tierUpdatedBy: data.tierUpdatedBy,
                createdAt: data.createdAt,
                // Activity tracking fields
                lastLogin: data.lastLogin,           // Firestore Timestamp
                lastLoginAt: data.lastLoginAt || '', // ISO string fallback
                lastPropertyPosted: data.lastPropertyPosted,    // Firestore Timestamp
                lastPropertyPostedAt: data.lastPropertyPostedAt || '', // ISO string fallback
                // Subscription fields
                subscriptionLastPaid: data.subscriptionLastPaid || '',
                subscriptionAmount: data.subscriptionAmount,  // Actual amount paid (for prorated upgrades)
                isProratedUpgrade: data.isProratedUpgrade === true,
                proratedFrom: data.proratedFrom || null,
                upgradeNotes: data.upgradeNotes || '',
                // Trial fields
                isFreeTrial: data.isFreeTrial === true,
                trialStartDate: data.trialStartDate || '',
                trialEndDate: data.trialEndDate || '',
                trialNotes: data.trialNotes || '',
                // Managed services interest
                managedServicesInterest: data.managedServicesInterest === true,
                managedServicesOptInDate: data.managedServicesOptInDate || null
            };
        });
    },
    
    /**
     * Get upgrade history
     */
    async getUpgradeHistory() {
        const snapshot = await db.collection('upgradeHistory')
            .orderBy('upgradedAt', 'desc')
            .limit(50)
            .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    
    /**
     * Submit upgrade request
     * @param {string} userEmail - Requesting user's email
     * @param {string} currentTier - Current tier
     * @param {string} requestedTier - Desired tier
     * @param {string} message - Optional message
     */
    async submitUpgradeRequest(userEmail, currentTier, requestedTier, message = '') {
        const request = {
            userEmail: userEmail.toLowerCase(),
            currentTier,
            requestedTier,
            message,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('upgradeRequests').add(request);
    },
    
    /**
     * Get pending upgrade requests (admin only)
     */
    async getPendingRequests() {
        const snapshot = await db.collection('upgradeRequests')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    
    /**
     * Approve upgrade request (admin only)
     */
    async approveRequest(requestId) {
        const requestDoc = await db.collection('upgradeRequests').doc(requestId).get();
        if (!requestDoc.exists) throw new Error('Request not found');
        
        const request = requestDoc.data();
        
        // Update user's tier
        await this.setUserTier(request.userEmail, request.requestedTier);
        
        // Update request status
        await db.collection('upgradeRequests').doc(requestId).update({
            status: 'approved',
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            processedBy: auth.currentUser?.email
        });
    },
    
    /**
     * Deny upgrade request (admin only)
     */
    async denyRequest(requestId, reason = '') {
        await db.collection('upgradeRequests').doc(requestId).update({
            status: 'denied',
            denyReason: reason,
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            processedBy: auth.currentUser?.email
        });
    },
    
    /**
     * Check if user is master admin
     */
    isMasterAdmin(email) {
        return email && email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
    },
    
    /**
     * Get tier display HTML
     * @param {string} tier - Tier name
     * @returns {string} - HTML with icon and badge
     */
    getTierBadge(tier) {
        const t = TIERS[tier] || TIERS.starter;
        return `<span class="inline-flex items-center gap-1 ${t.color}" title="${t.name} Member">${t.icon}</span>`;
    }
};

// Make available globally
window.TierService = TierService;
window.TIERS = TIERS;
window.MASTER_ADMIN_EMAIL = MASTER_ADMIN_EMAIL;

// ==================== VEHICLE DATA SERVICE ====================
/**
 * VehicleDataService - UNIFIED ARCHITECTURE for PaulysAutos.com
 * 
 * Single source of truth: settings/vehicles document
 * ALL vehicles stored in same document
 * 
 * Document structure:
 * settings/vehicles: {
 *   "1": { id: 1, make: "...", price: ..., ownerEmail: "", isPremium: false, ... },
 *   "2": { ... },
 * }
 */
const VehicleDataService = {
    collectionName: 'settings',
    docName: 'vehicles',  // Changed from 'vehicles' for PaulysAutos
    
    // Active listener for cleanup
    unsubscribeListener: null,
    
    /**
     * READ: Fetch fresh vehicle data from Firestore
     * @param {number} vehicleId - The vehicle ID to read
     * @returns {Promise<Object>} - Fresh vehicle data
     */
    async read(vehicleId) {
        const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
        
        try {
            const doc = await db.collection(this.collectionName).doc(this.docName).get();
            if (doc.exists) {
                const allData = doc.data();
                const vehicleData = allData[String(numericId)] || null;
                
                // Update local vehicles array if data exists
                if (vehicleData) {
                    const prop = vehicles.find(p => p.id === numericId);
                    if (prop) {
                        Object.assign(prop, vehicleData);
                    }
                }
                
                return { exists: vehicleData !== null, data: vehicleData };
            }
            return { exists: false, data: null };
        } catch (error) {
            console.error('[VehicleDataService] READ error:', error);
            throw error;
        }
    },
    
    /**
     * READ ALL: Fetch all vehicles
     * @returns {Promise<Object>} - All vehicle data
     */
    async readAll() {
        try {
            const doc = await db.collection(this.collectionName).doc(this.docName).get();
            if (doc.exists) {
                return doc.data();
            }
            return {};
        } catch (error) {
            console.error('[VehicleDataService] READ ALL error:', error);
            return {};
        }
    },
    
    /**
     * WRITE: Update vehicle data in Firestore
     * UNIFIED: All vehicles write to settings/vehicles
     * @param {number} vehicleId - The vehicle ID to update
     * @param {string} field - The field name to update
     * @param {any} value - The new value
     * @returns {Promise<boolean>} - Success status
     */
    async write(vehicleId, field, value) {
        const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
        const prop = vehicles.find(p => p.id === numericId);
        
        try {
            // UNIFIED: Always write to settings/vehicles (or settings/vehicles for PaulysAutos)
            const updateData = {
                [`${numericId}.${field}`]: value,
                [`${numericId}.updatedAt`]: firebase.firestore.FieldValue.serverTimestamp(),
                [`${numericId}.updatedBy`]: auth.currentUser?.email || 'unknown'
            };
            
            // Use set with merge to auto-create document if it doesn't exist
            await db.collection(this.collectionName).doc(this.docName).set(updateData, { merge: true });
            
            // Update local vehicle object immediately
            if (prop) {
                prop[field] = value;
            }
            
            console.log(`[VehicleDataService] Wrote ${field}=${value} for vehicle ${numericId}`);
            return true;
        } catch (error) {
            console.error('[VehicleDataService] WRITE error:', error);
            throw error;
        }
    },
    
    /**
     * WRITE MULTIPLE: Update multiple fields at once
     * @param {number} vehicleId - The vehicle ID to update
     * @param {Object} fields - Object with field:value pairs
     * @returns {Promise<boolean>} - Success status
     */
    async writeMultiple(vehicleId, fields) {
        const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
        const prop = vehicles.find(p => p.id === numericId);
        
        try {
            const updateData = {
                [`${numericId}.updatedAt`]: firebase.firestore.FieldValue.serverTimestamp(),
                [`${numericId}.updatedBy`]: auth.currentUser?.email || 'unknown'
            };
            
            Object.keys(fields).forEach(field => {
                updateData[`${numericId}.${field}`] = fields[field];
            });
            
            // Use set with merge to auto-create document if it doesn't exist
            await db.collection(this.collectionName).doc(this.docName).set(updateData, { merge: true });
            
            // Update local vehicle object
            if (prop) {
                Object.assign(prop, fields);
            }
            
            console.log(`[VehicleDataService] Wrote ${Object.keys(fields).length} fields for vehicle ${numericId}`);
            return true;
        } catch (error) {
            console.error('[VehicleDataService] WRITE MULTIPLE error:', error);
            throw error;
        }
    },
    
    /**
     * Subscribe to real-time updates for ALL vehicles
     * @param {Function} callback - Called when any data changes
     * @returns {Function} - Unsubscribe function
     */
    subscribeAll(callback) {
        if (this.unsubscribeListener) {
            this.unsubscribeListener();
        }
        
        this.unsubscribeListener = db.collection(this.collectionName).doc(this.docName)
            .onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    
                    // Update vehicles array from Firestore
                    Object.keys(data).forEach(propId => {
                        const numericId = parseInt(propId);
                        if (!isNaN(numericId) && data[propId] && data[propId].title) {
                            const existingIndex = vehicles.findIndex(p => p.id === numericId);
                            if (existingIndex !== -1) {
                                // Update existing vehicle
                                Object.assign(vehicles[existingIndex], data[propId]);
                            } else {
                                // Add new vehicle
                                const newProp = { ...data[propId], id: numericId };
                                vehicles.push(newProp);
                            }
                        }
                    });
                    
                    if (callback) callback(data);
                }
            }, error => {
                console.error('[VehicleDataService] SUBSCRIBE error:', error);
            });
        
        return this.unsubscribeListener;
    },
    
    /**
     * Get the effective value for a vehicle field
     * UNIFIED: Always reads from vehicles array (synced from Firestore)
     * @param {number} vehicleId - The vehicle ID
     * @param {string} field - The field name
     * @param {any} defaultValue - Default value if not found
     */
    getValue(vehicleId, field, defaultValue) {
        const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
        const prop = vehicles.find(p => p.id === numericId);
        
        // Single source: vehicles array (synced from Firestore)
        if (prop && prop[field] !== undefined && prop[field] !== null && prop[field] !== '') {
            return prop[field];
        }
        
        return defaultValue;
    },
    
    /**
     * Unsubscribe from listener
     */
    cleanup() {
        if (this.unsubscribeListener) {
            this.unsubscribeListener();
            this.unsubscribeListener = null;
        }
    }
};

// ==================== DATA ARCHITECTURE DIAGNOSTIC TOOLS ====================
/**
 * View current Firestore state (unified architecture)
 * Call from console: await viewFirestoreState()
 */
window.viewFirestoreState = async function() {
    console.log('========== FIRESTORE STATE (UNIFIED ARCHITECTURE) ==========');
    
    try {
        const [propsDoc, availDoc] = await Promise.all([
            db.collection('settings').doc('vehicles').get(),
            db.collection('settings').doc('vehicleAvailability').get()
        ]);
        
        console.log('\n📁 settings/vehicles (SINGLE SOURCE OF TRUTH):');
        if (propsDoc.exists) {
            const data = propsDoc.data();
            const propIds = Object.keys(data).filter(k => data[k]?.title).sort((a,b) => parseInt(a) - parseInt(b));
            console.log(`   Total vehicles: ${propIds.length}`);
            propIds.forEach(id => {
                const p = data[id];
                console.log(`   ${id}: ${p.title} | Owner: ${p.ownerEmail || 'master'} | Premium: ${p.isPremium || false}`);
            });
        } else {
            console.log('   (does not exist - run migration first!)');
        }
        
        console.log('\n📁 settings/vehicleAvailability:');
        if (availDoc.exists) {
            const data = availDoc.data();
            console.log(`   Entries: ${Object.keys(data).length}`);
            Object.keys(data).sort((a,b) => parseInt(a) - parseInt(b)).forEach(id => {
                console.log(`   ${id}: ${data[id] ? 'Available' : 'Sold'}`);
            });
        } else {
            console.log('   (does not exist)');
        }
        
        // Check for old vehicleOverrides (should be deleted after migration)
        const overridesDoc = await db.collection('settings').doc('vehicleOverrides').get();
        if (overridesDoc.exists) {
            console.log('\n⚠️  OLD DATA DETECTED: settings/vehicleOverrides still exists!');
            console.log('   Run migration.js deleteOldOverrides() to clean up.');
        } else {
            console.log('\n✅ Clean: No old vehicleOverrides document');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
};

/**
 * Show all data for a specific vehicle
 * Call from console: await showPropertyData(7)
 */
window.showPropertyData = async function(vehicleId) {
    const numericId = typeof vehicleId === 'string' ? parseInt(vehicleId) : vehicleId;
    
    console.log(`========== PROPERTY ${numericId} DATA ==========`);
    
    // Local data
    const prop = vehicles.find(p => p.id === numericId);
    console.log('\n📦 Local vehicles array:');
    console.log(prop ? JSON.stringify(prop, null, 2) : 'Not found');
    
    // Firestore data
    try {
        const doc = await db.collection('settings').doc('vehicles').get();
        if (doc.exists && doc.data()[numericId]) {
            console.log('\n☁️  Firestore settings/vehicles:');
            console.log(JSON.stringify(doc.data()[numericId], null, 2));
        } else {
            console.log('\n☁️  Firestore: Not found');
        }
    } catch (error) {
        console.error('Firestore error:', error);
    }
    
    // Availability
    console.log('\n📊 Availability:', state.availability[numericId] !== false ? 'Available' : 'Sold');
};

// ==================== FIRESTORE SYNC (UNIFIED ARCHITECTURE) ====================
/**
 * Set up real-time listeners for Firestore data
 * UNIFIED: Only two listeners needed:
 * 1. settings/vehicleAvailability - for availability status
 * 2. settings/vehicles - for ALL vehicle data (single source of truth)
 */
function setupRealtimeListener() {
    // Listener 1: Vehicle availability
    db.collection('settings').doc('vehicleAvailability')
        .onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                Object.keys(data).forEach(key => {
                    const numKey = parseInt(key);
                    if (!isNaN(numKey)) {
                        state.availability[numKey] = data[key];
                    }
                });
            }
            // Apply filters including hideUnavailable if checked
            if (typeof applyAllFilters === 'function') {
                applyAllFilters();
            } else {
                renderVehicles(state.filteredVehicles);
            }
            if (state.currentUser === 'owner') renderOwnerDashboard();
        }, error => {
            console.error('[Availability] Listener error:', error);
        });
    
    // Listener 2: ALL vehicle data (SINGLE SOURCE OF TRUTH)
    db.collection('settings').doc('vehicles')
        .onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                let hasChanges = false;
                
                // Clear and rebuild vehicles array from Firestore
                vehicles.length = 0;
                
                Object.keys(data).forEach(key => {
                    const vehicleId = parseInt(key);
                    const vehicleData = data[key];
                    
                    // Skip invalid entries - for vehicles we need 'make' not 'title'
                    if (!vehicleData || (!vehicleData.make && !vehicleData.title)) {
                        return;
                    }
                    
                    vehicleData.id = vehicleId;
                    
                    // Ensure images array exists
                    if (!vehicleData.images || !Array.isArray(vehicleData.images)) {
                        vehicleData.images = [];
                    }
                    
                    // For backwards compatibility, map 'make' to 'title' if needed
                    if (vehicleData.make && !vehicleData.title) {
                        vehicleData.title = vehicleData.make;
                    }
                    
                    vehicles.push(vehicleData);
                    state.availability[vehicleId] = vehicleData.availability !== false;
                    hasChanges = true;
                });
                
                // Rebuild ownership map
                OwnershipService.rebuildOwnerPropertyMap();
                
                if (hasChanges) {
                    state.filteredVehicles = [...vehicles];
                    // Apply filters including hideUnavailable if checked
                    if (typeof applyAllFilters === 'function') {
                        applyAllFilters();
                    } else {
                        renderVehicles(state.filteredVehicles);
                    }
                    if (state.currentUser === 'owner') renderOwnerDashboard();
                }
            }
        }, error => {
            console.error('Vehicles listener error:', error);
        });
}

window.saveAvailability = async function(id, isAvailable) {
    try {
        await db.collection('settings').doc('vehicleAvailability').set({ [id]: isAvailable }, { merge: true });
        console.log('[Availability] Saved to Firestore:', id, isAvailable);
        return true;
    } catch (error) {
        console.error('[Availability] Save error:', error);
        return false;
    }
}

window.toggleAvailability = async function(id) {
    const currentlySold = state.availability[id] === false;
    
    // If trying to mark as Available, check if buyer info or payment date exists
    if (currentlySold) {
        const buyerName = VehicleDataService.getValue(id, 'buyerName', '');
        const buyerPhone = VehicleDataService.getValue(id, 'buyerPhone', '');
        const lastPaymentDate = VehicleDataService.getValue(id, 'lastPaymentDate', '');
        
        if (buyerName || buyerPhone || lastPaymentDate) {
            let message = '⚠️ Cannot mark as Available\n\nThis vehicle has buyer/payment information set:\n';
            if (buyerName) message += `• Buyer Name: ${buyerName}\n`;
            if (buyerPhone) message += `• Buyer Phone: ${buyerPhone}\n`;
            if (lastPaymentDate) message += `• Last Payment Date: ${lastPaymentDate}\n`;
            message += '\nTo mark this vehicle as Available, first clear these fields by clicking on them and deleting the values.';
            
            alert(message);
            return;
        }
    }
    
    state.availability[id] = !state.availability[id];
    renderOwnerDashboard();
    renderVehicles(state.filteredVehicles);
    
    const success = await saveAvailability(id, state.availability[id]);
    if (!success) {
        const status = $('syncStatus');
        status.textContent = '!! Sync error - saved locally';
        status.className = 'text-yellow-400 mt-2 font-medium';
        setTimeout(() => {
            status.textContent = 'Real-time sync enabled';
            status.className = 'text-green-400 mt-2 font-medium';
        }, 3000);
    }
};

async function initFirestore() {
    try {
        const doc = await db.collection('settings').doc('vehicleAvailability').get();
        const data = doc.exists ? doc.data() : {};
        const updates = {};
        let needsUpdate = false;
        
        // IMPORTANT: Firestore returns string keys, so we must use String(p.id) to access
        vehicles.forEach(p => {
            const keyStr = String(p.id);
            const firestoreValue = data[keyStr];
            
            if (firestoreValue === undefined) {
                updates[p.id] = state.availability[p.id] !== false;
                needsUpdate = true;
            } else {
                state.availability[p.id] = firestoreValue;
            }
        });
        
        if (needsUpdate || !doc.exists) {
            await db.collection('settings').doc('vehicleAvailability').set(updates, { merge: true });
        }
        
        // Load user-created vehicles
        const propsDoc = await db.collection('settings').doc('vehicles').get();
        if (propsDoc.exists) {
            const propsData = propsDoc.data();
            Object.keys(propsData).forEach(key => {
                const propId = parseInt(key);
                const prop = propsData[key];
                
                // Skip invalid entries
                if (!prop || !prop.title || isNaN(propId)) {
                    return;
                }
                
                // Ensure prop has the correct numeric ID
                prop.id = propId;
                
                // Ensure images array exists
                if (!prop.images || !Array.isArray(prop.images)) {
                    prop.images = [];
                }
                
                // Check if this vehicle already exists in the array
                const existingIndex = vehicles.findIndex(p => p.id === propId);
                if (existingIndex === -1) {
                    // New vehicle - add to array
                    vehicles.push(prop);
                } else {
                    // Existing vehicle - update with Firestore data (single source of truth)
                    Object.assign(vehicles[existingIndex], prop);
                }
                
                // Set availability
                const propKeyStr = String(propId);
                if (data[propKeyStr] !== undefined) {
                    state.availability[propId] = data[propKeyStr];
                } else if (state.availability[propId] === undefined) {
                    state.availability[propId] = true;
                }
                
                // Set up owner mapping
                if (prop.ownerEmail) {
                    const email = prop.ownerEmail.toLowerCase();
                    if (!ownerVehicleMap[email]) {
                        ownerVehicleMap[email] = [];
                    }
                    if (!ownerVehicleMap[email].includes(propId)) {
                        ownerVehicleMap[email].push(propId);
                    }
                    vehicleOwnerEmail[propId] = email;
                }
            });
            
            // Update filtered vehicles
            state.filteredVehicles = [...vehicles];
        }
        
        // Rebuild ownerVehicleMap from vehicles array (single source of truth)
        OwnershipService.rebuildOwnerPropertyMap();
        
        // NOTE: vehicleOverrides loading removed - unified architecture uses settings/vehicles only
        // Old vehicleOverrides document should be deleted after migration
        
        // Sync all vehicle owner mappings to ensure consistency
        syncPropertyOwnerMappings();
        
        // Preload owner usernames in background for faster display
        preloadOwnerUsernames().catch(() => {});
    } catch (error) {
        console.error('Init error:', error);
    }
}

// Ensure all vehicle owner mappings are synchronized
function syncPropertyOwnerMappings() {
    // 1. First, sync from vehicle objects (highest priority - these come from Firestore)
    vehicles.forEach(prop => {
        if (prop.ownerEmail) {
            const lowerEmail = prop.ownerEmail.toLowerCase();
            vehicleOwnerEmail[prop.id] = lowerEmail;
            
            if (!ownerVehicleMap[lowerEmail]) {
                ownerVehicleMap[lowerEmail] = [];
            }
            if (!ownerVehicleMap[lowerEmail].includes(prop.id)) {
                ownerVehicleMap[lowerEmail].push(prop.id);
            }
        }
    });
    
    // 2. Then fill in any gaps from ownerVehicleMap
    Object.keys(ownerVehicleMap).forEach(email => {
        const lowerEmail = email.toLowerCase();
        (ownerVehicleMap[email] || []).forEach(propId => {
            if (!vehicleOwnerEmail[propId]) {
                vehicleOwnerEmail[propId] = lowerEmail;
            }
        });
    });
}

// ==================== REAL-TIME PROPERTY SYNC (ALL USERS) ====================
// This listener keeps the vehicles array in sync for ALL logged-in users (not just admin)
window.vehicleSyncUnsubscribe = null;

// Load vehicles for public/unauthenticated users (one-time fetch)
// Flag to prevent duplicate loads
window._publicVehiclesLoaded = false;

window.loadPublicVehicles = async function(forceReload = false) {
    // Prevent duplicate loads (unless forced or array is empty)
    if (!forceReload && window._publicVehiclesLoaded && vehicles.length > 0) {
        console.log('[Public] Vehicles already loaded, skipping');
        return;
    }
    
    try {
        console.log('[Public] Loading vehicles for public view...');
        const doc = await db.collection('settings').doc('vehicles').get();
        
        if (!doc.exists) {
            console.log('[Public] No vehicles document found');
            return;
        }
        
        const rawData = doc.data();
        let loadedCount = 0;
        
        // Clear array for fresh load
        vehicles.length = 0;
        
        // Reconstruct nested objects from flat keys (e.g., "1.title" -> { "1": { title: "..." } })
        const vehiclesData = {};
        Object.keys(rawData).forEach(key => {
            if (key.includes('.')) {
                // Flat key like "1.title" or "1.updatedBy"
                const parts = key.split('.');
                const vehicleId = parts[0];
                const field = parts.slice(1).join('.'); // Handle nested fields
                
                if (!vehiclesData[vehicleId]) {
                    vehiclesData[vehicleId] = {};
                }
                vehiclesData[vehicleId][field] = rawData[key];
            } else {
                // Nested object like "1": { title: "...", ... }
                if (typeof rawData[key] === 'object' && rawData[key] !== null) {
                    vehiclesData[key] = rawData[key];
                }
            }
        });
        
        console.log('[Public] Reconstructed', Object.keys(vehiclesData).length, 'vehicles from Firestore');
        
        Object.keys(vehiclesData).forEach(key => {
            const vehicleId = parseInt(key);
            if (isNaN(vehicleId)) return;
            
            const vehicle = vehiclesData[key];
            
            // Only include valid vehicles with a title
            if (!vehicle || !vehicle.title) {
                console.log('[Public] Vehicle', vehicleId, 'has no title, skipping');
                return;
            }
            
            // Ensure images array exists
            if (!vehicle.images || !Array.isArray(vehicle.images)) {
                vehicle.images = [];
            }
            
            vehicle.id = vehicleId;
            
            // Check if already exists
            const existingIndex = vehicles.findIndex(v => v.id === vehicleId);
            if (existingIndex === -1) {
                vehicles.push(vehicle);
                loadedCount++;
            } else {
                // Update existing
                vehicles[existingIndex] = { ...vehicles[existingIndex], ...vehicle };
            }
            
            // Set up owner mappings
            if (vehicle.ownerEmail) {
                const email = vehicle.ownerEmail.toLowerCase();
                if (!ownerVehicleMap[email]) {
                    ownerVehicleMap[email] = [];
                }
                if (!ownerVehicleMap[email].includes(vehicleId)) {
                    ownerVehicleMap[email].push(vehicleId);
                }
                vehicleOwnerEmail[vehicleId] = email;
            }
            
            // Default availability to true
            if (state.availability[vehicleId] === undefined) {
                state.availability[vehicleId] = true;
            }
        });
        
        window._publicVehiclesLoaded = true;
        console.log('[Public] Loaded', loadedCount, 'vehicles, total:', vehicles.length);
        
        // Update filtered vehicles and render
        state.filteredVehicles = [...vehicles];
        
        if (typeof applyAllFilters === 'function') {
            applyAllFilters();
        } else if (typeof renderVehicles === 'function') {
            renderVehicles(state.filteredVehicles);
        }
        
    } catch (error) {
        console.error('[Public] Error loading vehicles:', error);
    }
};

window.startVehicleSyncListener = function() {
    const user = auth.currentUser;
    
    // For unauthenticated users, do a one-time load instead of real-time sync
    if (!user) {
        loadPublicVehicles();
        return;
    }
    
    // Clean up existing listener
    if (window.vehicleSyncUnsubscribe) {
        window.vehicleSyncUnsubscribe();
        window.vehicleSyncUnsubscribe = null;
    }
    
    let isFirstSnapshot = true;
    
    window.vehicleSyncUnsubscribe = db.collection('settings').doc('vehicles')
        .onSnapshot((doc) => {
            if (!doc.exists) {
                console.log('[VehicleSync] Document does not exist');
                return;
            }
            
            const rawData = doc.data();
            let hasChanges = false;
            let processedCount = 0;
            
            // Store current vehicle count before processing
            const vehicleCountBefore = vehicles.length;
            
            // Reconstruct nested objects from flat keys (e.g., "1.title" -> { "1": { title: "..." } })
            const vehiclesData = {};
            Object.keys(rawData).forEach(key => {
                if (key.includes('.')) {
                    // Flat key like "1.title" or "1.updatedBy"
                    const parts = key.split('.');
                    const vehicleId = parts[0];
                    const field = parts.slice(1).join('.'); // Handle nested fields like "buyer.name"
                    
                    if (!vehiclesData[vehicleId]) {
                        vehiclesData[vehicleId] = {};
                    }
                    vehiclesData[vehicleId][field] = rawData[key];
                } else {
                    // Nested object like "1": { title: "...", ... }
                    if (typeof rawData[key] === 'object' && rawData[key] !== null) {
                        vehiclesData[key] = rawData[key];
                    }
                }
            });
            
            console.log('[VehicleSync] Reconstructed', Object.keys(vehiclesData).length, 'vehicles from Firestore');
            
            Object.keys(vehiclesData).forEach(key => {
                const vehicleId = parseInt(key);
                
                // Skip non-numeric keys (like metadata fields)
                if (isNaN(vehicleId)) {
                    return;
                }
                
                const vehicle = vehiclesData[key];
                
                // Skip if vehicle data is invalid or missing
                if (!vehicle || typeof vehicle !== 'object') {
                    console.log('[VehicleSync] Skipping invalid vehicle data for key:', key);
                    return;
                }
                
                // Only skip if vehicle is completely invalid (must have at least a title)
                if (!vehicle.title) {
                    console.log('[VehicleSync] Vehicle', vehicleId, 'has no title, skipping');
                    return;
                }
                
                processedCount++;
                
                // Ensure images array exists (even if empty)
                if (!vehicle.images || !Array.isArray(vehicle.images)) {
                    vehicle.images = [];
                }
                
                vehicle.id = vehicleId;
                
                const existingIndex = vehicles.findIndex(v => v.id === vehicleId);
                
                if (existingIndex === -1) {
                    vehicles.push(vehicle);
                    hasChanges = true;
                    
                    if (vehicle.ownerEmail) {
                        const email = vehicle.ownerEmail.toLowerCase();
                        if (!ownerVehicleMap[email]) {
                            ownerVehicleMap[email] = [];
                        }
                        if (!ownerVehicleMap[email].includes(vehicleId)) {
                            ownerVehicleMap[email].push(vehicleId);
                        }
                        vehicleOwnerEmail[vehicleId] = email;
                    }
                    
                    if (state.availability[vehicleId] === undefined) {
                        state.availability[vehicleId] = true;
                    }
                } else {
                    const existing = vehicles[existingIndex];
                    const hasUpdates = JSON.stringify(existing) !== JSON.stringify({ ...existing, ...vehicle });
                    
                    if (hasUpdates) {
                        if (vehicle.ownerEmail && vehicle.ownerEmail.toLowerCase() !== existing.ownerEmail?.toLowerCase()) {
                            if (existing.ownerEmail) {
                                const oldEmail = existing.ownerEmail.toLowerCase();
                                if (ownerVehicleMap[oldEmail]) {
                                    ownerVehicleMap[oldEmail] = ownerVehicleMap[oldEmail].filter(id => id !== vehicleId);
                                }
                            }
                            
                            const newEmail = vehicle.ownerEmail.toLowerCase();
                            if (!ownerVehicleMap[newEmail]) {
                                ownerVehicleMap[newEmail] = [];
                            }
                            if (!ownerVehicleMap[newEmail].includes(vehicleId)) {
                                ownerVehicleMap[newEmail].push(vehicleId);
                            }
                            vehicleOwnerEmail[vehicleId] = newEmail;
                        }
                        
                        vehicles[existingIndex] = { ...existing, ...vehicle };
                        hasChanges = true;
                    }
                }
            });
            
            // Check for deleted vehicles (only user-created ones with id >= 1000)
            const firestoreIds = new Set(
                Object.keys(vehiclesData)
                    .map(k => parseInt(k))
                    .filter(id => !isNaN(id))
            );
            const localUserCreatedVehicles = vehicles.filter(v => v.id >= 1000);
            
            localUserCreatedVehicles.forEach(v => {
                if (!firestoreIds.has(v.id)) {
                    const index = vehicles.findIndex(x => x.id === v.id);
                    if (index !== -1) {
                        vehicles.splice(index, 1);
                        hasChanges = true;
                        
                        if (v.ownerEmail) {
                            const email = v.ownerEmail.toLowerCase();
                            if (ownerVehicleMap[email]) {
                                ownerVehicleMap[email] = ownerVehicleMap[email].filter(id => id !== v.id);
                            }
                            delete vehicleOwnerEmail[v.id];
                        }
                    }
                }
            });
            
            // Update filtered vehicles
            state.filteredVehicles = [...vehicles];
            
            console.log('[VehicleSync] Processed', processedCount, 'vehicles, array count:', vehicles.length, '(was', vehicleCountBefore, ')');
            
            // Only render on first snapshot or if there are actual changes
            // Skip re-render if user is on Owner Stats page (to avoid interrupting edits)
            const statsPageVisible = $('vehicleStatsPage') && !$('vehicleStatsPage').classList.contains('hidden');
            const ownerDashVisible = $('ownerDashboard') && !$('ownerDashboard').classList.contains('hidden');
            
            if (isFirstSnapshot) {
                // First load - always render
                if (typeof applyAllFilters === 'function') {
                    applyAllFilters();
                } else if (typeof renderVehicles === 'function') {
                    renderVehicles(state.filteredVehicles);
                }
                isFirstSnapshot = false;
                console.log('[VehicleSync] Initial load complete, total vehicles:', vehicles.length);
            } else if (hasChanges && !statsPageVisible) {
                // Subsequent changes - only render if not on stats page
                if (typeof applyAllFilters === 'function') {
                    applyAllFilters();
                }
                
                // Update owner dashboard if visible
                if (ownerDashVisible && typeof renderOwnerDashboard === 'function') {
                    renderOwnerDashboard();
                }
                
                if (TierService.isMasterAdmin(user.email) && window.adminUsersData && window.adminUsersData.length > 0) {
                    updateAdminStats(window.adminUsersData);
                    renderAdminUsersList(window.adminUsersData);
                }
            }
            
        }, (error) => {
            console.error('[VehicleSync] Listener error:', error);
        });
};

// Stop vehicle sync listener (call on logout)
window.stopVehicleSyncListener = function() {
    if (window.vehicleSyncUnsubscribe) {
        window.vehicleSyncUnsubscribe();
        window.vehicleSyncUnsubscribe = null;
    }
};

// Export VehicleDataService globally
window.VehicleDataService = VehicleDataService;

console.log('[Services] PaulysAutos services module loaded');
