import React from 'react';
import ProductPodium from './ProductPodium';
import './ProfileHero.css';

/**
 * ProfileHero - Dark background hero section with user card + product podium
 * Left column: User identity with large avatar
 * Right column: Top 5 ranked products in podium formation
 */
function ProfileHero({ user, topProducts }) {
  if (!user) {
    return null;
  }

  // Journey stage config (same as UserCard but without emojis)
  const JOURNEY_STAGE_CONFIG = {
    dormant: {
      color: '#8B7355',
      bgGradient: 'linear-gradient(135deg, #8B7355 0%, #6B5645 100%)',
      label: 'Dormant'
    },
    new_user: {
      color: '#CD7F32',
      bgGradient: 'linear-gradient(135deg, #CD7F32 0%, #B87333 100%)',
      label: 'New Explorer'
    },
    exploring: {
      color: '#C0C0C0',
      bgGradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)',
      label: 'Explorer'
    },
    engaged: {
      color: '#DAA520',
      bgGradient: 'linear-gradient(135deg, #DAA520 0%, #B8860B 100%)',
      label: 'Engaged'
    },
    power_user: {
      color: '#7C2D12',
      bgGradient: 'linear-gradient(135deg, #7C2D12 0%, #5C1F0E 100%)',
      label: 'Power User'
    }
  };

  const stageConfig = JOURNEY_STAGE_CONFIG[user.journeyStage] || JOURNEY_STAGE_CONFIG.new_user;

  // Format display name based on privacy settings
  const getDisplayName = () => {
    if (user.handle) {
      return `@${user.handle}`;
    }
    if (user.hideNamePrivacy) {
      return user.initials || user.displayName;
    }
    return user.displayName;
  };

  // Generate narrative subline based on journey stage
  const getNarrativeSubline = () => {
    const count = user.rankingCount || 0;
    
    if (count === 0) {
      return "Just beginning the flavor journey";
    }
    
    if (count === 1) {
      return "Ranked their first flavor";
    }
    
    if (count < 10) {
      return `Exploring new flavors (${count} ranked)`;
    }
    
    if (count < 25) {
      return `Building their collection (${count} flavors)`;
    }
    
    if (count < 50) {
      return `An active flavor explorer with ${count} rankings`;
    }
    
    if (count < 100) {
      return `A seasoned taster with ${count} flavors ranked`;
    }
    
    return `A flavor connoisseur with ${count} flavors explored`;
  };

  return (
    <div 
      className="profile-hero"
      style={{
        '--stage-color': stageConfig.color,
        '--stage-gradient': stageConfig.bgGradient
      }}
    >
      <div className="profile-hero-content">
        {/* Left column: User identity */}
        <div className="profile-user-card">
          <div className="profile-avatar-container">
            <div className="avatar avatar-large profile-avatar">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={getDisplayName()} className="avatar-image" />
              ) : (
                <div className="avatar-initials">{user.initials || '?'}</div>
              )}
            </div>
          </div>

          <div className="profile-identity">
            <div className="profile-journey-badge">
              <span className="journey-label">{stageConfig.label}</span>
            </div>
            
            <h1 className="profile-display-name">{getDisplayName()}</h1>
            <p className="profile-narrative">{getNarrativeSubline()}</p>
            
            <div className="profile-stats-row">
              <div className="profile-stat">
                <span className="stat-value">{user.rankingCount || 0}</span>
                <span className="stat-label">Flavors</span>
              </div>
              <div className="profile-stat-divider"></div>
              <div className="profile-stat">
                <span className="stat-value">{user.engagementScore || 0}</span>
                <span className="stat-label">Points</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Product podium */}
        <div className="profile-podium-container">
          <ProductPodium products={topProducts} />
        </div>
      </div>
    </div>
  );
}

export default ProfileHero;
