const { Worker } = require('bullmq');
const Sentry = require('@sentry/node');
const redisClient = require('./RedisClient');
const { workerDb } = require('../db-worker');

/**
 * CoinRecalculationWorker - Background worker that recalculates user coins
 * 
 * Process Flow:
 * 1. Receive job with userId, coinType, reason, context
 * 2. Re-evaluate coin eligibility based on current state
 * 3. Revoke coins that are no longer valid
 * 4. Update collection progress and tier levels
 * 5. Invalidate caches (leaderboard, achievements, progress)
 * 6. Broadcast achievement updates via WebSocket
 * 
 * Triggered by:
 * - Order cancellations
 * - Fulfillment status downgrades
 * - Future: Manual admin recalculation
 */
class CoinRecalculationWorker {
  constructor() {
    this.worker = null;
    this.services = null;
  }

  /**
   * Initialize the worker with Redis connection and services
   * @param {Object} services - Services object containing engagementManager, collectionManager, wsGateway
   */
  async initialize(services = {}) {
    this.services = services;
    try {
      // Ensure Redis client is connected
      const baseClient = await redisClient.connect();
      
      if (!baseClient) {
        console.warn('⚠️ Redis not available, coin recalculation worker disabled');
        return false;
      }

      console.log('🔌 Creating dedicated Redis connection for coin recalculation worker...');
      
      // Duplicate the hardened RedisClient connection for BullMQ worker
      const workerConnection = baseClient.duplicate({
        lazyConnect: false,
        keepAlive: 30000,
        enableReadyCheck: true,
        maxRetriesPerRequest: null,
      });

      // Register as dependent for auto-reinit when base reconnects
      redisClient.registerDependent(workerConnection);

      // Add comprehensive error handlers to prevent crashes
      workerConnection.on('error', async (err) => {
        const isExpectedError = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'].includes(err.code);
        
        if (isExpectedError) {
          console.warn('⚠️ Coin recalculation worker Redis connection issue (will auto-retry):', err.code || err.message);
          if (this.worker) {
            try {
              const isPaused = await this.worker.isPaused();
              if (!isPaused) {
                await this.worker.pause();
                console.log('⏸️  Coin recalculation worker PAUSED due to Redis connection issue');
              }
            } catch (pauseErr) {
              console.error('❌ Failed to pause coin recalculation worker:', pauseErr.message);
            }
          }
        } else {
          console.error('❌ Coin recalculation worker Redis connection error:', err.message);
          Sentry.captureException(err, {
            tags: { component: 'coin-recalculation-worker', context: 'redis-connection' },
            extra: { errorMessage: err.message }
          });
        }
      });

      workerConnection.on('ready', async () => {
        console.log('✅ Coin recalculation worker Redis connection READY');
        if (this.worker) {
          try {
            const isPaused = await this.worker.isPaused();
            if (isPaused) {
              await this.worker.resume();
              console.log('▶️  Coin recalculation worker RESUMED after Redis reconnection');
            }
          } catch (resumeErr) {
            console.error('❌ Failed to resume coin recalculation worker:', resumeErr.message);
          }
        }
      });

      workerConnection.on('close', async () => {
        console.warn('⚠️ Coin recalculation worker Redis connection CLOSED - pausing worker');
        if (this.worker) {
          try {
            const isPaused = await this.worker.isPaused();
            if (!isPaused) {
              await this.worker.pause();
              console.log('⏸️  Coin recalculation worker PAUSED due to Redis disconnect');
            }
          } catch (pauseErr) {
            console.error('❌ Failed to pause coin recalculation worker on close:', pauseErr.message);
          }
        }
      });

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Coin recalculation worker connection timeout after 10s'));
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

      // BullMQ Worker
      this.worker = new Worker(
        'coin-recalculation',
        async (job) => this.processJob(job),
        {
          connection: workerConnection,
          concurrency: 3, // Process up to 3 jobs concurrently
          limiter: {
            max: 5,
            duration: 1000,
          },
        }
      );

      this.worker.on('completed', (job) => {
        console.log(`✅ Coin recalculation job completed for user ${job.data.userId} (coinType: ${job.data.coinType})`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`❌ Coin recalculation job failed for user ${job?.data?.userId}:`, err.message);
        Sentry.captureException(err, {
          tags: { component: 'coin-recalculation-worker', userId: job?.data?.userId },
          extra: { jobData: job?.data }
        });
      });

      this.worker.on('error', (err) => {
        const isConnectionError = err.message && (
          err.message.includes('ECONNRESET') ||
          err.message.includes('ETIMEDOUT') ||
          err.message.includes('ECONNREFUSED') ||
          err.message.includes('Connection is closed')
        );
        
        if (isConnectionError) {
          console.warn('⚠️ Coin recalculation worker error (connection issue, will auto-recover):', err.message);
        } else {
          console.error('❌ Coin recalculation worker error:', err);
          Sentry.captureException(err, {
            tags: { component: 'coin-recalculation-worker', context: 'worker-error' }
          });
        }
      });

      console.log('✅ Coin recalculation worker initialized with resilient error handling (concurrency: 3)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize coin recalculation worker:', error);
      Sentry.captureException(error, {
        tags: { component: 'coin-recalculation-worker', context: 'initialization' }
      });
      return false;
    }
  }

