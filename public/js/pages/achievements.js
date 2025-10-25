/**
 * AchievementsPage - Collection book view for all achievements
 */
class AchievementsPage {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.achievements = [];
    this.filteredAchievements = [];
    this.stats = null;
    this.rarity = {};
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = e.target.dataset.category;
        this.applyFilter(category);
      });
    });

    // Search input
    const searchInput = document.getElementById('achievementsSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.filterAchievements();
      });
    }

    // Listen for page navigation
    this.eventBus.on('page:achievements', async () => {
      await this.loadPage();
    });
  }

  applyFilter(category) {
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });

    this.currentFilter = category;
    this.filterAchievements();
  }

  filterAchievements() {
    let filtered = [...this.achievements];

    // Apply category filter
    if (this.currentFilter === 'unlocked') {
      filtered = filtered.filter(a => a.isCompleted);
    } else if (this.currentFilter === 'locked') {
      filtered = filtered.filter(a => !a.isCompleted);
    } else if (this.currentFilter !== 'all') {
      filtered = filtered.filter(a => a.category === this.currentFilter);
    }

    // Apply search filter
    if (this.searchQuery) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(this.searchQuery) ||
        a.description.toLowerCase().includes(this.searchQuery)
      );
    }

    this.filteredAchievements = filtered;
    this.renderAchievements();
  }

  async loadPage() {
    console.log('📚 Loading achievements collection page...');
    
    try {
      const response = await fetch('/api/gamification/achievements/collection', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Achievements data loaded:', data);

      this.achievements = data.achievements;
      this.stats = data.stats;
      this.rarity = data.rarity;

      this.updateStats();
      this.filterAchievements();
    } catch (error) {
      console.error('❌ Error loading achievements:', error);
      this.renderError();
    }
  }

  updateStats() {
    const { totalUnlocked, totalAchievements, totalPoints, percentage } = this.stats;

    document.getElementById('achievementsUnlocked').textContent = `${totalUnlocked}/${totalAchievements}`;
    document.getElementById('achievementsPoints').textContent = totalPoints.toLocaleString();
    document.getElementById('achievementsPercentage').textContent = `${percentage}%`;
  }

  renderAchievements() {
    const grid = document.getElementById('achievementsGrid');
    
    if (this.filteredAchievements.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-message">No achievements found</div>
          <div class="empty-state-hint">Try adjusting your filters or search</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.filteredAchievements.map(achievement => 
      this.createAchievementCard(achievement)
    ).join('');

    // Add click listeners for locked achievements
    grid.querySelectorAll('.achievement-card.locked').forEach(card => {
      card.addEventListener('click', () => {
        const achievementId = parseInt(card.dataset.id);
        this.showAchievementDetails(achievementId);
      });
    });
  }

  createAchievementCard(achievement) {
    const isLocked = !achievement.isCompleted;
    const rarityInfo = this.rarity[achievement.id];
    
    // For product-based achievements, we'll show product images
    const isProductAchievement = achievement.category === 'ranking' && achievement.progress?.products;
    
    // Icon handling
    let iconHtml;
    if (isLocked) {
      iconHtml = `<div class="achievement-lock">🔒</div>`;
    } else if (achievement.iconType === 'image' && achievement.icon) {
      iconHtml = `<img src="${achievement.icon}" alt="${achievement.name}" class="achievement-icon-image">`;
    } else {
      iconHtml = `<div class="achievement-icon-emoji">${achievement.icon || '🏆'}</div>`;
    }

    // Tier badge
    const tierBadge = achievement.currentTier ? `
      <div class="achievement-tier tier-${achievement.currentTier}">
        ${this.getTierEmoji(achievement.currentTier)} ${achievement.currentTier}
      </div>
    ` : '';

    // Rarity badge for unlocked achievements
    const rarityBadge = rarityInfo ? `
      <div class="achievement-rarity">
        ${rarityInfo.percentage}% have this
      </div>
    ` : '';

    // Progress bar for partial completions
    const progressBar = achievement.percentageComplete > 0 && achievement.percentageComplete < 100 ? `
      <div class="achievement-progress">
        <div class="achievement-progress-bar" style="width: ${achievement.percentageComplete}%"></div>
      </div>
    ` : '';

    // Date unlocked
    const dateUnlocked = achievement.earnedAt ? `
      <div class="achievement-date">Unlocked ${this.formatDate(achievement.earnedAt)}</div>
    ` : '';

    return `
      <div class="achievement-card ${isLocked ? 'locked' : 'unlocked'}" data-id="${achievement.id}">
        <div class="achievement-icon">
          ${iconHtml}
        </div>
        ${tierBadge}
        ${rarityBadge}
        <div class="achievement-content">
          <h3 class="achievement-name">${achievement.name}</h3>
          <p class="achievement-description">${achievement.description}</p>
          ${progressBar}
          ${dateUnlocked}
          ${isLocked ? '<div class="achievement-hint">Click to view requirements</div>' : ''}
        </div>
      </div>
    `;
  }

  getTierEmoji(tier) {
    const tierEmojis = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      diamond: '💠'
    };
    return tierEmojis[tier] || '⭐';
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  showAchievementDetails(achievementId) {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (!achievement) return;

    // Create modal content
    const modalContent = this.createDetailsModal(achievement);
    
    // Show modal using existing modal system or create a simple one
    this.eventBus.emit('modal:show', {
      title: achievement.name,
      content: modalContent,
      className: 'achievement-details-modal'
    });
  }

  createDetailsModal(achievement) {
    const requirement = achievement.requirement;
    let requirementText = 'Complete the achievement requirements.';

    // Parse requirement based on type
    if (requirement.type === 'rank_count') {
      const needed = requirement.value - (achievement.progress?.count || 0);
      requirementText = `Rank ${needed} more product${needed !== 1 ? 's' : ''}`;
    } else if (requirement.type === 'category_rank_count') {
      const needed = requirement.value - (achievement.progress?.count || 0);
      requirementText = `Rank ${needed} more ${requirement.category} product${needed !== 1 ? 's' : ''}`;
    } else if (requirement.type === 'streak_days') {
      requirementText = `Maintain a ${requirement.days}-day ranking streak`;
    }

    return `
      <div class="achievement-details">
        <div class="achievement-details-icon">
          ${achievement.iconType === 'image' ? 
            `<img src="${achievement.icon}" alt="${achievement.name}">` : 
            achievement.icon}
        </div>
        <p class="achievement-details-description">${achievement.description}</p>
        
        <div class="achievement-requirement">
          <h4>Requirement</h4>
          <p>${requirementText}</p>
        </div>

        ${achievement.percentageComplete > 0 ? `
          <div class="achievement-progress-section">
            <h4>Progress</h4>
            <div class="achievement-progress-bar-large">
              <div class="achievement-progress-fill" style="width: ${achievement.percentageComplete}%"></div>
            </div>
            <p>${achievement.percentageComplete}% complete</p>
          </div>
        ` : ''}

        ${achievement.points ? `
          <div class="achievement-reward">
            <h4>Reward</h4>
            <p>💎 ${achievement.points} points</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderError() {
    const grid = document.getElementById('achievementsGrid');
    grid.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-message">Failed to load achievements</div>
        <button class="retry-btn" onclick="window.achievementsPage.loadPage()">Try Again</button>
      </div>
    `;
  }
}

window.AchievementsPage = AchievementsPage;
