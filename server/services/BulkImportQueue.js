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
            count: 50000, // Keep last 50,000 completed jobs (supports large imports)
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
            count: 10000, // Keep last 10,000 failed jobs
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
   * Handles large-scale imports (100K+ users) by chunking to avoid Redis Lua script timeouts
   * @param {Array} users - Array of user objects { userId, shopifyCustomerId, email }
   * @param {Object} options - Enqueue options
   * @param {number} options.chunkSize - Number of jobs to enqueue per batch (default: 100)
   * @param {number} options.delayBetweenChunks - Delay in ms between chunks (default: 100ms)
   * @returns {Promise<Object>} - { enqueued: number, failed: number }
   */
  async enqueueBulk(users, options = {}) {
    const { chunkSize = 100, delayBetweenChunks = 100 } = options;

    if (!this.queue) {
      console.warn('⚠️ Bulk import queue not initialized');
      return { enqueued: 0, failed: users.length };
    }

    if (users.length === 0) {
      return { enqueued: 0, failed: 0 };
    }

    let totalEnqueued = 0;
    let totalFailed = 0;

    try {
      console.log(`📋 Bulk enqueueing ${users.length} import jobs (chunk size: ${chunkSize})...`);

      for (let i = 0; i < users.length; i += chunkSize) {
        const chunk = users.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(users.length / chunkSize);

        try {
          const jobs = chunk.map(user => ({
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
          totalEnqueued += chunk.length;

          if (chunkNumber % 10 === 0 || chunkNumber === totalChunks) {
            console.log(`  Progress: ${totalEnqueued}/${users.length} jobs enqueued (chunk ${chunkNumber}/${totalChunks})`);
          }

          if (i + chunkSize < users.length && delayBetweenChunks > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenChunks));
          }

        } catch (chunkError) {
          console.error(`❌ Failed to enqueue chunk ${chunkNumber}/${totalChunks}:`, chunkError.message);
          totalFailed += chunk.length;
        }
      }

      console.log(`✅ Bulk enqueue complete: ${totalEnqueued} succeeded, ${totalFailed} failed`);
      return { enqueued: totalEnqueued, failed: totalFailed };

    } catch (error) {
      console.error('❌ Fatal error in bulk enqueue:', error);
      return { enqueued: totalEnqueued, failed: users.length - totalEnqueued };
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
   * Enqueue all pending users from the database
   * Use this to recover from incomplete imports
   * @param {Object} options - Enqueue options
   * @param {number} options.batchSize - Number of users to fetch from DB at a time (default: 5000)
   * @param {number} options.chunkSize - Number of jobs to enqueue per Redis operation (default: 100)
   * @returns {Promise<Object>} - { totalEnqueued: number, totalFailed: number }
   */
  async enqueueAllPendingUsers(options = {}) {
    const { batchSize = 5000, chunkSize = 100 } = options;

    if (!this.queue) {
      console.warn('⚠️ Bulk import queue not initialized');
      return { totalEnqueued: 0, totalFailed: 0, error: 'Queue not initialized' };
    }

    try {
      const { primaryDb } = require('../db-primary');
      const { users } = require('../../shared/schema');
      const { eq } = require('drizzle-orm');

      let totalEnqueued = 0;
      let totalFailed = 0;
      let offset = 0;

      console.log('🚀 Starting to enqueue all pending users...');

      while (true) {
        const pendingUsers = await primaryDb
          .select({
            id: users.id,
            shopifyCustomerId: users.shopifyCustomerId,
            email: users.email
          })
          .from(users)
          .where(eq(users.importStatus, 'pending'))
          .limit(batchSize)
          .offset(offset);

        if (pendingUsers.length === 0) {
          console.log('✅ No more pending users to enqueue');
          break;
        }

        console.log(`📋 Processing batch of ${pendingUsers.length} pending users (offset: ${offset})...`);

        const usersToEnqueue = pendingUsers.map(u => ({
          userId: u.id,
          shopifyCustomerId: u.shopifyCustomerId,
          email: u.email
        }));

        const result = await this.enqueueBulk(usersToEnqueue, { chunkSize, delayBetweenChunks: 100 });
        totalEnqueued += result.enqueued;
        totalFailed += result.failed;

        console.log(`  ✓ Batch complete (total enqueued: ${totalEnqueued}, total failed: ${totalFailed})`);

        offset += batchSize;
      }

      console.log(`🎉 Finished enqueuing pending users: ${totalEnqueued} succeeded, ${totalFailed} failed`);
      return { totalEnqueued, totalFailed };

    } catch (error) {
      console.error('❌ Error enqueuing pending users:', error);
      return { totalEnqueued: 0, totalFailed: 0, error: error.message };
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
