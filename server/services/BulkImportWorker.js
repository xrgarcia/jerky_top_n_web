const { Worker } = require('bullmq');
const redisClient = require('./RedisClient');
const { primaryDb } = require('../db-primary');
const { users } = require('../../shared/schema');
const { eq } = require('drizzle-orm');
const PurchaseHistoryService = require('./PurchaseHistoryService');
const classificationQueue = require('./ClassificationQueue');

/**
 * BulkImportWorker - Background worker that processes user import jobs
 * 
 * Process Flow:
 * 1. Fetch user record from database
 * 2. Sync user's complete order history from Shopify (via PurchaseHistoryService)
 * 3. Update user's import status and metadata
 * 4. Trigger classification job for personalized guidance
 */
class BulkImportWorker {
  constructor() {
    this.worker = null;
    this.services = null;
    this.purchaseHistoryService = new PurchaseHistoryService();
    
    // Throttle Shopify stats broadcasts to avoid excessive API calls
    this.lastShopifyStatsBroadcast = null;
    this.SHOPIFY_STATS_THROTTLE = 10000; // Broadcast at most every 10 seconds
  }

  /**
   * Initialize the worker with Redis connection
   * @param {Object} services - Services object containing wsGateway
   */
  async initialize(services = {}) {
    this.services = services;
    try {
      const redis = await redisClient.connect();
      
      if (!redis) {
        console.warn('⚠️ Redis not available, bulk import worker disabled');
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

      this.worker = new Worker(
        'bulk-import',
        async (job) => this.processJob(job),
        {
          connection: redisConfig,
          concurrency: 3, // Process up to 3 imports concurrently (Shopify API rate limiting)
          limiter: {
            max: 5, // Max 5 jobs
            duration: 1000, // Per second
          },
        }
      );

      this.worker.on('active', async (job) => {
        console.log(`⚡ Import job started for user ${job.data.userId} (${job.data.email})`);
        await this.broadcastProgress();
      });

      this.worker.on('completed', async (job) => {
        console.log(`✅ Import job completed for user ${job.data.userId} (${job.data.email})`);
        await this.broadcastProgress();
        await this.broadcastShopifyStats(); // Real-time update of gap metric
      });

      this.worker.on('failed', async (job, err) => {
        console.error(`❌ Import job failed for user ${job?.data?.userId}:`, err.message);
        
        // Update user status to failed
        if (job?.data?.userId) {
          await this.markImportFailed(job.data.userId, err.message);
        }
        
        await this.broadcastProgress();
        await this.broadcastShopifyStats(); // Real-time update of gap metric
      });

      this.worker.on('error', (err) => {
        console.error('❌ Bulk import worker error:', err);
      });

      console.log('✅ Bulk import worker initialized (concurrency: 3)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize bulk import worker:', error);
      return false;
    }
  }

  /**
   * Process a user import job
   * @param {Object} job - BullMQ job object
   */
  async processJob(job) {
    const { userId, shopifyCustomerId, email } = job.data;
    const startTime = Date.now();

    try {
      console.log(`🔄 Processing import for user ${userId} (${email})...`);

      // Step 1: Fetch user record
      const [user] = await primaryDb
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new Error(`User ${userId} not found in database`);
      }

      // Step 2: Mark import as in progress
      await this.markImportInProgress(userId);

      // Step 3: Sync complete order history from Shopify
      console.log(`  ⏳ Syncing order history for user ${userId}...`);
      const syncResult = await this.purchaseHistoryService.syncUserOrders(user);

      if (!syncResult.success) {
        throw new Error(syncResult.error || syncResult.reason || 'Order sync failed');
      }

      console.log(`  ✓ Synced ${syncResult.itemsImported} order items from ${syncResult.ordersProcessed || 0} orders`);

      // Step 4: Mark import as completed
      await this.markImportCompleted(userId);

      // Step 5: Trigger classification job for personalized guidance
      await classificationQueue.enqueue(userId, 'bulk_import');
      console.log(`  ✓ Classification job enqueued`);

      const duration = Date.now() - startTime;
      console.log(`✅ Import complete for user ${userId} (${duration}ms)`);

      return { 
        success: true, 
        userId, 
        email,
        itemsImported: syncResult.itemsImported,
        ordersProcessed: syncResult.ordersProcessed,
        duration 
      };
    } catch (error) {
      console.error(`❌ Error processing import for user ${userId}:`, error);
      throw error; // Re-throw to mark job as failed
    }
  }

