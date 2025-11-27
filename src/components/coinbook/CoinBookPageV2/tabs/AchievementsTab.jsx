import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderAchievementIcon } from '../../../../utils/iconUtils';

const ACHIEVEMENT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unlocked', label: 'Unlocked' },
  { id: 'locked', label: 'Locked' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'rating', label: 'Rating' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'streaks', label: 'Streaks' },
  { id: 'community', label: 'Community' }
];

const CATEGORY_MAPPING = {
  rank_count: 'Ranking Achievements',
  search_count: 'Discovery Achievements',
  product_view_count: 'Discovery Achievements',
  unique_product_view_count: 'Discovery Achievements',
  profile_view_count: 'Community Achievements',
  unique_profile_view_count: 'Community Achievements',
  daily_login_streak: 'Streak Achievements',
  daily_rank_streak: 'Streak Achievements',
  rating: 'Rating Achievements',
  review: 'Review Achievements'
};

export default function AchievementsTab({ coins, progress }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  const stats = useMemo(() => {
    const unlocked = coins.filter(c => c.earned).length;
    const locked = coins.filter(c => !c.earned).length;
    const total = coins.length;
    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;
    const totalXp = coins.filter(c => c.earned).reduce((sum, c) => sum + (c.points || 0), 0);
    const streak = progress?.currentStreak || 0;
    
    return { unlocked, locked, total, percentage, totalXp, streak };
  }, [coins, progress]);

  const getTier = (coin) => {
    if (!coin.earned) return 'locked';
    const tier = coin.currentTier || coin.tier;
    return tier || 'bronze';
  };

  const getCategory = (coin) => {
    if (coin.category) {
      return coin.category.charAt(0).toUpperCase() + coin.category.slice(1).replace(/_/g, ' ') + ' Achievements';
    }
    if (coin.requirement?.type) {
      return CATEGORY_MAPPING[coin.requirement.type] || 'Other Achievements';
    }
    return 'Other Achievements';
  };

  const categorizeAchievements = useMemo(() => {
    const groups = {};
    
    coins.forEach(coin => {
      const category = getCategory(coin);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(coin);
    });
    
    return groups;
  }, [coins]);

  const getFilteredCoins = () => {
    let filtered = coins;
    
    switch (activeFilter) {
      case 'unlocked':
        filtered = coins.filter(c => c.earned);
        break;
      case 'locked':
        filtered = coins.filter(c => !c.earned);
        break;
      case 'ranking':
        filtered = coins.filter(c => 
          c.category === 'ranking' || 
          c.requirement?.type === 'rank_count'
        );
        break;
      case 'rating':
        filtered = coins.filter(c => 
          c.category === 'rating' || 
          c.requirement?.type?.includes('rating')
        );
        break;
      case 'reviewing':
        filtered = coins.filter(c => 
          c.category === 'review' || 
          c.requirement?.type?.includes('review')
        );
        break;
      case 'streaks':
        filtered = coins.filter(c => 
          c.category === 'streak' || 
          c.requirement?.type?.includes('streak')
        );
        break;
      case 'community':
        filtered = coins.filter(c => 
          c.category === 'social' || 
          c.category === 'community' ||
          c.requirement?.type?.includes('profile')
        );
        break;
      default:
        break;
    }
    
    const groups = {};
    filtered.forEach(coin => {
      const category = getCategory(coin);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(coin);
    });
    
    return groups;
  };

  const groupedCoins = getFilteredCoins();

  const getProgressInfo = (coin) => {
    if (coin.progress) {
      const { current, required, target, percentage } = coin.progress;
      const total = required || target;
      if (current !== undefined && total !== undefined) {
        const pct = percentage || Math.round((current / total) * 100);
        return {
          current,
          total,
          percentage: Math.min(pct, 100),
          text: coin.earned ? `${current}/${total} Complete` : `${current}/${total} Progress`
        };
      }
    }
    if (coin.earned) {
      return { current: 1, total: 1, percentage: 100, text: 'Complete' };
    }
    return { current: 0, total: 1, percentage: 0, text: 'Locked' };
  };

  const getTierNumber = (coin) => {
    const tier = coin.currentTier || coin.tier;
    switch (tier) {
      case 'gold': return 3;
      case 'silver': return 2;
      case 'bronze': return 1;
      default: return null;
    }
  };

  const handleCoinClick = (coin) => {
    navigate(`/coinbook/${coin.id}`);
  };

  if (coins.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏅</div>
        <p className="empty-state-text">No achievement coins available yet.</p>
      </div>
    );
  }

  return (
    <>
      <header className="chapter-header">
        <h2>Achievements</h2>
        <p>Milestones earned through ranking, rating, reviewing, and community actions.</p>
      </header>

      <div className="filter-bar">
        {ACHIEVEMENT_FILTERS.map(filter => (
          <button
            key={filter.id}
            className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="stats-summary">
        <div className="stat-item">
          <div className="stat-number">{stats.unlocked}</div>
          <div className="stat-label">Unlocked</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.locked}</div>
          <div className="stat-label">Locked</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.percentage}%</div>
          <div className="stat-label">Completion</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.totalXp.toLocaleString()}</div>
          <div className="stat-label">Total XP</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.streak}</div>
          <div className="stat-label">Day Streak</div>
        </div>
      </div>

      {Object.entries(groupedCoins).map(([groupName, groupCoins]) => {
        const unlockedCount = groupCoins.filter(c => c.earned).length;
        const totalCount = groupCoins.length;
        
        return (
          <div key={groupName}>
            <div className="section-header">
              <h3 className="section-title">{groupName}</h3>
              <span className="section-progress">{unlockedCount}/{totalCount} unlocked</span>
            </div>
            <div className="achievements-grid">
              {groupCoins.map(coin => {
                const isLocked = !coin.earned;
                const tier = getTier(coin);
                const tierNumber = getTierNumber(coin);
                const progressInfo = getProgressInfo(coin);
                
                return (
                  <div 
                    key={coin.id} 
                    className={`achievement-card ${isLocked ? 'locked' : 'unlocked'}`}
                    onClick={() => handleCoinClick(coin)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleCoinClick(coin)}
                  >
                    {tierNumber && !isLocked && (
                      <span className={`tier-badge tier-${tier}`}>{tierNumber}</span>
                    )}
                    <div className="achievement-header">
                      <div className={`achievement-coin ${isLocked ? 'locked' : `unlocked ${tier}`}`}>
                        {isLocked ? '🔒' : renderAchievementIcon(coin, 28)}
                      </div>
                      <div className="achievement-info">
                        <h4 className="achievement-title">{coin.name}</h4>
                        <p className="achievement-description">{coin.description}</p>
                      </div>
                    </div>
                    <div className="achievement-progress-bar">
                      <div 
                        className="achievement-progress-fill" 
                        style={{ width: `${progressInfo.percentage}%` }}
                      ></div>
                    </div>
                    <div className="achievement-stats">
                      <span className="achievement-xp">+{coin.points || 0} XP</span>
                      <span className="achievement-completion">{progressInfo.text}</span>
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
