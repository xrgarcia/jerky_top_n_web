import React from 'react';
import './DistributionBar.css';

function DistributionBar({ distribution }) {
  if (!distribution) {
    return null;
  }

  const { pct1st = 0, pct2nd = 0, pct3rd = 0 } = distribution;
  const total = pct1st + pct2nd + pct3rd;
  const pctOther = total < 100 ? 100 - total : 0;

  return (
    <div className="distribution-bar-container">
      <div className="distribution-visual">
        {pct1st > 0 && (
          <div 
            className="distribution-segment seg-1st" 
            style={{ width: `${pct1st}%` }}
            title={`1st Place: ${pct1st.toFixed(1)}%`}
          >
            {pct1st >= 10 && <span className="segment-label">{pct1st.toFixed(0)}%</span>}
          </div>
        )}
        {pct2nd > 0 && (
          <div 
            className="distribution-segment seg-2nd" 
            style={{ width: `${pct2nd}%` }}
            title={`2nd Place: ${pct2nd.toFixed(1)}%`}
          >
            {pct2nd >= 10 && <span className="segment-label">{pct2nd.toFixed(0)}%</span>}
          </div>
        )}
        {pct3rd > 0 && (
          <div 
            className="distribution-segment seg-3rd" 
            style={{ width: `${pct3rd}%` }}
            title={`3rd Place: ${pct3rd.toFixed(1)}%`}
          >
            {pct3rd >= 10 && <span className="segment-label">{pct3rd.toFixed(0)}%</span>}
          </div>
        )}
        {pctOther > 0 && (
          <div 
            className="distribution-segment seg-other" 
            style={{ width: `${pctOther}%` }}
            title={`Other: ${pctOther.toFixed(1)}%`}
          >
          </div>
        )}
      </div>
      <div className="distribution-legend">
        <div className="legend-item">
          <div className="legend-dot dot-1st"></div>
          <span>1st Place</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot dot-2nd"></div>
          <span>2nd Place</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot dot-3rd"></div>
          <span>3rd Place</span>
        </div>
      </div>
    </div>
  );
}

export default DistributionBar;
