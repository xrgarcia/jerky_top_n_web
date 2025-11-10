import React from 'react';
import './CommunityStatsBar.css';

function CommunityStatsBar({ stats, isLoading }) {
  if (isLoading) {
    return (
      <div className="community-stats-bar loading">
        <div className="stat-skeleton"></div>
        <div className="stat-skeleton"></div>
        <div className="stat-skeleton"></div>
      </div>
    );
  }

  if (!stats) return null;

  const { totalRankers, activeToday, totalRankings } = stats;

  return (
    <div className="community-stats-bar">
      <div className="stat-item">
        <span className="stat-icon">🏆</span>
        <span className="stat-value">{totalRankers?.toLocaleString() || 0}</span>
        <span className="stat-label">Flavor Fanatics</span>
      </div>
      <div className="stat-divider">|</div>
      <div className="stat-item">
        <span className="stat-icon">🔥</span>
        <span className="stat-value">{activeToday?.toLocaleString() || 0}</span>
        <span className="stat-label">Active Today</span>
      </div>
      <div className="stat-divider">|</div>
      <div className="stat-item">
        <span className="stat-icon">🥩</span>
        <span className="stat-value">{totalRankings?.toLocaleString() || 0}</span>
        <span className="stat-label">Rankings & Counting</span>
      </div>
    </div>
  );
}

export default CommunityStatsBar;
