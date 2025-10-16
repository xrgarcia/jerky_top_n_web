/**
 * Home Page Dashboard
 * Displays community statistics and leaderboards
 */

class HomeDashboard {
  constructor() {
    this.eventBus = window.appEventBus;
    this.stats = null;
    this.socket = null;
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    // Wait for socket to be available
    const checkSocket = () => {
      if (window.socket) {
        this.socket = window.socket;
        
        // Subscribe to leaderboard room to receive updates
        this.socket.emit('subscribe:leaderboard');
        
        // Listen for leaderboard updates to refresh top rankers
        this.socket.on('leaderboard:updated', () => {
          console.log('🔄 Leaderboard updated, refreshing home stats...');
          this.loadStats();
        });
      } else {
        setTimeout(checkSocket, 100);
      }
    };
    checkSocket();
  }

  async loadStats() {
    try {
      console.log('🔄 Fetching home stats from /api/gamification/home-stats');
      const response = await fetch('/api/gamification/home-stats', {
        credentials: 'include',
      });

      console.log('📥 Home stats response:', response.status, response.statusText);

      if (response.ok) {
        this.stats = await response.json();
        console.log('✅ Home stats loaded:', this.stats);
        this.render();
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to load home stats:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Error loading home stats:', error);
    }
  }

  render() {
    if (!this.stats) return;

    this.renderCommunityStats();
    this.renderTopRankers();
    this.renderTopProducts();
    this.renderRecentlyRanked();
    this.renderTrending();
    this.renderDebated();
    this.renderRecentAchievements();
  }

  renderCommunityStats() {
    const container = document.getElementById('communityStatsOverview');
    const { communityStats } = this.stats;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${communityStats.totalRankings.toLocaleString()}</div>
          <div class="stat-label">Total Rankings</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${communityStats.totalRankers}</div>
          <div class="stat-label">Rankers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${communityStats.totalProducts}</div>
          <div class="stat-label">Products Ranked</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${communityStats.activeToday}</div>
          <div class="stat-label">Active Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${communityStats.avgRankingsPerUser}</div>
          <div class="stat-label">Avg Rankings/User</div>
        </div>
      </div>
    `;
  }

  renderTopRankers() {
    const container = document.getElementById('topRankersList');
    const { topRankers } = this.stats;

    if (topRankers.length === 0) {
      container.innerHTML = '<p class="empty-state">No rankers yet. Be the first!</p>';
      return;
    }

    container.innerHTML = topRankers.map((ranker, index) => `
      <div class="dashboard-item ranker-item">
        <div class="rank-badge rank-${index + 1}">#${index + 1}</div>
        <div class="ranker-info">
          <div class="ranker-name">${ranker.displayName}</div>
          <div class="ranker-stats">${ranker.engagementScore} engagement${ranker.engagementScore !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `).join('');
  }

  renderTopProducts() {
    const container = document.getElementById('topProductsList');
    const { topProducts } = this.stats;

    if (topProducts.length === 0) {
      container.innerHTML = '<p class="empty-state">No products ranked yet</p>';
      return;
    }

    container.innerHTML = topProducts.map((product, index) => `
      <div class="dashboard-item product-item" onclick="showProductDetail('${product.productId}')">
        <div class="rank-badge">#${index + 1}</div>
        <img src="${product.productData.image}" alt="${product.productData.title}" class="product-thumb">
        <div class="product-info">
          <div class="product-name">${product.productData.title}</div>
          <div class="product-stats">Avg rank: ${product.avgRank} • ${product.rankCount} rankings</div>
        </div>
      </div>
    `).join('');
  }

  renderRecentlyRanked() {
    const container = document.getElementById('recentlyRankedList');
    const { recentlyRanked } = this.stats;

    if (recentlyRanked.length === 0) {
      container.innerHTML = '<p class="empty-state">No recent rankings</p>';
      return;
    }

    container.innerHTML = recentlyRanked.map(item => `
      <div class="dashboard-item product-item" onclick="showProductDetail('${item.productId}')">
        <img src="${item.productData.image}" alt="${item.productData.title}" class="product-thumb">
        <div class="product-info">
          <div class="product-name">${item.productData.title}</div>
          <div class="product-stats">
            Ranked #${item.ranking} by ${item.rankedBy}
            <span class="time-ago">${this.getTimeAgo(item.rankedAt)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderTrending() {
    const container = document.getElementById('trendingList');
    const { trending } = this.stats;

    if (trending.length === 0) {
      container.innerHTML = '<p class="empty-state">No trending products</p>';
      return;
    }

    container.innerHTML = trending.map((product, index) => `
      <div class="dashboard-item product-item" onclick="showProductDetail('${product.productId}')">
        <div class="trending-badge">🔥 ${product.recentRankCount}</div>
        <img src="${product.productData.image}" alt="${product.productData.title}" class="product-thumb">
        <div class="product-info">
          <div class="product-name">${product.productData.title}</div>
          <div class="product-stats">Avg rank: ${product.avgRank}</div>
        </div>
      </div>
    `).join('');
  }

  renderDebated() {
    const container = document.getElementById('debatedList');
    const { debated } = this.stats;

    if (debated.length === 0) {
      container.innerHTML = '<p class="empty-state">No debated products yet</p>';
      return;
    }

    container.innerHTML = debated.map(product => `
      <div class="dashboard-item product-item" onclick="showProductDetail('${product.productId}')">
        <img src="${product.productData.image}" alt="${product.productData.title}" class="product-thumb">
        <div class="product-info">
          <div class="product-name">${product.productData.title}</div>
          <div class="product-stats">
            Ranks from #${product.bestRank} to #${product.worstRank}
            <span class="variance">±${product.variance}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderRecentAchievements() {
    const container = document.getElementById('recentAchievementsList');
    const { recentAchievements } = this.stats;

    if (recentAchievements.length === 0) {
      container.innerHTML = '<p class="empty-state">No achievements yet</p>';
      return;
    }

    container.innerHTML = recentAchievements.map(achievement => `
      <div class="dashboard-item achievement-item">
        <div class="achievement-icon ${achievement.achievementTier}">${achievement.achievementIcon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${achievement.achievementName}</div>
          <div class="achievement-earned">
            ${achievement.userName} • ${this.getTimeAgo(achievement.earnedAt)}
          </div>
        </div>
      </div>
    `).join('');
  }

  getTimeAgo(dateString) {
    // Parse ISO 8601 UTC timestamp (e.g., "2025-10-16T15:18:57.727Z")
    // JavaScript automatically converts UTC to local timezone for display
    const date = new Date(dateString);
    
    // Validate the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', dateString);
      return 'unknown';
    }
    
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    // Handle negative values (future dates - clock skew)
    if (seconds < 0) {
      console.warn('Timestamp in future:', dateString);
      return 'just now';
    }

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  }
}

// Initialize and wire up to page events
const homeDashboard = new HomeDashboard();

// Load stats when home page is shown
if (window.appEventBus) {
  window.appEventBus.on('page:shown', (data) => {
    if (data.page === 'home') {
      console.log('📊 Loading home stats...');
      homeDashboard.loadStats();
    }
  });
}

// Also check if we're already on the home page (for initial load)
setTimeout(() => {
  const homePage = document.getElementById('homePage');
  if (homePage && homePage.style.display !== 'none') {
    console.log('📊 Loading initial home stats...');
    homeDashboard.loadStats();
  }
}, 100);

console.log('✅ Home dashboard initialized');
