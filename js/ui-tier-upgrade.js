/**
 * ============================================================================
 * UI TIER UPGRADE - Tier upgrade modal and requests
 * ============================================================================
 * 
 * CONTENTS:
 * - Upgrade modal display
 * - Upgrade message generation
 * - Copy upgrade message
 * - Check pending upgrade requests
 * 
 * DEPENDENCIES: TierService
 * ============================================================================
 */

// ==================== TIER UPGRADE MODAL ====================
window.openUpgradeModal = function(reason, currentTier) {
    $('upgradeReason').textContent = reason;
    $('upgradeCurrentTier').value = currentTier;
    $('upgradeMessage').value = '';
    
    // Highlight current tier
    ['Starter', 'Pro', 'Elite'].forEach(t => {
        const el = $('tier' + t);
        if (el) {
            el.classList.remove('ring-2', 'ring-white');
            if (t.toLowerCase() === currentTier) {
                el.classList.add('ring-2', 'ring-white');
            }
        }
    });
    
    // Filter dropdown to only show upgrades
    const dropdown = $('upgradeRequestedTier');
    if (dropdown) {
        dropdown.innerHTML = '<option value="">Choose a plan...</option>';
        if (currentTier === 'starter') {
            dropdown.innerHTML += '<option value="pro">⭐ Pro - 3 Listings ($25k/month)</option>';
            dropdown.innerHTML += '<option value="elite">👑 Elite - Unlimited ($50k/month)</option>';
        } else if (currentTier === 'pro') {
            dropdown.innerHTML += '<option value="elite">👑 Elite - Unlimited ($50k/month)</option>';
        }
    }
    
    hideElement($('upgradeStatus'));
    openModal('upgradeModal');
};

window.generateUpgradeMessage = function() {
    const user = auth.currentUser;
    if (!user) return;
    
    const requestedTier = $('upgradeRequestedTier').value;
    const currentTier = $('upgradeCurrentTier').value;
    const messageBox = $('upgradeMessage');
    
    if (!requestedTier) {
        messageBox.value = '';
        return;
    }
    
    const tierInfo = {
        pro: { name: 'Pro', price: '$25,000', listings: '3' },
        elite: { name: 'Elite', price: '$50,000', listings: 'unlimited' }
    };
    
    const info = tierInfo[requestedTier];
    const currentTierName = TIERS[currentTier]?.name || 'Starter';
    const displayName = $('ownerUsername')?.value || user.email.split('@')[0];
    
    const message = `Hey Pauly! I'd like to upgrade my PaulysAutos.com account from ${currentTierName} to ${info.name}.

Account: ${user.email}
Display Name: ${displayName}
Requested Plan: ${info.name} (${info.listings} listings)
Monthly Cost: ${info.price}

I'm ready to pay and start listing more vehicles!`;
    
    messageBox.value = message;
};

window.copyUpgradeMessage = async function() {
    const messageBox = $('upgradeMessage');
    const status = $('upgradeStatus');
    const btn = $('upgradeSubmitBtn');
    const tierSelect = $('upgradeRequestedTier');
    
    if (!messageBox.value || !tierSelect.value) {
        status.textContent = 'Please select a plan first.';
        status.className = 'text-yellow-400 text-sm';
        showElement(status);
        return;
    }
    
    const user = auth.currentUser;
    const requestedTier = tierSelect.value;
    const displayName = $('ownerUsername')?.value || user?.email?.split('@')[0] || 'Unknown';
    
    btn.disabled = true;
    btn.innerHTML = '⏳ Sending...';
    
    try {
        // Save notification to Firestore
        await db.collection('upgradeNotifications').add({
            userEmail: user.email,
            userId: user.uid,
            displayName: displayName,
            currentTier: state.userTier || 'starter',
            requestedTier: requestedTier,
            message: messageBox.value,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Copy to clipboard
        await navigator.clipboard.writeText(messageBox.value);
        
        status.textContent = '✓ Request sent & copied! Pauly has been notified.';
        status.className = 'text-green-400 text-sm';
        showElement(status);
        
        btn.innerHTML = '✓ Sent & Copied!';
        btn.className = btn.className.replace('from-blue-500 to-blue-600', 'from-green-500 to-green-600');
        
        // Refresh pending indicator
        checkPendingUpgradeRequest(user.email);
        
        setTimeout(() => {
            closeModal('upgradeModal');
            btn.innerHTML = '🔔 Notify & Copy';
            btn.className = btn.className.replace('from-green-500 to-green-600', 'from-blue-500 to-blue-600');
            btn.disabled = false;
        }, 2000);
        
    } catch (err) {
        console.error('Error sending upgrade request:', err);
        
        // Still try to copy even if notification fails
        try {
            await navigator.clipboard.writeText(messageBox.value);
            status.textContent = '✓ Copied! (Notification failed - please contact Pauly directly)';
            status.className = 'text-yellow-400 text-sm';
        } catch {
            status.textContent = 'Failed to send. Please try again.';
            status.className = 'text-red-400 text-sm';
        }
        showElement(status);
        btn.innerHTML = '🔔 Notify & Copy Message';
        btn.disabled = false;
    }
};

// Check for pending upgrade request and show indicator
window.checkPendingUpgradeRequest = async function(email) {
    const pendingBadge = $('tierPendingBadge');
    const pendingBanner = $('pendingUpgradeUserBanner');
    const pendingMessage = $('pendingUpgradeUserMessage');
    const pendingDate = $('pendingUpgradeUserDate');
    const upgradeBtn = $('tierUpgradeBtn');
    
    if (!email) return;
    
    try {
        const snapshot = await db.collection('upgradeNotifications')
            .where('userEmail', '==', email.toLowerCase())
            .where('status', '==', 'pending')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            // No pending request - hide pending indicators
            if (pendingBadge) hideElement(pendingBadge);
            if (pendingBanner) hideElement(pendingBanner);
            
            // Show upgrade button again (unless at Elite tier)
            if (upgradeBtn && state.userTier !== 'elite') {
                showElement(upgradeBtn);
            }
            return;
        }
        
        // There's a pending request
        const request = snapshot.docs[0].data();
        const currentTierData = TIERS[request.currentTier] || TIERS.starter;
        const requestedTierData = TIERS[request.requestedTier] || TIERS.pro;
        const requestDate = request.createdAt?.toDate ? request.createdAt.toDate().toLocaleString() : 'Recently';
        
        // Show pending badge
        if (pendingBadge) showElement(pendingBadge);
        
        // Hide upgrade button while request is pending
        if (upgradeBtn) hideElement(upgradeBtn);
        
        // Show pending banner
        if (pendingBanner) {
            showElement(pendingBanner);
            if (pendingMessage) {
                pendingMessage.innerHTML = `You've requested to upgrade from <span class="font-bold ${currentTierData.color}">${currentTierData.icon} ${currentTierData.name}</span> to <span class="font-bold ${requestedTierData.color}">${requestedTierData.icon} ${requestedTierData.name}</span>. Waiting for owner approval.`;
            }
            if (pendingDate) {
                pendingDate.textContent = `Submitted: ${requestDate}`;
            }
        }
        
    } catch (error) {
        // Hide indicators on error
        if (pendingBadge) hideElement(pendingBadge);
        if (pendingBanner) hideElement(pendingBanner);
    }
};

