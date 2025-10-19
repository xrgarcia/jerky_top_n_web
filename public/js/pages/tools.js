/**
 * Tools Page - Employee Admin Tools
 */

let liveUsersSubscribed = false;
let currentToolTab = 'achievements';
let allProducts = [];
let filteredProducts = [];

async function loadAchievementsTable() {
  try {
    const response = await fetch('/api/tools/achievements');
    
    if (!response.ok) {
      if (response.status === 403) {
        alert('Access denied. This section is for employees only.');
        window.showPage('home');
        return;
      }
      throw new Error('Failed to load achievements');
    }

    const data = await response.json();
    const achievements = data.achievements || [];
    
    const tableBody = document.getElementById('achievementsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = achievements.map(achievement => {
      const requirement = formatRequirement(achievement.requirement);
      
      return `
        <tr>
          <td class="achievement-icon-cell">${achievement.icon}</td>
          <td><strong>${achievement.name}</strong></td>
          <td>${achievement.description}</td>
          <td><span class="tier-badge tier-${achievement.tier}">${achievement.tier}</span></td>
          <td><span class="category-badge">${achievement.category}</span></td>
          <td>${requirement}</td>
          <td><strong>${achievement.points}</strong></td>
          <td><span class="earning-count">${achievement.earningCount || 0}</span></td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading achievements table:', error);
    const tableBody = document.getElementById('achievementsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: #e74c3c; padding: 20px;">
            Failed to load achievements. ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

async function loadLiveUsers() {
  try {
    const response = await fetch('/api/tools/live-users');
    
    if (!response.ok) {
      if (response.status === 403) {
        alert('Access denied. This section is for employees only.');
        window.showPage('home');
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
        alert('Access denied. This section is for employees only.');
        window.showPage('home');
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
        <td colspan="9" style="text-align: center; padding: 40px; color: #999;">
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
      </tr>
    `;
  }).join('');
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
function showConfirmationModal(title, message, onConfirm) {
  const modal = document.getElementById('confirmationModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const cancelBtn = document.getElementById('modalCancelBtn');
  
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modal.style.display = 'flex';
  
  const handleConfirm = async () => {
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
  };
  
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}

async function clearAllAchievements() {
  try {
    const response = await fetch('/api/tools/achievements/all', {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to clear achievements');
    }
    
    const data = await response.json();
    alert(`✅ Successfully cleared ${data.achievements} achievement(s) and ${data.streaks} streak(s) for all users`);
    
    await loadAchievementsTable();
  } catch (error) {
    console.error('Error clearing achievements:', error);
    alert(`❌ Failed to clear achievements: ${error.message}`);
  }
}

// Initialize tools page when it's shown
window.initToolsPage = async function() {
  console.log('🛠️ Initializing Tools page...');
  
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'employee_admin') {
    alert('Access denied. This section is for employees only.');
    window.showPage('home');
    return;
  }
  
  setupToolNavigation();
  setupProductFilters();
  await loadAchievementsTable();
  
  const clearAllBtn = document.getElementById('clearAllAchievementsBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      showConfirmationModal(
        'Clear All Achievements & Streaks',
        '⚠️ This will permanently delete ALL achievement and streak data for ALL users. This action cannot be undone. Are you absolutely sure?',
        clearAllAchievements
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
};
