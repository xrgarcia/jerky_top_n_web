const { Queue } = require('bullmq');
const redisClient = require('./RedisClient');

/**
 * ClassificationQueue - Manages async user classification jobs with smart hybrid debouncing
 * 
 * Smart Hybrid Strategy:
 * - First activity → Immediate queue job (0 delay)
 * - Subsequent activities → Throttled (max 1 job per 5 minutes per user)
 * 
 * Uses Redis to track last calculation time for debouncing
 */
class ClassificationQueue {
  constructor() {
    this.queue = null;
    this.THROTTLE_WINDOW_SECONDS = 300; // 5 minutes
    this.REDIS_KEY_PREFIX = 'classification:last_calc:';
  }

  /**
   * Initialize the queue with Redis connection
   */
  async initialize() {
    try {
      const redis = await redisClient.connect();
      
      if (!redis) {
        console.warn('⚠️ Redis not available, classification queue disabled');
        return false;
      }

      // BullMQ requires a Redis connection config
      // We can extract the config from our existing ioredis client
      const redisConfig = {
        host: redis.options.host,
        port: redis.options.port,
        password: redis.options.password,
        tls: redis.options.tls,
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
      };

      this.queue = new Queue('user-classification', {
        connection: redisConfig,
        defaultJobOptions: {
          attempts: 3, // Retry failed jobs up to 3 times
          backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2s delay, doubles each retry
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100, // Keep last 100 completed jobs
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
            count: 1000, // Keep last 1000 failed jobs
          },
        },
      });

      console.log('✅ Classification queue initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize classification queue:', error);
      return false;
    }
  }

  /**
   * Check if user needs classification recalculation (smart hybrid debouncing)
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - True if should enqueue, false if throttled
   */
  async shouldEnqueue(userId) {
    if (!this.queue) {
      return false; // Queue not available
    }

    const redis = redisClient.getClient();
    if (!redis) {
      return false;
    }

    try {
      const key = `${this.REDIS_KEY_PREFIX}${userId}`;
      const lastCalc = await redis.get(key);

      if (!lastCalc) {
        // First activity - immediate enqueue
        return true;
      }

      const lastCalcTime = parseInt(lastCalc, 10);
      const now = Date.now();
      const elapsedSeconds = (now - lastCalcTime) / 1000;

      // Throttle: Only enqueue if more than 5 minutes since last calculation
      return elapsedSeconds >= this.THROTTLE_WINDOW_SECONDS;
    } catch (error) {
      console.error('❌ Error checking throttle status:', error);
      return true; // Default to allowing enqueue on error
    }
  }

  /**
   * Update last calculation time for user (called after successful classification)
   * @param {number} userId - User ID
   */
  async markCalculated(userId) {
    const redis = redisClient.getClient();
    if (!redis) return;

    try {
      const key = `${this.REDIS_KEY_PREFIX}${userId}`;
      const now = Date.now();
      
      // Store timestamp with 1 hour TTL (cleanup old entries)
      await redis.setex(key, 3600, now.toString());
    } catch (error) {
      console.error('❌ Error marking classification time:', error);
    }
  }

  /**
   * Enqueue a classification job for a user
   * @param {number} userId - User ID to classify
   * @param {string} reason - Reason for classification (e.g., 'ranking', 'search', 'purchase')
   * @returns {Promise<boolean>} - True if enqueued, false if throttled
   */
  async enqueue(userId, reason = 'activity') {
    if (!this.queue) {
      console.warn('⚠️ Classification queue not initialized');
      return false;
    }

    // Check if should enqueue (smart hybrid debouncing)
    const shouldEnqueue = await this.shouldEnqueue(userId);
    
    if (!shouldEnqueue) {
      console.log(`🔄 Classification throttled for user ${userId} (last calc < 5 min ago)`);
      return false;
    }

    try {
      // Add job to queue with deduplication (one job per user)
      await this.queue.add(
        'classify-user',
        { userId, reason, enqueuedAt: new Date().toISOString() },
        {
          jobId: `user-${userId}`, // Deduplication: only one job per user at a time
          priority: reason === 'purchase' ? 1 : 10, // Purchases get higher priority
        }
      );

      console.log(`📋 Enqueued classification job for user ${userId} (reason: ${reason})`);
      return true;
    } catch (error) {
      console.error('❌ Failed to enqueue classification job:', error);
      return false;
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<object>} - Queue stats
   */
  async getStats() {
    if (!this.queue) {
      return { error: 'Queue not initialized' };
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error) {
      console.error('❌ Failed to get queue stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Clear all completed and failed jobs
   */
  async clean() {
    if (!this.queue) return;

    try {
      await this.queue.clean(0, 1000, 'completed');
      await this.queue.clean(0, 1000, 'failed');
      console.log('🗑️ Classification queue cleaned');
    } catch (error) {
      console.error('❌ Failed to clean queue:', error);
    }
  }

  /**
   * Close the queue connection
   */
  async close() {
    if (this.queue) {
      await this.queue.close();
      console.log('👋 Classification queue closed');
    }
  }
}

// Singleton instance
const classificationQueue = new ClassificationQueue();

module.exports = classificationQueue;
