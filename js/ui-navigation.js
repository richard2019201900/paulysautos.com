/**
 * ============================================================================
 * UI NAVIGATION - Navigation and routing functions
 * ============================================================================
 * 
 * CONTENTS:
 * - Main navigation functions
 * - Section navigation (home, dashboard, properties, etc.)
 * - User dropdown menu
 * - Blog page rendering
 * - Auth UI handlers
 * - Mobile menu
 * - Back navigation
 * 
 * DEPENDENCIES: TierService, PropertyDataService
 * ============================================================================
 */

// ==================== NAVIGATION ====================
function updateAuthButton(isLoggedIn) {
    const navBtn = $('navAuthBtn');
    const mobileBtn = $('mobileAuthBtn');
    const navCreateBtn = $('navCreateListingBtn');
    const mobileCreateBtn = $('mobileCreateListingBtn');
    const navUserDisplay = $('navUserDisplay');
    const mobileUserSection = $('mobileUserSection');
    const mobileLogoutBtn = $('mobileLogoutBtn');
    const mobileBlogLink = $('mobileBlogLink');
    
    if (isLoggedIn) {
        // Desktop nav
        navBtn.textContent = 'Logout';
        navBtn.className = 'hidden md:block bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 lg:px-6 py-2 lg:py-3 rounded-xl hover:opacity-90 transition font-semibold shadow-lg text-sm lg:text-base';
        
        // Mobile nav - hide auth button, show logout button and user section
        if (mobileBtn) mobileBtn.className = 'hidden';
        if (mobileLogoutBtn) mobileLogoutBtn.className = 'flex w-full text-left px-4 py-3 text-red-400 hover:bg-gray-800 font-semibold items-center gap-2';
        if (mobileUserSection) mobileUserSection.className = 'border-b border-gray-700 p-4 bg-gray-800/50';
        if (mobileBlogLink) mobileBlogLink.className = 'flex px-4 py-3 text-gray-300 hover:bg-gray-800 cursor-pointer items-center gap-2';
        
        showElement($('navDashboardLink'));
        showElement($('mobileDashboardLink'));
        // Show Create Listing buttons
        if (navCreateBtn) navCreateBtn.className = 'hidden md:block bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 px-3 lg:px-5 py-2 lg:py-2.5 rounded-xl hover:opacity-90 transition font-bold shadow-lg text-xs lg:text-sm';
        if (mobileCreateBtn) mobileCreateBtn.className = 'flex px-4 py-3 text-green-400 hover:bg-gray-800 cursor-pointer font-semibold items-center gap-2';
        // Show user display
        if (navUserDisplay) {
            navUserDisplay.className = 'hidden md:flex items-center gap-2';
            updateNavUserDisplay();
        }
        // Show "My Properties" filter
        const myPropertiesFilter = $('myPropertiesFilter');
        if (myPropertiesFilter) myPropertiesFilter.className = 'flex items-center gap-2 text-gray-300 font-semibold cursor-pointer text-sm md:text-base hover:text-white transition';
    } else {
        // Desktop nav
        navBtn.textContent = 'Register / Sign In';
        navBtn.className = 'hidden md:block gradient-bg text-white px-4 lg:px-6 py-2 lg:py-3 rounded-xl hover:opacity-90 transition font-semibold shadow-lg text-sm lg:text-base';
        
        // Mobile nav - show auth button, hide logout button and user section
        if (mobileBtn) {
            mobileBtn.textContent = 'Register / Sign In';
            mobileBtn.className = 'block w-full text-left px-4 py-3 text-purple-400 hover:bg-gray-800 font-semibold';
        }
        if (mobileLogoutBtn) mobileLogoutBtn.className = 'hidden';
        if (mobileUserSection) mobileUserSection.className = 'hidden';
        if (mobileBlogLink) mobileBlogLink.className = 'hidden';
        
        hideElement($('navDashboardLink'));
        hideElement($('mobileDashboardLink'));
        // Hide Create Listing buttons completely (set className to hidden only, no md:block)
        if (navCreateBtn) navCreateBtn.className = 'hidden';
        if (mobileCreateBtn) mobileCreateBtn.className = 'hidden';
        // Hide user display
        if (navUserDisplay) navUserDisplay.className = 'hidden';
        // Hide "My Properties" filter and uncheck it
        const myPropertiesFilter = $('myPropertiesFilter');
        const showMyProperties = $('showMyProperties');
        if (myPropertiesFilter) myPropertiesFilter.className = 'hidden';
        if (showMyProperties) showMyProperties.checked = false;
    }
}

