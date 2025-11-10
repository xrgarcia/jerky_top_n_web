import React from 'react';
import { Link } from 'react-router-dom';
import { renderAchievementIcon } from '../../utils/iconUtils';
import './ActivityFeed.css';

function ActivityFeed({ recentAchievements, recentlyRanked, isLoading }) {
  if (isLoading) {
    return (
      <div className="activity-feed loading">
        <div className="activity-column">
          <h3 className="activity-header">🎉 Recent Wins</h3>
          <div className="activity-skeleton"></div>
          <div className="activity-skeleton"></div>
          <div className="activity-skeleton"></div>
        </div>
        <div className="activity-column">
          <h3 className="activity-header">🥩 Fresh Rankings</h3>
          <div className="activity-skeleton"></div>
          <div className="activity-skeleton"></div>
          <div className="activity-skeleton"></div>
        </div>
      </div>
    );
  }

  const achievements = recentAchievements || [];
  const rankings = recentlyRanked || [];

  return (
    <div className="activity-feed">
      <div className="activity-column">
        <h3 className="activity-header">🎉 Recent Wins</h3>
        <div className="activity-list">
          {achievements.length === 0 ? (
            <div className="activity-empty">No recent achievements</div>
          ) : (
            achievements.map((achievement, index) => (
              <div key={index} className="activity-item">
                <div className="activity-icon">
                  {renderAchievementIcon(achievement, 32)}
                </div>
                <div className="activity-content">
                  <div className="activity-user">{achievement.userName}</div>
                  <div className="activity-description">
                    earned <strong>{achievement.achievementName}</strong>
                  </div>
                  <div className="activity-time">
                    {formatTimeAgo(achievement.earnedAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="activity-column">
        <h3 className="activity-header">🥩 Fresh Rankings</h3>
        <div className="activity-list">
          {rankings.length === 0 ? (
            <div className="activity-empty">No recent rankings</div>
          ) : (
            rankings.map((ranking, index) => (
              <Link 
                key={index} 
                to={`/products/${ranking.productId}`}
                className="activity-item activity-link"
              >
                <div className="activity-icon">
                  {ranking.productData?.image ? (
                    <img 
                      src={ranking.productData.image} 
                      alt={ranking.productData.title}
                      className="activity-product-image"
                    />
                  ) : (
                    <div className="activity-product-placeholder">🥩</div>
                  )}
                </div>
                <div className="activity-content">
                  <div className="activity-user">{ranking.rankedBy}</div>
                  <div className="activity-description">
                    ranked <strong>{ranking.productData?.title?.substring(0, 30) || 'Product'}</strong>
                  </div>
                  <div className="activity-rank">
                    Rank #{ranking.ranking}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default ActivityFeed;
