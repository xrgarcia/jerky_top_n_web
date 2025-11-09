/**
 * Format user display name based on privacy settings
 * @param {Object} user - User object with firstName, lastName, handle, hideNamePrivacy
 * @returns {string} Formatted display name
 */
export function formatDisplayName(user) {
  if (!user) return '';
  
  // If privacy is enabled and handle exists, show handle
  if (user.hide_name_privacy && user.handle) {
    return `@${user.handle}`;
  }
  
  // Otherwise show full name
  const firstName = user.first_name || user.firstName || '';
  const lastName = user.last_name || user.lastName || '';
  return `${firstName} ${lastName}`.trim() || user.email || 'User';
}

/**
 * Get user initials for avatar
 * @param {Object} user - User object with firstName, lastName
 * @returns {string} User initials (e.g., "JD")
 */
export function getUserInitials(user) {
  if (!user) return '';
  
  const firstName = user.first_name || user.firstName || '';
  const lastName = user.last_name || user.lastName || '';
  const email = user.email || '';
  
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  
  return 'U';
}

/**
 * Get user avatar URL or null
 * @param {Object} user - User object with profile_image_url or profileImageUrl
 * @returns {string|null} Avatar URL or null
 */
export function getUserAvatarUrl(user) {
  if (!user) return null;
  return user.profile_image_url || user.profileImageUrl || null;
}
