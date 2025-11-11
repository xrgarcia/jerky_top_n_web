import React from 'react';
import { Link } from 'react-router-dom';
import { renderAchievementIcon } from '../../utils/iconUtils';
import './UserCard.css';

const JOURNEY_STAGE_CONFIG = {
  dormant: {
    color: '#8B7355',
    bgGradient: 'linear-gradient(135deg, #8B7355 0%, #6B5645 100%)',
    borderColor: '#8B7355',
    label: 'Dormant',
    emoji: '💤'
  },
  new_user: {
    color: '#CD7F32',
    bgGradient: 'linear-gradient(135deg, #CD7F32 0%, #B87333 100%)',
    borderColor: '#CD7F32',
    label: 'New Explorer',
    emoji: '🌱'
  },
  exploring: {
    color: '#C0C0C0',
    bgGradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)',
    borderColor: '#C0C0C0',
    label: 'Explorer',
    emoji: '🧭'
  },
  engaged: {
    color: '#DAA520',
    bgGradient: 'linear-gradient(135deg, #DAA520 0%, #B8860B 100%)',
    borderColor: '#DAA520',
    label: 'Engaged',
    emoji: '⚡'
  },
  power_user: {
    color: '#B9F2FF',
    bgGradient: 'linear-gradient(135deg, #B9F2FF 0%, #87CEEB 100%)',
    borderColor: '#B9F2FF',
    label: 'Legend',
    emoji: '💎'
  }
};

const FOCUS_AREA_LABELS = {
  sweet: 'Sweet',
  savory: 'Savory',
  spicy: 'Spicy',
  exotic: 'Exotic',
  teriyaki: 'Teriyaki',
  peppered: 'Peppered',
  original: 'Original',
  cattle: '🐄 Beef',
  poultry: '🐔 Poultry',
  pork: '🐷 Pork',
  game: '🦌 Game',
  seafood: '🐟 Seafood',
  exotic_meat: '🦘 Exotic'
};

const FLAVOR_COMMUNITY_CONFIG = {
  sweet: {
    color: '#D4A76A',
    bgGradient: 'linear-gradient(135deg, #D4A76A 0%, #C4976A 100%)',
    emoji: '🍯',
    label: 'Sweet'
  },
  savory: {
    color: '#8B4513',
    bgGradient: 'linear-gradient(135deg, #8B4513 0%, #704214 100%)',
    emoji: '🥩',
    label: 'Savory'
  },
  spicy: {
    color: '#DC143C',
    bgGradient: 'linear-gradient(135deg, #DC143C 0%, #B91C1C 100%)',
    emoji: '🌶️',
    label: 'Spicy'
  },
  exotic: {
    color: '#9333EA',
    bgGradient: 'linear-gradient(135deg, #9333EA 0%, #7C3AED 100%)',
    emoji: '🦘',
    label: 'Exotic'
  },
  teriyaki: {
    color: '#92400E',
    bgGradient: 'linear-gradient(135deg, #92400E 0%, #78350F 100%)',
    emoji: '🍱',
    label: 'Teriyaki'
  },
  peppered: {
    color: '#4B5563',
    bgGradient: 'linear-gradient(135deg, #4B5563 0%, #374151 100%)',
    emoji: '⚫',
    label: 'Peppered'
  },
  original: {
    color: '#B8860B',
    bgGradient: 'linear-gradient(135deg, #B8860B 0%, #9A7209 100%)',
    emoji: '🥇',
    label: 'Original'
  },
  smoky: {
    color: '#6B7280',
    bgGradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
    emoji: '💨',
    label: 'Smoky'
  },
  bbq: {
    color: '#B45309',
    bgGradient: 'linear-gradient(135deg, #B45309 0%, #92400E 100%)',
    emoji: '🍖',
    label: 'BBQ'
  },
  hot: {
    color: '#EF4444',
    bgGradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    emoji: '🔥',
    label: 'Hot'
  }
};

const COMMUNITY_STATE_LABELS = {
  enthusiast: 'Enthusiast',
  explorer: 'Explorer',
  taster: 'Taster',
  seeker: 'Seeker',
  curious: 'Curious'
};

