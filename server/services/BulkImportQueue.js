const { Queue } = require('bullmq');
const redisClient = require('./RedisClient');
const { primaryDb } = require('../db-primary');
const { sql } = require('drizzle-orm');

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
      // Get the correct Redis URL based on environment
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
      const redisUrl = isProduction 
        ? process.env.UPSTASH_REDIS_URL_PROD 
        : process.env.UPSTASH_REDIS_URL;
      
      if (!redisUrl) {
        console.warn('⚠️ Redis URL not available, bulk import queue disabled');
        return false;
      }

      // Ensure Redis client is connected (for other operations)
      await redisClient.connect();

      // BullMQ Queue accepts Redis URL directly
      this.queue = new Queue('bulk-import', {
        connection: {
          url: redisUrl,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
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
   * @param {boolean} isReprocess - Whether this is a reprocess job (default: false)
   * @returns {Promise<boolean>} - True if enqueued successfully
   */
  async enqueueUserImport(userId, shopifyCustomerId, email, isReprocess = false) {
    if (!this.queue) {
      console.warn('⚠️ Bulk import queue not initialized');
      return false;
    }

    try {
      const jobName = isReprocess ? 'reprocess-user' : 'import-user';
      const jobId = isReprocess ? `reprocess-user-${userId}` : `import-user-${userId}`;
      
      await this.queue.add(
        jobName,
        { 
          userId, 
          shopifyCustomerId, 
          email,
          isReprocess,
          enqueuedAt: new Date().toISOString() 
        },
        {
          jobId, // Deduplication: only one import/reprocess job per user
        }
      );

      console.log(`📋 Enqueued ${isReprocess ? 'reprocess' : 'import'} job for user ${userId} (${email})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to enqueue ${isReprocess ? 'reprocess' : 'import'} job for user ${userId}:`, error);
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
    const { chunkSize = 50, delayBetweenChunks = 100 } = options;

    if (!this.queue) {
      console.warn('⚠️ Bulk import queue not initialized');
      
      // Persist all users as failed since queue is unavailable
      for (const user of users) {
        await this.persistFailedEnqueue(
          user.userId,
          user.shopifyCustomerId,
          user.email,
          'Queue not initialized - Redis unavailable'
        );
      }
      
      return { enqueued: 0, failed: users.length };
    }

    if (users.length === 0) {
      return { enqueued: 0, failed: 0 };
    }

    let totalEnqueued = 0;
    let totalFailed = 0;
    let processedUserIds = new Set(); // Track which users we've attempted

    try {
      console.log(`📋 Bulk enqueueing ${users.length} import jobs (chunk size: ${chunkSize})...`);

      for (let i = 0; i < users.length; i += chunkSize) {
        const chunk = users.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(users.length / chunkSize);

        try {
          const jobs = chunk.map(user => ({
            name: user.isReprocess ? 'reprocess-user' : 'import-user',
            data: {
              userId: user.userId,
              shopifyCustomerId: user.shopifyCustomerId,
              email: user.email,
              isReprocess: user.isReprocess || false,
              enqueuedAt: new Date().toISOString()
            },
            opts: {
              jobId: user.isReprocess ? `reprocess-user-${user.userId}` : `import-user-${user.userId}`,
            }
          }));

          try {
            await this.queue.addBulk(jobs);
            totalEnqueued += chunk.length;
            // Mark all users in chunk as processed
            chunk.forEach(user => processedUserIds.add(user.userId));
          } catch (bulkError) {
            const isLuaTimeout = bulkError.message && 
              (bulkError.message.includes('Lua script execution limit') || 
               bulkError.message.includes('BUSY'));
            
            if (isLuaTimeout) {
              console.log(`  ⚠️ Chunk ${chunkNumber}: Lua timeout, falling back to individual adds with exponential backoff...`);
              
              let chunkEnqueued = 0;
              let chunkFailed = 0;
              const maxRetries = 5;
              
              for (const job of jobs) {
                let jobEnqueued = false;
                
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                  try {
                    await this.queue.add(job.name, job.data, job.opts);
                    chunkEnqueued++;
                    totalEnqueued++;
                    jobEnqueued = true;
                    break;
                  } catch (singleError) {
                    const isDuplicate = 
                      (singleError.message && singleError.message.toLowerCase().includes('already exists')) ||
                      (singleError.name === 'JobExistsError') ||
                      (singleError.code === 'JOB_EXISTS');
                    
                    if (isDuplicate) {
                      chunkEnqueued++;
                      totalEnqueued++;
                      jobEnqueued = true;
                      break;
                    }
                    
                    if (attempt < maxRetries) {
                      const backoffMs = Math.min(Math.pow(2, attempt) * 500, 8000);
                      await new Promise(resolve => setTimeout(resolve, backoffMs));
                    }
                  }
                }
                
                if (!jobEnqueued) {
                  chunkFailed++;
                  totalFailed++;
                  
                  await this.persistFailedEnqueue(
                    job.data.userId,
                    job.data.shopifyCustomerId,
                    job.data.email,
                    'Exceeded max retries during Redis Lua timeout'
                  );
                }
                
                // Mark user as processed (success or fail)
                processedUserIds.add(job.data.userId);
              }
              
              console.log(`  ✓ Chunk ${chunkNumber}: Individual adds completed (${chunkEnqueued}/${chunk.length} succeeded, ${chunkFailed} failed)`);
              
              if (chunkFailed > chunk.length * 0.3) {
                const cooldownSec = chunkFailed > chunk.length * 0.7 ? 10 : 5;
                console.log(`  ⚠️ High failure rate (${chunkFailed}/${chunk.length}), adding ${cooldownSec}s cooldown...`);
                await new Promise(resolve => setTimeout(resolve, cooldownSec * 1000));
              }
            } else {
              throw bulkError;
            }
          }

          if (chunkNumber % 10 === 0 || chunkNumber === totalChunks) {
            console.log(`  Progress: ${totalEnqueued}/${users.length} jobs enqueued (chunk ${chunkNumber}/${totalChunks})`);
          }

          if (i + chunkSize < users.length && delayBetweenChunks > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenChunks));
          }

        } catch (chunkError) {
          console.error(`❌ Failed to enqueue chunk ${chunkNumber}/${totalChunks}:`, chunkError.message);
          
          // Persist all failed jobs in this chunk
          for (const user of chunk) {
            await this.persistFailedEnqueue(
              user.userId,
              user.shopifyCustomerId,
              user.email,
              chunkError.message
            );
            totalFailed++;
            processedUserIds.add(user.userId);
          }
        }
      }

      console.log(`✅ Bulk enqueue complete: ${totalEnqueued} succeeded, ${totalFailed} failed`);
      return { enqueued: totalEnqueued, failed: totalFailed };

    } catch (error) {
      console.error('❌ Fatal error in bulk enqueue:', error);
      
      // Persist any unprocessed users to avoid data loss
      const unprocessedUsers = users.filter(u => !processedUserIds.has(u.userId));
      if (unprocessedUsers.length > 0) {
        console.warn(`⚠️ Persisting ${unprocessedUsers.length} unprocessed users due to fatal error...`);
        for (const user of unprocessedUsers) {
          await this.persistFailedEnqueue(
            user.userId,
            user.shopifyCustomerId,
            user.email,
            `Fatal error: ${error.message}`
          );
        }
        totalFailed += unprocessedUsers.length;
      }
      
      return { enqueued: totalEnqueued, failed: totalFailed, error: error.message };
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
    const { batchSize = 5000, chunkSize = 50 } = options;

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
   * Obliterate ALL jobs in the queue (waiting, active, delayed, completed, failed)
   * Use this to completely reset the queue
   * @returns {Promise<Object>} - { removed: number, error?: string }
   */
  async obliterate() {
    if (!this.queue) {
      return { removed: 0, error: 'Queue not initialized' };
    }

    try {
      console.log('🗑️ Obliterating ALL jobs in bulk import queue...');
      
      // Get counts before deletion
      const stats = await this.getStats();
      const totalBefore = stats.total || 0;

      // Obliterate removes all jobs regardless of state
      await this.queue.obliterate({ force: true });
      
      console.log(`✅ Obliterated ${totalBefore} jobs from bulk import queue`);
      return { removed: totalBefore };
    } catch (error) {
      console.error('❌ Failed to obliterate queue:', error);
      return { removed: 0, error: error.message };
    }
  }

  /**
   * Clear only completed jobs
   * @returns {Promise<Object>} - { removed: number, error?: string }
   */
  async clearCompleted() {
    if (!this.queue) {
      return { removed: 0, error: 'Queue not initialized' };
    }

    try {
      console.log('🗑️ Clearing completed jobs...');
      
      const completedCount = await this.queue.getCompletedCount();
      
      // Clean all completed jobs (age: 0 = all, limit: large number)
      await this.queue.clean(0, 100000, 'completed');
      
      console.log(`✅ Cleared ${completedCount} completed jobs`);
      return { removed: completedCount };
    } catch (error) {
      console.error('❌ Failed to clear completed jobs:', error);
      return { removed: 0, error: error.message };
    }
  }

  /**
   * Clear only failed jobs
   * @returns {Promise<Object>} - { removed: number, error?: string }
   */
  async clearFailed() {
    if (!this.queue) {
      return { removed: 0, error: 'Queue not initialized' };
    }

    try {
      console.log('🗑️ Clearing failed jobs...');
      
      const failedCount = await this.queue.getFailedCount();
      
      // Clean all failed jobs
      await this.queue.clean(0, 100000, 'failed');
      
      console.log(`✅ Cleared ${failedCount} failed jobs`);
      return { removed: failedCount };
    } catch (error) {
      console.error('❌ Failed to clear failed jobs:', error);
      return { removed: 0, error: error.message };
    }
  }

  /**
   * Persist a failed enqueue attempt to the database for later retry
   * @param {number} userId - User ID
   * @param {string} shopifyCustomerId - Shopify customer ID
   * @param {string} email - User email
   * @param {string} errorMessage - Error message
   */
  async persistFailedEnqueue(userId, shopifyCustomerId, email, errorMessage) {
    try {
      await primaryDb.execute(sql`
        INSERT INTO failed_enqueue_jobs (user_id, shopify_customer_id, email, error_message, retry_count)
        VALUES (${userId}, ${shopifyCustomerId}, ${email}, ${errorMessage}, 0)
        ON CONFLICT (user_id) DO UPDATE SET
          error_message = ${errorMessage},
          last_retry_at = CURRENT_TIMESTAMP
      `);
    } catch (error) {
      console.error(`Failed to persist failed enqueue for user ${userId}:`, error.message);
    }
  }

  /**
   * Retry all unresolved failed enqueues
   * @param {number} limit - Max number of failed jobs to retry (default: 100)
   * @returns {Promise<Object>} - { retried: number, succeeded: number, failed: number }
   */
  async retryFailedEnqueues(limit = 100) {
    if (!this.queue) {
      console.warn('⚠️ Bulk import queue not initialized');
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    try {
      const failedJobs = await primaryDb.execute(sql`
        SELECT user_id, shopify_customer_id, email, retry_count
        FROM failed_enqueue_jobs
        WHERE resolved_at IS NULL
        ORDER BY created_at ASC
        LIMIT ${limit}
      `);

      if (failedJobs.rows.length === 0) {
        console.log('✅ No failed enqueues to retry');
        return { retried: 0, succeeded: 0, failed: 0 };
      }

      console.log(`🔄 Retrying ${failedJobs.rows.length} failed enqueues...`);

      const usersToRetry = failedJobs.rows.map(row => ({
        userId: row.user_id,
        shopifyCustomerId: row.shopify_customer_id,
        email: row.email
      }));

      // Track which users successfully enqueued
      const successMap = new Map();
      const failedUserIds = [];
      
      // Process each user individually to track success
      for (const user of usersToRetry) {
        try {
          const job = await this.queue.add('import-user', {
            userId: user.userId,
            shopifyCustomerId: user.shopifyCustomerId,
            email: user.email,
            enqueuedAt: new Date().toISOString()
          }, {
            jobId: `import-user-${user.userId}`,
          });
          
          successMap.set(user.userId, true);
        } catch (error) {
          const isDuplicate = 
            (error.message && error.message.toLowerCase().includes('already exists')) ||
            (error.name === 'JobExistsError') ||
            (error.code === 'JOB_EXISTS');
          
          if (isDuplicate) {
            successMap.set(user.userId, true);
          } else {
            failedUserIds.push(user.userId);
          }
        }
        
        // Small delay between retries
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark successfully enqueued jobs as resolved
      for (const [userId, success] of successMap) {
        if (success) {
          await primaryDb.execute(sql`
            UPDATE failed_enqueue_jobs
            SET resolved_at = CURRENT_TIMESTAMP,
                retry_count = retry_count + 1
            WHERE user_id = ${userId}
          `);
        }
      }
      
      // Update retry count for failed jobs
      for (const userId of failedUserIds) {
        await primaryDb.execute(sql`
          UPDATE failed_enqueue_jobs
          SET retry_count = retry_count + 1,
              last_retry_at = CURRENT_TIMESTAMP
          WHERE user_id = ${userId}
        `);
      }

      return {
        retried: failedJobs.rows.length,
        succeeded: successMap.size,
        failed: failedUserIds.length
      };
    } catch (error) {
      console.error('Failed to retry failed enqueues:', error);
      return { retried: 0, succeeded: 0, failed: 0, error: error.message };
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
