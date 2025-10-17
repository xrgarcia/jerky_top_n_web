const { desc, sql, eq } = require('drizzle-orm');
const { users, productRankings, userAchievements, achievements, pageViews, userProductSearches } = require('../../shared/schema');
const LeaderboardPositionCache = require('../cache/LeaderboardPositionCache');

/**
 * LeaderboardManager - Domain service for leaderboard calculations
 */
class LeaderboardManager {
  constructor(db) {
    this.db = db;
    this.positionCache = LeaderboardPositionCache.getInstance();
  }

  /**
   * Get top rankers leaderboard
   * Ranks users by engagement score = achievements + page views + rankings + searches
   * @param {number} limit - Number of top rankers to return
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {Array} Leaderboard entries
   */
  async getTopRankers(limit = 50, period = 'all_time') {
    let dateFilter = '';
    
    if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = `>= '${weekAgo.toISOString()}'`;
    } else if (period === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = `>= '${monthAgo.toISOString()}'`;
    }

    // Calculate engagement score = achievements + page views + rankings + searches
    // Use FILTER to apply date conditions per metric
    const achievementsCount = dateFilter 
      ? `COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at ${dateFilter})`
      : `COUNT(DISTINCT ua.id)`;
    
    const pageViewsCount = dateFilter
      ? `COUNT(DISTINCT pv.id) FILTER (WHERE pv.viewed_at ${dateFilter})`
      : `COUNT(DISTINCT pv.id)`;
    
    const rankingsCount = dateFilter
      ? `COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at ${dateFilter})`
      : `COUNT(DISTINCT pr.id)`;
    
    const searchesCount = dateFilter
      ? `COUNT(DISTINCT ups.id) FILTER (WHERE ups.searched_at ${dateFilter})`
      : `COUNT(DISTINCT ups.id)`;

    const query = `
      SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.display_name,
        u.email,
        COALESCE(COUNT(DISTINCT pr.shopify_product_id), 0)::int as unique_products,
        (COALESCE(${achievementsCount}, 0) 
         + COALESCE(${pageViewsCount}, 0) 
         + COALESCE(${rankingsCount}, 0) 
         + COALESCE(${searchesCount}, 0))::int as engagement_score
      FROM users u
      LEFT JOIN product_rankings pr ON pr.user_id = u.id
      LEFT JOIN page_views pv ON pv.user_id = u.id
      LEFT JOIN user_achievements ua ON ua.user_id = u.id
      LEFT JOIN user_product_searches ups ON ups.user_id = u.id
      GROUP BY u.id
      HAVING (COALESCE(${achievementsCount}, 0) 
              + COALESCE(${pageViewsCount}, 0) 
              + COALESCE(${rankingsCount}, 0) 
              + COALESCE(${searchesCount}, 0)) > 0
      ORDER BY engagement_score DESC
      LIMIT ${limit}
    `;

    const results = await this.db.execute(sql.raw(query));

    const leaderboard = results.rows.map(row => ({
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      email: row.email,
      uniqueProducts: row.unique_products,
      engagementScore: row.engagement_score,
    }));

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
   * OPTIMIZED: Uses cache and COUNT-based query instead of window functions
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {Object} User's position and stats
   */
  async getUserPosition(userId, period = 'all_time') {
    const startTime = Date.now();
    
    // Check cache first (include period in key)
    const cached = this.positionCache.get(userId, period);
    if (cached) {
      return cached;
    }
    
    let dateFilter = '';
    
    if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = `>= '${weekAgo.toISOString()}'`;
    } else if (period === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = `>= '${monthAgo.toISOString()}'`;
    }

    // Build engagement score calculation
    const achievementsCount = dateFilter 
      ? `COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at ${dateFilter})`
      : `COUNT(DISTINCT ua.id)`;
    
    const pageViewsCount = dateFilter
      ? `COUNT(DISTINCT pv.id) FILTER (WHERE pv.viewed_at ${dateFilter})`
      : `COUNT(DISTINCT pv.id)`;
    
    const rankingsCount = dateFilter
      ? `COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at ${dateFilter})`
      : `COUNT(DISTINCT pr.id)`;
    
    const searchesCount = dateFilter
      ? `COUNT(DISTINCT ups.id) FILTER (WHERE ups.searched_at ${dateFilter})`
      : `COUNT(DISTINCT ups.id)`;

