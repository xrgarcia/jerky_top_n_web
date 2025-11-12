import React from 'react';
import { Link } from 'react-router-dom';
import './EmptyRankingsState.css';

/**
 * EmptyRankingsState - Adventure-themed empty state for users with no rankings
 * Concludes the storytelling arc: Hero → Journey → Achievements → "Your Quest Awaits"
 * Adapts messaging based on whether user has achievements or not
 */
function EmptyRankingsState({ hasAchievements = false }) {
  const content = hasAchievements 
    ? {
        title: 'Your Flavor Quest Awaits',
        message: (
          <>
            You've collected achievements, now it's time to build your flavor legacy.
            <br />
            Each ranking adds to your journey from curious taster to certified legend.
          </>
        ),
        cta: 'Begin Your Rankings →'
      }
    : {
        title: 'Your Flavor Adventure Starts Here',
        message: (
          <>
            Start ranking jerky to unlock achievements, climb the leaderboard, and build your flavor legacy.
            <br />
            Each ranking adds to your journey from curious taster to certified legend.
          </>
        ),
        cta: 'Start Ranking →'
      };

  return (
    <div className="empty-rankings-state">
      <div className="empty-rankings-content">
        <div className="empty-rankings-icon">🗺️</div>
        <h2 className="empty-rankings-title">{content.title}</h2>
        <p className="empty-rankings-message">
          {content.message}
        </p>
        <Link to="/rank" className="empty-rankings-cta">
          {content.cta}
        </Link>
      </div>
    </div>
  );
}

export default EmptyRankingsState;
