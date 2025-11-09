import React from 'react';

export const renderAchievementIcon = (achievement, size = 48) => {
  if (!achievement) return null;

  const icon = achievement.icon;
  const iconType = achievement.iconType;

  if (iconType === 'image' && icon) {
    return (
      <img 
        src={icon} 
        alt={achievement.name || 'Achievement icon'} 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          objectFit: 'contain' 
        }}
      />
    );
  }

  if (typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('http') || icon.startsWith('data:'))) {
    return (
      <img 
        src={icon} 
        alt={achievement.name || 'Achievement icon'} 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          objectFit: 'contain' 
        }}
      />
    );
  }

  return icon || '🎖️';
};

export const renderIconString = (icon, iconType, size = 48) => {
  if (iconType === 'image' && icon) {
    return `<img src="${icon}" alt="Icon" style="width: ${size}px; height: ${size}px; object-fit: contain;" />`;
  }

  if (typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('http') || icon.startsWith('data:'))) {
    return `<img src="${icon}" alt="Icon" style="width: ${size}px; height: ${size}px; object-fit: contain;" />`;
  }

  return icon || '🎖️';
};
