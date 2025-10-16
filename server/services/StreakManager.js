/**
 * StreakManager - Domain service for managing user streaks
 */
class StreakManager {
  constructor(streakRepo, activityLogRepo) {
    this.streakRepo = streakRepo;
    this.activityLogRepo = activityLogRepo;
  }

  /**
   * Update user's streak based on activity
   * @param {number} userId - User ID
   * @param {string} streakType - Type of streak (e.g., 'daily_rank')
   * @returns {Object} Updated streak information
   */
  async updateStreak(userId, streakType) {
    // Defense in depth: Validate streak type at service layer
    const { VALID_STREAK_TYPES } = require('../../shared/constants');
    if (!VALID_STREAK_TYPES.includes(streakType)) {
      throw new Error(`Invalid streak type: ${streakType}`);
    }
    
    const streak = await this.streakRepo.getUserStreak(userId, streakType);
    const now = new Date();
    
    if (!streak) {
      const newStreak = await this.streakRepo.createStreak(userId, streakType, 1);
      
      await this.activityLogRepo.logActivity(
        userId,
        'streak_started',
        {
          streakType,
          currentStreak: 1,
        }
      );

      return {
        ...newStreak,
        continued: false,
        broken: false,
      };
    }

    const lastActivity = new Date(streak.lastActivityDate);
    const daysSinceLastActivity = this.getDaysDifference(lastActivity, now);

    if (daysSinceLastActivity === 0) {
      return {
        ...streak,
        continued: false,
        broken: false,
        message: 'Already counted today',
      };
    }

    if (daysSinceLastActivity === 1) {
      const newStreak = streak.currentStreak + 1;
      const updated = await this.streakRepo.updateStreak(userId, streakType, newStreak, now);
      
      if (newStreak % 7 === 0) {
        await this.activityLogRepo.logActivity(
          userId,
          'streak_milestone',
          {
            streakType,
            currentStreak: newStreak,
            milestone: `${newStreak} days`,
          }
        );
      }

      return {
        ...updated,
        continued: true,
        broken: false,
      };
    }

    const previousStreak = streak.currentStreak;
    const updated = await this.streakRepo.updateStreak(userId, streakType, 1, now);
    
    if (previousStreak >= 3) {
      await this.activityLogRepo.logActivity(
        userId,
        'streak_broken',
        {
          streakType,
          previousStreak,
        }
      );
    }

    return {
      ...updated,
      continued: false,
      broken: true,
      previousStreak,
    };
  }

  /**
   * Get days difference between two dates using calendar days (not 24-hour periods)
   * This properly handles timezone edge cases and ensures streaks work correctly
   */
  getDaysDifference(date1, date2) {
    // Normalize both dates to midnight UTC to compare calendar days
    const d1 = new Date(Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate()));
    const d2 = new Date(Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate()));
    
    // Calculate difference in milliseconds and convert to days
    const diffTime = Math.abs(d2 - d1);
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.floor(diffTime / oneDay);
  }

  /**
   * Get all streaks for a user
   */
  async getUserStreaks(userId) {
    return await this.streakRepo.getAllUserStreaks(userId);
  }
}

module.exports = StreakManager;
