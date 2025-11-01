/**
 * Generate RFC4122 version 4 compliant UUID
 * @returns {string} UUID string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
function generateUUID() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateUUID };
}
