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

    let currentJerkyData = [];
    let userRanking = [];
    let isRankingMode = false;

    // Navigation event listeners
    navLinks.forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            const targetPage = this.dataset.page;
            await showPage(targetPage);
        });
    });

    // Event listeners
    if (loadButton) loadButton.addEventListener('click', loadTopJerky);
    if (topNSelect) topNSelect.addEventListener('change', loadTopJerky);
    if (enableRankingBtn) enableRankingBtn.addEventListener('click', enableRankingMode);
    if (resetRankingBtn) resetRankingBtn.addEventListener('click', resetRanking);

    // Page navigation functions
    async function showPage(page, updateURL = true) {
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
        
        // Show selected page
        if (page === 'home' && homePage) {
            homePage.style.display = 'block';
        } else if (page === 'rank' && rankPage) {
            rankPage.style.display = 'block';
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
            if (userName) userName.textContent = customer.displayName || customer.firstName || customer.email;
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
            await loadUserRankings(); // Load user's saved rankings first
            hideRankingLoadStatus(); // Hide loading indicator
            loadProducts(); // Load initial products
            setupEventListeners();
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
                
                // Populate ranking slots with saved rankings
                data.rankings.forEach(ranking => {
                    const slot = document.querySelector(`[data-rank="${ranking.ranking}"]`);
                    if (slot) {
                        fillSlot(slot, ranking.ranking, ranking.productData);
                    }
                });
                
                // Generate additional slots if needed
                const maxRank = Math.max(...data.rankings.map(r => r.ranking));
                if (maxRank >= 10) {
                    const slotsNeeded = maxRank + 3; // Add 3 more slots beyond highest rank
                    if (slotsNeeded > rankingSlots.length) {
                        generateRankingSlots(slotsNeeded);
                        // Re-populate after generating new slots
                        data.rankings.forEach(ranking => {
                            const slot = document.querySelector(`[data-rank="${ranking.ranking}"]`);
                            if (slot) {
                                fillSlot(slot, ranking.ranking, ranking.productData);
                            }
                        });
                    }
                }
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

        currentProducts.forEach(product => {
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
            clearRankingBtn.addEventListener('click', clearAllRankings);
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
            
            // Check if we need to add more slots
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
        itemsToPushDown.forEach((item, index) => {
            const newRank = targetRank + 1 + index;
            if (newRank <= rankingSlots.length) {
                fillSlot(rankingSlots[newRank - 1], newRank, item.data);
            }
        });
        
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
        
        // Trigger auto-save
        scheduleAutoSave();
    }

    function checkAndAddMoreSlots() {
        // Check if the 10th slot is filled
        const tenthSlot = rankingSlots[9]; // 0-indexed
        if (tenthSlot && tenthSlot.classList.contains('filled')) {
            // Check if we haven't already added extra slots
            if (rankingSlots.length === 10) {
                generateRankingSlots(13); // Add 3 more slots (total 13)
            }
        }
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

    function clearAllRankings() {
        if (confirm('Are you sure you want to clear all rankings?')) {
            rankingSlots.forEach((slot, index) => {
                removeFromSlot(index + 1);
            });
            generateRankingSlots(10); // Reset to 10 slots
            
            // Trigger auto-save after clearing
            scheduleAutoSave();
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
});