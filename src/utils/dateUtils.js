/**
 * Format a date/timestamp into a human-readable "time ago" string
 * @param {string|Date} dateString - ISO 8601 UTC timestamp or Date object
 * @returns {string} Human-readable time ago string (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    console.warn('Invalid timestamp:', dateString);
    return 'unknown';
  }
  
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 0) {
    console.warn('Timestamp in future:', dateString);
    return 'just now';
  }

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}
