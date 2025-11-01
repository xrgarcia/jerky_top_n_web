/**
 * FullLeaderboardWidget - Displays full leaderboard rankings
 */
class FullLeaderboardWidget {
  constructor(containerId, leaderboardService, eventBus) {
    this.container = document.getElementById(containerId);
    this.leaderboardService = leaderboardService;
    this.eventBus = eventBus;
    this.period = 'all_time';
    this.limit = 50;
    this.init();
  }

  init() {
    if (!this.container) return;
    
    this.setupEventListeners();
    this.load();
  }

  setupEventListeners() {
    this.eventBus.on('leaderboard:loaded', () => {
      this.render();
    });

    this.eventBus.on('position:loaded', () => {
      this.render();
    });

    // Reload leaderboard when leaderboard page is shown
    this.eventBus.on('page:shown', (data) => {
      if (data.page === 'leaderboard') {
        this.load();
      }
    });
  }

  async load() {
    // Show loading state
    this.renderLoading();
    
    this.leaderboardService.subscribeToUpdates();
    await this.leaderboardService.loadLeaderboard(this.period, this.limit);
    await this.leaderboardService.loadUserPosition(this.period);
  }

  renderLoading() {
    this.container.innerHTML = `
      <div class="full-leaderboard-widget">
        <div class="full-leaderboard-header">
          <h2>🏆 Top ${this.limit} Jerky Rankers</h2>
        </div>
        <div class="loading-leaderboard">
          <div class="loading-spinner"></div>
          <p>Calculating rankings...</p>
          <p class="loading-note">This may take a moment on first load</p>
        </div>
      </div>
    `;
  }

  render() {
    const leaderboard = this.leaderboardService.getTopRankers(this.limit);
    const userPosition = this.leaderboardService.userPosition;
    
    console.log('📊 Rendering full leaderboard:', leaderboard.length, 'entries');

    this.container.innerHTML = `
      <div class="full-leaderboard-widget">
        <div class="full-leaderboard-header">
          <div class="header-content">
            <h2>🏆 Top ${this.limit} Jerky Rankers</h2>
            ${userPosition && userPosition.rank ? `
              <div class="user-position-banner">
                Your Rank: <strong>#${userPosition.rank}</strong>
                ${userPosition.percentile ? `<span class="percentile">(Top ${userPosition.percentile}%)</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="full-leaderboard-list">
          ${leaderboard.map((entry, index) => {
            const isCurrentUser = userPosition && userPosition.userId === entry.userId;
            const isMedal = entry.rank <= 3;
            const medalEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉';
            
            return `
              <div class="full-leaderboard-entry ${isCurrentUser ? 'current-user' : ''} ${isMedal ? 'medal-rank' : ''}">
                <div class="entry-rank rank-${entry.rank}">
                  ${isMedal ? medalEmoji : `#${entry.rank}`}
                </div>
                <div class="entry-user-info">
                  <div class="entry-name">${entry.displayName || 'Anonymous'}</div>
                  <div class="entry-details">
                    <span class="detail-item">
                      <span class="detail-icon">📊</span>
                      ${entry.engagementScore} engagement
                    </span>
                    <span class="detail-item">
                      <span class="detail-icon">🥩</span>
                      ${entry.uniqueProducts} products
                    </span>
                  </div>
                </div>
                ${entry.badges && entry.badges.length > 0 ? `
                  <div class="entry-badges-section">
                    ${entry.badges.slice(0, 5).map(badge => {
                      const iconHtml = this.renderBadgeIcon(badge.icon);
                      return `
                        <span class="badge-display tier-${badge.tier}" title="${badge.name}">
                          <span class="badge-icon">${iconHtml}</span>
                        </span>
                      `;
                    }).join('')}
                    ${entry.badges.length > 5 ? `<span class="badge-more">+${entry.badges.length - 5}</span>` : ''}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
          
          ${leaderboard.length === 0 ? `
            <div class="empty-leaderboard">
              <p>🏆 Be the first to rank and claim the top spot!</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderBadgeIcon(icon) {
    if (typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('http'))) {
      return `<img src="${icon}" alt="Badge" style="width: 32px; height: 32px; object-fit: contain;">`;
    }
    return icon;
  }

  destroy() {
    this.leaderboardService.unsubscribeFromUpdates();
  }
}

window.FullLeaderboardWidget = FullLeaderboardWidget;
