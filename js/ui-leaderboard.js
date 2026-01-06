// ============================================================
// GAMIFICATION & LEADERBOARD UI FUNCTIONS
// Extracted from ui.js for better code organization
// Uses Cloud Functions for secure data access (no email exposure)
// ============================================================

// Render the leaderboard page using Cloud Function (secure - no emails exposed)
window.renderLeaderboardPage = async function() {
    const listContainer = $('leaderboardList');
    const userRankCard = $('userRankCard');
    const loginPrompt = $('leaderboardLoginPrompt');
    
    if (!listContainer) return;
    
    // Must be logged in to view leaderboard
    if (!auth.currentUser) {
        listContainer.innerHTML = '';
        hideElement(userRankCard);
        showElement(loginPrompt);
        return;
    }
    
    // Show Coming Soon message until Cloud Function is deployed
    listContainer.innerHTML = `
        <div class="p-12 text-center">
            <div class="text-6xl mb-4">🏆</div>
            <h3 class="text-2xl font-bold text-amber-400 mb-2">Leaderboard Coming Soon!</h3>
            <p class="text-gray-400 mb-4">We're setting up the competitive rankings system.</p>
            <p class="text-gray-500 text-sm">Earn XP by listing vehicles and completing sales to climb the ranks!</p>
            <div class="mt-6 p-4 bg-gray-800/50 rounded-xl inline-block">
                <p class="text-sm text-gray-400">XP Rewards:</p>
                <ul class="text-xs text-gray-500 mt-2 space-y-1 text-left">
                    <li>🚗 +500 XP - List a vehicle</li>
                    <li>💰 +1000 XP - Complete your first sale</li>
                    <li>🏆 +500 XP - Each additional sale</li>
                    <li>👑 +250 XP - Feature a premium listing</li>
                </ul>
            </div>
        </div>
    `;
    
    // Hide user rank card for now
    if (userRankCard) hideElement(userRankCard);
    if (loginPrompt) hideElement(loginPrompt);
    
    return; // Skip Cloud Function call until it's deployed
    
    /* ORIGINAL CODE - UNCOMMENT WHEN CLOUD FUNCTION IS DEPLOYED
    // Show loading
    listContainer.innerHTML = '<div class="p-8 text-center text-gray-400"><div class="animate-pulse">Loading leaderboard...</div></div>';
    
    // Track expanded state
    window.expandedLeaderboardProfiles = window.expandedLeaderboardProfiles || {};
    
    try {
        // Call Cloud Function for secure leaderboard data (no emails exposed)
        const getLeaderboard = functions.httpsCallable('getLeaderboard');
        const result = await getLeaderboard({ limit: 10 });
        
        if (!result.data.success) {
            throw new Error('Failed to fetch leaderboard');
        }
        
        const leaderboard = result.data.leaderboard;
        
        if (leaderboard.length === 0) {
            listContainer.innerHTML = '<div class="p-8 text-center text-gray-400">No rankings yet. Be the first to compete!</div>';
            return;
        }
        
        // Render leaderboard with expandable profiles
        listContainer.innerHTML = leaderboard.map((entry, index) => {
            const isTop3 = index < 3;
            const medalIcons = ['🥇', '🥈', '🥉'];
            const medal = isTop3 ? medalIcons[index] : '';
            const bgClass = isTop3 ? 'bg-gradient-to-r from-amber-900/20 to-yellow-900/20' : '';
            
            // Check if this is the current user by document ID
            const isCurrentUser = entry.odbc === auth.currentUser?.uid;
            const highlightClass = isCurrentUser ? 'ring-2 ring-purple-500/50' : '';
            const isExpanded = window.expandedLeaderboardProfiles[entry.odbc];
            
            // Calculate XP breakdown from activity log
            const xpBreakdown = calculateXPBreakdown(entry.activityLog);
            
            // Format member since date
            const memberSince = entry.createdAt ? formatMemberSince(entry.createdAt) : 'Unknown';
            
            // Get last 10 activities
            const recentActivities = (entry.activityLog || []).slice(0, 10);
            
            return `
                <div class="border-b border-gray-700/50 last:border-b-0">
                    <!-- Main Row (clickable) -->
                    <div class="flex items-center justify-between p-4 ${bgClass} ${highlightClass} hover:bg-gray-700/30 transition cursor-pointer"
                         onclick="toggleLeaderboardProfile('${entry.odbc}')">
                        <div class="flex items-center gap-4">
                            <div class="w-10 text-center">
                                ${medal ? `<span class="text-2xl">${medal}</span>` : `<span class="text-gray-500 font-bold">#${entry.rank}</span>`}
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-2xl">${entry.icon}</span>
                                <div>
                                    <div class="text-white font-bold">${escapeHtmlSafe(entry.username)}${isCurrentUser ? ' <span class="text-purple-400 text-xs">(You)</span>' : ''}</div>
                                    <div class="text-gray-400 text-sm">${entry.title}</div>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-4">
                            <div class="text-right">
                                <div class="text-amber-400 font-bold">${entry.xp.toLocaleString()} XP</div>
                                <div class="text-gray-500 text-sm">Level ${entry.level}</div>
                            </div>
                            <svg class="w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </div>
                    </div>
                    
                    <!-- Expanded Details (accordion) -->
                    <div id="leaderboardProfile-${entry.odbc}" class="${isExpanded ? '' : 'hidden'} bg-gray-800/50 border-t border-gray-700/50 p-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Left Column: Stats -->
                            <div class="space-y-4">
                                <!-- Member Info -->
                                <div class="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                                    <h4 class="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                        Profile
                                    </h4>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between">
                                            <span class="text-gray-400">Member Since</span>
                                            <span class="text-white">${memberSince}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-400">Tier</span>
                                            <span class="text-${getTierColor(entry.tier)}">${getTierDisplay(entry.tier)}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-400">Rank</span>
                                            <span class="text-amber-400 font-bold">#${entry.rank} of all users</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- XP Breakdown -->
                                <div class="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                                    <h4 class="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                                        XP Breakdown
                                    </h4>
                                    ${xpBreakdown.length > 0 ? `
                                        <div class="space-y-2">
                                            ${xpBreakdown.map(cat => `
                                                <div class="flex justify-between text-sm">
                                                    <span class="text-gray-400">${cat.category}</span>
                                                    <span class="text-${cat.amount >= 0 ? 'green' : 'red'}-400 font-medium">${cat.amount >= 0 ? '+' : ''}${cat.amount.toLocaleString()} XP</span>
                                                </div>
                                            `).join('')}
                                            <div class="border-t border-gray-700 pt-2 mt-2 flex justify-between text-sm font-bold">
                                                <span class="text-gray-300">Total</span>
                                                <span class="text-amber-400">${entry.xp.toLocaleString()} XP</span>
                                            </div>
                                        </div>
                                    ` : `
                                        <p class="text-gray-500 text-sm">No activity breakdown available yet</p>
                                    `}
                                </div>
                            </div>
                            
                            <!-- Right Column: Recent Activity -->
                            <div class="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                                <h4 class="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Recent Activity (Last 10)
                                </h4>
                                ${recentActivities.length > 0 ? `
                                    <div class="space-y-2 max-h-64 overflow-y-auto">
                                        ${recentActivities.map((act, actIndex) => `
                                            <div class="flex items-start gap-2 text-sm border-b border-gray-700/50 pb-2 last:border-0 group">
                                                <span class="${act.type === 'xp_gain' ? 'text-green-400' : 'text-red-400'} font-bold whitespace-nowrap">
                                                    ${act.amount >= 0 ? '+' : ''}${act.amount} XP
                                                </span>
                                                <div class="flex-1 min-w-0">
                                                    <div class="text-gray-300 truncate">${escapeHtmlSafe(act.reason || 'Activity')}</div>
                                                    <div class="text-gray-500 text-xs">${formatActivityTime(act.timestamp)}</div>
                                                </div>
                                                ${TierService.isMasterAdmin(auth.currentUser?.email) ? `
                                                    <button onclick="event.stopPropagation(); deleteActivityEntry('${entry.odbc}', ${actIndex});" 
                                                        class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 transition-opacity" 
                                                        title="Delete this activity entry">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                        </svg>
                                                    </button>
                                                ` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <p class="text-gray-500 text-sm">No recent activity logged yet</p>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add refresh button
        const refreshHtml = `
            <div class="p-4 border-t border-gray-700/50 text-center">
                <button onclick="renderLeaderboardPage()" class="text-gray-400 hover:text-white text-sm flex items-center gap-2 mx-auto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Refresh Leaderboard
                </button>
            </div>
        `;
        listContainer.innerHTML += refreshHtml;
        
        // Update user rank card
        await updateUserRankCard();
        hideElement(loginPrompt);
        
    } catch (error) {
        console.error('[Leaderboard] Error:', error);
        listContainer.innerHTML = '<div class="p-8 text-center text-red-400">Error loading leaderboard. Please refresh.</div>';
    }
};

// Toggle leaderboard profile expansion
window.toggleLeaderboardProfile = function(userId) {
    window.expandedLeaderboardProfiles = window.expandedLeaderboardProfiles || {};
    window.expandedLeaderboardProfiles[userId] = !window.expandedLeaderboardProfiles[userId];
    
    const profileEl = document.getElementById(`leaderboardProfile-${userId}`);
    if (profileEl) {
        profileEl.classList.toggle('hidden');
        
        // Rotate chevron
        const row = profileEl.previousElementSibling;
        const chevron = row?.querySelector('svg:last-of-type');
        if (chevron) {
            chevron.classList.toggle('rotate-180');
        }
    }
};

/**
 * Delete an activity entry from a user's activity log (Admin only)
 * @param {string} userId - The user's document ID
 * @param {number} activityIndex - Index of the activity in the array
 */
window.deleteActivityEntry = async function(userId, activityIndex) {
    // Verify admin
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        showToast('Admin access required', 'error');
        return;
    }
    
    try {
        // Get current activity log
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('User not found', 'error');
            return;
        }
        
        const userData = userDoc.data();
        const gamification = userData.gamification || {};
        const activityLog = gamification.activityLog || [];
        
        if (activityIndex < 0 || activityIndex >= activityLog.length) {
            showToast('Activity entry not found', 'error');
            return;
        }
        
        // Get the entry to show in confirmation
        const entry = activityLog[activityIndex];
        const reason = entry.reason || 'Activity';
        
        // Confirm deletion
        if (!confirm(`Delete this activity entry?\n\n"${reason}"\n\nThis will permanently remove this entry from the user's activity log.`)) {
            return;
        }
        
        // Remove the entry at the specified index
        activityLog.splice(activityIndex, 1);
        
        // Update Firestore
        await db.collection('users').doc(userId).update({
            'gamification.activityLog': activityLog
        });
        
        showToast('Activity entry deleted', 'success');
        console.log(`[Admin] Deleted activity entry ${activityIndex} for user ${userId}: "${reason}"`);
        
        // The real-time listener will automatically update the UI
        
    } catch (error) {
        console.error('[Admin] Error deleting activity entry:', error);
        showToast('Error deleting activity entry', 'error');
    }
};

