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
    };

    const calculator = progressMap[type];
    return calculator ? calculator() : { current: 0, required: value };
  }

  /**
   * Seed achievement definitions into database
   */
  async seedAchievements() {
    const existing = await this.achievementRepo.getAllAchievements();
    if (existing.length > 0) {
      console.log('Achievements already seeded');
      return existing;
    }

    const db = this.achievementRepo.db;
    const { achievements } = require('../../shared/schema');
    
    const seeded = await db.insert(achievements)
      .values(achievementDefinitions)
      .returning();
    
    console.log(`Seeded ${seeded.length} achievements`);
    return seeded;
  }
}

module.exports = AchievementManager;
