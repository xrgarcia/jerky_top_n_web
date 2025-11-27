import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderAchievementIcon } from '../../../../utils/iconUtils';

const SECRET_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unlocked', label: 'Unlocked' },
  { id: 'locked', label: 'Locked' }
];

const RARITY_LEVELS = {
  common: { label: 'Common', class: 'rarity-common' },
  rare: { label: 'Rare', class: 'rarity-rare' },
  epic: { label: 'Epic', class: 'rarity-epic' },
  legendary: { label: 'Legendary', class: 'rarity-legendary' }
};

export default function SecretsTab({ coins, progress }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  const stats = useMemo(() => {
    const discovered = coins.filter(c => c.earned).length;
    const hidden = coins.filter(c => !c.earned).length;
    const total = coins.length;
    const percentage = total > 0 ? Math.round((discovered / total) * 100) : 0;
    const xp = coins.filter(c => c.earned).reduce((sum, c) => sum + (c.points || 0), 0);
    
    return { discovered, hidden, total, percentage, xp };
  }, [coins]);

  const getRarity = (coin) => {
    if (coin.rarity) return coin.rarity;
    const points = coin.points || 0;
    if (points >= 1000) return 'legendary';
    if (points >= 500) return 'epic';
    if (points >= 200) return 'rare';
    return 'common';
  };

  const categorizeSecrets = useMemo(() => {
    const groups = {};
    
    coins.forEach(coin => {
      const category = coin.category || coin.secretCategory || 'Mysteries';
      const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
      
      if (!groups[categoryLabel]) {
        groups[categoryLabel] = [];
      }
      groups[categoryLabel].push(coin);
    });
    
    return groups;
  }, [coins]);

  const getFilteredCoins = () => {
    let filtered = coins;
    
    if (activeFilter === 'unlocked') {
      filtered = coins.filter(c => c.earned);
    } else if (activeFilter === 'locked') {
      filtered = coins.filter(c => !c.earned);
    }
    
    const groups = {};
    filtered.forEach(coin => {
      const category = coin.category || coin.secretCategory || 'Mysteries';
      const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
      
      if (!groups[categoryLabel]) {
        groups[categoryLabel] = [];
      }
      groups[categoryLabel].push(coin);
    });
    
    return groups;
  };

  const groupedCoins = getFilteredCoins();

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCoinClick = (coin) => {
    navigate(`/coinbook/${coin.id}`);
  };

  if (coins.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔮</div>
        <p className="empty-state-text">No secret coins available yet.</p>
      </div>
    );
  }

  return (
    <>
      <header className="chapter-header">
        <h2>Secret Codex</h2>
        <p>Hidden coins unlocked by unusual choices, timing, and behavior.</p>
      </header>

      <div className="filter-bar">
        {SECRET_FILTERS.map(filter => (
          <button
            key={filter.id}
            className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="stats-summary secrets">
        <div className="stat-item">
          <div className="stat-number">{stats.discovered}</div>
          <div className="stat-label">Discovered</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.hidden}</div>
          <div className="stat-label">Hidden</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.percentage}%</div>
          <div className="stat-label">Progress</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.xp.toLocaleString()}</div>
          <div className="stat-label">Secret XP</div>
        </div>
      </div>

      {Object.entries(groupedCoins).map(([groupName, groupCoins]) => {
        const unlockedCount = groupCoins.filter(c => c.earned).length;
        return (
          <div key={groupName}>
            <div className="section-header secrets">
              <h3 className="section-title">{groupName}</h3>
              <span className="section-count secrets">{unlockedCount} unlocked</span>
            </div>
            <div className="secrets-grid">
              {groupCoins.map(coin => {
                const isLocked = !coin.earned;
                const rarity = getRarity(coin);
                const rarityInfo = RARITY_LEVELS[rarity];
                
                return (
                  <div 
                    key={coin.id} 
                    className={`secret-card ${isLocked ? 'locked' : ''}`}
                    onClick={() => handleCoinClick(coin)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleCoinClick(coin)}
                  >
                    <div className="secret-header">
                      <div className={`secret-coin ${isLocked ? 'locked' : `unlocked ${rarity}`}`}>
                        {isLocked ? '🔒' : renderAchievementIcon(coin, 28)}
                      </div>
                      <span className={`secret-rarity ${rarityInfo.class}`}>
                        {rarityInfo.label}
                      </span>
                    </div>
                    <h4 className="secret-title">
                      {isLocked ? '???' : coin.name}
                    </h4>
                    <p className="secret-description">
                      {isLocked 
                        ? 'The conditions for this secret have not been discovered'
                        : coin.description
                      }
                    </p>
                    <div className="secret-footer">
                      <span className={`secret-status ${isLocked ? 'locked' : 'unlocked'}`}>
                        {isLocked ? 'Locked' : '✓ Unlocked'}
                      </span>
                      {coin.earnedAt && (
                        <span className="secret-date">{formatDate(coin.earnedAt)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
