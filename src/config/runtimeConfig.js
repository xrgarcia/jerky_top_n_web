/**
 * Runtime configuration for API and asset URLs.
 * Works in both development and production without build-time variable baking.
 */

/**
 * Gets the API origin for making backend requests and loading assets.
 * In production: Uses same-origin (React served from Express on port 5000)
 * In development: Uses Vite proxy which forwards to localhost:5000
 * 
 * @returns {string} The API origin URL or empty string for same-origin
 */
export const getApiOrigin = () => {
  // Check if server injected a specific origin (future-proofing)
  if (typeof window !== 'undefined' && window.__API_ORIGIN) {
    return window.__API_ORIGIN;
  }
  
  // In production and development with proxy, use same-origin
  // Vite proxy handles forwarding /api/* and /objects/* to port 5000
  return typeof window !== 'undefined' ? window.location.origin : '';
};

/**
 * Checks if we're in development mode with Vite dev server
 */
export const isDevelopment = () => {
  return typeof window !== 'undefined' && window.location.port === '5173';
};
