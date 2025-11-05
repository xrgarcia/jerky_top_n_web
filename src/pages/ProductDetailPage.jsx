import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProductDetail } from '../hooks/useProducts';
import './ProductDetailPage.css';

function ProductDetailPage() {
  const { productId } = useParams();
  const { data: product, isLoading, error } = useProductDetail(productId);

  if (isLoading) {
    return (
      <div className="product-detail-page">
        <div className="product-detail-container">
          <div className="loading">Loading product details...</div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail-page">
        <div className="product-detail-container">
          <div className="error">Failed to load product details</div>
          <Link to="/products" className="back-link">← Back to Flavors</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <div className="product-detail-container">
        <Link to="/products" className="back-link">← Back to Flavors</Link>
        
        <div className="product-detail-header">
          <div className="product-detail-image-wrapper">
            {product.image && (
              <img 
                src={product.image} 
                alt={product.title} 
                className="product-detail-image"
              />
            )}
          </div>
          
          <div className="product-detail-info">
            <h1 className="product-detail-title">{product.title}</h1>
            
            {product.vendor && (
              <div className="product-detail-vendor">
                <span className="label">Brand:</span> {product.vendor}
              </div>
            )}
            
            {product.animalType && (
              <div className="product-detail-animal">
                <span className="label">Animal Type:</span> 
                <span className="animal-badge">
                  {product.animalIcon} {product.animalDisplay || product.animalType}
                </span>
              </div>
            )}
            
            {product.primaryFlavor && (
              <div className="product-detail-flavor">
                <span className="label">Primary Flavor:</span>
                <Link 
                  to={`/flavors/${encodeURIComponent(product.primaryFlavor.toLowerCase())}`}
                  className="flavor-link"
                >
                  {product.flavorIcon} {product.flavorDisplay || product.primaryFlavor}
                </Link>
              </div>
            )}
            
            {product.secondaryFlavors && product.secondaryFlavors.length > 0 && (
              <div className="product-detail-secondary-flavors">
                <span className="label">Secondary Flavors:</span>
                <div className="secondary-flavors-list">
                  {product.secondaryFlavors.map((flavor, index) => (
                    <span key={index} className="secondary-flavor-tag">
                      {flavor}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {product.price && (
              <div className="product-detail-price">
                <span className="current-price">${parseFloat(product.price).toFixed(2)}</span>
                {product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price) && (
                  <span className="compare-price">${parseFloat(product.compareAtPrice).toFixed(2)}</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="product-detail-stats">
          <h2>Ranking Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{product.rankingCount || 0}</div>
              <div className="stat-label">Total Rankings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{product.uniqueRankers || 0}</div>
              <div className="stat-label">Unique Rankers</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">#{product.avgRank?.toFixed(1) || 'N/A'}</div>
              <div className="stat-label">Average Position</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">#{product.bestRank || 'N/A'}</div>
              <div className="stat-label">Best Position</div>
            </div>
          </div>
        </div>
        
        {product.tags && (
          <div className="product-detail-tags">
            <h3>Tags</h3>
            <div className="tags-list">
              {product.tags.split(',').map((tag, i) => (
                <span key={i} className="tag">{tag.trim()}</span>
              ))}
            </div>
          </div>
        )}
        
        {product.bodyHtml && (
          <div className="product-detail-description">
            <h3>Description</h3>
            <div dangerouslySetInnerHTML={{ __html: product.bodyHtml }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductDetailPage;
