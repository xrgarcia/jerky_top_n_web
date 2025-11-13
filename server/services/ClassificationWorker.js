const { Worker } = require('bullmq');
const redisClient = require('./RedisClient');
const { workerDb } = require('../db-worker'); // Dedicated worker pool to prevent connection exhaustion
const { userGuidanceCache } = require('../../shared/schema');
const { eq, and } = require('drizzle-orm');

/**
 * ClassificationWorker - Background worker that processes user classification jobs
 * 
 * Process Flow:
 * 1. Classify user (updates userClassifications table)
 * 2. Update flavor profile communities (updates userFlavorProfileCommunities table)
 * 3. Calculate guidance for all page contexts (rank, products, community, coinbook, general)
 * 4. Write guidance to cache (upserts to userGuidanceCache table)
 * 5. Mark user as calculated in Redis (for debouncing)
 */
class ClassificationWorker {
  constructor(services) {
    this.worker = null;
    this.services = services; // Contains all injected services
    this.PAGE_CONTEXTS = ['rank', 'products', 'community', 'coinbook', 'general'];
  }

  /**
   * Initialize the worker with Redis connection
   */
  async initialize() {
    try {
      // Ensure Redis client is connected
      const baseClient = await redisClient.connect();
      
      if (!baseClient) {
        console.warn('⚠️ Redis not available, classification worker disabled');
        return false;
      }

      console.log('🔌 Creating dedicated Redis connection for classification worker...');
      
      // Duplicate the hardened RedisClient connection for BullMQ worker
      // This ensures proper TLS, keepalive, and auth configuration
      // CRITICAL: Must use the same Redis instance as ClassificationQueue for job consumption
      const workerConnection = baseClient.duplicate({
        lazyConnect: false, // Connect immediately
        keepAlive: 30000, // 30s keepalive (prevents EPIPE/ECONNRESET)
        enableReadyCheck: true, // Wait for READY before accepting commands
        maxRetriesPerRequest: null, // Required by BullMQ Worker
      });

      // Register as dependent for auto-reinit when base reconnects
      redisClient.registerDependent(workerConnection);

      // Add comprehensive error handlers to prevent crashes
      workerConnection.on('error', async (err) => {
        // Filter expected network errors to avoid log spam
        const isExpectedError = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'].includes(err.code);
        
        if (isExpectedError) {
          console.warn('⚠️ Classification worker Redis connection issue (will auto-retry):', err.code || err.message);
          // Pause worker to prevent job processing failures during outage (await the async operation)
          if (this.worker) {
            try {
              const isPaused = await this.worker.isPaused();
              if (!isPaused) {
                await this.worker.pause();
                console.log('⏸️  Classification worker PAUSED due to Redis connection issue');
              }
            } catch (pauseErr) {
              console.error('❌ Failed to pause classification worker:', pauseErr.message);
            }
          }
        } else {
          console.error('❌ Classification worker Redis connection error:', err.message);
        }
      });

      workerConnection.on('ready', async () => {
        console.log('✅ Classification worker Redis connection READY');
        // Resume worker if it was paused (await the async operation)
        if (this.worker) {
          try {
            const isPaused = await this.worker.isPaused();
            if (isPaused) {
              await this.worker.resume();
              console.log('▶️  Classification worker RESUMED after Redis reconnection');
            }
          } catch (resumeErr) {
            console.error('❌ Failed to resume classification worker:', resumeErr.message);
          }
        }
      });

      workerConnection.on('close', async () => {
        console.warn('⚠️ Classification worker Redis connection CLOSED - pausing worker');
        if (this.worker) {
          try {
            const isPaused = await this.worker.isPaused();
            if (!isPaused) {
              await this.worker.pause();
              console.log('⏸️  Classification worker PAUSED due to Redis disconnect');
            }
          } catch (pauseErr) {
            console.error('❌ Failed to pause classification worker on close:', pauseErr.message);
          }
        }
      });

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Classification worker connection timeout after 10s'));
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

      // BullMQ Worker uses the duplicated connection
      this.worker = new Worker(
        'user-classification',
        async (job) => this.processJob(job),
        {
          connection: workerConnection,
          concurrency: 5, // Process up to 5 jobs concurrently
          limiter: {
            max: 10, // Max 10 jobs
            duration: 1000, // Per second
          },
        }
      );

      this.worker.on('completed', async (job) => {
        console.log(`✅ Classification job completed for user ${job.data.userId}`);
        await this.broadcastQueueStats();
      });

      this.worker.on('failed', async (job, err) => {
        console.error(`❌ Classification job failed for user ${job?.data?.userId}:`, err.message);
        await this.broadcastQueueStats();
      });

      this.worker.on('error', (err) => {
        // Filter expected connection errors to avoid log spam during outages
        const isConnectionError = err.message && (
          err.message.includes('ECONNRESET') ||
          err.message.includes('ETIMEDOUT') ||
          err.message.includes('ECONNREFUSED') ||
          err.message.includes('Connection is closed')
        );
        
        if (isConnectionError) {
          console.warn('⚠️ Classification worker error (connection issue, will auto-recover):', err.message);
        } else {
          console.error('❌ Classification worker error:', err);
        }
      });

      console.log('✅ Classification worker initialized with resilient error handling (concurrency: 5)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize classification worker:', error);
      return false;
    }
  }

