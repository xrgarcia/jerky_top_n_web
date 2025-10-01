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

    let currentJerkyData = [];
    let userRanking = [];
    let isRankingMode = false;

    // Navigation event listeners
    navLinks.forEach(link => {
        link.addEventListener('click', async function(e) {
            const targetPage = this.dataset.page;
            if (targetPage) {
                e.preventDefault();
                await showPage(targetPage);
            }
        });
    });

    // Event listeners
    if (loadButton) loadButton.addEventListener('click', loadTopJerky);
    if (topNSelect) topNSelect.addEventListener('change', loadTopJerky);
    if (enableRankingBtn) enableRankingBtn.addEventListener('click', enableRankingMode);
    if (resetRankingBtn) resetRankingBtn.addEventListener('click', resetRanking);

    // Page navigation functions
    async function showPage(page, updateURL = true) {
        const communityPage = document.getElementById('communityPage');
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
            
            // Hide all pages
            if (homePage) homePage.style.display = 'none';
            if (rankPage) rankPage.style.display = 'none';
            if (productsPage) productsPage.style.display = 'none';
            if (communityPage) communityPage.style.display = 'none';
            if (profilePage) profilePage.style.display = 'none';
            if (productDetailPage) productDetailPage.style.display = 'none';
            if (userProfilePage) userProfilePage.style.display = 'block';
            
            // Load user profile
            await loadUserProfile(userId);
            
            // Update active nav link (community should be active)
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            const communityLink = document.querySelector('[data-page="community"]');
            if (communityLink) communityLink.classList.add('active');
            
            return;
        }
        
        // Check if this is a product detail route
        if (page.startsWith('product/')) {
            const productId = page.split('/')[1];
            
            // Update URL hash if needed
            if (updateURL && window.location.hash !== `#${page}`) {
                window.location.hash = `#${page}`;
            }
            
            // Hide all pages
            if (homePage) homePage.style.display = 'none';
            if (rankPage) rankPage.style.display = 'none';
            if (productsPage) productsPage.style.display = 'none';
            if (communityPage) communityPage.style.display = 'none';
            if (profilePage) profilePage.style.display = 'none';
            if (productDetailPage) productDetailPage.style.display = 'block';
            if (userProfilePage) userProfilePage.style.display = 'none';
            
            // Load product detail
            await loadProductDetail(productId);
            
            // Update active nav link (products should be active)
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            const productsLink = document.querySelector('[data-page="products"]');
            if (productsLink) productsLink.classList.add('active');
            
            return;
        }
        
        // Check if rank page requires authentication
        if (page === 'rank') {
            // First try quick sync check, then async if needed
            if (!isUserAuthenticated()) {
                const isAuthenticatedAsync = await isUserAuthenticatedAsync();
                if (!isAuthenticatedAsync) {
                    showLoginRequiredMessage();
                    return;
                }
            }
        }
        
        // Update URL hash for linkable pages
        if (updateURL) {
            const newHash = page === 'home' ? '' : `#${page}`;
            if (window.location.hash !== newHash) {
                window.location.hash = newHash;
            }
        }
        
        // Hide all pages
        if (homePage) homePage.style.display = 'none';
        if (rankPage) rankPage.style.display = 'none';
        if (productsPage) productsPage.style.display = 'none';
        if (communityPage) communityPage.style.display = 'none';
        if (profilePage) profilePage.style.display = 'none';
        if (productDetailPage) productDetailPage.style.display = 'none';
        if (userProfilePage) userProfilePage.style.display = 'none';
        
        // Show selected page
        if (page === 'home' && homePage) {
            homePage.style.display = 'block';
        } else if (page === 'rank' && rankPage) {
            rankPage.style.display = 'block';
        } else if (page === 'products' && productsPage) {
            productsPage.style.display = 'block';
            // Load products when page is shown
            loadAllProducts();
        } else if (page === 'community' && communityPage) {
            communityPage.style.display = 'block';
            // Load community users when page is shown
            loadCommunityUsers();
        } else if (page === 'profile' && profilePage) {
            profilePage.style.display = 'block';
            // Load profile data when page is shown
            loadProfileData();
        }
        
        // Update active nav link
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        const activeLink = document.querySelector(`[data-page="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
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
                updateAuthUI(data.customer);
                console.log('✅ 90-day customer session validated:', data.customer.displayName);
                
                return {
                    authenticated: true,
                    sessionId: data.sessionId,
                    customer: data.customer
                };
            } else {
                // Session expired or invalid - clear local data
                localStorage.removeItem('customerSessionId');
                localStorage.removeItem('customerInfo');
                updateAuthUI(null);
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

    function showLoginRequiredMessage() {
        const message = `
            <div style="
                position: fixed; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%); 
                background: white; 
                padding: 30px; 
                border-radius: 12px; 
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 1000;
                max-width: 400px;
                text-align: center;
                border: 3px solid #6B8E23;
            " id="loginModal">
                <h3 style="color: #6B8E23; margin-bottom: 15px;">🔒 Login Required</h3>
                <p style="color: #333; margin-bottom: 20px;">You need to log in with your jerky.com account to access the ranking page.</p>
                <button 
                    style="
                        background: #6B8E23; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 6px; 
                        font-size: 16px; 
                        font-weight: 600; 
                        cursor: pointer; 
                        margin-right: 10px;
                    " 
                    onclick="closeLoginModal(); initiateCustomerLogin();">
                    Log In Now
                </button>
                <button 
                    style="
                        background: #666; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 6px; 
                        font-size: 16px; 
                        cursor: pointer;
                    " 
                    onclick="closeLoginModal();">
                    Cancel
                </button>
            </div>
            <div style="
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%; 
                background: rgba(0,0,0,0.5); 
                z-index: 999;
            " id="loginOverlay" onclick="closeLoginModal();"></div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', message);
    }

    // Global function to close login modal
    window.closeLoginModal = function() {
        const modal = document.getElementById('loginModal');
        const overlay = document.getElementById('loginOverlay');
        if (modal) modal.remove();
        if (overlay) overlay.remove();
    };

    // Global function to switch to rank page
    window.showRankPage = async function() {
        // Check authentication before accessing ranking page
        if (!isUserAuthenticated()) {
            const isAuthenticatedAsync = await isUserAuthenticatedAsync();
            if (!isAuthenticatedAsync) {
                showLoginRequiredMessage();
                return;
            }
        }
        
        await showPage('rank');
    };

    // Customer authentication functions
    if (loginBtn) {
        loginBtn.addEventListener('click', initiateCustomerLogin);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', customerLogout);
    }

    async function initiateCustomerLogin() {
        console.log('🔑 Starting customer login for jerky.com accounts...');
        
        try {
            // Get authorization URL from server
            const response = await fetch('/api/customer/auth/start');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to start authentication');
            }
            
            // Open OAuth in new window
            const authWindow = window.open(
                data.authUrl, 
                'jerky-customer-auth', 
                'width=600,height=700,scrollbars=yes,resizable=yes'
            );
            
            if (!authWindow) {
                alert('Popup blocked! Please allow popups and try again.');
                return;
            }
            
            // Listen for login success message from popup
            const messageHandler = (event) => {
                if (event.data?.type === 'CUSTOMER_LOGIN_SUCCESS') {
                    // Store session info
                    localStorage.setItem('customerSessionId', event.data.sessionId);
                    localStorage.setItem('customerInfo', JSON.stringify(event.data.customer));
                    
                    // Update UI
                    updateAuthUI(event.data.customer);
                    
                    // Remove event listener
                    window.removeEventListener('message', messageHandler);
                    
                    console.log('✅ Customer login successful:', event.data.customer);
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // Clean up if window is closed manually
            const checkClosed = setInterval(() => {
                if (authWindow.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                }
            }, 1000);
            
        } catch (error) {
            console.error('Customer login error:', error);
            alert('Failed to start login. Please try again.');
        }
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
                updateAuthUI(null);
                
                console.log('🔌 Customer logged out successfully (90-day session cleared)');
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    function updateAuthUI(customer) {
        const loginBtn = document.getElementById('loginBtn');
        const userProfile = document.getElementById('userProfile');
        const userName = document.getElementById('userName');
        
        if (customer) {
            // Show logged in state
            if (loginBtn) loginBtn.style.display = 'none';
            if (userProfile) userProfile.style.display = 'inline';
            if (userName) {
                userName.textContent = customer.displayName || customer.firstName || customer.email;
                
                // Add click handler to navigate to profile page
                userName.onclick = () => showPage('profile');
            }
        } else {
            // Show logged out state
            if (loginBtn) loginBtn.style.display = 'inline';
            if (userProfile) userProfile.style.display = 'none';
            if (userName) userName.textContent = '';
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
                updateAuthUI(data.customer);
                console.log('✅ 90-day customer session validated:', data.customer.displayName);
            } else {
                // Session expired or invalid - clear local data
                localStorage.removeItem('customerSessionId');
                localStorage.removeItem('customerInfo');
                updateAuthUI(null);
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
                            
                            // Update UI
                            updateAuthUI(data.customer);
                            
                            console.log('✅ Customer login restored from URL:', data.customer);
                            
                            // Clean up URL
                            window.location.hash = '';
                        }
                    })
                    .catch(error => {
                        console.error('Failed to verify session from URL:', error);
                    });
            }
        }
    }

    // URL routing functions
    function handleRouting() {
        const hash = window.location.hash.replace('#', '');
        const page = hash || 'home'; // Default to home if no hash
        
        // Show the page based on URL hash, but don't update URL again (prevent loop)
        showPage(page, false);
    }
    
    // Handle URL hash changes (back/forward buttons, direct links)
    window.addEventListener('hashchange', handleRouting);
    
    // Handle initial page load based on current URL hash
    handleRouting();
    
    // Check customer auth status on load
    checkCustomerAuthStatus();
    
    // Handle login success from URL hash (for direct magic link navigation)
    handleLoginSuccessFromURL();

    // Product ranking system variables
    let rankingSlots = [];
    let currentProducts = [];
    let currentPage = 1;
    let isLoading = false;
    let hasMoreProducts = true;
    let currentSearchQuery = '';

    // Initialize ranking system on page load
    async function initializeRankingSystem() {
        if (document.getElementById('rankingSlots')) {
            generateRankingSlots(10); // Start with 10 slots
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
            
            setupEventListeners();
        }
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
            const response = await fetch(`/api/products/search?query=&page=${currentPage}&limit=20`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load products');
            }

            currentProducts = data.products;
            displayProducts();
            hasMoreProducts = data.hasMore;
            
            if (hasMoreProducts) {
                loadMoreBtn.style.display = 'block';
                currentPage++;
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
                
                // Refresh product display to filter out already-ranked products
                displayProducts();
            } else {
                console.log('📝 No saved rankings found, starting fresh');
            }
        } catch (error) {
            console.error('❌ Error loading user rankings:', error);
        }
    }

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
            const response = await fetch(`/api/products/search?query=${encodeURIComponent(query)}&page=${currentPage}&limit=20`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load products');
            }

            if (reset) {
                currentProducts = data.products;
            } else {
                currentProducts = [...currentProducts, ...data.products];
            }

            displayProducts();
            hasMoreProducts = data.hasMore;
            
            if (hasMoreProducts) {
                loadMoreBtn.style.display = 'block';
                currentPage++;
            }

            console.log(`✅ Loaded ${data.products.length} products (total: ${currentProducts.length})`);

        } catch (error) {
            console.error('Error loading products:', error);
            productList.innerHTML = '<div style="color: #dc3545; text-align: center; padding: 20px;">Error loading products. Please try again.</div>';
        } finally {
            isLoading = false;
            productLoading.style.display = 'none';
        }
    }

    // Display products in the grid
    function displayProducts() {
        const productList = document.getElementById('productList');
        if (!productList) return;

        productList.innerHTML = '';

        // Get IDs of products that are already ranked
        const rankedProductIds = new Set(
            rankingSlots
                .filter(slot => slot.classList.contains('filled'))
                .map(slot => {
                    const productData = JSON.parse(slot.dataset.productData);
                    return productData.id;
                })
        );

        // Filter out products that are already ranked
        const unrankedProducts = currentProducts.filter(product => !rankedProductIds.has(product.id));

        unrankedProducts.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.draggable = true;
            productCard.dataset.productId = product.id;
            productCard.dataset.productData = JSON.stringify(product);

            productCard.innerHTML = `
                ${product.image ? `<img src="${product.image}" alt="${product.title}" class="product-image">` : '<div class="product-image" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999;">No Image</div>'}
                <div class="product-title">${product.title}</div>
                <div class="product-vendor">${product.vendor || 'Unknown Brand'}</div>
                <div class="product-price">$${product.price}</div>
            `;

            // Add drag event listeners
            productCard.addEventListener('dragstart', handleDragStart);
            productCard.addEventListener('dragend', handleDragEnd);

            productList.appendChild(productCard);
        });
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
        
        // Clear all slots first
        rankingSlots.forEach((slot, index) => {
            const rank = index + 1;
            if (slot.classList.contains('filled')) {
                removeFromSlot(rank);
            }
        });
        
        // Rebuild the rankings with push-down behavior
        let currentRank = 1;
        
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
        
        console.log(`🔄 Push-down reorder: moved rank ${sourceRank} to rank ${targetRank}, pushed others down`);
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
        
        // Make the entire slot draggable for reordering
        slot.draggable = true;
        slot.addEventListener('dragstart', handleSlotDragStart);
        slot.addEventListener('dragend', handleSlotDragEnd);
    }

    function insertProductWithPushDown(targetRank, productData) {
        // Collect all items at and after the target rank (to be pushed down)
        const itemsToPushDown = [];
        for (let i = targetRank - 1; i < rankingSlots.length; i++) {
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
        
        // Check if any pushed items landed in high-numbered slots that need expansion
        if (itemsToPushDown.length > 0) {
            checkAndAddMoreSlotsForRank(highestPushedRank);
        }
        
        console.log(`📦 Inserted product at rank ${targetRank}, pushed ${itemsToPushDown.length} items down`);
    }

    function removeFromSlot(rank) {
        const slot = rankingSlots[rank - 1];
        if (!slot || !slot.classList.contains('filled')) return;
        
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

    function scheduleAutoSave() {
        // Clear any pending auto-save
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }
        
        // Schedule auto-save after 800ms of no ranking changes
        autoSaveTimeout = setTimeout(async () => {
            if (isSaving) return; // Prevent concurrent saves
            
            updateAutoSaveStatus('saving', 'Saving...');
            await autoSaveRankings();
        }, 800);
    }

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
        try {
            isSaving = true;
            
            const sessionId = localStorage.getItem('customerSessionId');
            if (!sessionId) {
                updateAutoSaveStatus('error', 'Authentication required');
                return;
            }

            const filledSlots = rankingSlots.filter(slot => slot.classList.contains('filled'));
            if (filledSlots.length === 0) {
                updateAutoSaveStatus('', '');
                return;
            }

            const rankings = collectRankingData();
            
            const response = await fetch('/api/rankings/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    rankingListId: 'default',
                    rankings: rankings
                })
            });

            if (response.ok) {
                updateAutoSaveStatus('saved', `✓ Saved ${rankings.length} ranking${rankings.length === 1 ? '' : 's'}`);
            } else {
                updateAutoSaveStatus('error', 'Save failed');
            }
        } catch (error) {
            console.error('Auto-save error:', error);
            updateAutoSaveStatus('error', 'Save failed');
        } finally {
            isSaving = false;
        }
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
            }

            alert(`Successfully saved ${filledSlots.length} product rankings!`);
            console.log(`✅ Saved ${filledSlots.length} product rankings`);

        } catch (error) {
            console.error('Error saving rankings:', error);
            alert('Failed to save rankings. Please try again.');
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
        
        // Immediately save empty rankings array to database
        console.log('🗑️ Cleared all rankings, saving empty state to database...');
        try {
            const sessionId = localStorage.getItem('customerSessionId');
            if (!sessionId) {
                console.error('❌ No session ID, cannot clear database');
                return;
            }
            
            updateAutoSaveStatus('saving', 'Clearing...');
            
            const response = await fetch('/api/rankings/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    rankingListId: 'default',
                    rankings: [] // Send empty array to clear all rankings
                })
            });
            
            if (response.ok) {
                console.log('✅ Successfully cleared all rankings from database');
                updateAutoSaveStatus('saved', '✓ All rankings cleared');
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

    // Initialize ranking system when rank page is shown
    const originalShowPage = showPage;
    showPage = function(page) {
        originalShowPage(page);
        if (page === 'rank') {
            setTimeout(async () => {
                await initializeRankingSystem();
            }, 100);
        }
    };

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
    
    let allProductsData = [];
    let searchTimeout = null;
    
    async function loadAllProducts(query = '') {
        const productsLoading = document.getElementById('productsLoading');
        const productsGrid = document.getElementById('productsGrid');
        
        if (!productsGrid) return;
        
        if (productsLoading) {
            productsLoading.style.display = 'block';
        }
        
        try {
            const url = `/api/products/all${query ? `?query=${encodeURIComponent(query)}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load products');
            }
            
            allProductsData = data.products;
            displayProductsGrid(allProductsData);
            
            console.log(`✅ Loaded ${allProductsData.length} products with ranking counts`);
        } catch (error) {
            console.error('Error loading products:', error);
            productsGrid.innerHTML = '<div style="color: #dc3545; text-align: center; padding: 40px;">Error loading products. Please try again.</div>';
        } finally {
            if (productsLoading) {
                productsLoading.style.display = 'none';
            }
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
    
    // Load product detail page
    async function loadProductDetail(productId) {
        const detailImage = document.getElementById('productDetailPageImage');
        const detailTitle = document.getElementById('productDetailPageTitle');
        const detailVendor = document.getElementById('productDetailPageVendor');
        const detailPrice = document.getElementById('productDetailPagePrice');
        const statRankers = document.getElementById('productDetailPageRankers');
        const statAvgRank = document.getElementById('productDetailPageAvgRank');
        
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
            detailVendor.textContent = product.vendor || 'Unknown Brand';
            detailPrice.textContent = `$${product.price}`;
            detailImage.src = product.image || '';
            detailImage.alt = product.title;
        } else {
            detailTitle.textContent = 'Product not found';
            detailVendor.textContent = '';
            detailPrice.textContent = '';
        }
        
        // Reset stats to loading state
        statRankers.textContent = '-';
        statAvgRank.textContent = '-';
        
        // Fetch product statistics
        try {
            const response = await fetch(`/api/products/${productId}/stats`);
            const stats = await response.json();
            
            if (response.ok) {
                statRankers.textContent = stats.uniqueRankers;
                statAvgRank.textContent = stats.avgRanking || 'N/A';
            } else {
                console.error('Failed to load product stats:', stats.error);
                statRankers.textContent = 'Error';
                statAvgRank.textContent = 'Error';
            }
        } catch (error) {
            console.error('Error fetching product stats:', error);
            statRankers.textContent = 'Error';
            statAvgRank.textContent = 'Error';
        }
    }
    
    // Load user profile page
    async function loadUserProfile(userId) {
        const userAvatar = document.getElementById('userProfileAvatar');
        const userName = document.getElementById('userProfileName');
        const userRankedCount = document.getElementById('userProfileRankedCount');
        const userRankingsList = document.getElementById('userRankingsList');
        
        // Set loading state
        userName.textContent = 'Loading...';
        userRankedCount.textContent = '0';
        userRankingsList.innerHTML = '<div class="loading">Loading rankings...</div>';
        
        try {
            const response = await fetch(`/api/community/users/${userId}/rankings`);
            const data = await response.json();
            
            if (response.ok) {
                const { user, rankings } = data;
                
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
        } catch (error) {
            console.error('Error loading user profile:', error);
            userName.textContent = 'Error loading profile';
            userRankingsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #ff0000;">Failed to load user profile</div>';
        }
    }
    
    // Products page search - filters grid directly
    const productsSearchInput = document.getElementById('productsSearchInput');
    
    if (productsSearchInput) {
        productsSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // Clear previous timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            // Show all products when search is cleared
            if (query.length === 0) {
                displayProductsGrid(allProductsData);
                return;
            }
            
            // Debounce search - wait 300ms after user stops typing
            searchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/products/all?query=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Search failed');
                    }
                    
                    // Update the grid with search results
                    displayProductsGrid(data.products);
                } catch (error) {
                    console.error('Search error:', error);
                }
            }, 300);
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
        } catch (error) {
            console.error('Failed to load profile:', error);
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