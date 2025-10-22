const { eq, and, desc, sql, sum } = require('drizzle-orm');
const { achievements, userAchievements } = require('../../shared/schema');
const AchievementCache = require('../cache/AchievementCache');

/**
 * AchievementRepository - Data access layer for achievements
 * Encapsulates all database operations for achievements
 */
class AchievementRepository {
  constructor(db) {
    this.db = db;
    this.achievementCache = AchievementCache.getInstance();
  }

  async getAllAchievements() {
    // Check cache first (Singleton pattern)
    const cached = this.achievementCache.get();
    if (cached) {
      return cached;
    }

    // Fetch from database and cache
    const definitions = await this.db.select().from(achievements);
    this.achievementCache.set(definitions);
    return definitions;
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
      currentTier: userAchievements.currentTier,
      percentageComplete: userAchievements.percentageComplete,
      pointsAwarded: userAchievements.pointsAwarded,
      code: achievements.code,
      name: achievements.name,
      description: achievements.description,
      icon: achievements.icon,
      iconType: achievements.iconType,
      tier: achievements.tier,
      category: achievements.category,
      points: achievements.points,
      collectionType: achievements.collectionType,
      tierThresholds: achievements.tierThresholds,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.earnedAt));
  }

  async awardAchievement(userId, achievementId, progress = null, pointsAwarded = null) {
    // If pointsAwarded not provided, fetch the achievement's base points
    let points = pointsAwarded;
    
    if (points === null) {
      const achievement = await this.db.select()
        .from(achievements)
        .where(eq(achievements.id, achievementId))
        .limit(1);
      
      points = achievement[0]?.points || 0;
    }
    
    const result = await this.db.insert(userAchievements)
      .values({
        userId,
        achievementId,
        progress,
        pointsAwarded: points,
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
    // Optimized: Use SQL aggregation for proportional point calculation
    // For tiered achievements, use pointsAwarded (proportional to completion)
    // For legacy achievements without pointsAwarded, fall back to achievements.points
    const result = await this.db.select({
      totalPoints: sql`COALESCE(SUM(
        CASE 
          WHEN ${userAchievements.pointsAwarded} > 0 THEN ${userAchievements.pointsAwarded}
          ELSE ${achievements.points}
        END
      ), 0)::int`
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId));
    
    return result[0]?.totalPoints || 0;
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
