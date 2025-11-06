const { Queue } = require('bullmq');
const redisClient = require('./RedisClient');

/**
 * BulkImportQueue - Manages async bulk user import jobs
 * 
 * Processes individual user import jobs:
 * 1. Fetch and sync user's complete order history from Shopify
 * 2. Mark user's import as complete
 * 3. Trigger classification job for personalized guidance
 */
class BulkImportQueue {
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
        console.warn('⚠️ Redis not available, bulk import queue disabled');
        return false;
      }

      // BullMQ requires a Redis connection config
      const redisConfig = {
        host: redis.options.host,
        port: redis.options.port,
        password: redis.options.password,
        tls: redis.options.tls,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };

      this.queue = new Queue('bulk-import', {
        connection: redisConfig,
        defaultJobOptions: {
          attempts: 3, // Retry failed jobs up to 3 times
          backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5s delay, doubles each retry
          },
          removeOnComplete: {
            age: 7200, // Keep completed jobs for 2 hours
            count: 500, // Keep last 500 completed jobs
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
            count: 1000, // Keep last 1000 failed jobs
          },
        },
      });

      console.log('✅ Bulk import queue initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize bulk import queue:', error);
      return false;
    }
  }

  /**
   * Enqueue a user import job
   * @param {number} userId - User ID to import
   * @param {string} shopifyCustomerId - Shopify customer ID
   * @param {string} email - User email
   * @returns {Promise<boolean>} - True if enqueued successfully
   */
  async enqueueUserImport(userId, shopifyCustomerId, email) {
    if (!this.queue) {
      console.warn('⚠️ Bulk import queue not initialized');
      return false;
    }

    try {
      await this.queue.add(
        'import-user',
        { 
          userId, 
          shopifyCustomerId, 
          email,
          enqueuedAt: new Date().toISOString() 
        },
        {
          jobId: `import-user-${userId}`, // Deduplication: only one import job per user
        }
      );

      console.log(`📋 Enqueued import job for user ${userId} (${email})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to enqueue import job for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Enqueue multiple user import jobs in bulk
   * @param {Array} users - Array of user objects { userId, shopifyCustomerId, email }
   * @returns {Promise<Object>} - { enqueued: number, failed: number }
   */
  async enqueueBulk(users) {
    if (!this.queue) {
      console.warn('⚠️ Bulk import queue not initialized');
      return { enqueued: 0, failed: users.length };
    }

    try {
      const jobs = users.map(user => ({
        name: 'import-user',
        data: {
          userId: user.userId,
          shopifyCustomerId: user.shopifyCustomerId,
          email: user.email,
          enqueuedAt: new Date().toISOString()
        },
        opts: {
          jobId: `import-user-${user.userId}`,
        }
      }));

      await this.queue.addBulk(jobs);
      
      console.log(`📋 Bulk enqueued ${users.length} import jobs`);
      return { enqueued: users.length, failed: 0 };
    } catch (error) {
      console.error('❌ Failed to bulk enqueue import jobs:', error);
      return { enqueued: 0, failed: users.length };
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} - Queue stats
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
      console.error('❌ Failed to get bulk import queue stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Get recent jobs for monitoring
   * @param {number} limit - Number of jobs to fetch
   * @returns {Promise<Array>} - Recent jobs
   */
  async getRecentJobs(limit = 10) {
    if (!this.queue) {
      return [];
    }

    try {
      const [completed, failed] = await Promise.all([
        this.queue.getCompleted(0, limit - 1),
        this.queue.getFailed(0, limit - 1),
      ]);

      const jobs = [...completed, ...failed]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return jobs.map(job => ({
        id: job.id,
        userId: job.data.userId,
        email: job.data.email,
        state: job.failedReason ? 'failed' : 'completed',
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      }));
    } catch (error) {
      console.error('❌ Failed to get recent jobs:', error);
      return [];
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
      console.log('🗑️ Bulk import queue cleaned');
    } catch (error) {
      console.error('❌ Failed to clean bulk import queue:', error);
    }
  }

  /**
   * Close the queue connection
   */
  async close() {
    if (this.queue) {
      await this.queue.close();
      console.log('👋 Bulk import queue closed');
    }
  }
}

// Singleton instance
const bulkImportQueue = new BulkImportQueue();

module.exports = bulkImportQueue;
