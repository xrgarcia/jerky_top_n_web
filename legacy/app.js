document.addEventListener('DOMContentLoaded', function() {
    const topNSelect = document.getElementById('topN');
    const loadButton = document.getElementById('loadButton');
    const loadingDiv = document.getElementById('loading');
    const jerkyList = document.getElementById('jerkyList');
    const rankingMode = document.getElementById('rankingMode');
    const enableRankingBtn = document.getElementById('enableRanking');
    const resetRankingBtn = document.getElementById('resetRanking');
    const rankingDisplay = document.getElementById('rankingDisplay');
    const userRankingList = document.getElementById('userRankingList');

    // Page navigation elements
    const navLinks = document.querySelectorAll('.nav-link');
    const homePage = document.getElementById('homePage');
    const rankPage = document.getElementById('rankPage');
    const productsPage = document.getElementById('productsPage');
    const loginPage = document.getElementById('loginPage');
    const toolsPage = document.getElementById('toolsPage');
    const heroSection = document.getElementById('heroSection');

    let currentJerkyData = [];
    let userRanking = [];
    let isRankingMode = false;
    
    // Products page state variables
    let allProductsData = [];
    let searchTimeout = null;
    let currentSort = 'name-asc';
    let selectedAnimal = null;
    let currentProductsPage = 1;
    let hasMoreProductsPage = true;
    let isProductsLoading = false;
    let currentProductsQuery = '';

    // Navigation is handled purely by hash changes
    // No click handlers needed - browser handles hash links natively

    // Event listeners
    if (loadButton) loadButton.addEventListener('click', loadTopJerky);
    if (topNSelect) topNSelect.addEventListener('change', loadTopJerky);
    if (enableRankingBtn) enableRankingBtn.addEventListener('click', enableRankingMode);
    if (resetRankingBtn) resetRankingBtn.addEventListener('click', resetRanking);

    // Quiz button - opens jerky.com quiz in new tab
    const quizBtn = document.querySelector('.announcement-btn');
    if (quizBtn) {
        quizBtn.addEventListener('click', function() {
            window.open('https://www.jerky.com/pages/jerky-quiz-get-started', '_blank');
        });
    }

    // Page navigation functions
    
    // Centralized utility to hide all pages
    function hideAllPages() {
        const coinDetailPage = document.getElementById('coinDetailPage');
        const coinbookPage = document.getElementById('coinbookPage');
        const communityPage = document.getElementById('communityPage');
        const leaderboardPage = document.getElementById('leaderboardPage');
        const profilePage = document.getElementById('profilePage');
        const productDetailPage = document.getElementById('productDetailPage');
        const userProfilePage = document.getElementById('userProfilePage');
        
        if (homePage) homePage.style.display = 'none';
        if (rankPage) rankPage.style.display = 'none';
        if (productsPage) productsPage.style.display = 'none';
        if (communityPage) communityPage.style.display = 'none';
        if (leaderboardPage) leaderboardPage.style.display = 'none';
        if (profilePage) profilePage.style.display = 'none';
        if (productDetailPage) productDetailPage.style.display = 'none';
        if (loginPage) loginPage.style.display = 'none';
        if (userProfilePage) userProfilePage.style.display = 'none';
        if (coinDetailPage) coinDetailPage.style.display = 'none';
        if (coinbookPage) coinbookPage.style.display = 'none';
        if (toolsPage) toolsPage.style.display = 'none';
        if (heroSection) heroSection.style.display = 'none';
    }
    
    async function showPage(page, updateURL = true) {
        // Apply page transition class to hide content during navigation
        document.body.classList.add('page-transitioning');
        
        const communityPage = document.getElementById('communityPage');
        const leaderboardPage = document.getElementById('leaderboardPage');
        const profilePage = document.getElementById('profilePage');
        const productDetailPage = document.getElementById('productDetailPage');
        const userProfilePage = document.getElementById('userProfilePage');
        
        // Check if this is a user profile route
        if (page.startsWith('user/')) {
            const userId = page.split('/')[1];
            
            // Update URL hash if needed
            if (updateURL && window.location.hash !== `#${page}`) {
                window.location.hash = `#${page}`;
            }
            
            // Hide all pages and show user profile page
            hideAllPages();
            if (userProfilePage) userProfilePage.style.display = 'block';
            
            // Load user profile
            await loadUserProfile(userId);
            
            // Update active nav link (community should be active)
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            const communityLink = document.querySelector('[data-page="community"]');
            if (communityLink) communityLink.classList.add('active');
            
            // Track page view for live user monitoring
            if (window.socket && window.socket.connected) {
                window.socket.emit('page:view', { page: 'community' });
            }
            
            // Remove transition class after page is ready
            document.body.classList.remove('page-transitioning');
            return;
        }
        
        // Check if this is a product detail route
        if (page.startsWith('product/')) {
            const productId = page.split('/')[1];
            
            // Update URL hash if needed
            if (updateURL && window.location.hash !== `#${page}`) {
                window.location.hash = `#${page}`;
            }
            
            // Hide all pages and show product detail page
            hideAllPages();
            if (productDetailPage) productDetailPage.style.display = 'block';
            
            // Load product detail
            await loadProductDetail(productId);
            
            // Update active nav link (products should be active)
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            const productsLink = document.querySelector('[data-page="products"]');
            if (productsLink) productsLink.classList.add('active');
            
            // Track page view for live user monitoring
            if (window.socket && window.socket.connected) {
                window.socket.emit('page:view', { page: 'products' });
            }
            
            // Remove transition class after page is ready
            document.body.classList.remove('page-transitioning');
            return;
        }
        
        // Check if this is a coin detail route (new clean URL structure)
        if (page.startsWith('coins/')) {
            const achievementCode = page.split('/')[1];
            const coinDetailPage = document.getElementById('coinDetailPage');
            
            // Update URL hash if needed
            if (updateURL && window.location.hash !== `#${page}`) {
                window.location.hash = `#${page}`;
            }
            
            // Hide all pages and show coin detail page
            hideAllPages();
            if (coinDetailPage) coinDetailPage.style.display = 'block';
            
            // Load achievement detail
            if (window.initCoinDetailPage) {
                await window.initCoinDetailPage(achievementCode);
            }
            
            // Update active nav link (coinbook should be active)
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            const coinbookLink = document.querySelector('[data-page="coinbook"]');
            if (coinbookLink) coinbookLink.classList.add('active');
            
            // Track page view for live user monitoring
            if (window.socket && window.socket.connected) {
                window.socket.emit('page:view', { page: 'coinbook' });
            }
            
            // Remove transition class after page is ready
            document.body.classList.remove('page-transitioning');
            return;
        }
        
        // Legacy support: Check if this is an achievement detail route (old ID-based URLs)
        if (page.startsWith('achievement/')) {
            const achievementId = page.split('/')[1];
            const coinDetailPage = document.getElementById('coinDetailPage');
            
            // Update URL hash if needed
            if (updateURL && window.location.hash !== `#${page}`) {
                window.location.hash = `#${page}`;
            }
            
            // Hide all pages and show coin detail page
            hideAllPages();
            if (coinDetailPage) coinDetailPage.style.display = 'block';
            
            // Load achievement detail (pass ID, backend will handle lookup)
            if (window.initCoinDetailPage) {
                await window.initCoinDetailPage(achievementId);
            }
            
            // Update active nav link (coinbook should be active)
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            const coinbookLink = document.querySelector('[data-page="coinbook"]');
            if (coinbookLink) coinbookLink.classList.add('active');
            
            // Track page view for live user monitoring
            if (window.socket && window.socket.connected) {
                window.socket.emit('page:view', { page: 'coinbook' });
            }
            
            // Remove transition class after page is ready
            document.body.classList.remove('page-transitioning');
            return;
        }
        
        // Check if rank page requires authentication
        if (page === 'rank') {
            // First try quick sync check, then async if needed
            if (!isUserAuthenticated()) {
                const isAuthenticatedAsync = await isUserAuthenticatedAsync();
                if (!isAuthenticatedAsync) {
                    document.body.classList.remove('page-transitioning');
                    showLoginRequiredMessage('rank');
                    return;
                }
            }
        }
        
        // Check if community page requires authentication
        if (page === 'community') {
            // First try quick sync check, then async if needed
            if (!isUserAuthenticated()) {
                const isAuthenticatedAsync = await isUserAuthenticatedAsync();
                if (!isAuthenticatedAsync) {
                    document.body.classList.remove('page-transitioning');
                    showLoginRequiredMessage('community');
                    return;
                }
            }
        }
        
        // Check if leaderboard page requires authentication
        if (page === 'leaderboard') {
            // First try quick sync check, then async if needed
            if (!isUserAuthenticated()) {
                const isAuthenticatedAsync = await isUserAuthenticatedAsync();
                if (!isAuthenticatedAsync) {
                    document.body.classList.remove('page-transitioning');
                    showLoginRequiredMessage('leaderboard');
                    return;
                }
            }
        }
        
        // Update URL hash for linkable pages
        if (updateURL) {
            const newHash = `#${page}`;
            if (window.location.hash !== newHash) {
                window.location.hash = newHash;
            }
        }
        
        // Hide all pages using centralized function
        hideAllPages();
        
        // Show selected page (sessionStorage removed - URL is single source of truth)
        if (page === 'home' && homePage) {
            homePage.style.display = 'block';
            if (heroSection) heroSection.style.display = 'block';
            document.body.classList.remove('login-page-active');
            // Refresh home dashboard data when navigating to home
            if (window.homeDashboard && typeof window.homeDashboard.loadStats === 'function') {
                window.homeDashboard.loadStats();
            }
            // Refresh hero dashboard data when navigating to home
            if (window.heroDashboard && typeof window.heroDashboard.loadStats === 'function') {
                window.heroDashboard.loadStats();
            }
        } else if (page === 'rank' && rankPage) {
            rankPage.style.display = 'block';
            if (heroSection) heroSection.style.display = 'none';
            document.body.classList.remove('login-page-active');
            
            // Parse URL parameters for search
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
            const searchQuery = hashParams.get('search') || '';
            
            // Load rankings and products when page is shown
            loadRankPageData();
            
            // If there's a search parameter, populate the search input and trigger search
            if (searchQuery) {
                const productSearchInput = document.getElementById('productSearch');
                if (productSearchInput) {
                    productSearchInput.value = searchQuery;
                    // Trigger the search after a brief delay to ensure the page is fully loaded
                    setTimeout(() => {
                        currentSearchQuery = searchQuery;
                        loadProducts(searchQuery, true);
                    }, 300);
                }
            }
        } else if (page === 'products' && productsPage) {
            productsPage.style.display = 'block';
            if (heroSection) heroSection.style.display = 'none';
            document.body.classList.remove('login-page-active');
            // Parse URL parameters
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
            const query = hashParams.get('q') || '';
            const sort = hashParams.get('sort') || 'name-asc';
            const animal = hashParams.get('animal') || null;
            const [field, order] = sort.split('-');
            
            // Update form elements
            const productsSearchInput = document.getElementById('productsSearchInput');
            const productSortField = document.getElementById('productSortField');
            const productSortOrder = document.getElementById('productSortOrder');
            if (productsSearchInput) productsSearchInput.value = query;
            if (productSortField) productSortField.value = field;
            if (productSortOrder) productSortOrder.setAttribute('data-order', order || 'asc');
            
            // Set selected animal from URL
            selectedAnimal = animal;
            
            // Initialize animal filter toggle state
            initializeAnimalFilterState();
            
            // Load animal categories and products when page is shown
            loadAnimalCategories().then(() => {
                // After categories load, activate the selected animal if from URL
                if (selectedAnimal) {
                    const animalCategories = document.getElementById('animalCategories');
                    if (animalCategories) {
                        const categoryEl = animalCategories.querySelector(`[data-animal="${selectedAnimal}"]`);
                        if (categoryEl) {
                            categoryEl.classList.add('active');
                        }
                    }
                    // Populate search box with animal name from URL
                    if (productsSearchInput && !query) {
                        productsSearchInput.value = selectedAnimal;
                    }
                }
            });
            
            loadAllProducts(query, sort).then(() => {
                // Apply animal filter after products load if selected
                if (selectedAnimal) {
                    filterProductsByAnimal(selectedAnimal);
                }
            });
        } else if (page === 'community' && communityPage) {
            communityPage.style.display = 'block';
            if (heroSection) heroSection.style.display = 'none';
            document.body.classList.remove('login-page-active');
            // Load community users when page is shown
            loadCommunityUsers();
        } else if (page === 'leaderboard' && leaderboardPage) {
            leaderboardPage.style.display = 'block';
            if (heroSection) heroSection.style.display = 'none';
            document.body.classList.remove('login-page-active');
            // Refresh leaderboard data when navigating to leaderboard
            if (window.pageWidgets && window.pageWidgets.fullLeaderboard && typeof window.pageWidgets.fullLeaderboard.load === 'function') {
                window.pageWidgets.fullLeaderboard.load();
            }
        } else if (page === 'profile' && profilePage) {
            profilePage.style.display = 'block';
            if (heroSection) heroSection.style.display = 'none';
            document.body.classList.remove('login-page-active');
            // Load profile data when page is shown
            loadProfileData();
        } else if (page === 'login' && loginPage) {
            // Check if user is already logged in
            const authStatus = await checkSession();
            if (authStatus.authenticated) {
                // User is already logged in, redirect to intended page or home
                const redirectTo = sessionStorage.getItem('redirectAfterLogin') || 'home';
                sessionStorage.removeItem('redirectAfterLogin');
                console.log(`✅ User already logged in, redirecting to: ${redirectTo}`);
                // Note: No need to remove page-transitioning here as showPage() will be called recursively
                await showPage(redirectTo);
                return;
            }
            
            loginPage.style.display = 'block';
            if (heroSection) heroSection.style.display = 'none';
            document.body.classList.add('login-page-active');
            
            // Check for and display any login messages from sessionStorage
            const loginMessage = sessionStorage.getItem('loginMessage');
            const loginMessageEl = document.getElementById('loginMessage');
            if (loginMessage && loginMessageEl) {
                loginMessageEl.textContent = loginMessage;
                loginMessageEl.style.display = 'block';
                loginMessageEl.style.color = '#e74c3c';
                loginMessageEl.style.marginTop = '15px';
                sessionStorage.removeItem('loginMessage');
            } else if (loginMessageEl) {
                loginMessageEl.style.display = 'none';
            }
        } else if (page === 'coinbook') {
            const coinbookPage = document.getElementById('coinbookPage');
            
            // Show coinbook page (hideAllPages already called above)
            if (coinbookPage) {
                coinbookPage.style.display = 'block';
            }
            document.body.classList.remove('login-page-active');
            
            // Initialize coinbook page (legacy compatibility)
            if (window.initCoinbookPage && typeof window.initCoinbookPage === 'function') {
                await window.initCoinbookPage();
            }
            
            // Emit page:shown event for ProgressWidget integration
            if (window.appEventBus) {
                window.appEventBus.emit('page:shown', { page: 'coinbook' });
            }
        } else if (page === 'tools' && toolsPage) {
            toolsPage.style.display = 'block';
            document.body.classList.remove('login-page-active');
            // Initialize tools page
            if (window.initToolsPage) {
                window.initToolsPage();
            }
        }
        
        // Update active nav link
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        const activeLink = document.querySelector(`[data-page="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Emit page:shown event for integrations
        if (window.appEventBus) {
            // Extract page type and identifier for tracking
            let pageType = page;
            let identifier = null;
            
            if (page.startsWith('user/')) {
                pageType = 'profile';
                identifier = page.split('/')[1];
            } else if (page.startsWith('product/')) {
                pageType = 'product_detail';
                identifier = page.split('/')[1];
            }
            
            window.appEventBus.emit('page:shown', { 
                page: pageType, 
                identifier: identifier 
            });
        }
        
        // Track page view for live user monitoring
        if (window.socket && window.socket.connected) {
            window.socket.emit('page:view', { page });
        }
        
        // Remove page transition class after all page setup is complete
        document.body.classList.remove('page-transitioning');
    }

    // Customer authentication elements
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameSpan = document.getElementById('userName');

    // Authentication helper functions
    function isUserAuthenticated() {
        // Check multiple sources for authentication state
        const userProfile = document.getElementById('userProfile');
        const storedCustomer = localStorage.getItem('customerInfo');
        
        // Check if user profile is visible OR we have stored customer data
        return (userProfile && userProfile.style.display !== 'none') || 
               (storedCustomer && storedCustomer !== 'null');
    }

    async function isUserAuthenticatedAsync() {
        // Server-side authentication check for reliable verification
        try {
            const response = await fetch('/api/customer/status');
            const data = await response.json();
            return data.authenticated === true;
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        }
    }

    async function checkSession() {
        // Server-side session check that returns session data
        try {
            const response = await fetch('/api/customer/status');
            const data = await response.json();
            
            if (data.authenticated && data.customer) {
                // Update stored customer info for compatibility (server-side cookie is primary)
                if (data.sessionId) {
                    localStorage.setItem('customerSessionId', data.sessionId);
                }
                localStorage.setItem('customerInfo', JSON.stringify(data.customer));
                localStorage.setItem('userRole', data.role || 'user');
                updateAuthUI(data.customer, data.role);
                console.log('✅ 90-day customer session validated:', data.customer.displayName);
                
                return {
                    authenticated: true,
                    sessionId: data.sessionId,
                    customer: data.customer,
                    role: data.role
                };
            } else {
                // Session expired or invalid - clear local data
                localStorage.removeItem('customerSessionId');
                localStorage.removeItem('customerInfo');
                localStorage.removeItem('userRole');
                updateAuthUI(null, null);
                console.log('❌ Customer session expired or not found');
                
                return {
                    authenticated: false,
                    sessionId: null,
                    customer: null
                };
            }
        } catch (error) {
            console.error('Auth status check failed:', error);
            return {
                authenticated: false,
                sessionId: null,
                customer: null
            };
        }
    }

    function showLoginRequiredMessage(intendedPage = null) {
        // Save the intended page for redirect after login
        if (intendedPage) {
            sessionStorage.setItem('redirectAfterLogin', intendedPage);
        }
        // Replace current history entry to avoid back button loop
        history.replaceState(null, '', '#login');
        // Trigger routing to show login page
        handleRouting();
    }

    // Global navigation functions for backwards compatibility and onclick handlers
    window.showRankPage = async function() {
        // Check authentication before accessing ranking page
        if (!isUserAuthenticated()) {
            const isAuthenticatedAsync = await isUserAuthenticatedAsync();
            if (!isAuthenticatedAsync) {
                showLoginRequiredMessage('rank');
                return;
            }
        }
        
        window.location.hash = '#rank';
    };

    window.showProductsPage = async function() {
        window.location.hash = '#products';
    };

    window.showCommunityPage = async function() {
        // Check authentication before accessing community page
        if (!isUserAuthenticated()) {
            const isAuthenticatedAsync = await isUserAuthenticatedAsync();
            if (!isAuthenticatedAsync) {
                showLoginRequiredMessage('community');
                return;
            }
        }
        
        window.location.hash = '#community';
    };

    window.showProfilePage = async function() {
        // Check authentication before accessing profile page
        if (!isUserAuthenticated()) {
            const isAuthenticatedAsync = await isUserAuthenticatedAsync();
            if (!isAuthenticatedAsync) {
                showLoginRequiredMessage('profile');
                return;
            }
        }
        
        window.location.hash = '#profile';
    };

    window.showHomePage = function() {
        window.location.hash = '';
    };

    // Customer authentication functions
    if (loginBtn) {
        loginBtn.addEventListener('click', initiateCustomerLogin);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', customerLogout);
    }

    async function initiateCustomerLogin() {
        console.log('🔑 Navigating to login page...');
        // Navigate to login page instead of opening popup
        await showPage('login');
    }
    
    // Login form handler
    const submitLoginBtn = document.getElementById('submitLoginBtn');
    const loginEmail = document.getElementById('loginEmail');
    const loginMessage = document.getElementById('loginMessage');
    
    if (submitLoginBtn) {
        submitLoginBtn.addEventListener('click', async () => {
            const email = loginEmail?.value?.trim();
            
            if (!email) {
                showLoginMessage('Please enter your email address', 'error');
                return;
            }
            
            // Disable button during submission
            submitLoginBtn.disabled = true;
            submitLoginBtn.textContent = 'Sending...';
            
            try {
                const response = await fetch('/api/customer/email-login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showLoginMessage(data.message || 'Check your email for a login link!', 'success');
                    if (loginEmail) loginEmail.value = '';
                } else {
                    showLoginMessage(data.error || 'Failed to send login link', 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                showLoginMessage('Failed to send login link. Please try again.', 'error');
            } finally {
                submitLoginBtn.disabled = false;
                submitLoginBtn.textContent = 'Send Login Link';
            }
        });
    }
    
    // Allow Enter key to submit
    if (loginEmail) {
        loginEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitLoginBtn?.click();
            }
        });
    }
    
    function showLoginMessage(message, type) {
        if (!loginMessage) return;
        
        loginMessage.textContent = message;
        loginMessage.className = `login-message ${type}`;
        loginMessage.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            loginMessage.style.display = 'none';
        }, 5000);
    }

    async function customerLogout() {
        try {
            // Logout endpoint now handles HTTP-only cookies automatically
            const response = await fetch('/api/customer/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            if (response.ok) {
                // Clear localStorage for compatibility
                localStorage.removeItem('customerSessionId');
                localStorage.removeItem('customerInfo');
                
                // Update UI
                updateAuthUI(null, null);
                
                console.log('🔌 Customer logged out successfully (90-day session cleared)');
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    function updateAuthUI(customer, role) {
        const loginBtn = document.getElementById('loginBtn');
        const userProfile = document.getElementById('userProfile');
        const userAvatar = document.getElementById('userAvatar');
        const toolsNavLink = document.getElementById('toolsNavLink');
        
        if (customer) {
            // Show logged in state
            if (loginBtn) loginBtn.style.display = 'none';
            if (userProfile) userProfile.style.display = 'flex';
            
            // Set user avatar with initials
            if (userAvatar) {
                const name = customer.displayName || customer.firstName || customer.email;
                const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                userAvatar.textContent = initials;
                
                // Add click handler to navigate to profile page
                userAvatar.onclick = () => showPage('profile');
                
                // Add keyboard support for accessibility
                userAvatar.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        showPage('profile');
                    }
                };
            }
            
            // Show Tools link for employees only
            if (toolsNavLink) {
                toolsNavLink.style.display = (role === 'employee_admin') ? 'inline' : 'none';
            }
        } else {
            // Show logged out state
            if (loginBtn) loginBtn.style.display = 'inline';
            if (userProfile) userProfile.style.display = 'none';
            if (userAvatar) userAvatar.textContent = '';
            if (toolsNavLink) toolsNavLink.style.display = 'none';
        }
    }

    // Function to check customer authentication status on page load (90-day cookie support)
    async function checkCustomerAuthStatus() {
        try {
            // Check server-side authentication (HTTP-only cookies + backwards compatibility)
            const response = await fetch('/api/customer/status');
            const data = await response.json();
            
            if (data.authenticated && data.customer) {
                // Update stored customer info for compatibility (server-side cookie is primary)
                if (data.sessionId) {
                    localStorage.setItem('customerSessionId', data.sessionId);
                }
                localStorage.setItem('customerInfo', JSON.stringify(data.customer));
                localStorage.setItem('userRole', data.role || 'user');
                updateAuthUI(data.customer, data.role);
                console.log('✅ 90-day customer session validated:', data.customer.displayName);
            } else {
                // Session expired or invalid - clear local data
                localStorage.removeItem('customerSessionId');
                localStorage.removeItem('customerInfo');
                localStorage.removeItem('userRole');
                updateAuthUI(null, null);
                console.log('❌ Customer session expired or not found');
            }
        } catch (error) {
            console.error('Auth status check failed:', error);
            updateAuthUI(null);
        }
    }
    
    // Handle login success from URL hash (when magic link redirects directly)
    function handleLoginSuccessFromURL() {
        const hash = window.location.hash;
        if (hash.includes('login-success')) {
            const urlParams = new URLSearchParams(hash.substring(hash.indexOf('?') + 1));
            const sessionId = urlParams.get('sessionId');
            
            if (sessionId) {
                console.log('✅ Login success detected from URL, sessionId:', sessionId);
                
                // Verify session with server
                fetch(`/api/customer/status?sessionId=${encodeURIComponent(sessionId)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.authenticated && data.customer) {
                            // Store session info
                            localStorage.setItem('customerSessionId', sessionId);
                            localStorage.setItem('customerInfo', JSON.stringify(data.customer));
                            localStorage.setItem('userRole', data.role || 'user');
                            
                            // Update UI with role to show Tools menu for employees
                            updateAuthUI(data.customer, data.role);
                            
                            console.log('✅ Customer login restored from URL:', data.customer);
                            
                            // Authenticate WebSocket with the sessionId
                            if (window.socket && window.socket.connected) {
                                window.socket.emit('auth', { sessionId });
                            }
                            
                            // Redirect to intended page or home
                            const redirectTo = sessionStorage.getItem('redirectAfterLogin') || 'home';
                            sessionStorage.removeItem('redirectAfterLogin');
                            console.log(`✅ Redirecting after login to: ${redirectTo}`);
                            
                            // Clean up URL and redirect
                            window.location.hash = `#${redirectTo}`;
                        }
                    })
                    .catch(error => {
                        console.error('Failed to verify session from URL:', error);
                    });
            }
        }
    }

    // Product ranking system variables - declare before routing to avoid initialization errors
    let rankingSlots = [];
    let currentProducts = [];
    let currentPage = 1;
    let isLoading = false;
    let hasMoreProducts = true;
    let currentSearchQuery = '';
    let totalProductCount = 0; // Track total rankable products for progress calculation

    // ========== ROUTING SYSTEM ==========
    // Simple hash-based routing - URL is single source of truth
    
    function handleRouting() {
        const hash = window.location.hash.replace('#', '');
        const fullPage = hash || 'home';
        const page = fullPage.split('?')[0] || 'home';
        
        console.log(`🔀 Hash changed to: "${hash}" → Routing to: "${page}"`);
        console.log(`🎭 Loading class status BEFORE showPage:`, document.body.classList.contains('app-loading'));
        
        // Show the page based on URL hash, don't update URL (prevent loop)
        showPage(page, false);
        
        console.log(`🎭 Loading class status AFTER showPage:`, document.body.classList.contains('app-loading'));
        
        // Remove app-loading class after first page is shown via routing (prevents flash on initial load)
        // This ensures content only appears AFTER the correct page is determined from the hash
        document.body.classList.remove('app-loading');
        
        console.log(`✅ Loading class removed - content now visible for page: "${page}"`);
    }
    
    // Handle URL hash changes (back/forward buttons, direct links)
    window.addEventListener('hashchange', handleRouting);
    
    // Initialize routing after DOM is ready
    function initializeRouting() {
        // If no hash on initial load, set it to #home for proper browser history
        if (!window.location.hash) {
            window.location.hash = '#home';
            // hashchange event will fire and call handleRouting
        } else {
            // Hash exists, handle it
            handleRouting();
        }
        
        checkCustomerAuthStatus();
        handleLoginSuccessFromURL();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeRouting);
    } else {
        // DOM already loaded
        initializeRouting();
    }

    // Helper function to clear a ranking slot
    function clearSlot(slot) {
        const rank = parseInt(slot.dataset.rank);
        slot.classList.remove('filled');
        slot.innerHTML = `
            <div class="slot-number">${rank}</div>
            <div class="slot-placeholder">Drop a product here to rank #${rank}</div>
        `;
        delete slot.dataset.productId;
        delete slot.dataset.productData;
        updateProgressIndicators(); // Update progress when slot is cleared
    }

    // Load rank page data (rankings + products)
    async function loadRankPageData() {
        if (!document.getElementById('rankingSlots')) return;
        
        // IMPORTANT: Reset product state to prevent stale data when navigating back to rank page
        currentProducts = [];
        currentPage = 1;
        hasMoreProducts = true;
        currentSearchQuery = '';
        console.log('🔄 Reset product state for fresh load');
        
        // Only generate slots if they don't exist yet
        if (rankingSlots.length === 0) {
            generateRankingSlots(10); // Start with 10 slots
            setupEventListeners();
        } else {
            // Clear existing rankings on reload to show fresh data
            rankingSlots.forEach(slot => {
                clearSlot(slot);
            });
            lastSavedProductIds = new Set();
            console.log('🗑️ Cleared existing rankings for reload');
        }
        
        showRankingLoadStatus(); // Show loading indicator
        
        // Load rankings and products simultaneously for better performance
        console.log('🚀 Loading rankings and products in parallel...');
        try {
            await Promise.all([
                loadUserRankings(), // Load user's saved rankings
                loadProductsForInitialLoad() // Load initial products (modified for parallel loading)
            ]);
            console.log('✅ Both rankings and products loaded successfully');
        } catch (error) {
            console.error('❌ Error during parallel loading:', error);
        } finally {
            hideRankingLoadStatus(); // Hide loading indicator only after both complete
        }
    }
    
    // Note: Product removal now happens optimistically (immediately when ranked)
    // See insertProductWithPushDown() and replaceProductAtPosition() for implementation

    // Update progress indicators (ranking progress bar and available count)
    function updateProgressIndicators() {
        const rankingProgressText = document.getElementById('rankingProgressText');
        const rankingProgressBar = document.getElementById('rankingProgressBar');
        const availableProductsText = document.getElementById('availableProductsText');
        
        if (!rankingProgressText || !rankingProgressBar || !availableProductsText) return;
        
        // Count filled slots
        const filledSlots = rankingSlots.filter(slot => slot.classList.contains('filled'));
        const rankedCount = filledSlots.length;
        const totalCount = totalProductCount || 0;
        const availableCount = currentProducts.length;
        
        // Calculate percentage
        const percentage = totalCount > 0 ? Math.round((rankedCount / totalCount) * 100) : 0;
        
        // Update ranking side
        rankingProgressText.textContent = `${rankedCount} of ${totalCount} ranked (${percentage}%)`;
        rankingProgressBar.style.width = `${percentage}%`;
        
        // Update search side
        availableProductsText.textContent = `${availableCount} available to rank`;
    }


    // Special version of loadProducts for initial parallel loading (no duplicate loading indicators)
    async function loadProductsForInitialLoad() {
        if (isLoading) {
            console.log('⏳ Products already loading, skipping duplicate call');
            return;
        }

        const productList = document.getElementById('productList');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        
        if (!productList) return;

        // Reset state for initial load
        currentPage = 1;
        hasMoreProducts = true;
        productList.innerHTML = '';

        isLoading = true;
        // Don't show productLoading indicator - using unified ranking load status instead

        try {
            const response = await fetch(`/api/products/rankable?query=&page=${currentPage}&limit=20&sort=name-asc`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load products');
            }

            currentProducts = data.products;
            totalProductCount = data.total || 0; // Store for progress calculation
            displayProducts();
            hasMoreProducts = data.hasMore;
            updateProgressIndicators(); // Update progress after loading products
            
            if (hasMoreProducts) {
                const totalProducts = data.total || 0;
                const loadedProducts = currentProducts.length;
                const remaining = totalProducts - loadedProducts;
                
                // Show "Load 20 more products" or "Load X more products" based on remaining
                if (remaining >= 20) {
                    loadMoreBtn.textContent = 'Load 20 more products';
                } else if (remaining > 0) {
                    loadMoreBtn.textContent = `Load ${remaining} more product${remaining === 1 ? '' : 's'}`;
                }
                
                loadMoreBtn.style.display = 'block';
                currentPage++;
            } else {
                loadMoreBtn.style.display = 'none';
            }

            console.log(`✅ Loaded ${data.products.length} products (total: ${currentProducts.length})`);

        } catch (error) {
            console.error('Error loading products:', error);
            productList.innerHTML = '<div style="color: #dc3545; text-align: center; padding: 20px;">Error loading products. Please try again.</div>';
        } finally {
            isLoading = false;
            // Don't hide productLoading here - managed by unified indicator
        }
    }

    // Load user's saved rankings from database
    async function loadUserRankings() {
        try {
            const sessionData = await checkSession();
            if (!sessionData.authenticated) {
                console.log('❌ User not authenticated, skipping ranking load');
                return;
            }

            const response = await fetch(`/api/rankings/products?sessionId=${sessionData.sessionId}&rankingListId=default`);
            const data = await response.json();

            if (response.ok && data.rankings && data.rankings.length > 0) {
                console.log(`✅ Loaded ${data.rankings.length} saved rankings`);
                
                // First, ensure we have enough slots for all saved rankings
                const maxRank = Math.max(...data.rankings.map(r => r.ranking));
                if (maxRank >= 10) {
                    const slotsNeeded = maxRank + 3; // Add 3 more slots beyond highest rank
                    if (slotsNeeded > rankingSlots.length) {
                        // Add additional slots BEFORE filling rankings
                        const additionalSlotsNeeded = slotsNeeded - rankingSlots.length;
                        addMoreRankingSlots(additionalSlotsNeeded);
                        console.log(`📈 Pre-expanded slots to ${rankingSlots.length} to accommodate rank ${maxRank}`);
                    }
                }
                
                // Now populate ALL ranking slots with saved rankings (all slots exist)
                data.rankings.forEach(ranking => {
                    const slot = document.querySelector(`[data-rank="${ranking.ranking}"]`);
                    if (slot) {
                        fillSlot(slot, ranking.ranking, ranking.productData);
                    } else {
                        console.error(`❌ Slot ${ranking.ranking} not found after expansion!`);
                    }
                });
                
                // Initialize lastSavedProductIds with loaded rankings
                lastSavedProductIds = new Set(data.rankings.map(r => r.productData.id));
                
                // Refresh product display to filter out already-ranked products
                displayProducts();
                
                // Update progress indicators after loading rankings
                updateProgressIndicators();
            } else {
                console.log('📝 No saved rankings found, starting fresh');
                updateProgressIndicators(); // Update even if no rankings (will show 0%)
            }
        } catch (error) {
            console.error('❌ Error loading user rankings:', error);
        }
    }

    // Expose globally for page navigation reloads
    window.reloadRankPageData = loadRankPageData;
    
    // Expose function to open rank modal by product ID
    window.openRankModalById = function(productId) {
        const product = currentProducts.find(p => p.id === productId);
        if (product) {
            console.log(`🎯 Opening rank modal for product ${productId}`);
            openRankModal(product);
        } else {
            console.error(`❌ Product ${productId} not found in current products`);
        }
    };

    // Generate ranking slots
    function generateRankingSlots(count) {
        const slotsContainer = document.getElementById('rankingSlots');
        if (!slotsContainer) return;

        // Clear existing slots
        slotsContainer.innerHTML = '';
        rankingSlots = [];

        for (let i = 1; i <= count; i++) {
            const slot = document.createElement('div');
            slot.className = 'ranking-slot';
            slot.dataset.rank = i;
            slot.innerHTML = `
                <div class="slot-number">${i}</div>
                <div class="slot-placeholder">Drop a product here to rank #${i}</div>
            `;
            
            // Add drag and drop event listeners
            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('drop', handleDrop);
            slot.addEventListener('dragleave', handleDragLeave);
            
            slotsContainer.appendChild(slot);
            rankingSlots.push(slot);
        }
    }

    // Load products from Shopify
    async function loadProducts(query = '', reset = false) {
        if (isLoading) return;
        
        const productLoading = document.getElementById('productLoading');
        const productList = document.getElementById('productList');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        
        if (!productList) return;

        if (reset) {
            currentPage = 1;
            hasMoreProducts = true;
            productList.innerHTML = '';
        }

        isLoading = true;
        productLoading.style.display = 'block';
        loadMoreBtn.style.display = 'none';

        try {
            const response = await fetch(`/api/products/rankable?query=${encodeURIComponent(query)}&page=${currentPage}&limit=20&sort=name-asc`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load products');
            }

            // Handle edge case: if we got 0 products but total shows more exist,
            // it means our current page is beyond available pages (products were ranked)
            // Reset to page 1 and try again
            if (data.products.length === 0 && data.total > 0 && currentPage > 1) {
                console.log(`📄 Page ${currentPage} returned 0 products but ${data.total} total exist - resetting to page 1`);
                currentPage = 1;
                currentProducts = [];
                isLoading = false;
                loadProducts(query, true);
                return;
            }

            if (reset) {
                currentProducts = data.products;
                totalProductCount = data.total || 0; // Store for progress calculation
            } else {
                currentProducts = [...currentProducts, ...data.products];
                totalProductCount = data.total || 0; // Update total count
            }

            // Update hasMoreProducts BEFORE calling displayProducts() so it has the latest value
            hasMoreProducts = data.hasMore;
            updateProgressIndicators(); // Update progress after loading products
            
            // Reset the stale-state check flag only when we get products OR when hasMore is true
            // This allows the fallback to trigger again for subsequent batches
            // But prevents infinite loops when truly no products remain
            if (data.products.length > 0 || hasMoreProducts) {
                window._finalProductCheck = false;
            }
            
            if (hasMoreProducts) {
                const totalProducts = data.total || 0;
                const loadedProducts = currentProducts.length;
                const remaining = totalProducts - loadedProducts;
                
                // Show "Load 20 more products" or "Load X more products" based on remaining
                if (remaining >= 20) {
                    loadMoreBtn.textContent = 'Load 20 more products';
                } else if (remaining > 0) {
                    loadMoreBtn.textContent = `Load ${remaining} more product${remaining === 1 ? '' : 's'}`;
                }
                
                loadMoreBtn.style.display = 'block';
                currentPage++;
            } else {
                loadMoreBtn.style.display = 'none';
            }

            console.log(`✅ Loaded ${data.products.length} products (total: ${currentProducts.length})`);

        } catch (error) {
            console.error('Error loading products:', error);
            productList.innerHTML = '<div style="color: #dc3545; text-align: center; padding: 20px;">Error loading products. Please try again.</div>';
        } finally {
            isLoading = false;
            productLoading.style.display = 'none';
            
            // CRITICAL: After loading completes, re-check if we need to auto-load more products
            // This handles the case where the newly loaded products are also all ranked
            displayProducts();
        }
    }

    // Toggle rankings panel collapse/expand
    function toggleRankingsPanel() {
        const rankingPanel = document.getElementById('rankingPanel');
        const toggleBtn = document.getElementById('toggleRankingsBtn');
        
        if (!rankingPanel || !toggleBtn) return;
        
        if (rankingPanel.classList.contains('collapsed')) {
            rankingPanel.classList.remove('collapsed');
            toggleBtn.innerHTML = '▼ Collapse';
        } else {
            rankingPanel.classList.add('collapsed');
            toggleBtn.innerHTML = '▶ Expand';
        }
    }

    // Display products in the grid
    function displayProducts() {
        const productList = document.getElementById('productList');
        if (!productList) return;

        productList.innerHTML = '';

        // Get currently ranked product IDs from slots (client-side filter)
        const rankedProductIds = new Set();
        rankingSlots.forEach(slot => {
            if (slot.classList.contains('filled') && slot.dataset.productData) {
                const productData = JSON.parse(slot.dataset.productData);
                rankedProductIds.add(productData.id);
            }
        });

        // Filter out products that are already ranked in slots
        const unrankedProducts = currentProducts.filter(product => !rankedProductIds.has(product.id));

        // Show message if no products available
        if (unrankedProducts.length === 0) {
            // If currently loading, show loading indicator
            if (isLoading) {
                productList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666; font-size: 16px;">⏳ Loading more products...</div>';
                return;
            }
            
            // If more products are available, auto-load them (works for both search and default)
            if (hasMoreProducts) {
                console.log('🚀 Auto-loading more products - all visible products have been ranked');
                loadProducts(currentSearchQuery, false); // Load next page (maintains current search)
                productList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666; font-size: 16px;">⏳ Loading more products...</div>';
                return;
            }
            
            // FALLBACK: If hasMoreProducts is false, do one final check by resetting to page 1
            // to ensure server-side state is current. This handles the case where products
            // were ranked rapidly and client state is stale (even if all products were removed).
            if (!hasMoreProducts && !window._finalProductCheck) {
                console.log('🔄 No visible products remaining - performing final server check for stale state');
                window._finalProductCheck = true; // Prevent infinite loops (reset on successful load)
                loadProducts(currentSearchQuery, true); // Reset and reload from page 1
                productList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666; font-size: 16px;">⏳ Checking for more products...</div>';
                return;
            }
            
            // No more products to load, show completion message
            const message = currentSearchQuery 
                ? `✅ No more unranked "${currentSearchQuery}" products<br><span style="font-size: 14px; color: #999; margin-top: 8px; display: block;">All matching products have been ranked!</span>`
                : '✅ No unranked products found<br><span style="font-size: 14px; color: #999; margin-top: 8px; display: block;">All products have been ranked!</span>';
            productList.innerHTML = `<div style="text-align: center; padding: 40px; color: #666; font-size: 16px;">${message}</div>`;
            return;
        }

        // Display unranked products
        unrankedProducts.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            
            // Only enable drag-and-drop on desktop (> 768px)
            const isMobile = window.innerWidth <= 768;
            productCard.draggable = !isMobile;
            
            productCard.dataset.productId = product.id;
            productCard.dataset.productData = JSON.stringify(product);

            productCard.innerHTML = `
                ${product.image ? `<img src="${product.image}" alt="${product.title}" class="product-image">` : '<div class="product-image" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999;">No Image</div>'}
                <div class="product-title">${product.title}</div>
                <div class="product-vendor">${product.vendor || 'Unknown Brand'}</div>
                <div class="product-price">$${product.price}</div>
                <button class="rank-btn">Rank This Product</button>
            `;

            // Only add drag event listeners on desktop
            if (!isMobile) {
                productCard.addEventListener('dragstart', handleDragStart);
                productCard.addEventListener('dragend', handleDragEnd);
            }

            // Add rank button event listener
            const rankBtn = productCard.querySelector('.rank-btn');
            rankBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openRankModal(product);
            });

            productList.appendChild(productCard);
        });
        
        updateProgressIndicators(); // Update progress after displaying products
    }

    // Setup event listeners for ranking system
    function setupEventListeners() {
        const productSearch = document.getElementById('productSearch');
        const searchBtn = document.getElementById('searchBtn');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const clearRankingBtn = document.getElementById('clearRankingBtn');

        if (productSearch && searchBtn) {
            let searchTimeout;

            const performSearch = () => {
                currentSearchQuery = productSearch.value.trim();
                loadProducts(currentSearchQuery, true);
            };

            // Type-ahead search when user enters 3+ characters
            productSearch.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                
                // Clear previous timeout
                clearTimeout(searchTimeout);
                
                // If 3+ characters, perform search after short delay
                if (query.length >= 3) {
                    searchTimeout = setTimeout(() => {
                        currentSearchQuery = query;
                        loadProducts(currentSearchQuery, true);
                        console.log(`🔍 Type-ahead search: "${query}"`);
                    }, 300); // 300ms delay to avoid too many API calls
                } else if (query.length === 0) {
                    // If search is cleared, load all products
                    searchTimeout = setTimeout(() => {
                        currentSearchQuery = '';
                        loadProducts('', true);
                        console.log('🔍 Search cleared, loading all products');
                    }, 300);
                }
            });

            // Manual search button and Enter key
            searchBtn.addEventListener('click', performSearch);
            productSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
        }

        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                loadProducts(currentSearchQuery, false);
            });
        }


        if (clearRankingBtn) {
            clearRankingBtn.addEventListener('click', showClearModal);
        }

        // Toggle rankings collapse on mobile
        const toggleRankingsBtn = document.getElementById('toggleRankingsBtn');
        if (toggleRankingsBtn) {
            toggleRankingsBtn.addEventListener('click', toggleRankingsPanel);
        }

        // Track previous viewport state to detect breakpoint changes
        let wasMobile = window.innerWidth <= 768;
        
        // Handle viewport resize to maintain proper state
        function handleViewportResize() {
            const rankingPanel = document.getElementById('rankingPanel');
            const toggleBtn = document.getElementById('toggleRankingsBtn');
            const isMobileNow = window.innerWidth <= 768;
            
            if (!rankingPanel || !toggleBtn) return;
            
            // Detect if we crossed the breakpoint
            const crossedBreakpoint = wasMobile !== isMobileNow;
            
            if (!isMobileNow) {
                // Desktop mode: always expand rankings
                rankingPanel.classList.remove('collapsed');
                toggleBtn.innerHTML = '▼ Collapse';
            } else {
                // Mobile mode: collapsed by default (only on first load)
                if (!rankingPanel.dataset.initialized) {
                    rankingPanel.classList.add('collapsed');
                    toggleBtn.innerHTML = '▶ Expand';
                    rankingPanel.dataset.initialized = 'true';
                }
            }
            
            // Re-render products if we crossed the breakpoint to update draggable state
            if (crossedBreakpoint && currentProducts.length > 0) {
                displayProducts();
            }
            
            wasMobile = isMobileNow;
        }
        
        // Initial check
        handleViewportResize();
        
        // Listen for viewport changes (debounced to avoid too many re-renders)
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleViewportResize, 150);
        });

        // Modal event listeners
        const cancelClearBtn = document.getElementById('cancelClearBtn');
        const confirmClearBtn = document.getElementById('confirmClearBtn');
        const clearModal = document.getElementById('clearModal');

        if (cancelClearBtn) {
            cancelClearBtn.addEventListener('click', hideClearModal);
        }

        if (confirmClearBtn) {
            confirmClearBtn.addEventListener('click', clearAllRankings);
        }

        // Close modal when clicking outside of it
        if (clearModal) {
            clearModal.addEventListener('click', (e) => {
                if (e.target === clearModal) {
                    hideClearModal();
                }
            });
        }

        // Ranking modal event listeners
        const rankModal = document.getElementById('rankModal');
        const closeRankModalBtn = document.getElementById('closeRankModal');

        if (closeRankModalBtn) {
            closeRankModalBtn.addEventListener('click', closeRankModal);
        }

        // Close rank modal when clicking outside of it
        if (rankModal) {
            rankModal.addEventListener('click', (e) => {
                if (e.target === rankModal) {
                    closeRankModal();
                }
            });
        }
    }

    // Drag and drop handlers
    let draggedProduct = null;
    let draggedSlot = null;

    function handleDragStart(e) {
        // Find the product card (might be dragging a child element)
        const productCard = e.target.closest('.product-card');
        if (!productCard || !productCard.dataset.productData) {
            console.error('❌ Could not find product data for drag operation');
            return;
        }

        draggedProduct = {
            id: productCard.dataset.productId,
            data: JSON.parse(productCard.dataset.productData)
        };
        productCard.classList.add('dragging');
    }

    function handleDragEnd(e) {
        // Find the product card (might be dragging a child element)
        const productCard = e.target.closest('.product-card');
        if (productCard) {
            productCard.classList.remove('dragging');
        }
        draggedProduct = null;
    }

    // Slot-to-slot drag handlers for reordering
    function handleSlotDragStart(e) {
        // Get the slot directly (since we're binding to the slot itself now)
        const slot = e.currentTarget;
        
        // Only allow dragging if slot is filled
        if (!slot.classList.contains('filled')) {
            e.preventDefault();
            return;
        }
        
        // Clear any product drag state
        draggedProduct = null;
        
        // Set slot drag state
        draggedSlot = slot;
        
        // Set up data transfer for proper drag/drop
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `slot-${slot.dataset.rank}`);
        
        // Visual feedback - add dragging class to entire slot
        slot.classList.add('dragging');
        
        console.log(`🎯 Started dragging slot ${slot.dataset.rank}`);
    }

    function handleSlotDragEnd(e) {
        if (draggedSlot) {
            // Remove dragging class from entire slot
            draggedSlot.classList.remove('dragging');
            console.log(`🎯 Ended dragging slot ${draggedSlot.dataset.rank}`);
            draggedSlot = null;
        }
    }

    function reorderSlots(sourceRank, targetRank) {
        const sourceSlot = rankingSlots[sourceRank - 1];
        const targetSlot = rankingSlots[targetRank - 1];
        
        if (!sourceSlot || !targetSlot) return;
        
        // Ensure source slot is filled and has valid product data
        if (!sourceSlot.classList.contains('filled') || 
            !sourceSlot.dataset.productData || 
            sourceSlot.dataset.productData === 'undefined') {
            console.warn(`⚠️ Cannot reorder: source slot ${sourceRank} is empty or has no product data`);
            return;
        }
        
        // Get the product data from source
        const sourceProductData = JSON.parse(sourceSlot.dataset.productData);
        
        // Collect all filled slots and their data
        const allRankedItems = [];
        rankingSlots.forEach((slot, index) => {
            const rank = index + 1;
            if (slot.classList.contains('filled') && rank !== sourceRank) {
                allRankedItems.push({
                    rank: rank,
                    data: JSON.parse(slot.dataset.productData)
                });
            }
        });
        
        // Clear all slots first - do this directly without calling removeFromSlot
        // to avoid cascading move-up logic that interferes with reordering
        rankingSlots.forEach((slot, index) => {
            const rank = index + 1;
            if (slot.classList.contains('filled')) {
                slot.classList.remove('filled');
                slot.innerHTML = `
                    <div class="slot-number">${rank}</div>
                    <div class="slot-placeholder">Drop a product here to rank #${rank}</div>
                `;
                delete slot.dataset.productData;
                
                // Remove drag listeners for filled slots
                slot.draggable = false;
                slot.removeEventListener('dragstart', handleSlotDragStart);
                slot.removeEventListener('dragend', handleSlotDragEnd);
            }
        });
        
        // Rebuild the rankings with correct behavior based on direction
        let currentRank = 1;
        
        if (sourceRank < targetRank) {
            // Moving DOWN (e.g., 2→3): Items between source and target shift up
            allRankedItems.forEach(item => {
                if (item.rank < sourceRank) {
                    // Items before source stay in place
                    fillSlot(rankingSlots[currentRank - 1], currentRank, item.data);
                    currentRank++;
                } else if (item.rank > sourceRank && item.rank <= targetRank) {
                    // Items between source (exclusive) and target (inclusive) shift up
                    fillSlot(rankingSlots[currentRank - 1], currentRank, item.data);
                    currentRank++;
                }
            });
            
            // Insert the dragged item at target position
            fillSlot(rankingSlots[currentRank - 1], currentRank, sourceProductData);
            currentRank++;
            
            // Items after target position stay in their relative positions
            allRankedItems.forEach(item => {
                if (item.rank > targetRank) {
                    if (currentRank <= rankingSlots.length) {
                        fillSlot(rankingSlots[currentRank - 1], currentRank, item.data);
                        currentRank++;
                    }
                }
            });
            
            console.log(`🔄 Move-down reorder: moved rank ${sourceRank} to rank ${targetRank}, shifted items up`);
        } else {
            // Moving UP (e.g., 3→2): Items at/after target shift down (original logic)
            // Place items before the target position
            allRankedItems.forEach(item => {
                if (item.rank < targetRank) {
                    fillSlot(rankingSlots[currentRank - 1], currentRank, item.data);
                    currentRank++;
                }
            });
            
            // Insert the dragged item at target position
            fillSlot(rankingSlots[currentRank - 1], currentRank, sourceProductData);
            currentRank++;
            
            // Place items that were at or after the target position (pushed down)
            allRankedItems.forEach(item => {
                if (item.rank >= targetRank) {
                    if (currentRank <= rankingSlots.length) {
                        fillSlot(rankingSlots[currentRank - 1], currentRank, item.data);
                        currentRank++;
                    }
                }
            });
            
            console.log(`🔄 Move-up reorder: moved rank ${sourceRank} to rank ${targetRank}, pushed items down`);
        }
        
        // Refresh product display to ensure UI is consistent
        displayProducts();
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
        console.log(`🎯 Drag over slot ${e.currentTarget.dataset.rank}`);
    }

    function handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        const targetSlot = e.currentTarget;
        const targetRank = parseInt(targetSlot.dataset.rank);
        
        console.log(`🎯 Drop on slot ${targetRank}, draggedSlot: ${draggedSlot ? draggedSlot.dataset.rank : 'none'}, draggedProduct: ${draggedProduct ? 'yes' : 'none'}`);
        
        // Handle drag from slot to slot (reordering)
        if (draggedSlot) {
            const sourceRank = parseInt(draggedSlot.dataset.rank);
            
            console.log(`🔄 Attempting reorder from slot ${sourceRank} to slot ${targetRank}`);
            
            // Don't reorder if dropping on the same slot
            if (sourceRank === targetRank) {
                console.log(`🚫 Same slot, no reorder needed`);
                return;
            }
            
            // Swap or reorder the items
            reorderSlots(sourceRank, targetRank);
            
            // Trigger auto-save after reordering
            scheduleAutoSave();
            
            return; // Exit early after handling slot reordering
        }
        
        // Handle drag from product search to slot
        if (draggedProduct) {
            console.log(`📦 Adding product to slot ${targetRank} with push-down`);
            
            // Insert product with push-down behavior
            insertProductWithPushDown(targetRank, draggedProduct.data);
            
            // Refresh product display to hide the ranked product
            displayProducts();
            
            // Check if we need to add more slots - use rank-specific check first, then general check
            checkAndAddMoreSlotsForRank(targetRank);
            checkAndAddMoreSlots();
            
            // Trigger auto-save
            scheduleAutoSave();
        }
    }

    function fillSlot(slot, rank, productData) {
        slot.classList.add('filled');
        slot.innerHTML = `
            <div class="slot-number">${rank}</div>
            <div class="ranked-product">
                ${productData.image ? `<img src="${productData.image}" alt="${productData.title}" class="ranked-product-image">` : '<div class="ranked-product-image" style="background: #f0f0f0;"></div>'}
                <div class="ranked-product-info">
                    <div class="ranked-product-title">${productData.title}</div>
                    <div class="ranked-product-vendor">${productData.vendor || 'Unknown Brand'}</div>
                </div>
                <button class="remove-btn" onclick="removeFromSlot(${rank})" title="Remove">×</button>
            </div>
        `;
        
        // Store product data on the slot
        slot.dataset.productData = JSON.stringify(productData);
        
        // Only make slot draggable on desktop (> 768px)
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            slot.draggable = true;
            slot.addEventListener('dragstart', handleSlotDragStart);
            slot.addEventListener('dragend', handleSlotDragEnd);
        }
        
        updateProgressIndicators(); // Update progress when slot is filled
    }

    // Track optimistically removed products for potential restoration on save failure
    let optimisticallyRemovedProducts = [];

    // Helper function to check if a product is already ranked
    function isProductAlreadyRanked(productId) {
        for (let i = 0; i < rankingSlots.length; i++) {
            const slot = rankingSlots[i];
            if (slot.classList.contains('filled')) {
                const slotProduct = JSON.parse(slot.dataset.productData);
                if (slotProduct.id === productId) {
                    return i + 1; // Return the rank position where it's found
                }
            }
        }
        return null; // Not found
    }

    function insertProductWithPushDown(targetRank, productData) {
        // Check if product is already ranked
        const existingRank = isProductAlreadyRanked(productData.id);
        if (existingRank !== null) {
            console.warn(`⚠️ Product "${productData.title}" is already ranked at position ${existingRank}`);
            if (window.appEventBus) {
                window.appEventBus.emit('notification:show', {
                    message: `This product is already ranked at position #${existingRank}`,
                    type: 'warning'
                });
            }
            return; // Prevent duplicate ranking
        }

        // OPTIMISTIC UI: Immediately remove product from available products list
        const productIndex = currentProducts.findIndex(p => p.id === productData.id);
        if (productIndex !== -1) {
            const removedProduct = currentProducts.splice(productIndex, 1)[0];
            optimisticallyRemovedProducts.push(removedProduct);
            console.log(`⚡ Optimistically removed product ${productData.id} from display`);
            displayProducts(); // Re-render immediately (includes auto-load check)
        }

        // Check if we're replacing a product (target slot is filled)
        const targetSlot = rankingSlots[targetRank - 1];
        let displacedProduct = null;
        
        if (targetSlot && targetSlot.classList.contains('filled')) {
            displacedProduct = JSON.parse(targetSlot.dataset.productData);
            console.log(`🔄 Replacing product at rank ${targetRank}: "${displacedProduct.title}" will be unranked`);
        }
        
        // Collect all items AFTER the target rank (to be pushed down)
        // Skip the target slot itself since we're replacing it, not pushing it
        const itemsToPushDown = [];
        for (let i = targetRank; i < rankingSlots.length; i++) {
            const slotToCheck = rankingSlots[i];
            if (slotToCheck.classList.contains('filled')) {
                itemsToPushDown.push({
                    rank: i + 1,
                    data: JSON.parse(slotToCheck.dataset.productData)
                });
            }
        }
        
        // Clear all slots from target rank onwards
        for (let i = targetRank - 1; i < rankingSlots.length; i++) {
            const slotToClear = rankingSlots[i];
            if (slotToClear.classList.contains('filled')) {
                slotToClear.classList.remove('filled');
                slotToClear.innerHTML = `
                    <div class="slot-number">${i + 1}</div>
                    <div class="slot-placeholder">Drop a product here to rank #${i + 1}</div>
                `;
                delete slotToClear.dataset.productData;
                
                // Remove drag listeners
                slotToClear.draggable = false;
                slotToClear.removeEventListener('dragstart', handleSlotDragStart);
                slotToClear.removeEventListener('dragend', handleSlotDragEnd);
            }
        }
        
        // Insert the new product at target rank
        fillSlot(rankingSlots[targetRank - 1], targetRank, productData);
        
        // Push existing items down by one position
        let highestPushedRank = targetRank;
        itemsToPushDown.forEach((item, index) => {
            const newRank = targetRank + 1 + index;
            if (newRank <= rankingSlots.length) {
                fillSlot(rankingSlots[newRank - 1], newRank, item.data);
                highestPushedRank = Math.max(highestPushedRank, newRank);
            }
        });
        
        // If a product was displaced, return it to the available products list
        // This happens when inserting into a filled slot (replacing scenario)
        if (displacedProduct) {
            const displacedProductId = displacedProduct.id;
            
            // Check if it's in the optimistically removed list
            const optimisticIndex = optimisticallyRemovedProducts.findIndex(p => p.id === displacedProductId);
            if (optimisticIndex !== -1) {
                // Restore from optimistic removal list
                const restoredProduct = optimisticallyRemovedProducts.splice(optimisticIndex, 1)[0];
                currentProducts.unshift(restoredProduct);
                console.log(`↩️ Restored displaced product ${displacedProductId} from optimistic removal list`);
            } else {
                // Check if it's already in currentProducts (shouldn't be, but guard against duplicates)
                const alreadyInProducts = currentProducts.some(p => p.id === displacedProductId);
                if (!alreadyInProducts) {
                    currentProducts.unshift(displacedProduct);
                    console.log(`↩️ Returned displaced product ${displacedProductId} to available products list`);
                }
            }
            
            // Re-render to show the displaced product
            displayProducts();
        }
        
        // Check if any pushed items landed in high-numbered slots that need expansion
        if (itemsToPushDown.length > 0) {
            checkAndAddMoreSlotsForRank(highestPushedRank);
        }
        
        console.log(`📦 Inserted product at rank ${targetRank}, pushed ${itemsToPushDown.length} items down`);
    }

    // Shared function for assigning products to slots (used by drag-drop)
    function assignProductToSlot(productData, slotIndex) {
        const targetRank = slotIndex + 1; // Convert from 0-indexed to 1-indexed
        
        console.log(`🎯 Assigning product "${productData.title}" to slot ${targetRank}`);
        
        // Insert product with push-down behavior
        insertProductWithPushDown(targetRank, productData);
        
        // Refresh product display to hide the ranked product
        displayProducts();
        
        // Check if we need to add more slots
        checkAndAddMoreSlotsForRank(targetRank);
        checkAndAddMoreSlots();
        
        // Trigger auto-save
        scheduleAutoSave();
    }

    // Open ranking modal with replace/insert options
    function openRankModal(productData) {
        const modal = document.getElementById('rankModal');
        const modalTitle = document.getElementById('rankModalTitle');
        const rankingPositions = document.getElementById('rankingPositions');
        
        if (!modal || !modalTitle || !rankingPositions) return;
        
        // Update modal title with product name and image (secure DOM manipulation)
        modalTitle.textContent = '';
        const headerContainer = document.createElement('div');
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.gap = '12px';
        
        // Add product image
        if (productData.image) {
            const img = document.createElement('img');
            img.src = productData.image;
            img.alt = productData.title;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.border = '2px solid #4a90e2';
            headerContainer.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.style.width = '60px';
            placeholder.style.height = '60px';
            placeholder.style.background = '#f0f0f0';
            placeholder.style.borderRadius = '8px';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.style.color = '#999';
            placeholder.style.fontSize = '12px';
            placeholder.textContent = 'No Image';
            headerContainer.appendChild(placeholder);
        }
        
        // Add product title
        const titleSpan = document.createElement('span');
        titleSpan.style.flex = '1';
        const truncatedTitle = productData.title.length > 40 
            ? productData.title.substring(0, 40) + '...' 
            : productData.title;
        titleSpan.textContent = truncatedTitle;
        headerContainer.appendChild(titleSpan);
        
        modalTitle.appendChild(headerContainer);
        
        // Clear previous content
        rankingPositions.innerHTML = '';
        
        // Build position items for each slot
        rankingSlots.forEach((slot, index) => {
            const position = index + 1;
            const isFilled = slot.classList.contains('filled');
            const currentProduct = isFilled && slot.dataset.productData 
                ? JSON.parse(slot.dataset.productData) 
                : null;
            
            const positionItem = document.createElement('div');
            positionItem.className = 'position-item';
            
            // Create position header
            const positionHeader = document.createElement('div');
            positionHeader.className = 'position-header';
            
            const positionNumber = document.createElement('span');
            positionNumber.className = 'position-number';
            positionNumber.textContent = `Position #${position}`;
            positionHeader.appendChild(positionNumber);
            
            const positionStatus = document.createElement('span');
            positionStatus.className = `position-status ${isFilled ? 'filled' : 'empty'}`;
            positionStatus.textContent = isFilled ? 'Filled' : 'Empty';
            positionHeader.appendChild(positionStatus);
            
            positionItem.appendChild(positionHeader);
            
            // Add current product info if filled
            if (currentProduct) {
                const productInfo = document.createElement('div');
                productInfo.className = 'position-product-info';
                
                // Add product image
                if (currentProduct.image) {
                    const img = document.createElement('img');
                    img.src = currentProduct.image;
                    img.alt = currentProduct.title;
                    img.className = 'position-product-image';
                    productInfo.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'position-product-image';
                    placeholder.style.background = '#f0f0f0';
                    placeholder.style.display = 'flex';
                    placeholder.style.alignItems = 'center';
                    placeholder.style.justifyContent = 'center';
                    placeholder.style.color = '#999';
                    placeholder.style.fontSize = '10px';
                    placeholder.textContent = 'No Image';
                    productInfo.appendChild(placeholder);
                }
                
                // Add product name
                const productName = document.createElement('div');
                productName.className = 'position-product-name';
                productName.textContent = currentProduct.title;
                productInfo.appendChild(productName);
                
                positionItem.appendChild(productInfo);
            }
            
            // Create action buttons
            const actionContainer = document.createElement('div');
            actionContainer.className = 'position-actions';
            
            const replaceBtn = document.createElement('button');
            replaceBtn.className = 'position-btn replace-btn';
            replaceBtn.textContent = 'Replace';
            replaceBtn.dataset.position = position;
            if (!isFilled) replaceBtn.disabled = true;
            replaceBtn.addEventListener('click', () => {
                replaceProductAtPosition(productData, position);
                closeRankModal();
            });
            actionContainer.appendChild(replaceBtn);
            
            const insertBtn = document.createElement('button');
            insertBtn.className = 'position-btn insert-btn';
            insertBtn.textContent = 'Insert';
            insertBtn.dataset.position = position;
            insertBtn.addEventListener('click', () => {
                insertProductAtPosition(productData, position);
                closeRankModal();
            });
            actionContainer.appendChild(insertBtn);
            
            positionItem.appendChild(actionContainer);
            rankingPositions.appendChild(positionItem);
        });
        
        // Show modal
        modal.classList.add('show');
        modal.style.display = 'flex';
        
        // Add ESC key listener when modal opens
        document.addEventListener('keydown', handleModalEscKey);
    }

    // ESC key handler for modal
    function handleModalEscKey(event) {
        if (event.key === 'Escape') {
            closeRankModal();
        }
    }

    // Close ranking modal
    function closeRankModal() {
        const modal = document.getElementById('rankModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            // Remove ESC key listener when modal closes
            document.removeEventListener('keydown', handleModalEscKey);
        }
    }

    // Replace product at specific position (no push-down)
    function replaceProductAtPosition(productData, position) {
        console.log(`🔄 Replacing product at position ${position} with "${productData.title}"`);
        
        // Check if product is already ranked elsewhere (not in the target position)
        const existingRank = isProductAlreadyRanked(productData.id);
        if (existingRank !== null && existingRank !== position) {
            console.warn(`⚠️ Product "${productData.title}" is already ranked at position ${existingRank}`);
            if (window.appEventBus) {
                window.appEventBus.emit('notification:show', {
                    message: `This product is already ranked at position #${existingRank}`,
                    type: 'warning'
                });
            }
            return; // Prevent duplicate ranking
        }
        
        // OPTIMISTIC UI: Immediately remove product from available products list
        const productIndex = currentProducts.findIndex(p => p.id === productData.id);
        if (productIndex !== -1) {
            const removedProduct = currentProducts.splice(productIndex, 1)[0];
            optimisticallyRemovedProducts.push(removedProduct);
            console.log(`⚡ Optimistically removed product ${productData.id} from display`);
            displayProducts(); // Re-render immediately (includes auto-load check)
        }
        
        // Simply fill the slot, overwriting whatever was there
        fillSlot(rankingSlots[position - 1], position, productData);
        
        // Check if we need to add more slots
        checkAndAddMoreSlotsForRank(position);
        checkAndAddMoreSlots();
        
        // Trigger auto-save
        scheduleAutoSave();
    }

    // Insert product at specific position (with push-down)
    function insertProductAtPosition(productData, position) {
        console.log(`➕ Inserting product at position ${position}: "${productData.title}"`);
        
        // Use existing insert logic with push-down (handles optimistic removal)
        insertProductWithPushDown(position, productData);
        
        // Check if we need to add more slots
        checkAndAddMoreSlotsForRank(position);
        checkAndAddMoreSlots();
        
        // Trigger auto-save
        scheduleAutoSave();
    }

    function removeFromSlot(rank) {
        const slot = rankingSlots[rank - 1];
        if (!slot || !slot.classList.contains('filled')) return;
        
        // Get the product being removed so we can return it to the available list
        const removedProductData = JSON.parse(slot.dataset.productData);
        const removedProductId = removedProductData.id;
        
        // Collect all items after the deleted rank
        const itemsToMoveUp = [];
        for (let i = rank; i < rankingSlots.length; i++) {
            const slotToCheck = rankingSlots[i];
            if (slotToCheck.classList.contains('filled')) {
                itemsToMoveUp.push({
                    rank: i + 1,
                    data: JSON.parse(slotToCheck.dataset.productData)
                });
            }
        }
        
        // Clear the deleted slot and all slots after it
        for (let i = rank - 1; i < rankingSlots.length; i++) {
            const slotToClear = rankingSlots[i];
            if (slotToClear.classList.contains('filled')) {
                slotToClear.classList.remove('filled');
                slotToClear.innerHTML = `
                    <div class="slot-number">${i + 1}</div>
                    <div class="slot-placeholder">Drop a product here to rank #${i + 1}</div>
                `;
                delete slotToClear.dataset.productData;
                
                // Remove drag listeners
                slotToClear.draggable = false;
                slotToClear.removeEventListener('dragstart', handleSlotDragStart);
                slotToClear.removeEventListener('dragend', handleSlotDragEnd);
            }
        }
        
        // Move items up one position each
        itemsToMoveUp.forEach((item, index) => {
            const newRank = rank + index;
            if (newRank <= rankingSlots.length) {
                fillSlot(rankingSlots[newRank - 1], newRank, item.data);
            }
        });
        
        console.log(`🗑️ Removed rank ${rank}, moved ${itemsToMoveUp.length} items up`);
        
        // Return the removed product to the available products list
        // First check if it's in the optimistically removed list
        const optimisticIndex = optimisticallyRemovedProducts.findIndex(p => p.id === removedProductId);
        if (optimisticIndex !== -1) {
            // Product was optimistically removed - restore it from there
            const restoredProduct = optimisticallyRemovedProducts.splice(optimisticIndex, 1)[0];
            currentProducts.unshift(restoredProduct); // Add to beginning for visibility
            console.log(`↩️ Restored product ${removedProductId} from optimistic removal list`);
        } else {
            // Product wasn't optimistically removed - check if it's already in currentProducts
            const alreadyInProducts = currentProducts.some(p => p.id === removedProductId);
            if (!alreadyInProducts) {
                // Add it back to currentProducts (product data is from the slot)
                currentProducts.unshift(removedProductData);
                console.log(`↩️ Returned product ${removedProductId} to available products list`);
            }
        }
        
        // Refresh product display to show removed product again
        displayProducts();
        
        // Trigger auto-save
        scheduleAutoSave();
    }

    function checkAndAddMoreSlots() {
        // Count all filled slots to determine if we need expansion
        let filledSlots = 0;
        let highestFilledRank = 0;
        
        // Scan all slots to find filled ones and highest rank
        for (let i = 0; i < rankingSlots.length; i++) {
            if (rankingSlots[i].classList.contains('filled')) {
                filledSlots++;
                highestFilledRank = Math.max(highestFilledRank, i + 1); // Convert to 1-indexed
            }
        }
        
        const totalSlots = rankingSlots.length;
        
        // Trigger infinite expansion when:
        // 1. We have at least 10 filled slots (initial threshold met)
        // 2. AND we've filled at least 80% of available slots
        // 3. AND the highest filled rank is close to the total slots
        const expansionThreshold = Math.max(10, Math.floor(totalSlots * 0.8));
        const isNearCapacity = highestFilledRank >= totalSlots - 2;
        
        if (filledSlots >= expansionThreshold && isNearCapacity) {
            const slotsToAdd = 5; // Add 5 more slots each time for better UX
            addMoreRankingSlots(slotsToAdd);
            console.log(`♾️ Infinite expansion triggered! Filled ${filledSlots}/${totalSlots} slots, highest rank: ${highestFilledRank}, added ${slotsToAdd} more slots`);
        }
    }

    // Enhanced function to check expansion based on specific rank being filled
    function checkAndAddMoreSlotsForRank(rank) {
        const totalSlots = rankingSlots.length;
        
        // If we just filled one of the last 2 slots and we have at least 10 rankings, expand
        if (rank >= totalSlots - 1 && totalSlots >= 10) {
            const slotsToAdd = 5;
            addMoreRankingSlots(slotsToAdd);
            console.log(`♾️ Infinite expansion: Rank ${rank} filled (near end of ${totalSlots} slots), added ${slotsToAdd} more slots`);
        }
    }

    // Add additional ranking slots without clearing existing ones
    function addMoreRankingSlots(count) {
        const slotsContainer = document.getElementById('rankingSlots');
        if (!slotsContainer) return;

        const currentSlotCount = rankingSlots.length;
        console.log(`📈 Adding ${count} more slots to existing ${currentSlotCount} slots`);

        for (let i = 1; i <= count; i++) {
            const newSlotNumber = currentSlotCount + i;
            const slot = document.createElement('div');
            slot.className = 'ranking-slot';
            slot.dataset.rank = newSlotNumber;
            slot.innerHTML = `
                <div class="slot-number">${newSlotNumber}</div>
                <div class="slot-placeholder">Drop a product here to rank #${newSlotNumber}</div>
            `;
            
            // Add drag and drop event listeners
            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('drop', handleDrop);
            slot.addEventListener('dragleave', handleDragLeave);
            
            slotsContainer.appendChild(slot);
            rankingSlots.push(slot);
        }

        console.log(`✅ Total ranking slots: ${rankingSlots.length}`);
    }

    // Auto-save functionality
    let autoSaveTimeout;
    let isSaving = false;
    let pendingRankingsSnapshot = null; // Track latest rankings for coalescing

    // Enhanced Request queue with persistent storage and retry logic
    class RankingSaveQueue {
        constructor() {
            this.queue = [];
            this.processing = false;
            this.pendingSavePromise = null;
            this.coalescingEnabled = true;
            this.persistentQueue = typeof getPersistentQueue === 'function' ? getPersistentQueue() : null;
            this.retryInProgress = false;
            this.activeNetworkSave = false; // Track if network save is in progress
            
            // Process any pending operations from previous sessions
            if (this.persistentQueue) {
                this.processPendingOperations();
            }
        }
        
        async processPendingOperations() {
            try {
                const pending = await this.persistentQueue.getPending();
                if (pending.length > 0) {
                    console.log(`🔄 Found ${pending.length} pending operation(s) from previous session`);
                    updateAutoSaveStatus('saving', `⏳ Retrying ${pending.length} saved ranking(s)...`);
                    
                    for (const operation of pending) {
                        await this.retryOperation(operation);
                    }
                }
            } catch (error) {
                console.error('❌ Error processing pending operations:', error);
            }
        }
        
        async retryOperation(operation) {
            const maxRetries = 5;
            const retryCount = operation.retryCount || 0;
            
            if (retryCount >= maxRetries) {
                console.error(`❌ Max retries exceeded for operation ${operation.operationId}`);
                await this.persistentQueue.complete(operation.operationId);
                return;
            }
            
            try {
                const sessionId = localStorage.getItem('customerSessionId');
                if (!sessionId) {
                    console.error('❌ No session available for retry');
                    return;
                }
                
                const rankingListId = operation.rankingListId || 'default';
                let successCount = 0;
                
                // Retry each ranking individually to leverage server-side idempotency
                for (const ranking of operation.rankings) {
                    await retryWithBackoff(async () => {
                        const response = await fetch('/api/rankings/product', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId,
                                productId: ranking.productData.id,
                                productData: ranking.productData,
                                ranking: ranking.ranking,
                                rankingListId,
                                operationId: `${operation.operationId}-${ranking.productData.id}`
                            })
                        });
                        
                        if (!response.ok) {
                            const result = await response.json();
                            throw new Error(result.error || 'Save failed');
                        }
                        
                        successCount++;
                        return await response.json();
                    }, {
                        maxRetries: maxRetries - retryCount,
                        initialDelay: 1000,
                        maxDelay: 30000,
                        onRetry: async (attempt, delay, error) => {
                            await this.persistentQueue.update(operation.operationId, {
                                retryCount: retryCount + attempt,
                                lastAttempt: Date.now()
                            });
                            console.log(`🔄 Retrying ${ranking.productData.title}: attempt ${retryCount + attempt}`);
                        },
                        shouldRetry: (error) => {
                            // Don't retry on duplicate errors (already saved)
                            return !error.message.includes('Duplicate') && !error.message.includes('isDuplicate');
                        }
                    });
                }
                
                // Success - remove from persistent queue
                await this.persistentQueue.complete(operation.operationId);
                console.log(`✅ Successfully saved ${successCount} persisted ranking(s) from operation ${operation.operationId.substring(0, 8)}`);
                
                // Update UI
                if (window.appEventBus) {
                    window.appEventBus.emit('ranking:saved', { 
                        count: successCount,
                        rankingListId
                    });
                }
                
                updateAutoSaveStatus('saved', `✓ Recovered ${successCount} ranking(s)`);
                
            } catch (error) {
                console.error(`❌ Failed to retry operation after ${retryCount + 1} attempts:`, error);
                await this.persistentQueue.update(operation.operationId, {
                    status: 'failed',
                    lastError: error.message
                });
            }
        }

        async enqueue(saveFunction, options = {}) {
            return new Promise((resolve, reject) => {
                const queueItem = { saveFunction, resolve, reject, options };
                
                // Coalescing: if this is a ranking save and there's already one pending,
                // cancel the old one and use this new one (it has the latest state)
                if (this.coalescingEnabled && options.type === 'ranking_save') {
                    const existingIndex = this.queue.findIndex(item => 
                        item.options?.type === 'ranking_save'
                    );
                    
                    if (existingIndex >= 0) {
                        // Cancel the old save and replace with new one
                        const oldItem = this.queue[existingIndex];
                        this.queue.splice(existingIndex, 1);
                        console.log('🔄 Coalesced duplicate ranking save (queue optimization)');
                        
                        // Resolve the old promise with a special value
                        oldItem.resolve({ coalesced: true });
                    }
                }
                
                this.queue.push(queueItem);
                this.process();
            });
        }

        async process() {
            if (this.processing || this.queue.length === 0) {
                return;
            }

            this.processing = true;
            const { saveFunction, resolve, reject, options } = this.queue.shift();

            try {
                const result = await saveFunction();
                resolve(result);
            } catch (error) {
                // If this is a ranking save and we have persistent queue, save it for retry
                if (options.type === 'ranking_save' && this.persistentQueue && options.rankings) {
                    try {
                        const operationId = typeof generateUUID === 'function' ? generateUUID() : `op-${Date.now()}-${Math.random()}`;
                        await this.persistentQueue.enqueue({
                            operationId,
                            rankings: options.rankings,
                            rankingListId: options.rankingListId || 'default',
                            retryCount: 0
                        });
                        console.log(`💾 Saved failed operation to persistent queue for retry: ${operationId.substring(0, 8)}`);
                    } catch (persistError) {
                        console.error('❌ Failed to persist operation:', persistError);
                    }
                }
                
                reject(error);
            } finally {
                this.processing = false;
                // Process next item in queue
                if (this.queue.length > 0) {
                    this.process();
                }
            }
        }

        async waitForPendingSaves() {
            // Wait for all pending saves to complete
            while (this.processing || this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        get hasPendingSaves() {
            return this.processing || this.queue.length > 0;
        }

        get queueLength() {
            return this.queue.length;
        }
    }

    const rankingSaveQueue = new RankingSaveQueue();

    // Navigation guard: prevent navigation if saves are pending
    window.addEventListener('beforeunload', async (e) => {
        if (rankingSaveQueue.hasPendingSaves) {
            e.preventDefault();
            e.returnValue = 'You have unsaved rankings. Please wait for them to save.';
            
            // Attempt to complete pending saves before page unloads
            try {
                await rankingSaveQueue.waitForPendingSaves();
            } catch (error) {
                console.error('Error completing pending saves:', error);
            }
        }
    });

    // Hash change guard: wait for pending saves before navigating
    let originalHashChangeHandler = null;
    window.addEventListener('hashchange', async (e) => {
        if (rankingSaveQueue.hasPendingSaves) {
            e.preventDefault();
            
            // Show status to user
            updateAutoSaveStatus('saving', '⏳ Waiting for saves to complete...');
            
            // Wait for all pending saves to complete
            await rankingSaveQueue.waitForPendingSaves();
            
            updateAutoSaveStatus('saved', '✓ All saves complete');
            
            // Now navigate to the new hash
            window.location.hash = e.newURL.split('#')[1] || '';
        }
    }, true); // Use capture phase to intercept before other handlers

    function updateAutoSaveStatus(status, message = '') {
        showStatus(status, message);
        
        // Clear saved/error status after 3 seconds
        if (status === 'saved' || status === 'error') {
            setTimeout(() => {
                hideStatus();
            }, 3000);
        }
    }

    // Unified status indicator functions
    function showStatus(type, message) {
        const statusElement = document.getElementById('statusIndicator');
        if (statusElement) {
            statusElement.className = `status-indicator ${type}`;
            statusElement.textContent = message;
        }
    }

    function hideStatus() {
        const statusElement = document.getElementById('statusIndicator');
        if (statusElement) {
            statusElement.className = 'status-indicator';
            statusElement.textContent = '';
        }
    }

    function showRankingLoadStatus() {
        showStatus('loading', '⏳ Loading your rankings...');
    }

    function hideRankingLoadStatus() {
        hideStatus();
    }

    // Fixed operation ID for current session to avoid duplicates
    let currentSessionOperationId = null;
    
    async function scheduleAutoSave() {
        // CRITICAL FIX: Immediately persist current rankings to survive page refresh
        // This ensures no data loss even if user refreshes before the 800ms timer fires
        const persistentQueue = rankingSaveQueue.persistentQueue;
        if (persistentQueue) {
            try {
                const rankings = collectRankingData();
                if (rankings.length > 0) {
                    // Use a fixed operation ID for current session to avoid creating duplicates
                    // This way, rapid ranking changes update the same queue entry instead of creating multiple entries
                    if (!currentSessionOperationId) {
                        currentSessionOperationId = typeof generateUUID === 'function' ? generateUUID() : `session-${Date.now()}`;
                    }
                    
                    // Check if operation already exists (update it), otherwise enqueue new
                    const existing = await persistentQueue.get(currentSessionOperationId);
                    if (existing) {
                        await persistentQueue.update(currentSessionOperationId, {
                            rankings: rankings,
                            timestamp: Date.now()
                        });
                        console.log(`💾 Updated persisted rankings (${rankings.length} total)`);
                    } else {
                        await persistentQueue.enqueue({
                            operationId: currentSessionOperationId,
                            rankings: rankings,
                            rankingListId: 'default',
                            timestamp: Date.now()
                        });
                        console.log(`💾 Immediately persisted ${rankings.length} ranking(s) to survive refresh`);
                    }
                } else if (currentSessionOperationId) {
                    // EDGE CASE FIX: User removed all rankings before autosave fired
                    // Clear the persisted operation to prevent stale data resurrection on refresh
                    await persistentQueue.complete(currentSessionOperationId);
                    console.log(`🗑️ Cleared persisted operation (all rankings removed)`);
                    currentSessionOperationId = null;
                }
            } catch (error) {
                console.error('❌ Failed to persist rankings immediately:', error);
            }
        }
        
        // Clear any pending auto-save timer
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }
        
        // Schedule batched API call after 800ms of no ranking changes (for performance)
        autoSaveTimeout = setTimeout(async () => {
            // CRITICAL FIX: Never block saves - always enqueue them
            // The RankingSaveQueue will handle coalescing and serialization
            // This prevents data loss during rapid ranking changes
            updateAutoSaveStatus('saving', 'Saving...');
            await autoSaveRankings();
        }, 800);
    }

    // Track last saved product IDs to detect newly ranked products
    let lastSavedProductIds = new Set();

    function collectRankingData() {
        return rankingSlots
            .filter(slot => slot.classList.contains('filled'))
            .map(slot => {
                const rank = parseInt(slot.dataset.rank);
                const productData = JSON.parse(slot.dataset.productData);
                return { 
                    ranking: rank, 
                    productData: productData 
                };
            });
    }

    async function autoSaveRankings() {
        const rankings = collectRankingData();
        
        // If a network save is already in progress, snapshot the latest rankings
        // They'll be saved after the current save completes
        if (rankingSaveQueue.activeNetworkSave) {
            console.log(`🔄 Network save in progress, snapshotting ${rankings.length} rankings for next batch`);
            pendingRankingsSnapshot = rankings;
            return;
        }
        
        // Enqueue the save operation to prevent concurrent requests
        // Using type 'ranking_save' enables queue coalescing for performance
        return rankingSaveQueue.enqueue(async () => {
            try {
                isSaving = true;
                rankingSaveQueue.activeNetworkSave = true;
                
                const sessionId = localStorage.getItem('customerSessionId');
                if (!sessionId) {
                    updateAutoSaveStatus('error', 'Authentication required');
                    return;
                }

                // CRITICAL FIX: Always send rankings to server, even if empty
                // This ensures the last deleted ranking is removed from the database
                // Backend uses differential delete to remove products not in payload
                
                // Track current product IDs
                const currentProductIds = new Set(rankings.map(r => r.productData.id));
                
                // Find newly added products (in current but not in last saved)
                const newlyRankedProductIds = [...currentProductIds].filter(id => !lastSavedProductIds.has(id));
                
                console.log(`📤 Starting network save for ${rankings.length} rankings`);
                const response = await fetch('/api/rankings/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        rankingListId: 'default',
                        rankings: rankings
                    })
                });
                
                const result = await response.json();

                if (response.ok) {
                    if (rankings.length === 0) {
                        updateAutoSaveStatus('saved', '✓ All rankings cleared');
                        lastSavedProductIds = new Set();
                        
                        // Clear persisted operation when all rankings removed
                        const persistentQueue = rankingSaveQueue.persistentQueue;
                        if (persistentQueue && currentSessionOperationId) {
                            try {
                                await persistentQueue.complete(currentSessionOperationId);
                                console.log(`🗑️ Cleared persisted operation (all rankings removed)`);
                                currentSessionOperationId = null;
                            } catch (error) {
                                console.error('❌ Failed to clear persisted operation:', error);
                            }
                        }
                    } else {
                        updateAutoSaveStatus('saved', `✓ Saved ${rankings.length} ranking${rankings.length === 1 ? '' : 's'}`);
                        // Update last saved product IDs
                        lastSavedProductIds = currentProductIds;
                    }
                    
                    // Clear optimistically removed products on successful save
                    optimisticallyRemovedProducts = [];
                    
                    // CRITICAL FIX: Clear the persisted operation from IndexedDB after successful save
                    // This prevents duplicate saves when page reloads after successful save
                    const persistentQueue = rankingSaveQueue.persistentQueue;
                    if (persistentQueue && currentSessionOperationId) {
                        try {
                            await persistentQueue.complete(currentSessionOperationId);
                            console.log(`✅ Cleared persisted operation ${currentSessionOperationId.substring(0, 8)} after successful save`);
                            currentSessionOperationId = null; // Reset for next batch
                        } catch (error) {
                            console.error('❌ Failed to clear persisted operation:', error);
                        }
                    }
                    
                    // Emit event to update progress widget and other reactive components
                    if (window.appEventBus) {
                        console.log(`📢 Emitting ranking:saved event with count: ${rankings.length}`);
                        window.appEventBus.emit('ranking:saved', { 
                            count: rankings.length,
                            rankingListId: 'default'
                        });
                        
                        // Note: product:ranked events no longer needed with optimistic UI
                        // Products are removed immediately when ranked, not after save
                    }
                    
                    // CRITICAL: Check if rankings were added during this save
                    // If so, trigger another save to capture them
                    if (pendingRankingsSnapshot && pendingRankingsSnapshot.length > 0) {
                        console.log(`🔄 Processing pending snapshot: ${pendingRankingsSnapshot.length} rankings`);
                        const snapshot = pendingRankingsSnapshot;
                        pendingRankingsSnapshot = null;
                        
                        // Schedule another save for the pending rankings after a brief delay
                        setTimeout(() => {
                            scheduleAutoSave();
                        }, 100);
                    }
                } else {
                    // Save failed - restore optimistically removed products
                    console.error('❌ Save failed, restoring optimistically removed products');
                    if (optimisticallyRemovedProducts.length > 0) {
                        currentProducts.push(...optimisticallyRemovedProducts);
                        optimisticallyRemovedProducts = [];
                        displayProducts(); // Re-render to show restored products
                        console.log(`♻️ Restored ${optimisticallyRemovedProducts.length} products to display`);
                    }
                    
                    // Handle server-side duplicate detection
                    if (result.error && result.error.includes('Duplicate')) {
                        updateAutoSaveStatus('error', 'Duplicate products detected');
                        if (window.appEventBus) {
                            window.appEventBus.emit('notification:show', {
                                message: 'Save failed: duplicate products in ranking. Products restored to list.',
                                type: 'error'
                            });
                        }
                    } else {
                        updateAutoSaveStatus('error', 'Save failed');
                        if (window.appEventBus) {
                            window.appEventBus.emit('notification:show', {
                                message: 'Save failed. Products restored to list.',
                                type: 'error'
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Auto-save error:', error);
                
                // Restore optimistically removed products on exception
                if (optimisticallyRemovedProducts.length > 0) {
                    currentProducts.push(...optimisticallyRemovedProducts);
                    optimisticallyRemovedProducts = [];
                    displayProducts();
                    console.log(`♻️ Restored products to display after error`);
                }
                
                updateAutoSaveStatus('error', 'Save failed');
                if (window.appEventBus) {
                    window.appEventBus.emit('notification:show', {
                        message: 'Save failed. Products restored to list.',
                        type: 'error'
                    });
                }
            } finally {
                isSaving = false;
                rankingSaveQueue.activeNetworkSave = false;
                
                // CRITICAL: Check if rankings were snapshotted during error/finally
                // This ensures no rankings are lost even if save failed
                if (pendingRankingsSnapshot && pendingRankingsSnapshot.length > 0) {
                    console.log(`🔄 Rescheduling save for ${pendingRankingsSnapshot.length} pending rankings (from finally block)`);
                    pendingRankingsSnapshot = null; // Clear to prevent infinite loop
                    setTimeout(() => {
                        scheduleAutoSave();
                    }, 100);
                }
            }
        }, { 
            type: 'ranking_save', 
            rankings: rankings,
            rankingListId: 'default'
        });
    }

    async function saveRankings() {
        console.log('🎯 Manual save triggered');
        const sessionId = localStorage.getItem('customerSessionId');
        console.log('📍 Session ID:', sessionId ? 'Found' : 'Missing');
        if (!sessionId) {
            alert('Please log in to save your rankings');
            return;
        }

        const filledSlots = rankingSlots
            .filter(slot => slot.classList.contains('filled'))
            .map(slot => ({
                rank: parseInt(slot.dataset.rank),
                productData: JSON.parse(slot.dataset.productData)
            }));

        if (filledSlots.length === 0) {
            console.log('❌ No products to save');
            alert('Please rank at least one product before saving');
            return;
        }
        
        console.log(`💾 Attempting to save ${filledSlots.length} rankings`);
        filledSlots.forEach(slot => {
            console.log(`  - Rank ${slot.rank}: ${slot.productData.title}`);
        });

        const saveBtn = document.getElementById('saveRankingBtn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const rankingListId = 'default'; // Use consistent default ID

            // First, clear any existing rankings for this user to replace them
            await fetch(`/api/rankings/products/clear?sessionId=${sessionId}&rankingListId=${rankingListId}`, {
                method: 'DELETE'
            });

            for (const slot of filledSlots) {
                const response = await fetch('/api/rankings/product', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId,
                        productId: slot.productData.id,
                        productData: slot.productData,
                        ranking: slot.rank,
                        rankingListId
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to save ranking for ${slot.productData.title}`);
                }
                
                // Note: product:ranked events no longer needed with optimistic UI
                // Products are removed immediately when ranked, not after save
            }

            // Clear optimistically removed products on successful manual save
            optimisticallyRemovedProducts = [];
            
            alert(`Successfully saved ${filledSlots.length} product rankings!`);
            console.log(`✅ Saved ${filledSlots.length} product rankings`);
            
            // Emit event to update progress widget and other reactive components
            if (window.appEventBus) {
                window.appEventBus.emit('ranking:saved', { 
                    count: filledSlots.length,
                    rankingListId: rankingListId
                });
            }

        } catch (error) {
            console.error('Error saving rankings:', error);
            
            // Restore optimistically removed products on failure
            if (optimisticallyRemovedProducts.length > 0) {
                currentProducts.push(...optimisticallyRemovedProducts);
                optimisticallyRemovedProducts = [];
                displayProducts();
                console.log(`♻️ Restored products to display after manual save error`);
            }
            
            alert('Failed to save rankings. Products have been restored to the list.');
            
            if (window.appEventBus) {
                window.appEventBus.emit('notification:show', {
                    message: 'Save failed. Products restored to list.',
                    type: 'error'
                });
            }
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    function showClearModal() {
        const modal = document.getElementById('clearModal');
        modal.classList.add('show');
    }

    function hideClearModal() {
        const modal = document.getElementById('clearModal');
        modal.classList.remove('show');
    }

    async function clearAllRankings() {
        // Hide the modal first
        hideClearModal();
        
        // Clear all filled slots directly without triggering individual auto-saves
        rankingSlots.forEach((slot) => {
            if (slot.classList.contains('filled')) {
                slot.classList.remove('filled');
                const rank = parseInt(slot.dataset.rank);
                slot.innerHTML = `
                    <div class="slot-number">${rank}</div>
                    <div class="slot-placeholder">Drop a product here to rank #${rank}</div>
                `;
                delete slot.dataset.productData;
                
                // Remove drag listeners
                slot.draggable = false;
                slot.removeEventListener('dragstart', handleSlotDragStart);
                slot.removeEventListener('dragend', handleSlotDragEnd);
            }
        });
        
        // Reset to 10 slots
        generateRankingSlots(10);
        
        // Refresh product display to show all products again
        displayProducts();
        
        // Delete all rankings from database using DELETE endpoint
        console.log('🗑️ Cleared all rankings, deleting from database...');
        try {
            const sessionId = localStorage.getItem('customerSessionId');
            if (!sessionId) {
                console.error('❌ No session ID, cannot clear database');
                return;
            }
            
            updateAutoSaveStatus('saving', 'Clearing...');
            
            const response = await fetch(`/api/rankings/products/clear?sessionId=${sessionId}&rankingListId=default`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                console.log('✅ Successfully cleared all rankings from database');
                updateAutoSaveStatus('saved', '✓ All rankings cleared');
                
                // Emit event to update progress widget and other reactive components
                if (window.appEventBus) {
                    window.appEventBus.emit('ranking:saved', { 
                        count: 0,
                        rankingListId: 'default'
                    });
                }
            } else {
                console.error('❌ Failed to clear rankings from database');
                updateAutoSaveStatus('error', 'Clear failed');
            }
        } catch (error) {
            console.error('❌ Error clearing rankings:', error);
            updateAutoSaveStatus('error', 'Clear failed');
        }
    }

    // Make removeFromSlot globally accessible
    window.removeFromSlot = removeFromSlot;

    async function loadTopJerky() {
        // Legacy function - redirect to new ranking system with auth check
        if (!isUserAuthenticated()) {
            const isAuthenticatedAsync = await isUserAuthenticatedAsync();
            if (!isAuthenticatedAsync) {
                showLoginRequiredMessage();
                return;
            }
        }
        await showPage('rank');
    }

    // Function to load all jerky products from jerky.com
    async function loadJerkyProducts() {
        try {
            const response = await fetch('/api/jerky/products');
            const products = await response.json();
            
            if (response.ok) {
                // Store products and display them
                currentJerkyData = products;
                displayJerky(products);
                
                // Show ranking controls
                if (rankingMode) rankingMode.style.display = 'block';
                
                console.log(`✅ Loaded ${products.length} jerky products from jerky.com`);
            } else {
                console.error('Failed to load jerky products:', products.error);
            }
        } catch (error) {
            console.error('Error loading jerky products:', error);
        }
    }

    function enableRankingMode() {
        isRankingMode = true;
        enableRankingBtn.style.display = 'none';
        saveRankingBtn.style.display = 'inline-block';
        resetRankingBtn.style.display = 'inline-block';
        
        // Make items draggable
        const jerkyItems = jerkyList.querySelectorAll('.jerky-item');
        jerkyItems.forEach((item, index) => {
            item.classList.add('draggable');
            item.draggable = true;
            item.dataset.jerkyId = currentJerkyData[index].id;
            
            // Add drag event listeners
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragend', handleDragEnd);
        });
        
        // Initialize user ranking with current order
        userRanking = [...currentJerkyData];
        displayUserRanking();
        rankingDisplay.style.display = 'block';
    }

    async function saveUserRanking() {
        const sessionId = localStorage.getItem('customerSessionId');
        
        if (!sessionId) {
            alert('Please log in to save your ranking!');
            return;
        }
        
        if (userRanking.length === 0) {
            alert('Please create a ranking first!');
            return;
        }
        
        try {
            const rankingName = prompt('Enter a name for your ranking:', `My Top ${userRanking.length} Jerky Ranking`);
            
            if (!rankingName) {
                return; // User cancelled
            }
            
            const response = await fetch('/api/customer/ranking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionId}`
                },
                body: JSON.stringify({
                    rankingName: rankingName,
                    rankingData: userRanking,
                    isPublic: false // Private by default
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Also save to localStorage as backup
                localStorage.setItem('jerkyRanking', JSON.stringify(userRanking));
                alert(`Your ranking "${data.ranking.name}" has been saved! 🎉`);
                console.log('✅ Ranking saved to database:', data.ranking);
            } else {
                throw new Error(data.error || 'Failed to save ranking');
            }
            
        } catch (error) {
            console.error('Error saving ranking:', error);
            alert('Failed to save ranking. Please try again.');
        }
    }

    function resetRanking() {
        isRankingMode = false;
        enableRankingBtn.style.display = 'inline-block';
        saveRankingBtn.style.display = 'none';
        resetRankingBtn.style.display = 'none';
        rankingDisplay.style.display = 'none';
        
        // Reset to original data and display
        userRanking = [];
        displayJerky(currentJerkyData);
    }

    function displayJerky(jerkyItems) {
        jerkyList.innerHTML = '';
        
        jerkyItems.forEach((jerky, index) => {
            const jerkyElement = document.createElement('div');
            jerkyElement.className = 'jerky-item';
            
            const stars = generateStars(jerky.rating);
            
            jerkyElement.innerHTML = `
                <div class="rank">${index + 1}</div>
                <div class="jerky-header">
                    <h3 class="jerky-name">${jerky.name}</h3>
                    <span class="jerky-price">${jerky.price}</span>
                </div>
                <div class="jerky-brand">${jerky.brand}</div>
                <div class="jerky-rating">
                    <span class="stars">${stars}</span>
                    <span class="rating-value">${jerky.rating}</span>
                </div>
            `;
            
            jerkyList.appendChild(jerkyElement);
        });
    }

    function displayUserRanking() {
        userRankingList.innerHTML = '';
        
        userRanking.forEach((jerky, index) => {
            const jerkyElement = document.createElement('div');
            jerkyElement.className = 'jerky-item';
            
            const stars = generateStars(jerky.rating);
            
            jerkyElement.innerHTML = `
                <div class="rank">${index + 1}</div>
                <div class="jerky-header">
                    <h3 class="jerky-name">${jerky.name}</h3>
                    <span class="jerky-price">${jerky.price}</span>
                </div>
                <div class="jerky-brand">${jerky.brand}</div>
                <div class="jerky-rating">
                    <span class="stars">${stars}</span>
                    <span class="rating-value">${jerky.rating}</span>
                </div>
            `;
            
            userRankingList.appendChild(jerkyElement);
        });
    }


    function generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let stars = '';
        
        // Add full stars
        for (let i = 0; i < fullStars; i++) {
            stars += '★';
        }
        
        // Add half star if needed
        if (hasHalfStar) {
            stars += '☆';
        }
        
        // Fill remaining with empty stars up to 5
        const remaining = 5 - fullStars - (hasHalfStar ? 1 : 0);
        for (let i = 0; i < remaining; i++) {
            stars += '☆';
        }
        
        return stars;
    }

    // ========================================
    // Products Page Functionality
    // ========================================
    
    async function loadAnimalCategories() {
        const container = document.getElementById('animalCategories');
        if (!container) return;
        
        try {
            const response = await fetch('/api/products/animals');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error('Failed to load animal categories');
            }
            
            // Display animal categories
            container.innerHTML = data.animals.map(animal => `
                <div class="animal-category" data-animal="${animal.animal}">
                    <div class="animal-category-icon">${animal.icon}</div>
                    <div class="animal-category-name">${animal.animal}</div>
                    <div class="animal-category-count">${animal.count}</div>
                </div>
            `).join('');
            
            // Add click handlers
            container.querySelectorAll('.animal-category').forEach(categoryEl => {
                categoryEl.addEventListener('click', () => {
                    const animal = categoryEl.getAttribute('data-animal');
                    const searchInput = document.getElementById('productsSearchInput');
                    
                    // Toggle selection
                    if (selectedAnimal === animal) {
                        selectedAnimal = null;
                        categoryEl.classList.remove('active');
                        // Update URL to remove animal filter
                        updateProductsURLWithAnimal(null);
                        // Clear search box and show all products
                        if (searchInput) {
                            searchInput.value = '';
                        }
                        displayProductsGrid(allProductsData);
                    } else {
                        // Deselect previous
                        container.querySelectorAll('.animal-category').forEach(el => el.classList.remove('active'));
                        // Select new
                        selectedAnimal = animal;
                        categoryEl.classList.add('active');
                        // Update URL with animal filter
                        updateProductsURLWithAnimal(animal);
                        // Clear search box and filter by animal metadata
                        if (searchInput) {
                            searchInput.value = '';
                        }
                        filterProductsByAnimal(animal);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading animal categories:', error);
            container.innerHTML = '';
        }
    }
    
    function toggleAnimalFilter() {
        const filterWrapper = document.getElementById('animalFilterWrapper');
        const filterContent = document.getElementById('animalFilterContent');
        const toggleButton = document.getElementById('animalFilterToggle');
        
        if (!filterWrapper || !filterContent || !toggleButton) return;
        
        const isCurrentlyCollapsed = filterWrapper.classList.contains('collapsed');
        
        if (isCurrentlyCollapsed) {
            // Expand
            filterContent.removeAttribute('hidden');
            filterWrapper.classList.remove('collapsed');
            filterWrapper.classList.add('expanded');
            toggleButton.setAttribute('aria-expanded', 'true');
            toggleButton.setAttribute('aria-label', 'Hide animal filters');
            filterContent.setAttribute('aria-hidden', 'false');
            sessionStorage.setItem('animalFilterCollapsed', 'false');
        } else {
            // Collapse
            filterWrapper.classList.remove('expanded');
            filterWrapper.classList.add('collapsed');
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.setAttribute('aria-label', 'Show animal filters');
            filterContent.setAttribute('aria-hidden', 'true');
            sessionStorage.setItem('animalFilterCollapsed', 'true');
            
            // Wait for animation to complete before hiding
            setTimeout(() => {
                if (filterWrapper.classList.contains('collapsed')) {
                    filterContent.setAttribute('hidden', '');
                }
            }, 400);
        }
    }
    
    function initializeAnimalFilterState() {
        const isCollapsed = sessionStorage.getItem('animalFilterCollapsed') !== 'false';
        const filterWrapper = document.getElementById('animalFilterWrapper');
        const filterContent = document.getElementById('animalFilterContent');
        const toggleButton = document.getElementById('animalFilterToggle');
        
        if (!filterWrapper || !filterContent || !toggleButton) return;
        
        if (isCollapsed) {
            filterWrapper.classList.add('collapsed');
            filterWrapper.classList.remove('expanded');
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.setAttribute('aria-label', 'Show animal filters');
            filterContent.setAttribute('aria-hidden', 'true');
            filterContent.setAttribute('hidden', '');
        } else {
            filterWrapper.classList.add('expanded');
            filterWrapper.classList.remove('collapsed');
            toggleButton.setAttribute('aria-expanded', 'true');
            toggleButton.setAttribute('aria-label', 'Hide animal filters');
            filterContent.setAttribute('aria-hidden', 'false');
            filterContent.removeAttribute('hidden');
        }
        
        // Add click handler for toggle button
        toggleButton.addEventListener('click', toggleAnimalFilter);
    }
    
    async function filterProductsByAnimal(animal) {
        // Ensure we have products loaded
        if (!allProductsData || allProductsData.length === 0) {
            console.warn('Products not loaded, loading now...');
            await loadAllProducts('', getCurrentSort());
        }
        
        let filtered = allProductsData.filter(product => {
            // Primary: Filter by animalDisplay metadata field (exact match)
            if (product.animalDisplay) {
                return product.animalDisplay.toLowerCase() === animal.toLowerCase();
            }
            // Fallback: If metadata missing, comprehensive search (title, vendor, tags)
            const searchableText = [
                product.title,
                product.vendor,
                product.productType,
                product.tags || ''
            ].join(' ').toLowerCase();
            return searchableText.includes(animal.toLowerCase());
        });
        
        // Apply current sort to filtered products
        sortProductsData(getCurrentSort(), filtered);
        displayProductsGrid(filtered);
    }
    
    async function loadAllProducts(query = '', sort = 'name-asc', reset = true) {
        if (isProductsLoading) return;
        
        const productsLoading = document.getElementById('productsLoading');
        const productsGrid = document.getElementById('productsGrid');
        const loadMoreBtn = document.getElementById('productsLoadMoreBtn');
        
        if (!productsGrid) return;
        
        // Reset if query/sort changed
        if (reset) {
            currentProductsPage = 1;
            allProductsData = [];
            currentProductsQuery = query;
            currentSort = sort;
        }
        
        isProductsLoading = true;
        
        if (productsLoading) {
            productsLoading.classList.add('active');
        }
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'none';
        }
        
        try {
            const url = `/api/products/search?query=${encodeURIComponent(query)}&page=${currentProductsPage}&limit=20&sort=${encodeURIComponent(sort)}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load products');
            }
            
            // Append new products to existing data  
            // Note: Products are already sorted by the server, don't re-sort partial data
            allProductsData = [...allProductsData, ...data.products];
            hasMoreProductsPage = data.hasMore;
            
            displayProductsGrid(allProductsData);
            
            // Update load more button with remaining count
            if (loadMoreBtn && hasMoreProductsPage) {
                const totalProducts = data.total || 0;
                const loadedProducts = allProductsData.length;
                const remaining = totalProducts - loadedProducts;
                
                // Show "Load 20 more products" or "Load X more products" based on remaining
                if (remaining >= 20) {
                    loadMoreBtn.textContent = 'Load 20 more products';
                } else if (remaining > 0) {
                    loadMoreBtn.textContent = `Load ${remaining} more product${remaining === 1 ? '' : 's'}`;
                }
                
                loadMoreBtn.style.display = 'inline-block';
            } else if (loadMoreBtn) {
                // Hide button when no more products
                loadMoreBtn.style.display = 'none';
            }
            
            console.log(`✅ Loaded ${data.products.length} products (page ${currentProductsPage}), total: ${allProductsData.length}, hasMore: ${hasMoreProductsPage}`);
        } catch (error) {
            console.error('Error loading products:', error);
            productsGrid.innerHTML = '<div style="color: #dc3545; text-align: center; padding: 40px;">Error loading products. Please try again.</div>';
        } finally {
            isProductsLoading = false;
            if (productsLoading) {
                productsLoading.classList.remove('active');
            }
        }
    }
    
    function sortProductsData(sortBy, dataArray = null) {
        const [field, order] = sortBy.split('-');
        const isAsc = order === 'asc';
        const dataToSort = dataArray || allProductsData;
        
        dataToSort.sort((a, b) => {
            let aVal, bVal;
            
            switch(field) {
                case 'name':
                    aVal = a.title.toLowerCase();
                    bVal = b.title.toLowerCase();
                    break;
                case 'recent':
                    aVal = a.lastRankedAt || '1970-01-01';
                    bVal = b.lastRankedAt || '1970-01-01';
                    break;
                case 'avgrank':
                    aVal = parseFloat(a.avgRank) || 9999;
                    bVal = parseFloat(b.avgRank) || 9999;
                    break;
                case 'totalranks':
                    aVal = parseInt(a.rankingCount) || 0;
                    bVal = parseInt(b.rankingCount) || 0;
                    break;
                default:
                    return 0;
            }
            
            if (aVal < bVal) return isAsc ? -1 : 1;
            if (aVal > bVal) return isAsc ? 1 : -1;
            return 0;
        });
    }
    
    function updateProductsURL(query = '', sort = 'name-asc') {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (sort !== 'name-asc') params.set('sort', sort);
        if (selectedAnimal) params.set('animal', selectedAnimal);
        
        const hash = params.toString() ? `products?${params.toString()}` : 'products';
        window.location.hash = hash;
    }
    
    function updateProductsURLWithAnimal(animal) {
        const params = new URLSearchParams();
        const searchInput = document.getElementById('productsSearchInput');
        const query = searchInput ? searchInput.value.trim() : '';
        
        if (query) params.set('q', query);
        if (currentSort !== 'name-asc') params.set('sort', currentSort);
        if (animal) params.set('animal', animal);
        
        const hash = params.toString() ? `#products?${params.toString()}` : '#products';
        
        // Update URL without triggering hashchange event
        history.replaceState(null, '', hash);
        
        // Apply the filter
        if (animal) {
            filterProductsByAnimal(animal);
        } else {
            displayProductsGrid(allProductsData);
        }
    }
    
    function displayProductsGrid(products) {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;
        
        if (products.length === 0) {
            productsGrid.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No products found</div>';
            return;
        }
        
        // Store products data for detail page access
        window.productsData = products;
        
        productsGrid.innerHTML = products.map(product => {
            const rankingBadgeClass = product.rankingCount === 0 ? 'ranking-badge zero' : 'ranking-badge';
            const rankingText = product.rankingCount === 0 
                ? '0 rankings' 
                : `${product.rankingCount} ranking${product.rankingCount === 1 ? '' : 's'}`;
            
            // Format average ranking display - always show
            const avgRankText = product.avgRank 
                ? `#${parseFloat(product.avgRank).toFixed(1)}`
                : 'N/A';
            const avgRankDisplay = `<div class="product-avg-rank">Avg Rank: ${avgRankText}</div>`;
            
            // Format flavor profile badge - show if available
            const flavorBadge = product.flavorDisplay 
                ? `<div class="product-flavor-badge">${product.flavorIcon} ${product.flavorDisplay}</div>`
                : '';
            
            return `
                <div class="product-card" onclick="navigateToProduct('${product.id}')">
                    <div class="product-card-image-container">
                        ${product.image 
                            ? `<img src="${product.image}" alt="${product.title}" class="product-card-image">` 
                            : '<div class="product-card-image" style="background: #f0f0f0;"></div>'}
                        <div class="${rankingBadgeClass}">
                            <span>🏆</span>
                            <span>${rankingText}</span>
                        </div>
                    </div>
                    <div class="product-card-content">
                        <div class="product-card-title">${product.title}</div>
                        <div class="product-card-vendor">${product.vendor || 'Unknown Brand'}</div>
                        <div class="product-card-price">$${product.price}</div>
                        ${avgRankDisplay}
                        ${flavorBadge}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Navigate to product detail page
    window.navigateToProduct = function(productId) {
        showPage(`product/${productId}`);
    };
    
    // Back button handler for product detail page
    window.goBackToProducts = function() {
        showPage('products', true);
    };
    
    // Navigate to user profile page
    window.navigateToUser = function(userId) {
        showPage(`user/${userId}`);
    };
    
    // Back button handler for user profile page
    window.goBackToCommunity = function() {
        showPage('community', true);
    };
    
    // Helper: Convert ranking to star rating (1-10 rank → 5-1 stars)
    function rankToStars(avgRank) {
        if (!avgRank || avgRank === 'N/A') return 0;
        const rank = parseFloat(avgRank);
        // Better rank (lower number) = more stars
        // Rank 1-2 = 5 stars, 3-4 = 4 stars, 5-6 = 3 stars, 7-8 = 2 stars, 9-10 = 1 star
        if (rank <= 2) return 5;
        if (rank <= 4) return 4;
        if (rank <= 6) return 3;
        if (rank <= 8) return 2;
        return 1;
    }
    
    // Helper: Update star display
    function updateStars(avgRank, uniqueRankers) {
        const stars = rankToStars(avgRank);
        const starsContainer = document.getElementById('productStars');
        const ratingText = document.getElementById('productRatingText');
        
        if (starsContainer) {
            const starElements = starsContainer.querySelectorAll('.star');
            starElements.forEach((star, index) => {
                if (index < stars) {
                    star.textContent = '★';
                    star.classList.add('filled');
                } else {
                    star.textContent = '☆';
                    star.classList.remove('filled');
                }
            });
        }
        
        if (ratingText) {
            if (uniqueRankers > 0) {
                ratingText.textContent = `${stars}/5 stars (${uniqueRankers} ${uniqueRankers === 1 ? 'ranker' : 'rankers'})`;
            } else {
                ratingText.textContent = 'No ratings yet';
            }
        }
    }
    
    // Load product detail page
    async function loadProductDetail(productId) {
        const detailImage = document.getElementById('productDetailPageImage');
        const detailTitle = document.getElementById('productDetailPageTitle');
        const detailPrice = document.getElementById('productDetailPagePrice');
        const detailComparePrice = document.getElementById('productDetailPageComparePrice');
        const savingsPercent = document.getElementById('productSavingsPercent');
        const detailFlavor = document.getElementById('productDetailPageFlavor');
        const detailDescription = document.getElementById('productDetailPageDescription');
        const productBreadcrumb = document.getElementById('productBreadcrumb');
        const productTagline = document.getElementById('productTagline');
        const productHighlights = document.getElementById('productHighlights');
        const productHighlightsList = document.getElementById('productHighlightsList');
        const buyNowBtn = document.getElementById('buyNowBtn');
        const statRankers = document.getElementById('productDetailPageRankers');
        const statAvgRank = document.getElementById('productDetailPageAvgRank');
        const bestChip = document.getElementById('productDetailPageBestChip');
        const worstChip = document.getElementById('productDetailPageWorstChip');
        const rankThisProductBtn = document.getElementById('rankThisProductBtn');
        
        // Try to get product from cached data first
        let product = window.productsData && window.productsData.find(p => p.id === productId);
        
        // If not in cache, fetch from API
        if (!product) {
            try {
                const response = await fetch(`/api/products/all?query=`);
                const data = await response.json();
                if (response.ok && data.products) {
                    window.productsData = data.products;
                    product = data.products.find(p => p.id === productId);
                }
            } catch (error) {
                console.error('Error loading product:', error);
            }
        }
        
        // Set product info
        if (product) {
            detailTitle.textContent = product.title;
            detailPrice.textContent = `$${product.price}`;
            detailImage.src = product.image || '';
            detailImage.alt = product.title;
            
            // Set breadcrumb
            if (productBreadcrumb) {
                productBreadcrumb.textContent = product.title;
            }
            
            // Set compare at price and savings if available
            if (product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)) {
                const original = parseFloat(product.compareAtPrice);
                const current = parseFloat(product.price);
                const savings = Math.round(((original - current) / original) * 100);
                
                detailComparePrice.textContent = `$${product.compareAtPrice}`;
                detailComparePrice.style.display = 'inline';
                
                if (savingsPercent) {
                    savingsPercent.textContent = `${savings}% SAVINGS`;
                    savingsPercent.style.display = 'inline';
                }
            } else {
                detailComparePrice.style.display = 'none';
                if (savingsPercent) savingsPercent.style.display = 'none';
            }
            
            // Set flavor badge
            if (product.flavorDisplay && detailFlavor) {
                detailFlavor.innerHTML = `${product.flavorIcon || ''} ${product.flavorDisplay}`;
            } else {
                detailFlavor.innerHTML = '';
            }
            
            // Set engaging tagline based on product type/flavor
            if (productTagline) {
                let taglineText = 'A community favorite, ranked by jerky enthusiasts like you.';
                
                if (product.animalType === 'tuna') {
                    taglineText = 'A pescatarian delight, this tuna jerky is a fish-lovers favorite.';
                } else if (product.animalType === 'beef') {
                    taglineText = 'Classic beef jerky, expertly crafted for bold flavor and tender texture.';
                } else if (product.animalType === 'turkey') {
                    taglineText = 'Lean and protein-packed, this turkey jerky delivers clean flavor.';
                } else if (product.animalType === 'pork') {
                    taglineText = 'Premium pork jerky with savory, slow-smoked perfection.';
                } else if (product.animalType === 'chicken') {
                    taglineText = 'Light and satisfying, this chicken jerky is a healthy snack staple.';
                }
                
                productTagline.querySelector('p').textContent = taglineText;
            }
            
            // Set product description from body_html
            if (product.bodyHtml && detailDescription) {
                detailDescription.innerHTML = product.bodyHtml;
                
                // Extract bullet points if present in HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = product.bodyHtml;
                const bulletList = tempDiv.querySelector('ul');
                
                if (bulletList && productHighlights && productHighlightsList) {
                    productHighlightsList.innerHTML = bulletList.innerHTML;
                    productHighlights.style.display = 'block';
                }
            } else {
                if (detailDescription) {
                    detailDescription.innerHTML = '<p>Solid filets of premium protein expertly sliced into this high-protein gourmet jerky. High in vitamins and minerals and even higher in flavor! Seriously...this stuff is good.</p>';
                }
            }
            
            // Set Buy Now button URL
            if (product.handle) {
                buyNowBtn.href = `https://www.jerky.com/products/${product.handle}`;
            } else {
                buyNowBtn.style.display = 'none';
            }
            
            // Check if user has already ranked this product
            try {
                const sessionData = await checkSession();
                if (sessionData.authenticated) {
                    const rankingResponse = await fetch(`/api/rankings/products?sessionId=${sessionData.sessionId}&rankingListId=default`);
                    const rankingData = await rankingResponse.json();
                    
                    if (rankingResponse.ok && rankingData.rankings) {
                        const existingRank = rankingData.rankings.find(r => r.productData.id === productId);
                        
                        if (existingRank && rankThisProductBtn) {
                            // User has already ranked this product - show their rank
                            rankThisProductBtn.innerHTML = `
                                <span class="cta-icon">🏆</span>
                                Your Rank: #${existingRank.ranking}
                            `;
                            rankThisProductBtn.classList.add('ranked');
                            rankThisProductBtn.onclick = () => {
                                // Navigate to rank page to view/edit their rankings
                                window.location.hash = '#rank';
                            };
                        } else if (rankThisProductBtn) {
                            // User hasn't ranked this product - show rank button
                            rankThisProductBtn.innerHTML = `
                                <span class="cta-icon">⭐</span>
                                Rank This Jerky
                            `;
                            rankThisProductBtn.classList.remove('ranked');
                            rankThisProductBtn.onclick = () => {
                                // Navigate to rank page with search parameter
                                const searchQuery = encodeURIComponent(product.title);
                                window.location.hash = `#rank?search=${searchQuery}`;
                            };
                        }
                    }
                } else {
                    // Not authenticated - show default rank button
                    if (rankThisProductBtn) {
                        rankThisProductBtn.innerHTML = `
                            <span class="cta-icon">⭐</span>
                            Rank This Jerky
                        `;
                        rankThisProductBtn.onclick = () => {
                            window.location.hash = '#rank';
                        };
                    }
                }
            } catch (error) {
                console.error('Error checking product ranking:', error);
                // Fallback to default button on error
                if (rankThisProductBtn) {
                    rankThisProductBtn.onclick = () => {
                        window.location.hash = '#rank';
                    };
                }
            }
        } else {
            detailTitle.textContent = 'Product not found';
            if (productBreadcrumb) productBreadcrumb.textContent = 'Not Found';
            detailPrice.textContent = '';
            detailComparePrice.style.display = 'none';
            if (savingsPercent) savingsPercent.style.display = 'none';
            if (detailFlavor) detailFlavor.innerHTML = '';
            if (detailDescription) detailDescription.innerHTML = '<p>Product not found.</p>';
            buyNowBtn.style.display = 'none';
        }
        
        // Reset stats to loading state
        statRankers.textContent = '0';
        statAvgRank.textContent = 'N/A';
        if (bestChip) bestChip.textContent = '#1';
        if (worstChip) worstChip.textContent = '#10';
        updateStars(null, 0);
        
        // Fetch product statistics
        try {
            const response = await fetch(`/api/products/${productId}/stats`);
            const stats = await response.json();
            
            if (response.ok) {
                const uniqueRankers = stats.uniqueRankers || 0;
                const avgRank = stats.avgRanking || 'N/A';
                const bestRank = stats.bestRanking || null;
                const worstRank = stats.worstRanking || null;
                
                statRankers.textContent = uniqueRankers;
                statAvgRank.textContent = avgRank;
                
                // Update star rating
                updateStars(avgRank, uniqueRankers);
                
                // Update best/worst rank chips
                if (bestChip && bestRank) {
                    bestChip.textContent = `#${bestRank}`;
                }
                if (worstChip && worstRank) {
                    worstChip.textContent = `#${worstRank}`;
                }
            } else {
                console.error('Failed to load product stats:', stats.error);
                updateStars(null, 0);
            }
        } catch (error) {
            console.error('Error fetching product stats:', error);
            updateStars(null, 0);
        }
    }
    
    // Load user profile page
    async function loadUserProfile(userId) {
        const userAvatar = document.getElementById('userProfileAvatar');
        const userName = document.getElementById('userProfileName');
        const userRankedCount = document.getElementById('userProfileRankedCount');
        const userRankingsList = document.getElementById('userRankingsList');
        const userAchievementsList = document.getElementById('userAchievementsList');
        
        // Set loading state
        userName.textContent = 'Loading...';
        userRankedCount.textContent = '0';
        userRankingsList.innerHTML = '<div class="loading">Loading rankings...</div>';
        userAchievementsList.innerHTML = '<div class="loading">Loading achievements...</div>';
        
        try {
            // Load user rankings and achievements in parallel
            const [rankingsResponse, achievementsResponse] = await Promise.all([
                fetch(`/api/community/users/${userId}/rankings`),
                fetch(`/api/gamification/user/${userId}/achievements`)
            ]);
            
            const rankingsData = await rankingsResponse.json();
            const achievementsData = await achievementsResponse.json();
            
            // Handle rankings
            if (rankingsResponse.ok) {
                const { user, rankings } = rankingsData;
                
                // Set user info
                userName.textContent = user.displayShort;
                userRankedCount.textContent = user.rankedCount;
                userAvatar.textContent = user.displayShort.charAt(0).toUpperCase();
                
                // Display rankings
                if (rankings.length === 0) {
                    userRankingsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No rankings yet</div>';
                } else {
                    userRankingsList.innerHTML = rankings.map(ranking => {
                        const product = ranking.product;
                        return `
                            <div class="user-ranking-item" onclick="navigateToProduct('${ranking.productId}')">
                                <div class="user-ranking-number">#${ranking.rank}</div>
                                ${product.image 
                                    ? `<img src="${product.image}" alt="${product.title}" class="user-ranking-product-image">` 
                                    : '<div class="user-ranking-product-image"></div>'}
                                <div class="user-ranking-product-info">
                                    <div class="user-ranking-product-title">${product.title}</div>
                                    <div class="user-ranking-product-vendor">${product.vendor || 'Unknown Brand'}</div>
                                    <div class="user-ranking-product-price">$${product.price}</div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            } else {
                userName.textContent = 'User not found';
                userRankingsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">User not found</div>';
            }
            
            // Handle achievements
            if (achievementsResponse.ok && achievementsData.achievements) {
                const achievements = achievementsData.achievements;
                
                if (achievements.length === 0) {
                    userAchievementsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No achievements earned yet</div>';
                } else {
                    userAchievementsList.innerHTML = achievements.map(achievement => {
                        // Get tier for display (currentTier for dynamic collections, tier for legacy)
                        const displayTier = achievement.currentTier || achievement.tier;
                        const tierEmojis = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '👑', diamond: '💠' };
                        const tierEmoji = displayTier ? tierEmojis[displayTier] || '' : '';
                        const tierLabel = displayTier ? `${displayTier.charAt(0).toUpperCase() + displayTier.slice(1)}` : '';
                        
                        const iconHtml = achievement.iconType === 'image'
                            ? `<img src="${achievement.icon}" alt="${achievement.name}" style="width: 48px; height: 48px; object-fit: contain;">`
                            : achievement.icon;
                        
                        return `
                            <div class="user-achievement-badge tier-${displayTier || 'none'}">
                                <span class="user-achievement-icon">${iconHtml}</span>
                                <span class="user-achievement-name">${achievement.name}${tierEmoji ? ` ${tierEmoji}` : ''}</span>
                                <div class="user-achievement-tooltip">${achievement.description}${tierLabel ? `<br><strong>${tierEmoji} ${tierLabel}</strong>` : ''}</div>
                            </div>
                        `;
                    }).join('');
                }
            } else {
                console.error('Failed to load achievements:', achievementsResponse.status);
                userAchievementsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Unable to load achievements</div>';
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            userName.textContent = 'Error loading profile';
            userRankingsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #ff0000;">Failed to load user profile</div>';
            userAchievementsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #ff0000;">Failed to load achievements</div>';
        }
    }
    
    // Products page search and sort controls
    const productsSearchInput = document.getElementById('productsSearchInput');
    const productSortField = document.getElementById('productSortField');
    const productSortOrder = document.getElementById('productSortOrder');
    
    function getCurrentSort() {
        if (!productSortField || !productSortOrder) return 'name-asc';
        const field = productSortField.value;
        const order = productSortOrder.getAttribute('data-order');
        return `${field}-${order}`;
    }
    
    if (productsSearchInput) {
        let searchTimeout;
        productsSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // Debounce search to avoid too many API calls
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                // Reset animal filter when searching
                selectedAnimal = null;
                const animalCategories = document.getElementById('animalCategories');
                if (animalCategories) {
                    animalCategories.querySelectorAll('.animal-category').forEach(el => el.classList.remove('active'));
                }
                
                // Update URL with search query
                const params = new URLSearchParams();
                if (query) params.set('q', query);
                if (currentSort !== 'name-asc') params.set('sort', currentSort);
                const hash = params.toString() ? `#products?${params.toString()}` : '#products';
                history.replaceState(null, '', hash);
                
                // Load products from server with search query
                loadAllProducts(query, getCurrentSort(), true);
            }, 300); // Debounce 300ms
        });
    }
    
    if (productSortField) {
        productSortField.addEventListener('change', (e) => {
            // Update current sort
            currentSort = getCurrentSort();
            
            // Update URL with new sort
            const params = new URLSearchParams();
            const query = productsSearchInput ? productsSearchInput.value.trim() : '';
            if (query) params.set('q', query);
            if (currentSort !== 'name-asc') params.set('sort', currentSort);
            if (selectedAnimal) params.set('animal', selectedAnimal);
            const hash = params.toString() ? `#products?${params.toString()}` : '#products';
            history.replaceState(null, '', hash);
            
            // Apply filters
            let filteredProducts = allProductsData;
            
            // Apply search filter if any
            if (query) {
                const searchWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
                filteredProducts = filteredProducts.filter(product => {
                    const searchableText = [
                        product.title,
                        product.vendor,
                        product.productType,
                        product.tags || '',
                        product.flavorDisplay || '',
                        product.animalDisplay || ''
                    ].join(' ').toLowerCase();
                    
                    return searchWords.every(word => searchableText.includes(word));
                });
            }
            
            // Apply animal filter if any
            if (selectedAnimal) {
                filteredProducts = filteredProducts.filter(product => {
                    // Primary: Filter by animalDisplay metadata (exact match)
                    if (product.animalDisplay) {
                        return product.animalDisplay.toLowerCase() === selectedAnimal.toLowerCase();
                    }
                    // Fallback: Comprehensive search (title, vendor, tags)
                    const searchableText = [
                        product.title,
                        product.vendor,
                        product.productType,
                        product.tags || ''
                    ].join(' ').toLowerCase();
                    return searchableText.includes(selectedAnimal.toLowerCase());
                });
            }
            
            // Sort and display
            const tempData = [...filteredProducts];
            sortProductsData(currentSort, tempData);
            displayProductsGrid(tempData);
        });
    }
    
    if (productSortOrder) {
        productSortOrder.addEventListener('click', () => {
            const currentOrder = productSortOrder.getAttribute('data-order');
            const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
            productSortOrder.setAttribute('data-order', newOrder);
            
            // Update current sort
            currentSort = getCurrentSort();
            
            // Update URL with new sort order
            const params = new URLSearchParams();
            const query = productsSearchInput ? productsSearchInput.value.trim() : '';
            if (query) params.set('q', query);
            if (currentSort !== 'name-asc') params.set('sort', currentSort);
            if (selectedAnimal) params.set('animal', selectedAnimal);
            const hash = params.toString() ? `#products?${params.toString()}` : '#products';
            history.replaceState(null, '', hash);
            
            // Apply filters
            let filteredProducts = allProductsData;
            
            // Apply search filter if any
            if (query) {
                const searchWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
                filteredProducts = filteredProducts.filter(product => {
                    const searchableText = [
                        product.title,
                        product.vendor,
                        product.productType,
                        product.tags || '',
                        product.flavorDisplay || '',
                        product.animalDisplay || ''
                    ].join(' ').toLowerCase();
                    
                    return searchWords.every(word => searchableText.includes(word));
                });
            }
            
            // Apply animal filter if any
            if (selectedAnimal) {
                filteredProducts = filteredProducts.filter(product => {
                    // Primary: Filter by animalDisplay metadata (exact match)
                    if (product.animalDisplay) {
                        return product.animalDisplay.toLowerCase() === selectedAnimal.toLowerCase();
                    }
                    // Fallback: Comprehensive search (title, vendor, tags)
                    const searchableText = [
                        product.title,
                        product.vendor,
                        product.productType,
                        product.tags || ''
                    ].join(' ').toLowerCase();
                    return searchableText.includes(selectedAnimal.toLowerCase());
                });
            }
            
            // Sort and display
            const tempData = [...filteredProducts];
            sortProductsData(currentSort, tempData);
            displayProductsGrid(tempData);
        });
    }
    
    // Load more button for products page
    const productsLoadMoreBtn = document.getElementById('productsLoadMoreBtn');
    if (productsLoadMoreBtn) {
        productsLoadMoreBtn.addEventListener('click', async () => {
            currentProductsPage++;
            await loadAllProducts(currentProductsQuery, currentSort, false); // Don't reset, append to existing
        });
    }

    // ========================================
    // Community Page Functionality
    // ========================================
    
    let allCommunityData = [];
    let communitySearchTimeout = null;
    
    async function loadCommunityUsers(query = '') {
        const communityLoading = document.getElementById('communityLoading');
        const communityList = document.getElementById('communityList');
        
        if (!communityList) return;
        
        if (communityLoading) {
            communityLoading.style.display = 'block';
        }
        
        try {
            const url = query 
                ? `/api/community/search?q=${encodeURIComponent(query)}` 
                : '/api/community/users';
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load community');
            }
            
            allCommunityData = data.users;
            displayCommunityGrid(allCommunityData);
            
            console.log(`✅ Loaded ${allCommunityData.length} community members`);
        } catch (error) {
            console.error('Error loading community:', error);
            communityList.innerHTML = '<div style="color: #dc3545; text-align: center; padding: 40px;">Error loading community. Please try again.</div>';
        } finally {
            if (communityLoading) {
                communityLoading.style.display = 'none';
            }
        }
    }
    
    function displayCommunityGrid(users) {
        const communityList = document.getElementById('communityList');
        if (!communityList) return;
        
        if (users.length === 0) {
            communityList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No community members found</div>';
            return;
        }
        
        communityList.innerHTML = users.map(user => {
            return `
                <div class="community-card" onclick="navigateToUser('${user.id}')">
                    <div class="community-card-avatar">
                        ${user.displayShort.charAt(0).toUpperCase()}
                    </div>
                    <div class="community-card-content">
                        <div class="community-card-name">${user.displayShort}</div>
                        <div class="community-card-stats">
                            ${user.rankedCount} product${user.rankedCount === 1 ? '' : 's'} ranked
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Community page search
    const communitySearchInput = document.getElementById('communitySearchInput');
    
    if (communitySearchInput) {
        communitySearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // Clear previous timeout
            if (communitySearchTimeout) {
                clearTimeout(communitySearchTimeout);
            }
            
            // Show all users when search is cleared
            if (query.length === 0) {
                loadCommunityUsers('');
                return;
            }
            
            // Debounce search - wait 300ms after user stops typing
            communitySearchTimeout = setTimeout(() => {
                loadCommunityUsers(query);
            }, 300);
        });
    }
    
    // Profile page functions
    async function loadProfileData() {
        const profileAchievementsList = document.getElementById('profileAchievementsList');
        
        try {
            const response = await fetch('/api/profile');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load profile');
            }
            
            // Update profile display
            const profileName = document.getElementById('profileName');
            const profileEmail = document.getElementById('profileEmail');
            const profileAvatar = document.getElementById('profileAvatar');
            const profileRankedCount = document.getElementById('profileRankedCount');
            const profileListsCount = document.getElementById('profileListsCount');
            
            if (profileName) {
                profileName.textContent = data.displayName || data.firstName || 'User';
            }
            
            if (profileEmail) {
                profileEmail.textContent = data.email || '';
            }
            
            if (profileAvatar) {
                const initials = data.displayName 
                    ? data.displayName.charAt(0).toUpperCase() 
                    : (data.firstName ? data.firstName.charAt(0).toUpperCase() : 'U');
                profileAvatar.textContent = initials;
            }
            
            if (profileRankedCount) {
                profileRankedCount.textContent = data.rankedCount || 0;
            }
            
            if (profileListsCount) {
                profileListsCount.textContent = data.rankingListsCount || 0;
            }
            
            // Load achievements for this user
            if (data.id && profileAchievementsList) {
                try {
                    const achievementsResponse = await fetch(`/api/gamification/user/${data.id}/achievements`);
                    const achievementsData = await achievementsResponse.json();
                    
                    if (achievementsResponse.ok && achievementsData.achievements) {
                        const achievements = achievementsData.achievements;
                        
                        if (achievements.length === 0) {
                            profileAchievementsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No achievements earned yet. Start ranking to unlock achievements!</div>';
                        } else {
                            profileAchievementsList.innerHTML = achievements.map(achievement => {
                                // Get tier for display (currentTier for dynamic collections, tier for legacy)
                                const displayTier = achievement.currentTier || achievement.tier;
                                const tierEmojis = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '👑', diamond: '💠' };
                                const tierEmoji = displayTier ? tierEmojis[displayTier] || '' : '';
                                const tierLabel = displayTier ? `${displayTier.charAt(0).toUpperCase() + displayTier.slice(1)}` : '';
                                
                                const iconHtml = achievement.iconType === 'image'
                                    ? `<img src="${achievement.icon}" alt="${achievement.name}" style="width: 48px; height: 48px; object-fit: contain;">`
                                    : achievement.icon;
                                
                                return `
                                    <div class="user-achievement-badge tier-${displayTier || 'none'}">
                                        <span class="user-achievement-icon">${iconHtml}</span>
                                        <span class="user-achievement-name">${achievement.name}${tierEmoji ? ` ${tierEmoji}` : ''}</span>
                                        <div class="user-achievement-tooltip">${achievement.description}${tierLabel ? `<br><strong>${tierEmoji} ${tierLabel}</strong>` : ''}</div>
                                    </div>
                                `;
                            }).join('');
                        }
                    } else {
                        profileAchievementsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Unable to load achievements</div>';
                    }
                } catch (achievementError) {
                    console.error('Failed to load achievements:', achievementError);
                    profileAchievementsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Unable to load achievements</div>';
                }
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
            if (profileAchievementsList) {
                profileAchievementsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Unable to load achievements</div>';
            }
        }
    }
    
    // ========================================
    // Global Search with Type-Ahead Dropdown
    // ========================================
    
    const globalSearchInput = document.getElementById('globalSearchInput');
    const globalSearchDropdown = document.getElementById('globalSearchDropdown');
    let globalSearchTimeout = null;
    
    if (globalSearchInput && globalSearchDropdown) {
        globalSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // Clear previous timeout
            if (globalSearchTimeout) {
                clearTimeout(globalSearchTimeout);
            }
            
            // Hide dropdown if empty
            if (query.length === 0) {
                globalSearchDropdown.classList.remove('active');
                globalSearchDropdown.innerHTML = '';
                return;
            }
            
            // Debounce search - wait 300ms after user stops typing
            globalSearchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/search/global?q=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Search failed');
                    }
                    
                    displayGlobalSearchResults(data);
                } catch (error) {
                    console.error('Global search error:', error);
                    globalSearchDropdown.classList.remove('active');
                }
            }, 300);
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!globalSearchInput.contains(e.target) && !globalSearchDropdown.contains(e.target)) {
                globalSearchDropdown.classList.remove('active');
            }
        });
        
        // Focus search input when clicking the search button
        const searchBtn = document.querySelector('.search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                globalSearchInput.focus();
            });
        }
    }
    
    function displayGlobalSearchResults(data) {
        const { products, users } = data;
        
        if (products.length === 0 && users.length === 0) {
            globalSearchDropdown.innerHTML = '<div class="search-dropdown-empty">No results found</div>';
            globalSearchDropdown.classList.add('active');
            return;
        }
        
        let html = '';
        
        // Display products section
        if (products.length > 0) {
            html += '<div class="search-dropdown-section">';
            html += '<div class="search-dropdown-section-title">Products</div>';
            products.forEach(product => {
                html += `
                    <div class="search-dropdown-item" data-type="product" data-id="${product.id}">
                        ${product.image 
                            ? `<img src="${product.image}" alt="${product.title}" class="search-dropdown-item-image">` 
                            : '<div class="search-dropdown-item-image"></div>'}
                        <div class="search-dropdown-item-info">
                            <div class="search-dropdown-item-title">${product.title}</div>
                            <div class="search-dropdown-item-subtitle">${product.vendor || 'Unknown Brand'} • $${product.price}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Display users section
        if (users.length > 0) {
            html += '<div class="search-dropdown-section">';
            html += '<div class="search-dropdown-section-title">Community Members</div>';
            users.forEach(user => {
                html += `
                    <div class="search-dropdown-item" data-type="user" data-id="${user.id}">
                        <div class="search-dropdown-item-image" style="display: flex; align-items: center; justify-content: center; background: #6B8E23; color: white; font-weight: bold;">
                            ${user.displayShort.charAt(0).toUpperCase()}
                        </div>
                        <div class="search-dropdown-item-info">
                            <div class="search-dropdown-item-title">${user.displayShort}</div>
                            <div class="search-dropdown-item-subtitle">${user.rankedCount} product${user.rankedCount === 1 ? '' : 's'} ranked</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        globalSearchDropdown.innerHTML = html;
        globalSearchDropdown.classList.add('active');
        
        // Add click handlers to dropdown items
        const dropdownItems = globalSearchDropdown.querySelectorAll('.search-dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                const type = item.getAttribute('data-type');
                const id = item.getAttribute('data-id');
                
                // Clear search and hide dropdown
                globalSearchInput.value = '';
                globalSearchDropdown.classList.remove('active');
                globalSearchDropdown.innerHTML = '';
                
                // Navigate to the appropriate page
                if (type === 'product') {
                    navigateToProduct(id);
                } else if (type === 'user') {
                    navigateToUser(id);
                }
            });
        });
    }
});