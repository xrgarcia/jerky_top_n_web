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
    const matchesSearch = searchTerm === '' || 
      Object.values(product).some(val => 
        val && val.toString().toLowerCase().includes(searchTerm)
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
      } else if (tool === 'data') {
        document.getElementById('dataTool').style.display = 'block';
        
        if (liveUsersSubscribed && window.socket) {
          window.socket.emit('unsubscribe:live-users');
          liveUsersSubscribed = false;
        }
      } else if (tool === 'live-users') {
        document.getElementById('liveUsersTool').style.display = 'block';
        await loadLiveUsers();
        
        if (window.socket && !liveUsersSubscribed) {
          window.socket.emit('subscribe:live-users');
          liveUsersSubscribed = true;
        }
      } else if (tool === 'products') {
        document.getElementById('productsTool').style.display = 'block';
        await loadProductsTable();
        
        if (liveUsersSubscribed && window.socket) {
          window.socket.emit('unsubscribe:live-users');
          liveUsersSubscribed = false;
        }
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
