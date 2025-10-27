/**
 * Coin Book Page - Simplified achievement display matching ProgressWidget design
 */

let userProgress = null;
let coinbookAchievements = [];
const mysteriousDescriptions = {
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

/**
 * Initialize Coin Book page
 */
window.initCoinbookPage = async function() {
  console.log('🏆 Initializing Coin Book page...');
  
  await loadCoinbookData();
  renderCoinbook();
};

/**
 * Load user progress and achievements data
 */
async function loadCoinbookData() {
  try {
    const [progressResponse, achievementsResponse] = await Promise.all([
      fetch('/api/gamification/progress'),
      fetch('/api/gamification/achievements')
    ]);
    
    if (!progressResponse.ok || !achievementsResponse.ok) {
      throw new Error('Failed to load coinbook data');
    }
    
    const progressData = await progressResponse.json();
    const achievementsData = await achievementsResponse.json();
    
    userProgress = progressData.progress;
    coinbookAchievements = achievementsData.achievements || [];
    
  } catch (error) {
    console.error('Error loading coinbook data:', error);
    showError();
  }
}

/**
 * Render the coinbook widget
 */
function renderCoinbook() {
  const container = document.getElementById('coinbookProgressWidget');
  
  if (!container) {
    console.error('❌ Coinbook container not found');
    return;
  }
  
  if (!userProgress || !coinbookAchievements) {
    container.innerHTML = '<div class="progress-loading">Loading achievements...</div>';
    return;
  }
  
  const nextMilestone = getNextMilestone();
  const lastAchievement = userProgress?.recentAchievements?.[0];
  
  container.innerHTML = `
    <div class="coinbook-progress-widget">
      <div class="progress-header-section">
        <div class="progress-title-section">
          <span class="progress-title">Your Progress</span>
        </div>
        <div class="progress-stats">
          ${lastAchievement ? `
            <span class="stat stat-achievement" title="${lastAchievement.name}">
              ${lastAchievement.iconType === 'image' 
                ? `<img src="${lastAchievement.icon}" alt="${lastAchievement.name}" style="width: 20px; height: 20px; object-fit: contain;">` 
                : lastAchievement.icon}
            </span>
          ` : ''}
          <span class="stat">${userProgress.totalRankings || 0} Ranked</span>
          ${userProgress.currentStreak > 0 ? `<span class="stat">🔥 ${userProgress.currentStreak} Day Streak</span>` : ''}
        </div>
      </div>
      
      ${nextMilestone ? `
        <div class="progress-milestone">
          <div class="milestone-label">${nextMilestone.achievementIcon || '🎯'} ${nextMilestone.achievementName || 'Next Milestone'}: ${nextMilestone.label || nextMilestone.target + ' rankings'}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${nextMilestone.progress}%"></div>
          </div>
          <div class="milestone-status">${nextMilestone.remaining} more to go!</div>
        </div>
      ` : ''}

      ${coinbookAchievements.length > 0 ? `
        <div class="all-achievements">
          <div class="achievements-label">All Achievements:</div>
          <div class="achievements-grid coinbook-grid">
            ${coinbookAchievements.map(achievement => renderAchievementBadge(achievement)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render a single achievement badge
 */
function renderAchievementBadge(achievement) {
  const mysteriousDesc = mysteriousDescriptions[achievement.code] || achievement.description;
  
  const displayTier = achievement.currentTier || achievement.tier;
  const tierEmojis = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '💠' };
  const tierEmoji = displayTier ? tierEmojis[displayTier] || '' : '';
  const tierLabel = displayTier ? `${displayTier.charAt(0).toUpperCase() + displayTier.slice(1)}` : '';
  
  const tooltipText = achievement.earned 
    ? `<strong>${achievement.name}</strong>${tierLabel ? ` - ${tierEmoji} ${tierLabel}` : ''}<br>${achievement.description}<br><em>Unlocked!</em>`
    : `<strong>???</strong><br>${mysteriousDesc}<br><span class="requirement-hint">${getRequirementHint(achievement)}</span>`;
  
  const iconHtml = achievement.iconType === 'image'
    ? `<img src="${achievement.icon}" alt="${achievement.name}" style="width: 56px; height: 56px; object-fit: contain;">`
    : achievement.icon;
  
  return `
    <div class="achievement-badge ${achievement.earned ? 'earned' : 'locked'} clickable tier-${displayTier || 'none'}" tabindex="0" onclick="navigateToAchievementDetail('${achievement.code}')">
      <span class="achievement-icon">${iconHtml}</span>
      <span class="achievement-name">${achievement.earned ? achievement.name : '???'}${tierEmoji ? ` ${tierEmoji}` : ''}</span>
      <div class="achievement-tooltip" role="tooltip">${tooltipText}</div>
    </div>
  `;
}

/**
 * Get requirement hint for locked achievements
 */
function getRequirementHint(achievement) {
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

/**
 * Get next milestone for progress bar
 */
function getNextMilestone() {
  if (!userProgress) return null;
  
  const currentCount = userProgress.totalRankings || 0;
  const milestones = [
    { target: 1, label: 'First rank', achievementName: 'First Steps', achievementIcon: '🎯' },
    { target: 10, label: '10 rankings', achievementName: 'Getting Started', achievementIcon: '📊' },
    { target: 25, label: '25 rankings', achievementName: 'Quarter Century', achievementIcon: '🏅' },
    { target: 50, label: '50 rankings', achievementName: 'Half Century', achievementIcon: '⭐' },
    { target: 100, label: '100 rankings', achievementName: 'Complete Collection', achievementIcon: '💯' }
  ];
  
  for (const milestone of milestones) {
    if (currentCount < milestone.target) {
      const progress = (currentCount / milestone.target) * 100;
      const remaining = milestone.target - currentCount;
      return { ...milestone, progress, remaining };
    }
  }
  
  return {
    target: currentCount + 10,
    label: `${currentCount + 10} rankings`,
    achievementName: 'Keep Going',
    achievementIcon: '🚀',
    progress: 0,
    remaining: 10
  };
}

/**
 * Show error message
 */
function showError() {
  const container = document.getElementById('coinbookProgressWidget');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Failed to Load</div>
        <div class="empty-state-message">Please try refreshing the page</div>
      </div>
    `;
  }
}

/**
 * Navigate to achievement detail page
 */
window.navigateToAchievementDetail = function(achievementCode) {
  window.location.hash = `#coins/${achievementCode}`;
};
