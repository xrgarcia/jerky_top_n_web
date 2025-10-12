/**
 * ProgressWidget - Displays user progress and next milestones
 */
class ProgressWidget {
  constructor(containerId, progressService, eventBus) {
    this.container = document.getElementById(containerId);
    this.progressService = progressService;
    this.eventBus = eventBus;
    this.init();
  }

  init() {
    if (!this.container) return;
    
    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    this.eventBus.on('progress:loaded', () => {
      this.render();
    });

    this.eventBus.on('achievements:loaded', () => {
      this.render();
    });

    this.eventBus.on('ranking:saved', () => {
      setTimeout(() => this.render(), 500);
    });
  }

  render() {
    const progress = this.progressService.progress;
    const nextMilestone = this.progressService.getNextMilestone();
    const achievements = this.progressService.achievements || [];

    if (!progress || !nextMilestone) {
      this.container.innerHTML = '<div class="progress-loading">Loading progress...</div>';
      return;
    }

    this.container.innerHTML = `
      <div class="progress-widget">
        <div class="progress-header">
          <div class="progress-title">Your Progress</div>
          <div class="progress-stats">
            <span class="stat">${progress.totalRankings} Ranked</span>
            ${progress.currentStreak > 0 ? `<span class="stat">🔥 ${progress.currentStreak} Day Streak</span>` : ''}
          </div>
        </div>
        
        <div class="progress-milestone">
          <div class="milestone-label">Next Milestone: ${nextMilestone.target} rankings</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${nextMilestone.progress}%"></div>
          </div>
          <div class="milestone-status">${nextMilestone.remaining} more to go!</div>
        </div>

        ${achievements.length > 0 ? `
          <div class="all-achievements">
            <div class="achievements-label">All Achievements:</div>
            <div class="achievements-grid">
              ${achievements.map(achievement => `
                <span class="achievement-badge ${achievement.earned ? 'earned' : 'locked'} tier-${achievement.tier}" 
                      title="${achievement.name}${achievement.earned ? '' : ' (Locked)'}">
                  <span class="achievement-icon">${achievement.icon}</span>
                  <span class="achievement-name">${achievement.name}</span>
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

window.ProgressWidget = ProgressWidget;
