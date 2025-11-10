const { Worker } = require('bullmq');
const Sentry = require('@sentry/node');
const redisClient = require('./RedisClient');
const EngagementScoreService = require('./EngagementScoreService');
const { primaryDb } = require('../db-primary');
const { users } = require('../../shared/schema');
const { eq, sql } = require('drizzle-orm');

/**
 * EngagementBackfillWorker - Background worker that backfills engagement scores
 * 
 * Process Flow:
 * 1. Fetch batch of users from database
 * 2. Recalculate engagement score for each user using EngagementScoreService
 * 3. Update progress in Redis
 * 4. Broadcast progress via WebSocket
 */
class EngagementBackfillWorker {
  constructor() {
    this.worker = null;
    this.services = null;
    this.engagementScoreService = new EngagementScoreService(primaryDb);
  }

  /**
   * Initialize the worker with Redis connection
   * @param {Object} services - Services object containing wsGateway
   */
  async initialize(services = {}) {
    this.services = services;
    try {
      // Ensure Redis client is connected
      const baseClient = await redisClient.connect();
      
      if (!baseClient) {
        console.warn('⚠️ Redis not available, engagement backfill worker disabled');
        return false;
      }

      console.log('🔌 Creating dedicated Redis connection for engagement backfill worker...');
      
      // Duplicate the hardened RedisClient connection for BullMQ
      const workerConnection = baseClient.duplicate({
        lazyConnect: false,
        keepAlive: 30000,
        enableReadyCheck: true,
        maxRetriesPerRequest: null,
      });

      // Add error listener before connecting
      workerConnection.on('error', (err) => {
        console.error('❌ Engagement backfill worker Redis connection error:', err.message);
        Sentry.captureException(err, {
          tags: { component: 'engagement-backfill-worker', context: 'redis-connection' },
          extra: { errorMessage: err.message }
        });
      });

      workerConnection.on('ready', () => {
        console.log('✅ Engagement backfill worker Redis connection READY');
      });

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker connection timeout after 10s'));
        }, 10000);

        workerConnection.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        workerConnection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // BullMQ Worker with pre-configured connection
      this.worker = new Worker(
        'engagement-backfill',
        async (job) => this.processJob(job),
        {
          connection: workerConnection,
          concurrency: 10, // Process 10 users concurrently for faster throughput
          lockDuration: 300000, // 5 minutes - Heavy INSERT...SELECT can take time for large users
        }
      );

      this.worker.on('active', async (job) => {
        console.log(`⚡ Backfill job started for user ${job.data.userId} (${job.data.displayName})`);
      });

      this.worker.on('completed', async (job, result) => {
        const duration = result?.duration || 0;
        console.log(`✅ Backfill job completed for user ${job.data.userId} (${job.data.displayName}) in ${duration}ms`);
        
        // Increment completed count in Redis
        const EngagementBackfillQueue = require('./EngagementBackfillQueue');
        await EngagementBackfillQueue.incrementCompleted();
        
        await this.broadcastProgress();
      });

      this.worker.on('failed', async (job, err) => {
        console.error(`❌ Backfill job failed for user ${job?.data?.userId} (${job?.data?.displayName}):`, err.message);
        console.error(`   Error details:`, {
          name: err.name,
          stack: err.stack?.split('\n').slice(0, 3)
        });
        
        // Capture in Sentry with context
        Sentry.captureException(err, {
          tags: { 
            component: 'engagement-backfill-worker',
            userId: job?.data?.userId
          },
          extra: {
            userId: job?.data?.userId,
            displayName: job?.data?.displayName,
            email: job?.data?.email,
            attemptsMade: job?.attemptsMade,
            failedReason: err.message
          }
        });
        
        // Increment failed count in Redis
        const EngagementBackfillQueue = require('./EngagementBackfillQueue');
        await EngagementBackfillQueue.incrementFailed();
        
        await this.broadcastProgress();
      });

      this.worker.on('error', (err) => {
        console.error('❌ Engagement backfill worker error:', err);
        Sentry.captureException(err, {
          tags: { component: 'engagement-backfill-worker', context: 'worker-error' }
        });
      });

      console.log('✅ Engagement backfill worker initialized (concurrency: 10)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize engagement backfill worker:', error);
      Sentry.captureException(error, {
        tags: { component: 'engagement-backfill-worker', context: 'initialization' }
      });
      return false;
    }
  }

  /**
   * Process a user backfill job
   * @param {Object} job - BullMQ job object
   */
  async processJob(job) {
    const { userId, displayName, email } = job.data;
    const startTime = Date.now();

    try {
      console.log(`🔄 [Job ${job.id}] Recalculating engagement score for user ${userId} (${displayName})...`);

      // Recalculate engagement score using service
      const result = await this.engagementScoreService.recalculateUserScore(userId);

      const duration = Date.now() - startTime;
      console.log(`✅ [Job ${job.id}] Engagement score recalculated for user ${userId} - Score: ${result?.engagementScore || 0} pts (${duration}ms)`);

      return { 
        success: true, 
        userId, 
        displayName,
        email,
        engagementScore: result?.engagementScore || 0,
        duration 
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [Job ${job.id}] Error recalculating engagement score for user ${userId}:`, error.message);
      console.error(`   Failed after ${duration}ms:`, {
        userId,
        displayName,
        email,
        errorName: error.name,
        errorMessage: error.message
      });
      
      // Capture in Sentry
      Sentry.captureException(error, {
        tags: { 
          component: 'engagement-backfill-worker',
          context: 'processJob',
          userId 
        },
        extra: {
          userId,
          displayName,
          email,
          jobId: job.id,
          duration,
          attemptsMade: job.attemptsMade
        }
      });
      
      throw error; // Re-throw to mark job as failed
    }
  }

  /**
   * Broadcast comprehensive backfill progress to connected WebSocket clients
   */
  async broadcastProgress() {
    try {
      const EngagementBackfillQueue = require('./EngagementBackfillQueue');
      
      // Get progress data
      const stats = await EngagementBackfillQueue.getStats();
      
      // Log progress milestones
      if (stats.total > 0) {
        const percentComplete = Math.round((stats.completed / stats.total) * 100);
        if (percentComplete % 25 === 0 && stats.completed > 0) {
          console.log(`📊 Backfill progress: ${percentComplete}% complete (${stats.completed}/${stats.total} users, ${stats.failed} failed)`);
        }
      }
      
      // Get WebSocket gateway from services
      const wsGateway = this.services?.wsGateway;
      if (wsGateway && wsGateway.io) {
        // Broadcast to admin data management room
        const roomName = wsGateway.room('admin', 'data-management');
        wsGateway.io.to(roomName).emit('engagement-backfill:progress', stats);
      }
    } catch (error) {
      console.error('❌ Failed to broadcast engagement backfill progress:', error.message);
      Sentry.captureException(error, {
        tags: { component: 'engagement-backfill-worker', context: 'broadcast' }
      });
    }
  }

  /**
   * Close the worker connection
   */
  async close() {
    if (this.worker) {
      await this.worker.close();
      console.log('👋 Engagement backfill worker closed');
    }
  }
}

// Singleton instance
const engagementBackfillWorker = new EngagementBackfillWorker();

module.exports = engagementBackfillWorker;
