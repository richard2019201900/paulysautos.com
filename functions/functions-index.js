/**
 * PaulysAutos.com - Firebase Cloud Functions
 *
 * Deploy with: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ==================== LEADERBOARD ====================
/**
 * Get leaderboard data - returns sanitized user data (no emails exposed)
 * Called from client via: functions.httpsCallable('getLeaderboard')
 */
exports.getLeaderboard = functions.https.onCall(async (data, context) => {
    try {
        const limit = data.limit || 10;

        // Query users with gamification data, sorted by XP
        const usersSnapshot = await db.collection('users')
            .orderBy('gamification.xp', 'desc')
            .limit(limit)
            .get();

        if (usersSnapshot.empty) {
            return { success: true, leaderboard: [] };
        }

        const leaderboard = [];
        let rank = 1;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const gamification = userData.gamification || {};

            // Only include users with XP
            if (gamification.xp > 0) {
                leaderboard.push({
                    odbc: doc.id, // Obfuscated document ID (not email)
                    username: userData.username || userData.displayName || 'Anonymous',
                    xp: gamification.xp || 0,
                    level: gamification.level || 1,
                    title: getLevelTitle(gamification.level || 1),
                    icon: getLevelIcon(gamification.level || 1),
                    tier: userData.tier || 'starter',
                    rank: rank++,
                    createdAt: userData.createdAt || null,
                    activityLog: (gamification.activityLog || []).slice(0, 10) // Last 10 activities
                });
            }
        });

        return { success: true, leaderboard };

    } catch (error) {
        console.error('[getLeaderboard] Error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch leaderboard');
    }
});

// ==================== GAMIFICATION MIGRATION ====================
/**
 * Migrate all users to gamification system
 * Adds gamification object to users who don't have it
 */
exports.migrateAllUsersToGamification = functions.https.onCall(async (data, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    // Verify caller is master admin
    const callerEmail = context.auth.token.email;
    if (callerEmail !== 'pauly@pma.network') {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    try {
        const usersSnapshot = await db.collection('users').get();
        const batch = db.batch();
        let migratedCount = 0;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();

            // Skip if already has gamification
            if (userData.gamification?.migrated) {
                return;
            }

            // Calculate initial XP based on existing activity
            let initialXP = 100; // Signup bonus
            const activityLog = [{
                type: 'signup',
                xp: 100,
                reason: 'Account created',
                timestamp: userData.createdAt || new Date().toISOString()
            }];

            // Add XP for display name / username
            if (userData.displayName || userData.username) {
                initialXP += 50;
                activityLog.push({
                    type: 'display_name',
                    xp: 50,
                    reason: 'Added display name',
                    timestamp: userData.createdAt || new Date().toISOString()
                });
            }

            // Add XP for phone number
            if (userData.phone) {
                initialXP += 150;
                activityLog.push({
                    type: 'phone_added',
                    xp: 150,
                    reason: 'Added phone number',
                    timestamp: userData.createdAt || new Date().toISOString()
                });
            }

            // Calculate level from XP
            const level = calculateLevel(initialXP);

            // Set gamification data
            batch.update(doc.ref, {
                'gamification': {
                    xp: initialXP,
                    level: level,
                    activityLog: activityLog,
                    achievements: ['signup'],
                    migrated: true,
                    migratedAt: new Date().toISOString()
                }
            });

            migratedCount++;
        });

        // Commit batch
        if (migratedCount > 0) {
            await batch.commit();
        }

        // Set migration complete flag
        await db.collection('settings').doc('gamification').set({
            migrationComplete: true,
            migrationDate: new Date().toISOString(),
            usersMigrated: migratedCount
        }, { merge: true });

        console.log(`[Migration] Migrated ${migratedCount} users to gamification`);

        return {
            success: true,
            migratedCount,
            message: `Successfully migrated ${migratedCount} users`
        };

    } catch (error) {
        console.error('[migrateAllUsersToGamification] Error:', error);
        throw new functions.https.HttpsError('internal', 'Migration failed');
    }
});

// ==================== USER SYNC ====================
/**
 * Sync Firebase Auth user to Firestore on creation
 * Triggered when a new user signs up
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    try {
        const userRef = db.collection('users').doc(user.uid);

        // Check if user doc already exists
        const existingDoc = await userRef.get();
        if (existingDoc.exists) {
            console.log(`[onUserCreated] User ${user.uid} already exists in Firestore`);
            return null;
        }

        // Create user document with initial gamification
        const userData = {
            email: user.email,
            username: user.displayName || '',
            displayName: user.displayName || '',
            createdAt: new Date().toISOString(),
            tier: 'starter',
            gamification: {
                xp: 100,
                level: 1,
                activityLog: [{
                    type: 'signup',
                    xp: 100,
                    reason: 'Welcome to PaulysAutos!',
                    timestamp: new Date().toISOString()
                }],
                achievements: ['signup'],
                migrated: true
            }
        };

        await userRef.set(userData);
        console.log(`[onUserCreated] Created Firestore doc for user ${user.uid}`);

        return null;

    } catch (error) {
        console.error('[onUserCreated] Error:', error);
        return null;
    }
});

// ==================== HELPER FUNCTIONS ====================

function calculateLevel(xp) {
    const levels = [
        { level: 1, xp: 0 },
        { level: 2, xp: 300 },
        { level: 3, xp: 750 },
        { level: 4, xp: 1500 },
        { level: 5, xp: 3000 },
        { level: 6, xp: 5000 },
        { level: 7, xp: 8000 },
        { level: 8, xp: 12000 },
        { level: 9, xp: 18000 },
        { level: 10, xp: 25000 }
    ];

    let result = 1;
    for (const l of levels) {
        if (xp >= l.xp) {
            result = l.level;
        } else {
            break;
        }
    }
    return result;
}

function getLevelTitle(level) {
    const titles = {
        1: 'Newcomer',
        2: 'Driver',
        3: 'Enthusiast',
        4: 'Collector',
        5: 'Dealer',
        6: 'Mogul',
        7: 'Tycoon',
        8: 'Elite',
        9: 'Legend',
        10: 'Icon'
    };
    return titles[level] || 'Newcomer';
}

function getLevelIcon(level) {
    const icons = {
        1: '🚗',
        2: '🚙',
        3: '🏎️',
        4: '🚘',
        5: '🏁',
        6: '💎',
        7: '👑',
        8: '🌟',
        9: '🔥',
        10: '🏆'
    };
    return icons[level] || '🚗';
}
