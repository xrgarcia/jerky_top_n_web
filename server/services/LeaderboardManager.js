const { desc, sql, eq } = require('drizzle-orm');
const { users, productRankings, userAchievements, achievements } = require('../../shared/schema');
const LeaderboardPositionCache = require('../cache/LeaderboardPositionCache');
const LeaderboardCache = require('../cache/LeaderboardCache');

/**
 * LeaderboardManager - Domain service for leaderboard calculations
 */
class LeaderboardManager {
  constructor(db, communityService = null) {
    this.db = db;
    this.communityService = communityService;
    this.positionCache = LeaderboardPositionCache.getInstance();
    this.leaderboardCache = LeaderboardCache.getInstance();
  }

  /**
   * Get top rankers leaderboard
   * Ranks users by engagement score = achievements + page views + rankings + searches
   * Uses cache to avoid expensive repeated queries
   * @param {number} limit - Number of top rankers to return
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {Array} Leaderboard entries
   */
  async getTopRankers(limit = 50, period = 'all_time') {
    // Check cache first
    const cached = await this.leaderboardCache.get(period, limit);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch fresh data
    const startTime = Date.now();
    
    // OPTIMIZED: Use pre-aggregated user_engagement_scores table instead of expensive joins
    // This eliminates the 12M row Cartesian product and reduces query time from 41.4s to <300ms
    let scoreField;
    if (period === 'week') {
      scoreField = 'ues.engagement_score_week';
    } else if (period === 'month') {
      scoreField = 'ues.engagement_score_month';
    } else {
      scoreField = 'ues.engagement_score';
    }

    const query = `
      SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.display_name,
        u.email,
        u.profile_image_url,
        u.handle,
        u.hide_name_privacy,
        COALESCE(ues.unique_products_count, 0)::int as unique_products,
        COALESCE(${scoreField}, 0)::int as engagement_score
      FROM users u
      INNER JOIN user_engagement_scores ues ON ues.user_id = u.id
      WHERE u.active = true
        AND ${scoreField} > 0
      ORDER BY ${scoreField} DESC
      LIMIT ${limit}
    `;

    const results = await this.db.execute(sql.raw(query));

    const leaderboard = results.rows.map(row => {
      // Use CommunityService for privacy-aware formatting if available
      const displayName = this.communityService 
        ? this.communityService.formatDisplayName(row)
        : row.display_name;
      
      const initials = this.communityService
        ? this.communityService.getUserInitials(row)
        : row.first_name?.charAt(0) || '?';
      
      const avatarUrl = this.communityService
        ? this.communityService.getAvatarUrl(row)
        : row.profile_image_url;
      
      const hideNamePrivacy = row.hide_name_privacy;
      
      return {
        userId: row.user_id,
        displayName,
        avatarUrl,
        initials,
        uniqueProducts: row.unique_products,
        engagementScore: row.engagement_score,
        // Only include handle if privacy allows
        handle: hideNamePrivacy ? null : row.handle,
        // Keep raw fields for internal use
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
      };
    });

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

    // Store in cache
    await this.leaderboardCache.set(period, limit, leaderboardWithBadges);

    const duration = Date.now() - startTime;
    console.log(`⏱️ Leaderboard fetched in ${duration}ms (cache MISS, period: ${period}, limit: ${limit})`);

    return leaderboardWithBadges;
  }

  /**
   * Get user's leaderboard position
   * OPTIMIZED: Uses user_engagement_scores rollup table for 100x+ speedup
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {Object} User's position and stats
   */
  async getUserPosition(userId, period = 'all_time') {
    const startTime = Date.now();
    
    // Check cache first (use new LeaderboardCache method)
    const cached = await this.leaderboardCache.getUserPosition(userId, period);
    if (cached) {
      return cached;
    }
    
    // Select the appropriate score field based on period
    let scoreField;
    if (period === 'week') {
      scoreField = 'engagement_score_week';
    } else if (period === 'month') {
      scoreField = 'engagement_score_month';
    } else {
      scoreField = 'engagement_score';
    }

    // OPTIMIZED: Use pre-aggregated user_engagement_scores rollup table
    // This eliminates expensive aggregations on raw tables (6-8s → <100ms)
    const positionQuery = `
      WITH 
      user_score AS (
        SELECT 
          ues.user_id,
          ues.unique_products_count as unique_products,
          ues.${scoreField} as engagement_score
        FROM user_engagement_scores ues
        WHERE ues.user_id = ${userId}
      ),
      higher_scores AS (
        SELECT COUNT(*)::int as users_above
        FROM user_engagement_scores ues
        INNER JOIN users u ON u.id = ues.user_id
        WHERE u.active = true
          AND ues.${scoreField} > (SELECT engagement_score FROM user_score)
      ),
      total_active AS (
        SELECT COUNT(*)::int as total_users 
        FROM user_engagement_scores ues
        INNER JOIN users u ON u.id = ues.user_id
        WHERE u.active = true
          AND ues.${scoreField} > 0
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
    
    console.log(`⏱️ getUserPosition() rollup table query: ${queryExecutionTime}ms (total: ${totalTime}ms)`);
    
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
    
    // Cache the result (use new LeaderboardCache method)
    await this.leaderboardCache.setUserPosition(userId, period, result);
    
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
