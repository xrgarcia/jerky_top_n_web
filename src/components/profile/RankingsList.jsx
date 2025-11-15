import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import './RankingsList.css';

/**
 * RankingsList - Filterable/sortable table showing all user rankings
 * Displays rankings with purchase dates and product info
 */
function RankingsList({ rankings }) {
  const [sortBy, setSortBy] = useState('rank'); // rank, flavor, date
  const [filterFlavor, setFilterFlavor] = useState('all');

  if (!rankings || rankings.length === 0) {
    return (
      <div className="rankings-list-empty">
        <p>No rankings yet</p>
      </div>
    );
  }

  // Get unique flavors for filter
  const uniqueFlavors = useMemo(() => {
    const flavors = new Set();
    rankings.forEach(r => {
      if (r.primaryFlavor) {
        flavors.add(r.primaryFlavor);
      }
    });
    return Array.from(flavors).sort();
  }, [rankings]);

  // Filter and sort rankings
  const filteredRankings = useMemo(() => {
    let result = [...rankings];

    // Filter by flavor
    if (filterFlavor !== 'all') {
      result = result.filter(r => r.primaryFlavor === filterFlavor);
    }

    // Sort
    if (sortBy === 'rank') {
      result.sort((a, b) => a.rankPosition - b.rankPosition);
    } else if (sortBy === 'flavor') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortBy === 'date') {
      result.sort((a, b) => new Date(b.rankedAt) - new Date(a.rankedAt));
    }

    return result;
  }, [rankings, sortBy, filterFlavor]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Not purchased';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="rankings-list-section">
      <div className="rankings-list-header">
        <h2 className="rankings-list-title">All Rankings</h2>
        
        <div className="rankings-controls">
          <div className="control-group">
            <label htmlFor="sort-select">Sort by:</label>
            <select 
              id="sort-select"
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="rankings-select"
            >
              <option value="rank">Rank Position</option>
              <option value="flavor">Flavor Name</option>
              <option value="date">Date Ranked</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="flavor-filter">Filter:</label>
            <select 
              id="flavor-filter"
              value={filterFlavor} 
              onChange={(e) => setFilterFlavor(e.target.value)}
              className="rankings-select"
            >
              <option value="all">All Flavors</option>
              {uniqueFlavors.map(flavor => (
                <option key={flavor} value={flavor}>
                  {flavor.charAt(0).toUpperCase() + flavor.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rankings-grid">
        {filteredRankings.map((ranking) => (
          <Link
            key={ranking.shopifyProductId}
            to={`/flavors/${ranking.shopifyProductId}`}
            className="ranking-card"
          >
            <div className="ranking-position">
              #{ranking.rankPosition}
            </div>

            <div className="ranking-product-image">
              {ranking.imageUrl ? (
                <img src={ranking.imageUrl} alt={ranking.title} />
              ) : (
                <div className="ranking-image-placeholder">
                  {ranking.title?.charAt(0) || '?'}
                </div>
              )}
            </div>

            <div className="ranking-details">
              <h3 className="ranking-product-title">{ranking.title || 'Unknown Product'}</h3>
              {ranking.vendor && (
                <div className="ranking-vendor">{ranking.vendor}</div>
              )}
              <div className="ranking-meta">
                <div className="ranking-meta-item">
                  <span className="meta-label">Ranked:</span>
                  <span className="meta-value">{formatDate(ranking.rankedAt)}</span>
                </div>
                {ranking.purchaseDate && (
                  <div className="ranking-meta-item">
                    <span className="meta-label">Purchased:</span>
                    <span className="meta-value">{formatDate(ranking.purchaseDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredRankings.length === 0 && (
        <div className="rankings-no-results">
          <p>No rankings match the current filter</p>
        </div>
      )}
    </div>
  );
}

export default RankingsList;
