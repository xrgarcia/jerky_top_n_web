import React from 'react';
import './TierDistribution.css';

function TierDistribution({ distribution }) {
  if (!distribution || !distribution.tiers) {
    return null;
  }

  const { tiers, totalRankings } = distribution;
  const maxCount = Math.max(...tiers.map(t => t.count), 1);

  return (
    <div className="tier-distribution">
      <div className="card-title">Community Tier Distribution</div>
      <div className="distribution-bars">
        {tiers.map(({ tier, count }) => (
          <div key={tier} className="dist-bar">
            <span className="dist-label">{tier}</span>
            <div className="dist-track">
              <div 
                className="dist-fill"
                style={{ width: `${(count / maxCount) * 100}%` }}
              >
                {count > 0 && <span className="dist-count">{count}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="dist-meta">
        Based on {totalRankings?.toLocaleString() || 0} total tier rankings across all users
      </div>
    </div>
  );
}

export default TierDistribution;
