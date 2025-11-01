import { useState } from 'react';
import './SearchProductsPanel.css';

export function SearchProductsPanel({ products, availableCount, loading, searchTerm, onSearch, onRankProduct }) {
  const [selectedProduct, setSelectedProduct] = useState(null);

  const handleRankClick = (product) => {
    onRankProduct(product);
  };

  const handleDragStart = (product, e) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'product', product }));
  };

  return (
    <div className="search-products-panel">
      <div className="search-header">
        <h3>Available Products</h3>
        <div className="available-count">{availableCount} available to rank</div>
      </div>

      <div className="search-input-container">
        <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search products by name, animal, flavor..."
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="products-loading">
          <div className="loading-spinner"></div>
          <div>Loading products...</div>
        </div>
      ) : products.length === 0 ? (
        <div className="no-products">
          <div className="no-products-icon">🔍</div>
          <div className="no-products-text">
            {searchTerm ? 'No products match your search' : 'All products have been ranked!'}
          </div>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <div
              key={product.productId}
              className="product-card"
              draggable
              onDragStart={(e) => handleDragStart(product, e)}
            >
              <div className="product-image-container">
                <img 
                  src={product.image || '/placeholder.jpg'} 
                  alt={product.title}
                  className="product-image"
                />
              </div>
              <div className="product-details">
                <div className="product-title">{product.title}</div>
                <div className="product-vendor">{product.vendor}</div>
                {product.metadata && (
                  <div className="product-tags">
                    {product.metadata.animal && (
                      <span className="product-tag">{product.metadata.animal}</span>
                    )}
                    {product.metadata.flavor && (
                      <span className="product-tag">{product.metadata.flavor}</span>
                    )}
                  </div>
                )}
                <button
                  className="rank-product-btn"
                  onClick={() => handleRankClick(product)}
                >
                  Rank This Product
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
