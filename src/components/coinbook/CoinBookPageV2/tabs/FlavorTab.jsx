import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderAchievementIcon } from '../../../../utils/iconUtils';

const TIER_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'not_started', label: 'Not Started' },
  { id: 'bronze', label: 'Bronze' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold', label: 'Gold' }
];

export default function FlavorTab({ coins, progress }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  const stats = useMemo(() => {
    const discovered = coins.filter(c => c.earned).length;
    const bronze = coins.filter(c => c.currentTier === 'bronze' || c.tier === 'bronze').length;
    const silver = coins.filter(c => c.currentTier === 'silver' || c.tier === 'silver').length;
    const gold = coins.filter(c => c.currentTier === 'gold' || c.tier === 'gold').length;
    const total = coins.length;
    const percentage = total > 0 ? Math.round((discovered / total) * 100) : 0;
    
    return { discovered, bronze, silver, gold, total, percentage };
  }, [coins]);

  const getTierStatus = (coin) => {
    if (!coin.earned) return 'not_started';
    const tier = coin.currentTier || coin.tier;
    if (tier === 'gold' || tier === 'platinum' || tier === 'diamond') return 'gold';
    if (tier === 'silver') return 'silver';
    if (tier === 'bronze') return 'bronze';
    return 'bronze';
  };

  const filteredCoins = useMemo(() => {
    if (activeFilter === 'all') return coins;
    return coins.filter(coin => getTierStatus(coin) === activeFilter);
  }, [coins, activeFilter]);

  const groupedByCategory = useMemo(() => {
    const groups = {};
    filteredCoins.forEach(coin => {
      const category = coin.proteinCategory || coin.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(coin);
    });
    return groups;
  }, [filteredCoins]);

  const handleCoinClick = (coin) => {
    navigate(`/coinbook/${coin.id}`);
  };

  if (coins.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🪙</div>
        <p className="empty-state-text">No flavor coins available yet.</p>
      </div>
    );
  }

  return (
    <>
      <header className="chapter-header">
        <h2>Flavors</h2>
        <p>Browse every flavor you've discovered and track its coin progress.</p>
      </header>

      <div className="stats-summary">
        <div className="stat-item">
          <div className="stat-number">{stats.discovered}</div>
          <div className="stat-label">Discovered</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.bronze}</div>
          <div className="stat-label">Bronze</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.silver}</div>
          <div className="stat-label">Silver</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.gold}</div>
          <div className="stat-label">Gold</div>
        </div>
      </div>

      <div className="completion-bar-container">
        <div className="completion-bar-header">
          <span className="completion-label">Overall Completion</span>
          <span className="completion-percentage">{stats.percentage}% ({stats.discovered}/{stats.total})</span>
        </div>
        <div className="completion-bar">
          <div 
            className="completion-fill" 
            style={{ width: `${stats.percentage}%` }}
          ></div>
        </div>
      </div>

      <div className="status-legend">
        <div className="legend-item">
          <span className="legend-dot not-started"></span>
          <span>Not Started</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot ranked"></span>
          <span>Ranked</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot rated"></span>
          <span>Rated</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot reviewed"></span>
          <span>Reviewed</span>
        </div>
      </div>

      <div className="filter-bar">
        {TIER_FILTERS.map(filter => (
          <button
            key={filter.id}
            className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {Object.entries(groupedByCategory).map(([category, categoryCoins]) => (
        <div key={category}>
          <div className="section-header">
            <h3 className="section-title">{category}</h3>
            <span className="section-count">{categoryCoins.length} flavors</span>
          </div>
          <div className="flavors-grid">
            {categoryCoins.map(coin => {
              const tierStatus = getTierStatus(coin);
              return (
                <div 
                  key={coin.id} 
                  className="flavor-coin"
                  onClick={() => handleCoinClick(coin)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleCoinClick(coin)}
                >
                  <div className={`flavor-coin-circle ${tierStatus}`}>
                    {renderAchievementIcon(coin, 32)}
                  </div>
                  <span className="flavor-coin-name">{coin.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