    // OPTIMIZED: Use subquery with GROUP BY + HAVING instead of window functions
    // This calculates only what we need for one user instead of ranking everyone
    const positionQuery = `
      WITH all_scores AS (
        SELECT 
          u.id as user_id,
          COALESCE(COUNT(DISTINCT pr.shopify_product_id), 0)::int as unique_products,
          (COALESCE(${achievementsCount}, 0) 
           + COALESCE(${pageViewsCount}, 0) 
           + COALESCE(${rankingsCount}, 0) 
           + COALESCE(${searchesCount}, 0))::int as engagement_score
        FROM users u
        LEFT JOIN product_rankings pr ON pr.user_id = u.id
        LEFT JOIN page_views pv ON pv.user_id = u.id
        LEFT JOIN user_achievements ua ON ua.user_id = u.id
        LEFT JOIN user_product_searches ups ON ups.user_id = u.id
        GROUP BY u.id
        HAVING (COALESCE(${achievementsCount}, 0) 
                + COALESCE(${pageViewsCount}, 0) 
                + COALESCE(${rankingsCount}, 0) 
                + COALESCE(${searchesCount}, 0)) > 0
      ),
      user_score AS (
        SELECT * FROM all_scores WHERE user_id = ${userId}
      ),
      higher_scores AS (
        SELECT COUNT(*)::int as users_above
        FROM all_scores
        WHERE engagement_score > (SELECT engagement_score FROM user_score)
      ),
      total_active AS (
        SELECT COUNT(*)::int as total_users FROM all_scores
      )
      SELECT 
        us.user_id,
        us.unique_products,
        us.engagement_score,
        COALESCE((SELECT users_above FROM higher_scores), 0) + 1 as rank,
        COALESCE((SELECT total_users FROM total_active), 0) as total_users
      FROM user_score us
    `;

    const queryStartTime = Date.now();
    const positionResult = await this.db.execute(sql.raw(positionQuery));
    const queryExecutionTime = Date.now() - queryStartTime;
    const totalTime = Date.now() - startTime;
    
    console.log(`⏱️ getUserPosition() optimized COUNT query: ${queryExecutionTime}ms (total: ${totalTime}ms)`);
    
    if (!positionResult.rows.length || positionResult.rows[0].engagement_score === 0) {
      const result = {
        userId,
        rank: null,
        engagementScore: 0,
        uniqueProducts: 0,
        percentile: null,
      };
      return result;
    }

    const { rank, engagement_score, unique_products, total_users } = positionResult.rows[0];
    const percentile = total_users > 0 ? ((total_users - rank + 1) / total_users * 100).toFixed(1) : 0;

    const result = {
      userId,
      rank,
      engagementScore: engagement_score,
      uniqueProducts: unique_products,
      percentile: parseFloat(percentile),
      totalUsers: total_users,
    };
    
    // Cache the result (include period in key)
    this.positionCache.set(userId, period, result);
    
    return result;
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

  /**
   * Calculate completed animal categories for a user
   * Returns array of animal names where user has ranked ALL products (animal must have >2 products)
   * @param {number} userId - User ID
   * @param {Object} productsService - ProductsService instance
   * @returns {Promise<Array<string>>} Array of completed animal category names
   */
  async getCompletedAnimalCategories(userId, productsService) {
    const completedCategories = [];
    
    if (!productsService) {
      return completedCategories;
    }
    
    try {
      // Get all products with metadata
      const productsWithMetadata = await productsService.getAllProducts({ 
        includeMetadata: true, 
        includeRankingStats: false 
      });
      
      // Group products by animal
      const animalGroups = {};
      productsWithMetadata.forEach(product => {
        if (product.animalDisplay) {
          if (!animalGroups[product.animalDisplay]) {
            animalGroups[product.animalDisplay] = [];
          }
          animalGroups[product.animalDisplay].push(product.id);
        }
      });
      
      // Get user's ranked product IDs
      const userRankings = await this.db.select()
        .from(productRankings)
        .where(eq(productRankings.userId, userId));
      const rankedIds = new Set(userRankings.map(r => r.shopifyProductId));
      
      // Check each animal group
      for (const [animal, productIds] of Object.entries(animalGroups)) {
        // Only consider animals with >2 products
        if (productIds.length > 2) {
          // Check if user has ranked ALL products from this animal
          const hasRankedAll = productIds.every(id => rankedIds.has(id));
          if (hasRankedAll) {
            completedCategories.push(animal);
          }
        }
      }
    } catch (error) {
      console.error('Error calculating completed animal categories:', error);
    }
    
    return completedCategories;
  }
}

module.exports = LeaderboardManager;
