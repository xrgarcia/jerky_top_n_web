import React, { useState } from 'react';
import { useCoinBook, useProgress } from '../hooks/useGamification';
import './CoinBookPage.css';

function CoinBookPage() {
  const { data: achievements, isLoading: achievementsLoading } = useCoinBook();
  const { data: progress, isLoading: progressLoading } = useProgress();
  const [filter, setFilter] = useState('all');

  const isLoading = achievementsLoading || progressLoading;

  if (isLoading) {
    return (
      <div className="coinbook-page">
        <div className="coinbook-container">
          <div className="loading">Loading your Coin Book...</div>
        </div>
      </div>
    );
  }

  const earnedIds = new Set(progress?.recentAchievements?.map(a => a.achievementId) || []);
  const earned = achievements?.filter(a => earnedIds.has(a.id)) || [];
  const locked = achievements?.filter(a => !earnedIds.has(a.id)) || [];

  const filteredAchievements = filter === 'all' ? achievements : 
                                filter === 'earned' ? earned : locked;

  return (
    <div className="coinbook-page">
      <div className="coinbook-container">
        <div className="coinbook-header">
          <h1>🪙 Coin Book</h1>
          <p>Your achievement collection</p>
        </div>

        <div className="progress-summary">
          <div className="progress-stat">
            <span className="stat-value">{earned.length}</span>
            <span className="stat-label">Earned</span>
          </div>
          <div className="progress-stat">
            <span className="stat-value">{locked.length}</span>
            <span className="stat-label">Locked</span>
          </div>
          <div className="progress-stat">
            <span className="stat-value">{progress?.totalRankings || 0}</span>
            <span className="stat-label">Total Rankings</span>
          </div>
        </div>

        <div className="filter-tabs">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All ({achievements?.length || 0})
          </button>
          <button 
            className={filter === 'earned' ? 'active' : ''} 
            onClick={() => setFilter('earned')}
          >
            Earned ({earned.length})
          </button>
          <button 
            className={filter === 'locked' ? 'active' : ''} 
            onClick={() => setFilter('locked')}
          >
            Locked ({locked.length})
          </button>
        </div>

        <div className="coins-grid">
          {filteredAchievements?.map(achievement => {
            const isEarned = earnedIds.has(achievement.id);
            return (
              <div key={achievement.id} className={`coin-card ${isEarned ? 'earned' : 'locked'}`}>
                <div className="coin-icon">
                  {achievement.icon?.startsWith('/') ? (
                    <img src={achievement.icon} alt={achievement.name} />
                  ) : (
                    <span className="emoji-icon">{achievement.icon}</span>
                  )}
                </div>
                <h3 className="coin-name">{achievement.name}</h3>
                <p className="coin-description">{achievement.description}</p>
                {achievement.tier && (
                  <div className={`coin-tier tier-${achievement.tier}`}>
                    {achievement.tier}
                  </div>
                )}
                {!isEarned && <div className="locked-overlay">🔒</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CoinBookPage;
