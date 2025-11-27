import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderAchievementIcon } from '../../../../utils/iconUtils';

const MASTERY_FILTERS = [
  { id: 'all', label: 'All Mastery' },
  { id: 'families', label: 'Flavor Families' },
  { id: 'playstyles', label: 'Playstyles' },
  { id: 'prestige', label: 'Prestige' }
];

export default function MasteryTab({ coins, progress }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  const getTier = (coin) => {
    if (!coin.earned) return 'locked';
    const tier = coin.currentTier || coin.tier;
    return tier || 'bronze';
  };

  const categorizeMastery = useMemo(() => {
    const flavorFamilies = coins.filter(c => 
      c.proteinCategories?.length > 0 || 
      c.proteinCategory || 
      c.requirement?.type === 'animal_collection'
    );
    
    const playstyles = coins.filter(c => 
      c.requirement?.type === 'brand_collection' ||
      c.category === 'playstyle'
    );
    
    const prestige = coins.filter(c => 
      c.requirement?.type === 'complete_collection' ||
      c.category === 'prestige'
    );
    
    const other = coins.filter(c => 
      !flavorFamilies.includes(c) && 
      !playstyles.includes(c) && 
      !prestige.includes(c)
    );
    
    return { flavorFamilies, playstyles, prestige, other };
  }, [coins]);

  const getFilteredCoins = () => {
    switch (activeFilter) {
      case 'families':
        return { 'Flavor Family Mastery': categorizeMastery.flavorFamilies };
      case 'playstyles':
        return { 'Playstyle Mastery': categorizeMastery.playstyles };
      case 'prestige':
        return { 'Prestige': categorizeMastery.prestige };
      default:
        const groups = {};
        if (categorizeMastery.flavorFamilies.length > 0) {
          groups['Flavor Family Mastery'] = categorizeMastery.flavorFamilies;
        }
        if (categorizeMastery.playstyles.length > 0) {
          groups['Playstyle Mastery'] = categorizeMastery.playstyles;
        }
        if (categorizeMastery.prestige.length > 0) {
          groups['Prestige'] = categorizeMastery.prestige;
        }
        if (categorizeMastery.other.length > 0) {
          groups['Other Collections'] = categorizeMastery.other;
        }
        return groups;
    }
  };

  const groupedCoins = getFilteredCoins();

  const getProgressText = (coin) => {
    if (coin.progress) {
      const { current, required, target } = coin.progress;
      const total = required || target;
      if (current !== undefined && total !== undefined) {
        if (coin.earned) {
          return `${current}/${total} Complete`;
        }
        return `${current}/${total} Progress`;
      }
    }
    if (coin.earned) {
      return 'Complete';
    }
    return 'Locked';
  };

  const handleCoinClick = (coin) => {
    navigate(`/coinbook/${coin.id}`);
  };

  if (coins.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏆</div>
        <p className="empty-state-text">No mastery coins available yet.</p>
      </div>
    );
  }

  return (
    <>
      <header className="chapter-header">
        <h2>Trophy Room</h2>
        <p>Master every family and playstyle to earn prestige coins.</p>
      </header>

      <div className="filter-bar">
        {MASTERY_FILTERS.map(filter => (
          <button
            key={filter.id}
            className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {Object.entries(groupedCoins).map(([groupName, groupCoins]) => (
        <div key={groupName}>
          <div className="section-header">
            <h3 className="section-title">{groupName}</h3>
            <span className="section-count">{groupCoins.length} {groupCoins.length === 1 ? 'collection' : 'collections'}</span>
          </div>
          <div className="mastery-grid">
            {groupCoins.map(coin => {
              const tier = getTier(coin);
              const isLocked = tier === 'locked';
              return (
                <div 
                  key={coin.id} 
                  className={`mastery-coin ${isLocked ? 'locked' : ''}`}
                  onClick={() => handleCoinClick(coin)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleCoinClick(coin)}
                >
                  <div className={`mastery-icon ${tier}`}>
                    {renderAchievementIcon(coin, 40)}
                  </div>
                  <h4 className="mastery-title">{coin.name}</h4>
                  <p className="mastery-subtitle">{coin.description || 'Complete this collection'}</p>
                  <p className={`mastery-progress ${isLocked ? 'locked' : ''}`}>
                    {getProgressText(coin)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
