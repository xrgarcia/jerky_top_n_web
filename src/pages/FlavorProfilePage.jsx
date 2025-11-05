import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import './FlavorProfilePage.css';

const flavorInfo = {
  'sweet': { display: 'Sweet', icon: '🍬', description: 'Sweet and sugary flavors like maple, honey, and brown sugar' },
  'spicy': { display: 'Spicy', icon: '🌶️', description: 'Hot and spicy flavors like jalapeño, habanero, and sriracha' },
  'savory': { display: 'Savory', icon: '🥩', description: 'Classic savory flavors like original, traditional, and au jus' },
  'smoky': { display: 'Smoky', icon: '🔥', description: 'Rich smoky flavors like BBQ, hickory, and mesquite' },
  'peppery': { display: 'Peppery', icon: '🌿', description: 'Peppery flavors like black pepper and cracked pepper' },
  'garlic': { display: 'Garlic/Herb', icon: '🧄', description: 'Garlic and herb flavors like rosemary' },
  'tangy': { display: 'Tangy', icon: '🍋', description: 'Tangy and citrus flavors like lime, lemon, and vinegar' },
  'exotic': { display: 'Exotic', icon: '🌏', description: 'International and exotic flavors like Korean, Thai, and Jamaican' }
};

function FlavorProfilePage() {
  const { flavorId: rawFlavorId } = useParams();
  const [animalFilter, setAnimalFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const flavorId = rawFlavorId?.toLowerCase().trim();

  const flavor = flavorInfo[flavorId] || {
    display: flavorId?.charAt(0).toUpperCase() + flavorId?.slice(1),
    icon: '🥩',
    description: `Explore ${flavorId} flavored jerky products`
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['flavor-products', flavorId],
    queryFn: async () => {
      const response = await api.get(`/products?flavor=${encodeURIComponent(flavorId)}&limit=200`);
      return response;
    },
    enabled: !!flavorId
  });

  const products = data?.products || [];

  const animalTypes = [...new Set(products.map(p => p.animalType).filter(Boolean))].sort();

  const filteredProducts = products.filter(product => {
    const matchesAnimal = animalFilter === 'all' || product.animalType === animalFilter;
    const matchesSearch = searchQuery.trim() === '' || 
      product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.vendor?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesAnimal && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flavor-profile-page">
        <div className="flavor-profile-container">
          <div className="loading">Loading flavor profile...</div>
        </div>
      </div>
    );
  }

  if (error || !flavorId) {
    return (
      <div className="flavor-profile-page">
        <div className="flavor-profile-container">
          <div className="error">Failed to load flavor profile</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flavor-profile-page">
      <div className="flavor-profile-container">
        <div className="flavor-header">
          <div className="flavor-icon">{flavor.icon}</div>
          <h1 className="flavor-title">{flavor.display} Flavors</h1>
          <p className="flavor-description">{flavor.description}</p>
          <div className="flavor-stats">
            <div className="flavor-stat">
              <div className="flavor-stat-value">{products.length}</div>
              <div className="flavor-stat-label">Total Products</div>
            </div>
            <div className="flavor-stat">
              <div className="flavor-stat-value">{filteredProducts.length}</div>
              <div className="flavor-stat-label">Filtered Results</div>
            </div>
          </div>
        </div>

        <div className="flavor-products">
          <div className="flavor-products-header">
            <h2>🥩 All {flavor.display} Products</h2>
          </div>

          {products.length > 0 ? (
            <>
              <div className="flavor-products-controls">
                <div className="animal-filters">
                  <button 
                    className={`filter-btn ${animalFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setAnimalFilter('all')}
                  >
                    All
                  </button>
                  {animalTypes.map(type => (
                    <button
                      key={type}
                      className={`filter-btn ${animalFilter === type ? 'active' : ''}`}
                      onClick={() => setAnimalFilter(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  className="flavor-search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flavor-products-grid">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <Link 
                      key={product.id} 
                      to={`/products/${product.id}`}
                      className="flavor-product-card"
                    >
                      {product.image && (
                        <img 
                          src={product.image} 
                          alt={product.title} 
                          className="flavor-product-image"
                        />
                      )}
                      <div className="flavor-product-details">
                        <div className="flavor-product-title">{product.title}</div>
                        <div className="flavor-product-meta">
                          {product.vendor && <span className="flavor-product-vendor">{product.vendor}</span>}
                          {product.animalType && <span className="flavor-product-animal">• {product.animalType}</span>}
                        </div>
                        {product.stats && (
                          <div className="flavor-product-stats">
                            <span>{product.stats.rankCount || 0} rankings</span>
                            {product.stats.avgPosition && (
                              <span>Avg: #{product.stats.avgPosition.toFixed(1)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="no-results">No products match your filters</div>
                )}
              </div>
            </>
          ) : (
            <div className="no-products">
              <p>No products found with this flavor profile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FlavorProfilePage;
