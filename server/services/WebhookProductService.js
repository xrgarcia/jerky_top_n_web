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
    const shopifyProductId = productData.id ? String(productData.id) : null;
    
    if (!shopifyProductId) {
      console.warn('⚠️ Cannot process product: missing product ID');
      return { success: false, reason: 'missing_product_id' };
    }

    // Check if product has "rankable" tag - skip if it doesn't
    if (!this.hasRankableTag(productData)) {
      console.log(`⏭️ Skipping product ${shopifyProductId} (${productData.title}) - does not have 'rankable' tag`);
      
      // Broadcast skipped event to admin
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
        action: 'skipped',
        productId: shopifyProductId,
        disposition: 'skipped',
        reason: 'Product does not have "rankable" tag',
        changedFields: []
      });

      return {
        success: true,
        action: 'skipped',
        productId: shopifyProductId,
        reason: 'Product does not have "rankable" tag',
        changedFields: []
      };
    }

    // For products/create, process if it has rankable tag
    if (topic === 'products/create') {
      return await this.processProductUpdate(productData, topic, shopifyProductId, 'new_product');
    }

    // For products/update, check if important fields changed
    const changeAnalysis = await this.analyzeProductChanges(shopifyProductId, productData);
    
    if (!changeAnalysis.hasImportantChanges) {
      console.log(`⏭️ Skipping product ${shopifyProductId} - only inventory/timestamp changed`);
      
      // Broadcast skipped event to admin
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
        action: 'skipped',
        productId: shopifyProductId,
        disposition: 'skipped',
        reason: changeAnalysis.skipReason,
        changedFields: changeAnalysis.changedFields
      });

      return {
        success: true,
        action: 'skipped',
        productId: shopifyProductId,
        reason: changeAnalysis.skipReason,
        changedFields: changeAnalysis.changedFields
      };
    }

    // Important fields changed - process the update
    console.log(`✅ Processing product ${shopifyProductId} - important fields changed: ${changeAnalysis.changedFields.join(', ')}`);
    return await this.processProductUpdate(productData, topic, shopifyProductId, 'important_changes', changeAnalysis.changedFields);
  }

  async processProductUpdate(productData, topic, shopifyProductId, reason, changedFields = []) {
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

    // Update metadata cache for this specific product (no full invalidation)
    if (this.metadataCache) {
      await this.metadataCache.updateProduct(shopifyProductId, result);
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
      action: 'processed',
      productId: shopifyProductId,
      disposition: 'processed',
      reason: reason,
      changedFields: changedFields
    });

    return {
      success: true,
      action: 'processed',
      productId: shopifyProductId,
      metadata: result,
      changedFields: changedFields
    };
  }

  /**
   * Check if product has "rankable" tag
   * @param {Object} productData - Shopify product data from webhook
   * @returns {boolean} - True if product has rankable tag
   */
  hasRankableTag(productData) {
    if (!productData || !productData.tags) {
      return false;
    }

    // Shopify tags come as a comma-separated string or space-separated string
    // Examples: "rankable, featured" or "rankable featured"
    const tagsString = String(productData.tags).toLowerCase().trim();
    
    if (!tagsString) {
      return false;
    }

    // Split by comma first, then by space as fallback
    const tags = tagsString.includes(',') 
      ? tagsString.split(',').map(t => t.trim())
      : tagsString.split(/\s+/);

    // Check if "rankable" is in the tag list
    return tags.includes('rankable');
  }

  /**
   * Analyze what changed in a product update webhook
   * Returns whether important fields changed (vs just inventory)
   */
  async analyzeProductChanges(shopifyProductId, incomingProduct) {
    try {
      // Fetch current product metadata from database
      const currentMetadata = await this.repository.getByShopifyProductId(shopifyProductId);
      
      // If product doesn't exist in our DB, treat it as important (new to us)
      if (!currentMetadata) {
        return {
          hasImportantChanges: true,
          changedFields: ['new_product'],
          skipReason: null
        };
      }

      // Check important fields that we care about
      const importantFields = [];
      
      if (currentMetadata.title !== incomingProduct.title) {
        importantFields.push('title');
      }
      
      if (currentMetadata.vendor !== (incomingProduct.vendor || null)) {
        importantFields.push('vendor');
      }

      // Note: We don't store tags in metadata, so we skip tag comparison
      // Tag changes will be caught by the title/vendor check in most admin edits

      // If any important fields changed, process the update
      if (importantFields.length > 0) {
        return {
          hasImportantChanges: true,
          changedFields: importantFields,
          skipReason: null
        };
      }

      // No important fields changed - this is likely just an inventory update from a purchase
      return {
        hasImportantChanges: false,
        changedFields: [],
        skipReason: 'Only inventory or timestamp changed (likely from purchase)'
      };

    } catch (error) {
      console.error('⚠️ Error analyzing product changes:', error);
      // On error, process the update to be safe
      return {
        hasImportantChanges: true,
        changedFields: ['error_analyzing'],
        skipReason: null
      };
    }
  }


  async handleProductDelete(productData, topic) {
    const shopifyProductId = productData.id ? String(productData.id) : null;
    
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
