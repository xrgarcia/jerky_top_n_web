import React, { useState, useEffect, useRef } from 'react';
import { useCommunityUsers, useLeaderboard } from '../hooks/useCommunity';
import { useHomeStats } from '../hooks/useGamification';
import PodiumWidget from '../components/community/PodiumWidget';
import CommunityStatsBar from '../components/community/CommunityStatsBar';
import JourneySection from '../components/community/JourneySection';
import CommunityPulse from '../components/community/CommunityPulse';
import UserCard from '../components/community/UserCard';
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
                <div className="users-grid">
                  {users.map(user => (
                    <UserCard key={user.user_id} user={user} />
                  ))}
                </div>
              )}

              {!isLoading && !error && users.length === 0 && (
                <div className="no-results">No community members found</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CommunityPage;
