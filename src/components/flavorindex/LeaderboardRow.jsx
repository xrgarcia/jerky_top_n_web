import React from 'react';
import { useNavigate } from 'react-router-dom';
import DistributionBar from './DistributionBar';
import './LeaderboardRow.css';

function LeaderboardRow({ product }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/flavors/${product.id}`);
  };

  const isTopThree = product.communityRank && product.communityRank <= 3;

  return (
    <div className="leaderboard-row" onClick={handleClick}>
      <div className="mini-flavor-card">
        <div className="flavor-coin">
          {product.image ? (
            <img src={product.image} alt={product.title} className="flavor-coin-image" />
          ) : (
            <span className="flavor-coin-placeholder">🥓</span>
          )}
        </div>
        <div className="flavor-info">
          <div className="flavor-name">{product.title}</div>
          {product.animalDisplay && (
            <div className="meat-type">{product.animalDisplay}</div>
          )}
        </div>
      </div>

      <div className="distribution-zone">
        {product.distribution && product.rankingCount > 0 ? (
          <DistributionBar distribution={product.distribution} />
        ) : (
          <div className="no-rankings-message">
            No rankings yet
          </div>
        )}
      </div>

      {product.communityRank && (
        <div className={`rank-number ${isTopThree ? 'top-3' : ''}`}>
          #{product.communityRank}
        </div>
      )}
    </div>
  );
}

export default LeaderboardRow;
