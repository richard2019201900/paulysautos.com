// ============================================================
// GAMIFICATION SERVICE
// Enterprise-grade XP, Levels, Achievements, and Celebrations
// All state is authoritative in Firestore - no client-side computation
// ============================================================

const GamificationService = {
    // Level definitions
    levels: [
        { level: 1, xp: 0, title: 'Newcomer', icon: '🌱' },
        { level: 2, xp: 300, title: 'Resident', icon: '🏠' },
        { level: 3, xp: 1000, title: 'Landlord', icon: '🔑' },
        { level: 4, xp: 3000, title: 'Property Mogul', icon: '🏢' },
        { level: 5, xp: 7500, title: 'Real Estate Tycoon', icon: '💼' },
        { level: 6, xp: 15000, title: 'Property Baron', icon: '🎩' },
        { level: 7, xp: 30000, title: 'Elite Investor', icon: '💎' },
        { level: 8, xp: 50000, title: 'Legendary Owner', icon: '👑' }
    ],

    // XP values for activities
    xpValues: {
        signup: 100,
        display_name: 50,
        phone_added: 150,
        profile_complete: 100,
        first_listing: 500,
        additional_listing: 250,
        first_rental: 1000,
        additional_rental: 500,
        premium_listing: 200
    },

    // Achievement definitions
    achievements: {
        signup: { name: 'Welcome!', description: 'Created an account', icon: '🎉' },
        display_name: { name: 'Identity', description: 'Added display name', icon: '📝' },
        phone_added: { name: 'Connected', description: 'Added phone number', icon: '📱' },
        profile_complete: { name: 'Profile Pro', description: 'Completed profile', icon: '✨' },
        first_listing: { name: 'First Home', description: 'Posted first listing', icon: '🏠' },
        first_rental: { name: 'First Deal', description: 'Completed first rental', icon: '🤝' },
        premium_listing: { name: 'Premium Player', description: 'Used premium listing', icon: '👑' },
        level_5: { name: 'Tycoon Status', description: 'Reached Level 5', icon: '💼' },
        level_7: { name: 'Elite Status', description: 'Reached Level 7', icon: '💎' }
    },

    // Get level info from XP
    getLevelFromXP: function(xp) {
        let result = this.levels[0];
        for (const level of this.levels) {
            if (xp >= level.xp) {
                result = level;
            } else {
                break;
            }
        }
        return result;
    },

    // Get XP required for next level
    getNextLevelXP: function(currentLevel) {
        const nextLevel = this.levels.find(l => l.level === currentLevel + 1);
        return nextLevel ? nextLevel.xp : null;
    },

    // Get progress percentage to next level
    getProgressPercent: function(xp, currentLevel) {
        const currentLevelData = this.levels.find(l => l.level === currentLevel);
        const nextLevelData = this.levels.find(l => l.level === currentLevel + 1);
        
        if (!nextLevelData) return 100; // Max level
        
        const currentThreshold = currentLevelData ? currentLevelData.xp : 0;
        const nextThreshold = nextLevelData.xp;
        const progress = ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
        
        return Math.min(100, Math.max(0, progress));
    },

    // Award XP for an achievement (prevents duplicates via Firestore transaction)
    awardAchievement: async function(userId, achievementId, xpAmount, extraData = {}) {
        const userRef = db.collection('users').doc(userId);
        
        try {
            const result = await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error('User not found');
                }
                
                const userData = userDoc.data();
                const gamification = userData.gamification || {
                    xp: 0,
                    level: 1,
                    title: 'Newcomer',
                    achievements: {},
                    stats: { totalRentals: 0, propertiesPosted: 0 },
                    rewards: {}
                };
                
                // Check if already earned
                if (gamification.achievements && gamification.achievements[achievementId]) {
                    console.log(`[Gamification] Achievement ${achievementId} already earned, skipping`);
                    return { alreadyEarned: true };
                }
                
                // Calculate new XP and level
                const oldXP = gamification.xp || 0;
                const oldLevel = gamification.level || 1;
                const newXP = oldXP + xpAmount;
                const newLevelInfo = GamificationService.getLevelFromXP(newXP);
                
                // Build update object
                const updates = {
                    'gamification.xp': newXP,
                    'gamification.level': newLevelInfo.level,
                    'gamification.title': newLevelInfo.title,
                    [`gamification.achievements.${achievementId}`]: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Add any extra stat updates
                if (extraData.statUpdate) {
                    for (const [key, value] of Object.entries(extraData.statUpdate)) {
                        updates[`gamification.stats.${key}`] = value;
                    }
                }
                
                transaction.update(userRef, updates);
                
                return {
                    oldXP,
                    newXP,
                    xpGained: xpAmount,
                    oldLevel,
                    newLevel: newLevelInfo.level,
                    leveledUp: newLevelInfo.level > oldLevel,
                    newLevelInfo
                };
            });
            
            if (result.alreadyEarned) {
                return result;
            }
            
            console.log(`[Gamification] Awarded ${xpAmount} XP for ${achievementId}. Total: ${result.newXP}`);
            
            // Handle level up
            if (result.leveledUp) {
                await this.handleLevelUp(userId, result.newLevelInfo, userData);
            }
            
            return result;
            
        } catch (error) {
            console.error('[Gamification] Error awarding achievement:', error);
            throw error;
        }
    },

    // Award XP without achievement tracking (for repeatable actions)
    awardXP: async function(userId, xpAmount, reason) {
        const userRef = db.collection('users').doc(userId);
        
        try {
            const result = await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error('User not found');
                }
                
                const userData = userDoc.data();
                const gamification = userData.gamification || { xp: 0, level: 1, title: 'Newcomer' };
                
                const oldXP = gamification.xp || 0;
                const oldLevel = gamification.level || 1;
                const newXP = oldXP + xpAmount;
                const newLevelInfo = GamificationService.getLevelFromXP(newXP);
                
                // Create activity log entry
                const activityLog = gamification.activityLog || [];
                const newActivity = {
                    type: 'xp_gain',
                    amount: xpAmount,
                    reason: reason,
                    timestamp: new Date().toISOString(),
                    totalAfter: newXP
                };
                
                // Keep only last 20 activities (we show 10, keep extra for safety)
                activityLog.unshift(newActivity);
                if (activityLog.length > 20) {
                    activityLog.length = 20;
                }
                
                transaction.update(userRef, {
                    'gamification.xp': newXP,
                    'gamification.level': newLevelInfo.level,
                    'gamification.title': newLevelInfo.title,
                    'gamification.activityLog': activityLog
                });
                
                return {
                    oldXP,
                    newXP,
                    xpGained: xpAmount,
                    oldLevel,
                    newLevel: newLevelInfo.level,
                    leveledUp: newLevelInfo.level > oldLevel,
                    newLevelInfo,
                    userData
                };
            });
            
            console.log(`[Gamification] Awarded ${xpAmount} XP for ${reason}. Total: ${result.newXP}`);
            
            if (result.leveledUp) {
                await this.handleLevelUp(userId, result.newLevelInfo, result.userData);
            }
            
            return result;
            
        } catch (error) {
            console.error('[Gamification] Error awarding XP:', error);
            throw error;
        }
    },

    // Deduct XP (for reversing actions like deleted payments)
    deductXP: async function(userId, xpAmount, reason) {
        const userRef = db.collection('users').doc(userId);
        
        try {
            const result = await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error('User not found');
                }
                
                const userData = userDoc.data();
                const gamification = userData.gamification || { xp: 0, level: 1, title: 'Newcomer' };
                
                const oldXP = gamification.xp || 0;
                const oldLevel = gamification.level || 1;
                // Ensure XP doesn't go below 0
                const newXP = Math.max(0, oldXP - xpAmount);
                const actualDeducted = oldXP - newXP;
                const newLevelInfo = GamificationService.getLevelFromXP(newXP);
                
                // Create activity log entry for deduction
                const activityLog = gamification.activityLog || [];
                if (actualDeducted > 0) {
                    const newActivity = {
                        type: 'xp_loss',
                        amount: -actualDeducted,
                        reason: reason,
                        timestamp: new Date().toISOString(),
                        totalAfter: newXP
                    };
                    
                    // Keep only last 20 activities
                    activityLog.unshift(newActivity);
                    if (activityLog.length > 20) {
                        activityLog.length = 20;
                    }
                }
                
                transaction.update(userRef, {
                    'gamification.xp': newXP,
                    'gamification.level': newLevelInfo.level,
                    'gamification.title': newLevelInfo.title,
                    'gamification.activityLog': activityLog
                });
                
                return {
                    oldXP,
                    newXP,
                    xpLost: actualDeducted,
                    oldLevel,
                    newLevel: newLevelInfo.level,
                    leveledDown: newLevelInfo.level < oldLevel
                };
            });
            
            console.log(`[Gamification] Deducted ${result.xpLost} XP for ${reason}. Total: ${result.newXP}`);
            
            if (result.leveledDown) {
                console.log(`[Gamification] Level decreased from ${result.oldLevel} to ${result.newLevel}`);
            }
            
            return result;
            
        } catch (error) {
            console.error('[Gamification] Error deducting XP:', error);
            throw error;
        }
    },

    // Handle level up events
    handleLevelUp: async function(userId, newLevelInfo, userData) {
        console.log(`[Gamification] Level up! Now Level ${newLevelInfo.level}: ${newLevelInfo.title}`);
        
        // Show level up modal
        if (typeof showLevelUpModal === 'function') {
            showLevelUpModal(newLevelInfo);
        }
        
        // Create celebration for significant levels (5, 7, 8)
        if ([5, 7, 8].includes(newLevelInfo.level)) {
            const userName = userData?.username || userData?.email?.split('@')[0] || 'A user';
            await this.createCelebration({
                type: 'level_up',
                userId: userId,
                userName: userName,
                level: newLevelInfo.level,
                title: newLevelInfo.title,
                icon: newLevelInfo.icon,
                message: `just reached ${newLevelInfo.title} status!`
            });
        }
        
        // Grant Level 5 reward (free premium week)
        if (newLevelInfo.level === 5) {
            await this.grantReward(userId, 'free_premium_week');
        }
    },

    // Grant a reward
    grantReward: async function(userId, rewardId) {
        const now = new Date().toISOString();
        
        await db.collection('users').doc(userId).update({
            [`gamification.rewards.${rewardId}`]: {
                earned: now,
                used: false,
                usedOn: null,
                usedAt: null
            }
        });
        
        console.log(`[Gamification] Granted reward: ${rewardId}`);
        
        if (typeof showToast === 'function') {
            showToast('🎁 You earned a free premium week! Use it on any listing.', 'success');
        }
    },

    // Use a reward (returns true if successful)
    useReward: async function(userId, rewardId, propertyId) {
        const userRef = db.collection('users').doc(userId);
        
        try {
            const result = await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) return { success: false, reason: 'User not found' };
                
                const userData = userDoc.data();
                const reward = userData.gamification?.rewards?.[rewardId];
                
                if (!reward) return { success: false, reason: 'Reward not found' };
                if (reward.used) return { success: false, reason: 'Reward already used' };
                
                const now = new Date().toISOString();
                
                transaction.update(userRef, {
                    [`gamification.rewards.${rewardId}.used`]: true,
                    [`gamification.rewards.${rewardId}.usedOn`]: propertyId,
                    [`gamification.rewards.${rewardId}.usedAt`]: now
                });
                
                return { success: true };
            });
            
            return result;
            
        } catch (error) {
            console.error('[Gamification] Error using reward:', error);
            return { success: false, reason: error.message };
        }
    },

    // Check if user has unused reward
    hasUnusedReward: function(userData, rewardId) {
        const reward = userData?.gamification?.rewards?.[rewardId];
        return reward && !reward.used;
    },

    // Create a site-wide celebration
    createCelebration: async function(data) {
        const celebrationId = 'cel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        
        const celebration = {
            id: celebrationId,
            type: data.type,
            userId: data.userId,
            userName: data.userName,
            propertyTitle: data.propertyTitle || null,
            level: data.level || null,
            title: data.title || null,
            icon: data.icon || '🎉',
            message: data.message,
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString()
        };
        
        try {
            // Add to celebrations array
            await db.collection('settings').doc('celebrations').set({
                active: firebase.firestore.FieldValue.arrayUnion(celebration)
            }, { merge: true });
            
            console.log(`[Gamification] Created celebration: ${celebration.message}`);
            
        } catch (error) {
            console.error('[Gamification] Error creating celebration:', error);
        }
    },

    // Get leaderboard (top N users by XP)
    getLeaderboard: async function(limit = 10) {
        try {
            const snapshot = await db.collection('users')
                .orderBy('gamification.xp', 'desc')
                .limit(limit)
                .get();
            
            const leaderboard = [];
            let rank = 1;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const gam = data.gamification || {};
                
                leaderboard.push({
                    rank: rank++,
                    odbc: doc.id,
                    username: data.username || data.email?.split('@')[0] || 'Anonymous',
                    email: data.email,
                    xp: gam.xp || 0,
                    level: gam.level || 1,
                    title: gam.title || 'Newcomer',
                    icon: GamificationService.levels.find(l => l.level === (gam.level || 1))?.icon || '🌱'
                });
            });
            
            return leaderboard;
            
        } catch (error) {
            console.error('[Gamification] Error fetching leaderboard:', error);
            return [];
        }
    },

    // Get user's rank
    getUserRank: async function(userXP) {
        try {
            // Use Cloud Function for secure rank calculation
            // (Users can no longer query other users' documents)
            const getUserRankFn = functions.httpsCallable('getUserRank');
            const result = await getUserRankFn({ xp: userXP });
            
            if (result.data.success) {
                return result.data.rank;
            }
            return null;
            
        } catch (error) {
            console.error('[Gamification] Error getting user rank:', error);
            return null;
        }
    },

    // Initialize gamification for new user
    initializeNewUser: async function(userId) {
        const now = firebase.firestore.FieldValue.serverTimestamp();
        
        await db.collection('users').doc(userId).update({
            gamification: {
                xp: 100, // Signup XP
                level: 1,
                title: 'Newcomer',
                achievements: {
                    signup: now
                },
                stats: {
                    totalRentals: 0,
                    propertiesPosted: 0
                },
                rewards: {},
                migrated: true,
                migratedAt: now
            }
        });
        
        console.log(`[Gamification] Initialized new user: ${userId}`);
    },

    // Trigger migration for all users (calls Cloud Function)
    triggerMigration: async function() {
        try {
            if (typeof showToast === 'function') {
                showToast('Starting gamification migration...', 'info');
            }
            
            const migrateAll = firebase.functions().httpsCallable('migrateAllUsersToGamification');
            const result = await migrateAll();
            
            console.log('[Gamification] Migration result:', result.data);
            
            // Store global migration completion flag in Firestore
            // This prevents migration from ever running again
            try {
                await firebase.firestore().collection('settings').doc('gamification').set({
                    migrationComplete: true,
                    migrationDate: new Date().toISOString(),
                    usersMigrated: result.data.migrated || 0
                }, { merge: true });
                console.log('[Gamification] Migration completion flag stored in Firestore');
            } catch (flagError) {
                console.warn('[Gamification] Could not store migration flag:', flagError);
            }
            
            if (typeof showToast === 'function') {
                showToast(`Migration complete: ${result.data.migrated} users migrated`, 'success');
            }
            
            return result.data;
            
        } catch (error) {
            console.error('[Gamification] Migration error:', error);
            if (typeof showToast === 'function') {
                showToast('Migration failed: ' + error.message, 'error');
            }
            throw error;
        }
    },

    // Check if migration has already been completed (checks Firestore flag)
    isMigrationComplete: async function() {
        try {
            const doc = await firebase.firestore().collection('settings').doc('gamification').get();
            return doc.exists && doc.data()?.migrationComplete === true;
        } catch (error) {
            console.warn('[Gamification] Could not check migration status:', error);
            return false;
        }
    },

    // Check and auto-trigger migration if needed (called from admin panel)
    checkAndTriggerMigration: async function(users) {
        // First check the global flag - if migration is complete, never run again
        const alreadyComplete = await this.isMigrationComplete();
        if (alreadyComplete) {
            console.log('[Gamification] Migration already complete (Firestore flag)');
            return false;
        }
        
        // Only check individual users if global flag not set
        const needsMigration = users.some(u => !u.gamification?.migrated);
        
        if (needsMigration) {
            console.log('[Gamification] Users need migration, triggering...');
            await this.triggerMigration();
            return true;
        }
        
        // All users are migrated but flag wasn't set - set it now
        console.log('[Gamification] All users migrated, setting completion flag');
        try {
            await firebase.firestore().collection('settings').doc('gamification').set({
                migrationComplete: true,
                migrationDate: new Date().toISOString(),
                usersMigrated: users.length
            }, { merge: true });
        } catch (error) {
            console.warn('[Gamification] Could not set migration flag:', error);
        }
        
        return false;
    }
};

// Make available globally
window.GamificationService = GamificationService;
