import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import './FullRankingsPage.css';

function FullRankingsPage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuthStore();
  const [selectedFilter, setSelectedFilter] = useState('All');

  usePageView('full_rankings', { profileId: userId });

  if (currentUser && String(currentUser.id) === String(userId)) {
    return <Navigate to="/rank" replace />;
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['fullRankings', userId],
    queryFn: async () => {
      const response = await fetch(`/api/profile/${userId}/rankings`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Rankings not found');
        }
        throw new Error('Failed to fetch rankings');
      }
      return response.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="full-rankings-page">
        <div className="full-rankings-loading">
          <div className="loading-spinner"></div>
          <p>Loading rankings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="full-rankings-page">
        <div className="full-rankings-error">
          <h2>Rankings Not Found</h2>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  const { user, rankings = [] } = data;

  const filters = [
    'All',
    'Heat',
    'Sweet',
    'Smoky',
    'Umami',
    'Wild',
    'Classic',
    'Recently Updated'
  ];

  const getFilteredRankings = () => {
    if (selectedFilter === 'All') {
      return rankings;
    }
    if (selectedFilter === 'Recently Updated') {
      return [...rankings].sort((a, b) => 
        new Date(b.updatedAt || b.rankedAt) - new Date(a.updatedAt || a.rankedAt)
      );
    }
    return rankings.filter(r => {
      const flavorProfile = r.metadata?.flavorProfile?.toLowerCase();
      return flavorProfile === selectedFilter.toLowerCase();
    });
  };

  const filteredRankings = getFilteredRankings();

  const getFlavorIcon = (product) => {
    return product.metadata?.flavorIcon || product.metadata?.animalIcon || '🥩';
  };

  const getCategoryLabel = (product) => {
    const profile = product.metadata?.flavorProfile;
    const icons = {
      'heat': '🔥',
      'sweet': '🍬',
      'smoky': '💨',
      'umami': '🍖',
      'wild': '🌰',
      'classic': '⚡'
    };
    if (profile) {
      const icon = icons[profile.toLowerCase()] || '';
      return `${icon} ${profile}`.trim();
    }
    return '🥩 Savory';
  };

  return (
    <div className="full-rankings-page">
      <div className="rankings-container">
        <div className="page-header">
          <h1 className="page-title">{user.firstName || user.displayName}'S FULL RANKINGS</h1>
          <p className="page-subtitle">{rankings.length} Flavors Ranked</p>
        </div>

        <div className="filter-bar">
          <div className="filters">
            {filters.map(filter => (
              <button
                key={filter}
                className={`filter-pill ${selectedFilter === filter ? 'active' : ''}`}
                onClick={() => setSelectedFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="ranking-list">
          {filteredRankings.map((ranking, index) => {
            const isTop10 = ranking.rank <= 10;
            
            return (
              <div 
                key={ranking.productId} 
                className={`rank-row ${isTop10 ? 'top-10' : ''}`}
              >
                <div className="rank-number">#{ranking.rank}</div>
                
                <div className="flavor-identity">
                  <div className="flavor-coin-small">
                    {getFlavorIcon(ranking.product)}
                  </div>
                  <div className="flavor-info">
                    <div className="flavor-name">{ranking.product.title}</div>
                    <span className="category-pill">
                      {getCategoryLabel(ranking.product)}
                    </span>
                  </div>
                </div>

                <div className="meta-indicators">
                  {isTop10 && index === 0 && <span className="badge">Top 1%</span>}
                  {isTop10 && index < 5 && index > 0 && <span className="badge">Top 5%</span>}
                  {isTop10 && index >= 5 && <span className="badge">Top 10%</span>}
                </div>
              </div>
            );
          })}
        </div>

        {filteredRankings.length === 0 && (
          <div className="end-card">
            <div className="end-title">No Rankings Found</div>
            <div className="end-text">
              {selectedFilter !== 'All' 
                ? `No rankings in the ${selectedFilter} category` 
                : 'This user hasn\'t ranked any flavors yet'}
            </div>
          </div>
        )}

        {filteredRankings.length > 0 && (
          <div className="end-card">
            <div className="end-title">End of List</div>
            <div className="end-text">
              You've reached all {filteredRankings.length} rankings.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FullRankingsPage;
