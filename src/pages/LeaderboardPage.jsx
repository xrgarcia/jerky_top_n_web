import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeaderboard } from '../hooks/useCommunity';
import '../styles/hero-headers.css';
import './LeaderboardPage.css';

function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState('xp');
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
  const remaining = rankers?.slice(5) || [];
  
  const maxScore = topFive.length > 0 ? topFive[0].engagementScore : 100;

  // Helper function to get title based on rank
  const getRankTitle = (rank) => {
    const titles = {
      1: 'Flavor Legend',
      2: 'Taste Master',
      3: 'Flavor Hunter',
      4: 'Jerky Scholar',
      5: 'Rank Seeker'
    };
    return titles[rank] || 'Flavor Enthusiast';
  };

  return (
    <div className="leaderboard-page">
      {/* Page Header - Matching Rank Flavors/Flavor Index Style */}
      <div className="leaderboard-hero">
        <h1 className="hero-title">Leaderboard</h1>
        <p className="hero-subtitle">Top rankers across the RANK community</p>
      </div>

      {/* Hall of Fame Vault */}
      <div className="hof-vault">
        <div className="vault-header">
          <h2 className="vault-title">Hall of Fame</h2>
          <p className="vault-subtitle">The elite rankers who've reached the top</p>
        </div>
        
        <div className="vault-slots">
          {topFive.map((ranker, index) => {
            const rank = index + 1;
            return (
              <Link
                key={ranker.userId}
                to={`/community/${ranker.userId}`}
                className={`vault-slot rank-${rank}`}
              >
                <div className="rank-badge">#{rank}</div>
                <div className="vault-avatar">
                  <div className="avatar-ring"></div>
                  <div className="avatar-image">
                    {ranker.avatarUrl ? (
                      <img src={ranker.avatarUrl} alt={ranker.displayName} />
                    ) : (
                      <div className="avatar-initials">{ranker.initials}</div>
                    )}
                  </div>
                </div>
                <div className="vault-xp">{ranker.engagementScore.toLocaleString()}</div>
                <div className="vault-title-text">{getRankTitle(rank)}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="leaderboard-tabs">
        <button 
          className={`tab ${activeTab === 'xp' ? 'active' : ''}`}
          onClick={() => setActiveTab('xp')}
        >
          XP
        </button>
        <button 
          className={`tab ${activeTab === 'streaks' ? 'active' : ''}`}
          onClick={() => setActiveTab('streaks')}
        >
          Streaks
        </button>
        <button 
          className={`tab ${activeTab === 'collectors' ? 'active' : ''}`}
          onClick={() => setActiveTab('collectors')}
        >
          Collectors
        </button>
      </div>

      {/* Leaderboard List */}
      <div className="leaderboard-list">
        {remaining.map((ranker, index) => {
          const rank = index + 6;
          const progressPercent = maxScore > 0 ? Math.min((ranker.engagementScore / maxScore) * 100, 100) : 0;
          
          return (
            <Link
              key={ranker.userId}
              to={`/community/${ranker.userId}`}
              className={`lb-card ${rank <= 8 ? 'top-8' : ''}`}
            >
              <div className="lb-rank">#{rank}</div>
              
              <div className="lb-avatar">
                {ranker.avatarUrl ? (
                  <img src={ranker.avatarUrl} alt={ranker.displayName} />
                ) : (
                  <div className="avatar-initials">{ranker.initials}</div>
                )}
              </div>
              
              <div className="lb-user-info">
                <div className="lb-username">{ranker.displayName}</div>
                <div className="lb-role">
                  {ranker.uniqueProducts} product{ranker.uniqueProducts !== 1 ? 's' : ''} ranked
                </div>
              </div>
              
              <div className="lb-xp">
                <div className="xp-bar-container">
                  <div 
                    className="xp-bar-fill" 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="xp-text">{ranker.engagementScore.toLocaleString()} XP</div>
              </div>
              
              <button 
                className="view-profile"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `/community/${ranker.userId}`;
                }}
              >
                View Profile
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default LeaderboardPage;
