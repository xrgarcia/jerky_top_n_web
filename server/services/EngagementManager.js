const achievementDefinitions = require('../data/achievementDefinitions');

/**
 * EngagementManager - Domain service for engagement-based achievement evaluation and awarding
 * Handles user activity achievements (searches, page views, streaks, logins, etc.)
 * Mirrors CollectionManager pattern for product-based achievements
 * Implements Strategy pattern for extensible achievement rules
 */
class EngagementManager {
  constructor(achievementRepo, activityLogRepo, db) {
    this.achievementRepo = achievementRepo;
    this.activityLogRepo = activityLogRepo;
    this.db = db;
    
    this.DEFAULT_TIER_THRESHOLDS = {
      bronze: 40,
      silver: 60,
      gold: 75,
      platinum: 90,
      diamond: 100
    };
    this.evaluators = this.initializeEvaluators();
  }

  /**
   * Initialize achievement evaluators (Strategy pattern)
   */
  initializeEvaluators() {
    return {
      rank_count: (userStats, requirement) => {
        return userStats.totalRankings >= requirement.value;
      },
      streak_days: (userStats, requirement) => {
        return userStats.currentStreak >= requirement.value;
      },
      unique_brands: (userStats, requirement) => {
        return userStats.uniqueBrands >= requirement.value;
      },
      leaderboard_position: (userStats, requirement) => {
        return userStats.leaderboardPosition <= requirement.value && userStats.leaderboardPosition > 0;
      },
      profile_views: (userStats, requirement) => {
        return userStats.profileViews >= requirement.value;
      },
      join_before: (userStats, requirement) => {
        return new Date(userStats.joinDate) <= new Date(requirement.value);
      },
      trendsetter: (userStats, requirement) => {
        return userStats.trendingRanks >= requirement.value;
      },
      rank_all_products: (userStats, requirement) => {
        // Check if user has ranked all available products
        return userStats.totalRankableProducts && userStats.uniqueProducts >= userStats.totalRankableProducts;
      },
      complete_animal_category: (userStats, requirement) => {
        // Check if user has completed at least one animal category (with >2 products)
        return userStats.completedAnimalCategories && userStats.completedAnimalCategories.length >= requirement.value;
      },
      complete_protein_category_percentage: (userStats, requirement) => {
        // Dynamic collections are handled by CollectionManager, not here
        // This evaluator should never award the achievement
        return false;
      },
      static_collection: (userStats, requirement) => {
        // Static collections (product lists) are handled by CollectionManager, not here
        // This evaluator should never award the achievement
        return false;
      },
      custom_product_list: (userStats, requirement) => {
        // Legacy name for static collections, handled by CollectionManager
        // This evaluator should never award the achievement
        return false;
      },
      flavor_coin: (userStats, requirement) => {
        // Flavor coins (single product) are handled by CollectionManager, not here
        // This evaluator should never award the achievement
        return false;
      },
      complete_collection: (userStats, requirement) => {
        // Complete collection achievements are handled by CollectionManager, not here
        // This evaluator should never award the achievement
        return false;
      },
      search_count: (userStats, requirement) => {
        // Check if user has performed enough searches
        return userStats.totalSearches >= requirement.value;
      },
      product_view_count: (userStats, requirement) => {
        // Check if user has viewed enough products (total views)
        return userStats.totalProductViews >= requirement.value;
      },
      unique_product_view_count: (userStats, requirement) => {
        // Check if user has viewed enough unique products
        return userStats.uniqueProductViews >= requirement.value;
      },
      profile_view_count: (userStats, requirement) => {
        // Check if user has viewed enough profiles (total views)
        return userStats.totalProfileViews >= requirement.value;
      },
      unique_profile_view_count: (userStats, requirement) => {
        // Check if user has viewed enough unique profiles
        return userStats.uniqueProfileViews >= requirement.value;
      },
      page_view_count: (userStats, requirement) => {
        // Check if user has viewed enough pages (total page views)
        return userStats.totalPageViews >= requirement.value;
      },
      daily_login_streak: (userStats, requirement) => {
        // Check if user has maintained a daily login streak
        return userStats.currentLoginStreak >= requirement.value;
      },
      daily_rank_streak: (userStats, requirement) => {
        // Check if user has maintained a daily ranking streak
        return userStats.currentStreak >= requirement.value;
      },
    };
  }

