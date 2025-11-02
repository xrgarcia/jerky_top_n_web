import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import './RankPage.css';

export default function RankPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    // Update URL params
    if (searchTerm.trim()) {
      setSearchParams({ search: searchTerm.trim() });
    } else {
      setSearchParams({});
    }

    try {
      const params = new URLSearchParams({
        excludeRanked: 'true',
        limit: '50'
      });
      
      if (searchTerm.trim()) {
        params.set('query', searchTerm.trim());
      }

      const data = await api.get(`/products/rankable?${params.toString()}`);
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    // Load products on mount (using search term from URL if present)
    handleSearch();
  }, []);

  return (
    <div className="rank-page">
      <div className="rank-container">
        <div className="rank-column ranks-column">
          <h2>Your Rankings</h2>
          <div className="sub-header">progress bar</div>
          <div className="placeholder-content">
            ranks go here
          </div>
        </div>
        
        <div className="rank-column products-column">
          <h2>Available Products</h2>
          <div className="sub-header">remaining products to rank bar</div>
          
          <div className="search-box">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="rank-search-input"
            />
            <button 
              onClick={handleSearch}
              className="search-button"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="products-display">
            {loading && (
              <div className="loading-state">Loading products...</div>
            )}

            {error && (
              <div className="error-state">
                <p>{error}</p>
                <button onClick={handleSearch} className="retry-button">
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && hasSearched && products.length === 0 && (
              <div className="empty-state">
                No products found. Try a different search term or click Search to see all available products.
              </div>
            )}

            {!loading && !error && products.length > 0 && (
              <div className="products-grid">
                {products.map(product => (
                  <div key={product.id} className="product-card">
                    <div className="product-image">
                      {product.image ? (
                        <img src={product.image} alt={product.title} />
                      ) : (
                        <div className="no-image">No Image</div>
                      )}
                    </div>
                    <div className="product-info">
                      <h3 className="product-name">{product.title}</h3>
                      {product.price && (
                        <p className="product-price">${product.price}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!hasSearched && (
              <div className="initial-state">
                <p>Search for products or click "Search" to see all available products you can rank.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