// Update the nav bar user display
async function updateNavUserDisplay() {
    const user = auth.currentUser;
    if (!user) return;
    
    // Update site update badge
    updateSiteUpdateBadge();
    
    const navUserName = $('navUserName');
    const navUserTier = $('navUserTier');
    const navUpgradeOption = $('navUpgradeOption');
    
    // Mobile elements
    const mobileUserName = $('mobileUserName');
    const mobileUserTier = $('mobileUserTier');
    const mobileUserInitial = $('mobileUserInitial');
    
    if (!navUserName || !navUserTier) return;
    
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        const data = doc.data() || {};
        const username = data.username || user.email.split('@')[0];
        
        // Check if master admin
        if (TierService.isMasterAdmin(user.email)) {
            navUserName.textContent = username;
            navUserTier.innerHTML = '👑 Owner';
            navUserTier.className = 'text-xs text-red-400';
            // Hide upgrade option for Owner
            if (navUpgradeOption) navUpgradeOption.classList.add('hidden');
            
            // Update mobile elements
            if (mobileUserName) mobileUserName.textContent = username;
            if (mobileUserTier) {
                mobileUserTier.innerHTML = '👑 Owner';
                mobileUserTier.className = 'text-xs text-red-400';
            }
            if (mobileUserInitial) mobileUserInitial.textContent = username.charAt(0).toUpperCase();
            
            // Show admin notification badges on mobile
            updateMobileAdminBadges();
        } else {
            const tier = data.tier || 'starter';
            const tierData = TIERS[tier] || TIERS.starter;
            
            navUserName.textContent = username;
            navUserTier.innerHTML = `${tierData.icon} ${tierData.name}`;
            navUserTier.className = `text-xs ${tierData.color}`;
            
            // Update mobile elements
            if (mobileUserName) mobileUserName.textContent = username;
            if (mobileUserTier) {
                mobileUserTier.innerHTML = `${tierData.icon} ${tierData.name}`;
                mobileUserTier.className = `text-xs ${tierData.color}`;
            }
            if (mobileUserInitial) mobileUserInitial.textContent = username.charAt(0).toUpperCase();
            
            // Hide upgrade option for Elite users
            if (navUpgradeOption) {
                if (tier === 'elite') {
                    navUpgradeOption.classList.add('hidden');
                } else {
                    navUpgradeOption.classList.remove('hidden');
                }
            }
            
            // Update rent badges for all property owners (not just admin)
            updateMobileRentBadge();
        }
    } catch (error) {
        console.error('Error updating nav user display:', error);
        navUserName.textContent = user.email.split('@')[0];
        navUserTier.textContent = '🌱 Starter';
        
        // Update mobile elements with fallback
        if (mobileUserName) mobileUserName.textContent = user.email.split('@')[0];
        if (mobileUserTier) mobileUserTier.textContent = '🌱 Starter';
        if (mobileUserInitial) mobileUserInitial.textContent = user.email.charAt(0).toUpperCase();
    }
}