  /**
   * Process a coin recalculation job
   * @param {object} job - BullMQ job object
   */
  async processJob(job) {
    const { userId, coinType, reason, context } = job.data;
    const startTime = Date.now();

    try {
      console.log(`🪙 Processing coin recalculation for user ${userId} (coinType: ${coinType}, reason: ${reason})...`);

      if (coinType === 'all') {
        // Full recalculation - re-evaluate all coin types
        await this.recalculateAllCoins(userId, context);
      } else {
        // Targeted recalculation for specific coin type
        await this.recalculateSpecificCoinType(userId, coinType, context);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Coin recalculation complete for user ${userId} (${duration}ms)`);

      return { success: true, userId, coinType, duration };
    } catch (error) {
      console.error(`❌ Error processing coin recalculation for user ${userId}:`, error);
      Sentry.captureException(error, {
        tags: { component: 'coin-recalculation-worker', userId },
        extra: { jobData: job.data }
      });
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * Recalculate all coin types for a user
   * @param {number} userId - User ID
   * @param {object} context - Additional context
   */
  async recalculateAllCoins(userId, context = {}) {
    console.log(`  🔄 Full coin recalculation for user ${userId}...`);

    // Invalidate all relevant caches before recalculation
    await this.invalidateCaches(userId);

    // Recalculate engagement coins (if EngagementManager available)
    if (this.services?.engagementManager) {
      await this.services.engagementManager.recalculateUserCoins(userId, context);
      console.log(`  ✓ Engagement coins recalculated`);
    }

    // Recalculate collection coins (if CollectionManager available)
    if (this.services?.collectionManager) {
      await this.services.collectionManager.recalculateUserCollections(userId, context);
      console.log(`  ✓ Collection coins recalculated`);
    }

    // Invalidate leaderboard cache
    if (this.services?.leaderboardManager) {
      await this.services.leaderboardManager.leaderboardCache.invalidate();
      console.log(`  ✓ Leaderboard cache invalidated`);
    }

    // Broadcast achievement updates via WebSocket
    if (this.services?.wsGateway) {
      this.services.wsGateway.broadcastAchievementUpdate(userId);
      console.log(`  ✓ Broadcast achievement update to user ${userId}`);
    }
  }

  /**
   * Recalculate specific coin type for a user
   * @param {number} userId - User ID
   * @param {string} coinType - Coin type to recalculate
   * @param {object} context - Additional context
   */
  async recalculateSpecificCoinType(userId, coinType, context = {}) {
    console.log(`  🔄 Recalculating ${coinType} coins for user ${userId}...`);

    await this.invalidateCaches(userId);

    // Route to appropriate manager based on coin type
    if (coinType === 'engagement_collection') {
      if (this.services?.engagementManager) {
        await this.services.engagementManager.recalculateUserCoins(userId, context);
        console.log(`  ✓ Engagement coins recalculated`);
      }
    } else if (['flavor_coin', 'dynamic_collection', 'static_collection'].includes(coinType)) {
      if (this.services?.collectionManager) {
        await this.services.collectionManager.recalculateUserCollections(userId, context);
        console.log(`  ✓ Collection coins recalculated`);
      }
    }

    // Invalidate leaderboard cache
    if (this.services?.leaderboardManager) {
      await this.services.leaderboardManager.leaderboardCache.invalidate();
    }

    // Broadcast updates
    if (this.services?.wsGateway) {
      this.services.wsGateway.broadcastAchievementUpdate(userId);
    }
  }

  /**
   * Invalidate all relevant caches for a user
   * @param {number} userId - User ID
   */
  async invalidateCaches(userId) {
    try {
      const ProgressCache = require('../cache/ProgressCache');
      const progressCache = ProgressCache.getInstance();
      await progressCache.invalidateUser(userId);

      const CoinbookCache = require('../cache/CoinbookCache');
      const coinbookCache = CoinbookCache.getInstance();
      await coinbookCache.invalidateUser(userId);

      console.log(`  ✓ Invalidated progress and coinbook caches for user ${userId}`);
    } catch (error) {
      console.error(`  ⚠️ Cache invalidation failed (non-critical):`, error.message);
    }
  }

  /**
   * Close the worker
   */
  async close() {
    if (this.worker) {
      await this.worker.close();
      console.log('👋 Coin recalculation worker closed');
    }
  }
}

module.exports = CoinRecalculationWorker;
