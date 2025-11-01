import React, { useState } from 'react';
import { useRankableProducts } from '../hooks/useProducts';
import { useMyRankings, useRankProduct } from '../hooks/useRankings';
import './RankPage.css';

function RankPage() {
  const [search, setSearch] = useState('');
  const { data: products, isLoading: productsLoading } = useRankableProducts({ excludeRanked: true });
  const { data: myRankings, isLoading: rankingsLoading } = useMyRankings();
  const rankProduct = useRankProduct();

  const isLoading = productsLoading || rankingsLoading;

  const filteredProducts = products?.products?.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const [rankingStatus, setRankingStatus] = useState({ message: '', type: '' });

  const handleRank = async (productId, position) => {
    setRankingStatus({ message: '', type: '' });
    try {
      await rankProduct.mutateAsync({ productId, position });
      setRankingStatus({ message: 'Product ranked successfully!', type: 'success' });
      setTimeout(() => setRankingStatus({ message: '', type: '' }), 3000);
    } catch (error) {
      setRankingStatus({ 
        message: error.message || 'Failed to rank product. Please try again.', 
        type: 'error' 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="rank-page">
        <div className="rank-container">
          <div className="loading">Loading rankable products...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rank-page">
      <div className="rank-container">
        <div className="rank-header">
          <h1>🥩 Rank Products</h1>
          <p>Rank your purchased jerky products</p>
        </div>

        <div className="current-rankings">
          <h2>Your Current Rankings</h2>
          {myRankings && myRankings.length > 0 ? (
            <div className="rankings-list">
              {myRankings.slice(0, 5).map(ranking => (
                <div key={ranking.id} className="ranking-item">
                  <span className="rank-badge">#{ranking.position}</span>
                  <span className="product-name">{ranking.product_title}</span>
                </div>
              ))}
              {myRankings.length > 5 && (
                <p className="more-rankings">...and {myRankings.length - 5} more</p>
              )}
            </div>
          ) : (
            <p className="no-rankings">No rankings yet</p>
          )}
        </div>

        <div className="search-section">
          <h2>Add New Ranking</h2>
          {rankingStatus.message && (
            <div className={`status-message ${rankingStatus.type}`}>
              {rankingStatus.message}
            </div>
          )}
          <input
            type="text"
            placeholder="Search products to rank..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="products-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              {product.image && (
                <img src={product.image} alt={product.title} className="product-image" />
              )}
              <h3 className="product-title">{product.title}</h3>
              
              <div className="rank-actions">
                <label>Rank Position:</label>
                <select 
                  onChange={(e) => {
                    const position = parseInt(e.target.value);
                    if (position > 0) {
                      handleRank(product.id, position);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  disabled={rankProduct.isPending}
                >
                  <option value="">Select position...</option>
                  {[...Array(20)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>#{i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="no-products">
            {search ? 'No products found matching your search' : 'No products available to rank'}
          </div>
        )}
      </div>
    </div>
  );
}

export default RankPage;
