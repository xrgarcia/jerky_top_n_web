const Sentry = require('@sentry/node');
const ProductsMetadataRepository = require('../repositories/ProductsMetadataRepository');
const { extractAnimalFromTitle } = require('../utils/animalExtractor');
const { extractFlavorsFromTitle } = require('../utils/flavorExtractor');

class WebhookProductService {
  constructor(db) {
    this.repository = new ProductsMetadataRepository(db);
  }

  async processProductWebhook(productData, topic) {
    try {
      console.log(`🏷️ Processing ${topic} webhook for product ${productData.id} (${productData.title})`);

      if (topic === 'products/update' || topic === 'products/create') {
        return await this.handleProductUpdate(productData);
      } else if (topic === 'products/delete') {
        return await this.handleProductDelete(productData);
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

  async handleProductUpdate(productData) {
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

    return {
      success: true,
      action: 'upserted',
      productId: shopifyProductId,
      metadata: result
    };
  }

  async handleProductDelete(productData) {
    const shopifyProductId = productData.id?.toString();
    
    if (!shopifyProductId) {
      console.warn('⚠️ Cannot process product deletion: missing product ID');
      return { success: false, reason: 'missing_product_id' };
    }

    console.log(`🗑️ Product ${shopifyProductId} deleted - metadata will be cleaned up on next sync`);

    return {
      success: true,
      action: 'noted',
      productId: shopifyProductId,
      note: 'Metadata will be cleaned up on next full product sync'
    };
  }
}

module.exports = WebhookProductService;
