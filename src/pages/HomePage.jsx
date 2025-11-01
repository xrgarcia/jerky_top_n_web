import React from 'react';
import { useHomeStats } from '../hooks/useGamification';
import './HomePage.css';

function HomePage() {
  const { data: stats, isLoading, error } = useHomeStats();

  if (isLoading) {
    return (
      <div className="home-page">
        <div className="home-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-page">
        <div className="home-container">
          <div className="error">Failed to load home stats</div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Welcome to Jerky Top N</h1>
        <p className="hero-subtitle">Rank your favorite jerky products and join the community!</p>
        
        <div className="hero-stats">
          <div className="stat-card">
            <div className="stat-value">{stats?.activeRankersToday || 0}</div>
            <div className="stat-label">Active Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.achievementsThisWeek || 0}</div>
            <div className="stat-label">Achievements This Week</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.totalRankings || 0}</div>
            <div className="stat-label">Total Rankings</div>
          </div>
        </div>
      </div>

      <div className="home-container">
        <div className="home-grid">
          {/* Top Rankers */}
          <div className="home-card">
            <h2 className="card-title">🏆 Top Rankers</h2>
            <div className="rankers-list">
              {stats?.topRankers?.slice(0, 5).map((ranker, index) => (
                <div key={ranker.userId} className="ranker-item">
                  <span className="ranker-rank">#{index + 1}</span>
                  <span className="ranker-name">{ranker.displayName}</span>
                  <span className="ranker-score">{ranker.engagementScore} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="home-card">
            <h2 className="card-title">🥇 Top Rated Products</h2>
            <div className="products-list">
              {stats?.topProducts?.slice(0, 5).map((product, index) => (
                <div key={product.productId} className="product-item">
                  <span className="product-rank">#{index + 1}</span>
                  <span className="product-name">{product.productData?.title || 'Unknown Product'}</span>
                  <span className="product-avg">{product.stats?.avgPosition?.toFixed(1) || 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="home-card full-width">
            <h2 className="card-title">🎉 Recent Achievements</h2>
            <div className="achievements-list">
              {stats?.recentAchievements?.slice(0, 10).map((achievement, index) => (
                <div key={index} className="achievement-item">
                  <span className="achievement-icon">
                    {achievement.achievementIcon?.startsWith('/') ? (
                      <img src={achievement.achievementIcon} alt="" className="achievement-img" />
                    ) : (
                      achievement.achievementIcon
                    )}
                  </span>
                  <span className="achievement-user">{achievement.userName}</span>
                  <span className="achievement-name">earned {achievement.achievementName}</span>
                  <span className="achievement-time">
                    {new Date(achievement.earnedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