// Calculate XP breakdown by category from activity log
function calculateXPBreakdown(activityLog) {
    if (!activityLog || activityLog.length === 0) return [];
    
    const categories = {};
    
    activityLog.forEach(act => {
        // Categorize by reason keywords
        let category = 'Other';
        const reason = (act.reason || '').toLowerCase();
        
        if (reason.includes('payment') || reason.includes('rent') || reason.includes('collected')) {
            category = '💰 Payments';
        } else if (reason.includes('listing') || reason.includes('property') || reason.includes('created')) {
            category = '🏠 Listings';
        } else if (reason.includes('profile') || reason.includes('username')) {
            category = '👤 Profile';
        } else if (reason.includes('premium')) {
            category = '👑 Premium';
        } else if (reason.includes('lease') || reason.includes('rto') || reason.includes('sale')) {
            category = '🤝 Transactions';
        } else if (reason.includes('level')) {
            category = '⭐ Achievements';
        }
        
        categories[category] = (categories[category] || 0) + (act.amount || 0);
    });
    
    // Convert to array and sort by absolute value
    return Object.entries(categories)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

// Format member since date
function formatMemberSince(createdAt) {
    if (!createdAt) return 'Unknown';
    
    try {
        let date;
        if (createdAt.toDate) {
            date = createdAt.toDate();
        } else if (typeof createdAt === 'string') {
            date = new Date(createdAt);
        } else {
            return 'Unknown';
        }
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return 'Unknown';
    }
}

// Format activity timestamp
function formatActivityTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return '';
    }
}

