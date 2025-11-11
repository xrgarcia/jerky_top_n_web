const { Queue } = require('bullmq');
const redisClient = require('./RedisClient');

/**
 * WebhookQueue - Manages async Shopify webhook processing
 * 
 * Handles all 3 webhook types:
 * - orders (orders/created, orders/updated, orders/cancelled)
 * - products (products/create, products/update, products/delete)
 * - customers (customers/create, customers/update)
 * 
 * Benefits:
 * - Fast webhook response (<100ms) - prevents Shopify retries
 * - Resilient to DB connection failures with automatic retries
 * - Automatic job cleanup (1hr for success, 24hrs for failures)
 * - Built-in monitoring via BullMQ
 */
class WebhookQueue {
  constructor() {
    this.queue = null;
  }

  /**
   * Initialize the queue with Redis connection
   */
  async initialize() {
    try {
      const redis = await redisClient.connect();
      
      if (!redis) {
        console.warn('⚠️ Redis not available, webhook queue disabled');
        return false;
      }

      // BullMQ requires a Redis connection config
      const redisConfig = {
        host: redis.options.host,
        port: redis.options.port,
        password: redis.options.password,
        tls: redis.options.tls,
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
      };

      this.queue = new Queue('shopify-webhooks', {
        connection: redisConfig,
        defaultJobOptions: {
          attempts: 3, // Retry failed jobs up to 3 times
          backoff: {
            type: 'exponential',
            delay: 1000, // Start with 1s delay, doubles each retry (1s, 2s, 4s)
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100, // Keep last 100 completed jobs
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
            count: 1000, // Keep last 1000 failed jobs for debugging
          },
        },
      });

      console.log('✅ Webhook queue initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize webhook queue:', error);
      return false;
    }
  }

  /**
   * Enqueue a webhook for async processing
   * @param {string} type - Webhook type: 'orders', 'products', or 'customers'
   * @param {string} topic - Shopify webhook topic (e.g., 'orders/created')
   * @param {Object} data - Webhook payload data
   * @param {Object} metadata - Additional metadata (shopDomain, receivedAt, etc.)
   * @returns {Promise<Object>} - Job object
   */
  async enqueue(type, topic, data, metadata = {}) {
    if (!this.queue) {
      throw new Error('Webhook queue not initialized');
    }

    const jobData = {
      type,
      topic,
      data,
      metadata: {
        ...metadata,
        enqueuedAt: Date.now(),
      },
    };

    // Use topic + timestamp as job ID to allow duplicate webhooks from Shopify retries
    // (Shopify may retry if they don't get a fast 200 response)
    const jobId = `${type}:${topic}:${Date.now()}`;

    const job = await this.queue.add(type, jobData, {
      jobId,
      // Priority: orders are most important (they affect user data)
      priority: type === 'orders' ? 1 : type === 'customers' ? 2 : 3,
    });

    console.log(`📋 Webhook enqueued: ${type}/${topic} (job: ${job.id})`);
    return job;
  }

  /**
   * Get queue statistics for monitoring
   * @returns {Promise<Object>} - Queue stats
   */
  async getStats() {
    if (!this.queue) {
      return null;
    }

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
  }

  /**
   * Clean up old jobs manually (normally auto-cleanup handles this)
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (!this.queue) {
      return;
    }

    try {
      // Clean jobs older than configured retention
      await this.queue.clean(3600 * 1000, 100, 'completed'); // 1 hour for completed
      await this.queue.clean(86400 * 1000, 1000, 'failed'); // 24 hours for failed
      console.log('✅ Webhook queue cleanup completed');
    } catch (error) {
      console.error('❌ Error cleaning webhook queue:', error);
    }
  }

  /**
   * Check if queue is ready
   * @returns {boolean}
   */
  isReady() {
    return this.queue !== null;
  }
}

// Export singleton instance
module.exports = new WebhookQueue();
