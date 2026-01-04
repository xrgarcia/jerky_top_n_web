import React from 'react';
import './FlavorProfileProgress.css';

function FlavorProfileProgress({ flavorProfileData = [] }) {
  if (!flavorProfileData || flavorProfileData.length === 0) {
    return (
      <div className="flavor-profile-progress-empty">
        <p className="empty-message">No flavor profile data available</p>
      </div>
    );
  }

  const formatLabel = (profile) => {
    if (!profile) return 'Unknown';
    return profile.charAt(0).toUpperCase() + profile.slice(1).toLowerCase();
  };

  return (
    <div className="flavor-profile-progress">
      {flavorProfileData.map((item, index) => {
        const percentage = item.total > 0 
          ? Math.round((item.ranked / item.total) * 100) 
          : 0;

        return (
          <div key={index} className="flavor-profile-bar">
            <span className="flavor-profile-label">
              {formatLabel(item.profile)}
            </span>
            <div className="flavor-profile-track">
              <div 
                className="flavor-profile-fill" 
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="flavor-profile-stats">
              {item.ranked}/{item.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default FlavorProfileProgress;