  /**
   * Process a classification job
   * @param {object} job - BullMQ job object
   */
  async processJob(job) {
    const { userId, reason } = job.data;
    const startTime = Date.now();

    try {
      console.log(`🔄 Processing classification for user ${userId} (reason: ${reason})...`);

      // Invalidate caches BEFORE recalculation (clear stale data from Redis)
      const UserClassificationCache = require('../cache/UserClassificationCache');
      const userClassificationCache = UserClassificationCache.getInstance();
      await userClassificationCache.invalidateUser(userId);
      
      const ProgressCache = require('../cache/ProgressCache');
      const progressCache = ProgressCache.getInstance();
      await progressCache.invalidateUser(userId);
      
      const GuidanceCache = require('../cache/GuidanceCache');
      const guidanceCache = GuidanceCache.getInstance();
      await guidanceCache.invalidateUser(userId);
      
      console.log(`  ✓ Invalidated stale classification, progress, and guidance caches`);

      // Step 1: Classify user (this also updates flavor communities internally AND populates cache)
      const classification = await this.services.userClassificationService.classifyUser(userId);
      
      if (!classification) {
        throw new Error('Classification failed - no result returned');
      }

      console.log(`  ✓ User classified: ${classification.journeyStage}/${classification.engagementLevel}`);

      // Step 2: Calculate and cache guidance for all page contexts (writes to database)
      const totalRankableProducts = this.services.getRankableProductCount();
      const cachePromises = [];

      for (const pageContext of this.PAGE_CONTEXTS) {
        cachePromises.push(this.calculateAndCacheGuidance(userId, pageContext, totalRankableProducts));
      }

      await Promise.all(cachePromises);

      console.log(`  ✓ Guidance cached in database for ${this.PAGE_CONTEXTS.length} page contexts (Redis will populate on next request)`);

      // Step 3: Mark user as calculated (for debouncing)
      const ClassificationQueue = require('./ClassificationQueue');
      await ClassificationQueue.markCalculated(userId);

      const duration = Date.now() - startTime;
      console.log(`✅ Classification complete for user ${userId} (${duration}ms)`);

      return { success: true, userId, duration };
    } catch (error) {
      console.error(`❌ Error processing classification for user ${userId}:`, error);
      throw error; // Re-throw to mark job as failed
    }
  }

  /**
   * Calculate guidance and write to cache for a specific page context
   * @param {number} userId - User ID
   * @param {string} pageContext - Page context (rank, products, community, coinbook, general)
   * @param {number} totalRankableProducts - Total rankable products count
   */
  async calculateAndCacheGuidance(userId, pageContext, totalRankableProducts) {
    try {
      // Calculate guidance for this page context
      const guidance = await this.services.personalizedGuidanceService.getGuidance(
        userId,
        pageContext,
        totalRankableProducts
      );

      // Prepare guidance data for cache
      const guidanceData = {
        title: guidance.title,
        message: guidance.message,
        type: guidance.type,
        icon: guidance.icon,
        classification: guidance.classification,
        stats: guidance.stats,
      };

      // Upsert to cache (update if exists, insert if not)
      const existing = await workerDb
        .select()
        .from(userGuidanceCache)
        .where(
          and(
            eq(userGuidanceCache.userId, userId),
            eq(userGuidanceCache.pageContext, pageContext)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing cache entry
        await workerDb
          .update(userGuidanceCache)
          .set({
            guidanceData,
            calculatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userGuidanceCache.id, existing[0].id));
      } else {
        // Insert new cache entry
        await workerDb.insert(userGuidanceCache).values({
          userId,
          pageContext,
          guidanceData,
          calculatedAt: new Date(),
        });
      }

      console.log(`  ✓ Cached guidance for user ${userId} / ${pageContext}`);
    } catch (error) {
      console.error(`❌ Error caching guidance for user ${userId} / ${pageContext}:`, error);
      // Don't throw - allow other page contexts to succeed
    }
  }

  /**
   * Broadcast queue statistics to admin users via WebSocket
   */
  async broadcastQueueStats() {
    try {
      const ClassificationQueue = require('./ClassificationQueue');
      const stats = await ClassificationQueue.getStats();
      
      // Get WebSocket gateway from services (injected during initialization)
      const wsGateway = this.services.wsGateway;
      if (wsGateway) {
        wsGateway.broadcastQueueStats(stats);
      }
    } catch (error) {
      console.error('❌ Error broadcasting queue stats:', error);
    }
  }

  /**
   * Close the worker connection
   */
  async close() {
    if (this.worker) {
      await this.worker.close();
      console.log('👋 Classification worker closed');
    }
  }
}

module.exports = ClassificationWorker;
