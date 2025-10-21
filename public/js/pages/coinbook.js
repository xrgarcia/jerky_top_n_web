/**
 * Coin Book Page - Flavor Coins and Collections Display
 */

let userFlavorCoins = [];
let allAchievementsData = [];
let userCollectionProgress = {};

/**
 * Helper function to render an icon (emoji or image)
 */
function renderIcon(iconValue, iconType, cssClass = '', size = '48px') {
  if (iconType === 'image') {
    return `<img src="${iconValue}" alt="Icon" class="${cssClass}" style="width: ${size}; height: ${size}; object-fit: contain;">`;
  }
  return `<span class="${cssClass}">${iconValue}</span>`;
}

/**
 * Initialize Coin Book page
 */
window.initCoinbookPage = async function() {
  console.log('🏆 Initializing Coin Book page...');
  
  // Setup tab navigation
  setupCoinbookTabs();
  
  // Load all data in parallel
  await Promise.all([
    loadFlavorCoins(),
    loadCollections()
  ]);
};

/**
 * Setup tab navigation
 */
function setupCoinbookTabs() {
  const tabs = document.querySelectorAll('.coinbook-tab');
  
  // Map tab data-tab values to content element IDs
  const tabContentMap = {
    'flavor-coins': 'flavorCoinsContent',
    'static-collections': 'staticCollectionsContent',
    'dynamic-collections': 'dynamicCollectionsContent',
    'hidden-achievements': 'hiddenAchievementsContent'
  };
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabId = this.dataset.tab;
      
      // Update tab buttons
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Update tab content
      document.querySelectorAll('.coinbook-tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
      });
      
      const contentId = tabContentMap[tabId];
      const activeContent = document.getElementById(contentId);
      if (activeContent) {
        activeContent.style.display = 'block';
        activeContent.classList.add('active');
      } else {
        console.error(`Content element not found for tab: ${tabId} (looking for #${contentId})`);
      }
    });
  });
}

/**
 * Load user's flavor coins
 */
