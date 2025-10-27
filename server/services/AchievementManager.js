const achievementDefinitions = require('../data/achievementDefinitions');

/**
 * AchievementManager - Domain service for achievement evaluation and awarding
 * Implements Strategy pattern for extensible achievement rules
 */
class AchievementManager {
  constructor(achievementRepo, activityLogRepo) {
    this.achievementRepo = achievementRepo;
    this.activityLogRepo = activityLogRepo;
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
      search_count: (userStats, requirement) => {
        // Check if user has performed enough searches
        return userStats.totalSearches >= requirement.value;
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

        // Check if any achievements depend on this one
        const dependentAchievements = await this.unlockDependentAchievements(userId, achievement.id, userStats, earnedIds);
        newlyAwarded.push(...dependentAchievements);
        
        // Add newly unlocked achievements to earnedIds set
        dependentAchievements.forEach(dep => earnedIds.add(dep.id));
      }
    }

    return newlyAwarded;
  }

  /**
   * Check and unlock achievements that depend on this achievement as a prerequisite
   */
  async unlockDependentAchievements(userId, unlockedAchievementId, userStats, earnedIds) {
    const allAchievements = await this.achievementRepo.getAllAchievements();
    
    // Find achievements that have this as a prerequisite
    const dependentAchievements = allAchievements.filter(a => 
      a.prerequisiteAchievementId === unlockedAchievementId && 
      !earnedIds.has(a.id) &&
      a.isActive === 1
    );

    if (dependentAchievements.length === 0) {
      return [];
    }

    console.log(`🔓 Checking ${dependentAchievements.length} dependent achievement(s) for prerequisite ${unlockedAchievementId}`);

    const newlyAwarded = [];

    for (const dependent of dependentAchievements) {
      const evaluator = this.evaluators[dependent.requirement.type];
      if (!evaluator) {
        // This is a collection achievement, skip (handled by CollectionManager)
        continue;
      }

      if (evaluator(userStats, dependent.requirement)) {
        console.log(`🔓 Dependent achievement ${dependent.code} can now be awarded (prerequisite met)`);
        const awarded = await this.achievementRepo.awardAchievement(userId, dependent.id);
        
        await this.activityLogRepo.logActivity(
          userId,
          'earn_badge',
          {
            achievementCode: dependent.code,
            achievementName: dependent.name,
            achievementIcon: dependent.icon,
            achievementTier: dependent.tier,
          }
        );

        newlyAwarded.push({
          ...dependent,
          earnedAt: awarded.earnedAt,
        });

        // Recursively check for achievements that depend on this newly unlocked one
        const chainedAchievements = await this.unlockDependentAchievements(userId, dependent.id, userStats, earnedIds);
        newlyAwarded.push(...chainedAchievements);
        
        // Add to earnedIds to prevent re-checking
        earnedIds.add(dependent.id);
        chainedAchievements.forEach(dep => earnedIds.add(dep.id));
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
}

module.exports = AchievementManager;
