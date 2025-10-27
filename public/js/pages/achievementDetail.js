/**
 * Achievement Detail Page - Shows progress for all achievement types
 * Supports both collection-based (products) and engagement-based (activity) achievements
 */

let currentAchievementId = null;
let achievementData = null;
let achievementType = null;
let achievementProducts = [];
let achievementStats = null;
let achievementProgress = null;

/**
 * Initialize Achievement Detail page
 */
window.initAchievementDetailPage = async function(achievementId) {
  console.log(`🏆 Initializing Achievement Detail page for achievement ${achievementId}...`);
  
  currentAchievementId = achievementId;
  
  // Load achievement data
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
    
    // Route guard: Only update DOM if we're still on this achievement page
    // This prevents the achievement page from showing after navigating away
    const currentHash = window.location.hash;
    if (!currentHash.startsWith(`#achievement/${achievementId}`)) {
      console.log('🚫 Navigation changed, aborting achievement detail render');
      return;
    }
    
    achievementData = data.achievement;
    achievementType = data.type; // 'collection' or 'engagement'
    achievementStats = data.stats;
    
    if (achievementType === 'engagement') {
      // Engagement achievement - no products
      achievementProgress = data.progress;
      achievementProducts = [];
    } else {
      // Collection achievement - has products
      achievementProducts = data.products || [];
      achievementProgress = null;
    }
    
    updatePageHeader();
    updateStats();
    renderContent();
    
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
  if (achievementType === 'engagement') {
    // Engagement achievements: Show current progress
    const currentValue = achievementProgress?.currentValue || 0;
    const requiredValue = achievementProgress?.requiredValue || 1;
    const percentage = achievementProgress?.percentage || 0;
    
    document.getElementById('achievementRankedCount').textContent = currentValue;
    document.getElementById('achievementUnrankedCount').textContent = requiredValue - currentValue;
    document.getElementById('achievementProgressPercentage').textContent = `${percentage}%`;
    
    // Update stat labels for engagement
    document.querySelector('#achievementRankedCount').parentElement.querySelector('.achievement-stat-label').textContent = 'Current';
    document.querySelector('#achievementUnrankedCount').parentElement.querySelector('.achievement-stat-label').textContent = 'Remaining';
  } else {
    // Collection achievements: Show ranked/unranked products
    document.getElementById('achievementRankedCount').textContent = achievementStats.ranked;
    document.getElementById('achievementUnrankedCount').textContent = achievementStats.unranked;
    document.getElementById('achievementProgressPercentage').textContent = `${achievementStats.percentage}%`;
    
    // Ensure stat labels are correct for collections
    document.querySelector('#achievementRankedCount').parentElement.querySelector('.achievement-stat-label').textContent = 'Ranked';
    document.querySelector('#achievementUnrankedCount').parentElement.querySelector('.achievement-stat-label').textContent = 'Not Ranked';
  }
}

/**
 * Render appropriate content based on achievement type
 */
function renderContent() {
  const productsContainer = document.getElementById('achievementProductsContainer');
  const engagementContainer = document.getElementById('achievementEngagementContainer');
  
  if (achievementType === 'engagement') {
    // Hide products, show engagement progress
    if (productsContainer) productsContainer.style.display = 'none';
    if (engagementContainer) {
      engagementContainer.style.display = 'block';
      renderEngagementProgress();
    }
  } else {
    // Hide engagement, show products
    if (engagementContainer) engagementContainer.style.display = 'none';
    if (productsContainer) {
      productsContainer.style.display = 'block';
      renderProducts();
    }
  }
}

/**
 * Render engagement progress details
 */
function renderEngagementProgress() {
  const container = document.getElementById('achievementEngagementDetails');
  if (!container) return;
  
  const { currentValue, requiredValue, percentage, currentTier, pointsEarned, requirementLabel } = achievementProgress;
  const hasTiers = achievementData.hasTiers;
  
  // Generate tier badges if applicable
  let tierBadges = '';
  if (hasTiers && currentTier) {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const currentTierIndex = tierOrder.indexOf(currentTier.toLowerCase());
    
    tierBadges = tierOrder.map((tier, index) => {
      const isEarned = index <= currentTierIndex;
      const isCurrent = tier === currentTier.toLowerCase();
      const emoji = {
        'bronze': '🥉',
        'silver': '🥈',
        'gold': '🥇',
        'platinum': '💎',
        'diamond': '💠'
      }[tier];
      
      return `
        <div class="tier-badge ${isEarned ? 'earned' : 'locked'} ${isCurrent ? 'current' : ''}">
          <div class="tier-icon">${emoji}</div>
          <div class="tier-name">${tier.charAt(0).toUpperCase() + tier.slice(1)}</div>
        </div>
      `;
    }).join('');
  }
  
  container.innerHTML = `
    <div class="engagement-progress-card">
      <div class="engagement-progress-header">
        <h3>${requirementLabel} Progress</h3>
        ${hasTiers && currentTier ? `<span class="current-tier-badge">${currentTier.toUpperCase()}</span>` : ''}
      </div>
      
      <div class="engagement-progress-bar-container">
        <div class="engagement-progress-bar">
          <div class="engagement-progress-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="engagement-progress-text">${currentValue} / ${requiredValue} (${percentage}%)</div>
      </div>
      
      ${hasTiers ? `
        <div class="tier-progression">
          <h4>Tier Progression</h4>
          <div class="tier-badges">
            ${tierBadges}
          </div>
        </div>
      ` : ''}
      
      <div class="engagement-stats-grid">
        <div class="engagement-stat">
          <div class="engagement-stat-icon">🎯</div>
          <div class="engagement-stat-content">
            <div class="engagement-stat-label">Goal</div>
            <div class="engagement-stat-value">${requiredValue} ${requirementLabel}</div>
          </div>
        </div>
        <div class="engagement-stat">
          <div class="engagement-stat-icon">⭐</div>
          <div class="engagement-stat-content">
            <div class="engagement-stat-label">Points Earned</div>
            <div class="engagement-stat-value">${pointsEarned} / ${achievementData.points}</div>
          </div>
        </div>
      </div>
      
      ${percentage < 100 ? `
        <div class="engagement-cta">
          <p>Keep going! You're ${Math.round(100 - percentage)}% away from ${hasTiers ? 'the next tier' : 'completing this achievement'}.</p>
        </div>
      ` : `
        <div class="engagement-complete">
          <div class="complete-icon">✅</div>
          <p>Achievement Complete!</p>
        </div>
      `}
    </div>
  `;
}

/**
 * Render products grid (for collection achievements)
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
    // Show full collection: ranked products in color, unranked in greyscale
    const isRanked = product.isRanked;
    const cardClass = isRanked ? 'ranked' : 'unranked';
    
    return `
      <div class="achievement-product-card ${cardClass}" onclick="navigateToProduct('${product.id}')">
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
