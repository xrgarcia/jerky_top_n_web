/**
 * Achievement Detail Page - Shows products for a specific achievement
 */

let currentAchievementId = null;
let achievementData = null;
let achievementProducts = [];

/**
 * Initialize Achievement Detail page
 */
window.initAchievementDetailPage = async function(achievementId) {
  console.log(`🏆 Initializing Achievement Detail page for achievement ${achievementId}...`);
  
  currentAchievementId = achievementId;
  
  // Load achievement data and products
  await loadAchievementDetail(achievementId);
};

/**
 * Load achievement detail data
 */
async function loadAchievementDetail(achievementId) {
  try {
    const response = await fetch(`/api/gamification/achievement/${achievementId}/products`);
    
    if (!response.ok) {
      throw new Error('Failed to load achievement details');
    }
    
    const data = await response.json();
    achievementData = data.achievement;
    achievementProducts = data.products;
    
    updatePageHeader();
    updateStats();
    renderProducts();
    
  } catch (error) {
    console.error('Error loading achievement details:', error);
    showError();
  }
}

/**
 * Update page header with achievement info
 */
function updatePageHeader() {
  document.getElementById('achievementDetailBreadcrumb').textContent = achievementData.name;
  document.getElementById('achievementDetailTitle').textContent = achievementData.name;
  document.getElementById('achievementDetailSubtitle').textContent = achievementData.description;
  
  // Update icon
  const iconEl = document.getElementById('achievementDetailIcon');
  if (achievementData.iconType === 'image') {
    iconEl.innerHTML = `<img src="${achievementData.icon}" alt="${achievementData.name}" style="width: 32px; height: 32px; object-fit: contain;">`;
  } else {
    iconEl.textContent = achievementData.icon;
  }
}

/**
 * Update stats cards
 */
function updateStats() {
  const rankedProducts = achievementProducts.filter(p => p.isRanked);
  const unrankedProducts = achievementProducts.filter(p => !p.isRanked);
  const totalProducts = achievementProducts.length;
  const percentage = totalProducts > 0 ? Math.round((rankedProducts.length / totalProducts) * 100) : 0;
  
  document.getElementById('achievementRankedCount').textContent = rankedProducts.length;
  document.getElementById('achievementUnrankedCount').textContent = unrankedProducts.length;
  document.getElementById('achievementProgressPercentage').textContent = `${percentage}%`;
}

/**
 * Render products grid
 */
function renderProducts() {
  const grid = document.getElementById('achievementProductsGrid');
  
  if (achievementProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-title">No Products Found</div>
        <div class="empty-state-message">This achievement doesn't have any associated products yet.</div>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = achievementProducts.map(product => {
    const isRanked = product.isRanked;
    const cardClass = isRanked ? 'ranked' : 'unranked';
    
    return `
      <div class="achievement-product-card ${cardClass}">
        <div class="achievement-product-image">
          <img src="${product.image}" alt="${product.title}" loading="lazy">
          ${isRanked ? '<div class="ranked-badge">✓ Ranked</div>' : '<div class="unranked-badge">Not Ranked</div>'}
        </div>
        <div class="achievement-product-info">
          <div class="achievement-product-title">${product.title}</div>
          <div class="achievement-product-price">$${product.price}</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Show error state
 */
function showError() {
  const grid = document.getElementById('achievementProductsGrid');
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Failed to Load</div>
      <div class="empty-state-message">Please try refreshing the page</div>
    </div>
  `;
}
