/**
 * ============================================================================
 * UI ADMIN USERS - Admin user management functionality
 * ============================================================================
 * 
 * CONTENTS:
 * - Subscription tracking/editing
 * - Subscription reminders
 * - Admin user field updates
 * - Owner profile sync
 * - Admin delete user
 * - Orphan property
 * - Property reassignment
 * - Complete property deletion
 * - Admin create user
 * - Upgrade history
 * - Admin upgrade/downgrade user
 * - Trial conversion
 * - Copy utilities (phone, premium reminder)
 * - Premium payment recording
 * - Export CSV
 * - Find user by property
 * - Batch sync owner profiles
 * 
 * DEPENDENCIES: TierService, PropertyDataService, OwnershipService
 * ============================================================================
 */

// ==================== SUBSCRIPTION TRACKING ====================

// Edit subscription last paid date - opens inline date picker
window.editSubscriptionDate = function(userId, email, currentDate) {
    // Find the user card and subscription section
    const userCard = document.querySelector(`[data-userid="${userId}"]`);
    if (!userCard) return;
    
    const lastPaidSpan = userCard.querySelector('.sub-last-paid');
    if (!lastPaidSpan) return;
    
    // Create inline date picker
    const today = new Date().toISOString().split('T')[0];
    const escapedEmail = email.replace(/'/g, "\\'");
    lastPaidSpan.innerHTML = `
        <input type="date" 
               id="subDatePicker_${userId}" 
               value="${currentDate || today}"
               max="${today}"
               class="bg-gray-700 text-white px-2 py-1 rounded border border-cyan-500 text-xs">
        <button onclick="confirmSubscriptionDate('${userId}', '${escapedEmail}')" 
                class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs ml-1">✓</button>
        <button onclick="loadAllUsers()" 
                class="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs">✗</button>
    `;
    
    // Focus the date picker
    const input = $(`subDatePicker_${userId}`);
    if (input) {
        input.focus();
        input.showPicker?.(); // Opens the native date picker if supported
    }
};

// Confirm and save the subscription date
window.confirmSubscriptionDate = async function(userId, email) {
    const input = $(`subDatePicker_${userId}`);
    if (!input) return;
    
    const date = input.value;
    await saveSubscriptionDate(userId, email, date);
};

// Save subscription date to Firestore
window.saveSubscriptionDate = async function(userId, email, date) {
    try {
        await db.collection('users').doc(userId).update({
            subscriptionLastPaid: date || '',
            subscriptionUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Show success toast
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl z-[60] flex items-center gap-2';
        toast.innerHTML = `<span class="text-lg">✅</span> Payment date saved for ${email.split('@')[0]}!`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
        
        // Update local cache and re-render
        if (window.adminUsersData) {
            const userIndex = window.adminUsersData.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                window.adminUsersData[userIndex].subscriptionLastPaid = date;
            }
        }
        
        // Re-render the user list
        loadAllUsers();
        
    } catch (error) {
        console.error('Error saving subscription date:', error);
        // Show error toast
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl z-[60] flex items-center gap-2';
        toast.innerHTML = `<span class="text-lg">❌</span> Failed to save: ${error.message}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Edit subscription amount for a user
window.editSubscriptionAmount = async function(userId, email, currentAmount) {
    const newAmount = prompt(
        `Edit subscription amount for ${email}\n\n` +
        `Current amount: $${(currentAmount/1000).toFixed(0)}k/month\n\n` +
        `Enter new amount in dollars (e.g., 25000 for $25k):`,
        currentAmount
    );
    
    if (newAmount === null) return;
    
    const amount = parseInt(newAmount);
    if (isNaN(amount) || amount < 0) {
        alert('Invalid amount. Please enter a positive number.');
        return;
    }
    
    // Determine if this is a prorated amount
    const isProrated = amount < 50000 && amount > 0;
    
    try {
        await db.collection('users').doc(userId).update({
            subscriptionAmount: amount,
            isProratedUpgrade: isProrated,
            subscriptionUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Log to activity
        logAdminActivity('payment_adjustment', {
            email: email,
            previousAmount: currentAmount,
            newAmount: amount,
            adjustedBy: auth.currentUser?.email
        });
        
        showToast(`Subscription amount updated to $${(amount/1000).toFixed(0)}k for ${email.split('@')[0]}`, 'success');
        loadAllUsers();
        loadActivityLog();
    } catch (error) {
        console.error('Error updating subscription amount:', error);
        alert('Error: ' + error.message);
    }
};

// Open subscription reminder modal with editable text
window.openSubscriptionReminderModal = function(userId, email, displayName, tier, price, daysUntilDue) {
    const tierName = tier === 'pro' ? 'Pro ⭐' : 'Elite 👑';
    const tierEmoji = tier === 'pro' ? '⭐' : '👑';
    const benefits = tier === 'pro' ? '3 property listings' : 'Unlimited property listings';
    
    // Determine reminder type based on days until due
    let reminderType, reminderTitle, reminderBg;
    
    if (daysUntilDue === null || daysUntilDue === undefined) {
        reminderType = 'never_paid';
        reminderTitle = '🚨 NEVER PAID - First Payment Needed';
        reminderBg = 'bg-red-900/50 border-red-500';
    } else if (daysUntilDue < 0) {
        reminderType = 'overdue';
        reminderTitle = `🚨 OVERDUE by ${Math.abs(daysUntilDue)} days`;
        reminderBg = 'bg-red-900/50 border-red-500';
    } else if (daysUntilDue === 0) {
        reminderType = 'due_today';
        reminderTitle = '⚠️ DUE TODAY';
        reminderBg = 'bg-orange-900/50 border-orange-500';
    } else if (daysUntilDue <= 3) {
        reminderType = 'due_soon';
        reminderTitle = `⚠️ Due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`;
        reminderBg = 'bg-orange-900/50 border-orange-500';
    } else if (daysUntilDue <= 7) {
        reminderType = 'upcoming';
        reminderTitle = `📆 Due in ${daysUntilDue} days`;
        reminderBg = 'bg-yellow-900/30 border-yellow-600';
    } else {
        reminderType = 'normal';
        reminderTitle = `✅ ${daysUntilDue} days until due`;
        reminderBg = 'bg-green-900/30 border-green-600';
    }
    
    // Generate contextual payment reminder - TEXT MESSAGE FRIENDLY (no formatting)
    let paymentScript = '';
    if (daysUntilDue === null || daysUntilDue === undefined) {
        // Never paid
        paymentScript = `Hey ${displayName}! 👋 Welcome to PaulysAutos.com ${tierName}! We're excited to have you on board. Just a quick note - we haven't received your first subscription payment yet. 💰 ${price} for the ${tierName} plan which gives you ${benefits}. Let's meet up whenever you're free to get this sorted out. Looking forward to helping you grow your rental business! 🚗✨`;
    } else if (daysUntilDue < 0) {
        // Overdue
        paymentScript = `Hey ${displayName}, hope you're doing well! Just wanted to reach out - your PaulysAutos.com subscription is ${Math.abs(daysUntilDue)} days past due. 💰 Amount: ${price} for your ${tierName} plan. I want to make sure your listings stay active and visible to renters. Can we meet up soon to get this sorted? Let me know what works for you! 🙏`;
    } else if (daysUntilDue === 0) {
        // Due today
        paymentScript = `Hey ${displayName}! 👋 Quick reminder - your PaulysAutos.com ${tierName} subscription is due today! 💰 ${price} for the month. Are you free to meet up later? Let me know what time works and we can get this taken care of. Thanks for being a valued member! 🙏`;
    } else if (daysUntilDue <= 7) {
        // Due soon (1-7 days)
        paymentScript = `Hey ${displayName}! 👋 Just a friendly heads up - your PaulysAutos.com ${tierName} subscription payment is coming up in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}! 💰 ${price} for the month. No rush - just wanted to give you a heads up so we can plan to meet up. Let me know when you're available! 😊`;
    } else {
        // Not due yet (8+ days)
        paymentScript = `Hey ${displayName}! 👋 Just checking in! Your PaulysAutos.com ${tierName} subscription is all good - next payment isn't due for another ${daysUntilDue} days. 💰 ${price} | ${tierEmoji} ${tierName} | 📅 ${daysUntilDue} days left. No action needed right now. Just wanted to say thanks for being part of the platform! 🚗✨`;
    }
    
    // Generate upsell script - TEXT MESSAGE FRIENDLY
    let upsellScript = '';
    if (tier === 'pro') {
        upsellScript = `Hey ${displayName}! 🌟 I wanted to share something with you - I've noticed you're doing great with your ${benefits} on the Pro plan! Have you considered upgrading to Elite? Here's what you'd get: 👑 ELITE TIER - $50,000/month ✨ UNLIMITED property listings (no cap!) 🎯 Priority placement in search results 🏆 Elite badge on all your listings 💼 Perfect for scaling your rental empire. You're already at 2/3 listings on Pro. With Elite, you could list ALL your properties and really dominate the market here. The extra $25k/month pays for itself when you think about the additional rental income from more listings! Want to chat about upgrading? I can switch you over anytime. 🚀`;
    } else {
        // Already Elite - thank them instead
        upsellScript = `Hey ${displayName}! 👑 Just wanted to say THANK YOU for being an Elite member! You're one of our top property owners on PaulysAutos.com, and we really appreciate your business. 🏆 Elite Status with Unlimited Listings and Priority Placement - your properties are getting maximum visibility, and renters love what you're offering. If there's anything we can do to help you succeed even more, just let me know. We're here for you! Keep crushing it! 💪🚗`;
    }
    
    // Generate referral script - TEXT MESSAGE FRIENDLY
    const referralScript = `Hey ${displayName}! 🤝 Quick question - do you know any other property owners who might benefit from PaulysAutos.com? Here's the deal: 🎁 For every owner you refer who signs up for Pro or Elite, I'll give you a $5,000 credit toward your next subscription payment! It's a win-win - your friend gets a great platform for their rentals, you save money on your subscription, and more properties means more options for renters. Just have them mention your name when they sign up, and I'll apply the credit to your account. Know anyone who might be interested? 🚗💰`;
    
    // Create modal HTML with larger text areas
    const modalHTML = `
        <div id="subscriptionReminderModal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onclick="if(event.target === this) closeModal('subscriptionReminderModal')">
            <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-y-auto border ${reminderBg}">
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h2 class="text-xl font-bold text-white">${tierEmoji} ${displayName}</h2>
                            <p class="text-gray-400 text-sm">${email}</p>
                            <p class="text-lg font-bold mt-2 ${daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-400' : daysUntilDue !== null && daysUntilDue <= 3 ? 'text-orange-400' : 'text-green-400'}">${reminderTitle}</p>
                        </div>
                        <button onclick="closeModal('subscriptionReminderModal')" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                    </div>
                    
                    <div class="space-y-4">
                        <!-- Payment Reminder -->
                        <div class="bg-gray-700/50 rounded-xl p-4">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-cyan-400 font-bold">💰 Payment Reminder</span>
                                <button onclick="copySubscriptionScript('payment', '${displayName}')" class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-1.5 rounded font-bold">📋 Copy</button>
                            </div>
                            <textarea id="subScript_payment" class="w-full bg-gray-900 text-gray-300 text-sm p-4 rounded-lg border border-gray-600 resize-none" rows="5">${paymentScript}</textarea>
                        </div>
                        
                        <!-- Upsell / Thank You -->
                        <div class="bg-gray-700/50 rounded-xl p-4">
                            <div class="flex justify-between items-center mb-2">
                                <span class="${tier === 'pro' ? 'text-purple-400' : 'text-yellow-400'} font-bold">${tier === 'pro' ? '🚀 Upgrade to Elite' : '👑 VIP Thank You'}</span>
                                <button onclick="copySubscriptionScript('upsell', '${displayName}')" class="${tier === 'pro' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white px-4 py-1.5 rounded font-bold">📋 Copy</button>
                            </div>
                            <textarea id="subScript_upsell" class="w-full bg-gray-900 text-gray-300 text-sm p-4 rounded-lg border border-gray-600 resize-none" rows="5">${upsellScript}</textarea>
                        </div>
                        
                        <!-- Referral Program -->
                        <div class="bg-gray-700/50 rounded-xl p-4">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-green-400 font-bold">🤝 Referral Bonus</span>
                                <button onclick="copySubscriptionScript('referral', '${displayName}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded font-bold">📋 Copy</button>
                            </div>
                            <textarea id="subScript_referral" class="w-full bg-gray-900 text-gray-300 text-sm p-4 rounded-lg border border-gray-600 resize-none" rows="5">${referralScript}</textarea>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex justify-end">
                        <button onclick="closeModal('subscriptionReminderModal')" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-xl font-bold">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = $('subscriptionReminderModal');
    if (existingModal) existingModal.remove();
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Copy subscription script from modal
window.copySubscriptionScript = function(scriptType, displayName) {
    const textarea = $(`subScript_${scriptType}`);
    if (!textarea) return;
    
    const scriptLabels = {
        payment: '💰 Payment Reminder',
        upsell: '🚀 Upgrade/VIP Message',
        referral: '🤝 Referral Bonus'
    };
    
    navigator.clipboard.writeText(textarea.value).then(() => {
        // Show success toast
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl z-[60] flex items-center gap-2';
        toast.innerHTML = `<span class="text-lg">✅</span> ${scriptLabels[scriptType] || 'Message'} copied!`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Failed to copy. Please try manually.');
    });
};

// Check for overdue subscriptions and show alerts
window.checkSubscriptionAlerts = function() {
    if (!window.adminUsersData) return { overdue: [], dueSoon: [], neverPaid: [] };
    
    const overdueUsers = [];
    const dueSoonUsers = [];
    const neverPaidUsers = [];
    
    window.adminUsersData.forEach(user => {
        if (user.tier !== 'pro' && user.tier !== 'elite') return;
        if (TierService.isMasterAdmin(user.email)) return;
        
        const subLastPaid = user.subscriptionLastPaid;
        if (!subLastPaid) {
            // Never paid - track separately (don't trigger urgent alert)
            neverPaidUsers.push({
                name: user.username || user.email.split('@')[0],
                email: user.email,
                tier: user.tier
            });
            return;
        }
        
        // Parse date parts to avoid timezone shift
        const [year, month, day] = subLastPaid.split('-').map(Number);
        const lastDate = new Date(year, month - 1, day);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 30); // 30 days from last payment
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        nextDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilDue < 0) {
            overdueUsers.push({
                name: user.username || user.email.split('@')[0],
                email: user.email,
                tier: user.tier,
                daysOverdue: Math.abs(daysUntilDue)
            });
        } else if (daysUntilDue <= 3) {
            dueSoonUsers.push({
                name: user.username || user.email.split('@')[0],
                email: user.email,
                tier: user.tier,
                daysLeft: daysUntilDue
            });
        }
    });
    
    // Store for display
    window.overdueSubscriptions = overdueUsers;
    window.dueSoonSubscriptions = dueSoonUsers;
    window.neverPaidSubscriptions = neverPaidUsers;
    
    // Update subscription alert badge (include never-paid in count for attention)
    const attentionNeeded = overdueUsers.length + neverPaidUsers.length;
    updateSubscriptionAlertBadge(attentionNeeded, dueSoonUsers.length);
    
    return { overdue: overdueUsers, dueSoon: dueSoonUsers, neverPaid: neverPaidUsers };
};

// Update subscription alert badge on All Users tab
window.updateSubscriptionAlertBadge = function(overdueCount, dueSoonCount) {
    // Add badge to the All Users tab if there are issues
    const allUsersTab = document.querySelector('button[onclick*="switchAdminTab"][onclick*="users"]');
    if (!allUsersTab) return;
    
    // Remove existing badge
    const existingBadge = allUsersTab.querySelector('.sub-alert-badge');
    if (existingBadge) existingBadge.remove();
    
    if (overdueCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'sub-alert-badge bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2 animate-pulse';
        badge.textContent = `🚨 ${overdueCount}`;
        badge.title = `${overdueCount} overdue subscription(s)`;
        allUsersTab.appendChild(badge);
    } else if (dueSoonCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'sub-alert-badge bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2';
        badge.textContent = `⚠️ ${dueSoonCount}`;
        badge.title = `${dueSoonCount} subscription(s) due soon`;
        allUsersTab.appendChild(badge);
    }
};

// Show global subscription alert if there are overdue subscriptions (not just never-paid)
window.showSubscriptionAlert = function() {
    const { overdue, dueSoon, neverPaid } = checkSubscriptionAlerts();
    
    // Only show global alert for users who are actually past their due date
    // (not for never-paid users - those just show in the badge)
    if (overdue.length > 0) {
        const names = overdue.slice(0, 3).map(u => u.name).join(', ');
        const more = overdue.length > 3 ? ` +${overdue.length - 3} more` : '';
        
        showGlobalAlert(
            '🚨 Overdue Subscriptions!',
            `${names}${more} - Click to view`,
            'users'
        );
    }
};

window.updateAdminUserField = async function(userId, email, field, value) {
    try {
        await db.collection('users').doc(userId).update({
            [field]: value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Update cache and sync everywhere
        if (field === 'username') {
            window.ownerUsernameCache = window.ownerUsernameCache || {};
            window.ownerUsernameCache[email.toLowerCase()] = value;
            
            // If this is the current user, update nav and profile
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.email.toLowerCase() === email.toLowerCase()) {
                // Update nav display
                const navUserName = $('navUserName');
                if (navUserName) navUserName.textContent = value;
                
                // Update profile input
                const ownerUsername = $('ownerUsername');
                if (ownerUsername) ownerUsername.value = value;
            }
            
            // Update any property cards showing this owner
            syncOwnerNameEverywhere(email, value);
        }
    } catch (error) {
        console.error('Error updating user field:', error);
        alert('Error updating field: ' + error.message);
    }
};

// Sync owner name across all visible elements
window.syncOwnerNameEverywhere = function(email, newName) {
    const normalizedEmail = email.toLowerCase();
    
    // Update property cards with this owner
    document.querySelectorAll(`[data-owner-email="${normalizedEmail}"]`).forEach(el => {
        el.textContent = newName;
    });
    
    // Update any owner display elements
    document.querySelectorAll('.owner-name').forEach(el => {
        if (el.dataset.email?.toLowerCase() === normalizedEmail) {
            el.textContent = newName;
        }
    });
};

// ============================================================================
// ENTERPRISE: Sync Owner Profile to Properties
// ============================================================================
// Stores ownerDisplayName and ownerContactPhone on property documents
// This is CRITICAL for public visibility - Firestore security rules only allow
// users to read their own user doc, so we must store public info on properties
// ============================================================================

window.syncOwnerProfileToProperties = async function(email, displayName, phone) {
    if (!email) return;
    
    const normalizedEmail = email.toLowerCase();
    console.log('[ProfileSync] Syncing profile to properties for:', normalizedEmail);
    
    try {
        // Get all properties owned by this user
        const userProperties = typeof OwnershipService !== 'undefined' 
            ? OwnershipService.getPropertiesForOwner(normalizedEmail)
            : [];
        
        if (userProperties.length === 0) {
            console.log('[ProfileSync] No properties found for user');
            // Still update caches even if no properties
            if (displayName) {
                window.ownerUsernameCache = window.ownerUsernameCache || {};
                window.ownerUsernameCache[normalizedEmail] = displayName;
            }
            return;
        }
        
        // Build batch update for all properties
        const updates = {};
        userProperties.forEach(prop => {
            const propUpdate = { ...prop };
            
            // Only update fields that have values
            if (displayName) {
                propUpdate.ownerDisplayName = displayName;
            }
            if (phone) {
                propUpdate.ownerContactPhone = phone;
            }
            
            updates[prop.id] = propUpdate;
        });
        
        // Save to Firestore
        await db.collection('settings').doc('properties').set(updates, { merge: true });
        
        // Update local properties array
        userProperties.forEach(prop => {
            if (displayName) prop.ownerDisplayName = displayName;
            if (phone) prop.ownerContactPhone = phone;
        });
        
        // Update caches
        if (displayName) {
            window.ownerUsernameCache = window.ownerUsernameCache || {};
            window.ownerUsernameCache[normalizedEmail] = displayName;
        }
        
        console.log(`[ProfileSync] Updated ${userProperties.length} properties:`, {
            displayName: displayName || '(not updated)',
            phone: phone ? '***' + phone.slice(-4) : '(not updated)'
        });
        
        // Sync DOM elements
        syncOwnerNameEverywhere(normalizedEmail, displayName);
        
    } catch (error) {
        console.error('[ProfileSync] Error syncing profile to properties:', error);
    }
};

// Legacy alias for backwards compatibility
window.updateOwnerDisplayNameOnProperties = function(email, displayName) {
    return syncOwnerProfileToProperties(email, displayName, null);
};

window.adminDeleteUser = async function(userId, email) {
    // CRITICAL: Use OwnershipService for consistent property ownership
    const userProperties = OwnershipService.getPropertiesForOwner(email);
    const propertyCount = userProperties.length;
    
    // Build confirmation message
    let message = `⚠️ DELETE USER: ${email}\n\n`;
    
    if (propertyCount > 0) {
        message += `This user has ${propertyCount} propert${propertyCount > 1 ? 'ies' : 'y'}:\n`;
        userProperties.slice(0, 5).forEach((p, i) => {
            message += `  ${i + 1}. ${p.title}\n`;
        });
        if (propertyCount > 5) {
            message += `  ... and ${propertyCount - 5} more\n`;
        }
        message += `\nWhat would you like to do with their properties?\n\n`;
        message += `Click OK to DELETE properties too\n`;
        message += `Click Cancel to keep properties (unassigned)`;
    } else {
        message += `This user has no properties.\n\nContinue with deletion?`;
    }
    
    const deleteProperties = propertyCount > 0 ? confirm(message) : null;
    
    // If they clicked Cancel on property question, ask if they still want to delete user
    if (propertyCount > 0 && !deleteProperties) {
        if (!confirm(`Delete ${email} but KEEP their ${propertyCount} properties unassigned?\n\nClick OK to continue, Cancel to abort.`)) {
            return;
        }
    } else if (propertyCount === 0) {
        if (!confirm(message)) return;
    }
    
    try {
        if (deleteProperties && propertyCount > 0) {
            // Delete properties completely
            for (const prop of userProperties) {
                await deletePropertyCompletely(prop.id, email);
            }
        } else if (propertyCount > 0) {
            // Orphan properties - clear owner but keep property
            for (const prop of userProperties) {
                await orphanProperty(prop.id);
            }
        }
        
        // Delete user document from Firestore
        await db.collection('users').doc(userId).delete();
        
        // Delete from Firebase Auth using Cloud Function
        try {
            const deleteAuthUser = functions.httpsCallable('deleteAuthUser');
            const result = await deleteAuthUser({ email: email });
        } catch (authError) {
            console.warn('[Admin] Could not delete Auth user (Cloud Function may not be deployed):', authError.message);
            // Continue - Firestore deletion was successful
        }
        
        // Remove from ownerPropertyMap
        delete ownerPropertyMap[email.toLowerCase()];
        
        // Clear from username cache
        if (window.ownerUsernameCache) {
            delete window.ownerUsernameCache[email.toLowerCase()];
        }
        
        const resultMsg = deleteProperties && propertyCount > 0
            ? `✓ User ${email} and their ${propertyCount} properties deleted.`
            : `✓ User ${email} deleted.${propertyCount > 0 ? ` Their ${propertyCount} properties are now unassigned.` : ''}`;
        
        // Log to activity log
        logAdminActivity('deletion', {
            email: email,
            propertiesDeleted: deleteProperties ? propertyCount : 0,
            propertiesOrphaned: !deleteProperties ? propertyCount : 0,
            deletedBy: auth.currentUser?.email
        });
        
        alert(resultMsg);
        loadAllUsers();
        renderProperties(properties);
        loadActivityLog(); // Refresh activity log
        
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user: ' + error.message);
    }
};

// Helper to orphan a property (clear owner but keep property)
window.orphanProperty = async function(propertyId) {
    try {
        // Get the old owner email before clearing
        const prop = properties.find(p => p.id === propertyId);
        const oldOwnerEmail = prop?.ownerEmail;
        
        // Update property in memory
        if (prop) {
            prop.ownerEmail = null;
        }
        
        // Update in Firestore
        const propsDoc = await db.collection('settings').doc('properties').get();
        if (propsDoc.exists) {
            const propsData = propsDoc.data();
            if (propsData[propertyId]) {
                propsData[propertyId].ownerEmail = null;
                await db.collection('settings').doc('properties').set(propsData);
            }
        }
        
        // Clear from propertyOwnerEmail mapping if it exists
        if (typeof propertyOwnerEmail !== 'undefined' && propertyOwnerEmail[propertyId]) {
            delete propertyOwnerEmail[propertyId];
        }
        
        // Remove from ownerPropertyMap for the old owner
        if (oldOwnerEmail) {
            const lowerEmail = oldOwnerEmail.toLowerCase();
            if (ownerPropertyMap[lowerEmail]) {
                ownerPropertyMap[lowerEmail] = ownerPropertyMap[lowerEmail].filter(id => id !== propertyId);
            }
        }
        return true;
    } catch (error) {
        console.error(`Error orphaning property ${propertyId}:`, error);
        throw error;
    }
};

// ==================== ADMIN PROPERTY REASSIGNMENT ====================
// Store current property being reassigned
window.reassignPropertyId = null;

window.openReassignModal = async function(propertyId) {
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        alert('Only the owner can reassign properties');
        return;
    }
    
    window.reassignPropertyId = propertyId;
    const prop = properties.find(p => p.id === propertyId);
    
    if (!prop) {
        alert('Property not found');
        return;
    }
    
    // Set property title in modal
    $('reassignPropertyTitle').textContent = prop.title;
    
    // Clear previous state
    hideElement($('reassignError'));
    hideElement($('reassignSuccess'));
    $('reassignBtn').disabled = false;
    $('reassignBtn').textContent = '✓ Reassign Property';
    
    // Load users into dropdown
    const select = $('reassignOwnerSelect');
    select.innerHTML = '<option value="">-- Loading Users --</option>';
    
    try {
        const snapshot = await db.collection('users').get();
        select.innerHTML = '<option value="">-- Select Owner --</option><option value="unassigned">🚫 Unassigned (No Owner)</option>';
        
        snapshot.forEach(doc => {
            const user = doc.data();
            const tierData = TIERS[user.tier] || TIERS.starter;
            const displayName = user.username || user.email.split('@')[0];
            const option = document.createElement('option');
            option.value = user.email;
            option.textContent = `${tierData.icon} ${displayName} (${user.email})`;
            select.appendChild(option);
        });
        
        // Pre-select current owner if exists
        const currentOwnerEmail = prop.ownerEmail || getPropertyOwnerEmail(propertyId);
        if (currentOwnerEmail) {
            select.value = currentOwnerEmail;
        }
        
    } catch (error) {
        console.error('Error loading users:', error);
        select.innerHTML = '<option value="">-- Error Loading Users --</option>';
    }
    
    openModal('reassignModal');
};

window.confirmReassignProperty = async function() {
    const propertyId = window.reassignPropertyId;
    const newOwnerEmail = $('reassignOwnerSelect').value;
    const errorDiv = $('reassignError');
    const successDiv = $('reassignSuccess');
    const btn = $('reassignBtn');
    
    hideElement(errorDiv);
    hideElement(successDiv);
    
    if (!newOwnerEmail) {
        errorDiv.textContent = 'Please select an owner';
        showElement(errorDiv);
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Reassigning...';
    
    try {
        const prop = properties.find(p => p.id === propertyId);
        const oldOwnerEmail = prop?.ownerEmail || getPropertyOwnerEmail(propertyId);
        
        // Handle "unassigned" selection
        const actualNewEmail = newOwnerEmail === 'unassigned' ? null : newOwnerEmail.toLowerCase();
        
        // Fetch new owner's display name and phone for public display
        let ownerDisplayName = null;
        let ownerContactPhone = null;
        
        if (actualNewEmail) {
            try {
                const userSnapshot = await db.collection('users')
                    .where('email', '==', actualNewEmail)
                    .limit(1)
                    .get();
                
                if (!userSnapshot.empty) {
                    const userData = userSnapshot.docs[0].data();
                    // Prefer firstName + lastName, fallback to username
                    if (userData.firstName && userData.lastName) {
                        ownerDisplayName = userData.firstName + ' ' + userData.lastName;
                    } else if (userData.username) {
                        ownerDisplayName = userData.username;
                    } else {
                        ownerDisplayName = actualNewEmail.split('@')[0];
                    }
                    ownerContactPhone = userData.phone || null;
                }
            } catch (e) {
                console.log('[Reassign] Could not fetch new owner details:', e);
            }
        }
        
        // Update property in memory
        if (prop) {
            prop.ownerEmail = actualNewEmail;
            prop.ownerDisplayName = ownerDisplayName;
            prop.ownerContactPhone = ownerContactPhone;
        }
        
        // Update in Firestore
        const propsDoc = await db.collection('settings').doc('properties').get();
        if (propsDoc.exists) {
            const propsData = propsDoc.data();
            if (propsData[propertyId]) {
                propsData[propertyId].ownerEmail = actualNewEmail;
                propsData[propertyId].ownerDisplayName = ownerDisplayName;
                propsData[propertyId].ownerContactPhone = ownerContactPhone;
                await db.collection('settings').doc('properties').set(propsData);
            }
        }
        
        // Update propertyOwnerEmail mapping
        if (typeof propertyOwnerEmail !== 'undefined') {
            if (actualNewEmail) {
                propertyOwnerEmail[propertyId] = actualNewEmail;
            } else {
                delete propertyOwnerEmail[propertyId];
            }
        }
        
        // Remove from old owner's property list
        if (oldOwnerEmail) {
            const oldLower = oldOwnerEmail.toLowerCase();
            if (ownerPropertyMap[oldLower]) {
                ownerPropertyMap[oldLower] = ownerPropertyMap[oldLower].filter(id => id !== propertyId);
            }
        }
        
        // Add to new owner's property list (local cache only - will be rebuilt from properties)
        if (actualNewEmail) {
            if (!ownerPropertyMap[actualNewEmail]) {
                ownerPropertyMap[actualNewEmail] = [];
            }
            if (!ownerPropertyMap[actualNewEmail].includes(propertyId)) {
                ownerPropertyMap[actualNewEmail].push(propertyId);
            }
        }
        
        // Clear username cache for this property to force refresh
        if (window.ownerUsernameCache && oldOwnerEmail) {
            delete window.ownerUsernameCache[oldOwnerEmail.toLowerCase()];
        }
        if (window.ownerUsernameCache && actualNewEmail) {
            // Update cache with new display name
            window.ownerUsernameCache[actualNewEmail] = ownerDisplayName;
        }
        
        successDiv.textContent = '✓ Property reassigned successfully!';
        showElement(successDiv);
        btn.textContent = '✓ Done!';
        btn.classList.remove('from-purple-600', 'to-purple-700');
        btn.classList.add('from-green-600', 'to-green-700');
        
        // Refresh the property detail page after a short delay
        setTimeout(() => {
            closeModal('reassignModal');
            viewProperty(propertyId); // Reload property view
        }, 1500);
        
    } catch (error) {
        console.error('Error reassigning property:', error);
        errorDiv.textContent = 'Error: ' + error.message;
        showElement(errorDiv);
        btn.disabled = false;
        btn.textContent = '✓ Reassign Property';
    }
};

// Helper getPropertyOwnerEmail is defined in data.js - use that instead

// Helper to completely delete a property
window.deletePropertyCompletely = async function(propertyId, ownerEmail) {
    try {
        // Get property title before deletion for notification
        const prop = properties.find(p => p.id === propertyId);
        const propertyTitle = prop?.title || `Property ${propertyId}`;
        
        // Remove from properties array
        const index = properties.findIndex(p => p.id === propertyId);
        if (index !== -1) {
            properties.splice(index, 1);
        }
        
        // Remove from Firestore properties collection
        const propsDoc = await db.collection('settings').doc('properties').get();
        if (propsDoc.exists) {
            const propsData = propsDoc.data();
            if (propsData[propertyId]) {
                delete propsData[propertyId];
                await db.collection('settings').doc('properties').set(propsData);
            }
        }
        
        // Remove availability entry
        const availDoc = await db.collection('settings').doc('propertyAvailability').get();
        if (availDoc.exists) {
            const availData = availDoc.data();
            if (availData[propertyId] !== undefined) {
                delete availData[propertyId];
                await db.collection('settings').doc('propertyAvailability').set(availData);
            }
        }
        
        // Remove from state
        delete state.availability[propertyId];
        
        // Remove from owner map
        if (ownerEmail) {
            const lowerEmail = ownerEmail.toLowerCase();
            if (ownerPropertyMap[lowerEmail]) {
                ownerPropertyMap[lowerEmail] = ownerPropertyMap[lowerEmail].filter(id => id !== propertyId);
            }
            
            // CREATE DELETION NOTIFICATION on owner's user document
            // This triggers their existing user document listener for real-time sync
            const ownerSnapshot = await db.collection('users')
                .where('email', '==', lowerEmail)
                .get();
            
            if (!ownerSnapshot.empty) {
                const ownerDoc = ownerSnapshot.docs[0];
                await db.collection('users').doc(ownerDoc.id).update({
                    deletedProperty: {
                        propertyId: propertyId,
                        propertyTitle: propertyTitle,
                        deletedBy: auth.currentUser?.email || 'admin',
                        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        acknowledged: false
                    }
                });
            }
        }
        return true;
    } catch (error) {
        console.error(`Error deleting property ${propertyId}:`, error);
        throw error;
    }
};

// Admin Create User Form
document.addEventListener('DOMContentLoaded', function() {
    const form = $('adminCreateUserForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = $('adminNewEmail').value.trim().toLowerCase();
            const email = username + '@pma.network'; // Append domain
            const password = $('adminNewPassword').value;
            const displayName = $('adminNewDisplayName').value.trim();
            const tier = $('adminNewTier').value;
            const errorDiv = $('adminCreateUserError');
            const successDiv = $('adminCreateUserSuccess');
            const btn = $('adminCreateUserBtn');
            
            hideElement(errorDiv);
            hideElement(successDiv);
            
            btn.disabled = true;
            btn.textContent = 'Creating...';
            
            try {
                // Use Firebase Admin SDK workaround - create via secondary auth
                const result = await adminCreateUser(email, password, displayName, tier);
                
                successDiv.innerHTML = `✓ Account created!<br><strong>Username:</strong> ${username}@pma.network<br><strong>Password:</strong> ${password}<br><strong>Tier:</strong> ${tier}`;
                showElement(successDiv);
                
                // Clear form
                $('adminNewEmail').value = '';
                $('adminNewPassword').value = '';
                $('adminNewDisplayName').value = '';
                $('adminNewTier').value = 'starter';
                
                // Refresh users list
                loadAllUsers();
                
            } catch (error) {
                console.error('Error creating user:', error);
                errorDiv.textContent = error.message || 'Failed to create account.';
                showElement(errorDiv);
            } finally {
                btn.disabled = false;
                btn.textContent = '➕ Create Account';
            }
        });
    }
});

window.adminCreateUser = async function(email, password, displayName, tier) {
    let uid;
    
    // Try Cloud Function first (preferred method)
    try {
        const createAuthUser = functions.httpsCallable('createAuthUser');
        const result = await createAuthUser({ 
            email: email, 
            password: password, 
            displayName: displayName 
        });
        uid = result.data.uid;
    } catch (cfError) {
        console.warn('[Admin] Cloud Function not available, using secondary auth:', cfError.message);
        
        // Fallback: Create a secondary Firebase Auth instance
        const secondaryApp = firebase.apps.find(app => app.name === 'Secondary') || 
            firebase.initializeApp(firebase.app().options, 'Secondary');
        const secondaryAuth = secondaryApp.auth();
        
        try {
            const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
            uid = userCredential.user.uid;
            await secondaryAuth.signOut();
        } catch (authError) {
            try { await secondaryAuth.signOut(); } catch(e) {}
            throw authError;
        }
    }
    
    // Create user document in Firestore
    await db.collection('users').doc(uid).set({
        email: email.toLowerCase(),
        username: displayName,
        tier: tier,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser?.email || 'admin'
    });
    
    // Log to upgrade history if not starter
    if (tier !== 'starter') {
        await db.collection('upgradeHistory').add({
            userEmail: email.toLowerCase(),
            previousTier: 'starter',
            newTier: tier,
            upgradedAt: firebase.firestore.FieldValue.serverTimestamp(),
            upgradedBy: auth.currentUser?.email || 'admin',
            paymentNote: 'Account created by admin',
            price: tier === 'pro' ? 25000 : (tier === 'elite' ? 50000 : 0)
        });
    }
    
    return { uid: uid, email: email };
};

window.generateRandomPassword = function() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    $('adminNewPassword').value = password;
};

window.loadUpgradeHistory = async function() {
    const container = $('upgradeHistoryList');
    if (!container) return;
    
    container.innerHTML = '<p class="text-gray-500 italic">Loading history...</p>';
    
    // Check if current user is the master owner (not just any admin)
    const isMasterOwner = auth.currentUser?.email === 'richard2019201900@gmail.com';
    
    try {
        const history = await TierService.getUpgradeHistory();
        
        if (history.length === 0) {
            container.innerHTML = '<p class="text-gray-500 italic">No upgrade history found.</p>';
            return;
        }
        
        container.innerHTML = history.map(entry => {
            const prevTierData = TIERS[entry.previousTier] || TIERS.starter;
            const date = entry.upgradedAt?.toDate ? entry.upgradedAt.toDate().toLocaleString() : 'Unknown';
            const isDenial = entry.type === 'denial' || entry.newTier?.startsWith('DENIED:');
            
            // Handle denial entries differently
            let newTierDisplay;
            let priceDisplay;
            let borderColor = 'border-gray-700';
            
            if (isDenial) {
                const requestedTier = entry.newTier?.replace('DENIED: ', '') || 'unknown';
                const requestedTierData = TIERS[requestedTier] || { icon: '❓', name: requestedTier, color: 'text-gray-400' };
                newTierDisplay = `<span class="px-2 py-1 rounded bg-red-900/50 text-red-400">❌ Denied ${requestedTierData.icon} ${requestedTierData.name}</span>`;
                priceDisplay = '<span class="text-red-400 font-bold">$0</span>';
                borderColor = 'border-red-700/50';
            } else {
                const newTierData = TIERS[entry.newTier] || TIERS.starter;
                const isTrialEntry = entry.isFreeTrial === true;
                const trialBadge = isTrialEntry ? '<span class="px-2 py-0.5 rounded bg-cyan-600 text-white text-xs font-bold">🎁 TRIAL</span>' : '';
                newTierDisplay = `<span class="px-2 py-1 rounded bg-gray-700 ${newTierData.color}">${newTierData.icon} ${newTierData.name}</span> ${trialBadge}`;
                priceDisplay = isTrialEntry 
                    ? '<span class="text-cyan-400 font-bold">$0 <span class="text-xs">(trial)</span></span>' 
                    : (entry.price ? `<span class="text-green-400 font-bold">$${entry.price.toLocaleString()}</span>` : '<span class="text-gray-500">-</span>');
                
                // Different border for trials
                if (isTrialEntry) borderColor = 'border-cyan-700/50';
            }
            
            // Only master owner can delete history entries
            const deleteBtn = isMasterOwner ? `
                <button onclick="deleteUpgradeHistory('${entry.id}')" 
                    class="ml-2 text-red-400 hover:text-red-300 text-xs opacity-50 hover:opacity-100 transition"
                    title="Delete this entry">
                    🗑️
                </button>
            ` : '';
            
            return `
                <div id="history-${entry.id}" class="bg-gray-800 rounded-xl p-4 border ${borderColor}">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-white font-bold">${entry.userEmail}</span>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 text-sm">
                                <span class="px-2 py-1 rounded bg-gray-700 ${prevTierData.color}">${prevTierData.icon} ${prevTierData.name}</span>
                                <span class="text-gray-500">→</span>
                                ${newTierDisplay}
                                ${priceDisplay}
                            </div>
                            ${entry.paymentNote ? `<p class="text-gray-400 text-sm mt-1 italic">${entry.paymentNote}</p>` : ''}
                        </div>
                        <div class="text-right text-sm flex items-start gap-2">
                            <div>
                                <div class="text-gray-400">${date}</div>
                                <div class="text-gray-500 text-xs">by ${entry.upgradedBy || 'system'}</div>
                            </div>
                            ${deleteBtn}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading upgrade history:', error);
        container.innerHTML = '<p class="text-red-400">Error loading history.</p>';
    }
};

// Delete upgrade history entry (master owner only)
window.deleteUpgradeHistory = async function(entryId) {
    // Double-check permission
    if (auth.currentUser?.email !== 'richard2019201900@gmail.com') {
        alert('Only the master owner can delete history entries.');
        return;
    }
    
    if (!confirm('Delete this upgrade history entry? This cannot be undone.')) {
        return;
    }
    
    try {
        await db.collection('upgradeHistory').doc(entryId).delete();
        
        // Remove from UI with animation
        const entryEl = $(`history-${entryId}`);
        if (entryEl) {
            entryEl.style.transition = 'all 0.3s ease';
            entryEl.style.opacity = '0';
            entryEl.style.transform = 'translateX(20px)';
            setTimeout(() => entryEl.remove(), 300);
        }
    } catch (error) {
        console.error('Error deleting history entry:', error);
        alert('Error deleting entry: ' + error.message);
    }
};

window.adminUpgradeUser = async function(email, newTier, currentTier) {
    const tierData = TIERS[newTier];
    const price = newTier === 'pro' ? '$25,000' : '$50,000';
    
    // Show upgrade modal with trial option
    showUpgradeModal(email, newTier, currentTier, tierData, price);
};

// Show upgrade modal with trial checkbox
function showUpgradeModal(email, newTier, currentTier, tierData, price) {
    // Check if this is an upgrade from Pro to Elite (prorated eligible)
    const isProToElite = currentTier === 'pro' && newTier === 'elite';
    const proratedPrice = '$25,000'; // Difference between Elite ($50k) and Pro ($25k)
    
    // Create modal overlay
    const modalHTML = `
        <div id="upgradeModal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onclick="if(event.target.id === 'upgradeModal') closeUpgradeModal()">
            <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-700" onclick="event.stopPropagation()">
                <h3 class="text-xl font-bold text-white mb-4">⬆️ Upgrade User</h3>
                
                <div class="bg-gray-900/50 rounded-xl p-4 mb-4">
                    <p class="text-gray-300 mb-2"><strong>User:</strong> ${email}</p>
                    <p class="text-gray-300 mb-2"><strong>Current Tier:</strong> <span class="text-gray-400">${TIERS[currentTier]?.name || currentTier}</span></p>
                    <p class="text-gray-300"><strong>New Tier:</strong> <span class="${newTier === 'pro' ? 'text-purple-400' : 'text-yellow-400'} font-bold">${tierData.icon} ${tierData.name}</span></p>
                    <p class="text-gray-300"><strong>Standard Price:</strong> ${price}/month</p>
                </div>
                
                ${isProToElite ? `
                <!-- Prorated Upgrade Option (Pro → Elite) -->
                <div class="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/30 rounded-xl p-4 mb-4">
                    <label class="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" id="upgradeProratedCheckbox" class="w-5 h-5 rounded border-amber-500 text-amber-500 focus:ring-amber-500 cursor-pointer">
                        <div>
                            <span class="text-amber-300 font-bold">💰 Prorated Upgrade (${proratedPrice})</span>
                            <p class="text-amber-400/70 text-sm">User was already paying for Pro - only charge the $25k difference</p>
                        </div>
                    </label>
                </div>
                ` : ''}
                
                <!-- Free Trial Checkbox -->
                <div class="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-xl p-4 mb-4">
                    <label class="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" id="upgradeTrialCheckbox" class="w-5 h-5 rounded border-cyan-500 text-cyan-500 focus:ring-cyan-500 cursor-pointer">
                        <div>
                            <span class="text-cyan-300 font-bold">🎁 Free 1-Month Trial</span>
                            <p class="text-cyan-400/70 text-sm">Check this if this is a promotional trial upgrade (won't count as revenue)</p>
                        </div>
                    </label>
                </div>
                
                <!-- Notes Field -->
                <div class="mb-4">
                    <label class="block text-gray-400 text-sm mb-2">Payment/Notes:</label>
                    <input type="text" id="upgradeNotes" 
                           class="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                           placeholder="Payment confirmation or notes...">
                </div>
                
                <!-- Amount Display -->
                <div id="upgradeAmountDisplay" class="bg-gray-900/50 rounded-lg p-3 mb-4 text-center">
                    <span class="text-gray-400">Amount to collect: </span>
                    <span id="upgradeAmountValue" class="text-green-400 font-bold text-xl">${price}</span>
                </div>
                
                <!-- Buttons -->
                <div class="flex gap-3">
                    <button id="upgradeConfirmBtn" onclick="confirmUpgrade('${email}', '${newTier}', '${currentTier}')" 
                            class="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition">
                        ✓ Confirm Upgrade
                    </button>
                    <button id="upgradeCancelBtn" onclick="closeUpgradeModal()" 
                            class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners
    const trialCheckbox = $('upgradeTrialCheckbox');
    const proratedCheckbox = $('upgradeProratedCheckbox');
    const notesInput = $('upgradeNotes');
    const amountValue = $('upgradeAmountValue');
    
    // Function to update amount display
    const updateAmountDisplay = () => {
        const isTrial = trialCheckbox?.checked;
        const isProrated = proratedCheckbox?.checked;
        
        if (isTrial) {
            amountValue.textContent = '$0 (Trial)';
            amountValue.className = 'text-cyan-400 font-bold text-xl';
        } else if (isProrated) {
            amountValue.textContent = proratedPrice;
            amountValue.className = 'text-amber-400 font-bold text-xl';
        } else {
            amountValue.textContent = price;
            amountValue.className = 'text-green-400 font-bold text-xl';
        }
    };
    
    if (trialCheckbox) {
        trialCheckbox.addEventListener('change', function() {
            // Uncheck prorated if trial is checked
            if (this.checked && proratedCheckbox) {
                proratedCheckbox.checked = false;
            }
            
            if (this.checked) {
                const tierName = newTier === 'pro' ? 'Pro' : 'Elite';
                notesInput.value = `Enjoy a 30 day free trial of ${tierName} Membership on Pauly!`;
            } else {
                if (notesInput.value.includes('free trial')) {
                    notesInput.value = '';
                }
            }
            updateAmountDisplay();
        });
    }
    
    if (proratedCheckbox) {
        proratedCheckbox.addEventListener('change', function() {
            // Uncheck trial if prorated is checked
            if (this.checked && trialCheckbox) {
                trialCheckbox.checked = false;
                if (notesInput.value.includes('free trial')) {
                    notesInput.value = '';
                }
            }
            
            if (this.checked) {
                notesInput.value = `Prorated upgrade from Pro to Elite - paid $25k difference`;
            } else {
                if (notesInput.value.includes('Prorated')) {
                    notesInput.value = '';
                }
            }
            updateAmountDisplay();
        });
    }
}

window.closeUpgradeModal = function() {
    const modal = $('upgradeModal');
    if (modal) modal.remove();
};

window.confirmUpgrade = async function(email, newTier, currentTier) {
    const isTrial = $('upgradeTrialCheckbox')?.checked || false;
    const isProrated = $('upgradeProratedCheckbox')?.checked || false;
    const notes = $('upgradeNotes')?.value || '';
    const tierData = TIERS[newTier];
    
    // Calculate actual subscription amount
    let subscriptionAmount = newTier === 'pro' ? 25000 : 50000; // Standard prices
    if (isTrial) {
        subscriptionAmount = 0;
    } else if (isProrated && currentTier === 'pro' && newTier === 'elite') {
        subscriptionAmount = 25000; // Only the difference
    }
    
    // Show loading state on button
    const confirmBtn = $('upgradeConfirmBtn');
    const cancelBtn = $('upgradeCancelBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="animate-pulse">⏳ Upgrading...</span>';
        confirmBtn.classList.add('opacity-70', 'cursor-not-allowed');
    }
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    
    try {
        await TierService.setUserTier(email, newTier, currentTier, notes, isTrial);
        
        // Set subscription data including trial status and actual amount
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if (!snapshot.empty) {
            const userId = snapshot.docs[0].id;
            const today = new Date().toISOString().split('T')[0];
            
            // Calculate trial end date (30 days from now)
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);
            
            const updateData = {
                subscriptionLastPaid: today,
                subscriptionUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                isFreeTrial: isTrial,
                trialStartDate: isTrial ? today : null,
                trialEndDate: isTrial ? trialEndDate.toISOString().split('T')[0] : null,
                trialNotes: isTrial ? (notes || 'Free trial upgrade') : null,
                // NEW: Track actual subscription amount for prorated upgrades
                subscriptionAmount: subscriptionAmount,
                isProratedUpgrade: isProrated,
                proratedFrom: isProrated ? currentTier : null,
                upgradeNotes: notes || null
            };
            
            await db.collection('users').doc(userId).update(updateData);
            // CREATE USER NOTIFICATION so they see the upgrade in their dashboard
            const trialLabel = isTrial ? ' (Free Trial)' : '';
            const defaultMessage = isTrial 
                ? `Congratulations! You've been upgraded to ${tierData.name}${trialLabel}. Enjoy your free trial!`
                : `Congratulations! You've been upgraded to ${tierData.name}. Thank you for your subscription!`;
            
            await db.collection('userNotifications').add({
                userEmail: email.toLowerCase(),
                type: 'upgrade',
                title: `🎉 Welcome to ${tierData.name}!`,
                message: notes || defaultMessage,
                newTier: newTier,
                previousTier: currentTier,
                isTrial: isTrial,
                trialEndDate: isTrial ? trialEndDate.toISOString().split('T')[0] : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                read: false,
                dismissed: false
            });
        }
        
        // Show success briefly then close
        if (confirmBtn) {
            confirmBtn.innerHTML = '✓ Success!';
            confirmBtn.classList.remove('from-purple-600', 'to-pink-600');
            confirmBtn.classList.add('from-green-600', 'to-emerald-600');
        }
        
        // FORCE CLOSE - multiple methods to ensure it closes
        const closeIt = () => {
            try {
                const m = document.getElementById('upgradeModal');
                if (m) m.remove();
            } catch(e) { console.error('[Modal close error]', e); }
            try {
                document.querySelectorAll('[id="upgradeModal"]').forEach(el => el.remove());
            } catch(e) {}
            try {
                document.querySelectorAll('.fixed.inset-0.bg-black\\/80.z-50').forEach(el => {
                    if (el.innerHTML.includes('Upgrade User')) el.remove();
                });
            } catch(e) {}
        };
        
        // Try closing at multiple intervals
        setTimeout(closeIt, 500);
        setTimeout(closeIt, 800);
        setTimeout(closeIt, 1200);
        
        // Show toast and refresh users
        const trialMsg = isTrial ? ' (Trial)' : '';
        const proratedMsg = isProrated ? ` (Prorated: $${(subscriptionAmount/1000).toFixed(0)}k)` : '';
        showToast(`${email} upgraded to ${tierData.name}!${trialMsg}${proratedMsg}`, 'success');
        
        // Log to activity log
        logAdminActivity('upgrade', {
            email: email,
            previousTier: currentTier,
            newTier: newTier,
            isTrial: isTrial,
            isProrated: isProrated,
            amount: subscriptionAmount,
            upgradedBy: auth.currentUser?.email
        });
        
        // Refresh users list
        if (typeof loadAllUsers === 'function') {
            loadAllUsers();
        }
        
        // Refresh activity log
        if (typeof loadActivityLog === 'function') {
            loadActivityLog();
        }
        
    } catch (error) {
        console.error('Error upgrading user:', error);
        if (confirmBtn) {
            confirmBtn.innerHTML = '❌ Error - Try Again';
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'block';
        }
        alert('Error upgrading user: ' + error.message);
    }
};