  /**
   * Check and award achievements for a user based on their stats
   * @param {number} userId - User ID
   * @param {Object} userStats - User statistics object
   * @returns {Array} Newly awarded achievements
   */
  async checkAndAwardAchievements(userId, userStats) {
    const allAchievements = await this.achievementRepo.getAllAchievements();
    const userAchievements = await this.achievementRepo.getUserAchievements(userId);
    const earnedIds = new Set(userAchievements.map(a => a.achievementId));
    
    const newlyAwarded = [];

    for (const achievement of allAchievements) {
      if (earnedIds.has(achievement.id)) continue;

      // Check prerequisite: user must have earned the prerequisite achievement first
      if (achievement.prerequisiteAchievementId) {
        if (!earnedIds.has(achievement.prerequisiteAchievementId)) {
          // User hasn't earned the prerequisite yet, skip this achievement
          continue;
        }
      }

      const evaluator = this.evaluators[achievement.requirement.type];
      if (!evaluator) {
        console.warn(`No evaluator for requirement type: ${achievement.requirement.type}`);
        continue;
      }

      if (evaluator(userStats, achievement.requirement)) {
        const awarded = await this.achievementRepo.awardAchievement(userId, achievement.id);
        
        await this.activityLogRepo.logActivity(
          userId,
          'earn_badge',
          {
            achievementCode: achievement.code,
            achievementName: achievement.name,
            achievementIcon: achievement.icon,
            achievementTier: achievement.tier,
          }
        );

        newlyAwarded.push({
          ...achievement,
          earnedAt: awarded.earnedAt,
        });
      }
    }

    return newlyAwarded;
  }

  /**
   * Get all achievements with user's progress
   * @param {number} userId - User ID
   * @returns {Array} Achievements with progress (excludes hidden achievements not yet earned)
   */
  async getAchievementsWithProgress(userId, userStats) {
    const allAchievements = await this.achievementRepo.getAllAchievements();
    const userAchievements = await this.achievementRepo.getUserAchievements(userId);
    const earnedMap = new Map(userAchievements.map(a => [a.achievementId, a]));

    return allAchievements
      .map(achievement => {
        const earned = earnedMap.get(achievement.id);
        const progress = this.calculateProgress(achievement, userStats);

        return {
          ...achievement,
          earned: !!earned,
          earnedAt: earned?.earnedAt || null,
          progress,
          // Include tier information for dynamic collections
          currentTier: earned?.currentTier || null,
          percentageComplete: earned?.percentageComplete || 0,
          pointsAwarded: earned?.pointsAwarded || 0,
        };
      })
      .filter(achievement => {
        // An achievement is hidden if isHidden === 1 OR collectionType === 'hidden_collection'
        const isHidden = achievement.isHidden === 1 || achievement.collectionType === 'hidden_collection';
        
        // Show if: NOT hidden, OR earned
        return !isHidden || achievement.earned;
      });
  }

  /**
   * Calculate progress toward an achievement
   */
  calculateProgress(achievement, userStats) {
    const { type, value } = achievement.requirement;
    
    const progressMap = {
      rank_count: () => ({ current: userStats.totalRankings || 0, required: value }),
      streak_days: () => ({ current: userStats.currentStreak || 0, required: value }),
      unique_brands: () => ({ current: userStats.uniqueBrands || 0, required: value }),
      leaderboard_position: () => ({ current: userStats.leaderboardPosition || 999, required: value }),
      profile_views: () => ({ current: userStats.profileViews || 0, required: value }),
      rank_all_products: () => ({ 
        current: userStats.uniqueProducts || 0, 
        required: userStats.totalRankableProducts || 89 
      }),
      complete_animal_category: () => ({ 
        current: userStats.completedAnimalCategories?.length || 0, 
        required: value 
      }),
      search_count: () => ({ current: userStats.totalSearches || 0, required: value }),
      product_view_count: () => ({ current: userStats.totalProductViews || 0, required: value }),
      unique_product_view_count: () => ({ current: userStats.uniqueProductViews || 0, required: value }),
      profile_view_count: () => ({ current: userStats.totalProfileViews || 0, required: value }),
      unique_profile_view_count: () => ({ current: userStats.uniqueProfileViews || 0, required: value }),
    };

    const calculator = progressMap[type];
    return calculator ? calculator() : { current: 0, required: value };
  }

