import { useState } from 'react';
import { useAchievements, useGamificationProgress } from '../../../hooks/useCoinBook';
import { useCoinBookWebSocket } from '../../../hooks/useCoinBookWebSocket';
import FlavorTab from './tabs/FlavorTab';
import MasteryTab from './tabs/MasteryTab';
import SecretsTab from './tabs/SecretsTab';
import AchievementsTab from './tabs/AchievementsTab';
import './CoinBookPageV2.css';

const TABS = [
  { id: 'flavors', label: 'Flavors' },
  { id: 'mastery', label: 'Mastery' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'achievements', label: 'Achievements' }
];

export default function CoinBookPageV2() {
  const [activeTab, setActiveTab] = useState('flavors');
  const { data: achievementsData, isLoading: achievementsLoading } = useAchievements();
  const { data: progressData, isLoading: progressLoading } = useGamificationProgress();
  
  useCoinBookWebSocket();

  const achievements = achievementsData?.achievements || [];
  const progress = progressData?.progress || null;
  
  const isLoading = achievementsLoading || progressLoading;

  const categorizeAchievements = () => {
    const flavorCoins = achievements.filter(a => a.collectionType === 'flavor_coin');
    const masteryCoins = achievements.filter(a => 
      a.collectionType === 'dynamic_collection' || 
      a.collectionType === 'static_collection'
    );
    const secretCoins = achievements.filter(a => 
      a.collectionType === 'hidden_collection' || 
      a.isHidden === 1
    );
    const engagementCoins = achievements.filter(a => 
      a.collectionType === 'engagement_collection'
    );
    
    return { flavorCoins, masteryCoins, secretCoins, engagementCoins };
  };

  const { flavorCoins, masteryCoins, secretCoins, engagementCoins } = categorizeAchievements();

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="coinbook-loading">
          <div className="loading-spinner"></div>
          <p>Loading your coin collection...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'flavors':
        return <FlavorTab coins={flavorCoins} progress={progress} />;
      case 'mastery':
        return <MasteryTab coins={masteryCoins} progress={progress} />;
      case 'secrets':
        return <SecretsTab coins={secretCoins} progress={progress} />;
      case 'achievements':
        return <AchievementsTab coins={engagementCoins} progress={progress} />;
      default:
        return null;
    }
  };

  return (
    <div className="coinbook-v2">
      <div className="coinbook-shell">
        <nav className="coinbook-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`coinbook-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="coinbook-tab-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