// Convert a trial user to paid subscription
window.convertTrialToPaid = async function(userId, email) {
    if (!confirm(`Convert ${email} from FREE TRIAL to PAID subscription?\n\nThis will mark them as a paying customer and reset their subscription date to today.`)) return;
    
    const paymentNote = prompt('Enter payment confirmation details:');
    if (paymentNote === null) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        await db.collection('users').doc(userId).update({
            isFreeTrial: false,
            trialStartDate: null,
            trialEndDate: null,
            trialNotes: null,
            subscriptionLastPaid: today,
            subscriptionUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            convertedFromTrial: true,
            trialConvertedAt: firebase.firestore.FieldValue.serverTimestamp(),
            trialConversionNotes: paymentNote || 'Converted to paid'
        });
        
        // Log to activity log
        logAdminActivity('trial_conversion', {
            email: email,
            paymentNote: paymentNote,
            convertedBy: auth.currentUser?.email
        });
        
        alert(`✓ ${email} is now a PAID subscriber!\n\nSubscription date set to today.`);
        loadAllUsers();
        loadActivityLog(); // Refresh activity log
    } catch (error) {
        console.error('Error converting trial:', error);
        alert('Error: ' + error.message);
    }
};

// Mark a paid user as trial (for corrections/adjustments)
window.markAsTrial = async function(userId, email) {
    if (!confirm(`Mark ${email} as FREE TRIAL?\n\nThis will remove them from revenue calculations.`)) return;
    
    const reason = prompt('Reason for marking as trial (optional):');
    if (reason === null) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        
        await db.collection('users').doc(userId).update({
            isFreeTrial: true,
            trialStartDate: today,
            trialEndDate: trialEndDate.toISOString().split('T')[0],
            trialNotes: reason || 'Marked as trial by admin',
            subscriptionUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast(`${email} marked as FREE TRIAL`, 'success');
        loadAllUsers();
    } catch (error) {
        console.error('Error marking as trial:', error);
        alert('Error: ' + error.message);
    }
};

window.adminDowngradeUser = async function(email, currentTier, targetTier = 'starter') {
    const tierName = targetTier === 'pro' ? 'Pro' : 'Starter';
    const confirmMsg = targetTier === 'starter' 
        ? `Are you sure you want to reset ${email} to Starter tier?\n\nThis will also clear their subscription payment history and trial status.`
        : `Are you sure you want to downgrade ${email} to Pro tier?\n\nTheir subscription will be adjusted to $25,000/mo.`;
    
    if (!confirm(confirmMsg)) return;
    
    const reason = prompt('Reason for downgrade (optional):');
    if (reason === null) return;
    
    try {
        await TierService.setUserTier(email, targetTier, currentTier, `Downgraded to ${tierName}: ${reason || 'No reason given'}`);
        
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if (!snapshot.empty) {
            const userId = snapshot.docs[0].id;
            
            if (targetTier === 'starter') {
                // Clear subscription data AND trial data when downgrading to starter
                await db.collection('users').doc(userId).update({
                    subscriptionLastPaid: '',
                    subscriptionUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    subscriptionAmount: null,
                    isProratedUpgrade: false,
                    proratedFrom: null,
                    isFreeTrial: false,
                    trialStartDate: null,
                    trialEndDate: null,
                    trialNotes: null
                });
            } else if (targetTier === 'pro') {
                // Downgrading from Elite to Pro - keep subscription but adjust amount
                const today = new Date().toISOString().split('T')[0];
                await db.collection('users').doc(userId).update({
                    subscriptionUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    subscriptionAmount: 25000, // Pro price
                    isProratedUpgrade: false,
                    proratedFrom: null,
                    isFreeTrial: false,
                    trialStartDate: null,
                    trialEndDate: null,
                    trialNotes: null
                });
            }
        }
        
        // Log to activity log
        logAdminActivity('downgrade', {
            email: email,
            previousTier: currentTier,
            newTier: targetTier,
            reason: reason || 'No reason given',
            downgradedBy: auth.currentUser?.email
        });
        
        alert(`${email} downgraded to ${tierName} tier.`);
        loadAllUsers();
        loadActivityLog(); // Refresh activity log
    } catch (error) {
        console.error('Error downgrading user:', error);
        alert('Error: ' + error.message);
    }
};

// Copy phone number (digits only, no formatting)
window.copyPhoneNumber = function(phone) {
    // Strip all non-numeric characters
    const digitsOnly = (phone || '').replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(digitsOnly).then(() => {
        showToast('📱 Phone copied: ' + digitsOnly, 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = digitsOnly;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('📱 Phone copied: ' + digitsOnly, 'success');
    });
};

// Copy premium reminder message to clipboard - builds message from parameters
window.copyPremiumReminder = function(title, weeklyFee, nextDue) {
    // Decode HTML entities in title
    const decodedTitle = title.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    
    let message;
    if (nextDue === 'today' || nextDue === 'tomorrow' || nextDue.includes('overdue')) {
        message = `Hey! Your premium listing for "${decodedTitle}" is due ${nextDue}! Premium keeps you at the top of search results & featured section. $${weeklyFee.toLocaleString()} to keep the spotlight on your property! 👑🚗`;
    } else if (nextDue === 'not yet set') {
        message = `Hey! Just checking in on your premium listing for "${decodedTitle}". Premium listings get 3x more views and stay at the top! $${weeklyFee.toLocaleString()}/week to keep the momentum going! 👑`;
    } else {
        message = `Hey! Your premium listing for "${decodedTitle}" renewal is coming up ${nextDue}. Keep the momentum going - premium listings get 3x more views! $${weeklyFee.toLocaleString()}/week to stay featured! 👑`;
    }
    
    navigator.clipboard.writeText(message).then(() => {
        showToast('📋 Reminder copied! Send via in-city text.', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = message;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('📋 Reminder copied! Send via in-city text.', 'success');
    });
};

// Record premium listing payment - shows date picker modal
window.recordPremiumPayment = function(propertyId, ownerEmail) {
    // Check if admin
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        showToast('Only admins can record premium payments', 'error');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get property title for display
    const prop = properties.find(p => p.id === propertyId);
    const propertyTitle = prop?.title || `Property #${propertyId}`;
    
    const modalHTML = `
        <div id="premiumPaymentModal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onclick="if(event.target.id === 'premiumPaymentModal') closePremiumPaymentModal()">
            <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-green-600/50" onclick="event.stopPropagation()">
                <h3 class="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">💰 Record Premium Payment</h3>
                
                <div class="bg-gray-900/50 rounded-xl p-4 mb-4">
                    <p class="text-gray-300 text-sm"><strong>Property:</strong> ${propertyTitle}</p>
                    <p class="text-gray-300 text-sm"><strong>Fee:</strong> <span class="text-amber-400">$10,000/week</span></p>
                </div>
                
                <div class="mb-4">
                    <label class="block text-gray-300 text-sm font-medium mb-2">Payment Date</label>
                    <input type="date" id="premiumPaymentDate" value="${today}" max="${today}"
                           class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none">
                    <p class="text-gray-500 text-xs mt-1">Select the date payment was received</p>
                </div>
                
                <div class="flex gap-3">
                    <button onclick="confirmPremiumPayment(${propertyId})" 
                            class="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2">
                        ✓ Record Payment
                    </button>
                    <button onclick="closePremiumPaymentModal()" 
                            class="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closePremiumPaymentModal = function() {
    const modal = $('premiumPaymentModal');
    if (modal) modal.remove();
};

window.confirmPremiumPayment = async function(propertyId) {
    const dateInput = $('premiumPaymentDate');
    const dateStr = dateInput?.value;
    
    if (!dateStr) {
        showToast('Please select a payment date', 'error');
        return;
    }
    
    // Validate date isn't in future
    const selectedDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
        showToast('Payment date cannot be in the future', 'error');
        return;
    }
    
    try {
        // Use PropertyDataService to write to the correct location (settings/properties)
        await PropertyDataService.write(propertyId, 'premiumLastPayment', dateStr);
        
        closePremiumPaymentModal();
        
        // Format date for display
        const displayDate = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        showToast(`💰 Premium payment recorded: ${displayDate}. Next due in 7 days.`, 'success');
        
        // Re-render admin users list to update the display
        if (window.adminUsersData && typeof renderAdminUsersList === 'function') {
            renderAdminUsersList(window.adminUsersData);
        }
        
    } catch (error) {
        console.error('[Premium] Error recording payment:', error);
        showToast('Error recording payment: ' + error.message, 'error');
    }
};

window.exportUsersCSV = function() {
    const headers = ['Email', 'Display Name', 'Tier', 'Created', 'Listings'];
    const rows = window.adminUsersData.map(u => {
        const listingCount = OwnershipService.getListingCount(u.email);
        const created = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'Unknown';
        return [u.email, u.username || '', u.tier, created, listingCount];
    });
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    downloadFile('users.csv', csv, 'text/csv');
};

window.exportListingsCSV = function() {
    const headers = ['Title', 'Location', 'Type', 'Owner Email', 'Weekly', 'Monthly', 'Available'];
    const rows = properties.map(p => {
        return [p.title, p.location, p.type, p.ownerEmail || '', p.weeklyPrice || '', p.monthlyPrice || '', state.availability[p.id] !== false ? 'Yes' : 'No'];
    });
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    downloadFile('listings.csv', csv, 'text/csv');
};

window.downloadFile = function(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

window.findUserByProperty = function() {
    const searchTerm = ($('adminFindByProperty')?.value || '').toLowerCase();
    const resultDiv = $('adminFindResult');
    
    if (!searchTerm) {
        resultDiv.innerHTML = '<span class="text-yellow-400">Enter a property name or address.</span>';
        return;
    }
    
    const found = properties.find(p => 
        p.title.toLowerCase().includes(searchTerm) || 
        (p.location || '').toLowerCase().includes(searchTerm)
    );
    
    if (found) {
        const ownerDisplay = found.ownerEmail || getPropertyOwnerEmail(found.id) || 'Unknown';
        resultDiv.innerHTML = `<span class="text-green-400">Found: <strong>${found.title}</strong><br>Owner: ${ownerDisplay}</span>`;
    } else {
        resultDiv.innerHTML = '<span class="text-red-400">No property found matching that search.</span>';
    }
};

// ============================================================================
// BATCH SYNC OWNER PROFILES TO PROPERTIES
// ============================================================================
// Admin tool to sync all users' display names and phone numbers to their properties
// This fixes visibility for non-admin users who can't read the users collection
// ============================================================================

window.previewBatchSync = async function() {
    const previewDiv = $('batchSyncPreview');
    const statusDiv = $('batchSyncStatus');
    
    previewDiv.classList.remove('hidden');
    previewDiv.innerHTML = '<span class="text-gray-400">Loading preview...</span>';
    
    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const users = {};
        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                // Build display name: prefer firstName + lastName, fallback to username, then email prefix
                let displayName;
                if (data.firstName && data.lastName) {
                    displayName = data.firstName + ' ' + data.lastName;
                } else if (data.username) {
                    displayName = data.username;
                } else {
                    displayName = data.email.split('@')[0];
                }
                
                users[data.email.toLowerCase()] = {
                    displayName: displayName,
                    phone: data.phone || null
                };
            }
        });
        
        // Get all properties
        const propsDoc = await db.collection('settings').doc('properties').get();
        const allProperties = propsDoc.exists ? propsDoc.data() : {};
        
        // Build preview
        let previewHtml = '<div class="space-y-2">';
        let needsUpdate = 0;
        let alreadySynced = 0;
        
        for (const [propId, prop] of Object.entries(allProperties)) {
            if (!prop || !prop.ownerEmail) continue;
            
            const ownerEmail = prop.ownerEmail.toLowerCase();
            const userData = users[ownerEmail];
            
            if (!userData) continue;
            
            const needsName = userData.displayName && prop.ownerDisplayName !== userData.displayName;
            const needsPhone = userData.phone && prop.ownerContactPhone !== userData.phone;
            
            if (needsName || needsPhone) {
                needsUpdate++;
                previewHtml += `<div class="text-yellow-300">📝 ${prop.title || propId}`;
                if (needsName) previewHtml += `<br>&nbsp;&nbsp;Name: "${prop.ownerDisplayName || 'not set'}" → "${userData.displayName}"`;
                if (needsPhone) previewHtml += `<br>&nbsp;&nbsp;Phone: "${prop.ownerContactPhone || 'not set'}" → "***${userData.phone.slice(-4)}"`;
                previewHtml += '</div>';
            } else {
                alreadySynced++;
            }
        }
        
        previewHtml += '</div>';
        previewHtml += `<div class="mt-3 pt-3 border-t border-gray-700">
            <span class="text-cyan-400">Summary:</span> 
            <span class="text-yellow-300">${needsUpdate} properties need updates</span>, 
            <span class="text-green-300">${alreadySynced} already synced</span>
        </div>`;
        
        previewDiv.innerHTML = previewHtml;
        
    } catch (error) {
        console.error('[BatchSync] Preview error:', error);
        previewDiv.innerHTML = `<span class="text-red-400">Error: ${error.message}</span>`;
    }
};

window.batchSyncOwnerProfiles = async function() {
    const btn = $('batchSyncBtn');
    const statusDiv = $('batchSyncStatus');
    const previewDiv = $('batchSyncPreview');
    
    if (!confirm('This will update all properties with owner display names and phone numbers from user profiles.\n\nContinue?')) {
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin">⏳</span> Syncing...';
    statusDiv.classList.remove('hidden');
    statusDiv.className = 'mb-3 p-3 rounded-lg text-sm bg-blue-900/50 text-blue-300';
    statusDiv.textContent = 'Starting batch sync...';
    
    try {
        // Step 1: Get all users with their profile data
        statusDiv.textContent = 'Fetching user profiles...';
        const usersSnapshot = await db.collection('users').get();
        const users = {};
        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                // Build display name: prefer firstName + lastName, fallback to username, then email prefix
                let displayName;
                if (data.firstName && data.lastName) {
                    displayName = data.firstName + ' ' + data.lastName;
                } else if (data.username) {
                    displayName = data.username;
                } else {
                    displayName = data.email.split('@')[0];
                }
                
                users[data.email.toLowerCase()] = {
                    displayName: displayName,
                    phone: data.phone || null
                };
            }
        });
        console.log(`[BatchSync] Found ${Object.keys(users).length} users`);
        
        // Step 2: Get all properties
        statusDiv.textContent = 'Fetching properties...';
        const propsDoc = await db.collection('settings').doc('properties').get();
        const allProperties = propsDoc.exists ? propsDoc.data() : {};
        console.log(`[BatchSync] Found ${Object.keys(allProperties).length} properties`);
        
        // Step 3: Build updates
        statusDiv.textContent = 'Building updates...';
        const updates = {};
        let updateCount = 0;
        let skipCount = 0;
        
        for (const [propId, prop] of Object.entries(allProperties)) {
            if (!prop || !prop.ownerEmail) {
                skipCount++;
                continue;
            }
            
            const ownerEmail = prop.ownerEmail.toLowerCase();
            const userData = users[ownerEmail];
            
            if (!userData) {
                skipCount++;
                continue;
            }
            
            // Check if update needed
            const needsName = userData.displayName && prop.ownerDisplayName !== userData.displayName;
            const needsPhone = userData.phone && prop.ownerContactPhone !== userData.phone;
            
            if (needsName || needsPhone) {
                updates[propId] = { ...prop };
                if (userData.displayName) updates[propId].ownerDisplayName = userData.displayName;
                if (userData.phone) updates[propId].ownerContactPhone = userData.phone;
                updateCount++;
            } else {
                skipCount++;
            }
        }
        
        console.log(`[BatchSync] ${updateCount} properties to update, ${skipCount} skipped`);
        
        if (updateCount === 0) {
            statusDiv.className = 'mb-3 p-3 rounded-lg text-sm bg-green-900/50 text-green-300';
            statusDiv.textContent = '✅ All properties are already synced! No updates needed.';
            btn.disabled = false;
            btn.innerHTML = '<span>🔄</span> Sync All Users';
            return;
        }
        
        // Step 4: Save to Firestore
        statusDiv.textContent = `Saving ${updateCount} property updates...`;
        await db.collection('settings').doc('properties').set(updates, { merge: true });
        
        // Step 5: Update local properties array
        for (const [propId, updatedProp] of Object.entries(updates)) {
            const localProp = properties.find(p => String(p.id) === String(propId));
            if (localProp) {
                if (updatedProp.ownerDisplayName) localProp.ownerDisplayName = updatedProp.ownerDisplayName;
                if (updatedProp.ownerContactPhone) localProp.ownerContactPhone = updatedProp.ownerContactPhone;
            }
        }
        
        // Step 6: Update caches
        for (const [email, userData] of Object.entries(users)) {
            if (userData.displayName) {
                window.ownerUsernameCache = window.ownerUsernameCache || {};
                window.ownerUsernameCache[email] = userData.displayName;
            }
        }
        
        // Success
        statusDiv.className = 'mb-3 p-3 rounded-lg text-sm bg-green-900/50 text-green-300';
        statusDiv.innerHTML = `✅ <strong>Sync complete!</strong> Updated ${updateCount} properties with owner profiles.`;
        
        // Update preview if visible
        if (!previewDiv.classList.contains('hidden')) {
            previewBatchSync();
        }
        
        // Refresh property display
        if (typeof renderProperties === 'function') {
            renderProperties(state.filteredProperties || properties);
        }
        
        console.log(`[BatchSync] Complete! Updated ${updateCount} properties`);
        
    } catch (error) {
        console.error('[BatchSync] Error:', error);
        statusDiv.className = 'mb-3 p-3 rounded-lg text-sm bg-red-900/50 text-red-300';
        statusDiv.textContent = `❌ Error: ${error.message}`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🔄</span> Sync All Users';
    }
};

