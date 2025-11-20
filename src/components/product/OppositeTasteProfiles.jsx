import React from 'react';
import { Link } from 'react-router-dom';
import './OppositeTasteProfiles.css';

function OppositeTasteProfiles({ profiles }) {
  if (!profiles || profiles.length === 0) {
    return null;
  }

  return (
    <div className="opposite-section card">
      <div className="card-title">Opposite Taste Profiles</div>
      <p className="section-subtext">
        These users placed this flavor much lower. Seeing their preferences may help you compare taste styles.
      </p>
      
      <div className="opposite-grid">
        {profiles.map((profile) => (
          <Link
            key={profile.userId}
            to={`/community/${profile.userId}`}
            className="opposite-card"
          >
            <div className="opposite-avatar">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} />
              ) : (
                <span>{profile.initials}</span>
              )}
            </div>
            <div className="opposite-username">{profile.displayName}</div>
            <div className="opposite-rank">Ranked #{profile.userRank}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default OppositeTasteProfiles;
