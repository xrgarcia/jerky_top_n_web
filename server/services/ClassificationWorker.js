const { Worker } = require('bullmq');
const redisClient = require('./RedisClient');
const { primaryDb } = require('../db-primary');
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
      const redis = await redisClient.connect();
      
      if (!redis) {
        console.warn('⚠️ Redis not available, classification worker disabled');
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

      this.worker = new Worker(
        'user-classification',
        async (job) => this.processJob(job),
        {
          connection: redisConfig,
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
        console.error('❌ Worker error:', err);
      });

      console.log('✅ Classification worker initialized (concurrency: 5)');
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

      // Step 1: Classify user (this also updates flavor communities internally)
      const classification = await this.services.userClassificationService.classifyUser(userId);
      
      if (!classification) {
        throw new Error('Classification failed - no result returned');
      }

      console.log(`  ✓ User classified: ${classification.journeyStage}/${classification.engagementLevel}`);

      // Step 2: Calculate and cache guidance for all page contexts
      const totalRankableProducts = this.services.getRankableProductCount();
      const cachePromises = [];

      for (const pageContext of this.PAGE_CONTEXTS) {
        cachePromises.push(this.calculateAndCacheGuidance(userId, pageContext, totalRankableProducts));
      }

      await Promise.all(cachePromises);

      console.log(`  ✓ Guidance cached for ${this.PAGE_CONTEXTS.length} page contexts`);

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
      const existing = await primaryDb
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
        await primaryDb
          .update(userGuidanceCache)
          .set({
            guidanceData,
            calculatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userGuidanceCache.id, existing[0].id));
      } else {
        // Insert new cache entry
        await primaryDb.insert(userGuidanceCache).values({
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
