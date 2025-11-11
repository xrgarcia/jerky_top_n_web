const express = require('express');
const Sentry = require('@sentry/node');
const ShopifyWebhookVerifier = require('../utils/shopifyWebhookVerifier');
const WebhookOrderService = require('../services/WebhookOrderService');
const WebhookProductService = require('../services/WebhookProductService');
const WebhookCustomerService = require('../services/WebhookCustomerService');
const { db } = require('../db');
const PurchaseHistoryService = require('../services/PurchaseHistoryService');
const webhookQueue = require('../services/WebhookQueue');

function createWebhookRoutes(webSocketGateway = null, sharedCaches = {}, classificationQueue = null) {
  const router = express.Router();
  
  const verifier = new ShopifyWebhookVerifier(process.env.SHOPIFY_API_SECRET);
  const orderService = new WebhookOrderService(webSocketGateway);
  const productService = new WebhookProductService(db);
  const customerService = new WebhookCustomerService(webSocketGateway, sharedCaches);
  
  // Use shared cache instances passed from server.js
  const { metadataCache, rankingStatsCache } = sharedCaches;

  router.post('/orders', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'];
      const topic = req.headers['x-shopify-topic'];
      const shopDomain = req.headers['x-shopify-shop-domain'];

      console.log(`📨 Received Shopify webhook: ${topic} from ${shopDomain}`);

      const isValid = verifier.verify(req.rawBody, hmac);
      if (!isValid) {
        console.error('❌ Webhook verification failed - rejecting request');
        return res.status(401).json({ error: 'Webhook verification failed' });
      }

      console.log('✅ Webhook signature verified');

      // Enqueue webhook for async processing (fast response to Shopify)
      if (webhookQueue.isReady()) {
        const orderData = req.body;
        const job = await webhookQueue.enqueue('orders', topic, orderData, {
          shopDomain,
          receivedAt: new Date().toISOString(),
        });

        console.log(`✅ Order webhook enqueued for async processing (job: ${job.id})`);

        // Fast 200 response to Shopify (prevents retries)
        return res.status(200).json({ 
          success: true,
          message: 'Webhook accepted and queued for processing',
          jobId: job.id,
        });
      } else {
        // Fallback to synchronous processing if queue not available
        console.warn('⚠️ Webhook queue not available, processing synchronously');
        
        const orderData = req.body;
        const result = await orderService.processOrderWebhook(orderData, topic);

        if (result.success && (result.userId || result.action === 'deleted')) {
          if (result.userId) {
            console.log(`🔄 Invalidating purchase history cache for user ${result.userId}`);
            
            const purchaseHistoryService = new PurchaseHistoryService();
            purchaseHistoryService.invalidateUserCache(result.userId);
          }
          
          // Update only affected products in ranking stats cache
          if (result.affectedProductIds && result.affectedProductIds.length > 0 && rankingStatsCache) {
            console.log(`🔄 Recalculating ranking stats for ${result.affectedProductIds.length} product(s)`);
            const freshStats = await orderService.getProductRankingStats(result.affectedProductIds);
            if (Object.keys(freshStats).length > 0) {
              rankingStatsCache.updateProducts(freshStats);
            }
          }
          
          console.log('✅ Caches updated');
          
          // Trigger classification queue for purchase events
          if (result.userId && classificationQueue && result.action !== 'deleted') {
            setImmediate(async () => {
              try {
                await classificationQueue.enqueue(result.userId, 'purchase');
                console.log(`📋 Enqueued classification job for user ${result.userId} (reason: purchase)`);
              } catch (err) {
                console.error('Failed to enqueue classification for purchase:', err);
              }
            });
          }
        }

        return res.status(200).json({ 
          success: true,
          message: 'Webhook processed successfully (synchronous fallback)',
          result
        });
      }

    } catch (error) {
      console.error('❌ Error processing order webhook:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook', webhook_type: 'orders' }
      });
      
      res.status(500).json({ 
        error: 'Failed to process webhook',
        message: error.message
      });
    }
  });

  router.post('/products', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'];
      const topic = req.headers['x-shopify-topic'];
      const shopDomain = req.headers['x-shopify-shop-domain'];

      console.log(`📨 Received Shopify webhook: ${topic} from ${shopDomain}`);

      const isValid = verifier.verify(req.rawBody, hmac);
      if (!isValid) {
        console.error('❌ Webhook verification failed - rejecting request');
        return res.status(401).json({ error: 'Webhook verification failed' });
      }

      console.log('✅ Webhook signature verified');

      // Enqueue webhook for async processing (fast response to Shopify)
      if (webhookQueue.isReady()) {
        const productData = req.body;
        const job = await webhookQueue.enqueue('products', topic, productData, {
          shopDomain,
          receivedAt: new Date().toISOString(),
        });

        console.log(`✅ Product webhook enqueued for async processing (job: ${job.id})`);

        // Fast 200 response to Shopify (prevents retries)
        return res.status(200).json({ 
          success: true,
          message: 'Webhook accepted and queued for processing',
          jobId: job.id,
        });
      } else {
        // Fallback to synchronous processing if queue not available
        console.warn('⚠️ Webhook queue not available, processing synchronously');
        
        const productData = req.body;
        const result = await productService.processProductWebhook(productData, topic);

        if (result.success && result.action === 'upserted' && metadataCache) {
          // Update just this product in the cache instead of invalidating everything
          metadataCache.updateProduct(result.productId, result.metadata);
        }

        return res.status(200).json({ 
          success: true,
          message: 'Webhook processed successfully (synchronous fallback)',
          result
        });
      }

    } catch (error) {
      console.error('❌ Error processing product webhook:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook', webhook_type: 'products' }
      });
      
      res.status(500).json({ 
        error: 'Failed to process webhook',
        message: error.message
      });
    }
  });

  router.post('/customers', async (req, res) => {
    try {
      const hmac = req.headers['x-shopify-hmac-sha256'];
      const topic = req.headers['x-shopify-topic'];
      const shopDomain = req.headers['x-shopify-shop-domain'];

      console.log(`📨 Received Shopify webhook: ${topic} from ${shopDomain}`);

      const isValid = verifier.verify(req.rawBody, hmac);
      if (!isValid) {
        console.error('❌ Webhook verification failed - rejecting request');
        return res.status(401).json({ error: 'Webhook verification failed' });
      }

      console.log('✅ Webhook signature verified');

      // Enqueue webhook for async processing (fast response to Shopify)
      if (webhookQueue.isReady()) {
        const customerData = req.body;
        const job = await webhookQueue.enqueue('customers', topic, customerData, {
          shopDomain,
          receivedAt: new Date().toISOString(),
        });

        console.log(`✅ Customer webhook enqueued for async processing (job: ${job.id})`);

        // Fast 200 response to Shopify (prevents retries)
        return res.status(200).json({ 
          success: true,
          message: 'Webhook accepted and queued for processing',
          jobId: job.id,
        });
      } else {
        // Fallback to synchronous processing if queue not available
        console.warn('⚠️ Webhook queue not available, processing synchronously');
        
        const customerData = req.body;
        const result = await customerService.processCustomerWebhook(customerData, topic);

        return res.status(200).json({ 
          success: true,
          message: 'Webhook processed successfully (synchronous fallback)',
          result
        });
      }

    } catch (error) {
      console.error('❌ Error processing customer webhook:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook', webhook_type: 'customers' }
      });
      
      res.status(500).json({ 
        error: 'Failed to process webhook',
        message: error.message
      });
    }
  });

  router.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok',
      message: 'Shopify webhook endpoints are ready',
      endpoints: [
        '/api/webhooks/shopify/orders',
        '/api/webhooks/shopify/products',
        '/api/webhooks/shopify/customers'
      ]
    });
  });

  return router;
}

module.exports = createWebhookRoutes;
