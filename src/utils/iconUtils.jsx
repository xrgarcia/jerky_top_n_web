import React from 'react';
import { getAssetUrl, normalizeIconSource, renderIconString } from './iconUtilsCore';

export const renderAchievementIcon = (achievement, size = 48) => {
  if (!achievement) return null;

  const { src, isImage } = normalizeIconSource({
    icon: achievement.icon,
    iconType: achievement.iconType
  });

  if (isImage) {
    return (
      <img 
        src={src} 
        alt={achievement.name || 'Achievement icon'} 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          objectFit: 'contain' 
        }}
      />
    );
  }

  return src;
};

export { getAssetUrl, renderIconString };
