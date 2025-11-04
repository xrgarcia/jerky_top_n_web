import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAchievements, useGamificationProgress } from '../../hooks/useCoinBook';
import { useCoinBookWebSocket } from '../../hooks/useCoinBookWebSocket';
import { TIER_EMOJIS } from '../../../shared/constants/tierEmojis.mjs';
import './CoinBookWidget.css';

export default function CoinBookWidget({ defaultCollapsed = false }) {
  const navigate = useNavigate();
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
    return displayTier ? TIER_EMOJIS[displayTier] || '' : '';
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
    <div className={`coinbook-widget coinbook-hero ${isCollapsed ? 'collapsed' : 'expanded'}`}>
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
          <div className="collapsed-milestone-content">
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
            <div className="milestone-preview-status">{nextMilestone.actionText || `${nextMilestone.remaining} more to go!`}</div>
          </div>
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
              <div className="milestone-status">{nextMilestone.actionText || `${nextMilestone.remaining} more to go!`}</div>
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
                  
                  const tooltipId = `tooltip-${achievement.id}`;
                  
                  const handleActivate = () => {
                    // Navigate to coin profile page (works for both earned and locked coins)
                    navigate(`/coinbook/${achievement.id}`);
                  };
                  
                  const handleKeyDown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleActivate();
                    }
                  };
                  
                  return (
                    <div
                      key={achievement.id}
                      className={`achievement-coin ${achievement.earned ? 'earned' : 'locked'} ${tierClass}`}
                      onClick={handleActivate}
                      onKeyDown={handleKeyDown}
                      role="button"
                      tabIndex={0}
                      aria-label={achievement.earned ? achievement.name : 'Locked achievement'}
                      aria-describedby={tooltipId}
                    >
                      {/* Tier badge overlay for tiered achievements */}
                      {!!achievement.hasTiers && tierEmoji && (
                        <span className="tier-badge-overlay">{tierEmoji}</span>
                      )}
                      
                      <span className="coin-icon">
                        {renderIcon(achievement, 48)}
                      </span>
                      <span className="coin-name">
                        {achievement.earned ? achievement.name : achievement.name || '???'}
                      </span>
                      
                      {/* Tooltip - Show for all non-hidden achievements */}
                      <div id={tooltipId} className="achievement-tooltip" role="tooltip">
                        <strong>{achievement.name || 'Locked Achievement'}</strong>
                        {achievement.description && (
                          <span className="tooltip-description">{achievement.description}</span>
                        )}
                        {!!achievement.hasTiers && achievement.currentTier && (
                          <span className="tooltip-tier">
                            {tierEmoji} {achievement.currentTier.charAt(0).toUpperCase() + achievement.currentTier.slice(1)} Tier
                            {achievement.progress && achievement.progress.percentage < 100 && achievement.tierThresholds && (
                              <span className="tooltip-tier-progress">
                                {' '}({achievement.progress.percentage.toFixed(0)}% - {achievement.progress.totalRanked}/{achievement.progress.totalAvailable} ranked)
                              </span>
                            )}
                          </span>
                        )}
                        {!achievement.earned && achievement.requirement_hint && (
                          <span className="requirement-hint">{achievement.requirement_hint}</span>
                        )}
                      </div>
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
