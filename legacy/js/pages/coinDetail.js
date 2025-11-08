/**
 * Coin Detail Page - Shows progress for all coin types
 * Supports both collection-based (products) and engagement-based (activity) coins
 */

let currentCoinCode = null;
let coinData = null;
let coinType = null;
let coinProducts = [];
let coinStats = null;
let coinProgress = null;
let coinMetadata = null;

/**
 * Reset grid container classes for the appropriate layout type
 * @param {string} layoutType - 'default', 'static', 'dynamic', etc.
 */
function resetGridContainerClasses(layoutType = 'default') {
  const grid = document.getElementById('coinProductsGrid');
  if (!grid) return;
  
  // Remove all layout-specific classes
  grid.classList.remove('coin-products-grid', 'static-collection-layout', 
    'dynamic-collection-layout', 'legacy-achievement-layout');
  
  // Apply the appropriate class for this layout
  if (layoutType === 'static') {
    grid.classList.add('static-collection-layout');
  } else if (layoutType === 'default') {
    grid.classList.add('coin-products-grid');
  }
  // Other layout types handle their own container classes via innerHTML
}

/**
 * Initialize Coin Detail page
 */
window.initCoinDetailPage = async function(achievementCode) {
  console.log(`🏆 Initializing Coin Detail page for coin ${achievementCode}...`);
  
  currentCoinCode = achievementCode;
  
  // Load coin data
  await loadCoinDetail(achievementCode);
};

/**
 * Load coin detail data
 */
async function loadCoinDetail(achievementCode) {
  try {
    const response = await fetch(`/api/gamification/achievement/${achievementCode}/products`);
    
    if (!response.ok) {
      throw new Error('Failed to load coin details');
    }
    
    const data = await response.json();
    
    // Route guard: Only update DOM if we're still on this coin page
    // This prevents the coin page from showing after navigating away
    // Support both new (#coins/code) and legacy (#achievement/id) URL formats
    const currentHash = window.location.hash;
    const isCoinsRoute = currentHash.startsWith(`#coins/${achievementCode}`);
    const isLegacyRoute = currentHash.startsWith(`#achievement/${achievementCode}`);
    if (!isCoinsRoute && !isLegacyRoute) {
      console.log('🚫 Navigation changed, aborting coin detail render');
      return;
    }
    
    coinData = data.achievement;
    coinType = data.type; // 'collection', 'engagement', 'user_club', or 'user_coin'
    coinStats = data.stats;
    coinMetadata = data.metadata || {};
    
    if (coinType === 'engagement') {
      // Engagement achievement - no products
      coinProgress = data.progress;
      coinProducts = [];
      coinMembers = [];
    } else if (coinType === 'user_club' || coinType === 'user_coin') {
      // User Club/Coin - has members (single or multiple)
      coinMembers = data.members || [];
      coinProducts = [];
      coinProgress = null;
    } else {
      // Collection achievement - has products
      coinProducts = data.products || [];
      coinProgress = null;
      coinMembers = [];
    }
    
    updatePageHeader();
    updateStats();
    renderContent();
    
  } catch (error) {
    console.error('Error loading coin details:', error);
    showError();
  }
}

/**
 * Update page header with achievement info
 * Note: Header now only contains breadcrumbs (minimal design)
 */
function updatePageHeader() {
  document.getElementById('coinDetailBreadcrumb').textContent = coinData.name;
}

/**
 * Update stats cards
 */
