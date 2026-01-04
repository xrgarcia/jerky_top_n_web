import React, { useState } from 'react';
import './InteractiveDistributionGraph.css';

function InteractiveDistributionGraph({ distribution, currentAvgRank }) {
  const [hoveredBucket, setHoveredBucket] = useState(null);
  
  // Define all possible rank buckets
  const allBuckets = [
    { range: '#1-3', order: 1 },
    { range: '#4-6', order: 2 },
    { range: '#7-9', order: 3 },
    { range: '#10-12', order: 4 },
    { range: '#13-15', order: 5 },
    { range: '#16-20', order: 6 },
    { range: '#21-30', order: 7 },
    { range: '#31-40', order: 8 },
    { range: '#41-50', order: 9 },
    { range: '#51-75', order: 10 },
    { range: '#76-100', order: 11 },
    { range: '#100+', order: 12 }
  ];
  
  // Merge backend data with all possible buckets
  const stats = distribution?.stats || null;
  const dataBuckets = distribution?.buckets || [];
  
  const mergedBuckets = allBuckets.map(bucket => {
    const dataMatch = dataBuckets.find(d => d.range === bucket.range);
    return {
      ...bucket,
      count: dataMatch?.count || 0
    };
  });
  
  const maxCount = Math.max(...mergedBuckets.map(b => b.count), 1);

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
          {mergedBuckets.map((bucket) => {
            const percentage = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
            const highlighted = isHighlighted(bucket.range);
            const isHovered = hoveredBucket === bucket.range;
            const isEmpty = bucket.count === 0;

            return (
              <div
                key={bucket.range}
                className={`graph-row ${isEmpty ? 'empty' : ''}`}
                onMouseEnter={() => setHoveredBucket(bucket.range)}
                onMouseLeave={() => setHoveredBucket(null)}
              >
                <span className="rank-label">{bucket.range}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${highlighted ? 'highlight' : ''} ${isHovered ? 'hovered' : ''} ${isEmpty ? 'empty' : ''}`}
                    style={{ width: isEmpty ? '100%' : `${percentage}%` }}
                  >
                    {!isEmpty && <span className="bar-count">{bucket.count.toLocaleString()}</span>}
                  </div>
                </div>
                {isHovered && !isEmpty && (
                  <div className="bar-tooltip">
                    {bucket.count} ranker{bucket.count !== 1 ? 's' : ''} placed this {bucket.range}
                  </div>
                )}
                {isHovered && isEmpty && (
                  <div className="bar-tooltip">
                    No rankings in this range yet
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