// Get tier color for display
function getTierColor(tier) {
    const colors = {
        'free': 'gray-400',
        'starter': 'gray-400',
        'premium': 'amber-400',
        'pro': 'amber-400',
        'elite': 'purple-400',
        'owner': 'rose-400'
    };
    return colors[tier] || 'gray-400';
}

// Get tier display name with icon
function getTierDisplay(tier) {
    const displays = {
        'free': '🆓 Free',
        'starter': '🆓 Starter',
        'premium': '👑 Premium',
        'pro': '👑 Pro',
        'elite': '💎 Elite',
        'owner': '🏆 Site Owner'
    };
    return displays[tier] || tier;
}

// Update the user rank card separately
async function updateUserRankCard() {
    const userRankCard = $('userRankCard');
    const loginPrompt = $('leaderboardLoginPrompt');
    
    const user = auth.currentUser;
    if (user && window.currentUserData?.gamification) {
        const gam = window.currentUserData.gamification;
        
        // Get rank via Cloud Function (secure)
        let userRank = '--';
        try {
            const getUserRank = functions.httpsCallable('getUserRank');
            const result = await getUserRank({ xp: gam.xp || 0 });
            if (result.data.success) {
                userRank = result.data.rank;
            }
        } catch (e) {
            console.warn('[Leaderboard] Could not fetch rank:', e.message);
        }
        
        const levelInfo = GamificationService.getLevelFromXP(gam.xp || 0);
        
        if ($('userRankPosition')) $('userRankPosition').textContent = `#${userRank}`;
        if ($('userRankName')) $('userRankName').textContent = window.currentUserData.username || window.currentUserData.displayName || user.email.split('@')[0];
        if ($('userRankIcon')) $('userRankIcon').textContent = levelInfo.icon;
        if ($('userRankTitleText')) $('userRankTitleText').textContent = levelInfo.title;
        if ($('userRankXP')) $('userRankXP').textContent = `${(gam.xp || 0).toLocaleString()} XP`;
        if ($('userRankLevel')) $('userRankLevel').textContent = `Level ${gam.level || 1}`;
        
        showElement(userRankCard);
        hideElement(loginPrompt);
    } else if (!user) {
        hideElement(userRankCard);
        showElement(loginPrompt);
    } else {
        hideElement(userRankCard);
        hideElement(loginPrompt);
    }
}

