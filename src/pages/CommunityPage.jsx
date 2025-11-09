import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommunityUsers, useLeaderboard } from '../hooks/useCommunity';
import PersonalizedGuidance from '../components/personalized/PersonalizedGuidance';
import { renderAchievementIcon } from '../utils/iconUtils';
import './CommunityPage.css';

function CommunityPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useCommunityUsers({ search });
  const { data: topRankers, isLoading: loadingTop } = useLeaderboard({ limit: 5 });

  const users = data?.users || [];
  const top5 = topRankers || [];

  return (
    <div className="community-page">
      <div className="community-container">
        <div className="community-header">
          <h1>👥 Community</h1>
          <PersonalizedGuidance pageContext="community" />
        </div>

        {!loadingTop && top5.length > 0 && (
          <div className="top-rankers-widget">
            <h2>🏆 Top 5 Rankers</h2>
            <div className="top-rankers-list">
              {top5.map((ranker, index) => (
                <Link 
                  key={ranker.userId} 
                  to={`/community/${ranker.userId}`}
                  className="top-ranker-item"
                >
                  <div className="top-ranker-position">#{index + 1}</div>
                  <div className="top-ranker-avatar">
                    {ranker.displayName?.charAt(0)}
                  </div>
                  <div className="top-ranker-info">
                    <div className="top-ranker-name">{ranker.displayName}</div>
                    <div className="top-ranker-score">{ranker.engagementScore} pts</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name or flavor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="page-search-input"
          />
        </div>

        {isLoading && <div className="loading">Loading community...</div>}
        {error && <div className="error">Failed to load community members</div>}

        {!isLoading && !error && (
          <div className="users-grid">
            {users.map(user => (
              <Link 
                key={user.user_id} 
                to={`/community/${user.user_id}`}
                className="user-card"
              >
                <div className="user-avatar">
                  {user.display_name?.charAt(0)}
                </div>
                <h3 className="user-name">{user.display_name}</h3>
                <div className="user-stats">
                  <div className="user-stat">
                    <span className="stat-icon">🥩</span>
                    <span>{user.unique_products || 0} products</span>
                  </div>
                  <div className="user-stat">
                    <span className="stat-icon">🏆</span>
                    <span>{user.engagement_score || 0} pts</span>
                  </div>
                </div>
                {user.badges && user.badges.length > 0 && (
                  <div className="user-badges">
                    {user.badges.slice(0, 3).map((badge, i) => (
                      <span key={i} className="badge" title={badge.name}>
                        {renderAchievementIcon(badge, 24)}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {!isLoading && !error && users.length === 0 && (
          <div className="no-results">No community members found</div>
        )}
      </div>
    </div>
  );
}

export default CommunityPage;
