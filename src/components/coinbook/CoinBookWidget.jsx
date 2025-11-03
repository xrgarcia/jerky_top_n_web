import { useState, useEffect } from 'react';
import { useAchievements, useGamificationProgress } from '../../hooks/useCoinBook';
import { useCoinBookWebSocket } from '../../hooks/useCoinBookWebSocket';
import './CoinBookWidget.css';

export default function CoinBookWidget({ defaultCollapsed = false }) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { data: achievementsData, isLoading: achievementsLoading } = useAchievements();
  const { data: progressData, isLoading: progressLoading } = useGamificationProgress();
  
  // Set up WebSocket listeners for real-time updates
  useCoinBookWebSocket();

  const achievements = achievementsData?.achievements || [];
  const progress = progressData?.progress || null;
  const nextMilestone = progress?.nextMilestones?.[0] || null;

  // Get last earned achievement
  const lastAchievement = progress?.recentAchievements?.[0];

  // Don't show widget for users with no activity
  if (!progressLoading && (!progress || (progress.totalRankings === 0 && achievements.length === 0))) {
    return null;
  }

  // Show loading skeleton
  if (achievementsLoading || progressLoading) {
    return (
      <div className="coinbook-widget loading">
        <div className="coinbook-loading">
          <div className="loading-spinner"></div>
          <p>Loading your coin collection...</p>
        </div>
      </div>
    );
  }

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Get tier colors for borders
  const getTierClass = (achievement) => {
    const displayTier = achievement.currentTier || achievement.tier;
    return displayTier ? `tier-${displayTier}` : 'tier-none';
  };

  // Get tier emoji
  const getTierEmoji = (achievement) => {
    const displayTier = achievement.currentTier || achievement.tier;
    const tierEmojis = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '💠' };
    return displayTier ? tierEmojis[displayTier] || '' : '';
  };

  // Render achievement icon (emoji or image)
  const renderIcon = (achievement, size = 48) => {
    if (achievement.iconType === 'image') {
      return (
        <img 
          src={achievement.icon} 
          alt={achievement.name} 
          style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
        />
      );
    }
    return achievement.icon;
  };

  return (
    <div className={`coinbook-widget coinbook-oak ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* Header with toggle button */}
      <button 
        className="coinbook-header" 
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Expand coin book' : 'Collapse coin book'}
      >
        <div className="header-left">
          <span className="coinbook-title">Your Progress</span>
          <svg 
            className="chevron" 
            width="16" 
            height="16" 
            viewBox="0 0 16 16" 
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <div className="header-stats">
          {lastAchievement && (
            <span className="stat-badge stat-achievement" title={lastAchievement.name}>
              {renderIcon(lastAchievement, 20)}
            </span>
          )}
          <span className="stat-badge">
            <span className="stat-icon">🏆</span>
            <span className="cb-badge-text">{progress.totalRankings} Ranked</span>
          </span>
          {progress.currentStreak > 0 && (
            <span className="stat-badge">
              <span className="stat-icon">🔥</span>
              <span className="cb-badge-text">{progress.currentStreak} Day Streak</span>
            </span>
          )}
        </div>
      </button>

      {/* Collapsed state - show next milestone preview */}
      {isCollapsed && nextMilestone && (
        <div className="collapsed-milestone-preview">
          <div className="milestone-preview-label">
            {nextMilestone.achievementIconType === 'image' ? (
              <img 
                src={nextMilestone.achievementIcon} 
                alt={nextMilestone.achievementName}
                className="milestone-preview-icon-img"
              />
            ) : (
              <span className="milestone-preview-icon">{nextMilestone.achievementIcon || '🎯'}</span>
            )}
            <span className="milestone-preview-name">
              {nextMilestone.achievementName || 'Next Milestone'}: {nextMilestone.label || nextMilestone.target + ' rankings'}
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${nextMilestone.progress}%` }}
            ></div>
          </div>
          <div className="milestone-preview-status">{nextMilestone.remaining} more to go!</div>
        </div>
      )}

      {/* Expandable content */}
      {!isCollapsed && (
        <div className="coinbook-content">
          {/* Next Milestone Section */}
          {nextMilestone ? (
            <div className="milestone-section">
              <div className="milestone-label">
                {nextMilestone.achievementIconType === 'image' ? (
                  <img 
                    src={nextMilestone.achievementIcon} 
                    alt={nextMilestone.achievementName}
                    className="milestone-icon-img"
                  />
                ) : (
                  <span className="milestone-icon">{nextMilestone.achievementIcon || '🎯'}</span>
                )}
                <span className="milestone-name">
                  {nextMilestone.achievementName || 'Next Milestone'}: {nextMilestone.label || nextMilestone.target + ' rankings'}
                </span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${nextMilestone.progress}%` }}
                ></div>
              </div>
              <div className="milestone-status">{nextMilestone.remaining} more to go!</div>
            </div>
          ) : (
            <div className="milestone-section">
              <div className="milestone-label">
                <span className="milestone-icon">🎉</span>
                <span className="milestone-name">All milestones completed! Keep exploring to find more achievements.</span>
              </div>
            </div>
          )}

          {/* All Achievements Grid */}
          {achievements.length > 0 && (
            <div className="achievements-section">
              <div className="achievements-label">All Achievements:</div>
              <div className="achievements-grid">
                {achievements.map((achievement) => {
                  const tierClass = getTierClass(achievement);
                  const tierEmoji = getTierEmoji(achievement);
                  
                  return (
                    <div
                      key={achievement.id}
                      className={`achievement-coin ${achievement.earned ? 'earned' : 'locked'} ${tierClass}`}
                      onClick={() => {
                        if (achievement.earned && achievement.code) {
                          window.location.hash = `#coins/${achievement.code}`;
                        }
                      }}
                      role="button"
                      tabIndex={achievement.earned ? 0 : -1}
                      aria-label={achievement.earned ? achievement.name : 'Locked achievement'}
                    >
                      <span className="coin-icon">
                        {renderIcon(achievement, 48)}
                      </span>
                      <span className="coin-name">
                        {achievement.earned ? achievement.name : '???'}
                        {tierEmoji && <span className="tier-emoji"> {tierEmoji}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
