const { eq, and } = require('drizzle-orm');
const { streaks } = require('../../shared/schema');

/**
 * StreakRepository - Data access layer for user streaks
 */
class StreakRepository {
  constructor(db) {
    this.db = db;
  }

  async getUserStreak(userId, streakType) {
    const result = await this.db.select()
      .from(streaks)
      .where(and(
        eq(streaks.userId, userId),
        eq(streaks.streakType, streakType)
      ))
      .limit(1);
    return result[0] || null;
  }

  async createStreak(userId, streakType, currentStreak = 0) {
    const result = await this.db.insert(streaks)
      .values({
        userId,
        streakType,
        currentStreak,
        longestStreak: currentStreak,
        lastActivityDate: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateStreak(userId, streakType, currentStreak, lastActivityDate) {
    const existing = await this.getUserStreak(userId, streakType);
    const longestStreak = Math.max(existing?.longestStreak || 0, currentStreak);

    const result = await this.db.update(streaks)
      .set({
        currentStreak,
        longestStreak,
        lastActivityDate,
        updatedAt: new Date(),
      })
      .where(and(
        eq(streaks.userId, userId),
        eq(streaks.streakType, streakType)
      ))
      .returning();
    
    return result[0];
  }

  async getAllUserStreaks(userId) {
    return await this.db.select()
      .from(streaks)
      .where(eq(streaks.userId, userId));
  }
}

module.exports = StreakRepository;
