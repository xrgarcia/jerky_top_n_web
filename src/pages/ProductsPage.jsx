import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import './ProductsPage.css';

function ProductsPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [animal, setAnimal] = useState('');

  const { data, isLoading, error } = useProducts({ search, sort, animal });

  const products = data?.products || [];
  const animals = ['Beef', 'Turkey', 'Pork', 'Chicken', 'Elk', 'Bison', 'Venison', 'Alligator', 'Kangaroo', 'Ostrich', 'Salmon'];

  return (
    <div className="products-page">
      <div className="products-container">
        <div className="products-header">
          <h1>Flavors</h1>
          <p>Browse and explore our jerky flavors</p>
        </div>

        <div className="products-filters">
          <input
            type="text"
            placeholder="Search flavors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="page-search-input"
          />

          <select value={sort} onChange={(e) => setSort(e.target.value)} className="sort-select">
            <option value="name">Sort by Name</option>
            <option value="popularity">Sort by Popularity</option>
            <option value="rating">Sort by Rating</option>
          </select>

          <select value={animal} onChange={(e) => setAnimal(e.target.value)} className="filter-select">
            <option value="">All Animals</option>
            {animals.map(a => (
              <option key={a} value={a.toLowerCase()}>{a}</option>
            ))}
          </select>
        </div>

        {isLoading && <div className="loading">Loading flavors...</div>}
        {error && <div className="error">Failed to load flavors</div>}

        {!isLoading && !error && (
          <div className="products-grid">
            {products.map(product => (
              <div key={product.id} className="product-card">
                {product.vendor && (
                  <div className="product-brand">{product.vendor}</div>
                )}
                
                <Link to={`/products/${product.id}`} className="product-card-link">
                  {product.image && (
                    <img src={product.image} alt={product.title} className="product-image" />
                  )}
                  <h3 className="product-title">{product.title}</h3>
                </Link>
                
                {product.price && (
                  <div className="product-price">${product.price}</div>
                )}
                
                <div className="product-badges">
                  {product.primaryFlavor && (
                    <Link 
                      to={`/flavors/${encodeURIComponent(product.primaryFlavor.toLowerCase())}`}
                      className="flavor-badge"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {product.primaryFlavor}
                    </Link>
                  )}
                  {product.animalDisplay && (
                    <span className="animal-badge">
                      {product.animalIcon && `${product.animalIcon} `}{product.animalDisplay}
                    </span>
                  )}
                </div>
                
                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e5e5e5',
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #f5f3ed 0%, #faf9f5 100%)',
                    color: '#5a5046',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    border: '1px solid #e8e6df',
                    whiteSpace: 'nowrap'
                  }}>
                    📊 Avg: {product.avgRank?.toFixed(1) || 'N/A'}
                  </span>
                  <span style={{
                    background: 'linear-gradient(135deg, #e8f4ea 0%, #f0f8f2 100%)',
                    color: '#2d5f3d',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    border: '1px solid #c4e0cc',
                    whiteSpace: 'nowrap'
                  }}>
                    🏆 {product.rankingCount || 0} ranking{product.rankingCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && products.length === 0 && (
          <div className="no-results">No flavors found</div>
        )}
      </div>
    </div>
  );
}

export default ProductsPage;
