import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeroStats, useHomeStats } from '../hooks/useGamification';
import { useAuthStore } from '../store/authStore';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { data: heroStats, isLoading: heroLoading } = useHeroStats();
  const { data: homeStats, isLoading: homeLoading } = useHomeStats();
  const [currentAchievement, setCurrentAchievement] = useState(0);

  // Rotate achievements slider
  useEffect(() => {
    if (!heroStats?.recentAchievements || heroStats.recentAchievements.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentAchievement((prev) => (prev + 1) % heroStats.recentAchievements.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [heroStats?.recentAchievements]);

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          {/* Main Title Banner */}
          <div className="hero-banner">
            <h1 className="hero-title">Rank Your Favorite Jerky</h1>
            <p className="hero-subtitle">Join the community • Discover new flavors • Earn achievements</p>
          </div>

          {/* Gamification Dashboard */}
          <div className="hero-dashboard">
            {/* Live Stats Counters */}
            <div className="hero-stats">
              <div className="hero-stat-card">
                <div className="stat-icon">🔥</div>
                <div className="stat-value">{heroLoading ? '...' : (heroStats?.activeRankersToday || 0)}</div>
                <div className="stat-label">Active Rankers Today</div>
              </div>
              <div className="hero-stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-value">{heroLoading ? '...' : (heroStats?.achievementsThisWeek || 0)}</div>
                <div className="stat-label">Achievements This Week</div>
              </div>
              <div className="hero-stat-card">
                <div className="stat-icon">🏆</div>
                <div className="stat-value">{heroLoading ? '...' : (heroStats?.totalRankings || 0)}</div>
                <div className="stat-label">Total Rankings</div>
              </div>
            </div>

            {/* Social Proof Achievements Slider */}
            <div className="hero-achievements-slider">
              <div className="slider-container">
                {heroLoading ? (
                  <div className="slider-item">Loading recent achievements...</div>
                ) : heroStats?.recentAchievements && heroStats.recentAchievements.length > 0 ? (
                  <div className="slider-item" key={currentAchievement}>
                    <span className="achievement-badge">
                      {heroStats.recentAchievements[currentAchievement].achievementIcon?.startsWith('/') ? (
                        <img src={heroStats.recentAchievements[currentAchievement].achievementIcon} alt="" style={{width: '28px', height: '28px'}} />
                      ) : (
                        heroStats.recentAchievements[currentAchievement].achievementIcon || '🎖️'
                      )}
                    </span>
                    <span className="achievement-text">
                      <span className="achievement-user">{heroStats.recentAchievements[currentAchievement].userName}</span>
                      {' '}earned{' '}
                      <span className="achievement-name">{heroStats.recentAchievements[currentAchievement].achievementName}</span>
                    </span>
                    <span className="achievement-time">{formatTimeAgo(heroStats.recentAchievements[currentAchievement].earnedAt)}</span>
                  </div>
                ) : (
                  <div className="slider-item">
                    <span className="achievement-badge">🎖️</span>
                    <span className="achievement-text">Sign in using your <strong>Jerky.com</strong> account</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dual CTAs */}
            <div className="hero-cta-buttons">
              <button className="hero-cta-btn primary" onClick={() => navigate(isAuthenticated ? '/rank' : '/login')}>
                <span className="cta-text">Start Ranking Now</span>
                <span className="cta-icon">→</span>
              </button>
              <button className="hero-cta-btn secondary" onClick={() => navigate('/leaderboard')}>
                <span className="cta-text">View Leaderboard</span>
                <span className="cta-icon">🏆</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome Section with Community Stats */}
      <section className="welcome-section">
        <h2>Find the Perfect Jerky For You!</h2>
        <p>Discover What the Community Loves</p>
        
        {/* Community Stats Overview */}
        <div className="community-stats-overview">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">
                {homeLoading ? '...' : (homeStats?.communityStats?.totalRankings?.toLocaleString() || 0)}
              </div>
              <div className="stat-label">Total Rankings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {homeLoading ? '...' : (homeStats?.communityStats?.totalRankers || 0)}
              </div>
              <div className="stat-label">Rankers</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {homeLoading ? '...' : (homeStats?.communityStats?.totalProducts || 0)}
              </div>
              <div className="stat-label">Products Ranked</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {homeLoading ? '...' : (homeStats?.communityStats?.activeToday || 0)}
              </div>
              <div className="stat-label">Active Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {homeLoading ? '...' : (homeStats?.communityStats?.avgRankingsPerUser || 0)}
              </div>
              <div className="stat-label">Avg Rankings/User</div>
            </div>
          </div>
        </div>
      </section>

      <div className="home-container">
        <div className="home-grid">
          {/* Top Rankers */}
          <div className="home-card">
            <h2 className="card-title">🏆 Top Rankers</h2>
            <div className="rankers-list">
              {homeStats?.topRankers && homeStats.topRankers.length > 0 ? (
                homeStats.topRankers.slice(0, 5).map((ranker, index) => (
                  <div key={ranker.userId} className="ranker-item">
                    <span className="ranker-rank">#{index + 1}</span>
                    <span className="ranker-name">{ranker.displayName}</span>
                    <span className="ranker-score">{ranker.engagementScore} pts</span>
                  </div>
                ))
              ) : (
                <div className="loading">No rankers yet</div>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="home-card">
            <h2 className="card-title">🥇 Top Rated Products</h2>
            <div className="products-list">
              {homeStats?.topProducts && homeStats.topProducts.length > 0 ? (
                homeStats.topProducts.slice(0, 5).map((product, index) => (
                  <div key={product.productId} className="product-item">
                    <span className="product-rank">#{index + 1}</span>
                    <span className="product-name">{product.productData?.title || 'Unknown Product'}</span>
                    <span className="product-avg">{product.stats?.avgPosition?.toFixed(1) || 'N/A'}</span>
                  </div>
                ))
              ) : (
                <div className="loading">No products rated yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
