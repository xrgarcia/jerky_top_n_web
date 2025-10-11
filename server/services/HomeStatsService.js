const { sql } = require('drizzle-orm');

/**
 * HomeStatsService - Aggregates statistics for home page dashboard
 */
class HomeStatsService {
  constructor(db, leaderboardManager, activityLogRepo, productViewRepo) {
    this.db = db;
    this.leaderboardManager = leaderboardManager;
    this.activityLogRepo = activityLogRepo;
    this.productViewRepo = productViewRepo;
  }

  /**
   * Get top 5 rankers by total rankings
   */
  async getTopRankers(limit = 5) {
    return await this.leaderboardManager.getTopRankers(limit, 'all_time');
  }

  /**
   * Get top 5 products by average rank (lower is better)
   */
  async getTopProductsByAvgRank(limit = 5) {
    const results = await this.db.execute(sql`
      SELECT 
        shopify_product_id,
        product_data,
        COUNT(*) as rank_count,
        AVG(ranking) as avg_rank,
        MIN(ranking) as best_rank,
        MAX(ranking) as worst_rank
      FROM product_rankings
      WHERE product_data IS NOT NULL
      GROUP BY shopify_product_id, product_data
      HAVING COUNT(*) >= 1
      ORDER BY avg_rank ASC
      LIMIT ${limit}
    `);

    return results.rows.map(row => ({
      productId: row.shopify_product_id,
      productData: row.product_data,
      rankCount: parseInt(row.rank_count),
      avgRank: parseFloat(row.avg_rank).toFixed(1),
      bestRank: parseInt(row.best_rank),
      worstRank: parseInt(row.worst_rank),
    }));
  }

  /**
   * Get most recently ranked products
   */
  async getRecentlyRankedProducts(limit = 5) {
    // Get most recent ranking events with user info in one query
    const results = await this.db.execute(sql`
      SELECT 
        pr.shopify_product_id,
        pr.product_data,
        pr.ranking,
        pr.created_at,
        u.first_name,
        u.last_name
      FROM product_rankings pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.product_data IS NOT NULL
      ORDER BY pr.created_at DESC
      LIMIT ${limit * 3}
    `);

    // Deduplicate by product while maintaining recency order
    const uniqueProducts = [];
    const seenIds = new Set();
    
    for (const row of results.rows) {
      if (!seenIds.has(row.shopify_product_id) && uniqueProducts.length < limit) {
        seenIds.add(row.shopify_product_id);
        
        uniqueProducts.push({
          productId: row.shopify_product_id,
          productData: row.product_data,
          ranking: parseInt(row.ranking),
          rankedAt: row.created_at,
          rankedBy: `${row.first_name} ${row.last_name.charAt(0)}.`,
        });
      }
    }

    return uniqueProducts;
  }

  /**
   * Get trending products (most ranked in last 7 days)
   */
  async getTrendingProducts(limit = 5, days = 7) {
    const results = await this.db.execute(sql`
      SELECT 
        shopify_product_id,
        product_data,
        COUNT(*) as recent_rank_count,
        AVG(ranking) as avg_rank
      FROM product_rankings
      WHERE 
        product_data IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${sql.raw(days.toString())} days'
      GROUP BY shopify_product_id, product_data
      ORDER BY recent_rank_count DESC, avg_rank ASC
      LIMIT ${limit}
    `);

    return results.rows.map(row => ({
      productId: row.shopify_product_id,
      productData: row.product_data,
      recentRankCount: parseInt(row.recent_rank_count),
      avgRank: parseFloat(row.avg_rank).toFixed(1),
    }));
  }

  /**
   * Get most debated products (highest variance in rankings)
   */
  async getMostDebatedProducts(limit = 5) {
    const results = await this.db.execute(sql`
      SELECT 
        shopify_product_id,
        product_data,
        COUNT(*) as rank_count,
        AVG(ranking) as avg_rank,
        STDDEV(ranking) as rank_variance,
        MIN(ranking) as best_rank,
        MAX(ranking) as worst_rank
      FROM product_rankings
      WHERE product_data IS NOT NULL
      GROUP BY shopify_product_id, product_data
      HAVING COUNT(*) >= 2
      ORDER BY STDDEV(ranking) DESC
      LIMIT ${limit}
    `);

    return results.rows.map(row => ({
      productId: row.shopify_product_id,
      productData: row.product_data,
      rankCount: parseInt(row.rank_count),
      avgRank: parseFloat(row.avg_rank).toFixed(1),
      variance: parseFloat(row.rank_variance).toFixed(1),
      bestRank: parseInt(row.best_rank),
      worstRank: parseInt(row.worst_rank),
    }));
  }

  /**
   * Get recent achievements earned by community
   */
  async getRecentAchievements(limit = 5) {
    const results = await this.db.execute(sql`
      SELECT 
        ua.user_id,
        ua.earned_at,
        a.name as achievement_name,
        a.icon as achievement_icon,
        a.tier as achievement_tier,
        u.first_name,
        u.last_name
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      JOIN users u ON ua.user_id = u.id
      ORDER BY ua.earned_at DESC
      LIMIT ${limit}
    `);

    return results.rows.map(row => ({
      userId: row.user_id,
      userName: `${row.first_name} ${row.last_name.charAt(0)}.`,
      achievementName: row.achievement_name,
      achievementIcon: row.achievement_icon,
      achievementTier: row.achievement_tier,
      earnedAt: row.earned_at,
    }));
  }

  /**
   * Get community stats overview
   */
  async getCommunityStats() {
    const [totalRankings, totalRankers, totalProducts, activeToday] = await Promise.all([
      // Total rankings
      this.db.execute(sql`SELECT COUNT(*) as count FROM product_rankings`),
      
      // Total unique rankers
      this.db.execute(sql`SELECT COUNT(DISTINCT user_id) as count FROM product_rankings`),
      
      // Total unique products ranked
      this.db.execute(sql`SELECT COUNT(DISTINCT shopify_product_id) as count FROM product_rankings`),
      
      // Active rankers today
      this.db.execute(sql`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM product_rankings 
        WHERE created_at >= CURRENT_DATE
      `),
    ]);

    const avgRankingsResult = await this.db.execute(sql`
      SELECT AVG(ranking_count) as avg_rankings
      FROM (
        SELECT user_id, COUNT(*) as ranking_count
        FROM product_rankings
        GROUP BY user_id
      ) user_rankings
    `);

    return {
      totalRankings: parseInt(totalRankings.rows[0].count),
      totalRankers: parseInt(totalRankers.rows[0].count),
      totalProducts: parseInt(totalProducts.rows[0].count),
      activeToday: parseInt(activeToday.rows[0].count),
      avgRankingsPerUser: parseFloat(avgRankingsResult.rows[0].avg_rankings || 0).toFixed(1),
    };
  }

  /**
   * Get all home page stats in one call
   */
  async getAllHomeStats() {
    const [
      topRankers,
      topProducts,
      recentlyRanked,
      trending,
      debated,
      recentAchievements,
      communityStats,
    ] = await Promise.all([
      this.getTopRankers(5),
      this.getTopProductsByAvgRank(5),
      this.getRecentlyRankedProducts(5),
      this.getTrendingProducts(5, 7),
      this.getMostDebatedProducts(5),
      this.getRecentAchievements(5),
      this.getCommunityStats(),
    ]);

    return {
      topRankers,
      topProducts,
      recentlyRanked,
      trending,
      debated,
      recentAchievements,
      communityStats,
    };
  }
}

module.exports = HomeStatsService;
