import React from 'react';

/**
 * Converts relative asset paths to absolute URLs for proper loading in both dev and prod.
 * In development, prepends VITE_API_ORIGIN to route requests through the backend server.
 * In production, falls back to window.location.origin (same-origin serving).
 * 
 * @param {string} path - The asset path (e.g., "/objects/achievement-icons/...")
 * @returns {string} - Absolute URL or original path
 */
export const getAssetUrl = (path) => {
  if (!path || typeof path !== 'string') return path;
  
  // Already absolute URLs - return as-is
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  
  // Relative paths starting with / need the API origin in development
  if (path.startsWith('/')) {
    const apiOrigin = import.meta.env.VITE_API_ORIGIN || window.location.origin;
    return `${apiOrigin}${path}`;
  }
  
  return path;
};

export const renderAchievementIcon = (achievement, size = 48) => {
  if (!achievement) return null;

  const icon = achievement.icon;
  const iconType = achievement.iconType;

  if (iconType === 'image' && icon) {
    return (
      <img 
        src={getAssetUrl(icon)} 
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
        src={getAssetUrl(icon)} 
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
  const normalizedIcon = getAssetUrl(icon);
  
  if (iconType === 'image' && icon) {
    return `<img src="${normalizedIcon}" alt="Icon" style="width: ${size}px; height: ${size}px; object-fit: contain;" />`;
  }

  if (typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('http') || icon.startsWith('data:'))) {
    return `<img src="${normalizedIcon}" alt="Icon" style="width: ${size}px; height: ${size}px; object-fit: contain;" />`;
  }

  return icon || '🎖️';
};
