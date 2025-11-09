import React from 'react';
import { useLeaderboard } from '../hooks/useCommunity';
import { renderAchievementIcon } from '../utils/iconUtils';
import './LeaderboardPage.css';

function LeaderboardPage() {
  const { data: rankers, isLoading, error } = useLeaderboard({ limit: 50 });

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <h1>🏆 Leaderboard</h1>
          <p>Top 50 rankers by engagement score</p>
        </div>

        {isLoading && <div className="loading">Loading leaderboard...</div>}
        {error && <div className="error">Failed to load leaderboard</div>}

        {!isLoading && !error && rankers && (
          <div className="leaderboard-list">
            {rankers.map((ranker, index) => (
              <div key={ranker.userId} className={`leaderboard-item rank-${index + 1}`}>
                <div className="rank-badge">
                  {index + 1 <= 3 ? (
                    <span className="medal">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                  ) : (
                    <span className="rank-number">#{index + 1}</span>
                  )}
                </div>

                <div className="ranker-info">
                  <div className="ranker-name">{ranker.displayName || ranker.firstName}</div>
                  <div className="ranker-stats">
                    <span className="stat">
                      <span className="stat-icon">🥩</span>
                      {ranker.uniqueProducts} products
                    </span>
                    {ranker.badges && ranker.badges.length > 0 && (
                      <span className="stat">
                        <span className="stat-icon">🏅</span>
                        {ranker.badges.length} badges
                      </span>
                    )}
                  </div>
                </div>

                <div className="engagement-score">
                  <div className="score-value">{ranker.engagementScore}</div>
                  <div className="score-label">points</div>
                </div>

                {ranker.badges && ranker.badges.length > 0 && (
                  <div className="badges">
                    {ranker.badges.slice(0, 5).map((badge, i) => (
                      <span key={i} className="badge" title={badge.name}>
                        {renderAchievementIcon(badge, 24)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardPage;
