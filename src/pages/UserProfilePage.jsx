import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserProfile } from '../hooks/useCommunity';
import { usePageView } from '../hooks/usePageView';
import { renderAchievementIcon } from '../utils/iconUtils';
import './UserProfilePage.css';

function UserProfilePage() {
  const { userId } = useParams();
  const { data, isLoading, error } = useUserProfile(userId);
  
  // Track profile view
  usePageView('profile', { profileId: userId, profileName: data?.user?.displayName });
  
  // Filter and search state
  const [animalFilter, setAnimalFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Get unique animal types for filter buttons
  const animalTypes = useMemo(() => {
    if (!data?.topProducts) return [];
    const types = [...new Set(data.topProducts.map(p => p.animalType).filter(Boolean))];
    return types.sort();
  }, [data?.topProducts]);

  // Filter and search products
  const filteredProducts = useMemo(() => {
    if (!data?.topProducts) return [];
    
    return data.topProducts.filter(product => {
      // Animal type filter
      const matchesAnimal = animalFilter === 'all' || product.animalType === animalFilter;
      
      // Search filter (search in title, vendor, flavor)
      const matchesSearch = searchQuery.trim() === '' || 
        product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.primaryFlavor?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesAnimal && matchesSearch;
    });
  }, [data?.topProducts, animalFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-container">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="user-profile-page">
        <div className="user-profile-container">
          <div className="error">Failed to load user profile</div>
        </div>
      </div>
    );
  }

  const { user, stats, achievements, topProducts } = data;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="user-profile-page">
      <div className="user-profile-container">
        <div className="user-profile-header">
          <div className="avatar avatar-large">
            {user.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={`${user.displayName}'s profile`} 
                className="avatar-image"
              />
            ) : (
              <div className="avatar-initials">
                {user.initials || user.displayName?.charAt(0)}
              </div>
            )}
          </div>
          <h1 className="user-profile-name">{user.displayName}</h1>
          {user.realName && (
            <p className="user-profile-real-name">{user.realName}</p>
          )}
          <p className="user-profile-member-since">
            Member since {formatDate(user.memberSince)}
          </p>
        </div>

        <div className="user-stats-grid">
          <div className="user-stat-card">
            <div className="user-stat-icon">🥩</div>
            <div className="user-stat-value">{stats.productsRanked}</div>
            <div className="user-stat-label">Flavors Ranked</div>
          </div>
          <div className="user-stat-card">
            <div className="user-stat-icon">🏆</div>
            <div className="user-stat-value">{stats.engagementScore}</div>
            <div className="user-stat-label">Engagement Score</div>
          </div>
          <div className="user-stat-card">
            <div className="user-stat-icon">📊</div>
            <div className="user-stat-value">
              {stats.leaderboardPosition ? `#${stats.leaderboardPosition}` : 'N/A'}
            </div>
            <div className="user-stat-label">Leaderboard</div>
          </div>
          <div className="user-stat-card">
            <div className="user-stat-icon">🔥</div>
            <div className="user-stat-value">{stats.currentStreak}</div>
            <div className="user-stat-label">Current Streak</div>
          </div>
        </div>

        {topProducts && topProducts.length > 0 && (
          <div className="user-all-rankings">
            <div className="rankings-header">
              <h2>🥩 All Flavor Rankings ({filteredProducts.length})</h2>
            </div>

            <div className="rankings-controls">
              <div className="animal-filters">
                <button 
                  className={`filter-btn ${animalFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setAnimalFilter('all')}
                >
                  All
                </button>
                {animalTypes.map(type => (
                  <button
                    key={type}
                    className={`filter-btn ${animalFilter === type ? 'active' : ''}`}
                    onClick={() => setAnimalFilter(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="rankings-search"
                placeholder="Search flavors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div 
              className="rankings-list"
              tabIndex="-1"
              onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
              onMouseLeave={(e) => e.currentTarget.blur()}
            >
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <div key={product.id} className="ranking-item">
                    <div className="ranking-number">#{product.rank}</div>
                    {product.image && (
                      <img 
                        src={product.image} 
                        alt={product.title} 
                        className="ranking-image"
                      />
                    )}
                    <div className="ranking-details">
                      <div className="ranking-title">{product.title}</div>
                      <div className="ranking-meta">
                        {product.vendor && <span className="ranking-vendor">{product.vendor}</span>}
                        {product.animalType && <span className="ranking-animal">• {product.animalType}</span>}
                        {product.primaryFlavor && (
                          <span className="ranking-flavor">
                            • <Link to={`/flavors/${encodeURIComponent(product.primaryFlavor.toLowerCase())}`} className="flavor-link">
                              {product.primaryFlavor}
                            </Link>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-results">No products match your filters</div>
              )}
            </div>
          </div>
        )}

        {achievements && achievements.length > 0 && (
          <div className="user-achievements">
            <h2>🪙 Coin Collection ({stats.achievementsEarned})</h2>
            <div className="user-achievements-grid">
              {achievements.map((achievement) => (
                <Link 
                  key={achievement.id} 
                  to={`/coinbook/${achievement.id}`}
                  className="user-achievement-card"
                >
                  <div className="user-achievement-icon">
                    {renderAchievementIcon(achievement, 48)}
                  </div>
                  <div className="user-achievement-name">{achievement.name}</div>
                  {achievement.currentTier && (
                    <div className="user-achievement-tier">{achievement.currentTier}</div>
                  )}
                  <div className="user-achievement-points">{achievement.points} pts</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {achievements && achievements.length === 0 && (
          <div className="user-no-achievements">
            <p>This user hasn't earned any achievements yet!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserProfilePage;
