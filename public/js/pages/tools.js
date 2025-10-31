/**
 * Tools Page - Employee Admin Tools
 */

let liveUsersSubscribed = false;
let currentToolTab = 'achievements';
let allProducts = [];
let filteredProducts = [];
let hasSuperAdminAccess = false;

/**
 * Show toast notification
 */
function showToast({ type = 'info', icon = '🔔', title = '', message = '', duration = 5000 }) {
  const container = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

async function loadAchievementsTable() {
  // This function is now handled by toolsAdmin.js
  if (window.initAchievementAdmin) {
    window.initAchievementAdmin();
  } else {
    console.error('Achievement admin module not loaded');
  }
}

async function loadLiveUsers() {
  try {
    const response = await fetch('/api/tools/live-users');
    
    if (!response.ok) {
      if (response.status === 403) {
        sessionStorage.setItem('loginMessage', 'You do not have access to that page.');
        window.location.hash = '#login';
        window.showPage('login');
        return;
      }
      throw new Error('Failed to load live users');
    }

    const data = await response.json();
    updateLiveUsersTable(data.users || [], data.count || 0);
    
  } catch (error) {
    console.error('Error loading live users:', error);
    const tableBody = document.getElementById('liveUsersTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #e74c3c; padding: 20px;">
            Failed to load live users. ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

function updateLiveUsersTable(users, count) {
  const tableBody = document.getElementById('liveUsersTableBody');
  const countBadge = document.getElementById('liveUserCount');
  
  if (countBadge) {
    countBadge.textContent = `${count} online`;
  }
  
  if (!tableBody) return;
  
  if (users.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
          No active users at the moment
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = users.map(user => {
    const connectedTime = formatTimeAgo(user.connectedAt);
    const lastActivityTime = formatTimeAgo(user.lastActivity);
    const displayName = `${user.firstName} ${user.lastName}`;
    const pageIcon = getPageIcon(user.currentPage);
    const connectionBadge = user.connectionCount > 1 
      ? `<span style="background: #3498db; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px; margin-left: 5px;">${user.connectionCount} tabs</span>` 
      : '';
    
    return `
      <tr>
        <td><strong>${displayName}</strong>${connectionBadge}</td>
        <td>${user.email}</td>
        <td>${pageIcon} ${formatPageName(user.currentPage)}</td>
        <td>${connectedTime}</td>
        <td>${lastActivityTime}</td>
        <td><code style="font-size: 11px; color: #666;">${user.socketId.substring(0, 8)}...</code></td>
      </tr>
    `;
  }).join('');
}

function getPageIcon(page) {
  const icons = {
    home: '🏠',
    rank: '⭐',
    products: '🥩',
    community: '👥',
    profile: '👤',
    tools: '🛠️'
  };
  return icons[page] || '📄';
}

function formatPageName(page) {
  const names = {
    home: 'Home',
    rank: 'Rankings',
    products: 'Products',
    community: 'Community',
    profile: 'Profile',
    tools: 'Tools'
  };
  return names[page] || page;
}

function formatTimeAgo(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const seconds = Math.floor((now - time) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatRequirement(requirement) {
  if (!requirement) return '-';
  
  const typeLabels = {
    rank_count: 'Rank Count',
    streak_days: 'Streak Days',
    unique_brands: 'Unique Brands',
    leaderboard_position: 'Leaderboard Position',
    profile_views: 'Profile Views',
    join_before: 'Join Before',
    trendsetter: 'Trending Ranks'
  };
  
  const typeLabel = typeLabels[requirement.type] || requirement.type;
  return `${typeLabel}: ${requirement.value}`;
}

async function loadProductsTable() {
  try {
    const response = await fetch('/api/tools/products');
    
    if (!response.ok) {
      if (response.status === 403) {
        sessionStorage.setItem('loginMessage', 'You do not have access to that page.');
        window.location.hash = '#login';
        window.showPage('login');
        return;
      }
      throw new Error('Failed to load products');
    }

    const data = await response.json();
    allProducts = data.products || [];
    filteredProducts = [...allProducts];
    
    populateFilterDropdowns();
    renderProductsTable();
    
  } catch (error) {
    console.error('Error loading products table:', error);
    const tableBody = document.getElementById('productsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: #e74c3c; padding: 20px;">
            Failed to load products. ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

function populateFilterDropdowns() {
  const vendors = [...new Set(allProducts.map(p => p.vendor).filter(Boolean))].sort();
  const animalTypes = [...new Set(allProducts.map(p => p.animalType).filter(Boolean))].sort();
  const animalDisplays = [...new Set(allProducts.map(p => p.animalDisplay).filter(Boolean))].sort();
  const flavors = [...new Set(allProducts.map(p => p.primaryFlavor).filter(Boolean))].sort();
  
  const vendorFilter = document.getElementById('vendorFilter');
  const animalTypeFilter = document.getElementById('animalTypeFilter');
  const animalDisplayFilter = document.getElementById('animalDisplayFilter');
  const primaryFlavorFilter = document.getElementById('primaryFlavorFilter');
  
  if (vendorFilter) {
    vendorFilter.innerHTML = '<option value="">All Vendors</option>' + 
      vendors.map(v => `<option value="${v}">${v}</option>`).join('');
  }
  
  if (animalTypeFilter) {
    animalTypeFilter.innerHTML = '<option value="">All Animal Types</option>' + 
      animalTypes.map(a => `<option value="${a}">${a}</option>`).join('');
  }
  
  if (animalDisplayFilter) {
    animalDisplayFilter.innerHTML = '<option value="">All Animal Displays</option>' + 
      animalDisplays.map(a => `<option value="${a}">${a}</option>`).join('');
  }
  
  if (primaryFlavorFilter) {
    primaryFlavorFilter.innerHTML = '<option value="">All Flavors</option>' + 
      flavors.map(f => `<option value="${f}">${f}</option>`).join('');
  }
}

function applyProductFilters() {
  const searchTerm = document.getElementById('productsSearch')?.value.toLowerCase() || '';
  const vendorFilter = document.getElementById('vendorFilter')?.value || '';
  const animalTypeFilter = document.getElementById('animalTypeFilter')?.value || '';
  const animalDisplayFilter = document.getElementById('animalDisplayFilter')?.value || '';
  const primaryFlavorFilter = document.getElementById('primaryFlavorFilter')?.value || '';
  
  filteredProducts = allProducts.filter(product => {
    // Search in user-visible fields including metadata (animal type, flavor)
    const searchableFields = [
      product.title,
      product.vendor,
      product.animalType,       // e.g., "cattle", "poultry", "exotic"
      product.animalDisplay,    // e.g., "Beef", "Chicken", "Alligator"
      product.primaryFlavor,    // e.g., "spicy", "sweet", "savory"
      product.flavorDisplay     // e.g., "Spicy", "Sweet & Spicy"
    ];
    
    const matchesSearch = searchTerm === '' || 
      searchableFields.some(field => 
        field && field.toString().toLowerCase().includes(searchTerm)
      );
    
    const matchesVendor = vendorFilter === '' || product.vendor === vendorFilter;
    const matchesAnimalType = animalTypeFilter === '' || product.animalType === animalTypeFilter;
    const matchesAnimalDisplay = animalDisplayFilter === '' || product.animalDisplay === animalDisplayFilter;
    const matchesFlavor = primaryFlavorFilter === '' || product.primaryFlavor === primaryFlavorFilter;
    
    return matchesSearch && matchesVendor && matchesAnimalType && matchesAnimalDisplay && matchesFlavor;
  });
  
  updateActiveFilterCount();
  renderProductsTable();
}

function updateActiveFilterCount() {
  const searchTerm = document.getElementById('productsSearch')?.value || '';
  const vendorFilter = document.getElementById('vendorFilter')?.value || '';
  const animalTypeFilter = document.getElementById('animalTypeFilter')?.value || '';
  const animalDisplayFilter = document.getElementById('animalDisplayFilter')?.value || '';
  const primaryFlavorFilter = document.getElementById('primaryFlavorFilter')?.value || '';
  
  let activeCount = 0;
  if (searchTerm) activeCount++;
  if (vendorFilter) activeCount++;
  if (animalTypeFilter) activeCount++;
  if (animalDisplayFilter) activeCount++;
  if (primaryFlavorFilter) activeCount++;
  
  const badge = document.getElementById('productsActiveFilterCount');
  if (badge) {
    if (activeCount > 0) {
      badge.textContent = `${activeCount} active`;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

function toggleProductFilters() {
  const filtersContainer = document.getElementById('productsFilters');
  const filterContent = document.getElementById('productsFilterContent');
  const toggleButton = document.getElementById('productsFilterToggle');
  
  if (!filtersContainer || !filterContent || !toggleButton) return;
  
  const isCurrentlyCollapsed = filtersContainer.classList.contains('collapsed');
  
  if (isCurrentlyCollapsed) {
    filterContent.removeAttribute('hidden');
    filtersContainer.classList.remove('collapsed');
    filtersContainer.classList.add('expanded');
    toggleButton.setAttribute('aria-expanded', 'true');
    toggleButton.setAttribute('aria-label', 'Hide filters');
    filterContent.setAttribute('aria-hidden', 'false');
    sessionStorage.setItem('productsFiltersCollapsed', 'false');
  } else {
    filtersContainer.classList.remove('expanded');
    filtersContainer.classList.add('collapsed');
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.setAttribute('aria-label', 'Show filters');
    filterContent.setAttribute('aria-hidden', 'true');
    sessionStorage.setItem('productsFiltersCollapsed', 'true');
    
    setTimeout(() => {
      if (filtersContainer.classList.contains('collapsed')) {
        filterContent.setAttribute('hidden', '');
      }
    }, 400);
  }
}

function initializeProductFiltersState() {
  const isCollapsed = sessionStorage.getItem('productsFiltersCollapsed') !== 'false';
  const filtersContainer = document.getElementById('productsFilters');
  const filterContent = document.getElementById('productsFilterContent');
  const toggleButton = document.getElementById('productsFilterToggle');
  
  if (!filtersContainer || !filterContent || !toggleButton) return;
  
  if (isCollapsed) {
    filtersContainer.classList.add('collapsed');
    filtersContainer.classList.remove('expanded');
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.setAttribute('aria-label', 'Show filters');
    filterContent.setAttribute('aria-hidden', 'true');
    filterContent.setAttribute('hidden', '');
  } else {
    filtersContainer.classList.add('expanded');
    filtersContainer.classList.remove('collapsed');
    toggleButton.setAttribute('aria-expanded', 'true');
    toggleButton.setAttribute('aria-label', 'Hide filters');
    filterContent.setAttribute('aria-hidden', 'false');
    filterContent.removeAttribute('hidden');
  }
}

function renderProductsTable() {
  const tableBody = document.getElementById('productsTableBody');
  const countBadge = document.getElementById('productsCount');
  
  if (countBadge) {
    countBadge.textContent = `${filteredProducts.length} products`;
  }
  
  if (!tableBody) return;
  
  if (filteredProducts.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: #999;">
          No products match the current filters
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = filteredProducts.map(product => {
    const imageUrl = product.image || '/placeholder.png';
    const avgRank = product.avgRank ? product.avgRank.toFixed(1) : '-';
    const price = product.price ? `$${product.price}` : '-';
    
    return `
      <tr>
        <td><img src="${imageUrl}" alt="${product.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.src='/placeholder.png'"></td>
        <td><strong>${product.title || 'Untitled'}</strong></td>
        <td>${product.vendor || '-'}</td>
        <td>${product.animalIcon || ''} ${product.animalType || '-'}</td>
        <td>${product.animalDisplay || '-'}</td>
        <td>${product.flavorIcon || ''} ${product.primaryFlavor || '-'}</td>
        <td>${price}</td>
        <td>${product.rankingCount || 0}</td>
        <td>${avgRank}</td>
        <td>
          <button class="btn-edit-product" data-product-id="${product.shopifyProductId}" data-product-title="${product.title}" data-animal-type="${product.animalType || ''}" data-animal-display="${product.animalDisplay || ''}" data-animal-icon="${product.animalIcon || ''}" title="Edit metadata">
            ✏️ Edit
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  setupProductEditButtons();
}

function setupProductFilters() {
  const searchInput = document.getElementById('productsSearch');
  const vendorFilter = document.getElementById('vendorFilter');
  const animalTypeFilter = document.getElementById('animalTypeFilter');
  const animalDisplayFilter = document.getElementById('animalDisplayFilter');
  const primaryFlavorFilter = document.getElementById('primaryFlavorFilter');
  const toggleButton = document.getElementById('productsFilterToggle');
  
  if (searchInput) {
    searchInput.addEventListener('input', applyProductFilters);
  }
  
  if (vendorFilter) {
    vendorFilter.addEventListener('change', applyProductFilters);
  }
  
  if (animalTypeFilter) {
    animalTypeFilter.addEventListener('change', applyProductFilters);
  }
  
  if (animalDisplayFilter) {
    animalDisplayFilter.addEventListener('change', applyProductFilters);
  }
  
  if (primaryFlavorFilter) {
    primaryFlavorFilter.addEventListener('change', applyProductFilters);
  }
  
  if (toggleButton) {
    toggleButton.addEventListener('click', toggleProductFilters);
  }
  
  initializeProductFiltersState();
}

function setupToolNavigation() {
  const toolBtns = document.querySelectorAll('.tools-nav-btn');
  
  toolBtns.forEach(btn => {
    btn.addEventListener('click', async function() {
      const tool = this.dataset.tool;
      
      toolBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      document.querySelectorAll('.tool-section').forEach(section => {
        section.style.display = 'none';
      });
      
      currentToolTab = tool;
      
      if (tool === 'achievements') {
        document.getElementById('achievementsTool').style.display = 'block';
        await loadAchievementsTable();
        
        if (liveUsersSubscribed && window.socket) {
          window.socket.emit('unsubscribe:live-users');
          liveUsersSubscribed = false;
        }
        unsubscribeFromCustomerOrdersUpdates();
      } else if (tool === 'data') {
        document.getElementById('dataTool').style.display = 'block';
        await loadEnvironmentConfig(); // Load environment config when tab is shown
        
        if (liveUsersSubscribed && window.socket) {
          window.socket.emit('unsubscribe:live-users');
          liveUsersSubscribed = false;
        }
        unsubscribeFromCustomerOrdersUpdates();
      } else if (tool === 'live-users') {
        document.getElementById('liveUsersTool').style.display = 'block';
        await loadLiveUsers();
        
        if (window.socket && !liveUsersSubscribed) {
          window.socket.emit('subscribe:live-users');
          liveUsersSubscribed = true;
        }
        unsubscribeFromCustomerOrdersUpdates();
      } else if (tool === 'products') {
        document.getElementById('productsTool').style.display = 'block';
        await loadProductsTable();
        
        if (liveUsersSubscribed && window.socket) {
          window.socket.emit('unsubscribe:live-users');
          liveUsersSubscribed = false;
        }
        unsubscribeFromCustomerOrdersUpdates();
      } else if (tool === 'customer-orders') {
        document.getElementById('customerOrdersTool').style.display = 'block';
        await loadCustomerOrders();
        
        if (liveUsersSubscribed && window.socket) {
          window.socket.emit('unsubscribe:live-users');
          liveUsersSubscribed = false;
        }
        subscribeToCustomerOrdersUpdates();
      } else if (tool === 'sentry-issues') {
        document.getElementById('sentryIssuesTool').style.display = 'block';
        await loadSentryIssues();
        
        if (liveUsersSubscribed && window.socket) {
          window.socket.emit('unsubscribe:live-users');
          liveUsersSubscribed = false;
        }
        unsubscribeFromCustomerOrdersUpdates();
      }
    });
  });
}

// Modal helper functions
function showConfirmationModal(title, message, onConfirm, requiredText = null) {
  const modal = document.getElementById('confirmationModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const cancelBtn = document.getElementById('modalCancelBtn');
  const inputContainer = document.getElementById('modalInputContainer');
  const requiredTextEl = document.getElementById('modalRequiredText');
  const confirmInput = document.getElementById('modalConfirmInput');
  
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  
  // Store cleanup handler reference
  let handleInput = null;
  
  // Handle text confirmation requirement
  if (requiredText) {
    inputContainer.style.display = 'block';
    requiredTextEl.textContent = requiredText;
    confirmInput.placeholder = `Type "${requiredText}" here`;
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.5';
    confirmBtn.style.cursor = 'not-allowed';
    
    // Enable confirm button only when text matches exactly
    handleInput = () => {
      const matches = confirmInput.value === requiredText;
      confirmBtn.disabled = !matches;
      confirmBtn.style.opacity = matches ? '1' : '0.5';
      confirmBtn.style.cursor = matches ? 'pointer' : 'not-allowed';
    };
    
    confirmInput.addEventListener('input', handleInput);
    
    // Focus after a small delay to ensure modal is rendered
    setTimeout(() => confirmInput.focus(), 100);
  } else {
    inputContainer.style.display = 'none';
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
    confirmBtn.style.cursor = 'pointer';
  }
  
  modal.style.display = 'flex';
  
  const handleConfirm = async () => {
    // Double-check text matches if required
    if (requiredText && confirmInput.value !== requiredText) {
      return;
    }
    cleanup();
    await onConfirm();
  };
  
  const handleCancel = () => {
    cleanup();
  };
  
  const cleanup = () => {
    modal.style.display = 'none';
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    if (requiredText && handleInput) {
      confirmInput.removeEventListener('input', handleInput);
      confirmInput.value = '';
    }
    // Reset button state
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
    confirmBtn.style.cursor = 'pointer';
  };
  
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}

async function clearAllAchievements() {
  try {
    const response = await fetch('/api/admin/data/clear-all', {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        showToast({
          type: 'error',
          icon: '🔐',
          title: 'Access Denied',
          message: 'Super admin privileges required (ray@jerky.com only).',
          duration: 5000
        });
        return;
      }
      throw new Error('Failed to clear all data');
    }
    
    const data = await response.json();
    
    showToast({
      type: 'success',
      icon: '✅',
      title: 'Success',
      message: data.message || 'Successfully cleared all achievement data',
      duration: 7000
    });
    
    await loadAchievementsTable();
  } catch (error) {
    console.error('Error clearing all data:', error);
    
    showToast({
      type: 'error',
      icon: '❌',
      title: 'Error',
      message: `Failed to clear all data: ${error.message}`,
      duration: 5000
    });
  }
}

/**
 * Check if current user has super admin access (ray@jerky.com only)
 */
async function checkSuperAdminAccess() {
  try {
    const response = await fetch('/api/admin/data/check-access');
    
    if (!response.ok) {
      hasSuperAdminAccess = false;
      return;
    }

    const data = await response.json();
    hasSuperAdminAccess = data.hasSuperAdminAccess || false;
    
    // Show/hide the Manage Data tab based on super admin access
    const manageDataTab = document.getElementById('manageDataTabBtn');
    if (manageDataTab) {
      manageDataTab.style.display = hasSuperAdminAccess ? 'block' : 'none';
    }
    
    console.log('🔐 Super admin access:', hasSuperAdminAccess);
  } catch (error) {
    console.error('Error checking super admin access:', error);
    hasSuperAdminAccess = false;
  }
}

async function clearAllCache() {
  try {
    const response = await fetch('/api/admin/data/clear-cache', {
      method: 'POST'
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        showToast({
          type: 'error',
          icon: '🔐',
          title: 'Access Denied',
          message: 'Super admin privileges required (ray@jerky.com only).',
          duration: 5000
        });
        return;
      }
      throw new Error('Failed to clear cache');
    }
    
    const data = await response.json();
    
    if (data.success) {
      const cacheNames = data.clearedCaches ? data.clearedCaches.join(', ') : 'all caches';
      
      showToast({
        type: 'success',
        icon: '🗑️',
        title: 'Cache Cleared',
        message: `Successfully cleared: ${cacheNames}`,
        duration: 5000
      });
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    
    showToast({
      type: 'error',
      icon: '❌',
      title: 'Error',
      message: `Failed to clear cache: ${error.message}`,
      duration: 5000
    });
  }
}

// Initialize tools page when it's shown
window.initToolsPage = async function() {
  console.log('🛠️ Initializing Tools page...');
  
  const userRole = localStorage.getItem('userRole');
  const customerInfo = localStorage.getItem('customerInfo');
  let userEmail = null;
  
  // Extract email from customerInfo object
  if (customerInfo) {
    try {
      const customer = JSON.parse(customerInfo);
      userEmail = customer.email;
    } catch (e) {
      console.error('Failed to parse customerInfo:', e);
    }
  }
  
  // Allow access if user has employee_admin role OR email ends with @jerky.com
  const hasAccess = userRole === 'employee_admin' || (userEmail && userEmail.endsWith('@jerky.com'));
  
  if (!hasAccess) {
    // Redirect to login page with access denied message
    sessionStorage.setItem('loginMessage', 'You do not have access to that page.');
    window.location.hash = '#login';
    window.showPage('login');
    return;
  }
  
  setupToolNavigation();
  setupProductFilters();
  setupCustomerOrdersFilters();
  await checkSuperAdminAccess(); // Check super admin access and show/hide Manage Data tab
  await loadAchievementsTable();
  
  const clearAllBtn = document.getElementById('clearAllAchievementsBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      showConfirmationModal(
        'Clear All Data',
        '⚠️ This will permanently delete ALL data for ALL users including: achievements, streaks, rankings, page views, and searches. This action cannot be undone.',
        clearAllAchievements,
        'delete all data'
      );
    });
  }
  
  const clearCacheBtn = document.getElementById('clearAllCacheBtn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      showConfirmationModal(
        'Clear All Cache',
        '⚠️ This will clear all cached data including achievements, leaderboards, product metadata, and home stats. The cache will automatically rebuild on next request.',
        clearAllCache,
        'delete cache'
      );
    });
  }
  
  const saveCacheConfigBtn = document.getElementById('saveCacheConfigBtn');
  if (saveCacheConfigBtn) {
    saveCacheConfigBtn.addEventListener('click', async () => {
      const metadataInput = document.getElementById('metadataCacheStaleHours');
      const rankingStatsInput = document.getElementById('rankingStatsCacheStaleHours');
      
      const metadataHours = parseInt(metadataInput.value);
      const rankingStatsHours = parseInt(rankingStatsInput.value);
      
      // Validate both inputs
      if (isNaN(metadataHours) || metadataHours < 1 || metadataHours > 720) {
        showToast({
          type: 'error',
          icon: '❌',
          title: 'Invalid Input',
          message: 'Metadata cache hours must be between 1 and 720 (30 days).'
        });
        return;
      }
      
      if (isNaN(rankingStatsHours) || rankingStatsHours < 1 || rankingStatsHours > 720) {
        showToast({
          type: 'error',
          icon: '❌',
          title: 'Invalid Input',
          message: 'Ranking stats cache hours must be between 1 and 720 (30 days).'
        });
        return;
      }
      
      saveCacheConfigBtn.disabled = true;
      saveCacheConfigBtn.textContent = '💾 Saving...';
      
      try {
        const response = await fetch('/api/admin/cache-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            metadataCacheStaleHours: metadataHours,
            rankingStatsCacheStaleHours: rankingStatsHours
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save configuration');
        }
        
        const data = await response.json();
        document.getElementById('currentMetadataCacheStaleHours').textContent = metadataHours;
        document.getElementById('currentRankingStatsCacheStaleHours').textContent = rankingStatsHours;
        
        showToast({
          type: 'success',
          icon: '✅',
          title: 'Configuration Saved',
          message: `Cache thresholds updated: Metadata ${metadataHours}h, Stats ${rankingStatsHours}h`
        });
      } catch (error) {
        console.error('Error saving cache config:', error);
        showToast({
          type: 'error',
          icon: '❌',
          title: 'Save Failed',
          message: error.message || 'Failed to save configuration. Please try again.'
        });
      } finally {
        saveCacheConfigBtn.disabled = false;
        saveCacheConfigBtn.textContent = '💾 Save Configuration';
      }
    });
  }
  
  await loadCacheConfig();
  
  if (window.socket) {
    window.socket.on('live-users:update', (data) => {
      if (currentToolTab === 'live-users') {
        updateLiveUsersTable(data.users || [], data.count || 0);
      }
    });
  }
  
  await loadAvailableAnimalsForProducts();
  setupProductEditModal();
};

let availableAnimalsForProducts = [];

async function loadAvailableAnimalsForProducts() {
  try {
    const response = await fetch('/api/admin/animal-categories/with-counts');
    if (!response.ok) {
      throw new Error('Failed to load animal categories');
    }
    const data = await response.json();
    availableAnimalsForProducts = data.animals || [];
    populateAnimalDropdown();
  } catch (error) {
    console.error('Error loading animals for products:', error);
  }
}

function populateAnimalDropdown() {
  const select = document.getElementById('editAnimalSelect');
  if (!select) return;
  
  const optionsHTML = availableAnimalsForProducts.map(animal => {
    return `<option value="${animal.display}" data-type="${animal.type}" data-icon="${animal.icon}">${animal.icon} ${animal.display} (${animal.type})</option>`;
  }).join('');
  
  select.innerHTML = `<option value="">Select an animal...</option>${optionsHTML}`;
}

function setupProductEditButtons() {
  const editButtons = document.querySelectorAll('.btn-edit-product');
  editButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const productId = this.dataset.productId;
      const productTitle = this.dataset.productTitle;
      const animalType = this.dataset.animalType;
      const animalDisplay = this.dataset.animalDisplay;
      const animalIcon = this.dataset.animalIcon;
      
      openProductEditModal(productId, productTitle, animalType, animalDisplay, animalIcon);
    });
  });
}

function openProductEditModal(productId, productTitle, animalType, animalDisplay, animalIcon) {
  const modal = document.getElementById('productEditModal');
  const productNameEl = document.getElementById('editProductName');
  const productIdInput = document.getElementById('editProductId');
  const animalSelect = document.getElementById('editAnimalSelect');
  const previewContainer = document.getElementById('animalPreview');
  
  if (!modal) return;
  
  productNameEl.textContent = productTitle;
  productIdInput.value = productId;
  
  if (animalDisplay) {
    animalSelect.value = animalDisplay;
    updateAnimalPreview(animalType, animalDisplay, animalIcon);
  } else {
    animalSelect.value = '';
    previewContainer.style.display = 'none';
  }
  
  modal.style.display = 'flex';
}

function updateAnimalPreview(type, display, icon) {
  const previewContainer = document.getElementById('animalPreview');
  const previewIcon = document.getElementById('previewIcon');
  const previewDisplay = document.getElementById('previewDisplay');
  const previewType = document.getElementById('previewType');
  
  if (!previewContainer) return;
  
  previewIcon.textContent = icon || '';
  previewDisplay.textContent = display || '';
  previewType.textContent = type || '';
  
  previewContainer.style.display = 'block';
}

function setupProductEditModal() {
  const modal = document.getElementById('productEditModal');
  const closeBtn = document.getElementById('closeProductEditBtn');
  const cancelBtn = document.getElementById('cancelProductEditBtn');
  const saveBtn = document.getElementById('saveProductEditBtn');
  const animalSelect = document.getElementById('editAnimalSelect');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', saveProductEdit);
  }
  
  if (animalSelect) {
    animalSelect.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      if (this.value) {
        const type = selectedOption.dataset.type;
        const display = this.value;
        const icon = selectedOption.dataset.icon;
        updateAnimalPreview(type, display, icon);
      } else {
        document.getElementById('animalPreview').style.display = 'none';
      }
    });
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

async function saveProductEdit() {
  const productId = document.getElementById('editProductId').value;
  const animalSelect = document.getElementById('editAnimalSelect');
  const selectedOption = animalSelect.options[animalSelect.selectedIndex];
  const saveBtn = document.getElementById('saveProductEditBtn');
  
  if (!animalSelect.value) {
    alert('Please select an animal category');
    return;
  }
  
  const animalType = selectedOption.dataset.type;
  const animalDisplay = animalSelect.value;
  const animalIcon = selectedOption.dataset.icon;
  
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  try {
    const response = await fetch(`/api/admin/products/${productId}/metadata`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        animalType,
        animalDisplay,
        animalIcon,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update product');
    }
    
    const modal = document.getElementById('productEditModal');
    modal.style.display = 'none';
    
    showToast({
      type: 'success',
      icon: '✅',
      title: 'Success',
      message: 'Product metadata updated successfully',
    });
    
    await loadProductsTable();
    
  } catch (error) {
    console.error('Error updating product:', error);
    showToast({
      type: 'error',
      icon: '❌',
      title: 'Error',
      message: error.message || 'Failed to update product',
    });
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
}

async function loadCacheConfig() {
  try {
    const response = await fetch('/api/admin/cache-config');
    
    if (!response.ok) {
      console.error('Failed to load cache config');
      return;
    }
    
    const data = await response.json();
    const metadataHours = data.metadataCacheStaleHours || 168;
    const rankingStatsHours = data.rankingStatsCacheStaleHours || 48;
    
    // Update metadata cache inputs
    const metadataInput = document.getElementById('metadataCacheStaleHours');
    const metadataDisplay = document.getElementById('currentMetadataCacheStaleHours');
    if (metadataInput) metadataInput.value = metadataHours;
    if (metadataDisplay) metadataDisplay.textContent = metadataHours;
    
    // Update ranking stats cache inputs
    const rankingStatsInput = document.getElementById('rankingStatsCacheStaleHours');
    const rankingStatsDisplay = document.getElementById('currentRankingStatsCacheStaleHours');
    if (rankingStatsInput) rankingStatsInput.value = rankingStatsHours;
    if (rankingStatsDisplay) rankingStatsDisplay.textContent = rankingStatsHours;
    
  } catch (error) {
    console.error('Error loading cache config:', error);
  }
}

async function loadEnvironmentConfig() {
  const container = document.getElementById('environmentConfigContent');
  if (!container) return;
  
  try {
    const response = await fetch('/api/admin/environment-config');
    
    if (!response.ok) {
      container.innerHTML = `
        <div style="padding: 20px; color: #e74c3c; text-align: center;">
          <strong>Failed to load environment configuration</strong>
          <div style="margin-top: 10px; font-size: 14px;">Access denied or server error</div>
        </div>
      `;
      return;
    }
    
    const config = await response.json();
    
    // Determine environment badge color
    const envBadgeColor = config.environment.detectedEnvironment === 'production' 
      ? '#c4a962' 
      : '#6B8E23';
    
    // Build HTML for environment config display
    let html = `
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
        <!-- Environment Detection -->
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 15px 0; color: #2c2c2c; font-size: 16px; font-weight: 600;">
            🌍 Environment Detection
          </h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">Detected Environment</td>
              <td style="padding: 10px;">
                <span style="background: ${envBadgeColor}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 12px;">
                  ${config.environment.detectedEnvironment}
                </span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">NODE_ENV</td>
              <td style="padding: 10px; font-family: monospace; color: #333;">${config.environment.nodeEnv}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">REPLIT_DEPLOYMENT</td>
              <td style="padding: 10px; font-family: monospace; color: #333;">${config.environment.replitDeployment}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 500; color: #555;">Domain</td>
              <td style="padding: 10px; font-family: monospace; font-size: 12px; color: #333; word-break: break-all;">${config.environment.replitDomains}</td>
            </tr>
          </table>
        </div>
        
        <!-- Redis Configuration -->
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 15px 0; color: #2c2c2c; font-size: 16px; font-weight: 600;">
            🔴 Redis Cache Configuration
          </h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">Secret Source</td>
              <td style="padding: 10px; font-family: monospace; color: #333;">${config.redis.urlSource}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">Connection Status</td>
              <td style="padding: 10px;">
                ${config.redis.available 
                  ? '<span style="color: #27ae60; font-weight: 600;">✅ Connected</span>' 
                  : '<span style="color: #e74c3c; font-weight: 600;">❌ Not Available</span>'}
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">Host:Port</td>
              <td style="padding: 10px; font-family: monospace; font-size: 14px; font-weight: 600; color: #c4a962;">${config.redis.hostPort || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 500; color: #555;">Full URL (masked)</td>
              <td style="padding: 10px; font-family: monospace; font-size: 11px; color: #666; word-break: break-all;">${config.redis.maskedUrl || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <!-- Database Configuration -->
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 15px 0; color: #2c2c2c; font-size: 16px; font-weight: 600;">
            💾 Database Configuration
          </h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">Connection Status</td>
              <td style="padding: 10px;">
                ${config.database.available 
                  ? '<span style="color: #27ae60; font-weight: 600;">✅ Connected</span>' 
                  : '<span style="color: #e74c3c; font-weight: 600;">❌ Not Available</span>'}
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">Host:Port</td>
              <td style="padding: 10px; font-family: monospace; font-size: 14px; font-weight: 600; color: #c4a962;">${config.database.hostPort || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 500; color: #555;">Full URL (masked)</td>
              <td style="padding: 10px; font-family: monospace; font-size: 11px; color: #666; word-break: break-all;">${config.database.maskedUrl || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <!-- Shopify Configuration -->
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 15px 0; color: #2c2c2c; font-size: 16px; font-weight: 600;">
            🛍️ Shopify Integration
          </h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">Shop Domain</td>
              <td style="padding: 10px; font-family: monospace; color: #333;">${config.shopify.shop}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">API Key</td>
              <td style="padding: 10px;">
                ${config.shopify.apiKeySet 
                  ? '<span style="color: #27ae60;">✅ Set</span>' 
                  : '<span style="color: #e74c3c;">❌ Missing</span>'}
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">API Secret</td>
              <td style="padding: 10px;">
                ${config.shopify.apiSecretSet 
                  ? '<span style="color: #27ae60;">✅ Set</span>' 
                  : '<span style="color: #e74c3c;">❌ Missing</span>'}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 500; color: #555;">Access Token</td>
              <td style="padding: 10px;">
                ${config.shopify.accessTokenSet 
                  ? '<span style="color: #27ae60;">✅ Set</span>' 
                  : '<span style="color: #e74c3c;">❌ Missing</span>'}
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Sentry Configuration -->
        <div>
          <h4 style="margin: 0 0 15px 0; color: #2c2c2c; font-size: 16px; font-weight: 600;">
            🐛 Sentry Error Tracking
          </h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 10px; font-weight: 500; color: #555;">DSN</td>
              <td style="padding: 10px;">
                ${config.sentry.dsnSet 
                  ? '<span style="color: #27ae60;">✅ Set</span>' 
                  : '<span style="color: #e74c3c;">❌ Missing</span>'}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 500; color: #555;">Environment</td>
              <td style="padding: 10px; font-family: monospace; color: #333;">${config.sentry.environment}</td>
            </tr>
          </table>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading environment config:', error);
    container.innerHTML = `
      <div style="padding: 20px; color: #e74c3c; text-align: center;">
        <strong>Error loading environment configuration</strong>
        <div style="margin-top: 10px; font-size: 14px;">${error.message}</div>
      </div>
    `;
  }
}

// Customer Orders Management
let currentOrdersPage = 1;
let currentOrdersFilters = {};
let currentOrdersSort = {
  sortBy: 'orderDate',
  sortOrder: 'desc'
};
const ordersPerPage = 50;
let customerOrdersSocketSubscribed = false;

async function loadCustomerOrders(page = 1) {
  try {
    const params = new URLSearchParams({
      limit: ordersPerPage,
      offset: (page - 1) * ordersPerPage,
      ...currentOrdersFilters,
      ...currentOrdersSort
    });

    const response = await fetch(`/api/admin/customer-orders?${params}`);
    
    if (!response.ok) {
      if (response.status === 403) {
        sessionStorage.setItem('loginMessage', 'You do not have access to that page.');
        window.location.hash = '#login';
        window.showPage('login');
        return;
      }
      
      // Handle rate limit errors
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      
      // Try to get error message from response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load customer orders');
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to load customer orders');
      }
    }

    const data = await response.json();
    currentOrdersPage = page;
    
    renderCustomerOrdersTable(data.orders || []);
    updateOrdersPagination(data.total, page);
    
  } catch (error) {
    console.error('Error loading customer orders:', error);
    
    // Log to Sentry
    if (window.ErrorTracking) {
      window.ErrorTracking.captureException(error, {
        endpoint: '/api/admin/customer-orders',
        filters: currentOrdersFilters,
        sort: currentOrdersSort,
        page: currentOrdersPage
      });
    }
    
    const tableBody = document.getElementById('customerOrdersTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #e74c3c; padding: 20px;">
            Failed to load customer orders. ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

function handleOrderColumnSort(columnName) {
  if (currentOrdersSort.sortBy === columnName) {
    currentOrdersSort.sortOrder = currentOrdersSort.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentOrdersSort.sortBy = columnName;
    currentOrdersSort.sortOrder = 'asc';
  }
  
  loadCustomerOrders(currentOrdersPage);
}

function updateOrderColumnHeaders() {
  const headerRow = document.querySelector('.orders-table thead tr');
  if (!headerRow) return;
  
  const sortableColumns = {
    0: 'orderNumber',
    1: 'customerEmail',
    2: 'sku',
    3: 'quantity',
    4: 'fulfillmentStatus',
    5: 'orderDate'
  };
  
  const headers = headerRow.querySelectorAll('th');
  headers.forEach((header, index) => {
    const columnName = sortableColumns[index];
    if (!columnName) return;
    
    header.style.cursor = 'pointer';
    header.style.userSelect = 'none';
    header.setAttribute('data-sort-column', columnName);
    
    const isSorted = currentOrdersSort.sortBy === columnName;
    const arrow = isSorted 
      ? (currentOrdersSort.sortOrder === 'asc' ? ' ▲' : ' ▼')
      : '';
    
    const baseText = header.textContent.replace(/ [▲▼]/g, '');
    header.textContent = baseText + arrow;
    
    if (isSorted) {
      header.style.color = '#c4a962';
    } else {
      header.style.color = '';
    }
    
    header.onclick = () => handleOrderColumnSort(columnName);
  });
}

function renderCustomerOrdersTable(orders) {
  const tableBody = document.getElementById('customerOrdersTableBody');
  const orderCount = document.getElementById('orderCount');
  
  if (orderCount) {
    orderCount.textContent = `${orders.length} orders loaded`;
  }
  
  if (!tableBody) return;
  
  if (orders.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #999;">
          No orders found
        </td>
      </tr>
    `;
    return;
  }
  
  updateOrderColumnHeaders();
  
  tableBody.innerHTML = orders.map(order => {
    const orderDateTime = new Date(order.orderDate);
    const formattedDateTime = orderDateTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const customerName = order.userFirstName && order.userLastName 
      ? `${order.userFirstName} ${order.userLastName}`
      : 'N/A';
    const lineItemTitle = order.lineItemData?.title || 'N/A';
    const lineItemPrice = order.lineItemData?.price || 'N/A';
    
    const fulfillmentBadge = getFulfillmentStatusBadge(order.fulfillmentStatus);
    
    return `
      <tr style="border-bottom: 1px solid #e9ecef;">
        <td style="padding: 12px;">
          <a href="#" 
             onclick="viewOrderDetails('${order.orderNumber}'); return false;" 
             style="color: #c4a962; text-decoration: none; font-weight: bold; cursor: pointer;"
             onmouseover="this.style.textDecoration='underline'" 
             onmouseout="this.style.textDecoration='none'">
            ${order.orderNumber}
          </a>
        </td>
        <td style="padding: 12px;">
          <div style="font-size: 13px;">
            <div><strong>${customerName}</strong></div>
            <div style="color: #666; font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${order.customerEmail}">${order.customerEmail}</div>
          </div>
        </td>
        <td style="padding: 12px;">
          ${order.sku ? `<code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${order.sku}</code>` : '<span style="color: #999;">—</span>'}
        </td>
        <td style="padding: 12px; text-align: center;">
          <strong>${order.quantity}</strong>
        </td>
        <td style="padding: 12px;">
          ${fulfillmentBadge}
        </td>
        <td style="padding: 12px;">
          ${formattedDateTime}
        </td>
        <td style="padding: 12px;">
          <div style="font-size: 12px;">
            <div><strong>${lineItemTitle}</strong></div>
            <div style="color: #666;">$${lineItemPrice}</div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function viewOrderDetails(orderNumber) {
  try {
    // Fetch order details
    const response = await fetch(`/api/admin/customer-orders/${orderNumber}`);
    
    if (!response.ok) {
      throw new Error('Failed to load order details');
    }
    
    const orderData = await response.json();
    
    // Display order details modal
    showOrderDetailsModal(orderData);
    
  } catch (error) {
    console.error('Error loading order details:', error);
    showToast({
      type: 'error',
      icon: '❌',
      title: 'Error',
      message: 'Failed to load order details',
      duration: 3000
    });
  }
}

function showOrderDetailsModal(orderData) {
  const modal = document.getElementById('orderDetailsModal');
  if (!modal) {
    console.error('Order details modal not found');
    return;
  }
  
  const { order, items } = orderData;
  
  // Format order date
  const orderDate = new Date(order.orderDate);
  const formattedDate = orderDate.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  const customerName = order.userFirstName && order.userLastName 
    ? `${order.userFirstName} ${order.userLastName}`
    : 'N/A';
  
  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.lineItemData?.price || 0) * item.quantity), 0);
  
  // Build items table
  const itemsHTML = items.map((item, index) => {
    const lineItemTitle = item.lineItemData?.title || 'N/A';
    const lineItemPrice = item.lineItemData?.price || '0.00';
    const lineTotal = (parseFloat(lineItemPrice) * item.quantity).toFixed(2);
    const fulfillmentBadge = getFulfillmentStatusBadge(item.fulfillmentStatus);
    
    return `
      <tr style="border-bottom: 1px solid #e9ecef;">
        <td style="padding: 12px; text-align: center;">${index + 1}</td>
        <td style="padding: 12px;">
          <div><strong>${lineItemTitle}</strong></div>
          ${item.sku ? `<div style="color: #666; font-size: 12px; margin-top: 4px;">SKU: ${item.sku}</div>` : ''}
        </td>
        <td style="padding: 12px; text-align: center;"><strong>${item.quantity}</strong></td>
        <td style="padding: 12px; text-align: right;">$${lineItemPrice}</td>
        <td style="padding: 12px; text-align: right;"><strong>$${lineTotal}</strong></td>
        <td style="padding: 12px; text-align: center;">${fulfillmentBadge}</td>
      </tr>
    `;
  }).join('');
  
  const modalContent = `
    <div style="background: white; border-radius: 8px; width: 95%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
      <!-- Header -->
      <div style="padding: 24px; border-bottom: 2px solid #e9ecef; background: #f8f9fa;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <h2 style="margin: 0 0 8px 0; color: #2c2c2c; font-size: 24px;">Order ${order.orderNumber}</h2>
            <div style="color: #666; font-size: 14px;">${formattedDate}</div>
          </div>
          <button onclick="closeOrderDetailsModal()" style="background: none; border: none; font-size: 28px; color: #999; cursor: pointer; padding: 0; line-height: 1;">×</button>
        </div>
      </div>
      
      <!-- Customer Info -->
      <div style="padding: 24px; border-bottom: 1px solid #e9ecef;">
        <h3 style="margin: 0 0 16px 0; color: #2c2c2c; font-size: 16px; font-weight: 600;">Customer Information</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div>
            <div style="color: #666; font-size: 12px; margin-bottom: 4px;">Name</div>
            <div style="font-weight: 600;">${customerName}</div>
          </div>
          <div>
            <div style="color: #666; font-size: 12px; margin-bottom: 4px;">Email</div>
            <div style="font-weight: 600; word-break: break-all;">${order.customerEmail}</div>
          </div>
        </div>
      </div>
      
      <!-- Order Items -->
      <div style="padding: 24px;">
        <h3 style="margin: 0 0 16px 0; color: #2c2c2c; font-size: 16px; font-weight: 600;">Order Items (${items.length})</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background: white;">
            <thead>
              <tr style="background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #555;">#</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #555;">Product</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #555;">Qty</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #555;">Price</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; color: #555;">Total</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #555;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
            <tfoot>
              <tr style="border-top: 2px solid #e9ecef; background: #f8f9fa;">
                <td colspan="4" style="padding: 16px; text-align: right; font-weight: 600; font-size: 16px;">Total:</td>
                <td style="padding: 16px; text-align: right; font-weight: 700; font-size: 16px; color: #c4a962;">$${totalAmount.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="padding: 20px 24px; border-top: 1px solid #e9ecef; background: #f8f9fa; text-align: right;">
        <button onclick="closeOrderDetailsModal()" style="padding: 10px 24px; background: #c4a962; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px;">Close</button>
      </div>
    </div>
  `;
  
  modal.innerHTML = modalContent;
  modal.style.display = 'flex';
}

function closeOrderDetailsModal() {
  const modal = document.getElementById('orderDetailsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function getFulfillmentStatusBadge(status) {
  if (!status) {
    return `<span style="display: inline-block; padding: 4px 10px; background: #6c757d; color: white; border-radius: 12px; font-size: 11px; font-weight: 600;">UNFULFILLED</span>`;
  }
  
  const statusColors = {
    'fulfilled': { bg: '#28a745', text: 'white', label: 'FULFILLED' },
    'partial': { bg: '#ffc107', text: '#333', label: 'PARTIAL' },
    'unfulfilled': { bg: '#6c757d', text: 'white', label: 'UNFULFILLED' },
    'restocked': { bg: '#17a2b8', text: 'white', label: 'RESTOCKED' },
    'not_eligible': { bg: '#dc3545', text: 'white', label: 'NOT ELIGIBLE' },
    'delivered': { bg: '#17c671', text: 'white', label: 'DELIVERED' }
  };
  
  const config = statusColors[status.toLowerCase()] || { bg: '#6c757d', text: 'white', label: status.toUpperCase() };
  
  return `<span style="display: inline-block; padding: 4px 10px; background: ${config.bg}; color: ${config.text}; border-radius: 12px; font-size: 11px; font-weight: 600;">${config.label}</span>`;
}

function updateOrdersPagination(total, currentPage) {
  const totalEl = document.getElementById('ordersTotal');
  const showingEl = document.getElementById('ordersShowing');
  const currentPageEl = document.getElementById('currentOrdersPage');
  const prevBtn = document.getElementById('prevOrdersPage');
  const nextBtn = document.getElementById('nextOrdersPage');
  
  const start = (currentPage - 1) * ordersPerPage + 1;
  const end = Math.min(currentPage * ordersPerPage, total);
  
  if (totalEl) totalEl.textContent = total;
  if (showingEl) showingEl.textContent = total > 0 ? `${start}-${end}` : '0';
  if (currentPageEl) currentPageEl.textContent = `Page ${currentPage}`;
  
  if (prevBtn) {
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
    prevBtn.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
  }
  
  if (nextBtn) {
    const hasMore = end < total;
    nextBtn.disabled = !hasMore;
    nextBtn.style.opacity = hasMore ? '1' : '0.5';
    nextBtn.style.cursor = hasMore ? 'pointer' : 'not-allowed';
  }
}

async function loadFilterOptions() {
  try {
    const response = await fetch('/api/admin/customer-orders/filters');
    if (!response.ok) {
      throw new Error('Failed to load filter options');
    }
    
    const data = await response.json();
    
    // Populate fulfillment status dropdown
    const fulfillmentSelect = document.getElementById('filterFulfillmentStatus');
    if (fulfillmentSelect && data.filters.fulfillmentStatuses) {
      // Keep the "All Statuses" option
      fulfillmentSelect.innerHTML = '<option value="">All Statuses</option>';
      
      // Add actual statuses from database
      data.filters.fulfillmentStatuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        // Capitalize first letter for display
        option.textContent = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
        fulfillmentSelect.appendChild(option);
      });
    }
    
  } catch (error) {
    console.error('Error loading filter options:', error);
  }
}

function setupCustomerOrdersFilters() {
  const applyBtn = document.getElementById('applyOrderFilters');
  const clearBtn = document.getElementById('clearOrderFilters');
  const prevBtn = document.getElementById('prevOrdersPage');
  const nextBtn = document.getElementById('nextOrdersPage');
  
  // Load filter options from database
  loadFilterOptions();
  
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      currentOrdersFilters = {
        orderNumber: document.getElementById('filterOrderNumber')?.value || '',
        customerEmail: document.getElementById('filterCustomerEmail')?.value || '',
        productId: document.getElementById('filterProductId')?.value || '',
        sku: document.getElementById('filterSku')?.value || '',
        fulfillmentStatus: document.getElementById('filterFulfillmentStatus')?.value || '',
        dateFrom: document.getElementById('filterDateFrom')?.value || '',
        dateTo: document.getElementById('filterDateTo')?.value || ''
      };
      
      // Remove empty filters
      Object.keys(currentOrdersFilters).forEach(key => {
        if (!currentOrdersFilters[key]) {
          delete currentOrdersFilters[key];
        }
      });
      
      loadCustomerOrders(1);
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('filterOrderNumber').value = '';
      document.getElementById('filterCustomerEmail').value = '';
      document.getElementById('filterProductId').value = '';
      document.getElementById('filterSku').value = '';
      document.getElementById('filterFulfillmentStatus').value = '';
      document.getElementById('filterDateFrom').value = '';
      document.getElementById('filterDateTo').value = '';
      
      currentOrdersFilters = {};
      loadCustomerOrders(1);
    });
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentOrdersPage > 1) {
        loadCustomerOrders(currentOrdersPage - 1);
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      loadCustomerOrders(currentOrdersPage + 1);
    });
  }
}

// Debounce helper to prevent excessive API calls
let customerOrdersReloadTimer = null;
function debouncedLoadCustomerOrders(page) {
  if (customerOrdersReloadTimer) {
    clearTimeout(customerOrdersReloadTimer);
  }
  customerOrdersReloadTimer = setTimeout(() => {
    loadCustomerOrders(page);
  }, 500); // Wait 500ms after last webhook before reloading
}

function subscribeToCustomerOrdersUpdates() {
  if (!window.socket || customerOrdersSocketSubscribed) return;
  
  // Attempt to subscribe to customer orders (only after authentication)
  const attemptSubscription = () => {
    console.log('📦 Attempting to subscribe to customer orders updates...');
    window.socket.emit('subscribe:customer-orders');
    // Don't set flag here - wait for server confirmation
  };
  
  // Listen for subscription confirmation/failure (set up once)
  window.socket.off('subscription:confirmed'); // Remove old listeners
  window.socket.on('subscription:confirmed', (data) => {
    if (data.room === 'customer-orders') {
      console.log('✅ Customer orders subscription confirmed by server');
      customerOrdersSocketSubscribed = true; // Only set flag on confirmation
    }
  });
  
  window.socket.off('subscription:failed'); // Remove old listeners
  window.socket.on('subscription:failed', (data) => {
    if (data.room === 'customer-orders') {
      console.error('❌ Customer orders subscription failed:', data.reason);
      customerOrdersSocketSubscribed = false; // Reset flag to allow retry
      
      // Retry after authentication if the failure was due to missing auth
      if (data.reason.includes('Admin access required') && window.appEventBus) {
        console.log('🔄 Will retry subscription after authentication...');
      }
    }
  });
  
  // Subscribe after authentication
  if (window.appEventBus) {
    // Listen for authentication (initial or re-authentication)
    window.appEventBus.on('socket:authenticated', () => {
      if (!customerOrdersSocketSubscribed && currentToolTab === 'customer-orders') {
        console.log('🔄 Socket authenticated, subscribing to customer orders...');
        attemptSubscription();
      }
    });
    
    // Re-subscribe after reconnection
    window.socket.on('connect', () => {
      if (currentToolTab === 'customer-orders') {
        console.log('🔄 Socket reconnected, waiting for authentication...');
        customerOrdersSocketSubscribed = false; // Reset subscription flag
        // The socket:authenticated event will trigger the subscription
      }
    });
    
    // Try to subscribe immediately if socket is already authenticated
    // (Check if we've already received socket:authenticated by looking for user data)
    const sessionId = localStorage.getItem('customerSessionId');
    if (sessionId) {
      console.log('🔄 Session exists, attempting immediate subscription...');
      attemptSubscription();
    }
  } else {
    // Fallback: subscribe immediately if eventBus is not available
    console.warn('⚠️ EventBus not available, attempting subscription anyway');
    attemptSubscription();
  }
  
  // Set up the event listener for order updates (only once)
  window.socket.off('customer-orders:updated'); // Remove any existing listeners
  window.socket.on('customer-orders:updated', (data) => {
    console.log('📦 Customer orders updated:', data);
    
    let statusMessage = '';
    if (data.action === 'deleted') {
      statusMessage = 'cancelled';
    } else if (data.action === 'upserted') {
      const itemText = data.itemsCount === 1 ? 'item' : 'items';
      
      // Add fulfillment status info if available
      let fulfillmentInfo = '';
      if (data.fulfillmentStatuses && data.fulfillmentStatuses.length > 0) {
        const statuses = data.fulfillmentStatuses.map(s => {
          // Capitalize and format status
          return s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ');
        });
        fulfillmentInfo = ` (${statuses.join(', ')})`;
      }
      
      statusMessage = `${data.itemsCount} ${itemText} updated${fulfillmentInfo}`;
    } else {
      statusMessage = 'updated';
    }
    
    showToast({
      type: data.action === 'deleted' ? 'warning' : 'info',
      icon: data.action === 'deleted' ? '🗑️' : '📦',
      title: 'Order Updated',
      message: `Order ${data.orderNumber} ${statusMessage}`,
      duration: 3000
    });
    
    // Debounce the reload to prevent rate limiting when many webhooks arrive quickly
    debouncedLoadCustomerOrders(currentOrdersPage);
  });
}

function unsubscribeFromCustomerOrdersUpdates() {
  if (!window.socket || !customerOrdersSocketSubscribed) return;
  
  window.socket.emit('unsubscribe:customer-orders');
  window.socket.off('customer-orders:updated');
  customerOrdersSocketSubscribed = false;
  console.log('📦 Unsubscribed from customer orders updates');
}

async function loadSentryIssues() {
  const tableBody = document.getElementById('sentryIssuesTableBody');
  const countSpan = document.getElementById('sentryIssuesCount');
  const environmentFilter = document.getElementById('sentryEnvironmentFilter');
  const statusFilter = document.getElementById('sentryStatusFilter');
  const applyFiltersBtn = document.getElementById('sentryApplyFiltersBtn');
  const refreshBtn = document.getElementById('sentryRefreshBtn');
  
  const fetchIssues = async () => {
    try {
      countSpan.textContent = 'Loading...';
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: #999;">
            <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid #7b8b52; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="margin-top: 10px;">Loading Sentry issues...</div>
          </td>
        </tr>
      `;
      
      const environment = environmentFilter.value;
      const status = statusFilter.value;
      
      const params = new URLSearchParams({ environment, status, limit: 50 });
      const response = await fetch(`/api/admin/sentry/issues?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to fetch Sentry issues');
      }
      
      const data = await response.json();
      const issues = data.issues || [];
      
      countSpan.textContent = `${issues.length} issue(s) found`;
      
      if (issues.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 40px; color: #999;">
              <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
              <div>No ${status === 'all' ? '' : status} issues found!</div>
            </td>
          </tr>
        `;
        return;
      }
      
      tableBody.innerHTML = issues.map(issue => {
        const levelColors = {
          error: '#e74c3c',
          warning: '#f39c12',
          info: '#3498db',
          debug: '#95a5a6'
        };
        
        const statusColors = {
          unresolved: '#e74c3c',
          resolved: '#27ae60',
          ignored: '#95a5a6'
        };
        
        return `
          <tr style="border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" 
              onmouseover="this.style.background='rgba(123, 139, 82, 0.03)'" 
              onmouseout="this.style.background='white'">
            <td style="padding: 12px 15px;">
              <span style="
                background: ${levelColors[issue.level] || '#95a5a6'}; 
                color: white; 
                padding: 4px 8px; 
                border-radius: 4px; 
                font-size: 11px; 
                font-weight: 600; 
                text-transform: uppercase;
              ">${issue.level}</span>
            </td>
            <td style="padding: 12px 15px;">
              <div style="font-weight: 500; margin-bottom: 4px;">${issue.title}</div>
              <div style="font-size: 12px; color: #666;">${issue.culprit || 'Unknown location'}</div>
              ${issue.metadata.type ? `<div style="font-size: 11px; color: #999; margin-top: 2px;">${issue.metadata.type}</div>` : ''}
            </td>
            <td style="padding: 12px 15px;">
              <span style="
                background: ${issue.environment === 'production' ? '#e74c3c' : '#3498db'}; 
                color: white; 
                padding: 3px 6px; 
                border-radius: 3px; 
                font-size: 11px;
              ">${issue.environment}</span>
            </td>
            <td style="padding: 12px 15px;">
              <strong>${issue.count.toLocaleString()}</strong>
            </td>
            <td style="padding: 12px 15px;">
              ${issue.userCount.toLocaleString()}
            </td>
            <td style="padding: 12px 15px; font-size: 12px; color: #666;">
              ${formatRelativeTime(issue.firstSeen)}
            </td>
            <td style="padding: 12px 15px; font-size: 12px; color: #666;">
              ${formatRelativeTime(issue.lastSeen)}
            </td>
            <td style="padding: 12px 15px;">
              <span style="
                background: ${statusColors[issue.status] || '#95a5a6'}; 
                color: white; 
                padding: 3px 8px; 
                border-radius: 3px; 
                font-size: 11px;
              ">${issue.status}</span>
            </td>
            <td style="padding: 12px 15px;">
              <button onclick="showSentryIssueDetail('${issue.id}', '${issue.shortId}')" 
                 style="
                   background: #7b8b52; 
                   color: white; 
                   border: none; 
                   padding: 6px 12px; 
                   border-radius: 4px; 
                   cursor: pointer; 
                   font-weight: 500;
                   font-size: 13px;
                 "
                 onmouseover="this.style.background='#6a7a45'"
                 onmouseout="this.style.background='#7b8b52'">
                View Details →
              </button>
            </td>
          </tr>
        `;
      }).join('');
      
    } catch (error) {
      console.error('❌ Error loading Sentry issues:', error);
      countSpan.textContent = 'Error loading issues';
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: #e74c3c;">
            <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
            <div style="font-weight: 500; margin-bottom: 5px;">Failed to load Sentry issues</div>
            <div style="font-size: 13px; color: #999;">${error.message}</div>
          </td>
        </tr>
      `;
    }
  };
  
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', fetchIssues);
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchIssues);
  }
  
  await fetchIssues();
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Unknown';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

async function showSentryIssueDetail(issueId, shortId) {
  const detailSection = document.getElementById('sentryIssueDetail');
  const listSection = document.getElementById('sentryIssuesList');
  const detailContent = document.getElementById('sentryDetailContent');
  
  if (!detailSection || !listSection || !detailContent) {
    console.error('Sentry detail elements not found');
    return;
  }
  
  listSection.style.display = 'none';
  detailSection.style.display = 'block';
  
  detailContent.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <div style="display: inline-block; width: 48px; height: 48px; border: 4px solid #7b8b52; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <div style="margin-top: 20px; color: #666; font-size: 16px;">Loading issue details...</div>
    </div>
  `;
  
  try {
    const [issueResponse, eventResponse] = await Promise.all([
      fetch(`/api/admin/sentry/issues/${issueId}`),
      fetch(`/api/admin/sentry/issues/${issueId}/events/latest`)
    ]);
    
    if (!issueResponse.ok || !eventResponse.ok) {
      throw new Error('Failed to fetch issue details');
    }
    
    const issueData = await issueResponse.json();
    const eventData = await eventResponse.json();
    
    const issue = issueData.issue;
    const event = eventData.event;
    
    renderSentryIssueDetail(issue, event);
    
  } catch (error) {
    console.error('Error loading issue details:', error);
    detailContent.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #e74c3c;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-weight: 600; font-size: 18px; margin-bottom: 8px;">Failed to load issue details</div>
        <div style="font-size: 14px; color: #999;">${error.message}</div>
        <button onclick="closeSentryIssueDetail()" style="margin-top: 20px; padding: 10px 20px; background: #7b8b52; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">Back to Issues</button>
      </div>
    `;
  }
}

function closeSentryIssueDetail() {
  const detailSection = document.getElementById('sentryIssueDetail');
  const listSection = document.getElementById('sentryIssuesList');
  
  if (detailSection && listSection) {
    detailSection.style.display = 'none';
    listSection.style.display = 'block';
  }
}

function renderSentryIssueDetail(issue, event) {
  const detailContent = document.getElementById('sentryDetailContent');
  
  const statusColors = {
    'unresolved': '#e74c3c',
    'resolved': '#27ae60',
    'ignored': '#95a5a6'
  };
  
  const levelColors = {
    'error': '#e74c3c',
    'warning': '#f39c12',
    'info': '#3498db',
    'debug': '#95a5a6'
  };
  
  const stackTrace = event.exception && event.exception.length > 0 
    ? event.exception[0].stacktrace?.frames || [] 
    : [];
  
  const breadcrumbs = event.breadcrumbs || [];
  const tags = event.tags || [];
  const context = event.context || {};
  
  const stackTraceHTML = stackTrace.length > 0
    ? stackTrace.reverse().map((frame, index) => `
        <div style="background: ${index === 0 ? '#fff5f5' : 'white'}; border: 1px solid ${index === 0 ? '#e74c3c' : '#e0e0e0'}; border-radius: 4px; padding: 12px; margin-bottom: 8px; font-family: 'Courier New', monospace; font-size: 13px;">
          <div style="font-weight: 600; color: ${index === 0 ? '#e74c3c' : '#333'}; margin-bottom: 4px;">
            ${index === 0 ? '🔴 ' : ''}${frame.function || '<anonymous>'}
          </div>
          <div style="color: #666; font-size: 12px;">
            ${frame.filename || 'Unknown file'}${frame.lineNo ? `:${frame.lineNo}` : ''}${frame.colNo ? `:${frame.colNo}` : ''}
          </div>
          ${frame.context && frame.context.length > 0 ? `
            <div style="margin-top: 8px; padding: 8px; background: #f5f5f5; border-radius: 3px; overflow-x: auto;">
              ${frame.context.map((line, i) => `
                <div style="color: ${i === Math.floor(frame.context.length / 2) ? '#e74c3c' : '#666'}; font-weight: ${i === Math.floor(frame.context.length / 2) ? '600' : 'normal'};">
                  ${line[0]}: ${escapeHtml(line[1])}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')
    : '<div style="padding: 20px; text-align: center; color: #999;">No stack trace available</div>';
  
  const breadcrumbsHTML = breadcrumbs.length > 0
    ? breadcrumbs.slice(-10).map((crumb, index) => {
        const timestamp = crumb.timestamp ? new Date(crumb.timestamp * 1000).toLocaleTimeString() : 'Unknown';
        const categoryIcon = crumb.category === 'console' ? '📝' : crumb.category === 'navigation' ? '🔗' : crumb.category === 'xhr' ? '📡' : '📍';
        return `
          <div style="border-left: 3px solid ${index === breadcrumbs.length - 1 ? '#e74c3c' : '#ddd'}; padding: 8px 12px; margin-bottom: 8px; background: ${index === breadcrumbs.length - 1 ? '#fff5f5' : 'white'};">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
              <div style="font-weight: 600; color: #333;">${categoryIcon} ${crumb.category || 'event'}</div>
              <div style="font-size: 11px; color: #999;">${timestamp}</div>
            </div>
            <div style="font-size: 13px; color: #666;">${escapeHtml(crumb.message || JSON.stringify(crumb.data || {}))}</div>
          </div>
        `;
      }).join('')
    : '<div style="padding: 20px; text-align: center; color: #999;">No breadcrumbs available</div>';
  
  const tagsHTML = tags.length > 0
    ? tags.map(tag => `
        <div style="display: inline-block; background: #f0f0f0; padding: 4px 8px; border-radius: 3px; margin: 4px; font-size: 12px;">
          <span style="color: #666; font-weight: 600;">${tag.key}:</span> <span style="color: #333;">${escapeHtml(tag.value)}</span>
        </div>
      `).join('')
    : '<div style="color: #999; font-size: 13px;">No tags available</div>';
  
  const contextHTML = Object.keys(context).length > 0
    ? Object.entries(context).map(([key, value]) => `
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${key}</div>
          <pre style="background: #f5f5f5; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 12px; margin: 0;">${escapeHtml(JSON.stringify(value, null, 2))}</pre>
        </div>
      `).join('')
    : '<div style="color: #999; font-size: 13px;">No context data available</div>';
  
  detailContent.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e0e0e0;">
        <div>
          <button onclick="closeSentryIssueDetail()" style="background: #f0f0f0; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; margin-bottom: 12px;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f0f0f0'">← Back to Issues</button>
          <h2 style="margin: 0; font-size: 24px; color: #2c2c2c;">${issue.shortId}: ${escapeHtml(issue.title)}</h2>
        </div>
        <div style="text-align: right;">
          <a href="${issue.permalink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #e74c3c; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: 600; margin-bottom: 8px;" onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">
            🔗 Open in Sentry →
          </a>
          <div style="font-size: 12px; color: #666;">View full issue in Sentry dashboard</div>
        </div>
      </div>
      
      <!-- Quick Stats -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
          <div style="color: #666; font-size: 12px; margin-bottom: 4px;">Status</div>
          <div style="font-weight: 600; color: ${statusColors[issue.status] || '#666'}; font-size: 18px; text-transform: capitalize;">${issue.status}</div>
        </div>
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
          <div style="color: #666; font-size: 12px; margin-bottom: 4px;">Level</div>
          <div style="font-weight: 600; color: ${levelColors[issue.level] || '#666'}; font-size: 18px; text-transform: uppercase;">${issue.level}</div>
        </div>
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
          <div style="color: #666; font-size: 12px; margin-bottom: 4px;">Events</div>
          <div style="font-weight: 600; font-size: 18px;">${issue.count.toLocaleString()}</div>
        </div>
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
          <div style="color: #666; font-size: 12px; margin-bottom: 4px;">Users Affected</div>
          <div style="font-weight: 600; font-size: 18px;">${issue.userCount.toLocaleString()}</div>
        </div>
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
          <div style="color: #666; font-size: 12px; margin-bottom: 4px;">First Seen</div>
          <div style="font-weight: 600; font-size: 14px;">${formatRelativeTime(issue.firstSeen)}</div>
        </div>
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
          <div style="color: #666; font-size: 12px; margin-bottom: 4px;">Last Seen</div>
          <div style="font-weight: 600; font-size: 14px;">${formatRelativeTime(issue.lastSeen)}</div>
        </div>
      </div>
      
      <!-- Error Message -->
      <div style="background: #fff5f5; border-left: 4px solid #e74c3c; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
        <div style="font-weight: 600; color: #e74c3c; margin-bottom: 8px; font-size: 14px;">Error Message</div>
        <div style="font-family: 'Courier New', monospace; font-size: 14px; color: #333;">${escapeHtml(event.message || issue.title)}</div>
        ${issue.culprit ? `<div style="margin-top: 8px; font-size: 12px; color: #666;">📍 ${escapeHtml(issue.culprit)}</div>` : ''}
      </div>
      
      <!-- Tabs for detailed info -->
      <div style="margin-bottom: 24px;">
        <div style="border-bottom: 2px solid #e0e0e0; margin-bottom: 16px;">
          <button onclick="switchSentryTab('stack')" id="sentryTabStack" class="sentry-detail-tab" style="background: none; border: none; padding: 12px 16px; cursor: pointer; font-weight: 600; border-bottom: 3px solid #7b8b52; color: #7b8b52;">Stack Trace</button>
          <button onclick="switchSentryTab('breadcrumbs')" id="sentryTabBreadcrumbs" class="sentry-detail-tab" style="background: none; border: none; padding: 12px 16px; cursor: pointer; font-weight: 600; border-bottom: 3px solid transparent; color: #666;">Breadcrumbs</button>
          <button onclick="switchSentryTab('tags')" id="sentryTabTags" class="sentry-detail-tab" style="background: none; border: none; padding: 12px 16px; cursor: pointer; font-weight: 600; border-bottom: 3px solid transparent; color: #666;">Tags</button>
          <button onclick="switchSentryTab('context')" id="sentryTabContext" class="sentry-detail-tab" style="background: none; border: none; padding: 12px 16px; cursor: pointer; font-weight: 600; border-bottom: 3px solid transparent; color: #666;">Context</button>
        </div>
        
        <div id="sentryTabContent">
          <div id="sentryContentStack" class="sentry-detail-content" style="display: block;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #2c2c2c;">Stack Trace</h3>
            ${stackTraceHTML}
          </div>
          
          <div id="sentryContentBreadcrumbs" class="sentry-detail-content" style="display: none;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #2c2c2c;">Breadcrumbs (Last 10)</h3>
            <div style="background: white; border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px;">
              ${breadcrumbsHTML}
            </div>
          </div>
          
          <div id="sentryContentTags" class="sentry-detail-content" style="display: none;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #2c2c2c;">Tags</h3>
            <div style="background: white; border: 1px solid #e0e0e0; border-radius: 4px; padding: 16px;">
              ${tagsHTML}
            </div>
          </div>
          
          <div id="sentryContentContext" class="sentry-detail-content" style="display: none;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #2c2c2c;">Context Data</h3>
            <div style="background: white; border: 1px solid #e0e0e0; border-radius: 4px; padding: 16px;">
              ${contextHTML}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function switchSentryTab(tabName) {
  const tabs = ['stack', 'breadcrumbs', 'tags', 'context'];
  
  tabs.forEach(tab => {
    const tabBtn = document.getElementById(`sentryTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    const content = document.getElementById(`sentryContent${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    
    if (tab === tabName) {
      if (tabBtn) {
        tabBtn.style.borderBottom = '3px solid #7b8b52';
        tabBtn.style.color = '#7b8b52';
      }
      if (content) content.style.display = 'block';
    } else {
      if (tabBtn) {
        tabBtn.style.borderBottom = '3px solid transparent';
        tabBtn.style.color = '#666';
      }
      if (content) content.style.display = 'none';
    }
  });
}

function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
