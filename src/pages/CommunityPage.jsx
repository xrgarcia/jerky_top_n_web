import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommunityUsers, useLeaderboard } from '../hooks/useCommunity';
import PodiumWidget from '../components/community/PodiumWidget';
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
          <h1>Community</h1>
        </div>

        <PodiumWidget rankers={top5} isLoading={loadingTop} />

        <div className="community-description">
          <p className="community-intro">
            Welcome to the heart of jerky.com—where flavor fanatics unite to discover, rank, and celebrate the best jerky in the game! 
            Every product you rank fuels your journey from <strong>Curious Newbie</strong> to <strong>Flavor Legend</strong>, unlocking achievements, 
            climbing the leaderboard, and earning your place among the elite.
          </p>
          <p className="community-mission">
            This isn't just about snacking—it's about building your collection, finding your flavor soulmates, 
            and proving you've got what it takes to be a top ranker. So dive in, start ranking, and let's see if you can make it to the podium! 🥩
          </p>
        </div>

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
                <div className="avatar avatar-large">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} className="avatar-image" />
                  ) : (
                    <div className="avatar-initials">{user.initials}</div>
                  )}
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
