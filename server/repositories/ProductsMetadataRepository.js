const { productsMetadata } = require('../../shared/schema');
const { eq } = require('drizzle-orm');

class ProductsMetadataRepository {
  constructor(db) {
    this.db = db;
  }

  async upsertProductMetadata(shopifyProductId, metadata) {
    // CRITICAL: Ensure shopifyProductId is always a string for Drizzle/Neon binding
    // Guards against numeric IDs from cached webhook payloads or retry logic
    if (shopifyProductId && typeof shopifyProductId !== 'string') {
      shopifyProductId = String(shopifyProductId);
      console.warn(`⚠️ Converted numeric Shopify product ID to string: ${shopifyProductId}`);
    }
    
    const existing = await this.db
      .select()
      .from(productsMetadata)
      .where(eq(productsMetadata.shopifyProductId, shopifyProductId))
      .limit(1);

    if (existing.length > 0) {
      const existingData = existing[0];
      const mergeUpdate = {};
      const preservedFields = [];
      const updatedFields = [];
      
      for (const [key, incomingValue] of Object.entries(metadata)) {
        const existingValue = existingData[key];
        
        if (existingValue === null || existingValue === undefined) {
          if (incomingValue !== null && incomingValue !== undefined) {
            mergeUpdate[key] = incomingValue;
            updatedFields.push(key);
          }
        } else {
          preservedFields.push(key);
        }
      }
      
      if (preservedFields.length > 0) {
        console.log(`🔒 Preserving manual edits for ${shopifyProductId}: ${preservedFields.join(', ')}`);
      }
      if (updatedFields.length > 0) {
        console.log(`📝 Auto-populating NULL fields for ${shopifyProductId}: ${updatedFields.join(', ')}`);
      }
      
      if (Object.keys(mergeUpdate).length === 0) {
        return [existingData];
      }
      
      return await this.db
        .update(productsMetadata)
        .set({
          ...mergeUpdate,
          updatedAt: new Date(),
        })
        .where(eq(productsMetadata.shopifyProductId, shopifyProductId))
        .returning();
    } else {
      return await this.db.insert(productsMetadata).values({
        shopifyProductId,
        ...metadata,
      }).returning();
    }
  }

  async getByShopifyProductId(shopifyProductId) {
    // Ensure shopifyProductId is a string for Drizzle/Neon binding
    if (shopifyProductId && typeof shopifyProductId !== 'string') {
      shopifyProductId = String(shopifyProductId);
    }
    
    const result = await this.db
      .select()
      .from(productsMetadata)
      .where(eq(productsMetadata.shopifyProductId, shopifyProductId))
      .limit(1);
    
    return result[0] || null;
  }

  async getAllMetadata() {
    return await this.db.select().from(productsMetadata);
  }

  async getAnimalCounts() {
    const metadata = await this.getAllMetadata();
    const counts = {};
    
    metadata.forEach(item => {
      if (item.animalDisplay) {
        if (!counts[item.animalDisplay]) {
          counts[item.animalDisplay] = {
            animal: item.animalDisplay,
            type: item.animalType,
            icon: item.animalIcon,
            count: 0
          };
        }
        counts[item.animalDisplay].count++;
      }
    });
    
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }

  async getProductsByAnimalType(animalType) {
    return await this.db
      .select()
      .from(productsMetadata)
      .where(eq(productsMetadata.animalType, animalType));
  }

  /**
   * Delete products from metadata table that are not in the provided list of product IDs
   * @param {Array<string>} currentProductIds - Array of current rankable Shopify product IDs
   * @returns {Promise<{deletedCount: number, deletedIds: Array<string>, deletedProducts: Array}>}
   */
  async cleanupOrphanedProducts(currentProductIds) {
    const { sql, notInArray } = require('drizzle-orm');
    
    // If no current products, don't delete everything (safety check)
    if (!currentProductIds || currentProductIds.length === 0) {
      console.warn('⚠️ cleanupOrphanedProducts called with empty product list, skipping cleanup');
      return { deletedCount: 0, deletedIds: [], deletedProducts: [] };
    }
    
    // Find orphaned products (products in DB but not in current list)
    const orphaned = await this.db
      .select({ shopifyProductId: productsMetadata.shopifyProductId, title: productsMetadata.title })
      .from(productsMetadata)
      .where(notInArray(productsMetadata.shopifyProductId, currentProductIds));
    
    if (orphaned.length === 0) {
      return { deletedCount: 0, deletedIds: [], deletedProducts: [] };
    }
    
    const orphanedIds = orphaned.map(p => p.shopifyProductId);
    
    // Delete orphaned products
    await this.db
      .delete(productsMetadata)
      .where(notInArray(productsMetadata.shopifyProductId, currentProductIds));
    
    return {
      deletedCount: orphaned.length,
      deletedIds: orphanedIds,
      deletedProducts: orphaned
    };
  }
}

module.exports = ProductsMetadataRepository;
