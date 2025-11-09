/**
 * Framework-agnostic icon utilities for normalizing and rendering icons.
 * Used by both React components and legacy JavaScript.
 */

/**
 * Detects if a string is a bare base64 string (without data URI prefix)
 */
export const isBareBase64 = (str) => {
  if (!str || typeof str !== 'string') return false;
  if (str.startsWith('data:') || str.startsWith('http') || str.startsWith('/')) return false;
  
  const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
  const cleanStr = str.replace(/\s/g, '');
  
  return cleanStr.length > 20 && base64Pattern.test(cleanStr);
};

/**
 * Normalizes bare base64 strings to proper data URIs
 */
export const normalizeBase64 = (icon) => {
  if (isBareBase64(icon)) {
    return `data:image/png;base64,${icon}`;
  }
  return icon;
};

/**
 * Converts relative asset paths to absolute URLs for proper loading in both dev and prod.
 * In production, paths are same-origin so we return them as-is.
 * In development, Vite proxy handles /objects paths, so we also return as-is.
 * Only prepends origin if explicitly needed for cross-origin scenarios.
 */
export const getAssetUrl = (path) => {
  if (!path || typeof path !== 'string') return path;
  
  // Already absolute URLs - return as-is
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  
  // Relative paths starting with / are same-origin in production
  // and proxied in development, so return as-is
  if (path.startsWith('/')) {
    return path;
  }
  
  return path;
};

/**
 * Normalizes an icon source, handling base64, relative paths, and absolute URLs.
 * Returns an object with the normalized source and whether it should be rendered as an image.
 * 
 * @param {Object} params - Parameters object
 * @param {string} params.icon - The icon value (emoji, base64, URL, or path)
 * @param {string} params.iconType - Optional type hint ('image' or undefined)
 * @returns {Object} - { src: string, isImage: boolean }
 */
export const normalizeIconSource = ({ icon, iconType }) => {
  if (!icon) {
    return { src: '🎖️', isImage: false };
  }

  let normalizedIcon = normalizeBase64(icon);
  
  const isImageType = iconType === 'image';
  const isUrl = typeof normalizedIcon === 'string' && 
                (normalizedIcon.startsWith('/') || 
                 normalizedIcon.startsWith('http') || 
                 normalizedIcon.startsWith('data:'));
  
  if (isImageType || isUrl) {
    return {
      src: getAssetUrl(normalizedIcon),
      isImage: true
    };
  }
  
  return {
    src: normalizedIcon,
    isImage: false
  };
};

/**
 * Renders an icon as an HTML string (for legacy vanilla JavaScript).
 * Handles emojis, base64 strings, URLs, and relative paths.
 * 
 * @param {string} icon - The icon value
 * @param {string} iconType - Optional type hint ('image' or undefined)
 * @param {number} size - Icon size in pixels (default: 48)
 * @returns {string} - HTML string
 */
export const renderIconString = (icon, iconType, size = 48) => {
  const { src, isImage } = normalizeIconSource({ icon, iconType });
  
  if (isImage) {
    return `<img src="${src}" alt="Icon" style="width: ${size}px; height: ${size}px; object-fit: contain;" />`;
  }

  return src;
};