function getNarrativeMessage(user) {
  const { journey_stage, current_streak, unique_products, engagement_level } = user;
  
  if (journey_stage === 'power_user') {
    if (current_streak >= 7) {
      return `${current_streak}-day streak champion! A true flavor legend.`;
    }
    return `${unique_products} flavors ranked. Leading the community.`;
  }
  
  if (journey_stage === 'engaged') {
    if (current_streak >= 3) {
      return `${current_streak} days strong! Building an impressive collection.`;
    }
    return `${unique_products} flavors explored. On a steady journey.`;
  }
  
  if (journey_stage === 'exploring') {
    if (unique_products >= 10) {
      return `Discovering flavors with ${unique_products} products ranked.`;
    }
    return 'Finding their flavor identity.';
  }
  
  if (journey_stage === 'new_user') {
    if (unique_products > 0) {
      return `Just started with ${unique_products} flavor${unique_products === 1 ? '' : 's'} ranked.`;
    }
    return 'Beginning their jerky journey.';
  }
  
  return 'Taking a flavor break.';
}

function UserCard({ user }) {
  const stageConfig = JOURNEY_STAGE_CONFIG[user.journey_stage] || JOURNEY_STAGE_CONFIG.new_user;
  const narrativeMessage = getNarrativeMessage(user);
  
  const showProgressBar = user.closest_milestone && user.closest_milestone.progress >= 70;
  
  const topFocusAreas = (user.focus_areas || []).slice(0, 3);
  
  // Get flavor community configuration
  const flavorCommunity = user.primary_flavor_community;
  const flavorConfig = flavorCommunity ? FLAVOR_COMMUNITY_CONFIG[flavorCommunity.flavor] : null;
  const communityStateLabel = flavorCommunity ? COMMUNITY_STATE_LABELS[flavorCommunity.state] : null;

  return (
    <Link 
      to={`/community/${user.user_id}`} 
      className="user-card-narrative"
      style={{
        '--stage-color': stageConfig.color,
        '--stage-gradient': stageConfig.bgGradient,
        '--stage-border': stageConfig.borderColor
      }}
    >
      <div className="card-badges-header">
        <div className="card-tier-badge">
          <span className="tier-emoji">{stageConfig.emoji}</span>
          <span className="tier-label">{stageConfig.label}</span>
        </div>
        
        {flavorCommunity && flavorConfig && (
          <div 
            className="card-flavor-badge"
            style={{
              '--flavor-color': flavorConfig.color,
              '--flavor-gradient': flavorConfig.bgGradient
            }}
          >
            <span className="flavor-emoji">{flavorConfig.emoji}</span>
            <span className="flavor-label">{flavorConfig.label} {communityStateLabel}</span>
          </div>
        )}
      </div>

      <div className="card-profile">
        <div className="avatar avatar-medium">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name} className="avatar-image" />
          ) : (
            <div className="avatar-initials">{user.initials}</div>
          )}
        </div>
        
        <div className="profile-info">
          <h3 className="profile-name">{user.display_name}</h3>
          <p className="profile-narrative">{narrativeMessage}</p>
        </div>
      </div>

      <div className="card-stats">
        <div className="stat-item">
          <span className="stat-icon">🥩</span>
          <span className="stat-value">{user.unique_products}</span>
          <span className="stat-label">flavors</span>
        </div>
        
        {user.current_streak > 0 && (
          <div className="stat-item stat-streak">
            <span className="stat-icon">🔥</span>
            <span className="stat-value">{user.current_streak}</span>
            <span className="stat-label">day{user.current_streak !== 1 ? 's' : ''}</span>
          </div>
        )}
        
        <div className="stat-item">
          <span className="stat-icon">⭐</span>
          <span className="stat-value">{user.engagement_score}</span>
          <span className="stat-label">points</span>
        </div>
      </div>

      {topFocusAreas.length > 0 && (
        <div className="card-focus-areas">
          {topFocusAreas.map((area, index) => (
            <span key={index} className="focus-tag">
              {FOCUS_AREA_LABELS[area] || area}
            </span>
          ))}
        </div>
      )}

      {showProgressBar && user.closest_milestone && (
        <div className="card-milestone">
          <div className="milestone-header">
            <span className="milestone-icon">{user.closest_milestone.icon}</span>
            <span className="milestone-name">{user.closest_milestone.name}</span>
            <span className="milestone-percent">{Math.round(user.closest_milestone.progress)}%</span>
          </div>
          <div className="milestone-progress-bar">
            <div 
              className="milestone-progress-fill" 
              style={{ width: `${user.closest_milestone.progress}%` }}
            ></div>
          </div>
          <p className="milestone-status">
            {user.closest_milestone.current} / {user.closest_milestone.target}
          </p>
        </div>
      )}

      {user.badges && user.badges.length > 0 && (
        <div className="card-badges">
          {user.badges.map((badge, i) => (
            <span key={i} className="badge-icon" title={badge.name}>
              {renderAchievementIcon(badge, 32)}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default UserCard;
