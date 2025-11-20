import React, { useState } from 'react';
import './InteractiveDistributionGraph.css';

function InteractiveDistributionGraph({ distribution, currentAvgRank }) {
  const [hoveredBucket, setHoveredBucket] = useState(null);
  
  if (!distribution || !distribution.buckets || distribution.buckets.length === 0) {
    return (
      <div className="distribution-graph-card">
        <div className="graph-header">
          <div className="card-title">Full Ranking Distribution — All Users</div>
        </div>
        <div className="distribution-empty">
          <p>No ranking data available yet.</p>
        </div>
      </div>
    );
  }

  const { buckets, stats } = distribution;
  const maxCount = Math.max(...buckets.map(b => b.count));

  const isHighlighted = (range) => {
    if (!currentAvgRank || !stats) return false;
    const avg = parseFloat(currentAvgRank);
    
    const rangeMap = {
      '#1-3': [1, 3],
      '#4-6': [4, 6],
      '#7-9': [7, 9],
      '#10-12': [10, 12],
      '#13-15': [13, 15],
      '#16-20': [16, 20],
      '#21-30': [21, 30],
      '#31-40': [31, 40],
      '#41-50': [41, 50],
      '#51-75': [51, 75],
      '#76-100': [76, 100],
      '#100+': [101, 999]
    };
    
    const [min, max] = rangeMap[range] || [0, 0];
    return avg >= min && avg <= max;
  };

  return (
    <div className="distribution-graph-card">
      <div className="graph-header">
        <div className="card-title">Full Ranking Distribution — All Users</div>
        <div className="graph-legend">
          <div className="legend-item">
            <div className="legend-dot amber"></div>
            <span>Current Global Rank Region</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot gray"></div>
            <span>Other Ranks</span>
          </div>
        </div>
      </div>

      <div className="distribution-graph">
        <div className="graph-bars">
          {buckets.map((bucket) => {
            const percentage = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
            const highlighted = isHighlighted(bucket.range);
            const isHovered = hoveredBucket === bucket.range;

            return (
              <div
                key={bucket.range}
                className="graph-row"
                onMouseEnter={() => setHoveredBucket(bucket.range)}
                onMouseLeave={() => setHoveredBucket(null)}
              >
                <span className="rank-label">{bucket.range}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${highlighted ? 'highlight' : ''} ${isHovered ? 'hovered' : ''}`}
                    style={{ width: `${percentage}%` }}
                  >
                    <span className="bar-count">{bucket.count.toLocaleString()}</span>
                  </div>
                </div>
                {isHovered && (
                  <div className="bar-tooltip">
                    {bucket.count} ranker{bucket.count !== 1 ? 's' : ''} placed this {bucket.range}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {stats && (
          <div className="graph-footer">
            <p className="graph-footer-text">
              Based on {stats.totalRankings?.toLocaleString() || '0'} total rankings across all users
            </p>
            <div className="graph-annotations">
              <div className="annotation-item">
                <span className="annotation-label">Highest Rank</span>
                <span className="annotation-value">#{stats.bestRank}</span>
              </div>
              <div className="annotation-item">
                <span className="annotation-label">Lowest Rank</span>
                <span className="annotation-value">#{stats.worstRank}</span>
              </div>
              <div className="annotation-item">
                <span className="annotation-label">Median Rank</span>
                <span className="annotation-value">#{stats.medianRank}</span>
              </div>
              <div className="annotation-item">
                <span className="annotation-label">Std Deviation</span>
                <span className="annotation-value">{stats.stdDeviation}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InteractiveDistributionGraph;
