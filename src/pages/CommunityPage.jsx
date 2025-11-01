import React, { useState } from 'react';
import { useCommunityUsers } from '../hooks/useCommunity';
import './CommunityPage.css';

function CommunityPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useCommunityUsers({ search });

  const users = data?.users || [];

  return (
    <div className="community-page">
      <div className="community-container">
        <div className="community-header">
          <h1>👥 Community</h1>
          <p>Discover other jerky enthusiasts</p>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search community members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        {isLoading && <div className="loading">Loading community...</div>}
        {error && <div className="error">Failed to load community members</div>}

        {!isLoading && !error && (
          <div className="users-grid">
            {users.map(user => (
              <div key={user.user_id} className="user-card">
                <div className="user-avatar">
                  {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
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
                        {badge.icon?.startsWith('/') ? (
                          <img src={badge.icon} alt={badge.name} className="badge-img" />
                        ) : (
                          badge.icon
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
