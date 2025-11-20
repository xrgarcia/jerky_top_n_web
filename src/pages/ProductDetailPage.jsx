import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  useProductDetailEnhanced,
  useProductDistribution,
  useProductTopFans,
  useProductOppositeProfiles,
  useProductRelated,
  useProductInsights
} from '../hooks/useProducts';
import { usePageView } from '../hooks/usePageView';
import { useAuthStore } from '../store/authStore';
import InteractiveDistributionGraph from '../components/product/InteractiveDistributionGraph';
import InsightCards from '../components/product/InsightCards';
import TopFlavorFans from '../components/product/TopFlavorFans';
import OppositeTasteProfiles from '../components/product/OppositeTasteProfiles';
import RelatedFlavors from '../components/product/RelatedFlavors';
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

function ProductDetailPage() {
  const { id: productId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const { data: product, isLoading, error } = useProductDetailEnhanced(productId);
  const { data: distributionData } = useProductDistribution(productId);
  const { data: topFansData } = useProductTopFans(productId, 9);
  const { data: oppositeData } = useProductOppositeProfiles(productId, 9);
  const { data: relatedData } = useProductRelated(productId, 4);
  const { data: insightsData } = useProductInsights(productId);
  
  usePageView('product_detail', { productId, productTitle: product?.title });

  if (isLoading) {
    return (
      <div className="product-detail-page">
        <div className="product-detail-loading">
          <div className="loading-spinner"></div>
          <p>Loading flavor details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail-page">
        <div className="product-detail-error">
          <h2>Flavor Not Found</h2>
          <p>The flavor you're looking for doesn't exist or couldn't be loaded.</p>
          <Link to="/flavors" className="back-button">← Back to Flavors</Link>
        </div>
      </div>
    );
  }

  const handleRankClick = () => {
    navigate('/rank');
  };

  const handleShopifyClick = () => {
    if (product.shopifyUrl) {
      window.open(product.shopifyUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const primaryFlavor = product.primaryFlavor?.toLowerCase() || 'savory';
  const categoryTag = categoryTags[primaryFlavor] || { icon: '🥩', label: 'FLAVOR' };
  const coinIcon = flavorIcons[primaryFlavor] || '🥩';
  
  const avgRankDisplay = distributionData?.stats?.avgRank || product.avgRank;
  const totalRankers = distributionData?.stats?.totalRankings || product.rankingCount || 0;

  return (
    <div className="product-detail-page">
      <div className="product-detail-container">
        
        {/* Page Header Card */}
        <div className="page-header-card card">
          <div className="header-info">
            <div className="page-title-small">Flavor Ranking Distribution</div>
            <h1 className="flavor-name-large">{product.title}</h1>
            <div className="category-tag-badge">
              {categoryTag.icon} {categoryTag.label}
            </div>
            <div className="header-meta">
              <div className="meta-item">
                <span className="meta-label">Community Average</span>
                <span className="meta-value">#{avgRankDisplay ? parseFloat(avgRankDisplay).toFixed(1) : 'N/A'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Total Rankers</span>
                <span className="meta-value">{totalRankers.toLocaleString()}</span>
              </div>
              {product.userRank && (
                <div className="meta-item">
                  <span className="meta-label">Your Rank</span>
                  <span className="meta-value">#{product.userRank}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="header-actions">
            <div className="header-coin">
              <div className="header-coin-inner">{coinIcon}</div>
            </div>
            {product.shopifyUrl && (
              <button 
                onClick={handleShopifyClick}
                className="btn btn-secondary"
              >
                View on Shopify
              </button>
            )}
            {isAuthenticated && (
              <button 
                onClick={handleRankClick}
                className="btn btn-primary"
              >
                Rank This Flavor
              </button>
            )}
          </div>
        </div>

        {/* Distribution Graph */}
        <InteractiveDistributionGraph 
          distribution={distributionData}
          currentAvgRank={avgRankDisplay}
        />

        {/* Insight Cards */}
        <InsightCards insights={insightsData} />

        {/* Top Flavor Fans */}
        <TopFlavorFans fans={topFansData?.fans} />

        {/* Opposite Taste Profiles */}
        <OppositeTasteProfiles profiles={oppositeData?.profiles} />

        {/* Related Flavors */}
        <RelatedFlavors products={relatedData?.products} />

        {/* Bottom CTA */}
        <div className="bottom-cta">
          {isAuthenticated && (
            <button 
              onClick={handleRankClick}
              className="btn btn-primary"
            >
              Rank This Flavor
            </button>
          )}
          {product.shopifyUrl && (
            <button 
              onClick={handleShopifyClick}
              className="btn btn-secondary"
            >
              Go to Product Page
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
