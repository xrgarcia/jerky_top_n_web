import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CategorySummaryGrid.css';

function CategorySummaryGrid({ topByCategory }) {
  const navigate = useNavigate();

  if (!topByCategory || Object.keys(topByCategory).length === 0) {
    return null;
  }

  const categories = Object.entries(topByCategory);

  return (
    <div className="category-summaries">
      <h2 className="section-title">Top by Category</h2>
      <div className="category-grid">
        {categories.map(([categoryType, product]) => (
          <div 
            key={categoryType} 
            className="category-card"
            onClick={() => navigate(`/flavors/${product.id}`)}
          >
            <div className="category-label">Top {product.animalDisplay || categoryType}</div>
            <div className="category-flavor">
              <div className="category-coin">
                {product.image ? (
                  <img src={product.image} alt={product.title} className="category-coin-image" />
                ) : (
                  <span className="category-coin-placeholder">{product.animalIcon || '🥓'}</span>
                )}
              </div>
              <div className="category-flavor-name">{product.title}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategorySummaryGrid;
