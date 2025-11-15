import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProductDetailEnhanced } from '../hooks/useProducts';
import { usePageView } from '../hooks/usePageView';
import { useAuthStore } from '../store/authStore';
import './ProductDetailPage.css';

function RankingDistributionChart({ distribution, avgRank }) {
  if (!distribution || distribution.length === 0) {
    return (
      <div className="distribution-empty">
        <p>No rankings yet. Be the first to rank this flavor!</p>
      </div>
    );
  }

  const maxCount = Math.max(...distribution.map(d => d.count));

  return (
    <div className="distribution-chart">
      <div className="chart-bars">
        {distribution.map(({ rank, count }) => {
          const percentage = (count / maxCount) * 100;
          const isAverage = avgRank && Math.abs(rank - avgRank) < 0.5;
          
          return (
            <div key={rank} className="chart-bar-container">
              <div 
                className={`chart-bar ${isAverage ? 'is-average' : ''}`}
                style={{ height: `${percentage}%` }}
              >
                <span className="bar-count">{count}</span>
              </div>
              <div className="chart-label">#{rank}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductDetailPage() {
  const { id: productId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { data: product, isLoading, error } = useProductDetailEnhanced(productId);
  
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

  return (
    <div className="product-detail-page">
      <div className="product-detail-container">
        <Link to="/flavors" className="back-link">← Back to Flavors</Link>
        
        {/* Hero Section */}
        <section className="product-hero">
          <div className="hero-content">
            <div className="product-image-wrapper">
              {product.image && (
                <img 
                  src={product.image} 
                  alt={product.title} 
                  className="product-image"
                />
              )}
            </div>
            
            <div className="product-info">
              <h1 className="product-title">{product.title}</h1>
              
              {product.vendor && (
                <p className="product-brand">{product.vendor}</p>
              )}
              
              <div className="flavor-tags">
                {product.primaryFlavor && (
                  <Link 
                    to={`/flavors/${encodeURIComponent(product.primaryFlavor.toLowerCase())}`}
                    className="flavor-tag primary"
                  >
                    {product.flavorIcon && `${product.flavorIcon} `}
                    {product.flavorDisplay || product.primaryFlavor}
                  </Link>
                )}
                
                {product.secondaryFlavors && product.secondaryFlavors.length > 0 && (
                  product.secondaryFlavors.map((flavor, index) => (
                    <span key={index} className="flavor-tag secondary">
                      {flavor}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats-section">
          <div className="stats-grid">
            {product.userRank !== null && (
              <div className="stat-card user-rank">
                <div className="stat-icon">🏆</div>
                <div className="stat-value">#{product.userRank}</div>
                <div className="stat-label">Your Rank</div>
              </div>
            )}
            
            <div className="stat-card community-rank">
              <div className="stat-icon">⭐</div>
              <div className="stat-value">
                {product.avgRank ? `#${parseFloat(product.avgRank).toFixed(1)}` : 'N/A'}
              </div>
              <div className="stat-label">Community Average</div>
            </div>
            
            <div className="stat-card rankings-count">
              <div className="stat-icon">📊</div>
              <div className="stat-value">{product.rankingCount || 0}</div>
              <div className="stat-label">Total Rankings</div>
            </div>
          </div>
        </section>

        {/* Distribution Section */}
        <section className="distribution-section">
          <h2 className="section-title">Community Rankings</h2>
          <p className="section-subtitle">See how the community ranks this flavor</p>
          <RankingDistributionChart 
            distribution={product.rankingDistribution} 
            avgRank={product.avgRank}
          />
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          {isAuthenticated ? (
            <>
              {product.hasPurchased && product.userRank === null ? (
                <button 
                  onClick={handleRankClick}
                  className="cta-button primary"
                >
                  Rank It
                </button>
              ) : product.hasPurchased ? (
                <button 
                  onClick={handleShopifyClick}
                  className="cta-button secondary"
                >
                  Try It Again
                </button>
              ) : (
                <button 
                  onClick={handleShopifyClick}
                  className="cta-button primary"
                >
                  Discover Your New Favorite
                </button>
              )}
            </>
          ) : (
            <button 
              onClick={handleShopifyClick}
              className="cta-button primary"
            >
              Discover Your New Favorite
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

export default ProductDetailPage;
