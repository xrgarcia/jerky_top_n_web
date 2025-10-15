const { eq, and, desc } = require('drizzle-orm');
const { achievements, userAchievements } = require('../../shared/schema');

/**
 * AchievementRepository - Data access layer for achievements
 * Encapsulates all database operations for achievements
 */
class AchievementRepository {
  constructor(db) {
    this.db = db;
  }

  async getAllAchievements() {
    return await this.db.select().from(achievements);
  }

  async getAchievementByCode(code) {
    const result = await this.db.select()
      .from(achievements)
      .where(eq(achievements.code, code))
      .limit(1);
    return result[0] || null;
  }

  async getUserAchievements(userId) {
    return await this.db.select({
      id: userAchievements.id,
      achievementId: userAchievements.achievementId,
      earnedAt: userAchievements.earnedAt,
      progress: userAchievements.progress,
      code: achievements.code,
      name: achievements.name,
      description: achievements.description,
      icon: achievements.icon,
      tier: achievements.tier,
      category: achievements.category,
      points: achievements.points,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.earnedAt));
  }

  async awardAchievement(userId, achievementId, progress = null) {
    const result = await this.db.insert(userAchievements)
      .values({
        userId,
        achievementId,
        progress,
      })
      .returning();
    return result[0];
  }

  async hasAchievement(userId, achievementId) {
    const result = await this.db.select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      ))
      .limit(1);
    return result.length > 0;
  }

  async updateProgress(userId, achievementId, progress) {
    return await this.db.update(userAchievements)
      .set({ progress })
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      ))
      .returning();
  }

  async getUserTotalPoints(userId) {
    const userAchs = await this.getUserAchievements(userId);
    return userAchs.reduce((total, ach) => total + (ach.points || 0), 0);
  }

  async getAchievementEarningCount(achievementId) {
    const { count } = require('drizzle-orm');
    const result = await this.db.select({ count: count() })
      .from(userAchievements)
      .where(eq(userAchievements.achievementId, achievementId));
    return result[0]?.count || 0;
  }

  async deleteUserAchievements(userId) {
    const result = await this.db.delete(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .returning();
    return result.length;
  }

  async deleteAllAchievements() {
    const result = await this.db.delete(userAchievements)
      .returning();
    return result.length;
  }
}

module.exports = AchievementRepository;
