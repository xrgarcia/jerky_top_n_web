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
   * @returns {Array} Achievements with progress
   */
  async getAchievementsWithProgress(userId, userStats) {
    const allAchievements = await this.achievementRepo.getAllAchievements();
    const userAchievements = await this.achievementRepo.getUserAchievements(userId);
    const earnedMap = new Map(userAchievements.map(a => [a.achievementId, a]));

    return allAchievements.map(achievement => {
      const earned = earnedMap.get(achievement.id);
      const progress = this.calculateProgress(achievement, userStats);

      return {
        ...achievement,
        earned: !!earned,
        earnedAt: earned?.earnedAt || null,
        progress,
      };
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
          INSERT INTO achievements (code, name, description, icon, tier, category, collection_type, requirement, points)
          VALUES (
            ${definition.code},
            ${definition.name},
            ${definition.description},
            ${definition.icon},
            ${definition.tier},
            ${definition.category},
            ${definition.collectionType || 'legacy'},
            ${requirementJson}::jsonb,
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
    const deletedAchievements = await this.achievementRepo.deleteAllAchievements();
    
    // Also clear all streaks
    const StreakRepository = require('../repositories/StreakRepository');
    const streakRepo = new StreakRepository(this.achievementRepo.db);
    const deletedStreaks = await streakRepo.deleteAllStreaks();
    
    // Log activity with admin user ID (required for activity_logs table)
    if (deletedAchievements > 0 || deletedStreaks > 0) {
      if (adminUserId) {
        await this.activityLogRepo.logActivity(
          adminUserId,
          'all_achievements_cleared',
          { 
            deletedAchievements,
            deletedStreaks 
          }
        );
      }
    }
    
    return {
      achievements: deletedAchievements,
      streaks: deletedStreaks,
      total: deletedAchievements + deletedStreaks
    };
  }
}

module.exports = AchievementManager;
