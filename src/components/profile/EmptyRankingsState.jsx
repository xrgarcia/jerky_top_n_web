import React from 'react';
import './EmptyRankingsState.css';

/**
 * EmptyRankingsState - Adventure-themed empty state for public profiles with no rankings
 * Third-person messaging for viewing other users' profiles (no CTA)
 * Adapts based on whether the user has achievements
 */
function EmptyRankingsState({ hasAchievements = false }) {
  const content = hasAchievements
    ? {
        title: 'Their Quest Continues',
        message: (
          <>
            They've unlocked achievements along the way, but their ranking journey is still taking shape.
            <br />
            Check back later to see their flavor legacy unfold.
          </>
        )
      }
    : {
        title: 'Just Getting Started',
        message: (
          <>
            This flavor explorer is at the beginning of their jerky journey.
            <br />
            Their first rankings and achievements are waiting to be discovered.
          </>
        )
      };

  return (
    <div className="empty-rankings-state">
      <div className="empty-rankings-content">
        <div className="empty-rankings-icon">🗺️</div>
        <h2 className="empty-rankings-title">{content.title}</h2>
        <p className="empty-rankings-message">
          {content.message}
        </p>
      </div>
    </div>
  );
}

export default EmptyRankingsState;
