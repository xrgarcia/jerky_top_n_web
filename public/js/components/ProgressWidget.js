/**
 * ProgressWidget - Displays user progress and next milestones
 */
class ProgressWidget {
  constructor(containerId, progressService, eventBus) {
    this.container = document.getElementById(containerId);
    this.progressService = progressService;
    this.eventBus = eventBus;
    this.mysteriousDescriptions = this.initMysteriousDescriptions();
    this.init();
  }

  initMysteriousDescriptions() {
    return {
      first_rank: "Every legend begins with a single choice...",
      rank_10: "The path reveals itself to those who persist...",
      rank_25: "Power grows with dedication. Keep going...",
      rank_50: "You're halfway to something extraordinary...",
      complete_collection: "The ultimate completionist. Rank them all...",
      streak_3: "The flame ignites. Feed it daily...",
      streak_7: "Seven suns have witnessed your devotion...",
      streak_30: "The calendar bends to your will. Don't break...",
      streak_100: "Legends speak of those who reached this height...",
      explorer: "Variety is the spice of discovery...",
      adventurer: "The world is vast. Taste it all...",
      globe_trotter: "Few have wandered this far. Continue...",
      top_10: "Rise above the masses. The podium awaits...",
      top_3: "Bronze, silver, or gold? Claim your throne...",
      community_leader: "Influence spreads like wildfire. Be the spark...",
      early_adopter: "The pioneers inherit the earth...",
      taste_maker: "Shape the future. Others will follow..."
    };
  }

  init() {
    if (!this.container) {
      console.error('❌ ProgressWidget init failed: container not found');
      return;
    }
    
    console.log('✅ ProgressWidget init: setting up listeners and rendering');
    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    console.log('🎧 ProgressWidget: Setting up event listeners');
    this.eventBus.on('progress:loaded', () => {
      console.log('📡 ProgressWidget received progress:loaded event');
      this.render();
    });

    this.eventBus.on('progress:achievements:updated', () => {
      console.log('📡 ProgressWidget received progress:achievements:updated event');
      this.render();
    });

    this.eventBus.on('ranking:saved', () => {
      console.log('📡 ProgressWidget received ranking:saved event');
      setTimeout(() => this.render(), 500);
    });
  }

  render() {
    if (!this.container) {
      console.warn('⚠️ ProgressWidget: Container not found, skipping render');
      return;
    }

    const progress = this.progressService.progress;
    const nextMilestone = this.progressService.getNextMilestone();
    const achievements = this.progressService.achievements || [];
    
    console.log('🎨 ProgressWidget rendering with:', {
      hasProgress: !!progress,
      hasMilestone: !!nextMilestone,
      achievementsCount: achievements.length,
      totalRankings: progress?.totalRankings
    });

    // For new users with 0 rankings, don't show loading - just hide the widget
    if (!progress || (progress.totalRankings === 0 && !nextMilestone)) {
      this.container.innerHTML = '';
      return;
    }
    
    // Only show loading if we're actually waiting for data to load
    if (!nextMilestone && progress.totalRankings > 0) {
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
          <div class="milestone-label">${nextMilestone.achievementIcon || '🎯'} ${nextMilestone.achievementName || 'Next Milestone'}: ${nextMilestone.label || nextMilestone.target + ' rankings'}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${nextMilestone.progress}%"></div>
          </div>
          <div class="milestone-status">${nextMilestone.remaining} more to go!</div>
        </div>

        ${achievements.length > 0 ? `
          <div class="all-achievements">
            <div class="achievements-label">All Achievements:</div>
            <div class="achievements-grid">
              ${achievements.map(achievement => {
                const mysteriousDesc = this.mysteriousDescriptions[achievement.code] || achievement.description;
                const tooltipText = achievement.earned 
                  ? `<strong>${achievement.name}</strong><br>${achievement.description}<br><em>Unlocked!</em>`
                  : `<strong>???</strong><br>${mysteriousDesc}<br><span class="requirement-hint">${this.getRequirementHint(achievement)}</span>`;
                
                return `
                  <div class="achievement-badge ${achievement.earned ? 'earned' : 'locked'} tier-${achievement.tier}">
                    <span class="achievement-icon">${achievement.icon}</span>
                    <span class="achievement-name">${achievement.earned ? achievement.name : '???'}</span>
                    <div class="achievement-tooltip">${tooltipText}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  getRequirementHint(achievement) {
    const { type, value } = achievement.requirement;
    const progress = achievement.progress || { current: 0, required: value };
    
    const hints = {
      rank_count: `Progress: ${progress.current}/${progress.required}`,
      streak_days: `Current streak: ${progress.current}/${progress.required} days`,
      unique_brands: `Brands explored: ${progress.current}/${progress.required}`,
      leaderboard_position: `Rank higher to unlock...`,
      profile_views: `Views: ${progress.current}/${progress.required}`,
      join_before: `Time-limited achievement`,
      trendsetter: `Rank trending products...`,
      rank_all_products: `Products ranked: ${progress.current}/${progress.required}`
    };
    
    return hints[type] || 'Complete to unlock...';
  }
}

window.ProgressWidget = ProgressWidget;
