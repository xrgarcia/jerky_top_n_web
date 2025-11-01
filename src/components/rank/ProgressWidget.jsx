import { useState, useEffect } from 'react';
import { useProgress, getNextMilestone, getMysteriousDescription } from '../../hooks/useProgress';
import { useNavigate } from 'react-router-dom';
import './ProgressWidget.css';

export function ProgressWidget() {
  const { data: progressData, isLoading } = useProgress();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = sessionStorage.getItem('progressWidgetCollapsed_rank');
    return stored !== null ? stored === 'true' : true;
  });
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.setItem('progressWidgetCollapsed_rank', isCollapsed);
  }, [isCollapsed]);

  if (isLoading || !progressData) {
    return null;
  }

  if (progressData.totalRankings === 0 && (!progressData.achievements || progressData.achievements.length === 0)) {
    return null;
  }

  const nextMilestone = getNextMilestone(progressData);
  const lastAchievement = progressData.recentAchievements?.[0];
  const achievements = progressData.achievements || [];

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  const expandAchievements = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  };

  const handleAchievementClick = (achievementCode) => {
    navigate(`/coin-book#${achievementCode}`);
  };

  const getTierEmoji = (tier) => {
    const emojis = { bronze: '🥉', silver: '🥈', gold: '🥇' };
    return emojis[tier] || '';
  };

  const getTooltipText = (achievement) => {
    if (achievement.earned) {
      const earnedDate = achievement.earnedDate ? new Date(achievement.earnedDate).toLocaleDateString() : '';
      return `${achievement.description}${earnedDate ? `\nEarned: ${earnedDate}` : ''}`;
    }
    return getRequirementHint(achievement);
  };

  const getRequirementHint = (achievement) => {
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
  };

  const lastAchievementIcon = lastAchievement?.icon || '🏆';
  const displayIcon = lastAchievementIcon.startsWith('http') 
    ? `<img src="${lastAchievementIcon}" alt="${lastAchievement?.name || 'Achievement'}" class="achievement-custom-icon" />`
    : lastAchievementIcon;

  return (
    <div className={`progress-widget ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className="progress-header-wrapper">
        <button 
          className="progress-toggle-button" 
          aria-expanded={!isCollapsed}
          aria-controls="progress-achievements-section"
          aria-label={isCollapsed ? 'Show all achievements' : 'Hide all achievements'}
          onClick={toggleCollapsed}
        >
          <div className="progress-title-section">
            <span className="progress-title">Your Progress</span>
            <svg className="chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="progress-stats">
            {lastAchievement && (
              <div className="stat-achievement" onClick={(e) => { e.stopPropagation(); expandAchievements(); }} title={`Most Recent: ${lastAchievement.name}`}>
                <span dangerouslySetInnerHTML={{ __html: displayIcon }} />
              </div>
            )}
            <div className="stat-rankings" title="Total Products Ranked">
              <span className="stat-icon">🎯</span>
              <span className="stat-value">{progressData.totalRankings}</span>
            </div>
            <div className="stat-streak" title="Current Streak">
              <span className="stat-icon">🔥</span>
              <span className="stat-value">{progressData.currentStreak}</span>
            </div>
          </div>
        </button>

        {nextMilestone && (
          <div className="next-milestone-compact">
            <div className="milestone-label">Next Milestone</div>
            <div className="milestone-name">{nextMilestone.name}</div>
            <div className="milestone-mysterious">{getMysteriousDescription(nextMilestone.code)}</div>
            <div className="milestone-progress-bar">
              <div 
                className="milestone-progress-fill" 
                style={{ width: `${nextMilestone.progress || 0}%` }}
              ></div>
            </div>
            <div className="milestone-progress-text">{nextMilestone.progress || 0}% complete</div>
          </div>
        )}
      </div>

      {achievements.length > 0 && (
        <div 
          className="all-achievements" 
          id="progress-achievements-section"
          aria-hidden={isCollapsed}
          {...(isCollapsed ? { hidden: true } : {})}
        >
          <div className="achievements-grid">
            {achievements.map((achievement) => {
              const displayTier = achievement.tier;
              const tierEmoji = getTierEmoji(displayTier);
              const tooltipText = getTooltipText(achievement);
              const iconHtml = achievement.icon?.startsWith('http')
                ? `<img src="${achievement.icon}" alt="${achievement.name}" class="achievement-custom-icon" />`
                : achievement.icon;

              return (
                <div 
                  key={achievement.code}
                  className={`achievement-badge ${achievement.earned ? 'earned' : 'locked'} clickable tier-${displayTier || 'none'}`}
                  tabIndex="0"
                  onClick={() => handleAchievementClick(achievement.code)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAchievementClick(achievement.code);
                    }
                  }}
                >
                  <span className="achievement-icon" dangerouslySetInnerHTML={{ __html: iconHtml }} />
                  <span className="achievement-name">
                    {achievement.earned ? achievement.name : '???'}
                    {tierEmoji && ` ${tierEmoji}`}
                  </span>
                  <div className="achievement-tooltip" role="tooltip">{tooltipText}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
