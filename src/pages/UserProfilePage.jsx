import React from 'react';
import { useParams } from 'react-router-dom';
import { useUserProfile } from '../hooks/useCommunity';
import './UserProfilePage.css';

function UserProfilePage() {
  const { userId } = useParams();
  const { data, isLoading, error } = useUserProfile(userId);

  if (isLoading) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-container">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-container">
          <div className="error">Failed to load user profile</div>
        </div>
      </div>
    );
  }

  const { user, stats, achievements, topProducts } = data;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="user-profile-page">
      <div className="user-profile-container">
        <div className="user-profile-header">
          <div className="user-profile-avatar">
            {user.displayName?.charAt(0)}
          </div>
          <h1 className="user-profile-name">{user.displayName}</h1>
          <p className="user-profile-member-since">
            Member since {formatDate(user.memberSince)}
          </p>
        </div>

        <div className="user-stats-grid">
          <div className="user-stat-card">
            <div className="user-stat-icon">🥩</div>
            <div className="user-stat-value">{stats.productsRanked}</div>
            <div className="user-stat-label">Products Ranked</div>
          </div>
          <div className="user-stat-card">
            <div className="user-stat-icon">🏆</div>
            <div className="user-stat-value">{stats.engagementScore}</div>
            <div className="user-stat-label">Engagement Score</div>
          </div>
          <div className="user-stat-card">
            <div className="user-stat-icon">📊</div>
            <div className="user-stat-value">
              {stats.leaderboardPosition ? `#${stats.leaderboardPosition}` : 'N/A'}
            </div>
            <div className="user-stat-label">Leaderboard</div>
          </div>
          <div className="user-stat-card">
            <div className="user-stat-icon">🔥</div>
            <div className="user-stat-value">{stats.currentStreak}</div>
            <div className="user-stat-label">Current Streak</div>
          </div>
        </div>

        {topProducts && topProducts.length > 0 && (
          <div className="user-top-products">
            <h2>🌟 Top Ranked Products</h2>
            <div className="top-products-list">
              {topProducts.map((product) => (
                <div key={product.id} className="top-product-item">
                  <div className="top-product-rank">#{product.rank}</div>
                  {product.image && (
                    <img 
                      src={product.image} 
                      alt={product.title} 
                      className="top-product-image"
                    />
                  )}
                  <div className="top-product-title">{product.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {achievements && achievements.length > 0 && (
          <div className="user-achievements">
            <h2>🪙 Coin Collection ({stats.achievementsEarned})</h2>
            <div className="user-achievements-grid">
              {achievements.map((achievement) => (
                <div key={achievement.id} className="user-achievement-card">
                  <div className="user-achievement-icon">
                    {achievement.iconType === 'url' ? (
                      <img 
                        src={achievement.icon} 
                        alt={achievement.name}
                        className="user-achievement-icon-img"
                      />
                    ) : (
                      <span className="user-achievement-icon-emoji">{achievement.icon}</span>
                    )}
                  </div>
                  <div className="user-achievement-name">{achievement.name}</div>
                  {achievement.currentTier && (
                    <div className="user-achievement-tier">{achievement.currentTier}</div>
                  )}
                  <div className="user-achievement-points">{achievement.points} pts</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {achievements && achievements.length === 0 && (
          <div className="user-no-achievements">
            <p>This user hasn't earned any achievements yet!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserProfilePage;
