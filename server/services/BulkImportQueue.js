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
   * Enqueue multiple user import jobs in bulk with progress callbacks
   * Wraps enqueueBulk with progress tracking by processing in smaller batches
   * Maintains all retry logic and failure persistence from enqueueBulk
   * @param {Array} users - Array of user objects
   * @param {Object} options - Enqueue options
   * @param {number} options.progressBatchSize - Report progress after this many users (default: 500)
   * @param {Function} options.onProgress - Callback(enqueued, total)
   * @returns {Promise<Object>} - { enqueued, failed }
   */
  async enqueueBulkWithProgress(users, options = {}) {
    const { progressBatchSize = 500, onProgress = null } = options;

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
      console.log(`📋 Bulk enqueueing ${users.length} import jobs with progress tracking (batch: ${progressBatchSize})...`);

      // Process in batches to emit progress updates
      for (let i = 0; i < users.length; i += progressBatchSize) {
        const batch = users.slice(i, i + progressBatchSize);
        const batchNumber = Math.floor(i / progressBatchSize) + 1;
        const totalBatches = Math.ceil(users.length / progressBatchSize);

        console.log(`  📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)...`);

        // Use the robust enqueueBulk method with all its retry/fallback logic
        const batchResult = await this.enqueueBulk(batch);
        
        totalEnqueued += batchResult.enqueued;
        totalFailed += batchResult.failed;

        // Call progress callback after each batch
        if (onProgress && typeof onProgress === 'function') {
          await onProgress(totalEnqueued, users.length);
        }

        console.log(`  ✅ Batch ${batchNumber}/${totalBatches} complete: ${batchResult.enqueued} enqueued, ${batchResult.failed} failed`);
        console.log(`     📊 Total progress: ${totalEnqueued}/${users.length} enqueued (${Math.round(totalEnqueued/users.length*100)}%)`);
      }

      console.log(`✅ Bulk enqueue with progress complete: ${totalEnqueued}/${users.length} enqueued, ${totalFailed} failed`);

      return {
        enqueued: totalEnqueued,
        failed: totalFailed
      };
    } catch (error) {
      console.error('❌ enqueueBulkWithProgress failed:', error);
      return {
        enqueued: totalEnqueued,
        failed: totalFailed,
        error: error.message
      };
    }
  }

  /**
   * Get direct Redis counts for queue keys (bypasses BullMQ retention limits)
   * Shows total jobs in Redis storage, including those aged out by retention policy
   * @returns {Promise<Object>} - Direct Redis counts
   */
  async getRedisStats() {
    if (!this.queue) {
      console.log('⚠️ [getRedisStats] Queue not initialized');
      return { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 };
    }

    try {
      console.log('🔍 [getRedisStats] Getting Redis connection from shared client...');
      
      // Use the shared redisClient instead of this.queue.client
      // BullMQ's Queue.client is a lazy getter that only resolves after first operation
      // Using the shared client avoids hanging when no jobs have been processed yet
      const redis = redisClient.getClient();
      
      if (!redis) {
        console.warn('⚠️ [getRedisStats] Redis client not available');
        return { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 };
      }
      
      console.log('🔍 [getRedisStats] Redis connection obtained, querying stats...');
      
      // Helper function to add timeout to Redis commands
      const withTimeout = (promise, ms = 3000, label = 'Redis command') => {
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
        );
        return Promise.race([promise, timeout]);
      };
      
      // BullMQ stores different states in different Redis data structures:
      // - waiting, active: Redis Lists (use LLEN)
      // - completed, failed, delayed: Redis Sorted Sets (use ZCARD)
      const [waiting, active, completed, failed] = await Promise.all([
        withTimeout(redis.llen('bull:bulk-import:wait'), 3000, 'llen wait').catch(err => { console.log('  ⚠️ llen wait error:', err.message); return 0; }),
        withTimeout(redis.llen('bull:bulk-import:active'), 3000, 'llen active').catch(err => { console.log('  ⚠️ llen active error:', err.message); return 0; }),
        withTimeout(redis.zcard('bull:bulk-import:completed'), 3000, 'zcard completed').catch(err => { console.log('  ⚠️ zcard completed error:', err.message); return 0; }),
        withTimeout(redis.zcard('bull:bulk-import:failed'), 3000, 'zcard failed').catch(err => { console.log('  ⚠️ zcard failed error:', err.message); return 0; }),
      ]);

      const result = {
        waiting,
        active,
        completed,
        failed,
        total: waiting + active + completed + failed,
      };
      
      console.log('📊 [getRedisStats] Redis stats result:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to get Redis stats:', error.message);
      // Return zeros instead of error object so UI doesn't break
      return { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 };
    }
  }

  /**
   * Get queue statistics (BullMQ-managed, retention-aware)
   * Shows jobs within retention limits (2h for completed, 24h for failed)
   * @returns {Promise<Object>} - Queue stats
   */
  async getStats() {
    if (!this.queue) {
      return { error: 'Queue not initialized' };
    }

    try {
      console.log('📊 [getStats] Fetching bulk-import queue statistics...');
      
      // Get Redis stats (faster, more reliable)
      const redisStats = await this.getRedisStats();
      
      // Try to get BullMQ stats with timeout to prevent hanging
      let bullmqStats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
      };
      
      try {
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('BullMQ stats timeout (2s)')), 2000)
        );
        
        const statsPromise = (async () => {
          const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount().catch(() => 0),
            this.queue.getActiveCount().catch(() => 0),
            this.queue.getCompletedCount().catch(() => 0),
            this.queue.getFailedCount().catch(() => 0),
            this.queue.getDelayedCount().catch(() => 0),
          ]);

          return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed,
          };
        })();
        
        bullmqStats = await Promise.race([statsPromise, timeout]);
        console.log('📊 [getStats] BullMQ stats:', bullmqStats);
      } catch (error) {
        console.warn('⚠️ [getStats] BullMQ stats failed, using zeros:', error.message);
        // Use zeros if BullMQ stats timeout or fail
      }

      console.log('📊 [getStats] Redis stats:', redisStats);

      const result = {
        ...bullmqStats,
        redis: redisStats, // Include direct Redis counts for comparison
      };
      
      console.log('📊 [getStats] Final combined result:', JSON.stringify(result, null, 2));
      return result;
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
      console.log('🗑️ [obliterate] Starting obliteration of ALL jobs...');
      
      // Get counts before deletion using Redis (faster than BullMQ stats)
      console.log('🔍 [obliterate] Getting job counts from Redis...');
      const redisStats = await this.getRedisStats();
      const totalBefore = redisStats.total || 0;
      console.log(`📊 [obliterate] Found ${totalBefore} total jobs to delete:`, redisStats);

      // Obliterate removes all jobs regardless of state
      // This can take a long time with 80K+ jobs, so we add a generous timeout
      console.log('⚠️ [obliterate] Starting queue.obliterate() - this may take several minutes for large queues...');
      
      const obliteratePromise = this.queue.obliterate({ force: true });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Obliterate timeout (5 minutes)')), 300000) // 5 min timeout
      );
      
      await Promise.race([obliteratePromise, timeoutPromise]);
      
      console.log(`✅ [obliterate] Successfully obliterated ${totalBefore} jobs from bulk import queue`);
      return { removed: totalBefore };
    } catch (error) {
      console.error('❌ [obliterate] Failed to obliterate queue:', error.message);
      return { removed: 0, error: error.message };
    }
  }

  /**
   * Obliterate ALL jobs using direct Redis deletion with progress tracking
   * Much faster than BullMQ's obliterate() for large queues (80K+ jobs)
   * @param {Function} progressCallback - Called with (deleted, total, percentage)
   * @returns {Promise<Object>} - { removed: number, duration: number, error?: string }
   */
  async obliterateWithProgress(progressCallback) {
    if (!this.queue) {
      return { removed: 0, error: 'Queue not initialized' };
    }

    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      console.log('🗑️ [obliterateWithProgress] Starting fast Redis deletion...');
      
      // Get initial counts
      const redisStats = await this.getRedisStats();
      const estimatedTotal = redisStats.total || 0;
      console.log(`📊 [obliterateWithProgress] Target: ~${estimatedTotal.toLocaleString()} jobs`);

      // Get Redis client from shared connection
      const redis = redisClient.getClient();
      const queuePrefix = `bull:bulk-import:`;
      
      // Find all queue keys using SCAN (non-blocking)
      console.log('🔍 [obliterateWithProgress] Scanning for queue keys...');
      const keysToDelete = [];
      let cursor = '0';
      
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          `${queuePrefix}*`,
          'COUNT',
          1000
        );
        cursor = nextCursor;
        keysToDelete.push(...keys);
        
        if (progressCallback && keysToDelete.length > 0) {
          progressCallback({
            phase: 'scanning',
            keysFound: keysToDelete.length,
            estimatedTotal
          });
        }
      } while (cursor !== '0');

      console.log(`📋 [obliterateWithProgress] Found ${keysToDelete.length} keys to delete`);

      // Delete keys in batches
      const batchSize = 1000;
      const totalBatches = Math.ceil(keysToDelete.length / batchSize);
      
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        
        // Delete batch using pipeline for efficiency
        const pipeline = redis.pipeline();
        batch.forEach(key => pipeline.del(key));
        await pipeline.exec();
        
        totalDeleted += batch.length;
        const percentage = Math.round((totalDeleted / keysToDelete.length) * 100);
        
        console.log(`🗑️ [obliterateWithProgress] Batch ${batchNum}/${totalBatches}: Deleted ${totalDeleted}/${keysToDelete.length} keys (${percentage}%)`);
        
        if (progressCallback) {
          progressCallback({
            phase: 'deleting',
            deleted: totalDeleted,
            total: keysToDelete.length,
            percentage,
            batchNum,
            totalBatches
          });
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [obliterateWithProgress] Completed in ${duration}ms - deleted ${totalDeleted} keys`);
      
      return { 
        removed: totalDeleted,
        duration,
        jobsEstimate: estimatedTotal
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ [obliterateWithProgress] Failed:', error.message);
      return { 
        removed: totalDeleted,
        duration,
        error: error.message 
      };
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