// Update mobile admin notification badges
function updateMobileAdminBadges() {
    // Update rent badges for ALL logged-in users (not just admin)
    updateMobileRentBadge();
    
    // Admin-only badges
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) return;
    
    const mobileAdminBadge = $('mobileAdminBadge');
    const mobileAdminCount = $('mobileAdminCount');
    
    // Update combined admin badge (users + listings + premium) - ADMIN ONLY
    if (mobileAdminBadge && window.AdminNotifications && TierService.isMasterAdmin(auth.currentUser?.email)) {
        const userCount = AdminNotifications.visible ? 
            Array.from(AdminNotifications.visible.values()).filter(v => v.type === 'new-user-').length : 0;
        const listingCount = AdminNotifications.visible ? 
            Array.from(AdminNotifications.visible.values()).filter(v => v.type === 'new-listing-').length : 0;
        const premiumCount = AdminNotifications.visible ? 
            Array.from(AdminNotifications.visible.values()).filter(v => v.type === 'new-premium-').length : 0;
        
        const total = userCount + listingCount + premiumCount;
        
        if (total > 0) {
            if (mobileAdminCount) mobileAdminCount.textContent = total;
            mobileAdminBadge.className = 'flex bg-blue-500 text-white text-xs font-bold rounded-full w-7 h-7 items-center justify-center shadow-lg animate-pulse cursor-pointer';
        } else {
            mobileAdminBadge.className = 'hidden';
        }
    } else if (mobileAdminBadge) {
        // Hide admin badge for non-admins
        mobileAdminBadge.className = 'hidden';
    }
}

// Separate function for updating mobile rent badge only (for non-admin users)
function updateMobileRentBadge() {
    const mobileRentBadge = $('mobileRentBadge');
    const mobileRentCount = $('mobileRentCount');
    
    if (mobileRentBadge && window.AdminNotifications?.rentNotifications) {
        const { overdue, today, tomorrow } = AdminNotifications.rentNotifications;
        const rentTotal = overdue.length + today.length + tomorrow.length;
        
        if (rentTotal > 0) {
            if (mobileRentCount) mobileRentCount.textContent = rentTotal;
            mobileRentBadge.className = 'flex bg-red-600 text-white text-xs font-bold rounded-full w-7 h-7 items-center justify-center shadow-lg animate-pulse cursor-pointer';
        } else {
            mobileRentBadge.className = 'hidden';
        }
    }
}

window.updateMobileRentBadge = updateMobileRentBadge;
window.updateMobileAdminBadges = updateMobileAdminBadges;

window.updateNavUserDisplay = updateNavUserDisplay;

// User dropdown menu functions
window.toggleUserDropdown = function() {
    const dropdown = $('userDropdownMenu');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        // Update badge position after toggle
        setTimeout(updateSiteUpdateBadge, 10);
    }
};

window.closeUserDropdown = function() {
    const dropdown = $('userDropdownMenu');
    if (dropdown) {
        dropdown.classList.add('hidden');
        // Update badge position after close
        setTimeout(updateSiteUpdateBadge, 10);
    }
};

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = $('userDropdownMenu');
    const navUserDisplay = $('navUserDisplay');
    if (dropdown && navUserDisplay && !navUserDisplay.contains(e.target)) {
        const wasOpen = !dropdown.classList.contains('hidden');
        dropdown.classList.add('hidden');
        // Update badge if dropdown was open
        if (wasOpen) setTimeout(updateSiteUpdateBadge, 10);
    }
});

// Navigate to profile settings section
window.goToProfileSettings = function() {
    goToDashboard();
    // Switch to My Properties tab (where profile settings lives) if admin
    if (TierService.isMasterAdmin(auth.currentUser?.email)) {
        switchDashboardTab('myProperties');
    }
    // Scroll to profile settings after a short delay
    setTimeout(() => {
        const profileSection = document.querySelector('#profileSettingsSection');
        if (profileSection) {
            profileSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash highlight effect
            profileSection.style.transition = 'box-shadow 0.3s';
            profileSection.style.boxShadow = '0 0 30px rgba(168, 85, 247, 0.5)';
            setTimeout(() => {
                profileSection.style.boxShadow = '';
            }, 2000);
        }
    }, 300);
};

// Navigate to blog/updates page
window.goToBlog = function() {
    closeUserDropdown();
    markSiteUpdateAsRead();
    navigateTo('blog');
};

