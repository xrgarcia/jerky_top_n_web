const { eq, and, sql, desc } = require('drizzle-orm');
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
    try {
      // Use DISTINCT ON to get only the most recent streak per type
      // Add LIMIT 10 as safety measure against corrupted data
      // Filter for known streak types only (daily_rank is the primary type)
      const result = await this.db.execute(sql`
        SELECT DISTINCT ON (streak_type)
          id,
          user_id AS "userId",
          streak_type AS "streakType",
          current_streak AS "currentStreak",
          longest_streak AS "longestStreak",
          last_activity_date AS "lastActivityDate",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM streaks
        WHERE user_id = ${userId}
          AND streak_type IN ('daily_rank', 'daily_login')
        ORDER BY streak_type, updated_at DESC
        LIMIT 10
      `);
      
      console.log(`🔍 getAllUserStreaks: Found ${result.rows?.length || 0} valid streak(s) for user ${userId}`);
      return result.rows || [];
    } catch (error) {
      console.error('❌ StreakRepository.getAllUserStreaks error:', error);
      console.error('User ID:', userId);
      console.error('Error details:', error.message, error.stack);
      throw error;
    }
  }
}

module.exports = StreakRepository;