function updateStats() {
  if (coinType === 'engagement') {
    // Engagement achievements: Show current progress
    const currentValue = coinProgress?.currentValue || 0;
    const requiredValue = coinProgress?.requiredValue || 1;
    const percentage = coinProgress?.percentage || 0;
    
    document.getElementById('coinRankedCount').textContent = currentValue;
    document.getElementById('coinUnrankedCount').textContent = requiredValue - currentValue;
    document.getElementById('coinProgressPercentage').textContent = `${percentage}%`;
    
    // Update stat labels for engagement
    document.querySelector('#coinRankedCount').parentElement.querySelector('.coin-stat-label').textContent = 'Current';
    document.querySelector('#coinUnrankedCount').parentElement.querySelector('.coin-stat-label').textContent = 'Remaining';
  } else {
    // Collection achievements: Show ranked/unranked products
    document.getElementById('coinRankedCount').textContent = coinStats.ranked;
    document.getElementById('coinUnrankedCount').textContent = coinStats.unranked;
    document.getElementById('coinProgressPercentage').textContent = `${coinStats.percentage}%`;
    
    // Ensure stat labels are correct for collections
    document.querySelector('#coinRankedCount').parentElement.querySelector('.coin-stat-label').textContent = 'Ranked';
    document.querySelector('#coinUnrankedCount').parentElement.querySelector('.coin-stat-label').textContent = 'Not Ranked';
  }
}

/**
 * Render appropriate content based on achievement type and collectionType
 */
function renderContent() {
  const productsContainer = document.getElementById('coinProductsContainer');
  const engagementContainer = document.getElementById('coinEngagementContainer');
  const statsContainer = document.querySelector('.coin-detail-stats');
  
  if (coinType === 'engagement') {
    // Engagement collection: Show engagement progress
    // Show stats cards for engagement achievements
    if (statsContainer) statsContainer.style.display = 'grid';
    if (productsContainer) productsContainer.style.display = 'none';
    if (engagementContainer) {
      engagementContainer.style.display = 'block';
      renderEngagementProgress();
    }
  } else if (coinType === 'user_club' || coinType === 'user_coin') {
    // User Club/Coin: Show club members or single user
    if (statsContainer) statsContainer.style.display = 'none';
    if (engagementContainer) engagementContainer.style.display = 'none';
    if (productsContainer) {
      productsContainer.style.display = 'block';
      renderUserClub();
    }
  } else {
    // Collection-based achievement: Route to specific renderer
    if (engagementContainer) engagementContainer.style.display = 'none';
    if (productsContainer) {
      productsContainer.style.display = 'block';
      
      // Route to specific collection type renderer
      const collectionType = coinData.collectionType;
      
      // Show stats cards by default for most collection types
      if (statsContainer) {
        if (collectionType === 'static_collection' || collectionType === 'custom_product_list') {
          // Static collections use integrated hero, hide stats cards
          statsContainer.style.display = 'none';
        } else {
          // Other collections show stats cards
          statsContainer.style.display = 'grid';
        }
      }
      
      if (collectionType === 'dynamic_collection') {
        renderDynamicCollection();
      } else if (collectionType === 'flavor_coin') {
        renderFlavorCoin();
      } else if (collectionType === 'hidden_collection') {
        renderHiddenCollection();
      } else if (collectionType === 'legacy') {
        renderLegacyAchievement();
      } else if (collectionType === 'static_collection' || collectionType === 'custom_product_list') {
        renderStaticCollection();
      } else {
        // Fallback to generic product grid
        renderProducts();
      }
    }
  }
}

/**
 * Render engagement progress details
 */
