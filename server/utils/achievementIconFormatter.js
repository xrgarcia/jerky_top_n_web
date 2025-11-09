/**
 * Achievement Icon Formatter Utility
 * 
 * Normalizes achievement icon data for consistent frontend rendering.
 * Converts bare base64 strings to proper data URIs with MIME type prefix.
 */

/**
 * Normalizes an achievement icon to proper format
 * @param {string} icon - The icon data (emoji, URL, base64, or data URI)
 * @returns {string} - Normalized icon string
 */
function normalizeAchievementIcon(icon) {
  if (!icon) return icon;
  
  // Already a data URI or regular URL - no transformation needed
  if (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/')) {
    return icon;
  }
  
  // Check if it's a bare base64 string
  const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
  const cleanedIcon = icon.replace(/\s/g, '');
  
  if (base64Pattern.test(cleanedIcon)) {
    // Wrap bare base64 with data URI prefix
    return `data:image/png;base64,${cleanedIcon}`;
  }
  
  // Assume it's an emoji or other text - return as is
  return icon;
}

/**
 * Formats an achievement object with normalized icon data
 * @param {Object} achievement - Achievement object from database
 * @returns {Object} - Achievement with normalized icon and iconType
 */
function formatAchievementPayload(achievement) {
  if (!achievement) return achievement;
  
  const icon = achievement.achievementIcon || achievement.icon;
  const normalizedIcon = normalizeAchievementIcon(icon);
  
  // Determine iconType based on normalized icon
  let iconType = 'emoji'; // default
  if (normalizedIcon && (normalizedIcon.startsWith('data:') || normalizedIcon.startsWith('http') || normalizedIcon.startsWith('/'))) {
    iconType = 'image';
  }
  
  return {
    ...achievement,
    achievementIcon: normalizedIcon,
    icon: normalizedIcon, // Support both field names
    iconType
  };
}

module.exports = {
  normalizeAchievementIcon,
  formatAchievementPayload
};
