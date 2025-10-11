const { desc, sql, eq } = require('drizzle-orm');
const { users, productRankings, userAchievements, achievements } = require('../../shared/schema');

/**
 * LeaderboardManager - Domain service for leaderboard calculations
 */
class LeaderboardManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get top rankers leaderboard
   * @param {number} limit - Number of top rankers to return
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {Array} Leaderboard entries
   */
  async getTopRankers(limit = 50, period = 'all_time') {
    let dateFilter = null;
    
    if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = sql`${productRankings.createdAt} >= ${weekAgo}`;
    } else if (period === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = sql`${productRankings.createdAt} >= ${monthAgo}`;
    }

    const query = this.db
      .select({
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        totalRankings: sql`count(distinct ${productRankings.id})::int`,
        uniqueProducts: sql`count(distinct ${productRankings.shopifyProductId})::int`,
      })
      .from(users)
      .innerJoin(productRankings, eq(productRankings.userId, users.id))
      .groupBy(users.id)
      .orderBy(desc(sql`count(distinct ${productRankings.id})`))
      .limit(limit);

    if (dateFilter) {
      query.where(dateFilter);
    }

    const leaderboard = await query;

    const leaderboardWithBadges = await Promise.all(
      leaderboard.map(async (entry, index) => {
        const badges = await this.db.select({
          code: achievements.code,
          name: achievements.name,
          icon: achievements.icon,
          tier: achievements.tier,
        })
        .from(userAchievements)
        .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
        .where(eq(userAchievements.userId, entry.userId))
        .orderBy(desc(userAchievements.earnedAt))
        .limit(3);

        return {
          ...entry,
          rank: index + 1,
          badges,
        };
      })
    );

    return leaderboardWithBadges;
  }

  /**
   * Get user's leaderboard position
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {Object} User's position and stats
   */
  async getUserPosition(userId, period = 'all_time') {
    const leaderboard = await this.getTopRankers(999, period);
    const userEntry = leaderboard.find(entry => entry.userId === userId);
    
    if (!userEntry) {
      return {
        userId,
        rank: null,
        totalRankings: 0,
        uniqueProducts: 0,
        percentile: null,
      };
    }

    const percentile = ((leaderboard.length - userEntry.rank + 1) / leaderboard.length * 100).toFixed(1);

    return {
      ...userEntry,
      percentile: parseFloat(percentile),
      totalUsers: leaderboard.length,
    };
  }

  /**
   * Get user comparison data
   * @param {number} userId1 - First user ID
   * @param {number} userId2 - Second user ID
   * @returns {Object} Comparison data
   */
  async compareUsers(userId1, userId2) {
    const [user1Stats, user2Stats] = await Promise.all([
      this.getUserStats(userId1),
      this.getUserStats(userId2),
    ]);

    const similarity = this.calculateTasteSimilarity(user1Stats, user2Stats);

    return {
      user1: user1Stats,
      user2: user2Stats,
      similarity,
    };
  }

  /**
   * Get detailed user stats
   */
  async getUserStats(userId) {
    const rankings = await this.db.select({
      productId: productRankings.shopifyProductId,
      rank: productRankings.ranking,
      productData: productRankings.productData,
    })
    .from(productRankings)
    .where(eq(productRankings.userId, userId));

    const uniqueBrands = new Set(rankings.map(r => r.productData?.vendor).filter(Boolean));

    return {
      userId,
      totalRankings: rankings.length,
      uniqueProducts: rankings.length,
      uniqueBrands: uniqueBrands.size,
      topRanked: rankings.filter(r => r.rank <= 5),
    };
  }

  /**
   * Calculate taste similarity between two users (simplified)
   */
  calculateTasteSimilarity(stats1, stats2) {
    const products1 = new Set(stats1.topRanked.map(r => r.productId));
    const products2 = new Set(stats2.topRanked.map(r => r.productId));
    
    const intersection = [...products1].filter(p => products2.has(p)).length;
    const union = new Set([...products1, ...products2]).size;
    
    if (union === 0) return 0;
    
    return Math.round((intersection / union) * 100);
  }
}

module.exports = LeaderboardManager;
