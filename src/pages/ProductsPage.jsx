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
            className="search-input"
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
                <Link to={`/products/${product.id}`} className="product-card-link">
                  {product.image && (
                    <img src={product.image} alt={product.title} className="product-image" />
                  )}
                  <h3 className="product-title">{product.title}</h3>
                </Link>
                
                {product.primaryFlavor && (
                  <div className="product-flavor">
                    <Link 
                      to={`/flavors/${encodeURIComponent(product.primaryFlavor.toLowerCase())}`}
                      className="flavor-badge"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {product.primaryFlavor}
                    </Link>
                  </div>
                )}
                
                {product.tags && (
                  <div className="product-tags">
                    {product.tags.split(',').slice(0, 3).map((tag, i) => (
                      <span key={i} className="product-tag">{tag.trim()}</span>
                    ))}
                  </div>
                )}
                {product.rankingCount !== undefined && (
                  <div className="product-stats">
                    <span>Avg Position: {product.avgRank?.toFixed(1) || 'N/A'}</span>
                    <span>{product.rankingCount || 0} rankings</span>
                  </div>
                )}
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
