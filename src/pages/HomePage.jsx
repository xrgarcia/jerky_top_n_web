import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeroStats, useHomeStats, useProgress } from '../hooks/useGamification';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { data: heroStats, isLoading: heroLoading } = useHeroStats();
  const { data: homeStats, isLoading: homeLoading } = useHomeStats();
  const { data: progress, isLoading: progressLoading } = useProgress();
  
  // Track page view for user guidance and classification
  usePageView('general');

  const isLoading = heroLoading || homeLoading || progressLoading;

  // Get user's level and XP
  const userLevel = progress?.level || 1;
  const currentXP = progress?.currentXP || 0;
  const nextLevelXP = progress?.nextLevelXP || 100;
  const xpProgress = nextLevelXP > 0 ? (currentXP / nextLevelXP) * 100 : 0;

  // Get user's ranking count from progress
  const rankingCount = progress?.stats?.productsRanked || 0;

  // Get top 3 community favorites
  const top3Products = homeStats?.topProducts?.slice(0, 3) || [];

  // Get recent achievements
  const recentAchievements = heroStats?.recentAchievements?.slice(0, 3) || [];

  // Get next unlock
  const nextUnlock = progress?.nextUnlock || null;

  return (
    <div className="home-page-v2">
      {/* Profile Hero Section */}
      <section className="profile-hero">
        <div className="hero-container">
          <div className="hero-left">
            <div className="welcome-badge">Welcome Back</div>
            <h1 className="hero-title">
              {isAuthenticated ? `${user?.displayName || 'Ranker'}` : 'Jerky Ranker'}
            </h1>
            <p className="hero-subtitle">
              {isAuthenticated 
                ? `Level ${userLevel} • ${rankingCount} Products Ranked`
                : 'Join thousands of jerky enthusiasts ranking their favorite flavors'
              }
            </p>

            {isAuthenticated && (
              <div className="xp-progress-container">
                <div className="xp-label">
                  <span>Level {userLevel}</span>
                  <span>{currentXP} / {nextLevelXP} XP</span>
                </div>
                <div className="xp-bar">
                  <div className="xp-fill" style={{ width: `${xpProgress}%` }}></div>
                </div>
              </div>
            )}

            <div className="hero-actions">
              {isAuthenticated ? (
                <>
                  <button className="hero-cta-primary" onClick={() => navigate('/rank')}>
                    <span>Start Ranking</span>
                    <span className="cta-icon">🎯</span>
                  </button>
                  <button className="hero-cta-secondary" onClick={() => navigate('/profile')}>
                    View Profile
                  </button>
                </>
              ) : (
                <>
                  <button className="hero-cta-primary" onClick={() => navigate('/rank')}>
                    <span>Explore Rankings</span>
                    <span className="cta-icon">→</span>
                  </button>
                  <button className="hero-cta-secondary" onClick={() => navigate('/community')}>
                    Join Community
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="hero-right">
            <div className="stats-grid-hero">
              <div className="stat-card-hero">
                <div className="stat-icon">🏆</div>
                <div className="stat-value">
                  {isLoading ? '...' : (homeStats?.communityStats?.totalRankers?.toLocaleString() || 0)}
                </div>
                <div className="stat-label">Active Rankers</div>
              </div>
              <div className="stat-card-hero">
                <div className="stat-icon">⭐</div>
                <div className="stat-value">
                  {isLoading ? '...' : (homeStats?.communityStats?.totalRankings?.toLocaleString() || 0)}
                </div>
                <div className="stat-label">Total Rankings</div>
              </div>
              <div className="stat-card-hero">
                <div className="stat-icon">🔥</div>
                <div className="stat-value">
                  {isLoading ? '...' : (homeStats?.communityStats?.activeToday || 0)}
                </div>
                <div className="stat-label">Active Today</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transition */}
      <div className="section-transition">
        <div className="transition-line"></div>
      </div>

      {/* Top 3 Flavors Showcase */}
      <section className="top-flavors-section">
        <div className="section-header">
          <h2 className="section-title">Community Favorites</h2>
          <p className="section-subtitle">The top-ranked jerky according to our community</p>
        </div>

        <div className="podium-display">
          {top3Products.length > 0 ? (
            <>
              {/* 2nd Place - Left */}
              {top3Products[1] && (
                <div className="podium-card rank-2" onClick={() => navigate(`/products?id=${top3Products[1].productId}`)}>
                  <div className="podium-rank">
                    <span className="rank-number">2</span>
                    <span className="rank-medal">🥈</span>
                  </div>
                  <div className="podium-image-container">
                    <img src={top3Products[1].productData?.image} alt={top3Products[1].productData?.title} className="podium-image" />
                  </div>
                  <div className="podium-info">
                    <h3 className="product-name">{top3Products[1].productData?.title}</h3>
                    <div className="product-stats-row">
                      <span className="avg-rank">Avg Rank: {top3Products[1].avgRank}</span>
                      <span className="rank-count">{top3Products[1].rankCount} rankings</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 1st Place - Center (Elevated) */}
              {top3Products[0] && (
                <div className="podium-card rank-1" onClick={() => navigate(`/products?id=${top3Products[0].productId}`)}>
                  <div className="podium-rank">
                    <span className="rank-number">1</span>
                    <span className="rank-medal">🥇</span>
                  </div>
                  <div className="podium-image-container">
                    <img src={top3Products[0].productData?.image} alt={top3Products[0].productData?.title} className="podium-image" />
                  </div>
                  <div className="podium-info">
                    <h3 className="product-name">{top3Products[0].productData?.title}</h3>
                    <div className="product-stats-row">
                      <span className="avg-rank">Avg Rank: {top3Products[0].avgRank}</span>
                      <span className="rank-count">{top3Products[0].rankCount} rankings</span>
                    </div>
                  </div>
                  <div className="champion-badge">Champion</div>
                </div>
              )}

              {/* 3rd Place - Right */}
              {top3Products[2] && (
                <div className="podium-card rank-3" onClick={() => navigate(`/products?id=${top3Products[2].productId}`)}>
                  <div className="podium-rank">
                    <span className="rank-number">3</span>
                    <span className="rank-medal">🥉</span>
                  </div>
                  <div className="podium-image-container">
                    <img src={top3Products[2].productData?.image} alt={top3Products[2].productData?.title} className="podium-image" />
                  </div>
                  <div className="podium-info">
                    <h3 className="product-name">{top3Products[2].productData?.title}</h3>
                    <div className="product-stats-row">
                      <span className="avg-rank">Avg Rank: {top3Products[2].avgRank}</span>
                      <span className="rank-count">{top3Products[2].rankCount} rankings</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-podium">
              <p>🏆 No rankings yet. Be the first to set the standard!</p>
            </div>
          )}
        </div>

        <button className="section-cta" onClick={() => navigate('/products')}>
          View All Products
        </button>
      </section>

      {/* Transition */}
      <div className="section-transition">
        <div className="transition-line"></div>
      </div>

      {/* Action Cards Grid */}
      <section className="action-cards-section">
        <div className="action-cards-grid">
          {/* Rank Now Card */}
          <div className="action-card rank-card" onClick={() => navigate('/rank')}>
            <div className="card-icon">🎯</div>
            <h3 className="card-title">Rank Flavors</h3>
            <p className="card-description">
              Share your taste preferences and help the community discover the best jerky
            </p>
            <div className="card-footer">
              <span className="card-cta">Start Ranking →</span>
            </div>
          </div>

          {/* Leaderboard Card */}
          <div className="action-card leaderboard-card" onClick={() => navigate('/leaderboard')}>
            <div className="card-icon">🏆</div>
            <h3 className="card-title">Climb the Ranks</h3>
            <p className="card-description">
              Compete with fellow rankers and earn your place on the leaderboard
            </p>
            <div className="card-footer">
              <span className="card-cta">View Leaderboard →</span>
            </div>
          </div>

          {/* Coin Book Card */}
          <div className="action-card coinbook-card" onClick={() => navigate('/coin-book')}>
            <div className="card-icon">🪙</div>
            <h3 className="card-title">Collect Coins</h3>
            <p className="card-description">
              Earn achievements and unlock exclusive flavor coins as you rank
            </p>
            <div className="card-footer">
              <span className="card-cta">View Coin Book →</span>
            </div>
          </div>
        </div>
      </section>

      {/* Transition */}
      <div className="section-transition">
        <div className="transition-line"></div>
      </div>

      {/* Next Unlock Widget */}
      {isAuthenticated && nextUnlock && (
        <section className="next-unlock-section">
          <div className="unlock-container">
            <div className="unlock-header">
              <h2 className="unlock-title">Next Unlock</h2>
              <p className="unlock-subtitle">Keep ranking to unlock your next achievement</p>
            </div>
            <div className="unlock-card">
              <div className="unlock-icon">{nextUnlock.icon || '🔒'}</div>
              <div className="unlock-info">
                <h3 className="unlock-name">{nextUnlock.name}</h3>
                <p className="unlock-description">{nextUnlock.description}</p>
                <div className="unlock-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${(nextUnlock.current / nextUnlock.required) * 100}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">
                    {nextUnlock.current} / {nextUnlock.required}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Achievements */}
      {isAuthenticated && recentAchievements.length > 0 && (
        <>
          <div className="section-transition">
            <div className="transition-line"></div>
          </div>

          <section className="recent-achievements-section">
            <div className="section-header">
              <h2 className="section-title">Recent Achievements</h2>
              <p className="section-subtitle">Latest coins earned by the community</p>
            </div>

            <div className="achievements-grid">
              {recentAchievements.map((achievement, index) => {
                const isImageIcon = achievement.achievementIcon?.startsWith('/') || achievement.achievementIcon?.startsWith('http');
                return (
                  <div key={`${achievement.userId}-${achievement.achievementName}-${index}`} className="achievement-card">
                    <div className={`achievement-icon ${achievement.achievementTier || 'bronze'}`}>
                      {isImageIcon ? (
                        <img src={achievement.achievementIcon} alt="Achievement" className="achievement-icon-img" />
                      ) : (
                        achievement.achievementIcon || '🏅'
                      )}
                    </div>
                    <div className="achievement-details">
                      <h4 className="achievement-name">{achievement.achievementName}</h4>
                      <p className="achievement-earned-by">
                        Earned by <span className="user-name">{achievement.userName}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Featured Drop / CTA Section */}
      <section className="featured-drop-section">
        <div className="featured-container">
          <div className="featured-content">
            <span className="featured-label">New to Ranking?</span>
            <h2 className="featured-title">Join the Flavor Revolution</h2>
            <p className="featured-text">
              Share your rankings, discover new flavors, and compete for the top spot. 
              Every ranking helps the community find their perfect jerky.
            </p>
            <button className="featured-cta" onClick={() => navigate('/rank')}>
              <span>Start Your Journey</span>
              <span className="cta-arrow">→</span>
            </button>
          </div>
          <div className="featured-visual">
            <div className="visual-card card-1">
              <span className="visual-icon">🥇</span>
              <span className="visual-text">Top Rankings</span>
            </div>
            <div className="visual-card card-2">
              <span className="visual-icon">🪙</span>
              <span className="visual-text">Collect Coins</span>
            </div>
            <div className="visual-card card-3">
              <span className="visual-icon">🏆</span>
              <span className="visual-text">Climb Leaderboard</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
