const { eq, desc, sql, and, gte } = require('drizzle-orm');
const { productViews } = require('../../shared/schema');

/**
 * ProductViewRepository - Data access layer for product views (trending calculation)
 */
class ProductViewRepository {
  constructor(db) {
    this.db = db;
  }

  async logView(shopifyProductId, userId = null) {
    const result = await this.db.insert(productViews)
      .values({
        shopifyProductId,
        userId,
      })
      .returning();
    return result[0];
  }

  async getViewCount(shopifyProductId, hoursAgo = 24) {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    const result = await this.db.select({
      count: sql`count(*)::int`
    })
    .from(productViews)
    .where(and(
      eq(productViews.shopifyProductId, shopifyProductId),
      gte(productViews.viewedAt, since)
    ));
    
    return result[0]?.count || 0;
  }

  async getTrendingProducts(limit = 10, hoursAgo = 24) {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    return await this.db.select({
      shopifyProductId: productViews.shopifyProductId,
      viewCount: sql`count(*)::int`
    })
    .from(productViews)
    .where(gte(productViews.viewedAt, since))
    .groupBy(productViews.shopifyProductId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  }
}

module.exports = ProductViewRepository;
