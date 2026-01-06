// ==================== TIER SYSTEM ====================
/**
 * User Tiers Configuration
 * - Starter (free): 1 listing
 * - Pro: 3 listings  
 * - Elite: Unlimited listings
 */
const TIERS = {
    starter: { 
        maxListings: 1, 
        icon: '🌱', 
        name: 'Starter',
        color: 'text-gray-400',
        bgColor: 'bg-gray-600'
    },
    pro: { 
        maxListings: 3, 
        icon: '⭐', 
        name: 'Pro',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-600'
    },
    elite: { 
        maxListings: Infinity, 
        icon: '👑', 
        name: 'Elite',
        color: 'text-purple-400',
        bgColor: 'bg-purple-600'
    }
};

// Master admin email
// Master admin email - PaulysAutos.com owner
const MASTER_ADMIN_EMAIL = 'pauly@pma.network';

/**
 * OwnershipService - SINGLE SOURCE OF TRUTH for property ownership
 * All ownership queries should go through this service to ensure consistency
 */
const OwnershipService = {
    /**
     * Get properties owned by a specific email
     * Priority:
     * 1. prop.ownerEmail field (Firestore data)
     * 2. propertyOwnerEmail map (for static properties without ownerEmail)
     * @param {string} email - Owner email
     * @returns {Array} - Array of property objects owned by this email
     */
    getPropertiesForOwner(email) {
        if (!email) return [];
        const normalizedEmail = email.toLowerCase();
        return properties.filter(p => {
            // Primary check: ownerEmail field on property
            const propOwner = (p.ownerEmail || '').toLowerCase();
            if (propOwner) {
                return propOwner === normalizedEmail;
            }
            
            // Secondary check: propertyOwnerEmail reverse map (for static properties)
            const mappedOwner = (propertyOwnerEmail[p.id] || '').toLowerCase();
            return mappedOwner === normalizedEmail;
        });
    },
    
    /**
     * Count listings for an owner
     * @param {string} email - Owner email
     * @returns {number} - Number of properties owned
     */
    getListingCount(email) {
        return this.getPropertiesForOwner(email).length;
    },
    
    /**
     * Check if a user owns a specific property
     * @param {string} email - User email
     * @param {number} propertyId - Property ID
     * @returns {boolean}
     */
    ownsProperty(email, propertyId) {
        if (!email) return false;
        const normalizedEmail = email.toLowerCase();
        const prop = properties.find(p => p.id === propertyId);
        if (!prop) return false;
        
        // Primary check: ownerEmail field
        const propOwner = (prop.ownerEmail || '').toLowerCase();
        if (propOwner) {
            return propOwner === normalizedEmail;
        }
        
        // Secondary check: propertyOwnerEmail map
        const mappedOwner = (propertyOwnerEmail[propertyId] || '').toLowerCase();
        return mappedOwner === normalizedEmail;
    },
    
    /**
     * Rebuild ownerPropertyMap from properties array
     * This ensures the cached map stays in sync with actual property data
     */
    rebuildOwnerPropertyMap() {
        // Clear existing entries for emails we've seen
        const emailsToClean = new Set(Object.keys(ownerPropertyMap));
        
        // Rebuild from properties
        properties.forEach(p => {
            if (p) {
                // Check ownerEmail first (Firestore data)
                let email = (p.ownerEmail || '').toLowerCase();
                
                // Fallback to propertyOwnerEmail map (for static properties)
                if (!email && propertyOwnerEmail[p.id]) {
                    email = propertyOwnerEmail[p.id].toLowerCase();
                }
                
                if (email) {
                    if (!ownerPropertyMap[email]) {
                        ownerPropertyMap[email] = [];
                    }
                    if (!ownerPropertyMap[email].includes(p.id)) {
                        ownerPropertyMap[email].push(p.id);
                    }
                    emailsToClean.delete(email);
                    
                    // Update reverse map
                    propertyOwnerEmail[p.id] = email;
                }
            }
        });
        
        // Clean up ownerPropertyMap entries for emails that no longer own anything
        // But preserve the admin email's static properties
        emailsToClean.forEach(email => {
            const adminEmail = 'richard2019201900@gmail.com';
            if (email !== adminEmail) {
                // Filter out properties this email doesn't actually own
                ownerPropertyMap[email] = (ownerPropertyMap[email] || []).filter(propId => {
                    const prop = properties.find(p => p.id === propId);
                    if (prop && prop.ownerEmail) {
                        return prop.ownerEmail.toLowerCase() === email;
                    }
                    // Keep if propertyOwnerEmail says so
                    return propertyOwnerEmail[propId]?.toLowerCase() === email;
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
                const propsDoc = await db.collection('settings').doc('properties').get();
                if (propsDoc.exists) {
                    const propsData = propsDoc.data();
                    listingCount = Object.values(propsData).filter(p => 
                        p && p.ownerEmail && p.ownerEmail.toLowerCase() === normalizedEmail
                    ).length;
                }
            } catch (e) {
                // Fallback to cached map if Firestore query fails
                listingCount = (ownerPropertyMap[normalizedEmail] || []).length;
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
const PropertyDataService = {
    collectionName: 'settings',
    docName: 'vehicles',  // Changed from 'properties' for PaulysAutos
    
    // Active listener for cleanup
    unsubscribeListener: null,
    
    /**
     * READ: Fetch fresh property data from Firestore
     * @param {number} propertyId - The property ID to read
     * @returns {Promise<Object>} - Fresh property data
     */
    async read(propertyId) {
        const numericId = typeof propertyId === 'string' ? parseInt(propertyId) : propertyId;
        
        try {
            const doc = await db.collection(this.collectionName).doc(this.docName).get();
            if (doc.exists) {
                const allData = doc.data();
                const propertyData = allData[String(numericId)] || null;
                
                // Update local properties array if data exists
                if (propertyData) {
                    const prop = properties.find(p => p.id === numericId);
                    if (prop) {
                        Object.assign(prop, propertyData);
                    }
                }
                
                return { exists: propertyData !== null, data: propertyData };
            }
            return { exists: false, data: null };
        } catch (error) {
            console.error('[PropertyDataService] READ error:', error);
            throw error;
        }
    },
    
    /**
     * READ ALL: Fetch all properties
     * @returns {Promise<Object>} - All property data
     */
    async readAll() {
        try {
            const doc = await db.collection(this.collectionName).doc(this.docName).get();
            if (doc.exists) {
                return doc.data();
            }
            return {};
        } catch (error) {
            console.error('[PropertyDataService] READ ALL error:', error);
            return {};
        }
    },
    
    /**
     * WRITE: Update property data in Firestore
     * UNIFIED: All properties write to settings/properties
     * @param {number} propertyId - The property ID to update
     * @param {string} field - The field name to update
     * @param {any} value - The new value
     * @returns {Promise<boolean>} - Success status
     */
    async write(propertyId, field, value) {
        const numericId = typeof propertyId === 'string' ? parseInt(propertyId) : propertyId;
        const prop = properties.find(p => p.id === numericId);
        
        try {
            // UNIFIED: Always write to settings/properties
            const updateData = {
                [`${numericId}.${field}`]: value,
                [`${numericId}.updatedAt`]: firebase.firestore.FieldValue.serverTimestamp(),
                [`${numericId}.updatedBy`]: auth.currentUser?.email || 'unknown'
            };
            
            await db.collection(this.collectionName).doc(this.docName).update(updateData);
            
            // Update local property object immediately
            if (prop) {
                prop[field] = value;
            }
            
            console.log(`[PropertyDataService] Wrote ${field}=${value} for property ${numericId}`);
            return true;
        } catch (error) {
            console.error('[PropertyDataService] WRITE error:', error);
            throw error;
        }
    },
    
    /**
     * WRITE MULTIPLE: Update multiple fields at once
     * @param {number} propertyId - The property ID to update
     * @param {Object} fields - Object with field:value pairs
     * @returns {Promise<boolean>} - Success status
     */
    async writeMultiple(propertyId, fields) {
        const numericId = typeof propertyId === 'string' ? parseInt(propertyId) : propertyId;
        const prop = properties.find(p => p.id === numericId);
        
        try {
            const updateData = {
                [`${numericId}.updatedAt`]: firebase.firestore.FieldValue.serverTimestamp(),
                [`${numericId}.updatedBy`]: auth.currentUser?.email || 'unknown'
            };
            
            Object.keys(fields).forEach(field => {
                updateData[`${numericId}.${field}`] = fields[field];
            });
            
            await db.collection(this.collectionName).doc(this.docName).update(updateData);
            
            // Update local property object
            if (prop) {
                Object.assign(prop, fields);
            }
            
            console.log(`[PropertyDataService] Wrote ${Object.keys(fields).length} fields for property ${numericId}`);
            return true;
        } catch (error) {
            console.error('[PropertyDataService] WRITE MULTIPLE error:', error);
            throw error;
        }
    },
    
    /**
     * Subscribe to real-time updates for ALL properties
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
                    
                    // Update properties array from Firestore
                    Object.keys(data).forEach(propId => {
                        const numericId = parseInt(propId);
                        if (!isNaN(numericId) && data[propId] && data[propId].title) {
                            const existingIndex = properties.findIndex(p => p.id === numericId);
                            if (existingIndex !== -1) {
                                // Update existing property
                                Object.assign(properties[existingIndex], data[propId]);
                            } else {
                                // Add new property
                                const newProp = { ...data[propId], id: numericId };
                                properties.push(newProp);
                            }
                        }
                    });
                    
                    if (callback) callback(data);
                }
            }, error => {
                console.error('[PropertyDataService] SUBSCRIBE error:', error);
            });
        
        return this.unsubscribeListener;
    },
    
    /**
     * Get the effective value for a property field
     * UNIFIED: Always reads from properties array (synced from Firestore)
     * @param {number} propertyId - The property ID
     * @param {string} field - The field name
     * @param {any} defaultValue - Default value if not found
     */
    getValue(propertyId, field, defaultValue) {
        const numericId = typeof propertyId === 'string' ? parseInt(propertyId) : propertyId;
        const prop = properties.find(p => p.id === numericId);
        
        // Single source: properties array (synced from Firestore)
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
            db.collection('settings').doc('properties').get(),
            db.collection('settings').doc('propertyAvailability').get()
        ]);
        
        console.log('\n📁 settings/properties (SINGLE SOURCE OF TRUTH):');
        if (propsDoc.exists) {
            const data = propsDoc.data();
            const propIds = Object.keys(data).filter(k => data[k]?.title).sort((a,b) => parseInt(a) - parseInt(b));
            console.log(`   Total properties: ${propIds.length}`);
            propIds.forEach(id => {
                const p = data[id];
                console.log(`   ${id}: ${p.title} | Owner: ${p.ownerEmail || 'master'} | Premium: ${p.isPremium || false}`);
            });
        } else {
            console.log('   (does not exist - run migration first!)');
        }
        
        console.log('\n📁 settings/propertyAvailability:');
        if (availDoc.exists) {
            const data = availDoc.data();
            console.log(`   Entries: ${Object.keys(data).length}`);
            Object.keys(data).sort((a,b) => parseInt(a) - parseInt(b)).forEach(id => {
                console.log(`   ${id}: ${data[id] ? 'Available' : 'Rented'}`);
            });
        } else {
            console.log('   (does not exist)');
        }
        
        // Check for old propertyOverrides (should be deleted after migration)
        const overridesDoc = await db.collection('settings').doc('propertyOverrides').get();
        if (overridesDoc.exists) {
            console.log('\n⚠️  OLD DATA DETECTED: settings/propertyOverrides still exists!');
            console.log('   Run migration.js deleteOldOverrides() to clean up.');
        } else {
            console.log('\n✅ Clean: No old propertyOverrides document');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
};

/**
 * Show all data for a specific property
 * Call from console: await showPropertyData(7)
 */
window.showPropertyData = async function(propertyId) {
    const numericId = typeof propertyId === 'string' ? parseInt(propertyId) : propertyId;
    
    console.log(`========== PROPERTY ${numericId} DATA ==========`);
    
    // Local data
    const prop = properties.find(p => p.id === numericId);
    console.log('\n📦 Local properties array:');
    console.log(prop ? JSON.stringify(prop, null, 2) : 'Not found');
    
    // Firestore data
    try {
        const doc = await db.collection('settings').doc('properties').get();
        if (doc.exists && doc.data()[numericId]) {
            console.log('\n☁️  Firestore settings/properties:');
            console.log(JSON.stringify(doc.data()[numericId], null, 2));
        } else {
            console.log('\n☁️  Firestore: Not found');
        }
    } catch (error) {
        console.error('Firestore error:', error);
    }
    
    // Availability
    console.log('\n📊 Availability:', state.availability[numericId] !== false ? 'Available' : 'Rented');
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
                renderProperties(state.filteredProperties);
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
                    state.filteredProperties = [...vehicles];
                    // Apply filters including hideUnavailable if checked
                    if (typeof applyAllFilters === 'function') {
                        applyAllFilters();
                    } else {
                        renderProperties(state.filteredProperties);
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
        await db.collection('settings').doc('propertyAvailability').set({ [id]: isAvailable }, { merge: true });
        console.log('[Availability] Saved to Firestore:', id, isAvailable);
        return true;
    } catch (error) {
        console.error('[Availability] Save error:', error);
        return false;
    }
}

window.toggleAvailability = async function(id) {
    const currentlyRented = state.availability[id] === false;
    
    // If trying to mark as Available, check if renter info or payment date exists
    if (currentlyRented) {
        const renterName = PropertyDataService.getValue(id, 'renterName', '');
        const renterPhone = PropertyDataService.getValue(id, 'renterPhone', '');
        const lastPaymentDate = PropertyDataService.getValue(id, 'lastPaymentDate', '');
        
        if (renterName || renterPhone || lastPaymentDate) {
            let message = '⚠️ Cannot mark as Available\n\nThis property has renter/payment information set:\n';
            if (renterName) message += `• Renter Name: ${renterName}\n`;
            if (renterPhone) message += `• Renter Phone: ${renterPhone}\n`;
            if (lastPaymentDate) message += `• Last Payment Date: ${lastPaymentDate}\n`;
            message += '\nTo mark this property as Available, first clear these fields by clicking on them and deleting the values.';
            
            alert(message);
            return;
        }
    }
    
    state.availability[id] = !state.availability[id];
    renderOwnerDashboard();
    renderProperties(state.filteredProperties);
    
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
        const doc = await db.collection('settings').doc('propertyAvailability').get();
        const data = doc.exists ? doc.data() : {};
        const updates = {};
        let needsUpdate = false;
        
        // IMPORTANT: Firestore returns string keys, so we must use String(p.id) to access
        properties.forEach(p => {
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
            await db.collection('settings').doc('propertyAvailability').set(updates, { merge: true });
        }
        
        // Load user-created properties
        const propsDoc = await db.collection('settings').doc('properties').get();
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
                
                // Check if this property already exists in the array
                const existingIndex = properties.findIndex(p => p.id === propId);
                if (existingIndex === -1) {
                    // New property - add to array
                    properties.push(prop);
                } else {
                    // Existing property - update with Firestore data (single source of truth)
                    Object.assign(properties[existingIndex], prop);
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
                    if (!ownerPropertyMap[email]) {
                        ownerPropertyMap[email] = [];
                    }
                    if (!ownerPropertyMap[email].includes(propId)) {
                        ownerPropertyMap[email].push(propId);
                    }
                    propertyOwnerEmail[propId] = email;
                }
            });
            
            // Update filtered properties
            state.filteredProperties = [...properties];
        }
        
        // Rebuild ownerPropertyMap from properties array (single source of truth)
        OwnershipService.rebuildOwnerPropertyMap();
        
        // NOTE: propertyOverrides loading removed - unified architecture uses settings/properties only
        // Old propertyOverrides document should be deleted after migration
        
        // Sync all property owner mappings to ensure consistency
        syncPropertyOwnerMappings();
        
        // Preload owner usernames in background for faster display
        preloadOwnerUsernames().catch(() => {});
    } catch (error) {
        console.error('Init error:', error);
    }
}

// Ensure all property owner mappings are synchronized
function syncPropertyOwnerMappings() {
    // 1. First, sync from property objects (highest priority - these come from Firestore)
    properties.forEach(prop => {
        if (prop.ownerEmail) {
            const lowerEmail = prop.ownerEmail.toLowerCase();
            propertyOwnerEmail[prop.id] = lowerEmail;
            
            if (!ownerPropertyMap[lowerEmail]) {
                ownerPropertyMap[lowerEmail] = [];
            }
            if (!ownerPropertyMap[lowerEmail].includes(prop.id)) {
                ownerPropertyMap[lowerEmail].push(prop.id);
            }
        }
    });
    
    // 2. Then fill in any gaps from ownerPropertyMap
    Object.keys(ownerPropertyMap).forEach(email => {
        const lowerEmail = email.toLowerCase();
        (ownerPropertyMap[email] || []).forEach(propId => {
            if (!propertyOwnerEmail[propId]) {
                propertyOwnerEmail[propId] = lowerEmail;
            }
        });
    });
}

// ==================== REAL-TIME PROPERTY SYNC (ALL USERS) ====================
// This listener keeps the properties array in sync for ALL logged-in users (not just admin)
window.propertySyncUnsubscribe = null;

window.startPropertySyncListener = function() {
    const user = auth.currentUser;
    if (!user) return;
    
    // Clean up existing listener
    if (window.propertySyncUnsubscribe) {
        window.propertySyncUnsubscribe();
        window.propertySyncUnsubscribe = null;
    }
    
    let isFirstSnapshot = true;
    
    window.propertySyncUnsubscribe = db.collection('settings').doc('properties')
        .onSnapshot((doc) => {
            if (!doc.exists) {
                return;
            }
            
            const propsData = doc.data();
            let hasChanges = false;
            
            Object.keys(propsData).forEach(key => {
                const propId = parseInt(key);
                const prop = propsData[key];
                
                // Only skip if property is completely invalid (must have at least a title)
                if (!prop || !prop.title) {
                    return;
                }
                
                // Ensure images array exists (even if empty)
                if (!prop.images || !Array.isArray(prop.images)) {
                    prop.images = [];
                }
                
                prop.id = propId;
                
                const existingIndex = properties.findIndex(p => p.id === propId);
                
                if (existingIndex === -1) {
                    properties.push(prop);
                    hasChanges = true;
                    
                    if (prop.ownerEmail) {
                        const email = prop.ownerEmail.toLowerCase();
                        if (!ownerPropertyMap[email]) {
                            ownerPropertyMap[email] = [];
                        }
                        if (!ownerPropertyMap[email].includes(propId)) {
                            ownerPropertyMap[email].push(propId);
                        }
                        propertyOwnerEmail[propId] = email;
                    }
                    
                    if (state.availability[propId] === undefined) {
                        state.availability[propId] = true;
                    }
                } else {
                    const existing = properties[existingIndex];
                    const hasUpdates = JSON.stringify(existing) !== JSON.stringify({ ...existing, ...prop });
                    
                    if (hasUpdates) {
                        if (prop.ownerEmail && prop.ownerEmail.toLowerCase() !== existing.ownerEmail?.toLowerCase()) {
                            if (existing.ownerEmail) {
                                const oldEmail = existing.ownerEmail.toLowerCase();
                                if (ownerPropertyMap[oldEmail]) {
                                    ownerPropertyMap[oldEmail] = ownerPropertyMap[oldEmail].filter(id => id !== propId);
                                }
                            }
                            
                            const newEmail = prop.ownerEmail.toLowerCase();
                            if (!ownerPropertyMap[newEmail]) {
                                ownerPropertyMap[newEmail] = [];
                            }
                            if (!ownerPropertyMap[newEmail].includes(propId)) {
                                ownerPropertyMap[newEmail].push(propId);
                            }
                            propertyOwnerEmail[propId] = newEmail;
                        }
                        
                        properties[existingIndex] = { ...existing, ...prop };
                        hasChanges = true;
                    }
                }
            });
            
            // Check for deleted properties
            const firestoreIds = new Set(Object.keys(propsData).map(k => parseInt(k)));
            const localUserCreatedProps = properties.filter(p => p.id >= 1000);
            
            localUserCreatedProps.forEach(prop => {
                if (!firestoreIds.has(prop.id)) {
                    const index = properties.findIndex(p => p.id === prop.id);
                    if (index !== -1) {
                        properties.splice(index, 1);
                        hasChanges = true;
                        
                        if (prop.ownerEmail) {
                            const email = prop.ownerEmail.toLowerCase();
                            if (ownerPropertyMap[email]) {
                                ownerPropertyMap[email] = ownerPropertyMap[email].filter(id => id !== prop.id);
                            }
                            delete propertyOwnerEmail[prop.id];
                        }
                    }
                }
            });
            
            state.filteredProperties = [...properties];
            
            if (hasChanges && !isFirstSnapshot) {
                // Apply filters including hideUnavailable if checked
                if (typeof applyAllFilters === 'function') {
                    applyAllFilters();
                } else if (typeof renderProperties === 'function') {
                    renderProperties(state.filteredProperties);
                }
                
                const dashboardEl = $('ownerDashboard');
                if (dashboardEl && !dashboardEl.classList.contains('hidden') && typeof renderOwnerDashboard === 'function') {
                    renderOwnerDashboard();
                }
                
                if (TierService.isMasterAdmin(user.email) && window.adminUsersData && window.adminUsersData.length > 0) {
                    updateAdminStats(window.adminUsersData);
                    renderAdminUsersList(window.adminUsersData);
                }
            }
            
            if (isFirstSnapshot) {
                isFirstSnapshot = false;
            }
            
        }, (error) => {
            console.error('[PropertySync] Listener error:', error);
        });
};

// Stop property sync listener (call on logout)
window.stopPropertySyncListener = function() {
    if (window.propertySyncUnsubscribe) {
        window.propertySyncUnsubscribe();
        window.propertySyncUnsubscribe = null;
    }
};

// Alias for vehicle-based code
const VehicleDataService = PropertyDataService;
window.VehicleDataService = VehicleDataService;

console.log('[Services] PaulysAutos services module loaded');