async function loadFlavorCoins() {
  try {
    const response = await fetch('/api/gamification/flavor-coins');
    
    if (!response.ok) {
      throw new Error('Failed to load flavor coins');
    }
    
    const data = await response.json();
    userFlavorCoins = data.flavorCoins || [];
    
    renderFlavorCoins();
    updateTabBadge('flavorCoinsBadge', userFlavorCoins.length);
    
  } catch (error) {
    console.error('Error loading flavor coins:', error);
    document.getElementById('flavorCoinsGrid').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🪙</div>
        <div class="empty-state-title">No Flavor Coins Yet</div>
        <div class="empty-state-message">Start ranking products with different flavors to earn your first coins!</div>
      </div>
    `;
  }
}

/**
 * Render flavor coins grid
 */
function renderFlavorCoins() {
  const grid = document.getElementById('flavorCoinsGrid');
  
  if (userFlavorCoins.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🪙</div>
        <div class="empty-state-title">No Flavor Coins Yet</div>
        <div class="empty-state-message">Start ranking products with different flavors to earn your first coins!</div>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = userFlavorCoins.map(coin => `
    <div class="flavor-coin-card">
      <span class="flavor-coin-icon">${coin.flavorIcon}</span>
      <div class="flavor-coin-name">${coin.flavorDisplay}</div>
      <div class="flavor-coin-earned">Earned: ${formatDate(coin.earnedAt)}</div>
    </div>
  `).join('');
}

/**
 * Load collections and user progress
 */
async function loadCollections() {
  try {
    const response = await fetch('/api/gamification/collections-progress');
    
    if (!response.ok) {
      throw new Error('Failed to load collections');
    }
    
    const data = await response.json();
    allAchievementsData = data.achievements || [];
    userCollectionProgress = data.userProgress || {};
    
    renderStaticCollections();
    renderDynamicCollections();
    renderHiddenAchievements();
    
  } catch (error) {
    console.error('Error loading collections:', error);
    showCollectionError();
  }
}

/**
 * Render static collections
 */
function renderStaticCollections() {
  const container = document.getElementById('staticCollectionsList');
  const staticCollections = allAchievementsData.filter(a => a.collectionType === 'static_collection');
  
  if (staticCollections.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <div class="empty-state-title">No Static Collections</div>
        <div class="empty-state-message">Check back later for new collection challenges!</div>
      </div>
    `;
    updateTabBadge('staticCollectionsBadge', 0);
    return;
  }
  
  const completedCount = staticCollections.filter(c => {
    const progress = userCollectionProgress[c.id];
    return progress && progress.completed;
  }).length;
  
  container.innerHTML = staticCollections.map(collection => {
    const progress = userCollectionProgress[collection.id] || { completed: false, percentage: 0 };
    const status = progress.completed ? 'completed' : (progress.percentage > 0 ? 'in-progress' : 'not-started');
    const statusLabel = progress.completed ? 'Completed' : (progress.percentage > 0 ? 'In Progress' : 'Not Started');
    
    return `
      <div class="collection-card">
        <div class="collection-header">
          ${renderIcon(collection.icon, collection.iconType, 'collection-icon', '48px')}
          <div class="collection-info">
            <div class="collection-name">${collection.name}</div>
            <div class="collection-description">${collection.description}</div>
          </div>
          <span class="collection-status ${status}">${statusLabel}</span>
        </div>
        <div class="collection-progress">
          <div class="collection-progress-header">
            <span class="collection-progress-label">Progress</span>
            <span class="collection-progress-value">${progress.percentage}%</span>
          </div>
          <div class="collection-progress-bar">
            <div class="collection-progress-fill" style="width: ${progress.percentage}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  updateTabBadge('staticCollectionsBadge', completedCount);
}

/**
 * Render dynamic collections with tier progression
 */
function renderDynamicCollections() {
  const container = document.getElementById('dynamicCollectionsList');
  const dynamicCollections = allAchievementsData.filter(a => a.collectionType === 'dynamic_collection');
  
  if (dynamicCollections.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">No Dynamic Collections</div>
        <div class="empty-state-message">Check back later for protein category master challenges!</div>
      </div>
    `;
    updateTabBadge('dynamicCollectionsBadge', 0);
    return;
  }
  
  // Group by protein category
  const groupedByCategory = dynamicCollections.reduce((acc, collection) => {
    const category = collection.proteinCategory || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(collection);
    return acc;
  }, {});
  
  let totalUnlocked = 0;
  
  container.innerHTML = Object.entries(groupedByCategory).map(([category, collections]) => {
    const progress = userCollectionProgress[category] || { percentage: 0, currentTier: null };
    const tierThresholds = collections[0]?.tierThresholds || { bronze: 40, silver: 60, gold: 75, platinum: 90, diamond: 100 };
    
    const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const currentTierIndex = tiers.indexOf(progress.currentTier);
    
    if (progress.currentTier) {
      totalUnlocked++;
    }
    
    const tierBadges = tiers.map((tier, index) => {
      const threshold = tierThresholds[tier];
      const isUnlocked = progress.percentage >= threshold;
      const isCurrent = tier === progress.currentTier;
      
      return `
        <div class="tier-badge ${tier} ${isUnlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''}">
          ${tier.toUpperCase()} (${threshold}%)
        </div>
      `;
    }).join('');
    
    return `
      <div class="dynamic-collection-card tier-${progress.currentTier || 'none'}">
        <div class="collection-header">
          ${renderIcon(collections[0].icon, collections[0].iconType, 'collection-icon', '48px')}
          <div class="collection-info">
            <div class="collection-name">${collections[0].name}</div>
            <div class="collection-description">${collections[0].description}</div>
          </div>
        </div>
        <div class="collection-progress">
          <div class="collection-progress-header">
            <span class="collection-progress-label">Progress</span>
            <span class="collection-progress-value">${progress.percentage}%</span>
          </div>
          <div class="collection-progress-bar">
            <div class="collection-progress-fill" style="width: ${progress.percentage}%"></div>
          </div>
        </div>
        <div class="tier-badges">
          ${tierBadges}
        </div>
      </div>
    `;
  }).join('');
  
  updateTabBadge('dynamicCollectionsBadge', totalUnlocked);
}

/**
 * Render hidden achievements
 */
function renderHiddenAchievements() {
  const container = document.getElementById('hiddenAchievementsList');
  const hiddenAchievements = allAchievementsData.filter(a => a.isHidden === 1);
  
  if (hiddenAchievements.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <div class="empty-state-title">No Hidden Achievements</div>
        <div class="empty-state-message">Check back later for secret challenges!</div>
      </div>
    `;
    updateTabBadge('hiddenAchievementsBadge', 0);
    return;
  }
  
  const unlockedCount = hiddenAchievements.filter(a => {
    const progress = userCollectionProgress[a.id];
    return progress && progress.unlocked;
  }).length;
  
  container.innerHTML = hiddenAchievements.map(achievement => {
    const progress = userCollectionProgress[achievement.id] || { unlocked: false };
    const isLocked = !progress.unlocked;
    
    return `
      <div class="hidden-achievement-card ${isLocked ? 'locked' : ''}">
        <div class="hidden-achievement-icon">${renderIcon(achievement.icon, achievement.iconType, '', '64px')}</div>
        <div class="hidden-achievement-name">${isLocked ? '???' : achievement.name}</div>
        <div class="hidden-achievement-description">
          ${isLocked ? 'Complete secret requirements to unlock' : achievement.description}
        </div>
        ${!isLocked ? '<span class="hidden-achievement-unlocked">Unlocked!</span>' : ''}
      </div>
    `;
  }).join('');
  
  updateTabBadge('hiddenAchievementsBadge', unlockedCount);
}

/**
 * Update tab badge count
 */
function updateTabBadge(badgeId, count) {
  const badge = document.getElementById(badgeId);
  if (badge) {
    badge.textContent = count;
  }
}

/**
 * Show error in collections
 */
function showCollectionError() {
  const errorHtml = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Failed to Load</div>
      <div class="empty-state-message">Please try refreshing the page</div>
    </div>
  `;
  
  document.getElementById('staticCollectionsList').innerHTML = errorHtml;
  document.getElementById('dynamicCollectionsList').innerHTML = errorHtml;
  document.getElementById('hiddenAchievementsList').innerHTML = errorHtml;
}

/**
 * Format date helper
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
