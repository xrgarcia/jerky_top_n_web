import React from 'react';
import { Link } from 'react-router-dom';
import './TopFlavorFans.css';

function TopFlavorFans({ fans }) {
  if (!fans || fans.length === 0) {
    return null;
  }

  return (
    <div className="fans-section card">
      <div className="card-title">Top Flavor Fans</div>
      <p className="section-subtext">
        Rankers who consistently place this flavor at the very top of their list.
      </p>
      
      <div className="fans-grid">
        {fans.map((fan) => (
          <Link
            key={fan.userId}
            to={`/community/${fan.userId}`}
            className="fan-card"
          >
            <div className="fan-avatar">
              {fan.avatarUrl ? (
                <img src={fan.avatarUrl} alt={fan.displayName} />
              ) : (
                <span>{fan.initials}</span>
              )}
            </div>
            <div className="fan-username">{fan.displayName}</div>
            <div className="fan-rank">Ranked #{fan.userRank}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default TopFlavorFans;
