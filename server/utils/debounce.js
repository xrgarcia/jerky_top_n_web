/**
 * Simple debounce utility for server-side operations
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * Per-user debouncing: Each unique userId gets its own debounce timer
 * 
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @returns {Function} The debounced function
 */
function debounce(func, wait) {
  const timers = new Map();
  
  return function debounced(...args) {
    // Use first argument (userId) as key for per-user debouncing
    // Convert to string to ensure consistent Map key comparison
    const userId = args[0];
    const key = String(userId);
    
    // Clear existing timer for this user if one exists
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
      console.log(`⏱️  Debounce: Resetting timer for user ${userId} (${wait}ms)`);
    } else {
      console.log(`⏱️  Debounce: Starting new timer for user ${userId} (${wait}ms)`);
    }
    
    // Set new timer for this user
    const timer = setTimeout(() => {
      timers.delete(key);
      console.log(`✅ Debounce: Executing for user ${userId} after ${wait}ms delay`);
      func.apply(this, args);
    }, wait);
    
    timers.set(key, timer);
  };
}

module.exports = { debounce };
