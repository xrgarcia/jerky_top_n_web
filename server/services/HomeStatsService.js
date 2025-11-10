const { sql } = require('drizzle-orm');
const { formatAchievementPayload } = require('../utils/achievementIconFormatter');

/**
 * HomeStatsService - Aggregates statistics for home page dashboard
 */
class HomeStatsService {
  constructor(db, leaderboardManager, activityLogRepo, productViewRepo, communityService, homeStatsCache) {
    this.db = db;
    this.leaderboardManager = leaderboardManager;
    this.activityLogRepo = activityLogRepo;
    this.productViewRepo = productViewRepo;
    this.communityService = communityService;
    this.homeStatsCache = homeStatsCache;
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
        MAX(product_data::text)::jsonb as product_data,
        COUNT(*) as rank_count,
        AVG(ranking) as avg_rank,
        MIN(ranking) as best_rank,
        MAX(ranking) as worst_rank
      FROM product_rankings
      WHERE product_data IS NOT NULL
      GROUP BY shopify_product_id
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
          rankedAt: new Date(row.created_at).toISOString(),
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
        MAX(product_data::text)::jsonb as product_data,
        COUNT(*) as recent_rank_count,
        AVG(ranking) as avg_rank
      FROM product_rankings
      WHERE 
        product_data IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${sql.raw(days.toString())} days'
      GROUP BY shopify_product_id
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
        MAX(product_data::text)::jsonb as product_data,
        COUNT(*) as rank_count,
        AVG(ranking) as avg_rank,
        STDDEV(ranking) as rank_variance,
        MIN(ranking) as best_rank,
        MAX(ranking) as worst_rank
      FROM product_rankings
      WHERE product_data IS NOT NULL
      GROUP BY shopify_product_id
      HAVING COUNT(*) >= 2 AND STDDEV(ranking) > 0
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
        u.last_name,
        u.display_name
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      JOIN users u ON ua.user_id = u.id
      ORDER BY ua.earned_at DESC
      LIMIT ${limit}
    `);

    return results.rows.map(row => {
      const achievement = formatAchievementPayload({
        icon: row.achievement_icon,
        name: row.achievement_name,
        tier: row.achievement_tier
      });
      
      return {
        userId: row.user_id,
        userName: this.communityService.formatDisplayName(row),
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        achievementIconType: achievement.iconType, // Frontend expects this field name
        iconType: achievement.iconType, // Also keep this for consistency
        achievementTier: achievement.tier,
        earnedAt: new Date(row.earned_at).toISOString(),
      };
    });
  }

  /**
   * Get start of today in US Central time
   * @returns {Date} Start of today in Central time (as UTC Date object)
   */
  getStartOfTodayCentral() {
    const now = new Date();
    
    // Get today's date in Central timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year').value);
    const month = parseInt(parts.find(p => p.type === 'month').value);
    const day = parseInt(parts.find(p => p.type === 'day').value);
    
    // Find the UTC timestamp for midnight Central on this date
    // We test different UTC hours to find when Central time shows 00:00
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    // Start testing from a reasonable range (CST is UTC-6, CDT is UTC-5)
    // So midnight Central should be between 5-7 UTC
    for (let utcHour = 4; utcHour <= 7; utcHour++) {
      const testDate = new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0, 0));
      const testParts = timeFormatter.formatToParts(testDate);
      
      const testDay = parseInt(testParts.find(p => p.type === 'day').value);
      const testHour = parseInt(testParts.find(p => p.type === 'hour').value);
      const testMinute = parseInt(testParts.find(p => p.type === 'minute').value);
      
      // Found midnight Central (00:00) on the correct day
      if (testDay === day && testHour === 0 && testMinute === 0) {
        return testDate;
      }
    }
    
    // Fallback if not found in expected range (should not happen)
    // Default to CST offset (UTC-6)
    return new Date(Date.UTC(year, month - 1, day, 6, 0, 0, 0));
  }

  /**
   * Get community stats overview
   */
  async getCommunityStats() {
    const startOfTodayCentral = this.getStartOfTodayCentral();
    
    const [totalRankings, totalRankers, totalProducts, activeToday] = await Promise.all([
      // Total rankings
      this.db.execute(sql`SELECT COUNT(*) as count FROM product_rankings`),
      
      // Total unique rankers
      this.db.execute(sql`SELECT COUNT(DISTINCT user_id) as count FROM product_rankings`),
      
      // Total unique products ranked
      this.db.execute(sql`SELECT COUNT(DISTINCT shopify_product_id) as count FROM product_rankings`),
      
      // Active users today (based on page views OR rankings in US Central time)
      this.db.execute(sql`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM user_activities 
        WHERE user_id IS NOT NULL 
        AND activity_type IN ('page_view', 'ranking_saved')
        AND created_at >= ${startOfTodayCentral}
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
   * Get community activity stats (8 metrics showing live community pulse)
   * Each metric includes count + specific recent example
   */
  async getCommunityActivityStats() {
    const startOfTodayCentral = this.getStartOfTodayCentral();
    const startOfWeek = new Date(startOfTodayCentral);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [
      achievementsToday,
      productsRankedCount,
      productsRankedLatest,
      flavorsRankedWeekCount,
      flavorsRankedWeekLatest,
      collectionMilestones,
      flavorCommunities,
      newRankers,
      usersEarningPointsCount,
      usersEarningPointsLatest,
      hotProductsCount,
      hotProductsLatest,
    ] = await Promise.all([
      // 1. Achievements unlocked today
      this.db.execute(sql`
        SELECT 
          ua.user_id,
          ua.earned_at,
          a.name as achievement_name,
          a.icon as achievement_icon,
          a.tier as achievement_tier,
          u.first_name,
          u.last_name,
          u.display_name
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.id
        JOIN users u ON ua.user_id = u.id
        WHERE ua.earned_at >= ${startOfTodayCentral}
        ORDER BY ua.earned_at DESC
      `),

      // 2a. Products ranked this week (total count)
      this.db.execute(sql`
        SELECT COUNT(*) as count
        FROM product_rankings
        WHERE created_at >= ${startOfWeek}
      `),

      // 2b. Latest product ranked this week
      this.db.execute(sql`
        SELECT 
          pr.shopify_product_id,
          pr.product_data,
          pr.ranking,
          pr.created_at,
          u.first_name,
          u.last_name
        FROM product_rankings pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.created_at >= ${startOfWeek}
          AND pr.product_data IS NOT NULL
        ORDER BY pr.created_at DESC
        LIMIT 1
      `),

      // 3a. Unique flavors ranked this week (distinct count)
      this.db.execute(sql`
        SELECT COUNT(DISTINCT (product_data->>'primaryFlavor')) as count
        FROM product_rankings
        WHERE created_at >= ${startOfWeek}
          AND product_data IS NOT NULL
          AND (product_data->>'primaryFlavor') IS NOT NULL
      `),

      // 3b. Latest flavor ranked this week (exemplar)
      this.db.execute(sql`
        SELECT 
          pr.product_data->>'primaryFlavor' as flavor,
          pr.product_data,
          pr.ranking,
          pr.created_at as latest_at,
          u.first_name,
          u.last_name
        FROM product_rankings pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.created_at >= ${startOfWeek}
          AND pr.product_data IS NOT NULL
          AND (pr.product_data->>'primaryFlavor') IS NOT NULL
        ORDER BY pr.created_at DESC
        LIMIT 1
      `),

      // 4. Collection milestones hit today
      this.db.execute(sql`
        SELECT 
          ua.user_id,
          ua.earned_at,
          a.name as achievement_name,
          a.icon as achievement_icon,
          a.tier as achievement_tier,
          u.first_name,
          u.last_name,
          u.display_name
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.id
        JOIN users u ON ua.user_id = u.id
        WHERE ua.earned_at >= ${startOfTodayCentral}
          AND a.collection_type IN ('static_collection', 'dynamic_collection', 'flavor_coin')
        ORDER BY ua.earned_at DESC
      `),

      // 5. Active flavor communities today
      this.db.execute(sql`
        SELECT 
          fpc.flavor_profile,
          COUNT(DISTINCT fpc.user_id) as active_users,
          COUNT(*) as rankings_today
        FROM flavor_profile_communities fpc
        WHERE fpc.updated_at >= ${startOfTodayCentral}
        GROUP BY fpc.flavor_profile
        ORDER BY COUNT(*) DESC
      `),

      // 6. New rankers joined (users whose first ranking was today)
      this.db.execute(sql`
        WITH first_rankings AS (
          SELECT 
            user_id,
            MIN(created_at) as first_ranking_at
          FROM product_rankings
          GROUP BY user_id
        )
        SELECT 
          u.id as user_id,
          u.first_name,
          u.last_name,
          u.display_name,
          fr.first_ranking_at,
          pr.shopify_product_id,
          pr.product_data,
          pr.ranking
        FROM first_rankings fr
        JOIN users u ON fr.user_id = u.id
        JOIN product_rankings pr ON pr.user_id = fr.user_id AND pr.created_at = fr.first_ranking_at
        WHERE fr.first_ranking_at >= ${startOfTodayCentral}
        ORDER BY fr.first_ranking_at DESC
      `),

      // 7a. Users earning points today (count)
      this.db.execute(sql`
        SELECT COUNT(DISTINCT user_id) as count
        FROM user_activities
        WHERE created_at >= ${startOfTodayCentral}
          AND user_id IS NOT NULL
      `),

      // 7b. Latest user earning points today (exemplar)
      this.db.execute(sql`
        SELECT 
          ua.user_id,
          ua.created_at,
          u.first_name,
          u.last_name,
          u.display_name,
          ua.activity_type
        FROM user_activities ua
        JOIN users u ON ua.user_id = u.id
        WHERE ua.created_at >= ${startOfTodayCentral}
          AND ua.user_id IS NOT NULL
        ORDER BY ua.created_at DESC
        LIMIT 1
      `),

      // 8a. Hot products count (products ranked 3+ times today)
      this.db.execute(sql`
        SELECT COUNT(*) as count
        FROM (
          SELECT shopify_product_id
          FROM product_rankings
          WHERE created_at >= ${startOfTodayCentral}
            AND product_data IS NOT NULL
          GROUP BY shopify_product_id
          HAVING COUNT(*) >= 3
        ) hot_products
      `),

      // 8b. Hottest product (exemplar with actual latest ranking event)
      this.db.execute(sql`
        WITH hot_products AS (
          SELECT 
            shopify_product_id,
            COUNT(*) as ranking_count
          FROM product_rankings
          WHERE created_at >= ${startOfTodayCentral}
            AND product_data IS NOT NULL
          GROUP BY shopify_product_id
          HAVING COUNT(*) >= 3
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ),
        latest_ranking AS (
          SELECT 
            pr.shopify_product_id,
            pr.product_data,
            pr.ranking,
            pr.created_at AS latest_at,
            pr.user_id,
            u.first_name,
            u.last_name,
            hp.ranking_count
          FROM product_rankings pr
          JOIN hot_products hp ON pr.shopify_product_id = hp.shopify_product_id
          JOIN users u ON pr.user_id = u.id
          WHERE pr.created_at >= ${startOfTodayCentral}
          ORDER BY pr.created_at DESC
          LIMIT 1
        )
        SELECT * FROM latest_ranking
      `),
    ]);

    // Format achievements today
    const achievementsTodayData = achievementsToday.rows.map(row => {
      const achievement = formatAchievementPayload({
        icon: row.achievement_icon,
        name: row.achievement_name,
        tier: row.achievement_tier
      });
      return {
        userId: row.user_id,
        userName: this.communityService.formatDisplayName(row),
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        achievementIconType: achievement.iconType,
        earnedAt: new Date(row.earned_at).toISOString(),
      };
    });

    // Format collection milestones
    const collectionMilestonesData = collectionMilestones.rows.map(row => {
      const achievement = formatAchievementPayload({
        icon: row.achievement_icon,
        name: row.achievement_name,
        tier: row.achievement_tier
      });
      return {
        userId: row.user_id,
        userName: this.communityService.formatDisplayName(row),
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        achievementIconType: achievement.iconType,
        earnedAt: new Date(row.earned_at).toISOString(),
      };
    });

    return {
      achievementsToday: {
        count: achievementsTodayData.length,
        latest: achievementsTodayData[0] || null,
      },
      productsRanked: {
        count: parseInt(productsRankedCount.rows[0]?.count || 0),
        latest: productsRankedLatest.rows[0] ? {
          productData: productsRankedLatest.rows[0].product_data,
          ranking: parseInt(productsRankedLatest.rows[0].ranking),
          rankedBy: `${productsRankedLatest.rows[0].first_name} ${productsRankedLatest.rows[0].last_name?.charAt(0)}.`,
          rankedAt: new Date(productsRankedLatest.rows[0].created_at).toISOString(),
        } : null,
      },
      flavorsRankedWeek: {
        count: parseInt(flavorsRankedWeekCount.rows[0]?.count || 0),
        latest: flavorsRankedWeekLatest.rows[0] ? {
          flavor: flavorsRankedWeekLatest.rows[0].flavor,
          productData: flavorsRankedWeekLatest.rows[0].product_data,
          ranking: parseInt(flavorsRankedWeekLatest.rows[0].ranking),
          rankedBy: `${flavorsRankedWeekLatest.rows[0].first_name} ${flavorsRankedWeekLatest.rows[0].last_name?.charAt(0)}.`,
          rankedAt: new Date(flavorsRankedWeekLatest.rows[0].latest_at).toISOString(),
        } : null,
      },
      collectionMilestones: {
        count: collectionMilestonesData.length,
        latest: collectionMilestonesData[0] || null,
      },
      flavorCommunities: {
        count: flavorCommunities.rows.length,
        mostActive: flavorCommunities.rows[0] ? {
          flavorProfile: flavorCommunities.rows[0].flavor_profile,
          activeUsers: parseInt(flavorCommunities.rows[0].active_users),
          rankingsToday: parseInt(flavorCommunities.rows[0].rankings_today),
        } : null,
      },
      newRankers: {
        count: newRankers.rows.length,
        latest: newRankers.rows[0] ? {
          userId: newRankers.rows[0].user_id,
          userName: this.communityService.formatDisplayName(newRankers.rows[0]),
          productData: newRankers.rows[0].product_data,
          ranking: parseInt(newRankers.rows[0].ranking),
          joinedAt: new Date(newRankers.rows[0].first_ranking_at).toISOString(),
        } : null,
      },
      usersEarningPoints: {
        count: parseInt(usersEarningPointsCount.rows[0]?.count || 0),
        latest: usersEarningPointsLatest.rows[0] ? {
          userId: usersEarningPointsLatest.rows[0].user_id,
          userName: this.communityService.formatDisplayName(usersEarningPointsLatest.rows[0]),
          activityType: usersEarningPointsLatest.rows[0].activity_type,
          activityAt: new Date(usersEarningPointsLatest.rows[0].created_at).toISOString(),
        } : null,
      },
      hotProducts: {
        count: parseInt(hotProductsCount.rows[0]?.count || 0),
        latest: hotProductsLatest.rows[0] ? {
          productData: hotProductsLatest.rows[0].product_data,
          rankingCount: parseInt(hotProductsLatest.rows[0].ranking_count),
          rankedBy: `${hotProductsLatest.rows[0].first_name} ${hotProductsLatest.rows[0].last_name?.charAt(0)}.`,
          rankedAt: new Date(hotProductsLatest.rows[0].latest_at).toISOString(),
        } : null,
      },
    };
  }

  /**
   * Get all home page stats in one call
   * Uses cache to avoid expensive repeated queries
   */
  async getAllHomeStats() {
    // Check cache first
    const cached = this.homeStatsCache ? this.homeStatsCache.get() : null;
    if (cached) {
      return cached;
    }

    // Cache miss - fetch fresh data
    const startTime = Date.now();
    
    const [
      topRankers,
      topProducts,
      recentlyRanked,
      trending,
      debated,
      recentAchievements,
      communityStats,
      activityStats,
    ] = await Promise.all([
      this.getTopRankers(5),
      this.getTopProductsByAvgRank(5),
      this.getRecentlyRankedProducts(5),
      this.getTrendingProducts(5, 7),
      this.getMostDebatedProducts(5),
      this.getRecentAchievements(5),
      this.getCommunityStats(),
      this.getCommunityActivityStats(),
    ]);

    // LeaderboardManager now handles privacy-aware formatting (displayName, avatarUrl, initials)
    // No need to re-format here
    const stats = {
      topRankers: topRankers,
      topProducts,
      recentlyRanked,
      trending,
      debated,
      recentAchievements,
      communityStats,
      activityStats,
    };

    // Store in cache
    if (this.homeStatsCache) {
      this.homeStatsCache.set(stats);
    }

    const duration = Date.now() - startTime;
    console.log(`⏱️ Home stats fetched in ${duration}ms (cache MISS)`);

    return stats;
  }
  
  /**
   * Invalidate home stats cache
   * Called when rankings or achievements change
   */
  invalidateCache() {
    if (this.homeStatsCache) {
      this.homeStatsCache.invalidate();
    }
  }

  /**
   * Get hero dashboard statistics (lightweight version for hero section)
   * Returns: active rankers today, achievements this week, total rankings, recent achievements
   */
  async getHeroDashboardStats() {
    const startOfTodayCentral = this.getStartOfTodayCentral();
    
    // Calculate start of this week (7 days ago)
    const startOfWeek = new Date(startOfTodayCentral);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [activeToday, achievementsThisWeek, totalRankings, recentAchievements] = await Promise.all([
      // Active users today (users who have page views or rankings)
      this.db.execute(sql`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM user_activities 
        WHERE user_id IS NOT NULL 
        AND activity_type IN ('page_view', 'ranking_saved')
        AND created_at >= ${startOfTodayCentral}
      `),
      
      // Achievements earned this week
      this.db.execute(sql`
        SELECT COUNT(*) as count
        FROM user_achievements
        WHERE earned_at >= ${startOfWeek}
      `),
      
      // Total rankings all-time
      this.db.execute(sql`SELECT COUNT(*) as count FROM product_rankings`),
      
      // Recent achievements (last 10)
      this.getRecentAchievements(10),
    ]);

    return {
      activeRankersToday: parseInt(activeToday.rows[0].count),
      achievementsThisWeek: parseInt(achievementsThisWeek.rows[0].count),
      totalRankings: parseInt(totalRankings.rows[0].count),
      recentAchievements,
    };
  }
}

module.exports = HomeStatsService;
