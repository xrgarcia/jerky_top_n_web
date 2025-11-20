import React from 'react';
import { Link } from 'react-router-dom';
import './RelatedFlavors.css';

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

function RelatedFlavors({ products }) {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="related-section card">
      <div className="card-title">Rankers of This Flavor Also Explore</div>
      
      <div className="related-grid">
        {products.map((product) => {
          const icon = flavorIcons[product.primaryFlavor?.toLowerCase()] || '🥩';
          
          return (
            <Link
              key={product.productId}
              to={`/flavors/${product.productId}`}
              className="related-item"
            >
              <div className="related-coin">{icon}</div>
              <div className="related-name">{product.title}</div>
              <div className="related-tag">{product.flavorDisplay || product.primaryFlavor}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default RelatedFlavors;