function renderEngagementProgress() {
  const container = document.getElementById('coinEngagementDetails');
  if (!container) return;
  
  const { currentValue, requiredValue, percentage, currentTier, pointsEarned, requirementLabel } = coinProgress;
  const hasTiers = coinData.hasTiers;
  
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
            <div class="engagement-stat-value">${pointsEarned} / ${coinData.points}</div>
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
  resetGridContainerClasses('default');
  const grid = document.getElementById('coinProductsGrid');
  
  if (coinProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-title">No Products Found</div>
        <div class="empty-state-message">This achievement doesn't have any associated products yet.</div>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = coinProducts.map(product => {
    // Show full collection: ranked products in color, unranked in greyscale
    const isRanked = product.isRanked;
    const cardClass = isRanked ? 'ranked' : 'unranked';
    
    return `
      <div class="coin-product-card ${cardClass}" onclick="navigateToProduct('${product.id}')">
        <div class="coin-product-image">
          <img src="${product.image}" alt="${product.title}" loading="lazy">
          ${isRanked ? '<div class="ranked-badge">✓ Ranked</div>' : '<div class="unranked-badge">Not Ranked</div>'}
        </div>
        <div class="coin-product-info">
          <div class="coin-product-title">${product.title}</div>
          <div class="coin-product-price">$${product.price}</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render Dynamic Collection (Animal Categories with Tier Progression)
 */
function renderDynamicCollection() {
  resetGridContainerClasses('default');
  const grid = document.getElementById('coinProductsGrid');
  const animalCategories = coinMetadata.animalCategories || [];
  const currentTier = coinStats.currentTier || null;
  const hasTiers = coinData.hasTiers;
  
  // Build tier progression
  let tierSection = '';
  if (hasTiers) {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const tierEmojis = {
      'bronze': '🥉',
      'silver': '🥈',
      'gold': '🥇',
      'platinum': '👑',
      'diamond': '💠'
    };
    
    const tierThresholds = coinData.tierThresholds || {
      bronze: 40, silver: 60, gold: 75, platinum: 90, diamond: 100
    };
    
    const currentTierIndex = currentTier ? tierOrder.indexOf(currentTier.toLowerCase()) : -1;
    
    tierSection = `
      <div class="dynamic-tier-progression">
        <h3 class="tier-progression-title">Tier Progression</h3>
        <div class="tier-badges-horizontal">
          ${tierOrder.map((tier, index) => {
            const isEarned = index <= currentTierIndex;
            const isCurrent = tier === currentTier?.toLowerCase();
            const threshold = tierThresholds[tier];
            return `
              <div class="tier-badge-item ${isEarned ? 'earned' : 'locked'} ${isCurrent ? 'current' : ''}">
                <div class="tier-badge-icon">${tierEmojis[tier]}</div>
                <div class="tier-badge-name">${tier.charAt(0).toUpperCase() + tier.slice(1)}</div>
                <div class="tier-badge-threshold">${threshold}%</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  grid.innerHTML = `
    <div class="dynamic-collection-layout">
      <div class="dynamic-hero">
        <div class="dynamic-hero-icon">${coinData.icon}</div>
        <div class="dynamic-hero-content">
          <h2 class="dynamic-hero-title">${animalCategories.join(' & ')} Collection</h2>
          <p class="dynamic-hero-description">Rank all ${animalCategories.join(' and ')} products to complete this collection!</p>
          <div class="dynamic-hero-stats">
            <div class="hero-stat">
              <span class="hero-stat-value">${coinStats.percentage}%</span>
              <span class="hero-stat-label">Complete</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">${coinStats.ranked}/${coinStats.total}</span>
              <span class="hero-stat-label">Ranked</span>
            </div>
            ${currentTier ? `
              <div class="hero-stat">
                <span class="hero-stat-value">${currentTier.toUpperCase()}</span>
                <span class="hero-stat-label">Current Tier</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      ${tierSection}
      
      <div class="dynamic-products-section">
        <h3 class="products-section-title">Collection Products</h3>
        <div class="coin-products-grid">
          ${coinProducts.map(product => `
            <div class="coin-product-card ${product.isRanked ? 'ranked' : 'unranked'}" onclick="navigateToProduct('${product.id}')">
              <div class="coin-product-image">
                <img src="${product.image}" alt="${product.title}" loading="lazy">
                ${product.isRanked ? '<div class="ranked-badge">✓ Ranked</div>' : '<div class="unranked-badge">Not Ranked</div>'}
              </div>
              <div class="coin-product-info">
                <div class="coin-product-title">${product.title}</div>
                <div class="coin-product-price">$${product.price}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Flavor Coin (Single Product Spotlight)
 */
function renderFlavorCoin() {
  resetGridContainerClasses('default');
  const grid = document.getElementById('coinProductsGrid');
  
  if (coinProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🍖</div>
        <div class="empty-state-title">No Product Found</div>
        <div class="empty-state-message">This flavor coin doesn't have a product assigned yet.</div>
      </div>
    `;
    return;
  }
  
  const product = coinProducts[0];
  const isRanked = product.isRanked;
  const productDetails = coinMetadata.productDetails || {};
  
  grid.innerHTML = `
    <div class="flavor-coin-spotlight">
      <div class="spotlight-hero">
        <div class="spotlight-badge">
          <div class="spotlight-badge-icon">${coinData.icon}</div>
          <div class="spotlight-badge-name">${coinData.name}</div>
        </div>
      </div>
      
      <div class="spotlight-product">
        <div class="spotlight-product-image">
          <img src="${product.image}" alt="${product.title}" class="${isRanked ? '' : 'grayscale'}">
          ${isRanked ? '<div class="spotlight-complete-badge">✓ Unlocked!</div>' : '<div class="spotlight-locked-badge">🔒 Locked</div>'}
        </div>
        
        <div class="spotlight-product-details">
          <h2 class="spotlight-product-title">${product.title}</h2>
          <div class="spotlight-product-price">$${product.price}</div>
          
          ${productDetails.vendor ? `<div class="spotlight-meta"><strong>Brand:</strong> ${productDetails.vendor}</div>` : ''}
          ${productDetails.tags ? `<div class="spotlight-meta"><strong>Tags:</strong> ${productDetails.tags}</div>` : ''}
          
          <div class="spotlight-status">
            ${isRanked ? `
              <div class="spotlight-success">
                <div class="spotlight-success-icon">🎉</div>
                <div class="spotlight-success-text">
                  <strong>Achievement Unlocked!</strong>
                  <p>You've ranked this product and earned the ${coinData.name} flavor coin!</p>
                </div>
              </div>
            ` : `
              <div class="spotlight-cta">
                <div class="spotlight-cta-icon">🎯</div>
                <div class="spotlight-cta-text">
                  <strong>Rank This Product to Unlock!</strong>
                  <p>Add this product to your ranking to earn the ${coinData.name} flavor coin.</p>
                </div>
                <button class="spotlight-cta-button" onclick="navigateToProduct('${product.id}')">
                  View Product →
                </button>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Hidden Collection (Mystery/Locked State)
 */
function renderHiddenCollection() {
  resetGridContainerClasses('default');
  const grid = document.getElementById('coinProductsGrid');
  const isUnlocked = coinMetadata.isUnlocked;
  
  if (!isUnlocked) {
    // This shouldn't happen (backend filters hidden achievements)
    // but show mystery state just in case
    grid.innerHTML = `
      <div class="hidden-mystery-state">
        <div class="mystery-box">
          <div class="mystery-icon">🎁</div>
          <div class="mystery-shimmer"></div>
        </div>
        <h3 class="mystery-title">Hidden Achievement</h3>
        <p class="mystery-hint">This achievement is locked. Keep exploring to unlock it!</p>
      </div>
    `;
    return;
  }
  
  // Unlocked: Show with dramatic reveal styling
  grid.innerHTML = `
    <div class="hidden-collection-layout">
      <div class="hidden-reveal-banner">
        <div class="reveal-icon">✨</div>
        <div class="reveal-content">
          <h2 class="reveal-title">Secret Achievement Unlocked!</h2>
          <p class="reveal-subtitle">You discovered the hidden ${coinData.name} collection</p>
        </div>
        <div class="reveal-icon">✨</div>
      </div>
      
      <div class="hidden-products-section">
        <div class="coin-products-grid">
          ${coinProducts.map(product => `
            <div class="coin-product-card ${product.isRanked ? 'ranked' : 'unranked'}" onclick="navigateToProduct('${product.id}')">
              <div class="coin-product-image">
                <img src="${product.image}" alt="${product.title}" loading="lazy">
                ${product.isRanked ? '<div class="ranked-badge">✓ Ranked</div>' : '<div class="unranked-badge">Not Ranked</div>'}
              </div>
              <div class="coin-product-info">
                <div class="coin-product-title">${product.title}</div>
                <div class="coin-product-price">$${product.price}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Legacy Achievement (Simple Checklist Style)
 */
function renderLegacyAchievement() {
  resetGridContainerClasses('default');
  const grid = document.getElementById('coinProductsGrid');
  
  grid.innerHTML = `
    <div class="legacy-achievement-layout">
      <div class="legacy-header">
        <div class="legacy-badge">
          <div class="legacy-badge-icon">${coinData.icon}</div>
          <div class="legacy-badge-tier">${coinData.tier || 'Bronze'}</div>
        </div>
        <div class="legacy-info">
          <h3 class="legacy-title">${coinData.name}</h3>
          <p class="legacy-description">${coinData.description}</p>
          <div class="legacy-progress-bar">
            <div class="legacy-progress-fill" style="width: ${coinStats.percentage}%"></div>
            <div class="legacy-progress-text">${coinStats.percentage}% Complete</div>
          </div>
        </div>
      </div>
      
      ${coinProducts.length > 0 ? `
        <div class="legacy-checklist">
          ${coinProducts.map(product => `
            <div class="legacy-checklist-item ${product.isRanked ? 'checked' : ''}">
              <div class="legacy-checkbox">${product.isRanked ? '✓' : '☐'}</div>
              <div class="legacy-product-info" onclick="navigateToProduct('${product.id}')">
                <img src="${product.image}" alt="${product.title}" class="legacy-product-thumb">
                <div class="legacy-product-details">
                  <div class="legacy-product-title">${product.title}</div>
                  <div class="legacy-product-price">$${product.price}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render User Club (Exclusive Members)
 */
function renderUserClub() {
  resetGridContainerClasses('default');
  const grid = document.getElementById('coinProductsGrid');
  
  const isMember = coinStats.isMember || false;
  const memberCount = coinMembers.length;
  const isUserCoin = coinType === 'user_coin';
  
  grid.innerHTML = `
    <div class="user-club-layout">
      <div class="user-club-hero">
        <div class="user-club-badge">
          <div class="user-club-icon">${coinData.icon}</div>
          ${isMember ? '<div class="member-badge">✓ Awarded</div>' : '<div class="non-member-badge">Exclusive</div>'}
        </div>
        <div class="user-club-info">
          <h3 class="user-club-title">${coinData.name}</h3>
          <p class="user-club-description">${coinData.description}</p>
          <div class="user-club-stats">
            <div class="user-club-stat">
              <span class="stat-icon">${isUserCoin ? '🎖️' : '👥'}</span>
              <span class="stat-value">${isUserCoin ? 'Personalized Award' : `${memberCount} ${memberCount === 1 ? 'Member' : 'Members'}`}</span>
            </div>
            ${isMember ? `
              <div class="user-club-stat">
                <span class="stat-icon">⭐</span>
                <span class="stat-value">${coinData.points} Flavor Coins Earned</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="user-club-members">
        <h4 class="members-title">${isUserCoin ? (isMember ? 'Award Recipient' : 'Exclusive Award') : (isMember ? 'Club Members' : 'Exclusive Members')}</h4>
        <div class="members-grid">
          ${coinMembers.map(member => {
            const displayName = member.displayName || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Member';
            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            
            return `
              <div class="member-card">
                <div class="member-avatar">${initials}</div>
                <div class="member-info">
                  <div class="member-name">${displayName}</div>
                  ${isMember ? `<div class="member-email">${member.email}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      ${!isMember ? `
        <div class="user-club-cta">
          <p>${isUserCoin ? 'This is a personalized award given to one individual for exceptional achievements.' : 'This is an exclusive club. Membership is awarded by the team for special achievements and milestones.'}</p>
        </div>
      ` : `
        <div class="user-club-success">
          <div class="success-icon">🎉</div>
          <p>${isUserCoin ? 'Congratulations! You received this personalized award!' : "Congratulations! You're a member of this exclusive club."}</p>
        </div>
      `}
    </div>
  `;
}

/**
 * Generate smart commentary based on collection analysis and user state
 */
function generateSmartCommentary() {
  // Defensive check: ensure required data exists
  if (!coinStats || !coinMetadata) {
    return {
      icon: '⭐',
      title: 'Collection Progress',
      message: 'Loading collection details...',
      type: 'progress'
    };
  }
  
  const percentage = coinStats.percentage || 0;
  const ranked = coinStats.ranked || 0;
  const unranked = coinStats.unranked || 0;
  const total = coinStats.total || coinProducts.length;
  const analysis = coinMetadata.productAnalysis || {};
  const rankableCount = coinMetadata.rankableCount || 0;
  const unrankableCount = coinMetadata.unrankableCount || 0;
  
  // Detect dominant themes
  const flavors = analysis.flavorProfiles || [];
  const animals = analysis.animalTypes || {};
  const primaryAnimal = Object.keys(animals).sort((a, b) => animals[b] - animals[a])[0];
  
  // Build contextual description
  let themeDescription = '';
  if (flavors.length > 0) {
    const flavorText = flavors.join(' and ');
    themeDescription = `${flavorText} ${total > 1 ? 'flavors' : 'flavor'}`;
  } else if (primaryAnimal) {
    themeDescription = `${primaryAnimal} jerky collection`;
  } else {
    themeDescription = 'collection';
  }
  
  // STATE 1: 100% Complete
  if (percentage === 100) {
    return {
      icon: '🎉',
      title: 'Collection Complete!',
      message: `You've ranked all ${total} products in this ${themeDescription}. You earned ${coinData.points} flavor coins!`,
      type: 'success'
    };
  }
  
  // STATE 2: 0% with NO rankable products (haven't purchased anything)
  // Using "Explore" (breadth - trying new things) per glossary
  if (percentage === 0 && rankableCount === 0) {
    let encouragement = '';
    if (flavors.includes('hot')) {
      encouragement = 'Ready to turn up the heat? These spicy snacks pack serious flavor and fire.';
    } else if (flavors.includes('sweet')) {
      encouragement = 'Sweet tooth calling? These flavor-packed treats balance savory and sweet perfectly.';
    } else if (flavors.includes('exotic')) {
      encouragement = 'Adventure awaits! These unique proteins will take your taste buds on a wild ride.';
    } else if (primaryAnimal && primaryAnimal !== 'beef') {
      encouragement = `Curious about ${primaryAnimal}? These premium cuts are leaner and pack incredible flavor.`;
    } else {
      encouragement = `Try this curated collection of ${total} premium jerky products.`;
    }
    
    return {
      icon: '🌟',
      title: `Explore ${coinData.name}`,
      message: `You haven't tried any of these ${total} products yet. ${encouragement}`,
      cta: {
        text: '🛍️ Shop This Collection',
        url: 'https://jerky.com/collections/all',
        subtext: 'Purchase products from this collection, then come back to rank them and earn flavor coins!'
      },
      type: 'discovery'
    };
  }
  
  // STATE 3: 0% but HAS rankable products (purchased but not ranked)
  if (percentage === 0 && rankableCount > 0) {
    return {
      icon: '🚀',
      title: 'Ready to Start?',
      message: `You've purchased ${rankableCount} of these ${total} products. Time to rank them and start earning flavor coins!`,
      type: 'start'
    };
  }
  
  // STATE 4: 1-24% with some unrankable
  if (percentage < 25 && unrankableCount > 0) {
    return {
      icon: '💪',
      title: 'Great Start!',
      message: `You've ranked ${ranked} product${ranked === 1 ? '' : 's'}! You have ${unranked - unrankableCount} more rankable product${unranked - unrankableCount === 1 ? '' : 's'} ready to go.`,
      subMessage: `Want to complete this collection? Purchase ${unrankableCount} more product${unrankableCount === 1 ? '' : 's'} to unlock the full achievement.`,
      type: 'progress'
    };
  }
  
  // STATE 5: 25-49% progress
  if (percentage < 50) {
    return {
      icon: '⭐',
      title: 'Making Progress!',
      message: `You've ranked ${ranked} of ${total} products. ${unranked} more to go for ${coinData.points} flavor coins!`,
      type: 'progress'
    };
  }
  
  // STATE 6: 50-74% progress
  if (percentage < 75) {
    return {
      icon: '🎯',
      title: 'Halfway Hero!',
      message: `You're ${percentage}% complete! Keep going to earn ${coinData.points} flavor coins.`,
      type: 'progress'
    };
  }
  
  // STATE 7: 75-99% progress
  return {
    icon: '🔥',
    title: 'Almost There!',
    message: `Just ${unranked} more product${unranked === 1 ? '' : 's'} to complete this collection and earn ${coinData.points} flavor coins!`,
    type: 'progress'
  };
}

/**
 * Render Static Collection (Enhanced Product Grid with Theme)
 */
function renderStaticCollection() {
  resetGridContainerClasses('static');
  const grid = document.getElementById('coinProductsGrid');
  
  // Note: Stats cards are hidden by renderContent() for static collections
  // This allows the unified hero to display stats in a more integrated way
  
  const theme = coinMetadata.theme || coinData.category;
  const percentage = coinStats.percentage;
  const ranked = coinStats.ranked;
  const unranked = coinStats.unranked;
  const total = coinStats.total;
  const rankableCount = coinMetadata.rankableCount || 0;
  
  // Find first unranked AND rankable product for "next-up" spotlight
  const firstUnrankedIndex = coinProducts.findIndex(p => !p.isRanked && p.isRankable);
  
  // Generate smart commentary based on collection analysis and user state
  const commentary = generateSmartCommentary();
  
  // Build unified hero section that adapts to user state
  let heroSection = '';
  
  if (commentary.type === 'success') {
    // STATE: Completed - Celebration hero
    heroSection = `
      <div class="static-hero static-hero-success">
        <div class="hero-content">
          <div class="hero-icon">${commentary.icon}</div>
          <div class="hero-main">
            <h2 class="hero-title">${commentary.title}</h2>
            <p class="hero-message">${commentary.message}</p>
            <div class="hero-stats">
              <div class="hero-stat">
                <div class="hero-stat-value">${total}</div>
                <div class="hero-stat-label">Products Ranked</div>
              </div>
              <div class="hero-stat">
                <div class="hero-stat-value">${coinData.points}</div>
                <div class="hero-stat-label">Flavor Coins Earned</div>
              </div>
            </div>
          </div>
        </div>
        <div class="hero-badge">
          <svg class="hero-progress-ring" width="120" height="120">
            <circle class="progress-ring-circle-bg" stroke="#6ee7b7" stroke-width="8" fill="transparent" r="52" cx="60" cy="60"/>
            <circle class="progress-ring-circle" stroke="#10b981" stroke-width="8" fill="transparent" r="52" cx="60" cy="60"
              stroke-dasharray="${2 * Math.PI * 52}"
              stroke-dashoffset="0"/>
          </svg>
          <div class="hero-progress-text">
            <div class="hero-progress-percentage">100%</div>
          </div>
        </div>
      </div>
    `;
  } else if (commentary.type === 'discovery') {
    // STATE: Discovery - CTA-focused hero (Explore = breadth, trying new things)
    heroSection = `
      <div class="static-hero static-hero-discovery">
        <div class="hero-content">
          <div class="hero-icon">${commentary.icon}</div>
          <div class="hero-main">
            <h2 class="hero-title">${commentary.title}</h2>
            <p class="hero-message">${commentary.message}</p>
            ${commentary.cta ? `
              <a href="${commentary.cta.url}" target="_blank" rel="noopener noreferrer" class="hero-cta-button">
                ${commentary.cta.text}
              </a>
              <p class="hero-cta-subtext">${commentary.cta.subtext}</p>
            ` : ''}
          </div>
        </div>
        <div class="hero-badge">
          <div class="hero-collection-info">
            <div class="collection-count">${total}</div>
            <div class="collection-label">Products</div>
            <div class="collection-sublabel">to explore</div>
          </div>
        </div>
      </div>
    `;
  } else {
    // STATE: In Progress - Progress-focused hero
    heroSection = `
      <div class="static-hero static-hero-progress">
        <div class="hero-content">
          <div class="hero-icon">${commentary.icon}</div>
          <div class="hero-main">
            <h2 class="hero-title">${commentary.title}</h2>
            <p class="hero-message">${commentary.message}</p>
            ${commentary.subMessage ? `<p class="hero-submessage">${commentary.subMessage}</p>` : ''}
            <div class="hero-stats">
              <div class="hero-stat">
                <div class="hero-stat-value">${ranked}</div>
                <div class="hero-stat-label">Ranked</div>
              </div>
              <div class="hero-stat">
                <div class="hero-stat-value">${rankableCount}</div>
                <div class="hero-stat-label">Ready to Rank</div>
              </div>
              <div class="hero-stat">
                <div class="hero-stat-value">${total}</div>
                <div class="hero-stat-label">Total</div>
              </div>
            </div>
          </div>
        </div>
        <div class="hero-badge">
          <svg class="hero-progress-ring" width="120" height="120">
            <circle class="progress-ring-circle-bg" stroke="#e0e0e0" stroke-width="8" fill="transparent" r="52" cx="60" cy="60"/>
            <circle class="progress-ring-circle" stroke="#7b8b52" stroke-width="8" fill="transparent" r="52" cx="60" cy="60"
              stroke-dasharray="${2 * Math.PI * 52}"
              stroke-dashoffset="${2 * Math.PI * 52 * (1 - percentage / 100)}"/>
          </svg>
          <div class="hero-progress-text">
            <div class="hero-progress-percentage">${percentage}%</div>
          </div>
        </div>
      </div>
    `;
  }
  
  grid.innerHTML = `
    ${heroSection}
    
    <div class="static-products-grid">
      ${coinProducts.map((product, index) => {
        const isNextUp = index === firstUnrankedIndex;
        return `
          <div class="coin-product-card ${product.isRanked ? 'ranked' : 'unranked'} ${isNextUp ? 'next-up' : ''}" onclick="navigateToProduct('${product.id}')">
            <div class="coin-product-image">
              <img src="${product.image}" alt="${product.title}" loading="lazy">
              ${product.isRanked ? '<div class="ranked-badge">✓ Ranked</div>' : ''}
              ${isNextUp ? '<div class="next-up-badge">👉 Next Up</div>' : ''}
              ${!product.isRanked && !isNextUp ? '<div class="unranked-badge">Not Ranked</div>' : ''}
              ${!product.isRanked && product.isRankable ? `<button class="quick-rank-button" onclick="event.stopPropagation(); quickRankProduct('${product.id}')">⭐ Rank Now</button>` : ''}
            </div>
            <div class="coin-product-info">
              <div class="coin-product-title">${product.title}</div>
              <div class="coin-product-price">$${product.price}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Quick rank a product - navigates to rank page
 */
window.quickRankProduct = function(productId) {
  console.log(`⚡ Quick ranking product ${productId}`);
  window.location.hash = '#rank';
  
  // After navigation, we need to wait for the rank page to load and then trigger ranking
  setTimeout(() => {
    if (window.openRankModalById) {
      window.openRankModalById(productId);
    }
  }, 300);
};

/**
 * Show error state
 */
function showError() {
  const grid = document.getElementById('coinProductsGrid');
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Failed to Load</div>
      <div class="empty-state-message">Please try refreshing the page</div>
    </div>
  `;
}
