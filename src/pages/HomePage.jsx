import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeroStats, useHomeStats, useProgress, useUserGuidance } from '../hooks/useGamification';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import { useRanking } from '../hooks/useRanking';
import { useProfile } from '../hooks/useProfile';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { data: heroStats, isLoading: heroLoading } = useHeroStats();
  const { data: homeStats, isLoading: homeLoading } = useHomeStats();
  const { data: progress, isLoading: progressLoading } = useProgress();
  const { data: guidance, isLoading: guidanceLoading } = useUserGuidance('general');
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { rankedProducts, isLoading: rankingsLoading } = useRanking();
  
  // Track page view for user guidance and classification
  usePageView('general');

  const isLoading = heroLoading || homeLoading || progressLoading || guidanceLoading || profileLoading;

  // Get user's progress data
  const totalRankings = progress?.progress?.totalRankings || 0;
  const totalPoints = progress?.progress?.totalPoints || 0;
  const achievementsEarned = progress?.progress?.achievementsEarned || 0;
  const uniqueProducts = progress?.progress?.uniqueProducts || 0;
  const purchasedProductCount = progress?.progress?.purchasedProductCount || 0;
  const totalCatalog = progress?.progress?.totalCatalog || 164;
  
  // Calculate progress percentages relative to total catalog
  // - rankablePercent: shows what user CAN rank (their purchases) as % of catalog
  // - rankedPercent: shows what user HAS ranked as % of catalog
  const rankablePercent = totalCatalog > 0 
    ? Math.min(100, (purchasedProductCount / totalCatalog) * 100)
    : 0;
  const rankedPercent = totalCatalog > 0 
    ? Math.min(100, (uniqueProducts / totalCatalog) * 100) 
    : 0;
  
  // Get journey stage from personalized guidance system
  const journeyStage = guidance?.classification?.journeyStage || 'new_user';
  
  // Map journey stages to display titles for badge
  const journeyTitleMap = {
    'new_user': 'TASTE EXPLORER',
    'active_user': 'FLAVOR ENTHUSIAST',
    'power_user': 'FLAVOR MASTER',
    'dormant': 'RETURNING RANKER'
  };
  const userTitle = journeyTitleMap[journeyStage] || 'TASTE EXPLORER';
  
  // Get flavor community from guidance (now includes formatted dominantCommunity)
  const primaryCommunity = guidance?.dominantCommunity || null;
  const flavorJourney = primaryCommunity?.description || null;
  
  // Get Shopify account creation year from guidance (includes user data)
  const shopifyCreatedAt = guidance?.shopify_created_at;
  const memberSinceYear = shopifyCreatedAt 
    ? new Date(shopifyCreatedAt).getFullYear() 
    : 2023;

  // Get user's top 3 personal ranked products
  const myTop3 = isAuthenticated && rankedProducts ? rankedProducts.slice(0, 3) : [];

  // Get next unlock achievement
  const nextMilestone = progress?.progress?.nextMilestones?.[0] || null;

  return (
    <div className="home-page-v2">
      {/* Profile Hero Section */}
      <section className="profile-hero">
        <div className="hero-container">
          <div className="hero-left">
            {isAuthenticated ? (
              <>
                <h1 className="hero-username">
                  {user?.displayName || 'Customer'}
                  <span className="hero-title-badge">{userTitle}</span>
                </h1>
                {flavorJourney && (
                  <p className="hero-flavor-journey">{flavorJourney}</p>
                )}
                <div className="hero-collection-progress">
                  <div className="collection-bar-container">
                    <div className="collection-bar-background">
                      <div className="collection-bar-rankable" style={{ width: `${rankablePercent}%` }}></div>
                      <div className="collection-bar-ranked" style={{ width: `${rankedPercent}%` }}></div>
                    </div>
                  </div>
                  <div className="collection-stats">
                    <div className="collection-stat-item">
                      <span className="collection-stat-number">{uniqueProducts}</span>
                      <span className="collection-stat-label">Ranked</span>
                    </div>
                    <div className="collection-stat-divider">|</div>
                    <div className="collection-stat-item">
                      <span className="collection-stat-number">{totalCatalog}</span>
                      <span className="collection-stat-label">Catalog</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h1 className="hero-username">Discover Your Flavor Profile</h1>
                <p className="hero-subtitle">Join 1 rankers exploring 42 jerky products</p>
              </>
            )}
          </div>

          <div className="hero-right">
            {isAuthenticated && (
              <div className="hero-medallion">
                <div className="medallion-ring"></div>
                <div className="medallion-content">
                  <span className="medallion-label">
                    {primaryCommunity ? `${primaryCommunity.icon} ${primaryCommunity.name}` : 'Taste Tester'}
                  </span>
                  <span className="medallion-year">Since {memberSinceYear}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Top 3 Flavors */}
      {isAuthenticated && (
        <section className="top-flavors-section">
          <div className="section-header-compact">
            <h2 className="section-title-compact">Top 3 Flavors</h2>
          </div>

          <div className="top-flavors-grid">
            {/* Slot 1 */}
            <div className="flavor-slot" onClick={() => myTop3[0] ? navigate(`/products?id=${myTop3[0].productData.id}`) : navigate('/rank')}>
              <div className="slot-rank rank-1">#1</div>
              {myTop3[0] ? (
                <div className="slot-content">
                  {myTop3[0].productData.image && (
                    <img src={myTop3[0].productData.image} alt={myTop3[0].productData.title} className="slot-image" />
                  )}
                  <h3 className="slot-product-name">{myTop3[0].productData.title}</h3>
                </div>
              ) : (
                <div className="slot-placeholder">
                  <span className="placeholder-text">Add Flavor</span>
                </div>
              )}
            </div>

            {/* Slot 2 */}
            <div className="flavor-slot" onClick={() => myTop3[1] ? navigate(`/products?id=${myTop3[1].productData.id}`) : navigate('/rank')}>
              <div className="slot-rank rank-2">#2</div>
              {myTop3[1] ? (
                <div className="slot-content">
                  {myTop3[1].productData.image && (
                    <img src={myTop3[1].productData.image} alt={myTop3[1].productData.title} className="slot-image" />
                  )}
                  <h3 className="slot-product-name">{myTop3[1].productData.title}</h3>
                </div>
              ) : (
                <div className="slot-placeholder">
                  <span className="placeholder-text">Add Flavor</span>
                </div>
              )}
            </div>

            {/* Slot 3 */}
            <div className="flavor-slot" onClick={() => myTop3[2] ? navigate(`/products?id=${myTop3[2].productData.id}`) : navigate('/rank')}>
              <div className="slot-rank rank-3">#3</div>
              {myTop3[2] ? (
                <div className="slot-content">
                  {myTop3[2].productData.image && (
                    <img src={myTop3[2].productData.image} alt={myTop3[2].productData.title} className="slot-image" />
                  )}
                  <h3 className="slot-product-name">{myTop3[2].productData.title}</h3>
                </div>
              ) : (
                <div className="slot-placeholder">
                  <span className="placeholder-text">Add Flavor</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Action Cards */}
      {isAuthenticated && (
        <section className="action-cards-section">
          <div className="action-cards-grid">
            {/* Rank Flavors */}
            <div className="action-card-v2 rank-card" onClick={() => navigate('/rank')}>
              <h3 className="action-card-title">Rank<br />Flavors</h3>
              <button className="action-card-btn">Start Ranking</button>
            </div>

            {/* Coin Book */}
            <div className="action-card-v2 coinbook-card" onClick={() => navigate('/coin-book')}>
              <div className="coin-indicator"></div>
              <h3 className="action-card-title">Coin<br />Book</h3>
              <button className="action-card-btn">View Coins</button>
            </div>

            {/* Community - Coming Soon */}
            <div className="action-card-v2 community-card disabled">
              <h3 className="action-card-title">Community</h3>
              <div className="coming-soon-badge">Coming Soon</div>
            </div>
          </div>
        </section>
      )}

      {/* Next Unlock & Featured Drop */}
      {isAuthenticated && (
        <section className="bottom-widgets-section">
          <div className="bottom-widgets-grid">
            {/* Next Unlock */}
            {nextMilestone ? (
              <div className="next-unlock-widget">
                <h3 className="widget-heading">Next Unlock</h3>
                <div className="unlock-card-v2">
                  <div className="unlock-icon-circle">
                    {nextMilestone.achievementIconType === 'image' ? (
                      <img 
                        src={nextMilestone.achievementIcon} 
                        alt={nextMilestone.achievementName}
                        className="unlock-icon-img"
                      />
                    ) : (
                      <span className="unlock-icon-emoji">{nextMilestone.achievementIcon || '🎯'}</span>
                    )}
                  </div>
                  <div className="unlock-details">
                    <h4 className="unlock-name">{nextMilestone.achievementName}</h4>
                    <p className="unlock-xp-remaining">
                      {nextMilestone.actionText || `${nextMilestone.remaining} more needed`}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Featured Drop */}
            <div className="featured-drop-widget">
              <h3 className="widget-heading">Featured Drop</h3>
              <div className="featured-card-v2">
                <div className="featured-icon-circle"></div>
                <div className="featured-details">
                  <h4 className="featured-name">Mystery Flavor #47</h4>
                  <p className="featured-badge">Taste Tester Exclusive</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

export default HomePage;