  /**
   * Mark user import as in progress
   * @param {number} userId
   */
  async markImportInProgress(userId) {
    try {
      await primaryDb
        .update(users)
        .set({
          importStatus: 'in_progress',
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error(`❌ Failed to mark import in progress for user ${userId}:`, error);
    }
  }

  /**
   * Mark user import as completed
   * @param {number} userId
   */
  async markImportCompleted(userId) {
    try {
      const now = new Date();
      await primaryDb
        .update(users)
        .set({
          importStatus: 'completed',
          fullHistoryImported: true,
          historyImportedAt: now,
          lastOrderSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
      
      console.log(`  ✓ Marked import complete for user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to mark import completed for user ${userId}:`, error);
    }
  }

  /**
   * Mark user import as failed
   * @param {number} userId
   * @param {string} errorMessage
   */
  async markImportFailed(userId, errorMessage) {
    try {
      await primaryDb
        .update(users)
        .set({
          importStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      
      console.log(`  ✗ Marked import failed for user ${userId}: ${errorMessage}`);
    } catch (error) {
      console.error(`❌ Failed to mark import failed for user ${userId}:`, error);
    }
  }

  /**
   * Broadcast comprehensive import progress to connected WebSocket clients
   * Includes queue stats AND user statistics for real-time updates
   */
  async broadcastProgress() {
    try {
      const BulkImportQueue = require('./BulkImportQueue');
      const bulkImportService = require('./BulkImportService');
      
      // Get comprehensive progress data
      const progressData = await bulkImportService.getProgress();
      
      // Get WebSocket gateway from services
      const wsGateway = this.services?.wsGateway;
      if (wsGateway && wsGateway.io) {
        // Broadcast to admin queue monitor room
        const roomName = wsGateway.room('admin', 'queue-monitor');
        wsGateway.io.to(roomName).emit('bulk-import:progress', progressData);
      }
    } catch (error) {
      console.error('❌ Failed to broadcast bulk import progress:', error);
    }
  }

  /**
   * Broadcast Shopify stats (DB vs Shopify comparison) to connected WebSocket clients
   * Used for real-time updates of the gap metric during imports
   * @param {Object} options - Broadcast options
   * @param {boolean} options.force - Force broadcast even if throttled
   * @param {boolean} options.bypassCache - Force fresh data from Shopify API
   */
  async broadcastShopifyStats(options = {}) {
    const { force = false, bypassCache = false } = options;
    
    try {
      const bulkImportService = require('./BulkImportService');
      
      // Throttle broadcasts unless forced
      const now = Date.now();
      if (!force && this.lastShopifyStatsBroadcast && (now - this.lastShopifyStatsBroadcast < this.SHOPIFY_STATS_THROTTLE)) {
        return; // Skip this broadcast - too soon after last one
      }
      
      // Get Shopify stats (with optional cache bypass for final/forced broadcasts)
      const shopifyStats = await bulkImportService.getShopifyStats({ bypassCache });
      
      // Update last broadcast time
      this.lastShopifyStatsBroadcast = now;
      
      // Get WebSocket gateway from services
      const wsGateway = this.services?.wsGateway;
      if (wsGateway && wsGateway.io) {
        // Broadcast to admin queue monitor room
        const roomName = wsGateway.room('admin', 'queue-monitor');
        wsGateway.io.to(roomName).emit('shopify-stats:update', shopifyStats);
      }
    } catch (error) {
      console.error('❌ Failed to broadcast Shopify stats:', error);
    }
  }

  /**
   * Broadcast queue statistics to connected WebSocket clients
   * @deprecated Use broadcastProgress() instead for comprehensive updates
   */
  async broadcastQueueStats() {
    try {
      const BulkImportQueue = require('./BulkImportQueue');
      const stats = await BulkImportQueue.getStats();
      
      // Get WebSocket gateway from services
      const wsGateway = this.services?.wsGateway;
      if (wsGateway && wsGateway.io) {
        // Broadcast to admin queue monitor room
        const roomName = wsGateway.room('admin', 'queue-monitor');
        wsGateway.io.to(roomName).emit('bulk-import:stats', stats);
      }
    } catch (error) {
      console.error('❌ Failed to broadcast bulk import queue stats:', error);
    }
  }

  /**
   * Close the worker connection
   */
  async close() {
    if (this.worker) {
      await this.worker.close();
      console.log('👋 Bulk import worker closed');
    }
  }
}

// Singleton instance
const bulkImportWorker = new BulkImportWorker();

module.exports = bulkImportWorker;