// No listener cleanup needed anymore - using Cloud Functions instead
window.cleanupLeaderboardListener = function() {
    // Legacy function - no-op since we no longer use real-time listeners
    console.log('[Leaderboard] Using Cloud Functions - no listener to cleanup');
};

// Render the XP widget in dashboard
window.renderGamificationWidget = function(userData) {
    const widget = $('gamificationWidget');
    if (!widget || !userData) return;
    
    const gam = userData.gamification;
    
    // If no gamification data, hide widget
    if (!gam) {
        hideElement(widget);
        return;
    }
    
    const levelInfo = GamificationService.getLevelFromXP(gam.xp || 0);
    const nextLevelXP = GamificationService.getNextLevelXP(levelInfo.level);
    const progressPercent = GamificationService.getProgressPercent(gam.xp || 0, levelInfo.level);
    
    // Update widget elements
    if ($('xpLevelIcon')) $('xpLevelIcon').textContent = levelInfo.icon;
    if ($('xpLevelTitle')) $('xpLevelTitle').textContent = levelInfo.title;
    if ($('xpLevelBadge')) $('xpLevelBadge').textContent = `(Level ${levelInfo.level})`;
    if ($('xpCurrentDisplay')) $('xpCurrentDisplay').textContent = `${(gam.xp || 0).toLocaleString()} XP`;
    
    if ($('xpNextLevel')) {
        if (nextLevelXP) {
            const xpNeeded = nextLevelXP - (gam.xp || 0);
            $('xpNextLevel').textContent = `${xpNeeded.toLocaleString()} XP to Level ${levelInfo.level + 1}`;
        } else {
            $('xpNextLevel').textContent = 'Max Level Reached!';
        }
    }
    
    if ($('xpProgressBar')) $('xpProgressBar').style.width = `${progressPercent}%`;
    
    // Get user rank (async)
    GamificationService.getUserRank(gam.xp || 0).then(rank => {
        if (rank && $('xpUserRank')) {
            $('xpUserRank').textContent = `Rank #${rank}`;
        }
    });
    
    // Show/hide free premium reward
    const rewardEl = $('freePremiumReward');
    if (rewardEl) {
        if (GamificationService.hasUnusedReward(userData, 'free_premium_week')) {
            showElement(rewardEl);
        } else {
            hideElement(rewardEl);
        }
    }
    
    showElement(widget);
};