// Render blog page content
window.renderBlogPage = function() {
    const blogPage = $('blogPage');
    if (!blogPage) return;
    
    // Blog posts data - add new posts at the top
    const blogPosts = [
        {
            date: 'December 30, 2024',
            title: '📱 Now Available On Your In-City Phone + Massive Platform Upgrades',
            category: 'Major Update',
            categoryColor: 'bg-purple-500',
            content: `
                <p class="mb-4"><strong>PaulysAutos.com now works directly in your phone browser while you're in the city.</strong> No more alt-tabbing to Chrome — browse listings, manage your vehicles, and check your dashboard right from your phone. Just type paulysautos.com and you're in.</p>
                
                <p class="mb-4">Over the past two weeks, we've pushed <strong>26 major updates</strong> and completely transformed the platform. Here's what's new:</p>
                
                <h4 class="font-bold text-white mb-2 mt-6">📱 In-City Phone Support:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Full site now works in the phone browser — no alt-tab needed</li>
                    <li>Custom domain: just type <strong>paulysautos.com</strong></li>
                    <li>Optimized for smooth scrolling and fast loading in-city</li>
                    <li>More phone-friendly improvements coming in 2026</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">🏠 Rent-to-Own System <span class="text-amber-400">(Elite Members)</span>:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Create RTO contracts on any property with custom terms</li>
                    <li>Flexible deposit amounts and payment schedules</li>
                    <li>Track every payment with automatic balance calculations</li>
                    <li>Listing ownership transfers on the site when contract completes</li>
                    <li>Edit or delete payments if mistakes are made</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">🏷️ Vehicle Sales Tracking:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Log property sales and track the financials on your dashboard</li>
                    <li>Celebration banners when you complete a sale</li>
                    <li>Earn XP and climb the leaderboard with each sale</li>
                    <li>Everything still happens in city — the site just keeps you organized</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">📊 Redesigned Dashboard:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>8 new tiles showing exactly what you're earning</li>
                    <li>Income broken down by Daily, Weekly, Biweekly, and Monthly renters</li>
                    <li>Dedicated RTO Income and Vehicle Sales tracking</li>
                    <li>Click any tile for a detailed breakdown</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">🔔 Smart Rent Collection Alerts:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Automatic alerts when rent is overdue, due today, or coming up</li>
                    <li>One-click copy for reminder messages to send to tenants</li>
                    <li>Dashboard notifications so you never miss a payment</li>
                    <li>Works for all property owners, not just admin</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">📸 Bulk Image Uploads:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Upload multiple property photos at once</li>
                    <li>Drag and drop to reorder your gallery</li>
                    <li>Horizontal layout for easier browsing</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">🏆 Improved Leaderboard:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>XP now updates in real-time as you complete actions</li>
                    <li>Earn XP for logging payments, completing leases, and making sales</li>
                    <li>Privacy protections keep your renters' info private</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">⚡ Under the Hood:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Complete notification system rebuild for reliability</li>
                    <li>Upgraded server infrastructure for faster performance</li>
                    <li>Enhanced security across the entire platform</li>
                    <li>Dozens of bug fixes and quality improvements</li>
                </ul>
                
                <p class="mt-6 text-gray-300">We're going all-in on the phone browser experience. Our goal is to make PaulysAutos.com the smoothest, most useful tool you can access without ever leaving the city.</p>
                
                <p class="mt-4 text-gray-400 italic">Questions, ideas, or feedback? <strong class="text-green-400">Text Pauly in city</strong> — everything you tell us shapes what we build next.</p>
            `
        },
        {
            date: 'December 15, 2024',
            title: '🚀 Two Weeks In - A Complete Property Management Platform',
            category: 'Milestone',
            categoryColor: 'bg-amber-500',
            content: `
                <p class="mb-4">Two weeks ago, PaulysAutos.com was just an idea. Today, we're a fully operational vehicle marketplace with a growing community of sellers and buyers across Los Santos.</p>
                
                <p class="mb-4">Here's everything we've built:</p>
                
                <h4 class="font-bold text-white mb-2 mt-6">For Sellers:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Create and manage vehicle listings with full image galleries</li>
                    <li>6 vehicle types supported: Cars, Trucks, SUVs, Boats, Motorcycles, and Other</li>
                    <li>Simple pricing - just set your sale price</li>
                    <li>Premium listings to feature your vehicle at the top</li>
                    <li>One-click status toggling between Available and Sold</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">For Buyers:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Browse vehicles for free - no account required</li>
                    <li>Filter by type, sort by price or storage</li>
                    <li>Contact sellers directly through the platform</li>
                    <li>View detailed vehicle specs and photos</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">Elite Portfolio Reports <span class="text-amber-400">(Elite Members)</span>:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>4-tab analytics dashboard: Overview, Revenue, Occupancy, and Top Performers</li>
                    <li>Vacancy Loss Calculator showing exactly how much empty units cost you weekly and monthly</li>
                    <li>4-Week Cash Flow Forecast to project your upcoming income</li>
                    <li>Overdue and upcoming payment alerts at a glance</li>
                    <li>Top earners ranked by current rent and all-time collections</li>
                    <li>Occupancy breakdowns by property type</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">3-Tier Subscription System:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>🌱 <strong>Starter</strong> (Free) - 1 listing, perfect for getting started</li>
                    <li>⭐ <strong>Pro</strong> ($25,000/mo) - Up to 3 listings for growing landlords</li>
                    <li>👑 <strong>Elite</strong> ($50,000/mo) - Unlimited listings plus exclusive Portfolio Reports</li>
                    <li>Prorated upgrades so you only pay the difference when moving up</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">Photo Services:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Per Photo package: $10,000 for professional HD shots</li>
                    <li>Premium Bundle: $125,000 for 6-7 photos, video tour, and 4 weeks of premium placement</li>
                </ul>
                
                <h4 class="font-bold text-white mb-2 mt-6">Admin Tools:</h4>
                <ul class="list-disc list-inside space-y-1 text-gray-300 mb-4">
                    <li>Real-time dashboard with 8 interactive stat tiles</li>
                    <li>User management: create accounts, adjust tiers, handle upgrades</li>
                    <li>4-type notification system for new users, listings, upgrade requests, and premium activations</li>
                    <li>Property reassignment between owners</li>
                    <li>CSV export for external reporting</li>
                    <li>Activity logging and VIP leads tracking</li>
                </ul>
                
                <p class="mt-6 text-gray-300">This is just the beginning. We're releasing updates weekly based on your feedback. Have a feature request or question? <strong class="text-green-400">Text Pauly in city</strong> for the fastest response.</p>
                
                <p class="mt-4 text-gray-400 italic">Thank you to everyone who's joined us in these first two weeks. Here's to building something great together.</p>
            `
        }
    ];
    
    blogPage.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-10">
                <h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-3">
                    📰 Site Updates
                </h1>
                <p class="text-gray-400">Stay informed about new features and improvements</p>
            </div>
            
            <!-- Blog Posts -->
            <div class="space-y-8">
                ${blogPosts.map(post => `
                    <article class="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden hover:border-purple-500/50 transition">
                        <div class="p-6">
                            <div class="flex items-center gap-3 mb-4">
                                <span class="${post.categoryColor} text-white text-xs font-bold px-3 py-1 rounded-full">${post.category}</span>
                                <span class="text-gray-500 text-sm">${post.date}</span>
                            </div>
                            <h2 class="text-2xl font-bold text-white mb-4">${post.title}</h2>
                            <div class="text-gray-300 leading-relaxed">
                                ${post.content}
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
            
            <!-- Footer -->
            <div class="text-center mt-12 py-8 border-t border-gray-700">
                <p class="text-gray-500 text-sm">
                    Updates posted weekly. Text Pauly in city with questions or feedback.
                </p>
                <button onclick="navigateTo('home')" class="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 transition">
                    ← Back to Home
                </button>
            </div>
        </div>
    `;
};

window.handleAuthClick = function() {
    hideElement($('mobileMenu'));
    state.currentUser === 'owner' ? logout() : openModal('loginModal');
};

window.showCreateAccountForm = function() {
    hideElement($('loginOptions'));
    hideElement($('ownerLoginForm'));
    showElement($('createAccountForm'));
    hideElement($('createAccountError'));
    
    // Clear form fields to prevent cached data
    const emailField = $('newAccountEmail');
    const passwordField = $('newAccountPassword');
    const displayNameField = $('newAccountDisplayName');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
    if (displayNameField) displayNameField.value = '';
    
    // Reset button state
    const btn = $('createAccountBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = '🌱 Create Starter Account';
    }
};

window.showLoginForm = function() {
    hideElement($('loginOptions'));
    hideElement($('createAccountForm'));
    showElement($('ownerLoginForm'));
    hideElement($('loginError'));
    
    // Clear form fields to prevent cached data
    const emailField = $('ownerEmail');
    const passwordField = $('ownerPassword');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
    
    // Reset login button state
    const btn = $('loginSubmitBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
};

window.hideCreateAccountForm = function() {
    hideElement($('createAccountForm'));
    showElement($('loginOptions'));
    
    // Clear form fields
    const emailField = $('newAccountEmail');
    const passwordField = $('newAccountPassword');
    const displayNameField = $('newAccountDisplayName');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
    if (displayNameField) displayNameField.value = '';
    
    // Reset button state
    const btn = $('createAccountBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = '🌱 Create Starter Account';
    }
};

// Handle create account form submission
document.addEventListener('DOMContentLoaded', function() {
    // Clean up any stale state on page load
    window.isCreatingAccount = false;
    const staleToast = document.getElementById('deletedAccountToast');
    if (staleToast) staleToast.remove();
    
    const createForm = $('createAccountFormEl');
    if (createForm) {
        createForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = $('newAccountEmail').value.trim().toLowerCase();
            const email = username + '@pma.network'; // Append domain
            const password = $('newAccountPassword').value;
            const displayName = $('newAccountDisplayName').value.trim();
            const errorDiv = $('createAccountError');
            const btn = $('createAccountBtn');
            
            hideElement(errorDiv);
            
            // Validate username format
            if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
                errorDiv.textContent = 'Username can only contain letters, numbers, dots and underscores.';
                showElement(errorDiv);
                return;
            }
            
            if (username.length < 3) {
                errorDiv.textContent = 'Username must be at least 3 characters.';
                showElement(errorDiv);
                return;
            }
            
            if (password.length < 6) {
                errorDiv.textContent = 'Password must be at least 6 characters.';
                showElement(errorDiv);
                return;
            }
            
            btn.disabled = true;
            btn.textContent = 'Creating Account...';
            
            try {
                // Set flag to prevent false "deleted account" detection
                window.isCreatingAccount = true;
                
                // Create the user with Firebase Auth
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                // Create user document with starter tier and display name
                await db.collection('users').doc(user.uid).set({
                    email: user.email.toLowerCase(),
                    username: displayName,
                    tier: 'starter',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                // CREATE ADMIN NOTIFICATION for new user signup (wrapped in try-catch to not break flow)
                try {
                    await db.collection('adminNotifications').add({
                        type: 'new_user',
                        userEmail: user.email.toLowerCase(),
                        displayName: displayName,
                        tier: 'starter',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        dismissed: false
                    });
                } catch (notifyError) {
                    console.warn('[Auth] Could not create admin notification (non-critical):', notifyError);
                    // Don't break the flow - account creation succeeded
                }
                
                // Clear the flag after document is created
                window.isCreatingAccount = false;
                
                // Show success with credentials reminder
                errorDiv.className = 'text-green-400 text-sm font-medium text-center p-3 bg-green-900/30 rounded-xl';
                errorDiv.innerHTML = `✓ Account created!<br><strong>Save these credentials:</strong><br>Username: ${username}@pma.network<br>Password: (what you entered)`;
                showElement(errorDiv);
                
                // Close modal after delay
                setTimeout(() => {
                    closeModal('loginModal');
                    errorDiv.className = 'hidden text-red-400 text-sm font-medium text-center p-3 bg-red-900/30 rounded-xl';
                }, 3000);
                
            } catch (error) {
                // Clear flag on error too
                window.isCreatingAccount = false;
                
                console.error('[Auth] Create account error:', error);
                
                let errorMessage = 'Failed to create account. Please try again.';
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'This username is already registered. Try signing in instead, or use a different username.';
                    // Add a sign-in link
                    errorDiv.innerHTML = `${errorMessage}<br><button onclick="showLoginForm()" class="text-purple-400 underline mt-2">→ Sign In</button>`;
                    showElement(errorDiv);
                    btn.disabled = false;
                    btn.textContent = '🌱 Create Starter Account';
                    return;
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Invalid username. Use only letters, numbers, dots and underscores.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'Password must be at least 6 characters.';
                }
                
                errorDiv.textContent = errorMessage;
                showElement(errorDiv);
                btn.disabled = false;
                btn.textContent = '🌱 Create Starter Account';
            }
        });
    }
});

// Hide mobile menu helper
window.hideMobileMenu = function() {
    hideElement($('mobileMenu'));
};

window.goToDashboard = function() {
    hideElement($('mobileMenu'));
    if (state.currentUser === 'owner') {
        hideElement($('renterSection'));
        hideElement($('propertyDetailPage'));
        hideElement($('vehicleStatsPage'));
        hideElement($('blogPage'));
        hideElement($('leaderboardPage'));
        showElement($('ownerDashboard'));
        renderOwnerDashboard();
        
        // Load admin users if master admin
        const user = auth.currentUser;
        if (user && TierService.isMasterAdmin(user.email)) {
            resetAdminTiles(); // Reset tiles to front view
            loadAllUsers();
            
            // Re-render any pending notifications
            setTimeout(() => {
                if (typeof reRenderPendingNotifications === 'function') {
                    reRenderPendingNotifications();
                }
            }, 300);
        }
        
        window.scrollTo(0, 0);
    }
};

// Go to Dashboard -> My Properties tab and highlight rent alerts
window.goToRentAlerts = function() {
    // Use the enterprise scroll-to-highlight pattern
    scrollToAndHighlightElement({
        targetSelector: '#rentNotificationsPanel',
        tabName: 'myProperties',
        maxWaitMs: 3000,
        highlightColor: 'rgba(239, 68, 68, 0.7)',
        glowColor: 'rgba(239, 68, 68, 0.4)',
        onNotFound: () => console.log('[RentAlerts] Rent notifications panel not found or hidden')
    });
};

// Go to Dashboard -> Admin Panel and scroll to notifications
window.goToAdminNotifications = async function(type) {
    // Ensure we're on the dashboard
    if (!$('ownerDashboard') || $('ownerDashboard').classList.contains('hidden')) {
        goToDashboard();
        await sleep(300);
    }
    
    // Switch to Admin Panel tab
    if (typeof switchDashboardTab === 'function') {
        switchDashboardTab('admin');
        await sleep(200);
    }
    
    // Determine target based on notification type
    if (type === 'users' || type === 'listings') {
        // For new users and new listings, scroll to the notification stack at top of admin panel
        // This is where "While You Were Away" and "New User Registration" cards appear
        const targetElement = await waitForElement('#adminNotificationsStack', 3000);
        
        if (targetElement && !targetElement.classList.contains('hidden')) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Highlight the notification stack
            const highlightColor = type === 'users' ? 'rgba(59, 130, 246, 0.7)' : 'rgba(34, 197, 94, 0.7)';
            targetElement.style.boxShadow = `0 0 0 4px ${highlightColor}, 0 0 30px ${highlightColor.replace('0.7', '0.4')}`;
            targetElement.style.transition = 'box-shadow 0.3s ease';
            
            setTimeout(() => {
                targetElement.style.boxShadow = '';
            }, 4000);
        }
        
    } else if (type === 'premium') {
        // For premium requests, scroll to the premium alert section
        const targetElement = await waitForElement('#pendingPremiumAlert', 3000);
        
        if (targetElement && !targetElement.classList.contains('hidden')) {
            // Expand the details if collapsed
            const listEl = $('premiumRequestsList');
            if (listEl && listEl.classList.contains('hidden')) {
                if (typeof showPremiumRequestsList === 'function') {
                    showPremiumRequestsList();
                }
            }
            
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            const highlightColor = 'rgba(245, 158, 11, 0.7)';
            targetElement.style.boxShadow = `0 0 0 4px ${highlightColor}, 0 0 30px ${highlightColor.replace('0.7', '0.4')}`;
            targetElement.style.transition = 'box-shadow 0.3s ease';
            
            setTimeout(() => {
                targetElement.style.boxShadow = '';
            }, 4000);
        }
        
    } else if (type === 'photo') {
        // For photo requests, switch to Requests subtab and highlight photo section
        if (typeof switchAdminTab === 'function') {
            switchAdminTab('requests');
            await sleep(200);
        }
        
        // Load fresh photo requests
        if (typeof loadPhotoRequests === 'function') {
            loadPhotoRequests();
        }
        
        const targetElement = await waitForElement('#photoRequestsSection', 3000);
        
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            const highlightColor = 'rgba(168, 85, 247, 0.7)';
            targetElement.style.boxShadow = `0 0 0 4px ${highlightColor}, 0 0 30px ${highlightColor.replace('0.7', '0.4')}`;
            targetElement.style.transition = 'box-shadow 0.3s ease';
            
            setTimeout(() => {
                targetElement.style.boxShadow = '';
            }, 4000);
        }
        
    } else {
        // Default: scroll to notification stack
        const targetElement = await waitForElement('#adminNotificationsStack', 3000);
        
        if (targetElement && !targetElement.classList.contains('hidden')) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
};

