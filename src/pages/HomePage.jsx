import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeroStats, useHomeStats } from '../hooks/useGamification';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import PersonalizedGuidance from '../components/personalized/PersonalizedGuidance';
import { renderAchievementIcon } from '../utils/iconUtils';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { data: heroStats, isLoading: heroLoading } = useHeroStats();
  const { data: homeStats, isLoading: homeLoading } = useHomeStats();
  const [currentAchievement, setCurrentAchievement] = useState(0);
  
  // Track page view for user guidance and classification
  usePageView('general');

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
                      {renderAchievementIcon({
                        icon: heroStats.recentAchievements[currentAchievement].achievementIcon,
                        iconType: heroStats.recentAchievements[currentAchievement].achievementIconType,
                        name: heroStats.recentAchievements[currentAchievement].achievementName
                      }, 28)}
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

      {/* Personalized Guidance for authenticated users */}
      {isAuthenticated && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <PersonalizedGuidance page="general" />
        </div>
      )}

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

      {/* Dashboard Widgets Grid */}
      <div className="home-container">
        <div className="home-dashboard">
          {/* Community Favorites */}
          <div className="dashboard-section" id="topProductsSection">
            <div className="widget-header">
              <div className="widget-title-group">
                <h3>⭐ Community Favorites</h3>
                <p className="section-subtitle">The crowd has spoken! See what's winning hearts.</p>
              </div>
              <button className="widget-action-btn" onClick={() => navigate('/rank')}>Rank This Too!</button>
            </div>
            <div className="dashboard-list">
              {homeStats?.topProducts && homeStats.topProducts.length > 0 ? (
                homeStats.topProducts.slice(0, 5).map((product, index) => (
                  <div key={product.productId} className="dashboard-item product-item" onClick={() => navigate(`/products?id=${product.productId}`)}>
                    <div className={`rank-badge rank-${index + 1}`}>#{index + 1}</div>
                    <img src={product.productData.image} alt={product.productData.title} className="product-thumb" />
                    <div className="product-info">
                      <div className="product-name">{product.productData.title}</div>
                      <div className="product-stats">Avg rank: {product.avgRank} • {product.rankCount} ranking{product.rankCount !== 1 ? 's' : ''}</div>
                    </div>
                    <button className="quick-action-btn" onClick={(e) => { e.stopPropagation(); navigate('/rank'); }}>
                      <span>📝</span>
                    </button>
                  </div>
                ))
              ) : (
                <p className="empty-state">⭐ No products ranked yet. Be the first to share your favorites!</p>
              )}
            </div>
          </div>

          {/* Top Rankers */}
          <div className="dashboard-section" id="topRankersSection">
            <div className="widget-header">
              <div className="widget-title-group">
                <h3>🏆 Top Rankers</h3>
                <p className="section-subtitle">Think you can top them? Start ranking to compete!</p>
              </div>
              <button className="widget-action-btn" onClick={() => navigate('/rank')}>Join the Race</button>
            </div>
            <div className="dashboard-list">
              {homeStats?.topRankers && homeStats.topRankers.length > 0 ? (
                homeStats.topRankers.slice(0, 5).map((ranker, index) => (
                  <div key={ranker.userId} className="dashboard-item ranker-item">
                    <div className={`rank-badge rank-${index + 1}`}>#{index + 1}</div>
                    <div className="avatar avatar-medium">
                      {ranker.avatarUrl ? (
                        <img src={ranker.avatarUrl} alt={ranker.displayName} className="avatar-image" />
                      ) : (
                        <div className="avatar-initials">{ranker.initials}</div>
                      )}
                    </div>
                    <div className="ranker-info">
                      <div className="ranker-name">{ranker.displayName}</div>
                      <div className="ranker-stats">{ranker.engagementScore} engagement{ranker.engagementScore !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">🏆 No rankers yet. Start ranking to claim the top spot!</p>
              )}
            </div>
          </div>

          {/* Recently Ranked */}
          <div className="dashboard-section" id="recentlyRankedSection">
            <div className="widget-header">
              <div className="widget-title-group">
                <h3>🆕 Recently Ranked</h3>
                <p className="section-subtitle">Fresh off the grill! See what's being ranked right now.</p>
              </div>
              <button className="widget-action-btn secondary" onClick={() => navigate('/products')}>Explore All</button>
            </div>
            <div className="dashboard-list">
              {homeStats?.recentlyRanked && homeStats.recentlyRanked.length > 0 ? (
                homeStats.recentlyRanked.map((item) => (
                  <div key={`${item.productId}-${item.rankedAt}`} className="dashboard-item product-item" onClick={() => navigate(`/products?id=${item.productId}`)}>
                    <img src={item.productData.image} alt={item.productData.title} className="product-thumb" />
                    <div className="product-info">
                      <div className="product-name">{item.productData.title}</div>
                      <div className="product-stats">
                        Ranked #{item.ranking} by {item.rankedBy} • {formatTimeAgo(item.rankedAt)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">🆕 Nothing ranked yet. Fresh rankings coming soon!</p>
              )}
            </div>
          </div>

          {/* Trending This Week */}
          <div className="dashboard-section" id="trendingSection">
            <div className="widget-header">
              <div className="widget-title-group">
                <h3>🔥 Trending This Week</h3>
                <p className="section-subtitle">Don't miss out on what's hot in the community!</p>
              </div>
              <button className="widget-action-btn secondary" onClick={() => navigate('/rank')}>Jump In!</button>
            </div>
            <div className="dashboard-list">
              {homeStats?.trending && homeStats.trending.length > 0 ? (
                homeStats.trending.map((product) => (
                  <div key={product.productId} className="dashboard-item product-item" onClick={() => navigate(`/products?id=${product.productId}`)}>
                    <div className="trending-badge">🔥 {product.recentRankCount}</div>
                    <img src={product.productData.image} alt={product.productData.title} className="product-thumb" />
                    <div className="product-info">
                      <div className="product-name">{product.productData.title}</div>
                      <div className="product-stats">Avg rank: {product.avgRank} • Hot this week!</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">📈 No trends yet. Start ranking to create some buzz!</p>
              )}
            </div>
          </div>

          {/* Most Debated */}
          <div className="dashboard-section" id="debatedSection">
            <div className="widget-header">
              <div className="widget-title-group">
                <h3>⚔️ Most Debated</h3>
                <p className="section-subtitle">The community can't agree - you decide!</p>
              </div>
              <button className="widget-action-btn" onClick={() => navigate('/rank')}>Settle It!</button>
            </div>
            <div className="dashboard-list">
              {homeStats?.debated && homeStats.debated.length > 0 ? (
                homeStats.debated.map((product) => (
                  <div key={product.productId} className="dashboard-item product-item" onClick={() => navigate(`/products?id=${product.productId}`)}>
                    <img src={product.productData.image} alt={product.productData.title} className="product-thumb" />
                    <div className="product-info">
                      <div className="product-name">{product.productData.title}</div>
                      <div className="product-stats">
                        Ranks from #{product.bestRank} to #{product.worstRank} • ±{product.variance}
                      </div>
                    </div>
                    <button className="quick-action-btn secondary" onClick={(e) => { e.stopPropagation(); navigate('/rank'); }}>
                      <span>⚔️</span>
                    </button>
                  </div>
                ))
              ) : (
                <p className="empty-state">🎯 Everyone agrees so far! Rank some products to shake things up.</p>
              )}
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="dashboard-section" id="achievementsSection">
            <div className="widget-header">
              <div className="widget-title-group">
                <h3>🏅 Recent Achievements</h3>
                <p className="section-subtitle">Unlock your next badge! Start ranking to earn.</p>
              </div>
              <button className="widget-action-btn" onClick={() => navigate('/rank')}>Earn Badges</button>
            </div>
            <div className="dashboard-list">
              {homeStats?.recentAchievements && homeStats.recentAchievements.length > 0 ? (
                homeStats.recentAchievements.map((achievement, index) => {
                  const isImageIcon = achievement.achievementIcon?.startsWith('/') || achievement.achievementIcon?.startsWith('http');
                  return (
                    <div key={`${achievement.userId}-${achievement.achievementName}-${index}`} className="dashboard-item achievement-item">
                      <div className={`achievement-icon ${achievement.achievementTier}`}>
                        {isImageIcon ? (
                          <img src={achievement.achievementIcon} alt="Achievement" style={{width: '48px', height: '48px', objectFit: 'contain'}} />
                        ) : (
                          achievement.achievementIcon
                        )}
                      </div>
                      <div className="achievement-info">
                        <div className="achievement-name">{achievement.achievementName}</div>
                        <div className="achievement-earned">
                          {achievement.userName} • {formatTimeAgo(achievement.earnedAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="empty-state">🏅 No badges earned yet. Start ranking to unlock yours!</p>
              )}
            </div>
          </div>

          {/* Call to Action Section */}
          <div className="home-cta-section">
            <div className="home-cta-content">
              <h2 className="home-cta-title">Join the Flavor Revolution 🔥</h2>
              <div className="home-cta-body">
                <img 
                  src="https://www.jerky.com/cdn/shop/files/browse_best_sellers.png?v=1704231147&width=240" 
                  alt="Customer holding jerky to heart" 
                  className="home-cta-image"
                />
                <p className="home-cta-text">
                  We're more than just jerky – we're a community of meat snack enthusiasts on a mission to find the perfect chew. 
                  Share your rankings, discover new flavors, and compete for the top spot on our leaderboard. Your taste buds deserve the best!
                </p>
              </div>
              <button className="home-cta-button" onClick={() => navigate('/rank')}>
                <span>Start Ranking Now</span>
                <span className="cta-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
