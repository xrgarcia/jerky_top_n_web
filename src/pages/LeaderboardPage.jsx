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

  const topFive = rankers?.slice(0, 5) || [];
  const risingContenders = rankers?.slice(5, 10) || [];
  const community = rankers?.slice(10) || [];
  const podiumScore = topFive.length > 0 ? topFive[topFive.length - 1].engagementScore : 0;
  
  const risingStartRank = topFive.length + 1;
  const communityStartRank = topFive.length + risingContenders.length + 1;

  return (
    <div className="leaderboard-page">
      {/* Hero Section: The Champions (Top 1-5) */}
      <section className="champions-section">
        <div className="champions-container">
          <div className="section-intro">
            <h1 className="champions-title">The Champions</h1>
            <p className="champions-subtitle">
              {topFive.length > 0 
                ? "The elite few who've conquered the flavor frontier" 
                : "The podium stands empty, waiting for legends to rise"}
            </p>
          </div>
          {topFive.length > 0 ? (
            <PodiumWidget rankers={topFive} isLoading={false} />
          ) : (
            <div className="empty-podium">
              <div className="empty-podium-stage">
                {[1, 2, 3, 4, 5].map((position) => (
                  <div key={position} className={`empty-podium-slot position-${position}`}>
                    <div className="empty-avatar">
                      <span className="empty-icon">?</span>
                    </div>
                    <div className="empty-label">{position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`}</div>
                  </div>
                ))}
              </div>
              <p className="empty-message">Will you be the first to claim the crown?</p>
              <Link to="/rank" className="empty-cta">Start Ranking</Link>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Rising Contenders (Places 6-10) */}
      <section className="rising-section">
        <div className="rising-container">
          <div className="section-intro">
            <h2 className="rising-title">Rising Contenders</h2>
            <p className="rising-subtitle">
              {risingContenders.length > 0 
                ? "Just steps away from greatness" 
                : "The chase is wide open"}
            </p>
          </div>
          {risingContenders.length > 0 ? (
            <div className="rising-list">
              {risingContenders.map((ranker, index) => {
                const actualRank = risingStartRank + index;
                const gap = podiumScore > 0 ? podiumScore - ranker.engagementScore : 0;

                return (
                  <Link
                    key={ranker.userId}
                    to={`/community/${ranker.userId}`}
                    className="rising-item"
                  >
                    <div className="rising-rank">#{actualRank}</div>
                    
                    <div className="avatar avatar-large">
                      {ranker.avatarUrl ? (
                        <img src={ranker.avatarUrl} alt={ranker.displayName} className="avatar-image" />
                      ) : (
                        <div className="avatar-initials">{ranker.initials}</div>
                      )}
                    </div>

                    <div className="rising-info">
                      <div className="rising-name">{ranker.displayName}</div>
                      <div className="rising-stats">
                        <span className="stat">
                          🥩 {ranker.uniqueProducts} products
                        </span>
                        {gap > 0 && (
                          <span className="stat gap-to-podium">
                            🔥 {gap} pts from podium
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rising-score">
                      <div className="score-value">{ranker.engagementScore}</div>
                      <div className="score-label">points</div>
                    </div>

                    {ranker.badges && ranker.badges.length > 0 && (
                      <div className="rising-badges">
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
          ) : (
            <div className="empty-rising">
              <div className="empty-rising-list">
                {[6, 7, 8, 9, 10].map((rank) => (
                  <div key={rank} className="empty-rising-slot">
                    <div className="empty-rank">#{rank}</div>
                    <div className="empty-icon">🔥</div>
                    <div className="empty-label">Open Slot</div>
                  </div>
                ))}
              </div>
              <p className="empty-message">Rank your purchases to compete for this tier and hunt down the champions.</p>
              <Link to="/rank" className="empty-cta">Start Your Climb</Link>
            </div>
          )}
        </div>
      </section>

      {/* Section 3: The Community (11+) */}
      <section className="community-section">
        <div className="community-container">
          <div className="section-intro">
            <h2 className="community-title">The Community</h2>
            <p className="community-subtitle">
              {community.length > 0 
                ? "Every ranker's journey starts here" 
                : "Every champion started here"}
            </p>
          </div>
          {community.length > 0 ? (
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
          ) : (
            <div className="empty-community">
              <div className="empty-community-list">
                {[11, 12, 13].map((rank) => (
                  <div key={rank} className="empty-community-slot">
                    <div className="empty-rank">#{rank}</div>
                    <div className="empty-icon">👥</div>
                    <div className="empty-label">Join the Tribe</div>
                  </div>
                ))}
              </div>
              <p className="empty-message">Join fellow jerky enthusiasts by ranking your first flavor and become part of the tribe.</p>
              <Link to="/rank" className="empty-cta">Join the Ranks</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default LeaderboardPage;
