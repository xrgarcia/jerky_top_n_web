const { Queue } = require('bullmq');
const redisClient = require('./RedisClient');

/**
 * CoinRecalculationQueue - Manages async coin recalculation jobs
 * 
 * Purpose: Golden source for validating if users should still have awarded coins
 * Triggered when:
 * - Orders cancelled → Products become ineligible → Rankings deleted
 * - Fulfillment status downgrades → Products no longer delivered
 * - Future: Manual admin recalculation, achievement fixes
 * 
 * Job Types:
 * - Full recalculation (coinType: 'all') - Re-evaluate all coin types
 * - Targeted recalculation (coinType: 'engagement_collection', 'flavor_coin', etc.)
 */
class CoinRecalculationQueue {
  constructor() {
    this.queue = null;
  }

  /**
   * Initialize the queue with Redis connection
   */
  async initialize() {
    try {
      const baseClient = await redisClient.connect();
      
      if (!baseClient) {
        console.warn('⚠️ Redis not available, coin recalculation queue disabled');
        return false;
      }

      console.log('🔌 Creating dedicated Redis connection for coin recalculation queue...');
      
      // Duplicate the hardened RedisClient connection for BullMQ queue
      const queueConnection = baseClient.duplicate({
        lazyConnect: false,
        keepAlive: 30000,
        enableReadyCheck: true,
        maxRetriesPerRequest: null,
      });

      // Add error listener before connecting
      queueConnection.on('error', (err) => {
        console.error('❌ Coin recalculation queue Redis connection error:', err.message);
      });

      queueConnection.on('ready', () => {
        console.log('✅ Coin recalculation queue Redis connection READY');
      });

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Coin recalculation queue connection timeout after 10s'));
        }, 10000);

        queueConnection.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        queueConnection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.queue = new Queue('coin-recalculation', {
        connection: queueConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600,
            count: 100,
          },
          removeOnFail: {
            age: 86400,
            count: 1000,
          },
        },
      });

      console.log('✅ Coin recalculation queue initialized with hardened Redis connection');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize coin recalculation queue:', error);
      return false;
    }
  }

  /**
   * Enqueue a coin recalculation job for a user
   * @param {number} userId - User ID to recalculate coins for
   * @param {string} coinType - Type of coins to recalculate ('all', 'engagement_collection', 'flavor_coin', 'dynamic_collection', 'static_collection')
   * @param {string} reason - Reason for recalculation (e.g., 'order_cancelled', 'fulfillment_downgrade')
   * @param {object} context - Additional context (e.g., { deletedProductIds: [...], orderNumber: '...' })
   * @returns {Promise<boolean>} - True if enqueued successfully
   */
  async enqueue(userId, coinType = 'all', reason = 'manual', context = {}) {
    if (!this.queue) {
      console.warn('⚠️ Coin recalculation queue not initialized');
      return false;
    }

    try {
      await this.queue.add(
        'recalculate-coins',
        { 
          userId, 
          coinType, 
          reason, 
          context,
          enqueuedAt: new Date().toISOString() 
        },
        {
          jobId: `recalc-${userId}-${Date.now()}`, // Unique job ID (allow multiple jobs per user)
          priority: reason === 'order_cancelled' ? 1 : 10, // Order cancellations get higher priority
        }
      );

      console.log(`🪙 Enqueued coin recalculation for user ${userId} (coinType: ${coinType}, reason: ${reason})`);
      return true;
    } catch (error) {
      console.error('❌ Failed to enqueue coin recalculation job:', error);
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
      console.log('🗑️ Coin recalculation queue cleaned');
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
      console.log('👋 Coin recalculation queue closed');
    }
  }
}

// Singleton instance
const coinRecalculationQueue = new CoinRecalculationQueue();

module.exports = coinRecalculationQueue;
