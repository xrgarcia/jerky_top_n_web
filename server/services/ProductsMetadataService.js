const ProductsMetadataRepository = require('../repositories/ProductsMetadataRepository');
const { extractAnimalFromTitle } = require('../utils/animalExtractor');
const { extractFlavorsFromTitle } = require('../utils/flavorExtractor');

class ProductsMetadataService {
  constructor(db, metadataCache = null) {
    this.repository = new ProductsMetadataRepository(db);
    this.metadataCache = metadataCache;
  }

  /**
   * Sync products from Shopify with metadata table
   * @param {Array} products - Array of Shopify products
   * @returns {Promise<number>} - Number of products synced
   */
  async syncProductsMetadata(products) {
    let syncedCount = 0;
    
    for (const product of products) {
      const animal = extractAnimalFromTitle(product.title);
      const flavors = extractFlavorsFromTitle(product.title);
      
      const metadata = {
        title: product.title,
        animalType: animal?.type || null,
        animalDisplay: animal?.display || null,
        animalIcon: animal?.icon || null,
        vendor: product.vendor || null,
        primaryFlavor: flavors?.primary || null,
        secondaryFlavors: flavors?.secondary ? JSON.stringify(flavors.secondary) : null,
        flavorDisplay: flavors?.display || null,
        flavorIcon: flavors?.icon || null,
      };
      
      const [result] = await this.repository.upsertProductMetadata(product.id, metadata);
      
      // Update metadata cache for this specific product (no full invalidation)
      if (this.metadataCache) {
        await this.metadataCache.updateProduct(product.id, result);
      }
      
      syncedCount++;
    }
    
    return syncedCount;
  }

  /**
   * Get animal categories with counts
   * @returns {Promise<Array>} - Array of {animal, type, icon, count}
   */
  async getAnimalCategories() {
    return await this.repository.getAnimalCounts();
  }

  /**
   * Get metadata for a specific product
   * @param {string} shopifyProductId
   * @returns {Promise<object|null>}
   */
  async getProductMetadata(shopifyProductId) {
    return await this.repository.getByShopifyProductId(shopifyProductId);
  }

  /**
   * Clean up orphaned products from metadata table
   * Products that are no longer rankable in Shopify will be removed
   * @param {Array<object>} currentRankableProducts - Array of current rankable Shopify products
   * @returns {Promise<{deletedCount: number, deletedIds: Array<string>}>}
   */
  async cleanupOrphanedProducts(currentRankableProducts) {
    const Sentry = require('@sentry/node');
    
    // Extract product IDs from current rankable products
    const currentProductIds = currentRankableProducts.map(p => p.id);
    
    if (currentProductIds.length === 0) {
      console.log('⚠️ No current products to sync, skipping cleanup');
      return { deletedCount: 0, deletedIds: [] };
    }
    
    console.log(`🧹 Checking for orphaned products in metadata table...`);
    console.log(`   Current rankable products: ${currentProductIds.length}`);
    
    try {
      const result = await this.repository.cleanupOrphanedProducts(currentProductIds);
      
      if (result.deletedCount > 0) {
        console.log(`🗑️ Cleaned up ${result.deletedCount} orphaned products from metadata table`);
      } else {
        console.log(`✅ No orphaned products found in metadata table`);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error cleaning up orphaned products:', error);
      
      // Log error to Sentry
      Sentry.captureException(error, {
        level: 'error',
        tags: { 
          service: 'products', 
          operation: 'metadata_cleanup'
        },
        extra: {
          current_rankable_count: currentProductIds.length
        }
      });
      
      // Don't fail the sync if cleanup fails
      return { deletedCount: 0, deletedIds: [] };
    }
  }
}

module.exports = ProductsMetadataService;
