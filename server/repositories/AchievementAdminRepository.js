const { eq, and, desc, sql, isNull } = require('drizzle-orm');
const { achievements, userAchievements } = require('../../shared/schema');

/**
 * AchievementAdminRepository - Data access layer for admin achievement management
 * Handles CRUD operations for achievement definitions
 */
class AchievementAdminRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all achievements with metadata
   */
  async getAllAchievementsWithStats() {
    return await this.db
      .select({
        id: achievements.id,
        code: achievements.code,
        name: achievements.name,
        description: achievements.description,
        icon: achievements.icon,
        tier: achievements.tier,
        collectionType: achievements.collectionType,
        category: achievements.category,
        proteinCategory: achievements.proteinCategory,
        isHidden: achievements.isHidden,
        requirement: achievements.requirement,
        tierThresholds: achievements.tierThresholds,
        points: achievements.points,
        isActive: achievements.isActive,
        createdAt: achievements.createdAt,
        updatedAt: achievements.updatedAt,
      })
      .from(achievements)
      .orderBy(achievements.collectionType, achievements.name);
  }

  /**
   * Create a new achievement definition
   */
  async createAchievement(achievementData) {
    const result = await this.db
      .insert(achievements)
      .values({
        code: achievementData.code,
        name: achievementData.name,
        description: achievementData.description,
        icon: achievementData.icon,
        tier: achievementData.tier || null,
        collectionType: achievementData.collectionType,
        category: achievementData.category || null,
        proteinCategory: achievementData.proteinCategory || null,
        isHidden: achievementData.isHidden || 0,
        requirement: achievementData.requirement,
        tierThresholds: achievementData.tierThresholds || null,
        points: achievementData.points || 0,
        isActive: achievementData.isActive !== undefined ? achievementData.isActive : 1,
      })
      .returning();
    
    return result[0];
  }

  /**
   * Update an existing achievement
   */
  async updateAchievement(id, achievementData) {
    const result = await this.db
      .update(achievements)
      .set({
        name: achievementData.name,
        description: achievementData.description,
        icon: achievementData.icon,
        tier: achievementData.tier || null,
        collectionType: achievementData.collectionType,
        category: achievementData.category || null,
        proteinCategory: achievementData.proteinCategory || null,
        isHidden: achievementData.isHidden || 0,
        requirement: achievementData.requirement,
        tierThresholds: achievementData.tierThresholds || null,
        points: achievementData.points || 0,
        isActive: achievementData.isActive !== undefined ? achievementData.isActive : 1,
        updatedAt: sql`NOW()`,
      })
      .where(eq(achievements.id, id))
      .returning();
    
    return result[0];
  }

  /**
   * Toggle achievement active status
   */
  async toggleAchievementStatus(id) {
    const current = await this.db
      .select({ isActive: achievements.isActive })
      .from(achievements)
      .where(eq(achievements.id, id))
      .limit(1);
    
    if (!current[0]) {
      throw new Error('Achievement not found');
    }
    
    const newStatus = current[0].isActive === 1 ? 0 : 1;
    
    const result = await this.db
      .update(achievements)
      .set({ isActive: newStatus, updatedAt: sql`NOW()` })
      .where(eq(achievements.id, id))
      .returning();
    
    return result[0];
  }

  /**
   * Delete an achievement (soft delete via isActive)
   */
  async deleteAchievement(id) {
    // First check if anyone has earned this achievement
    const earners = await this.db
      .select({ count: sql`COUNT(*)::int` })
      .from(userAchievements)
      .where(eq(userAchievements.achievementId, id));
    
    if (earners[0].count > 0) {
      // Soft delete - deactivate instead of hard delete
      return await this.db
        .update(achievements)
        .set({ isActive: 0, updatedAt: sql`NOW()` })
        .where(eq(achievements.id, id))
        .returning();
    } else {
      // Hard delete if no one has earned it
      return await this.db
        .delete(achievements)
        .where(eq(achievements.id, id))
        .returning();
    }
  }

  /**
   * Get achievement by code
   */
  async getAchievementByCode(code) {
    const result = await this.db
      .select()
      .from(achievements)
      .where(eq(achievements.code, code))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get all dynamic collections grouped by protein category
   */
  async getDynamicCollections() {
    return await this.db
      .select()
      .from(achievements)
      .where(eq(achievements.collectionType, 'dynamic_collection'))
      .orderBy(achievements.proteinCategory, achievements.name);
  }

  /**
   * Get all hidden achievements
   */
  async getHiddenAchievements() {
    return await this.db
      .select()
      .from(achievements)
      .where(eq(achievements.isHidden, 1))
      .orderBy(achievements.name);
  }

  /**
   * Get all static collections
   */
  async getStaticCollections() {
    return await this.db
      .select()
      .from(achievements)
      .where(eq(achievements.collectionType, 'static_collection'))
      .orderBy(achievements.name);
  }
}

module.exports = AchievementAdminRepository;