// Show achievements modal
window.showAchievementsModal = function() {
    const modal = $('achievementsModal');
    const list = $('achievementsList');
    const countEl = $('achievementsCount');
    
    if (!modal || !list) return;
    
    const userData = window.currentUserData;
    const userAchievements = userData?.gamification?.achievements || {};
    
    const allAchievements = GamificationService.achievements;
    let earnedCount = 0;
    
    list.innerHTML = Object.entries(allAchievements).map(([id, achievement]) => {
        const earned = !!userAchievements[id];
        if (earned) earnedCount++;
        
        const earnedClass = earned ? 'border-amber-500/50 bg-amber-900/20' : 'border-gray-700 bg-gray-800/30 opacity-50';
        const checkmark = earned ? '<span class="absolute top-2 right-2 text-green-400">✓</span>' : '';
        
        return `
            <div class="relative rounded-xl p-4 border ${earnedClass}">
                ${checkmark}
                <div class="text-3xl mb-2">${achievement.icon}</div>
                <div class="text-white font-bold text-sm">${achievement.name}</div>
                <div class="text-gray-400 text-xs">${achievement.description}</div>
            </div>
        `;
    }).join('');
    
    if (countEl) {
        countEl.textContent = `${earnedCount} / ${Object.keys(allAchievements).length}`;
    }
    
    showElement(modal);
};

// Show level up modal
window.showLevelUpModal = function(levelInfo) {
    const modal = $('levelUpModal');
    if (!modal) return;
    
    if ($('levelUpIcon')) $('levelUpIcon').textContent = levelInfo.icon;
    if ($('levelUpNewLevel')) $('levelUpNewLevel').textContent = `Level ${levelInfo.level}`;
    if ($('levelUpNewTitle')) $('levelUpNewTitle').textContent = levelInfo.title;
    
    // Show reward notification for level 5
    const rewardEl = $('levelUpReward');
    if (rewardEl) {
        if (levelInfo.level === 5) {
            showElement(rewardEl);
        } else {
            hideElement(rewardEl);
        }
    }
    
    showElement(modal);
};

// Close level up modal
window.closeLevelUpModal = function() {
    hideElement($('levelUpModal'));
};

// Setup celebration listener
window.setupCelebrationListener = function() {
    db.collection('settings').doc('celebrations').onSnapshot(doc => {
        if (!doc.exists) return;
        
        const data = doc.data();
        const active = data.active || [];
        
        // Filter to non-expired, non-dismissed celebrations
        const now = new Date();
        const validCelebrations = active.filter(cel => {
            if (!cel.expiresAt) return false;
            if (new Date(cel.expiresAt) < now) return false;
            
            // Check if user dismissed this one via UserPreferencesService
            const dismissedKey = `dismissed_${cel.id}`;
            if (window.UserPreferencesService && UserPreferencesService.isNotificationDismissed(dismissedKey)) {
                return false;
            }
            
            return true;
        });
        
        if (validCelebrations.length > 0) {
            // Show most recent celebration
            const latest = validCelebrations[validCelebrations.length - 1];
            showCelebrationBanner(latest);
        } else {
            hideCelebrationBanner();
        }
    }, error => {
        console.log('[Celebrations] Listener error (may not have doc yet):', error.message);
    });
};

// Show celebration banner
window.showCelebrationBanner = function(celebration) {
    const container = $('celebrationBannerContainer');
    const iconEl = $('celebrationIcon');
    const textEl = $('celebrationText');
    
    if (!container || !iconEl || !textEl) return;
    
    iconEl.textContent = celebration.icon || '🎉';
    textEl.textContent = `${celebration.userName} ${celebration.message}`;
    
    // Store current celebration ID for dismissal
    container.dataset.celebrationId = celebration.id;
    
    showElement(container);
    
    // Add padding to body to account for banner
    document.body.style.paddingTop = '48px';
};

// Hide celebration banner
window.hideCelebrationBanner = function() {
    const container = $('celebrationBannerContainer');
    if (container) {
        hideElement(container);
        document.body.style.paddingTop = '0';
    }
};

// Dismiss celebration (user clicked X)
window.dismissCelebration = function() {
    const container = $('celebrationBannerContainer');
    if (!container) return;
    
    const celebrationId = container.dataset.celebrationId;
    if (celebrationId) {
        // Save dismissal to Firestore via UserPreferencesService
        if (window.UserPreferencesService) {
            UserPreferencesService.dismissNotification(`dismissed_${celebrationId}`);
        }
    }
    
    hideCelebrationBanner();
};

// ============================================================
// SHARED UTILITY FUNCTIONS
// ============================================================

// Escape HTML for safe rendering (module-local version)
function escapeHtmlSafe(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Also expose globally for other modules
window.escapeHtml = window.escapeHtml || escapeHtmlSafe;

console.log('[UI-Leaderboard] Module loaded');
