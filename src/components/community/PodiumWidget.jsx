import React from 'react';
import { Link } from 'react-router-dom';
import './PodiumWidget.css';

function PodiumWidget({ rankers, isLoading }) {
  if (isLoading || !rankers || rankers.length === 0) {
    return null;
  }

  const displayedRankers = rankers.slice(0, 5);

  const getPositionClass = (index) => {
    switch(index) {
      case 0: return 'position-1';
      case 1: return 'position-2';
      case 2: return 'position-3';
      case 3: return 'position-4';
      case 4: return 'position-5';
      default: return '';
    }
  };

  const getPositionLabel = (index) => {
    switch(index) {
      case 0: return '1st';
      case 1: return '2nd';
      case 2: return '3rd';
      case 3: return '4th';
      case 4: return '5th';
      default: return `${index + 1}th`;
    }
  };

  return (
    <div className="podium-widget">
      <h2 className="podium-title">Top {displayedRankers.length} Rankers</h2>
      <div className="podium-stage">
        {displayedRankers.map((ranker, index) => (
          <Link
            key={ranker.userId}
            to={`/community/${ranker.userId}`}
            className={`podium-ranker ${getPositionClass(index)}`}
          >
            <div className="podium-glow-container">
              <div className="lunar-eclipse"></div>
              <div className="avatar-container">
                <div className="avatar avatar-podium">
                  {ranker.avatarUrl ? (
                    <img src={ranker.avatarUrl} alt={ranker.displayName} className="avatar-image" />
                  ) : (
                    <div className="avatar-initials">{ranker.initials || ranker.displayName?.charAt(0)}</div>
                  )}
                </div>
                <div className="position-badge">{getPositionLabel(index)}</div>
              </div>
            </div>
            <div className="podium-platform">
              <div className="ranker-info">
                <div className="ranker-name">{ranker.displayName}</div>
                <div className="ranker-score">{ranker.engagementScore} pts</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default PodiumWidget;
