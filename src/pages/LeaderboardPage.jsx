import React from 'react';
import { Link } from 'react-router-dom';
import { useLeaderboard } from '../hooks/useCommunity';
import { renderAchievementIcon } from '../utils/iconUtils';
import PodiumWidget from '../components/community/PodiumWidget';
import './LeaderboardPage.css';

function LeaderboardPage() {
  const { data: rankers, isLoading, error } = useLeaderboard({ limit: 50 });

  if (isLoading) {
    return (
      <div className="leaderboard-page">
        <div className="leaderboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-page">
        <div className="leaderboard-error">
          <p>Failed to load leaderboard</p>
        </div>
      </div>
    );
  }

  if (!rankers || rankers.length === 0) {
    return (
      <div className="leaderboard-page">
        <div className="leaderboard-empty">
          <p>No rankers yet. Be the first!</p>
        </div>
      </div>
    );
  }

  const topFive = rankers.slice(0, 5);
  const risingContenders = rankers.slice(5, 10);
  const community = rankers.slice(10);
  const podiumScore = topFive.length > 0 ? topFive[topFive.length - 1].engagementScore : 0;
  
  const risingStartRank = topFive.length + 1;
  const communityStartRank = topFive.length + risingContenders.length + 1;

  return (
    <div className="leaderboard-page">
      {/* Hero Section: The Champions (Top 1-5) */}
      {topFive.length > 0 && (
        <section className="champions-section">
          <div className="champions-container">
            <div className="section-intro">
              <h1 className="champions-title">The Champions</h1>
              <p className="champions-subtitle">The elite few who've conquered the flavor frontier</p>
            </div>
            <PodiumWidget rankers={topFive} isLoading={false} />
          </div>
        </section>
      )}

      {/* Section 2: Rising Contenders (Places 6-10) */}
      {risingContenders.length > 0 && (
        <section className="rising-section">
          <div className="rising-container">
            <div className="section-intro">
              <h2 className="rising-title">Rising Contenders</h2>
              <p className="rising-subtitle">Just steps away from greatness</p>
            </div>
            <div className="rising-grid">
              {risingContenders.map((ranker, index) => {
                const actualRank = risingStartRank + index;
                const gap = podiumScore > 0 ? podiumScore - ranker.engagementScore : 0;

                return (
                  <Link
                    key={ranker.userId}
                    to={`/community/${ranker.userId}`}
                    className="rising-card"
                  >
                    <div className="rising-rank">#{actualRank}</div>
                    
                    <div className="rising-avatar-container">
                      <div className="avatar avatar-large">
                        {ranker.avatarUrl ? (
                          <img src={ranker.avatarUrl} alt={ranker.displayName} className="avatar-image" />
                        ) : (
                          <div className="avatar-initials">{ranker.initials}</div>
                        )}
                      </div>
                    </div>

                    <div className="rising-info">
                      <h3 className="rising-name">{ranker.displayName}</h3>
                      <div className="rising-stats">
                        <div className="rising-score">
                          <span className="score-number">{ranker.engagementScore}</span>
                          <span className="score-label">points</span>
                        </div>
                        {gap > 0 && (
                          <div className="gap-to-podium">
                            {gap} pts from podium
                          </div>
                        )}
                      </div>
                      <div className="rising-products">
                        🥩 {ranker.uniqueProducts} products ranked
                      </div>
                    </div>

                    {ranker.badges && ranker.badges.length > 0 && (
                      <div className="rising-badges">
                        {ranker.badges.slice(0, 3).map((badge, i) => (
                          <span key={i} className="badge-icon" title={badge.name}>
                            {renderAchievementIcon(badge, 28)}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Section 3: The Community (11+) */}
      {community.length > 0 && (
        <section className="community-section">
          <div className="community-container">
            <div className="section-intro">
              <h2 className="community-title">The Community</h2>
              <p className="community-subtitle">Every ranker's journey starts here</p>
            </div>
            <div className="community-list">
              {community.map((ranker, index) => {
                const actualRank = communityStartRank + index;
                
                return (
                  <Link
                    key={ranker.userId}
                    to={`/community/${ranker.userId}`}
                    className="community-item"
                  >
                    <div className="community-rank">#{actualRank}</div>
                    
                    <div className="avatar avatar-medium">
                      {ranker.avatarUrl ? (
                        <img src={ranker.avatarUrl} alt={ranker.displayName} className="avatar-image" />
                      ) : (
                        <div className="avatar-initials">{ranker.initials}</div>
                      )}
                    </div>

                    <div className="community-info">
                      <div className="community-name">{ranker.displayName}</div>
                      <div className="community-stats">
                        <span className="stat">
                          🥩 {ranker.uniqueProducts} products
                        </span>
                        {ranker.badges && ranker.badges.length > 0 && (
                          <span className="stat">
                            🏅 {ranker.badges.length} badges
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="community-score">
                      <div className="score-value">{ranker.engagementScore}</div>
                      <div className="score-label">points</div>
                    </div>

                    {ranker.badges && ranker.badges.length > 0 && (
                      <div className="community-badges">
                        {ranker.badges.slice(0, 5).map((badge, i) => (
                          <span key={i} className="badge" title={badge.name}>
                            {renderAchievementIcon(badge, 24)}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default LeaderboardPage;
