const Sentry = require('@sentry/node');

/**
 * CacheWarmer - Centralized cache warming on server startup
 * 
 * Design Principles:
 * - Separation of Concerns: Dedicated service for cache warming logic
 * - Open/Closed Principle: Easy to add new caches via registration
 * - Fail-Safe: Errors don't crash the server, only log warnings
 * - Non-Blocking: Runs asynchronously after server starts
 * - Observable: Clear logging for monitoring and debugging
 * - Alerting: Sends errors to Sentry with environment context
 */
class CacheWarmer {
  constructor() {
    this.warmers = [];
  }

  /**
   * Register a cache warming function
   * @param {string} name - Name of the cache (for logging)
   * @param {Function} warmerFn - Async function that warms the cache
   */
  register(name, warmerFn) {
    this.warmers.push({ name, warmerFn });
  }

  /**
   * Warm all registered caches in parallel
   * Returns immediately, doesn't block caller
   */
  async warmAll() {
    if (this.warmers.length === 0) {
      console.log('🔥 CacheWarmer: No caches registered for warming');
      return;
    }

    console.log(`🔥 CacheWarmer: Starting to warm ${this.warmers.length} cache(s)...`);
    const startTime = Date.now();

    // Run all warming functions in parallel
    const results = await Promise.allSettled(
      this.warmers.map(async ({ name, warmerFn }) => {
        const cacheStartTime = Date.now();
        try {
          await warmerFn();
          const duration = Date.now() - cacheStartTime;
          console.log(`✅ CacheWarmer: ${name} warmed in ${duration}ms`);
          return { name, success: true, duration };
        } catch (error) {
          const duration = Date.now() - cacheStartTime;
          console.warn(`⚠️ CacheWarmer: ${name} failed to warm (${duration}ms):`, error.message);
          
          // Send error to Sentry for monitoring
          Sentry.captureException(error, {
            level: 'warning',
            tags: {
              service: 'cache_warmer',
              cache_name: name,
              operation: 'cache_warming',
              duration_ms: duration
            },
            extra: {
              cacheName: name,
              duration,
              errorMessage: error.message,
              stackTrace: error.stack
            }
          });
          
          return { name, success: false, duration, error: error.message };
        }
      })
    );

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.length - successCount;

    console.log(`🔥 CacheWarmer: Completed in ${totalDuration}ms (${successCount} success, ${failureCount} failed)`);

    // Return summary for monitoring
    return {
      totalDuration,
      successCount,
      failureCount,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };
  }

  /**
   * Warm all caches asynchronously (fire and forget)
   * Safe to call during server startup - won't block
   */
  warmAllAsync() {
    // Don't await - let it run in background
    this.warmAll().catch(err => {
      console.error('❌ CacheWarmer: Unexpected error during cache warming:', err);
      
      // Send critical error to Sentry
      Sentry.captureException(err, {
        level: 'error',
        tags: {
          service: 'cache_warmer',
          operation: 'cache_warming_orchestration'
        },
        extra: {
          errorMessage: err.message,
          stackTrace: err.stack
        }
      });
    });
  }
}

module.exports = CacheWarmer;
