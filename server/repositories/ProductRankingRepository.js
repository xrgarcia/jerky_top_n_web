const { productRankings } = require('../../shared/schema.js');
const { db } = require('../db.js');
const { eq, and, inArray } = require('drizzle-orm');
const Sentry = require('@sentry/node');

/**
 * ProductRankingRepository
 * Handles data access for product rankings following the Repository pattern
 */
class ProductRankingRepository {
  /**
   * Get all Shopify product IDs that a user has ranked
   * @param {number} userId - The user's ID
   * @param {string} rankingListId - The ranking list ID (default: 'topN')
   * @returns {Promise<string[]>} Array of Shopify product IDs
   */
  async getRankedProductIdsByUser(userId, rankingListId = 'topN') {
    try {
      const rankedProducts = await db
        .select({ shopifyProductId: productRankings.shopifyProductId })
        .from(productRankings)
        .where(
          and(
            eq(productRankings.userId, userId),
            eq(productRankings.rankingListId, rankingListId)
          )
        );

      return rankedProducts.map(r => r.shopifyProductId);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'product-ranking-repository' },
        extra: { userId, rankingListId }
      });
      console.error('Error fetching ranked product IDs:', error);
      return []; // Return empty array on error to prevent breaking the UI
    }
  }
}

module.exports = new ProductRankingRepository();
