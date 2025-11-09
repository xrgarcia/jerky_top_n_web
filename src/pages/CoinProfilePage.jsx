import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { TIER_EMOJIS } from '../../shared/constants/tierEmojis.mjs';
import { renderAchievementIcon } from '../utils/iconUtils';
import './CoinProfilePage.css';

function CoinProfilePage() {
  const { coinId } = useParams();
  const navigate = useNavigate();

  // Fetch achievement details
  const { data: achievement, isLoading: achievementLoading } = useQuery({
    queryKey: ['achievement', coinId],
    queryFn: async () => {
      const response = await api.get(`/gamification/achievements`);
      const coin = response.achievements.find(a => a.id === parseInt(coinId));
      if (!coin) throw new Error('Coin not found');
      return coin;
    }
  });

  // Fetch coin type configuration
  const { data: coinType, isLoading: coinTypeLoading } = useQuery({
    queryKey: ['coin-type', achievement?.collectionType],
    queryFn: async () => {
      if (!achievement) return null;
      return await api.get(`/coin-types/${achievement.collectionType}`);
    },
    enabled: !!achievement
  });

  const isLoading = achievementLoading || coinTypeLoading;

  if (isLoading) {
    return (
      <div className="coin-profile-page loading">
        <div className="loading-spinner"></div>
        <p>Loading coin details...</p>
      </div>
    );
  }

  if (!achievement || !coinType) {
    return (
      <div className="coin-profile-page error">
        <h2>Coin Not Found</h2>
        <p>The coin you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/coinbook')}>Back to Coin Book</button>
      </div>
    );
  }

  const isEarned = achievement.earned;
  const tierEmoji = achievement.currentTier ? TIER_EMOJIS[achievement.currentTier] : '';
  
  // Get display name and color
  const displayName = coinType.displayName || coinType.display_name;
  const howToEarn = coinType.howToEarn || coinType.how_to_earn;
  const color = coinType.color;

  return (
    <div className="coin-profile-page">
      <div className="coin-profile-container">
        {/* Header with back button */}
        <div className="coin-header">
          <button className="back-btn" onClick={() => navigate('/coinbook')}>
            ← Back to Coin Book
          </button>
        </div>

        {/* Hero section with coin type branding */}
        <div className="coin-hero" style={{ borderColor: color }}>
          <div className="coin-type-badge" style={{ backgroundColor: color }}>
            <span className="badge-icon">{coinType.icon}</span>
            <span className="badge-text">{displayName}</span>
          </div>
          
          <div className="coin-icon-container">
            {renderAchievementIcon(achievement, 96)}
            {tierEmoji && <span className="tier-badge">{tierEmoji}</span>}
            {!isEarned && <div className="locked-badge">🔒</div>}
          </div>

          <h1 className="coin-name">{achievement.name}</h1>
          <p className="coin-tagline">{coinType.tagline}</p>
          
          {isEarned && achievement.earnedAt && (
            <div className="earned-date">
              ✓ Earned {new Date(achievement.earnedAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="coin-section">
          <h2>About This Coin</h2>
          <p className="coin-description">{achievement.description}</p>
        </div>

        {/* Progress (if applicable) */}
        {achievement.hasTiers && achievement.percentageComplete !== undefined && (
          <div className="coin-section">
            <h2>Your Progress</h2>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${achievement.percentageComplete}%`,
                  backgroundColor: color
                }}
              ></div>
            </div>
            <div className="progress-stats">
              <span>{achievement.percentageComplete}% Complete</span>
              {achievement.currentTier && (
                <span className="current-tier">
                  Current Tier: {tierEmoji} {achievement.currentTier.charAt(0).toUpperCase() + achievement.currentTier.slice(1)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* How to Earn */}
        <div className="coin-section how-to-earn" style={{ borderLeftColor: color }}>
          <h2>How to Earn</h2>
          <p>{howToEarn}</p>
        </div>

        {/* Coin Type Description */}
        <div className="coin-section coin-type-info">
          <h2>About {displayName}</h2>
          <p>{coinType.description}</p>
        </div>

        {/* Call to Action */}
        {!isEarned && (
          <div className="cta-section">
            <button 
              className="cta-btn" 
              style={{ backgroundColor: color }}
              onClick={() => navigate('/rank')}
            >
              Start Ranking to Unlock
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CoinProfilePage;
