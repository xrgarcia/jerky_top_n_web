const { Worker } = require('bullmq');
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
        }
      );

      this.worker.on('active', async (job) => {
        console.log(`⚡ Backfill job started for user ${job.data.userId}`);
      });

      this.worker.on('completed', async (job) => {
        console.log(`✅ Backfill job completed for user ${job.data.userId}`);
        
        // Increment completed count in Redis
        const EngagementBackfillQueue = require('./EngagementBackfillQueue');
        await EngagementBackfillQueue.incrementCompleted();
        
        await this.broadcastProgress();
      });

      this.worker.on('failed', async (job, err) => {
        console.error(`❌ Backfill job failed for user ${job?.data?.userId}:`, err.message);
        
        // Increment failed count in Redis
        const EngagementBackfillQueue = require('./EngagementBackfillQueue');
        await EngagementBackfillQueue.incrementFailed();
        
        await this.broadcastProgress();
      });

      this.worker.on('error', (err) => {
        console.error('❌ Engagement backfill worker error:', err);
      });

      console.log('✅ Engagement backfill worker initialized (concurrency: 10)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize engagement backfill worker:', error);
      return false;
    }
  }

  /**
   * Process a user backfill job
   * @param {Object} job - BullMQ job object
   */
  async processJob(job) {
    const { userId, displayName } = job.data;
    const startTime = Date.now();

    try {
      console.log(`🔄 Recalculating engagement score for user ${userId} (${displayName})...`);

      // Recalculate engagement score using service
      await this.engagementScoreService.recalculateUserScore(userId);

      const duration = Date.now() - startTime;
      console.log(`✅ Engagement score recalculated for user ${userId} (${duration}ms)`);

      return { 
        success: true, 
        userId, 
        displayName,
        duration 
      };
    } catch (error) {
      console.error(`❌ Error recalculating engagement score for user ${userId}:`, error);
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
      
      // Get WebSocket gateway from services
      const wsGateway = this.services?.wsGateway;
      if (wsGateway && wsGateway.io) {
        // Broadcast to admin data management room
        const roomName = wsGateway.room('admin', 'data-management');
        wsGateway.io.to(roomName).emit('engagement-backfill:progress', stats);
      }
    } catch (error) {
      console.error('❌ Failed to broadcast engagement backfill progress:', error);
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
