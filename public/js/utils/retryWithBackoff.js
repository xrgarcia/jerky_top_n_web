/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Configuration options
 * @returns {Promise} Result from successful execution
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 5,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    onRetry = null,
    shouldRetry = (error) => true
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }
      
      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with jitter
      let currentDelay = delay;
      if (jitter) {
        currentDelay = delay * (0.5 + Math.random() * 0.5);
      }
      currentDelay = Math.min(currentDelay, maxDelay);
      
      console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} in ${Math.round(currentDelay)}ms`);
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, currentDelay, error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      
      // Increase delay for next attempt
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }
  
  // All retries exhausted
  throw lastError;
}

/**
 * Check if network is reachable (online/offline detection)
 */
function isNetworkReachable() {
  return navigator.onLine;
}

/**
 * Wait for network to become reachable
 */
function waitForNetwork(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    if (isNetworkReachable()) {
      resolve(true);
      return;
    }
    
    const timeout = setTimeout(() => {
      window.removeEventListener('online', onOnline);
      reject(new Error('Network timeout'));
    }, timeoutMs);
    
    const onOnline = () => {
      clearTimeout(timeout);
      window.removeEventListener('online', onOnline);
      console.log('📡 Network connection restored');
      resolve(true);
    };
    
    window.addEventListener('online', onOnline);
    console.log('📡 Waiting for network connection...');
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { retryWithBackoff, isNetworkReachable, waitForNetwork };
}
