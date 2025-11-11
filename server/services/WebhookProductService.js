const Sentry = require('@sentry/node');
const ProductsMetadataRepository = require('../repositories/ProductsMetadataRepository');
const { extractAnimalFromTitle } = require('../utils/animalExtractor');
const { extractFlavorsFromTitle } = require('../utils/flavorExtractor');

class WebhookProductService {
  constructor(db, webSocketGateway = null, metadataCache = null) {
    this.repository = new ProductsMetadataRepository(db);
    this.wsGateway = webSocketGateway;
    this.metadataCache = metadataCache;
  }

  async processProductWebhook(productData, topic) {
    try {
      console.log(`🏷️ Processing ${topic} webhook for product ${productData.id} (${productData.title})`);

      if (topic === 'products/update' || topic === 'products/create') {
        return await this.handleProductUpdate(productData, topic);
      } else if (topic === 'products/delete') {
        return await this.handleProductDelete(productData, topic);
      }

      console.warn(`⚠️ Unknown product webhook topic: ${topic}`);
      return { success: false, reason: 'unknown_topic' };
    } catch (error) {
      console.error('❌ Error processing product webhook:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook-product', topic },
        extra: { productId: productData.id, productTitle: productData.title }
      });
      throw error;
    }
  }

  async handleProductUpdate(productData, topic) {
    const shopifyProductId = productData.id?.toString();
    
    if (!shopifyProductId) {
      console.warn('⚠️ Cannot process product: missing product ID');
      return { success: false, reason: 'missing_product_id' };
    }

    const animal = extractAnimalFromTitle(productData.title);
    const flavors = extractFlavorsFromTitle(productData.title);

    const metadata = {
      title: productData.title,
      animalType: animal?.type || null,
      animalDisplay: animal?.display || null,
      animalIcon: animal?.icon || null,
      vendor: productData.vendor || null,
      primaryFlavor: flavors?.primary || null,
      secondaryFlavors: flavors?.secondary ? JSON.stringify(flavors.secondary) : null,
      flavorDisplay: flavors?.display || null,
      flavorIcon: flavors?.icon || null,
    };

    const [result] = await this.repository.upsertProductMetadata(shopifyProductId, metadata);

    console.log(`✅ Updated metadata for product ${shopifyProductId} (${productData.title})`);

    // Update metadata cache with new product data (granular invalidation)
    if (this.metadataCache) {
      this.metadataCache.updateProduct(shopifyProductId, result);
    }

    // Broadcast to admin room
    this.broadcastAdminUpdate({
      data: {
        topic: topic,
        type: 'products',
        data: {
          id: productData.id,
          title: productData.title,
          vendor: productData.vendor,
          status: productData.status,
          product_type: productData.product_type
        }
      },
      action: 'upserted',
      productId: shopifyProductId
    });

    return {
      success: true,
      action: 'upserted',
      productId: shopifyProductId,
      metadata: result
    };
  }

  async handleProductDelete(productData, topic) {
    const shopifyProductId = productData.id?.toString();
    
    if (!shopifyProductId) {
      console.warn('⚠️ Cannot process product deletion: missing product ID');
      return { success: false, reason: 'missing_product_id' };
    }

    console.log(`🗑️ Product ${shopifyProductId} deleted - metadata will be cleaned up on next sync`);

    // Broadcast to admin room
    this.broadcastAdminUpdate({
      data: {
        topic: topic,
        type: 'products',
        data: {
          id: productData.id,
          title: productData.title,
          vendor: productData.vendor
        }
      },
      action: 'deleted',
      productId: shopifyProductId
    });

    return {
      success: true,
      action: 'noted',
      productId: shopifyProductId,
      note: 'Metadata will be cleaned up on next full product sync'
    };
  }

  /**
   * Broadcast admin update to WebSocket room
   * @param {Object} updateData - Update data to broadcast
   */
  broadcastAdminUpdate(updateData) {
    if (!this.wsGateway || !this.wsGateway.broadcastProductWebhookUpdate) {
      return;
    }

    try {
      this.wsGateway.broadcastProductWebhookUpdate(updateData);
    } catch (error) {
      console.error(`⚠️ Error broadcasting admin update:`, error);
      // Don't throw - broadcast failure shouldn't fail the webhook
    }
  }
}

module.exports = WebhookProductService;
