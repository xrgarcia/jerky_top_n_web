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
   * Get days difference between two dates
   */
  getDaysDifference(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const diffTime = Math.abs(date2 - date1);
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