window.backToDashboard = function() {
    hideElement($('vehicleStatsPage'));
    hideElement($('blogPage'));
    showElement($('ownerDashboard'));
    window.scrollTo(0, 0);
};

window.goHome = function() {
    // Block navigation if profile is incomplete
    if (!canNavigateAway()) {
        showProfileCompletionOverlay();
        return;
    }
    hideElement($('ownerDashboard'));
    hideElement($('propertyDetailPage'));
    hideElement($('vehicleStatsPage'));
    hideElement($('blogPage'));
    showElement($('renterSection'));
    window.scrollTo(0, 0);
};

window.navigateTo = function(section) {
    // Block navigation if profile is incomplete
    if (!canNavigateAway()) {
        showProfileCompletionOverlay();
        return;
    }
    hideElement($('mobileMenu'));
    hideElement($('ownerDashboard'));
    hideElement($('propertyDetailPage'));
    hideElement($('vehicleStatsPage'));
    hideElement($('blogPage'));
    hideElement($('leaderboardPage'));
    
    // Handle blog page specially
    if (section === 'blog') {
        hideElement($('renterSection'));
        showElement($('blogPage'));
        renderBlogPage();
        window.scrollTo(0, 0);
        return;
    }
    
    // Handle leaderboard page
    if (section === 'leaderboard') {
        hideElement($('renterSection'));
        showElement($('leaderboardPage'));
        renderLeaderboardPage();
        window.scrollTo(0, 0);
        return;
    }
    
    showElement($('renterSection'));
    
    // Re-apply filters when navigating to properties section
    // This ensures checkbox state matches displayed properties
    if (section === 'properties' && typeof applyAllFilters === 'function') {
        applyAllFilters();
    }
    
    setTimeout(() => $(section)?.scrollIntoView({ behavior: 'smooth' }), 100);
};

window.goBack = function() {
    hideElement($('propertyDetailPage'));
    hideElement($('vehicleStatsPage'));
    hideElement($('leaderboardPage'));
    hideElement($('blogPage'));
    hideElement($('ownerDashboard'));
    showElement($('renterSection'));
    
    // Re-apply filters to ensure checkbox state matches displayed properties
    if (typeof applyAllFilters === 'function') {
        applyAllFilters();
    }
    
    // Restore scroll position (saved when user clicked on a property)
    if (typeof window.savedScrollPosition === 'number') {
        // Small delay to ensure DOM is ready after showing renterSection
        setTimeout(() => {
            window.scrollTo(0, window.savedScrollPosition);
        }, 50);
    } else {
        $('properties').scrollIntoView({ behavior: 'smooth' });
    }
};

