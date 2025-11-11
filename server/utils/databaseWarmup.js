/**
 * Database Warmup Utility
 * Ensures Neon Serverless database is query-ready before proceeding with initialization
 * 
 * Problem: Neon serverless databases can "sleep" when idle and need 3-5 seconds to wake up
 * Solution: Ping database with retries until it responds successfully
 */

const Sentry = require('@sentry/node');

/**
 * Wait for database to be query-ready
 * @param {object} db - Drizzle database instance
 * @param {object} options - Configuration options
 * @returns {Promise<{success: boolean, duration: number, attempts: number}>} - Warmup metadata
 */
async function waitForDatabaseReady(db, options = {}) {
  const {
    maxRetries = 10,
    retryDelayMs = 1000,
    timeoutMs = 30000,
    pingQuery = 'SELECT 1 as ping'
  } = options;

  const startTime = Date.now();
  let attempt = 0;

  console.log('🔌 Warming up database connection...');

  while (attempt < maxRetries) {
    attempt++;
    
    // Check if we've exceeded total timeout
    if (Date.now() - startTime > timeoutMs) {
      const duration = Date.now() - startTime;
      const error = new Error(`Database warmup timeout after ${timeoutMs}ms`);
      console.error(`❌ Database warmup failed: ${error.message}`);
      
      Sentry.captureException(error, {
        level: 'error',
        tags: {
          service: 'database_warmup',
          operation: 'warmup_timeout'
        },
        extra: {
          attempts: attempt,
          durationMs: duration,
          maxRetries,
          timeoutMs
        }
      });
      
      throw error;
    }

    try {
      // Use raw SQL to avoid Drizzle query builder overhead
      const { sql } = require('drizzle-orm');
      const result = await db.execute(sql.raw(pingQuery));
      
      const duration = Date.now() - startTime;
      const isColdStart = duration > 1000 || attempt > 1;
      
      console.log(`✅ Database is query-ready (${attempt} attempt${attempt > 1 ? 's' : ''}, ${duration}ms)${isColdStart ? ' [COLD START DETECTED]' : ''}`);
      
      // Return metadata for intelligent cache warming
      return {
        success: true,
        duration,
        attempts: attempt,
        isColdStart
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.log(`⏳ Database not ready yet (attempt ${attempt}/${maxRetries}, ${elapsed}ms)...`);
      
      // Don't wait on the last attempt
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  // If we get here, all retries failed
  const duration = Date.now() - startTime;
  const error = new Error(`Database warmup failed after ${maxRetries} attempts`);
  console.error(`❌ ${error.message}`);
  
  Sentry.captureException(error, {
    level: 'error',
    tags: {
      service: 'database_warmup',
      operation: 'warmup_max_retries'
    },
    extra: {
      attempts: maxRetries,
      durationMs: duration,
      retryDelayMs
    }
  });
  
  throw error;
}

/**
 * Retry a database operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {object} options - Retry configuration
 * @returns {Promise<any>} - Result of operation
 */
async function retryDatabaseOperation(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 5000,
    operationName = 'database operation'
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        console.error(`❌ ${operationName} failed after ${maxRetries} attempts:`, error.message);
        break;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      console.log(`⏳ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  waitForDatabaseReady,
  retryDatabaseOperation
};
