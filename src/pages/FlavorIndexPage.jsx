import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { usePageView } from '../hooks/usePageView';
import LeaderboardRow from '../components/flavorindex/LeaderboardRow';
import CategorySummaryGrid from '../components/flavorindex/CategorySummaryGrid';
import Container from '../components/common/Container';
import '../styles/hero-headers.css';
import './FlavorIndexPage.css';

function FlavorIndexPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('rank');
  const [animal, setAnimal] = useState('');

  const { data, isLoading, error } = useProducts({ search, sort, animal });
  
  // Track page view for user guidance and classification
  usePageView('products');

  const products = data?.products || [];
  const topByCategory = data?.topByCategory || {};
  const total = data?.total || 0;
  const animals = ['Beef', 'Turkey', 'Pork', 'Chicken', 'Elk', 'Bison', 'Venison', 'Alligator', 'Kangaroo', 'Ostrich', 'Salmon'];

  const sortedProducts = useMemo(() => {
    if (!products.length) return [];

    let sorted = [...products];
    
    if (sort === 'rank') {
      sorted.sort((a, b) => {
        if (a.communityRank === null && b.communityRank === null) return 0;
        if (a.communityRank === null) return 1;
        if (b.communityRank === null) return -1;
        return a.communityRank - b.communityRank;
      });
    } else if (sort === 'name') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }

    return sorted;
  }, [products, sort]);

  return (
    <div className="flavor-index-page">
      <Container size="standard">
        {/* Hero Header */}
        <div className="flavor-index-hero">
          <div className="hero-intro">
            <h1 className="hero-title">Flavor Index</h1>
            <p className="hero-subtitle">Every flavor, ranked by the community.</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flavor-index-filters">
          <div className="filter-group">
            <div className="filter-label">Category</div>
            <select value={animal} onChange={(e) => setAnimal(e.target.value)} className="filter-dropdown">
              <option value="">All Flavors</option>
              {animals.map(a => (
                <option key={a} value={a.toLowerCase()}>{a}</option>
              ))}
            </select>
          </div>

          <div className="filter-divider"></div>

          <div className="filter-group">
            <div className="filter-label">Sort By</div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="filter-dropdown">
              <option value="rank">Community Rank</option>
              <option value="name">Title</option>
            </select>
          </div>

          <input
            type="text"
            className="search-field"
            placeholder="Search flavors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && <div className="loading-message">Loading Flavor Index...</div>}
        {error && <div className="error-message">Failed to load Flavor Index</div>}

        {!isLoading && !error && (
          <>
            {/* Leaderboard */}
            <div className="leaderboard">
              {sortedProducts.map(product => (
                <LeaderboardRow key={product.id} product={product} />
              ))}
            </div>

            {sortedProducts.length === 0 && (
              <div className="no-results-message">No flavors found matching your criteria</div>
            )}

            {/* Category Summaries */}
            {Object.keys(topByCategory).length > 0 && (
              <CategorySummaryGrid topByCategory={topByCategory} />
            )}
          </>
        )}
      </Container>
    </div>
  );
}

export default FlavorIndexPage;