  /**
   * Seed achievement definitions into database
   * Uses upsert to ensure new achievements are added even if some exist
   */
  async seedAchievements() {
    const db = this.achievementRepo.db;
    const { sql } = require('drizzle-orm');
    
    let seededCount = 0;
    const errors = [];
    
    for (const definition of achievementDefinitions) {
      try {
        // Normalize JSON to ensure consistent representation
        const requirementJson = typeof definition.requirement === 'string' 
          ? definition.requirement 
          : JSON.stringify(definition.requirement);
        
        // Upsert: insert or update if code already exists
        await db.execute(sql`
          INSERT INTO achievements (code, name, description, icon, tier, category, collection_type, requirement, has_tiers, points)
          VALUES (
            ${definition.code},
            ${definition.name},
            ${definition.description},
            ${definition.icon},
            ${definition.tier},
            ${definition.category},
            ${definition.collectionType || 'legacy'},
            ${requirementJson}::jsonb,
            ${definition.hasTiers ? 1 : 0},
            ${definition.points}
          )
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            icon = EXCLUDED.icon,
            tier = EXCLUDED.tier,
            category = EXCLUDED.category,
            collection_type = EXCLUDED.collection_type,
            requirement = EXCLUDED.requirement,
            has_tiers = EXCLUDED.has_tiers,
            points = EXCLUDED.points
        `);
        seededCount++;
      } catch (error) {
        const errorMsg = `Failed to seed achievement ${definition.code}: ${error.message}`;
        console.error(`❌ ${errorMsg}`, error);
        errors.push({ code: definition.code, error: error.message });
      }
    }
    
    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} achievement(s) failed to seed:`, errors);
    }
    
    console.log(`✅ Seeded/updated ${seededCount}/${achievementDefinitions.length} achievements`);
    
    // Invalidate achievement cache to force fresh fetch on next request
    this.achievementRepo.achievementCache.invalidate();
    
    const allAchievements = await this.achievementRepo.getAllAchievements();
    return allAchievements;
  }

  /**
   * Clear all achievements for a specific user
   * @param {number} userId - User ID
   * @returns {number} Count of deleted achievements
   */
  async clearUserAchievements(userId) {
    const deletedCount = await this.achievementRepo.deleteUserAchievements(userId);
    
    if (deletedCount > 0) {
      await this.activityLogRepo.logActivity(
        userId,
        'achievements_cleared',
        { deletedCount }
      );
    }
    
    return deletedCount;
  }

  /**
   * Clear all achievements and streaks for all users (admin only)
   * @param {number} adminUserId - ID of the admin performing the action
   * @returns {Object} Count of deleted achievements and streaks
   */
  async clearAllAchievements(adminUserId) {
    const { sql } = require('drizzle-orm');
    const db = this.achievementRepo.db;
    
    const deletedAchievements = await this.achievementRepo.deleteAllAchievements();
    
    // Also clear all streaks
    const StreakRepository = require('../repositories/StreakRepository');
    const streakRepo = new StreakRepository(db);
    const deletedStreaks = await streakRepo.deleteAllStreaks();
    
    // Clear page views
    const pageViewsResult = await db.execute(sql`DELETE FROM page_views`);
    const deletedPageViews = pageViewsResult.rowCount || 0;
    
    // Clear user product searches
    const searchesResult = await db.execute(sql`DELETE FROM user_product_searches`);
    const deletedSearches = searchesResult.rowCount || 0;
    
    // Clear product rankings
    const rankingsResult = await db.execute(sql`DELETE FROM product_rankings`);
    const deletedRankings = rankingsResult.rowCount || 0;
    
    // Log activity with admin user ID (required for activity_logs table)
    if (deletedAchievements > 0 || deletedStreaks > 0 || deletedPageViews > 0 || deletedSearches > 0 || deletedRankings > 0) {
      if (adminUserId) {
        await this.activityLogRepo.logActivity(
          adminUserId,
          'all_data_cleared',
          { 
            deletedAchievements,
            deletedStreaks,
            deletedPageViews,
            deletedSearches,
            deletedRankings
          }
        );
      }
    }
    
    return {
      achievements: deletedAchievements,
      streaks: deletedStreaks,
      pageViews: deletedPageViews,
      searches: deletedSearches,
      rankings: deletedRankings,
      total: deletedAchievements + deletedStreaks + deletedPageViews + deletedSearches + deletedRankings
    };
  }

  /**
   * ENGAGEMENT CALCULATION METHODS (Following CollectionManager Pattern)
   */

  /**
   * Calculate search engagement metrics for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Search engagement data
   */
  async calculateSearchEngagement(userId) {
    const { sql } = require('drizzle-orm');
    const { userActivities } = require('../../shared/schema');
    const { eq, and } = require('drizzle-orm');

    const result = await this.db
      .select({ count: sql`count(*)::int` })
      .from(userActivities)
      .where(and(
        eq(userActivities.userId, userId),
        eq(userActivities.activityType, 'search')
      ));

    const totalSearches = result[0]?.count || 0;

    console.log(`🔍 [SEARCH ENGAGEMENT] User ${userId}: ${totalSearches} total searches`);

    return {
      totalSearches,
      metric: 'search_count',
      value: totalSearches
    };
  }

  /**
   * Calculate page view engagement metrics for a user
   * NOTE: This counts ALL page views (products, profiles, etc.)
   * For specific page types, use calculateProductViewEngagement or calculateProfileViewEngagement
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Page view engagement data
   */
  async calculatePageViewEngagement(userId) {
    const { sql } = require('drizzle-orm');
    const { userActivities } = require('../../shared/schema');
    const { eq, or, and } = require('drizzle-orm');

    // Count all page views (product_view + profile_view activities)
    const result = await this.db
      .select({ count: sql`count(*)::int` })
      .from(userActivities)
      .where(and(
        eq(userActivities.userId, userId),
        or(
          eq(userActivities.activityType, 'product_view'),
          eq(userActivities.activityType, 'profile_view')
        )
      ));

    const totalPageViews = result[0]?.count || 0;

    console.log(`📄 [PAGE VIEW ENGAGEMENT] User ${userId}: ${totalPageViews} total page views`);

    return {
      totalPageViews,
      metric: 'page_view_count',
      value: totalPageViews
    };
  }

  /**
   * Calculate ranking streak engagement metrics for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Ranking streak engagement data
   */
  async calculateStreakEngagement(userId) {
    const { streaks } = require('../../shared/schema');
    const { eq, and } = require('drizzle-orm');

    const result = await this.db
      .select()
      .from(streaks)
      .where(and(
        eq(streaks.userId, userId),
        eq(streaks.streakType, 'ranking')
      ))
      .limit(1);

    const currentStreak = result[0]?.currentStreak || 0;
    const longestStreak = result[0]?.longestStreak || 0;

    console.log(`🔥 [STREAK ENGAGEMENT] User ${userId}: Current streak ${currentStreak} days (longest: ${longestStreak})`);

    return {
      currentStreak,
      longestStreak,
      metric: 'streak_days',
      value: currentStreak
    };
  }

  /**
   * Calculate login streak engagement metrics for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Login streak engagement data
   */
  async calculateLoginEngagement(userId) {
    const { streaks } = require('../../shared/schema');
    const { eq, and } = require('drizzle-orm');

    const result = await this.db
      .select()
      .from(streaks)
      .where(and(
        eq(streaks.userId, userId),
        eq(streaks.streakType, 'login')
      ))
      .limit(1);

    const currentLoginStreak = result[0]?.currentStreak || 0;
    const longestLoginStreak = result[0]?.longestStreak || 0;

    console.log(`🔐 [LOGIN ENGAGEMENT] User ${userId}: Current login streak ${currentLoginStreak} days (longest: ${longestLoginStreak})`);

    return {
      currentLoginStreak,
      longestLoginStreak,
      metric: 'daily_login_streak',
      value: currentLoginStreak
    };
  }

  /**
   * Calculate product view engagement metrics for a user
   * @param {number} userId - User ID
   * @param {boolean} unique - If true, count unique products; if false, count total views
   * @returns {Promise<Object>} Product view engagement data
   */
  async calculateProductViewEngagement(userId, unique = false) {
    const { sql } = require('drizzle-orm');
    const { userActivities } = require('../../shared/schema');
    const { eq, and } = require('drizzle-orm');

    let result;
    if (unique) {
      // Count distinct products viewed (stored in activity_data JSON as shopifyProductId)
      result = await this.db
        .select({ count: sql`count(distinct (activity_data->>'shopifyProductId')::text)::int` })
        .from(userActivities)
        .where(and(
          eq(userActivities.userId, userId),
          eq(userActivities.activityType, 'product_view')
        ));
    } else {
      // Count total product views
      result = await this.db
        .select({ count: sql`count(*)::int` })
        .from(userActivities)
        .where(and(
          eq(userActivities.userId, userId),
          eq(userActivities.activityType, 'product_view')
        ));
    }

    const productViews = result[0]?.count || 0;

    console.log(`📦 [PRODUCT VIEW ENGAGEMENT] User ${userId}: ${productViews} ${unique ? 'unique' : 'total'} product views`);

    return {
      totalProductViews: unique ? 0 : productViews,
      uniqueProductViews: unique ? productViews : 0,
      metric: unique ? 'unique_product_view_count' : 'product_view_count',
      value: productViews
    };
  }

  /**
   * Calculate profile view engagement metrics for a user
   * @param {number} userId - User ID
   * @param {boolean} unique - If true, count unique profiles; if false, count total views
   * @returns {Promise<Object>} Profile view engagement data
   */
  async calculateProfileViewEngagement(userId, unique = false) {
    const { sql } = require('drizzle-orm');
    const { userActivities } = require('../../shared/schema');
    const { eq, and } = require('drizzle-orm');

    let result;
    if (unique) {
      // Count distinct profile views (stored in activity_data JSON as profileUserId)
      result = await this.db
        .select({ count: sql`count(distinct (activity_data->>'profileUserId')::int)::int` })
        .from(userActivities)
        .where(and(
          eq(userActivities.userId, userId),
          eq(userActivities.activityType, 'profile_view')
        ));
    } else {
      // Count total profile views
      result = await this.db
        .select({ count: sql`count(*)::int` })
        .from(userActivities)
        .where(and(
          eq(userActivities.userId, userId),
          eq(userActivities.activityType, 'profile_view')
        ));
    }

    const profileViews = result[0]?.count || 0;

    console.log(`👤 [PROFILE VIEW ENGAGEMENT] User ${userId}: ${profileViews} ${unique ? 'unique' : 'total'} profile views`);

    return {
      totalProfileViews: unique ? 0 : profileViews,
      uniqueProfileViews: unique ? profileViews : 0,
      metric: unique ? 'unique_profile_view_count' : 'profile_view_count',
      value: profileViews
    };
  }

  /**
   * Check and update engagement-based achievements for a user
   * Mirrors CollectionManager.checkAndUpdateDynamicCollections() pattern
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of achievement updates (new achievements or tier upgrades)
   */
  async checkAndUpdateEngagementAchievements(userId) {
    const { eq, and, inArray } = require('drizzle-orm');
    const { achievements, userAchievements } = require('../../shared/schema');

    // Get all engagement-type achievements
    const engagementAchievements = await this.db.select()
      .from(achievements)
      .where(and(
        eq(achievements.collectionType, 'engagement_collection'),
        eq(achievements.isActive, 1)
      ));

    console.log(`🎯 [ENGAGEMENT CHECK] User ${userId}: Checking ${engagementAchievements.length} engagement achievements`);

    // Determine which metrics need to be calculated based on achievement requirements
    const requiredMetrics = new Set();
    const uniqueProductViews = engagementAchievements.some(a => a.requirement.type === 'unique_product_view_count');
    const totalProductViews = engagementAchievements.some(a => a.requirement.type === 'product_view_count');
    const uniqueProfileViews = engagementAchievements.some(a => a.requirement.type === 'unique_profile_view_count');
    const totalProfileViews = engagementAchievements.some(a => a.requirement.type === 'profile_view_count');

    for (const achievement of engagementAchievements) {
      requiredMetrics.add(achievement.requirement.type);
    }

    // Build array of calculations to run in parallel
    const calculations = [
      this.calculateSearchEngagement(userId),
      this.calculatePageViewEngagement(userId),
      this.calculateStreakEngagement(userId),
      this.calculateLoginEngagement(userId)
    ];

    // Add product view calculations if needed
    if (uniqueProductViews) {
      calculations.push(this.calculateProductViewEngagement(userId, true));
    }
    if (totalProductViews) {
      calculations.push(this.calculateProductViewEngagement(userId, false));
    }

    // Add profile view calculations if needed
    if (uniqueProfileViews) {
      calculations.push(this.calculateProfileViewEngagement(userId, true));
    }
    if (totalProfileViews) {
      calculations.push(this.calculateProfileViewEngagement(userId, false));
    }

    // Calculate all engagement metrics upfront in parallel
    const results = await Promise.all(calculations);

    // Extract results (first 4 are always the same)
    const [searchData, pageViewData, streakData, loginData, ...additionalData] = results;

    // Build user stats object (compatible with existing evaluator functions)
    const userStats = {
      totalSearches: searchData.totalSearches,
      totalPageViews: pageViewData.totalPageViews,
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      currentLoginStreak: loginData.currentLoginStreak,
      longestLoginStreak: loginData.longestLoginStreak
    };

    // Add product and profile view stats from additional calculations
    for (const data of additionalData) {
      if (data.uniqueProductViews !== undefined && data.uniqueProductViews > 0) {
        userStats.uniqueProductViews = data.uniqueProductViews;
      }
      if (data.totalProductViews !== undefined && data.totalProductViews > 0) {
        userStats.totalProductViews = data.totalProductViews;
      }
      if (data.uniqueProfileViews !== undefined && data.uniqueProfileViews > 0) {
        userStats.uniqueProfileViews = data.uniqueProfileViews;
      }
      if (data.totalProfileViews !== undefined && data.totalProfileViews > 0) {
        userStats.totalProfileViews = data.totalProfileViews;
      }
    }

    const updates = [];

    // Check each engagement achievement
    for (const achievement of engagementAchievements) {
      const update = await this.checkAndAwardEngagementAchievement(userId, achievement, userStats);
      if (update) {
        // Handle both single updates and arrays of updates (multi-tier awards)
        if (Array.isArray(update)) {
          updates.push(...update);
        } else {
          updates.push(update);
        }
      }
    }

    console.log(`✅ [ENGAGEMENT CHECK] User ${userId}: ${updates.length} achievement update(s)`);

    return updates;
  }

  /**
   * Get tier from percentage - mirrors CollectionManager
   * @param {number} percentage - Completion percentage
   * @param {Object} customThresholds - Optional custom tier thresholds
   * @returns {string|null} Tier name or null
   */
  getTierFromPercentage(percentage, customThresholds = null) {
    const thresholds = customThresholds || this.DEFAULT_TIER_THRESHOLDS;
    
    if (percentage >= thresholds.diamond) return 'diamond';
    if (percentage >= thresholds.platinum) return 'platinum';
    if (percentage >= thresholds.gold) return 'gold';
    if (percentage >= thresholds.silver) return 'silver';
    if (percentage >= thresholds.bronze) return 'bronze';
    return null;
  }

  /**
   * Get all intermediate tiers up to final tier - mirrors CollectionManager
   * @param {string} finalTier - The final tier achieved
   * @param {Object} tierThresholds - Tier threshold configuration
   * @returns {Array<string>} Array of tier names
   */
  getIntermediateTiers(finalTier, tierThresholds) {
    if (!finalTier || !tierThresholds) {
      return [finalTier].filter(Boolean);
    }

    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const finalTierIndex = tierOrder.indexOf(finalTier);
    
    if (finalTierIndex === -1) {
      return [finalTier];
    }

    return tierOrder.slice(0, finalTierIndex + 1);
  }

  /**
   * Calculate proportional points based on tier percentage - mirrors CollectionManager
   * @param {number} percentage - Current completion percentage
   * @param {number} maxPoints - Maximum points for 100% completion
   * @param {Object} tierThresholds - Tier threshold configuration
   * @returns {number} Proportional points for current tier
   */
  calculateProportionalPoints(percentage, maxPoints, tierThresholds = null) {
    const thresholds = tierThresholds || this.DEFAULT_TIER_THRESHOLDS;
    
    if (percentage >= thresholds.diamond) {
      return maxPoints;
    }
    
    return Math.round((percentage / 100) * maxPoints);
  }

  /**
   * Check and award a single engagement achievement with tier support
   * Returns update notification(s) in same format as CollectionManager
   * @param {number} userId - User ID
   * @param {Object} achievement - Achievement definition
   * @param {Object} userStats - Pre-calculated user stats
   * @returns {Promise<Object|Array|null>} Update notification(s) or null
   */
  async checkAndAwardEngagementAchievement(userId, achievement, userStats) {
    const { eq, and } = require('drizzle-orm');
    const { userAchievements } = require('../../shared/schema');

    // Calculate current value and percentage
    const currentValue = userStats[this.getStatKey(achievement.requirement.type)] || 0;
    const requiredValue = achievement.requirement.value || achievement.requirement.days || 1;
    const percentage = Math.min(Math.round((currentValue / requiredValue) * 100), 100);

    // Determine tier from percentage
    let tier;
    if (achievement.hasTiers) {
      tier = this.getTierFromPercentage(percentage, achievement.tierThresholds);
    } else {
      // Non-tiered: either complete (100%) or null
      tier = percentage === 100 ? 'complete' : null;
    }

    console.log(`🔄 [${achievement.code}] User ${userId}: ${currentValue}/${requiredValue} (${percentage}%) → TIER: ${tier} (hasTiers: ${achievement.hasTiers})`);

    if (!tier) {
      return null;
    }

    // Check if user already has this achievement
    const existing = await this.db.select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievement.id)
      ))
      .limit(1);

    const progressData = {
      metric: achievement.requirement.type,
      value: currentValue,
      required: requiredValue
    };

    const pointsAwarded = this.calculateProportionalPoints(
      percentage,
      achievement.points || 0,
      achievement.tierThresholds
    );

    if (existing.length === 0) {
      // Check prerequisite before awarding
      if (achievement.prerequisiteAchievementId) {
        const prerequisiteEarned = await this.db.select()
          .from(userAchievements)
          .where(and(
            eq(userAchievements.userId, userId),
            eq(userAchievements.achievementId, achievement.prerequisiteAchievementId)
          ))
          .limit(1);
        
        if (prerequisiteEarned.length === 0) {
          console.log(`⚠️ [${achievement.code}] Prerequisite not earned yet, skipping`);
          return null;
        }
      }

      // For tiered achievements, award all intermediate tiers
      const tiersToAward = achievement.hasTiers ? 
        this.getIntermediateTiers(tier, achievement.tierThresholds) : 
        [tier];
      
      console.log(`🎯 [${achievement.code}] Awarding ${tiersToAward.length} tier(s): ${tiersToAward.join(' → ')}`);
      
      const notifications = [];
      let currentRecord = null;
      
      for (let i = 0; i < tiersToAward.length; i++) {
        const currentTier = tiersToAward[i];
        const thresholds = achievement.tierThresholds || this.DEFAULT_TIER_THRESHOLDS;
        
        let tierPercentage, tierPoints;
        if (!achievement.hasTiers || currentTier === 'complete') {
          tierPercentage = percentage;
          tierPoints = achievement.points || 0;
        } else {
          tierPercentage = thresholds[currentTier];
          tierPoints = this.calculateProportionalPoints(tierPercentage, achievement.points || 0, thresholds);
        }
        
        if (i === 0) {
          // First tier: insert
          const result = await this.db.insert(userAchievements)
            .values({
              userId,
              achievementId: achievement.id,
              currentTier,
              percentageComplete: tierPercentage,
              pointsAwarded: tierPoints,
              progress: progressData
            })
            .returning();
          
          currentRecord = result[0];
        } else {
          // Subsequent tiers: update
          const result = await this.db.update(userAchievements)
            .set({
              currentTier,
              percentageComplete: tierPercentage,
              pointsAwarded: tierPoints,
              progress: progressData
            })
            .where(eq(userAchievements.id, currentRecord.id))
            .returning();
          
          currentRecord = result[0];
        }
        
        // Log activity for each tier
        await this.activityLogRepo.logActivity(
          userId,
          i === 0 ? 'earn_badge' : 'tier_upgrade',
          {
            achievementCode: achievement.code,
            achievementName: achievement.name,
            achievementIcon: achievement.icon,
            achievementTier: currentTier
          }
        );
        
        notifications.push({
          type: i === 0 ? 'new' : 'tier_upgrade',
          achievement,
          tier: currentTier,
          percentage: tierPercentage,
          pointsAwarded: tierPoints,
          userAchievement: currentRecord
        });
        
        console.log(`🎉 [${achievement.code}] ${i === 0 ? 'New achievement' : 'Tier upgrade'}: ${currentTier} - ${tierPoints} points`);
      }
      
      return tiersToAward.length > 1 ? notifications : notifications[0];
    }

    // Achievement exists - check for tier upgrade
    const existingRecord = existing[0];
    
    if (existingRecord.currentTier !== tier) {
      // Tier upgrade
      const result = await this.db.update(userAchievements)
        .set({
          currentTier: tier,
          percentageComplete: percentage,
          pointsAwarded,
          progress: progressData
        })
        .where(eq(userAchievements.id, existingRecord.id))
        .returning();
      
      const updatedRecord = result[0];
      
      await this.activityLogRepo.logActivity(
        userId,
        'tier_upgrade',
        {
          achievementCode: achievement.code,
          achievementName: achievement.name,
          achievementIcon: achievement.icon,
          achievementTier: tier
        }
      );
      
      console.log(`⬆️ [${achievement.code}] Tier upgrade: ${existingRecord.currentTier} → ${tier} - ${pointsAwarded} points`);
      
      return {
        type: 'tier_upgrade',
        achievement,
        tier,
        percentage,
        pointsAwarded,
        userAchievement: updatedRecord
      };
    }
    
    // Tier unchanged - update percentage only if changed
    if (existingRecord.percentageComplete !== percentage) {
      await this.db.update(userAchievements)
        .set({
          percentageComplete: percentage,
          progress: progressData
        })
        .where(eq(userAchievements.id, existingRecord.id));
      
      console.log(`📊 [${achievement.code}] Progress updated: ${percentage}% (tier unchanged: ${tier})`);
    }
    
    return null;
  }

  /**
   * Helper method to map requirement types to userStats keys
   * @param {string} requirementType - The requirement type
   * @returns {string} The corresponding userStats key
   */
  getStatKey(requirementType) {
    const mapping = {
      'search_count': 'totalSearches',
      'page_view_count': 'totalPageViews',
      'streak_days': 'currentStreak',
      'daily_login_streak': 'currentLoginStreak',
      'product_view_count': 'totalProductViews',
      'unique_product_view_count': 'uniqueProductViews',
      'profile_view_count': 'totalProfileViews',
      'unique_profile_view_count': 'uniqueProfileViews'
    };
    return mapping[requirementType] || requirementType;
  }
}

module.exports = EngagementManager;
