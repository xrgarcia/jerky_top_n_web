import React from 'react';
import { Link } from 'react-router-dom';
import './ProductPodium.css';

/**
 * ProductPodium - Display user's top 5 ranked products in podium formation
 * Adapts PodiumWidget design for products instead of users
 */
function ProductPodium({ products }) {
  if (!products || products.length === 0) {
    return (
      <div className="product-podium-empty">
        <p>No rankings yet</p>
      </div>
    );
  }

  const getPositionClass = (index) => {
    switch(index) {
      case 0: return 'position-1';
      case 1: return 'position-2';
      case 2: return 'position-3';
      case 3: return 'position-4';
      case 4: return 'position-5';
      default: return '';
    }
  };

  const getPositionBadge = (position) => {
    const badges = {
      1: { text: '1st', emoji: '🥇' },
      2: { text: '2nd', emoji: '🥈' },
      3: { text: '3rd', emoji: '🥉' },
      4: { text: '4th', emoji: '' },
      5: { text: '5th', emoji: '' }
    };
    return badges[position] || badges[1];
  };

  // Only show products that exist (handle cases where user has < 5 rankings)
  const displayedProducts = products.filter(p => p.shopifyProductId);

  return (
    <div className="product-podium">
      <h2 className="product-podium-title">Flavor Hall of Fame</h2>
      <div className="product-podium-stage">
        {displayedProducts.map((product, index) => {
          const badge = getPositionBadge(product.rankPosition);
          return (
            <Link
              key={product.shopifyProductId}
              to={`/products/${product.shopifyProductId}`}
              className={`product-podium-item ${getPositionClass(index)}`}
            >
              <div className="product-glow-container">
                <div className="product-lunar-eclipse"></div>
                <div className="product-image-container">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.title}
                      className="product-podium-image"
                    />
                  ) : (
                    <div className="product-podium-placeholder">
                      {product.title?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div className="product-position-badge">
                  {badge.text}
                </div>
              </div>
              <div className="product-platform-base">
                <div className="product-platform">
                  <div className="product-info">
                    <div className="product-title">{product.title || 'Unknown Product'}</div>
                    <div className="product-rank-label">Your #{product.rankPosition}</div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default ProductPodium;
