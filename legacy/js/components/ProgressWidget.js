/**
 * ProgressWidget - Displays user progress and next milestones
 */
class ProgressWidget {
  constructor(containerId, progressService, eventBus, options = {}) {
    this.container = document.getElementById(containerId);
    this.progressService = progressService;
    this.eventBus = eventBus;
    this.mysteriousDescriptions = this.initMysteriousDescriptions();
    
    // Determine initial collapsed state:
    // 1. Check sessionStorage for user preference
    // 2. Fall back to options.defaultCollapsed (default: true if not specified)
    const storageKey = `progressWidgetCollapsed_${containerId}`;
    const storedState = sessionStorage.getItem(storageKey);
    
    if (storedState !== null) {
      // User has a saved preference for this specific widget
      this.isCollapsed = storedState === 'true';
    } else {
      // No saved preference, use the default from options
      this.isCollapsed = options.defaultCollapsed !== false; // defaults to true
    }
    
    this.storageKey = storageKey;
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

  expandAchievements() {
    if (this.isCollapsed) {
      this.toggleCollapsed();
    }
  }

  toggleCollapsed() {
    const achievementsSection = this.container.querySelector('.all-achievements');
    if (!achievementsSection) return;

    this.isCollapsed = !this.isCollapsed;
    sessionStorage.setItem(this.storageKey, this.isCollapsed);

    const toggleButton = this.container.querySelector('.progress-toggle-button');
    const widget = this.container.querySelector('.progress-widget');

    if (this.isCollapsed) {
      // Collapsing: Let animation run, THEN add hidden after animation completes
      widget.classList.remove('expanded');
      widget.classList.add('collapsed');
      toggleButton.setAttribute('aria-expanded', 'false');
      toggleButton.setAttribute('aria-label', 'Show all achievements');
      achievementsSection.setAttribute('aria-hidden', 'true');
      
      // Add hidden attribute after animation completes (400ms transition duration)
      setTimeout(() => {
        if (this.isCollapsed) {
          achievementsSection.setAttribute('hidden', '');
        }
      }, 400);
    } else {
      // Expanding: Remove hidden first, THEN let animation run
      achievementsSection.removeAttribute('hidden');
      widget.classList.remove('collapsed');
      widget.classList.add('expanded');
      toggleButton.setAttribute('aria-expanded', 'true');
      toggleButton.setAttribute('aria-label', 'Hide all achievements');
      achievementsSection.setAttribute('aria-hidden', 'false');
    }
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
      totalRankings: progress?.totalRankings,
      isCollapsed: this.isCollapsed
    });

    // For new users with 0 rankings, don't show loading - just hide the widget
    if (!progress || (progress.totalRankings === 0 && achievements.length === 0)) {
      this.container.innerHTML = '';
      return;
    }

    const achievementsId = 'progress-achievements-section';
    
    // Get last earned achievement
    const lastAchievement = progress?.recentAchievements?.[0];

    this.container.innerHTML = `
      <div class="progress-widget ${this.isCollapsed ? 'collapsed' : 'expanded'}">
        <div class="progress-header-wrapper">
          <button 
            class="progress-toggle-button" 
            aria-expanded="${!this.isCollapsed}"
            aria-controls="${achievementsId}"
            aria-label="${this.isCollapsed ? 'Show' : 'Hide'} all achievements"
          >
            <div class="progress-title-section">
              <span class="progress-title">Your Progress</span>
              <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="progress-stats">
              ${lastAchievement ? `
                <span class="stat stat-achievement" data-action="expand" title="${lastAchievement.name}">
                  ${lastAchievement.iconType === 'image' 
                    ? `<img src="${lastAchievement.icon}" alt="${lastAchievement.name}" style="width: 20px; height: 20px; object-fit: contain;">` 
                    : lastAchievement.icon}
                </span>
              ` : ''}
              <span class="stat">${progress.totalRankings} Ranked</span>
              ${progress.currentStreak > 0 ? `<span class="stat">🔥 ${progress.currentStreak} Day Streak</span>` : ''}
            </div>
          </button>
        </div>
        
        ${nextMilestone ? `
          <div class="progress-milestone">
            <div class="milestone-label">
              ${nextMilestone.achievementIconType === 'image' 
                ? `<img src="${nextMilestone.achievementIcon}" alt="${nextMilestone.achievementName}" style="width: 20px; height: 20px; object-fit: contain; vertical-align: middle; margin-right: 4px;">` 
                : (nextMilestone.achievementIcon || '🎯')}
              ${nextMilestone.achievementName || 'Next Milestone'}: ${nextMilestone.label || nextMilestone.target + ' rankings'}
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${nextMilestone.progress}%"></div>
            </div>
            <div class="milestone-status">${nextMilestone.remaining} more to go!</div>
          </div>
        ` : `
          <div class="progress-milestone">
            <div class="milestone-label">🎉 All milestones completed! Keep exploring to find more achievements.</div>
          </div>
        `}

        ${achievements.length > 0 ? `
          <div 
            id="${achievementsId}" 
            class="all-achievements" 
            aria-hidden="${this.isCollapsed}"
            ${this.isCollapsed ? 'hidden' : ''}
          >
            <div class="achievements-label">All Achievements:</div>
            <div class="achievements-grid">
              ${achievements.map(achievement => {
                const mysteriousDesc = this.mysteriousDescriptions[achievement.code] || achievement.description;
                
                // Get tier for display (currentTier for dynamic collections, tier for legacy)
                const displayTier = achievement.currentTier || achievement.tier;
                const tierEmojis = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '💠' };
                const tierEmoji = displayTier ? tierEmojis[displayTier] || '' : '';
                const tierLabel = displayTier ? `${displayTier.charAt(0).toUpperCase() + displayTier.slice(1)}` : '';
                
                const tooltipText = achievement.earned 
                  ? `<strong>${achievement.name}</strong>${tierLabel ? ` - ${tierEmoji} ${tierLabel}` : ''}<br>${achievement.description}<br><em>Unlocked!</em>`
                  : `<strong>???</strong><br>${mysteriousDesc}<br><span class="requirement-hint">${this.getRequirementHint(achievement)}</span>`;
                
                const iconHtml = achievement.iconType === 'image'
                  ? `<img src="${achievement.icon}" alt="${achievement.name}" style="width: 48px; height: 48px; object-fit: contain;">`
                  : achievement.icon;
                
                return `
                  <div class="achievement-badge ${achievement.earned ? 'earned' : 'locked'} clickable tier-${displayTier || 'none'}" tabindex="0" onclick="navigateToAchievementDetail('${achievement.code}')">
                    <span class="achievement-icon">${iconHtml}</span>
                    <span class="achievement-name">${achievement.earned ? achievement.name : '???'}${tierEmoji ? ` ${tierEmoji}` : ''}</span>
                    <div class="achievement-tooltip" role="tooltip">${tooltipText}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Add click handler for toggle button
    const toggleButton = this.container.querySelector('.progress-toggle-button');
    
    if (toggleButton) {
      toggleButton.addEventListener('click', (e) => {
        // If clicking the achievement stat, expand achievements
        if (e.target.closest('.stat-achievement')) {
          e.preventDefault();
          this.expandAchievements();
        } else {
          // Otherwise toggle normally
          e.preventDefault();
          this.toggleCollapsed();
        }
      });
    }
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
