/**
 * Simple debounce utility for server-side operations
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @returns {Function} The debounced function
 */
function debounce(func, wait) {
  const timers = new Map();
  
  return function debounced(...args) {
    // Use first argument as key for per-user debouncing
    const key = args[0];
    
    // Clear existing timer for this key
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      timers.delete(key);
      func.apply(this, args);
    }, wait);
    
    timers.set(key, timer);
  };
}

module.exports = { debounce };
