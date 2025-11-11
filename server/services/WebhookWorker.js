const { Worker } = require('bullmq');
const Sentry = require('@sentry/node');
const redisClient = require('./RedisClient');

/**
 * WebhookWorker - Background worker that processes Shopify webhook jobs
 * 
 * Process Flow:
 * 1. Receive webhook job from queue
 * 2. Route to appropriate service (OrderService, ProductService, CustomerService)
 * 3. Execute all side effects (cache invalidation, WebSocket broadcasts, etc.)
 * 4. Handle errors with automatic retry via BullMQ
 * 
 * Services are injected via constructor to avoid circular dependencies
 */
class WebhookWorker {
  constructor() {
    this.worker = null;
    this.services = null; // Will be injected during initialization
  }

  /**
   * Initialize the worker with Redis connection and services
   * @param {Object} services - Injected services object
   * @param {Object} services.orderService - WebhookOrderService instance
   * @param {Object} services.productService - WebhookProductService instance
   * @param {Object} services.customerService - WebhookCustomerService instance
   * @param {Object} services.purchaseHistoryService - PurchaseHistoryService instance
   * @param {Object} services.rankingStatsCache - RankingStatsCache instance
   * @param {Object} services.metadataCache - MetadataCache instance
   * @param {Object} services.classificationQueue - ClassificationQueue instance
   */
  async initialize(services = {}) {
    this.services = services;

    try {
      // Ensure Redis client is connected
      const baseClient = await redisClient.connect();
      
      if (!baseClient) {
        console.warn('⚠️ Redis not available, webhook worker disabled');
        return false;
      }

      console.log('🔌 Creating dedicated Redis connection for webhook worker...');
      
      // Duplicate the hardened RedisClient connection for BullMQ worker
      // This ensures proper TLS, keepalive, and auth configuration
      // CRITICAL: Must use the same Redis instance as WebhookQueue for job consumption
      const workerConnection = baseClient.duplicate({
        lazyConnect: false, // Connect immediately
        keepAlive: 30000, // 30s keepalive
        enableReadyCheck: true, // Wait for READY before accepting commands
        maxRetriesPerRequest: null, // Required by BullMQ Worker
      });

      // Add error listener before connecting
      workerConnection.on('error', (err) => {
        console.error('❌ Webhook worker Redis connection error:', err.message);
        Sentry.captureException(err, {
          tags: { component: 'webhook-worker', context: 'redis-connection' },
          extra: { errorMessage: err.message }
        });
      });

      workerConnection.on('ready', () => {
        console.log('✅ Webhook worker Redis connection READY');
      });

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Webhook worker connection timeout after 10s'));
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
        'shopify-webhooks',
        async (job) => this.processJob(job),
        {
          connection: workerConnection,
          concurrency: 3, // Process up to 3 webhooks concurrently
          limiter: {
            max: 20, // Max 20 jobs
            duration: 1000, // Per second (rate limiting)
          },
        }
      );

      this.worker.on('completed', (job) => {
        const duration = Date.now() - job.data.metadata.enqueuedAt;
        console.log(`✅ Webhook job completed: ${job.data.type}/${job.data.topic} (${duration}ms)`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`❌ Webhook job failed: ${job?.data?.type}/${job?.data?.topic}:`, err.message);
        
        // Send to Sentry for monitoring
        Sentry.captureException(err, {
          tags: { 
            service: 'webhook-worker',
            webhook_type: job?.data?.type,
            webhook_topic: job?.data?.topic,
          },
          extra: {
            jobId: job?.id,
            attemptsMade: job?.attemptsMade,
            data: job?.data,
          }
        });
      });

      this.worker.on('error', (err) => {
        console.error('❌ Webhook worker error:', err);
        Sentry.captureException(err, {
          tags: { service: 'webhook-worker', context: 'worker-error' }
        });
      });

      console.log('✅ Webhook worker initialized (concurrency: 3)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize webhook worker:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook-worker', context: 'initialization' }
      });
      return false;
    }
  }

  /**
   * Process a webhook job
   * @param {object} job - BullMQ job object
   */
  async processJob(job) {
    const { type, topic, data, metadata } = job.data;
    const startTime = Date.now();

    try {
      console.log(`🔄 Processing webhook: ${type}/${topic} (job: ${job.id})`);

      let result;

      // Route to appropriate service based on webhook type
      switch (type) {
        case 'orders':
          result = await this.processOrderWebhook(data, topic);
          break;
        
        case 'products':
          result = await this.processProductWebhook(data, topic);
          break;
        
        case 'customers':
          result = await this.processCustomerWebhook(data, topic);
          break;
        
        default:
          throw new Error(`Unknown webhook type: ${type}`);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Webhook processed: ${type}/${topic} (${duration}ms)`);

      return { 
        success: true, 
        type, 
        topic, 
        result,
        duration,
        metadata 
      };
    } catch (error) {
      console.error(`❌ Error processing webhook ${type}/${topic}:`, error);
      
      // Add context to error before throwing (BullMQ will handle retry)
      error.webhookType = type;
      error.webhookTopic = topic;
      error.jobId = job.id;
      
      throw error; // Re-throw to mark job as failed and trigger retry
    }
  }

  /**
   * Process order webhook with all side effects
   */
  async processOrderWebhook(orderData, topic) {
    const { orderService, purchaseHistoryService, rankingStatsCache, classificationQueue } = this.services;

    if (!orderService) {
      throw new Error('OrderService not available');
    }

    // Process the order (writes to customer_order_items table)
    const result = await orderService.processOrderWebhook(orderData, topic);

    // Handle side effects if processing was successful
    if (result.success && (result.userId || result.action === 'deleted')) {
      // Invalidate purchase history cache for the user
      if (result.userId && purchaseHistoryService) {
        console.log(`🔄 Invalidating purchase history cache for user ${result.userId}`);
        purchaseHistoryService.invalidateUserCache(result.userId);
      }
      
      // Update ranking stats cache for affected products
      if (result.affectedProductIds && result.affectedProductIds.length > 0 && rankingStatsCache) {
        console.log(`🔄 Recalculating ranking stats for ${result.affectedProductIds.length} product(s)`);
        const freshStats = await orderService.getProductRankingStats(result.affectedProductIds);
        if (Object.keys(freshStats).length > 0) {
          rankingStatsCache.updateProducts(freshStats);
        }
      }
      
      // Trigger classification queue for purchase events
      if (result.userId && classificationQueue && result.action !== 'deleted') {
        try {
          await classificationQueue.enqueue(result.userId, 'purchase');
          console.log(`📋 Enqueued classification job for user ${result.userId} (reason: purchase)`);
        } catch (err) {
          console.error('Failed to enqueue classification for purchase:', err);
          // Don't throw - classification is secondary to webhook processing
        }
      }

      console.log('✅ Order webhook side effects completed');
    }

    return result;
  }

  /**
   * Process product webhook with cache updates
   */
  async processProductWebhook(productData, topic) {
    const { productService, metadataCache } = this.services;

    if (!productService) {
      throw new Error('ProductService not available');
    }

    // Process the product (writes to product metadata tables)
    const result = await productService.processProductWebhook(productData, topic);

    // Update metadata cache if product was upserted
    if (result.success && result.action === 'upserted' && metadataCache) {
      console.log(`🔄 Updating metadata cache for product ${result.productId}`);
      metadataCache.updateProduct(result.productId, result.metadata);
    }

    return result;
  }

  /**
   * Process customer webhook (already handles its own side effects internally)
   */
  async processCustomerWebhook(customerData, topic) {
    const { customerService } = this.services;

    if (!customerService) {
      throw new Error('CustomerService not available');
    }

    // CustomerService already handles cache invalidation and WebSocket broadcasts internally
    const result = await customerService.processCustomerWebhook(customerData, topic);

    return result;
  }

  /**
   * Graceful shutdown
   */
  async close() {
    if (this.worker) {
      await this.worker.close();
      console.log('✅ Webhook worker closed');
    }
  }
}

// Export singleton instance
module.exports = new WebhookWorker();
