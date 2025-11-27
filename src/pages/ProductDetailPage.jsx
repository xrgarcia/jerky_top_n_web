import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  useProductDetailEnhanced,
  useProductDistribution,
  useProductTopFans,
  useProductOppositeProfiles
} from '../hooks/useProducts';
import { usePageView } from '../hooks/usePageView';
import { useAuthStore } from '../store/authStore';
import Container from '../components/common/Container';
import TierDistribution from '../components/product/TierDistribution';
import TopFlavorFans from '../components/product/TopFlavorFans';
import OppositeTasteProfiles from '../components/product/OppositeTasteProfiles';
import './ProductDetailPage.css';

const flavorIcons = {
  'sweet': '🍬',
  'spicy': '🌶️',
  'savory': '🥩',
  'smoky': '🔥',
  'peppery': '🌿',
  'garlic': '🧄',
  'tangy': '🍋',
  'exotic': '🌏'
};

const categoryTags = {
  'spicy': { icon: '🔥', label: 'HEAT' },
  'smoky': { icon: '🔥', label: 'SMOKY HEAT' },
  'sweet': { icon: '🍬', label: 'SWEET' },
  'tangy': { icon: '🍋', label: 'TANGY' },
  'savory': { icon: '🥩', label: 'SAVORY' },
  'peppery': { icon: '🌿', label: 'PEPPERY' },
  'garlic': { icon: '🧄', label: 'GARLIC' },
  'exotic': { icon: '🌏', label: 'EXOTIC' }
};

function getRankingBadgeText(rank, totalFlavors) {
  if (!rank || !totalFlavors) return null;
  
  const p = rank / totalFlavors;
  
  if (p <= 0.05) {
    return {
      label: 'One of the Most Loved Flavors',
      sub: `Top ${rank} of ${totalFlavors} Flavors`
    };
  } else if (p <= 0.10) {
    return {
      label: 'A Fan Favorite',
      sub: `Top ${rank} of ${totalFlavors} Flavors`
    };
  } else if (p <= 0.25) {
    return {
      label: 'A Top Choice Among Rankers',
      sub: `Top ${rank} of ${totalFlavors} Flavors`
    };
  } else if (p <= 0.50) {
    return {
      label: 'Well-Liked by the Community',
      sub: 'Mid-Tier Favorite'
    };
  } else if (p <= 0.75) {
    return {
      label: 'A Flavor With a Loyal Following',
      sub: 'For Specific Taste Profiles'
    };
  } else {
    return {
      label: 'A Bold Pick for Adventurous Taste Buds',
      sub: 'Community Reaction: Mixed'
    };
  }
}

function ProductDetailPage() {
  const { id: productId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const { data: product, isLoading, error } = useProductDetailEnhanced(productId);
  const { data: distributionData } = useProductDistribution(productId);
  const { data: topFansData } = useProductTopFans(productId, 8);
  const { data: oppositeData } = useProductOppositeProfiles(productId, 8);
  
  usePageView('product_detail', { productId, productTitle: product?.title });

  if (isLoading) {
    return (
      <div className="product-detail-page page-shell">
        <Container size="standard">
          <div className="product-detail-loading">
            <div className="loading-spinner"></div>
            <p>Loading flavor details...</p>
          </div>
        </Container>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail-page page-shell">
        <Container size="standard">
          <div className="product-detail-error">
            <h2>Flavor Not Found</h2>
            <p>The flavor you're looking for doesn't exist or couldn't be loaded.</p>
            <Link to="/flavors" className="back-link">← Back to Flavor Index</Link>
          </div>
        </Container>
      </div>
    );
  }

  const handleShopifyClick = () => {
    if (product.shopifyUrl) {
      window.open(product.shopifyUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const primaryFlavor = product.primaryFlavor?.toLowerCase() || 'savory';
  const categoryTag = categoryTags[primaryFlavor] || { icon: '🥩', label: 'FLAVOR' };
  const coinIcon = flavorIcons[primaryFlavor] || '🥩';
  
  const totalRankers = distributionData?.totalRankings || product.rankingCount || 0;
  const totalFlavors = 147;
  const communityRank = distributionData?.stats?.avgRank ? Math.round(parseFloat(distributionData.stats.avgRank)) : null;
  const rankingBadge = getRankingBadgeText(communityRank, totalFlavors);

  return (
    <div className="product-detail-page page-shell">
      <Container size="standard">
        
        <div className="hero-row">
          <div className="card flavor-identity-card">
            <div className="flavor-content">
              <div className="flavor-avatar-column">
                <div className="flavor-icon-large">
                  <div className="flavor-icon-inner">{coinIcon}</div>
                </div>
                {communityRank && (
                  <div className="rank-badge">
                    #{communityRank} Community Ranked
                  </div>
                )}
              </div>
              <div className="flavor-info">
                <h1 className="flavor-name">{product.title}</h1>
                {rankingBadge && (
                  <div className="top-flavors-badge">
                    <span className="badge-label">{rankingBadge.label}</span>
                    <span className="badge-dot">•</span>
                    <span className="badge-sub">{rankingBadge.sub}</span>
                  </div>
                )}
                <div className="category-tag">
                  {categoryTag.icon} {categoryTag.label}
                </div>
                {product.userRank && (
                  <div className="your-rank">YOUR RANK: #{product.userRank}</div>
                )}
                <div className="metadata">
                  {product.shopifyCreatedAt ? (
                    <span>
                      Released {new Date(product.shopifyCreatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  ) : product.vendor && (
                    <span>{product.vendor}</span>
                  )}
                  {product.animalType && <span> • {product.animalType}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <TierDistribution distribution={distributionData} />
          </div>
        </div>

        {product.shopifyUrl && (
          <button onClick={handleShopifyClick} className="buy-cta">
            <div className="buy-cta-content">
              <div className="buy-cta-label">Want to rank this flavor?</div>
              <div className="buy-cta-title">Try {product.title} on Jerky.com</div>
            </div>
            <div className="buy-cta-button">
              Shop This Flavor <span>→</span>
            </div>
          </button>
        )}

        <TopFlavorFans fans={topFansData?.fans} />

        <OppositeTasteProfiles profiles={oppositeData?.profiles} />

      </Container>
    </div>
  );
}

export default ProductDetailPage;
