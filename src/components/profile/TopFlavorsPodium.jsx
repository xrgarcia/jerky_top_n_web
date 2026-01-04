import React from 'react';
import './TopFlavorsPodium.css';

function TopFlavorsPodium({ topProducts = [] }) {
  if (!topProducts || topProducts.length === 0) {
    return (
      <div className="top-flavors-podium-empty">
        <p className="empty-message">No rankings yet</p>
      </div>
    );
  }

  const getProductEmoji = (product) => {
    return product.flavorIcon || product.animalIcon || '🥩';
  };

  const renderPodiumPlace = (product, position) => {
    if (!product) return null;

    const isFirst = position === 1;
    const sizeClass = isFirst ? 'podium-first' : position === 2 ? 'podium-second' : 'podium-third';
    const emoji = getProductEmoji(product);

    const title = product.title || 'Unknown';
    const titleParts = title.split(' ');
    const line1 = titleParts.slice(0, Math.ceil(titleParts.length / 2)).join(' ');
    const line2 = titleParts.slice(Math.ceil(titleParts.length / 2)).join(' ');

    return (
      <div className={`podium-place ${sizeClass}`}>
        <div className="podium-icon-wrapper">
          <div className="podium-icon-ring">
            {isFirst && <div className="podium-icon-shine"></div>}
            <span className="podium-icon-emoji">{emoji}</span>
          </div>
        </div>
        <div className="podium-title">
          {line1}
          {line2 && (
            <>
              <br />
              {line2}
            </>
          )}
        </div>
        <div className="podium-base">
          <span className="podium-rank">#{position}</span>
        </div>
      </div>
    );
  };

  const first = topProducts[0];
  const second = topProducts[1];
  const third = topProducts[2];

  return (
    <div className="top-flavors-podium">
      {renderPodiumPlace(second, 2)}
      {renderPodiumPlace(first, 1)}
      {renderPodiumPlace(third, 3)}
    </div>
  );
}

export default TopFlavorsPodium;
