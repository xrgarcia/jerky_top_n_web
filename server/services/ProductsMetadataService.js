const ProductsMetadataRepository = require('../repositories/ProductsMetadataRepository');
const { extractAnimalFromTitle } = require('../utils/animalExtractor');
const { extractFlavorsFromTitle } = require('../utils/flavorExtractor');

class ProductsMetadataService {
  constructor(db) {
    this.repository = new ProductsMetadataRepository(db);
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
        primaryFlavor: flavors?.primary || null,
        secondaryFlavors: flavors?.secondary ? JSON.stringify(flavors.secondary) : null,
        flavorDisplay: flavors?.display || null,
        flavorIcon: flavors?.icon || null,
      };
      
      await this.repository.upsertProductMetadata(product.id, metadata);
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
}

module.exports = ProductsMetadataService;
