const { productsMetadata } = require('../../shared/schema');
const { eq } = require('drizzle-orm');

class ProductsMetadataRepository {
  constructor(db) {
    this.db = db;
  }

  async upsertProductMetadata(shopifyProductId, metadata) {
    const existing = await this.db
      .select()
      .from(productsMetadata)
      .where(eq(productsMetadata.shopifyProductId, shopifyProductId))
      .limit(1);

    if (existing.length > 0) {
      return await this.db
        .update(productsMetadata)
        .set({
          ...metadata,
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
}

module.exports = ProductsMetadataRepository;
