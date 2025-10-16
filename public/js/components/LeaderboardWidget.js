/**
 * LeaderboardWidget - Displays leaderboard rankings
 */
class LeaderboardWidget {
  constructor(containerId, leaderboardService, eventBus) {
    this.container = document.getElementById(containerId);
    this.leaderboardService = leaderboardService;
    this.eventBus = eventBus;
    this.period = 'all_time';
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

    // Reload leaderboard when community page is shown
    this.eventBus.on('page:shown', (data) => {
      if (data.page === 'community') {
        this.load();
      }
    });
  }

  async load() {
    this.leaderboardService.subscribeToUpdates();
    await this.leaderboardService.loadLeaderboard(this.period, 10);
    await this.leaderboardService.loadUserPosition(this.period);
  }

  render() {
    const leaderboard = this.leaderboardService.getTopRankers(10);
    const userPosition = this.leaderboardService.userPosition;

    this.container.innerHTML = `
      <div class="leaderboard-widget">
        <div class="leaderboard-header">
          <h3>🏆 Top Rankers</h3>
          ${userPosition && userPosition.rank ? `
            <div class="user-position">
              Your Rank: #${userPosition.rank}
            </div>
          ` : ''}
        </div>
        
        <div class="leaderboard-list">
          ${leaderboard.map(entry => `
            <div class="leaderboard-entry ${userPosition && userPosition.userId === entry.userId ? 'user-entry' : ''}">
              <div class="entry-rank rank-${entry.rank}">#${entry.rank}</div>
              <div class="entry-info">
                <div class="entry-name">${entry.displayName || 'Anonymous'}</div>
                <div class="entry-stats">${entry.engagementScore} engagement${entry.engagementScore !== 1 ? 's' : ''}</div>
              </div>
              ${entry.badges && entry.badges.length > 0 ? `
                <div class="entry-badges">
                  ${entry.badges.slice(0, 3).map(badge => `
                    <span class="badge-mini tier-${badge.tier}" title="${badge.name}">${badge.icon}</span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  destroy() {
    this.leaderboardService.unsubscribeFromUpdates();
  }
}

window.LeaderboardWidget = LeaderboardWidget;
