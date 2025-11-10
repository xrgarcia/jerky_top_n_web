import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCommunityUsers, useLeaderboard } from '../hooks/useCommunity';
import { useHomeStats } from '../hooks/useGamification';
import PodiumWidget from '../components/community/PodiumWidget';
import CommunityStatsBar from '../components/community/CommunityStatsBar';
import JourneySection from '../components/community/JourneySection';
import CommunityPulse from '../components/community/CommunityPulse';
import { renderAchievementIcon } from '../utils/iconUtils';
import './CommunityPage.css';

function CommunityPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useCommunityUsers({ search });
  const { data: topRankers, isLoading: loadingTop } = useLeaderboard({ limit: 5 });
  const { data: homeStats, isLoading: statsLoading } = useHomeStats();

  const users = data?.users || [];
  const top5 = topRankers || [];

  const journeyRef = useRef(null);
  const pulseRef = useRef(null);
  const discoverRef = useRef(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    [journeyRef, pulseRef, discoverRef].forEach(ref => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="community-page">
      <section className="section-hero">
        <div className="hero-background">
          <div className="hero-glow"></div>
        </div>
        <div className="community-container">
          <div className="community-header">
            <h1>Community</h1>
          </div>
          <PodiumWidget rankers={top5} isLoading={loadingTop} />
        </div>
        
        <div className="stats-bridge">
          <div className="community-container">
            <CommunityStatsBar 
              stats={homeStats?.communityStats} 
              isLoading={statsLoading} 
            />
          </div>
        </div>
      </section>

      <section className="section-journey" ref={journeyRef}>
        <div className="community-container">
          <JourneySection />
        </div>
      </section>

      <section className="section-pulse" ref={pulseRef}>
        <div className="community-container">
          <CommunityPulse 
            activityStats={homeStats?.activityStats}
            isLoading={statsLoading}
          />
        </div>
      </section>

      <section className="section-discover" ref={discoverRef}>
        <div className="community-container">
          <div className="discover-split">
            <div className="discover-left">
              <h2 className="search-title">Discover Flavor Fanatics</h2>
              <p className="search-subtitle">
                Connect with fellow jerky enthusiasts, explore their collections, and find your flavor soulmates.
              </p>
              <div className="search-bar">
                <input
                  type="text"
                  placeholder={`Search ${homeStats?.communityStats?.totalRankers || ''} rankers...`.trim()}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="page-search-input"
                />
              </div>
            </div>
            
            <div className="discover-right">
              {isLoading && <div className="loading">Loading community...</div>}
              {error && <div className="error">Failed to load community members</div>}

              {!isLoading && !error && users.length > 0 && (
                <div className="users-preview">
                  {users.slice(0, 4).map(user => (
                    <Link 
                      key={user.user_id} 
                      to={`/community/${user.user_id}`}
                      className="user-card-mini"
                    >
                      <div className="avatar avatar-medium">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.display_name} className="avatar-image" />
                        ) : (
                          <div className="avatar-initials">{user.initials}</div>
                        )}
                      </div>
                      <div className="user-card-mini-info">
                        <h4 className="user-name-mini">{user.display_name}</h4>
                        <span className="user-score-mini">🏆 {user.engagement_score || 0} pts</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!isLoading && !error && users.length > 4 && (
            <div className="users-grid">
              {users.slice(4).map(user => (
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
      </section>
    </div>
  );
}

export default CommunityPage;
