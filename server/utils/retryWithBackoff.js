const Sentry = require('@sentry/node');

/**
 * Retry a function with exponential backoff
 * Server-side implementation for handling transient errors
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {number} options.backoffMultiplier - Delay multiplier (default: 2)
 * @param {boolean} options.jitter - Add randomization to delays (default: true)
 * @param {Function} options.onRetry - Callback on each retry
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @param {string} options.operationName - Name for logging (default: 'operation')
 * @returns {Promise} Result from successful execution
 * @throws {Error} Last error if all retries exhausted
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    jitter = true,
    onRetry = null,
    shouldRetry = (error) => isTransientError(error),
    operationName = 'operation'
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Log success if this was a retry
      if (attempt > 0) {
        console.log(`✅ [RETRY SUCCESS] ${operationName} succeeded on attempt ${attempt + 1}/${maxRetries + 1}`);
        Sentry.addBreadcrumb({
          category: 'retry',
          message: `${operationName} succeeded after ${attempt} retries`,
          level: 'info'
        });
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        console.log(`❌ [RETRY SKIP] ${operationName} failed with non-retryable error:`, error.message);
        throw error;
      }
      
      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        console.error(`❌ [RETRY EXHAUSTED] ${operationName} failed after ${maxRetries + 1} attempts:`, error.message);
        
        Sentry.captureException(error, {
          tags: { 
            retry_exhausted: 'true',
            operation: operationName,
            attempts: maxRetries + 1
          },
          extra: {
            errorCode: error.code,
            errorMessage: error.message
          }
        });
        
        break;
      }
      
      // Calculate delay with jitter
      let currentDelay = delay;
      if (jitter) {
        // Add ±25% jitter to prevent thundering herd
        currentDelay = delay * (0.75 + Math.random() * 0.5);
      }
      currentDelay = Math.min(currentDelay, maxDelay);
      
      console.log(`🔄 [RETRY ${attempt + 1}/${maxRetries}] ${operationName} failed (${error.code || error.message}), retrying in ${Math.round(currentDelay)}ms...`);
      
      // Log to Sentry for observability
      Sentry.addBreadcrumb({
        category: 'retry',
        message: `Retrying ${operationName} (attempt ${attempt + 1}/${maxRetries})`,
        level: 'warning',
        data: {
          error: error.message,
          errorCode: error.code,
          delayMs: Math.round(currentDelay)
        }
      });
      
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
  
  // All retries exhausted - throw the last error
  throw lastError;
}

/**
 * Determine if an error is transient and should be retried
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
function isTransientError(error) {
  // Network errors that are typically transient
  const transientCodes = [
    'ECONNRESET',     // Connection reset by peer
    'ETIMEDOUT',      // Connection timed out
    'ENOTFOUND',      // DNS lookup failed
    'ECONNREFUSED',   // Connection refused
    'ENETUNREACH',    // Network unreachable
    'EAI_AGAIN',      // DNS temporary failure
    'EPIPE',          // Broken pipe
    'FETCH_ERROR'     // Generic fetch error
  ];
  
  // Check error code
  if (error.code && transientCodes.includes(error.code)) {
    return true;
  }
  
  // Check for fetch-specific errors
  if (error.message && error.message.includes('fetch failed')) {
    return true;
  }
  
  // Check for HTTP 5xx errors (server errors)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Check for HTTP 429 (rate limit)
  if (error.status === 429) {
    return true;
  }
  
  // Default: don't retry
  return false;
}

/**
 * Check if an HTTP response indicates a transient error
 * @param {Response} response - Fetch response object
 * @returns {boolean} True if response indicates transient error
 */
function isTransientHttpError(response) {
  // 5xx server errors are transient
  if (response.status >= 500 && response.status < 600) {
    return true;
  }
  
  // 429 rate limit is transient
  if (response.status === 429) {
    return true;
  }
  
  return false;
}

module.exports = {
  retryWithBackoff,
  isTransientError,
  isTransientHttpError
};
