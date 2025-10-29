const express = require('express');
const Sentry = require('@sentry/node');
const ShopifyWebhookVerifier = require('../utils/shopifyWebhookVerifier');
const WebhookOrderService = require('../services/WebhookOrderService');
const WebhookProductService = require('../services/WebhookProductService');
const { db } = require('../storage');
const MetadataCache = require('../cache/MetadataCache');
const RankingStatsCache = require('../cache/RankingStatsCache');
const PurchaseHistoryService = require('../services/PurchaseHistoryService');

function createWebhookRoutes() {
  const router = express.Router();
  
  const verifier = new ShopifyWebhookVerifier(process.env.SHOPIFY_API_SECRET);
  const orderService = new WebhookOrderService();
  const productService = new WebhookProductService(db);
  const metadataCache = new MetadataCache();
  const rankingStatsCache = new RankingStatsCache();

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

      const orderData = req.body;
      const result = await orderService.processOrderWebhook(orderData, topic);

      if (result.success && (result.userId || result.action === 'deleted')) {
        if (result.userId) {
          console.log(`🔄 Invalidating caches for user ${result.userId}`);
          
          const purchaseHistoryService = new PurchaseHistoryService();
          purchaseHistoryService.invalidateUserCache(result.userId);
        }
        
        rankingStatsCache.invalidate();
        
        console.log('✅ Caches invalidated');
      }

      Sentry.captureMessage(`Shopify order webhook processed: ${topic}`, {
        level: 'info',
        tags: { 
          service: 'webhook', 
          topic,
          action: result.action 
        },
        extra: { 
          orderNumber: result.orderNumber,
          userId: result.userId,
          itemsProcessed: result.itemsProcessed || result.recordsDeleted
        }
      });

      res.status(200).json({ 
        success: true,
        message: 'Webhook processed successfully',
        result
      });

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

      const productData = req.body;
      const result = await productService.processProductWebhook(productData, topic);

      if (result.success && result.action === 'upserted') {
        console.log('🔄 Invalidating metadata cache');
        metadataCache.invalidate();
        console.log('✅ Metadata cache invalidated');
      }

      Sentry.captureMessage(`Shopify product webhook processed: ${topic}`, {
        level: 'info',
        tags: { 
          service: 'webhook', 
          topic,
          action: result.action 
        },
        extra: { 
          productId: result.productId
        }
      });

      res.status(200).json({ 
        success: true,
        message: 'Webhook processed successfully',
        result
      });

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

  router.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok',
      message: 'Shopify webhook endpoints are ready',
      endpoints: [
        '/api/webhooks/shopify/orders',
        '/api/webhooks/shopify/products'
      ]
    });
  });

  return router;
}

module.exports = createWebhookRoutes;
