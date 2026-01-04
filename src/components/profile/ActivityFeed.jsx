import React from 'react';
import './ActivityFeed.css';

function ActivityFeed({ activities = [] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="activity-feed-empty">
        <p className="empty-message">No recent activity</p>
      </div>
    );
  }

  const getActivityIcon = (type) => {
    const iconMap = {
      'ranking_change': '🔄',
      'coin_earned': '🏆',
      'streak': '🔥',
      'achievement': '⭐',
      'collection': '📦',
      'rank': '🔄'
    };
    return iconMap[type] || '📌';
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const activityDate = new Date(timestamp);
    const diffMs = now - activityDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  return (
    <div className="activity-feed">
      {activities.map((activity, index) => (
        <div key={index} className="activity-item">
          <div className="activity-icon">
            {getActivityIcon(activity.type)}
          </div>
          <div className="activity-text">
            {activity.text || activity.description}
          </div>
          <div className="activity-time">
            {formatTimeAgo(activity.timestamp || activity.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActivityFeed;
