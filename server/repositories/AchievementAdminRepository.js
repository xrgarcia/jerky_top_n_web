const { eq, and, desc, sql, isNull, or, inArray } = require('drizzle-orm');
const { achievements, userAchievements } = require('../../shared/schema');
const { COLLECTION_TYPES } = require('../../shared/constants/collectionTypes');
const animalCategoryService = require('../services/AnimalCategoryService');

/**
 * AchievementAdminRepository - Data access layer for admin achievement management
 * Handles CRUD operations for achievement definitions
 */
class AchievementAdminRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Validate protein categories array.
   * Now validates against actual animal display names from the database.
   */
  async validateProteinCategories(categories) {
    if (!categories) return null;
    
    if (!Array.isArray(categories)) {
      throw new Error('proteinCategories must be an array');
    }
    
    if (categories.length === 0) {
      return null; // Empty array treated as null
    }
    
    // Validate categories against actual animal display names in database
    const isValid = await animalCategoryService.validateAnimalDisplays(categories);
    if (!isValid) {
      const availableAnimals = await animalCategoryService.getAllUniqueAnimals();
      const validNames = availableAnimals.map(a => a.display).join(', ');
      throw new Error(`Invalid animal categories: ${categories.join(', ')}. Must be valid animal names from your product catalog. Available: ${validNames}`);
    }
    
    // Deduplicate
    return [...new Set(categories)];
  }

  /**
   * Normalize protein category fields (sync first element for backward compatibility)
   */
  async normalizeProteinCategoryFields(proteinCategories) {
    const normalized = await this.validateProteinCategories(proteinCategories);
    return {
      proteinCategories: normalized,
      proteinCategory: normalized && normalized.length > 0 ? normalized[0] : null
    };
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
        iconType: achievements.iconType,
        tier: achievements.tier,
        collectionType: achievements.collectionType,
        category: achievements.category,
        proteinCategory: achievements.proteinCategory,
        proteinCategories: achievements.proteinCategories,
        isHidden: achievements.isHidden,
        requirement: achievements.requirement,
        tierThresholds: achievements.tierThresholds,
        hasTiers: achievements.hasTiers,
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
    // Normalize protein categories and sync backward-compatible field
    const { proteinCategories, proteinCategory } = this.normalizeProteinCategoryFields(
      achievementData.proteinCategories
    );
    
    const result = await this.db
      .insert(achievements)
      .values({
        code: achievementData.code,
        name: achievementData.name,
        description: achievementData.description,
        icon: achievementData.icon,
        iconType: achievementData.iconType || 'emoji',
        tier: achievementData.tier || null,
        collectionType: achievementData.collectionType,
        category: achievementData.category || null,
        proteinCategory: proteinCategory,
        proteinCategories: proteinCategories,
        isHidden: achievementData.isHidden || 0,
        requirement: achievementData.requirement,
        tierThresholds: achievementData.tierThresholds || null,
        hasTiers: achievementData.hasTiers !== undefined ? achievementData.hasTiers : 0,
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
    // Normalize protein categories and sync backward-compatible field
    const { proteinCategories, proteinCategory } = this.normalizeProteinCategoryFields(
      achievementData.proteinCategories
    );
    
    const result = await this.db
      .update(achievements)
      .set({
        name: achievementData.name,
        description: achievementData.description,
        icon: achievementData.icon,
        iconType: achievementData.iconType || 'emoji',
        tier: achievementData.tier || null,
        collectionType: achievementData.collectionType,
        category: achievementData.category || null,
        proteinCategory: proteinCategory,
        proteinCategories: proteinCategories,
        isHidden: achievementData.isHidden || 0,
        requirement: achievementData.requirement,
        tierThresholds: achievementData.tierThresholds || null,
        hasTiers: achievementData.hasTiers !== undefined ? achievementData.hasTiers : 0,
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
   * Check if any other achievements use the same icon path
   */
  async countAchievementsUsingIcon(iconPath, excludeId = null) {
    let query = this.db
      .select({ count: sql`COUNT(*)::int` })
      .from(achievements)
      .where(eq(achievements.icon, iconPath));
    
    if (excludeId !== null) {
      query = query.where(sql`${achievements.id} != ${excludeId}`);
    }
    
    const result = await query;
    return result[0].count;
  }

  /**
   * Get achievement by ID
   */
  async getAchievementById(id) {
    const result = await this.db
      .select()
      .from(achievements)
      .where(eq(achievements.id, id))
      .limit(1);
    
    return result[0] || null;
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
      .where(eq(achievements.collectionType, COLLECTION_TYPES.DYNAMIC))
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
   * Get all engagement collection achievements
   * (Achievements based on user site engagement: searches, logins, ranking activity, streaks)
   */
  async getEngagementCollections() {
    return await this.db
      .select()
      .from(achievements)
      .where(eq(achievements.collectionType, COLLECTION_TYPES.ENGAGEMENT))
      .orderBy(achievements.name);
  }
  
  /**
   * Get all static collection achievements
   * (Pre-defined product lists: specific flavor collections, curated product sets)
   * Includes legacy "custom_product_list" records for backward compatibility
   */
  async getStaticCollections() {
    return await this.db
      .select()
      .from(achievements)
      .where(
        or(
          eq(achievements.collectionType, COLLECTION_TYPES.STATIC),
          eq(achievements.collectionType, 'custom_product_list') // Legacy support
        )
      )
      .orderBy(achievements.name);
  }
  
  /**
   * @deprecated Use getStaticCollections() instead
   * Kept for backward compatibility
   */
  async getCustomProductLists() {
    return this.getStaticCollections();
  }
}

module.exports = AchievementAdminRepository;
