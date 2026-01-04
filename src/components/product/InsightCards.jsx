import React from 'react';
import './InsightCards.css';

function InsightCards({ insights }) {
  if (!insights) {
    return null;
  }

  const { 
    consensus, 
    consensusDescription, 
    consensusStats,
    rankRange, 
    trend, 
    trendDescription 
  } = insights;

  return (
    <div className="insights-row">
      {consensus && (
        <div className="insight-card card">
          <div className="card-title">Rank Consensus</div>
          <div className="insight-value">{consensus}</div>
          <div className="insight-description">{consensusDescription || 'No description available'}</div>
          {consensusStats && <div className="insight-metric">{consensusStats}</div>}
        </div>
      )}

      {rankRange && (
        <div className="insight-card card">
          <div className="card-title">Rank Range</div>
          <div className="insight-value">
            #{rankRange.min} – #{rankRange.max}
          </div>
          <div className="insight-description">
            Highest: #{rankRange.min} | Current: #{rankRange.median} | Lowest: #{rankRange.max}
          </div>
          <div className="insight-metric">Span: {rankRange.span} ranks</div>
        </div>
      )}

      {trend && (
        <div className="insight-card card">
          <div className="card-title">Rank Trend</div>
          <div className="insight-value">{trend.direction || 'Stable'}</div>
          <div className="insight-description">{trendDescription || 'No trend data available'}</div>
          {trend.change !== undefined && trend.change > 0 && (
            <div className="insight-metric">7-day change: ±{trend.change}</div>
          )}
          {trend.change !== undefined && trend.change === 0 && (
            <div className="insight-metric">7-day change: ±0</div>
          )}
        </div>
      )}
    </div>
  );
}

export default InsightCards;
