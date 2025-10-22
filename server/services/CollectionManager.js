const { eq, and } = require('drizzle-orm');
const { achievements, userAchievements } = require('../../shared/schema');

class CollectionManager {
  constructor(achievementRepo, productsMetadataRepo, db) {
    this.achievementRepo = achievementRepo;
    this.productsMetadataRepo = productsMetadataRepo;
    this.db = db;
    
    this.DEFAULT_TIER_THRESHOLDS = {
      bronze: 40,
      silver: 60,
      gold: 75,
      platinum: 90,
      diamond: 100
    };
  }

  async checkAndUpdateDynamicCollections(userId) {
    const dynamicCollections = await this.db.select()
      .from(achievements)
      .where(and(
        eq(achievements.collectionType, 'dynamic_collection'),
        eq(achievements.isActive, 1)
      ));

    const updates = [];

    for (const collection of dynamicCollections) {
      const progress = await this.calculateCollectionProgress(userId, collection);
      const update = await this.updateCollectionProgress(userId, collection, progress);
      if (update) {
        updates.push(update);
      }
    }

    return updates;
  }

  async calculateCollectionProgress(userId, collection) {
    const { proteinCategory, proteinCategories, requirement } = collection;
    
    // Support both multi-category (proteinCategories) and legacy single category (proteinCategory)
    const categories = proteinCategories && Array.isArray(proteinCategories) && proteinCategories.length > 0
      ? proteinCategories
      : (proteinCategory ? [proteinCategory] : []);
    
    if (categories.length === 0) {
      console.warn(`Collection ${collection.code} has no protein categories`);
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }

    // Fetch products from all categories and deduplicate
    const allProducts = new Set();
    for (const category of categories) {
      const products = await this.productsMetadataRepo.getProductsByAnimalType(category);
      products.forEach(p => allProducts.add(p.shopifyProductId));
    }
    
    const totalAvailable = allProducts.size;

    if (totalAvailable === 0) {
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }

    const { productRankings, productsMetadata } = require('../../shared/schema');
    const { sql, inArray } = require('drizzle-orm');
    
    // Get user's ranked products that match ANY of the categories
    const rankedProducts = await this.db
      .select({ shopifyProductId: productRankings.shopifyProductId })
      .from(productRankings)
      .innerJoin(
        productsMetadata,
        eq(productRankings.shopifyProductId, productsMetadata.shopifyProductId)
      )
      .where(and(
        eq(productRankings.userId, userId),
        inArray(productsMetadata.animalType, categories)
      ))
      .groupBy(productRankings.shopifyProductId);

    const totalRanked = rankedProducts.length;
    const percentage = Math.round((totalRanked / totalAvailable) * 100);

    return {
      percentage,
      totalAvailable,
      totalRanked,
      tier: this.getTierFromPercentage(percentage, collection.tierThresholds),
      categories // Include for debugging
    };
  }

  getTierFromPercentage(percentage, customThresholds = null) {
    const thresholds = customThresholds || this.DEFAULT_TIER_THRESHOLDS;
    
    if (percentage >= thresholds.diamond) return 'diamond';
    if (percentage >= thresholds.platinum) return 'platinum';
    if (percentage >= thresholds.gold) return 'gold';
    if (percentage >= thresholds.silver) return 'silver';
    if (percentage >= thresholds.bronze) return 'bronze';
    return null;
  }

  calculateProportionalPoints(percentage, maxPoints, tierThresholds) {
    if (!tierThresholds) {
      return maxPoints;
    }

    const thresholds = tierThresholds || this.DEFAULT_TIER_THRESHOLDS;
    
    return Math.round((percentage / 100) * maxPoints);
  }

  async updateCollectionProgress(userId, collection, progress) {
    const { percentage, tier, totalAvailable, totalRanked } = progress;

    if (!tier) {
      return null;
    }

    const existing = await this.db.select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, collection.id)
      ))
      .limit(1);

    const progressData = {
      totalAvailable,
      totalRanked,
      percentage
    };

    const pointsAwarded = this.calculateProportionalPoints(
      percentage,
      collection.points || 0,
      collection.tierThresholds
    );

    if (existing.length === 0) {
      const result = await this.db.insert(userAchievements)
        .values({
          userId,
          achievementId: collection.id,
          currentTier: tier,
          percentageComplete: percentage,
          pointsAwarded,
          progress: progressData,
        })
        .returning();
      
      console.log(`🎉 New collection earned: ${collection.name} (${tier}) - ${pointsAwarded} points`);
      
      return {
        type: 'new',
        achievement: collection,
        tier,
        percentage,
        pointsAwarded,
        userAchievement: result[0]
      };
    } else {
      const current = existing[0];
      
      if (current.currentTier !== tier || current.percentageComplete !== percentage) {
        const previousPoints = current.pointsAwarded || 0;
        const pointsGained = pointsAwarded - previousPoints;
        
        await this.db.update(userAchievements)
          .set({
            currentTier: tier,
            percentageComplete: percentage,
            pointsAwarded,
            progress: progressData,
            updatedAt: new Date(),
          })
          .where(eq(userAchievements.id, current.id));

        console.log(`⬆️ Tier upgrade: ${collection.name} (${current.currentTier} → ${tier}) - +${pointsGained} points (total: ${pointsAwarded})`);

        return {
          type: 'tier_upgrade',
          achievement: collection,
          previousTier: current.currentTier,
          newTier: tier,
          percentage,
          pointsAwarded,
          pointsGained,
          userAchievement: current
        };
      }
    }

    return null;
  }

  async getUserCollections(userId) {
    const collections = await this.db.select({
      id: userAchievements.id,
      achievementId: userAchievements.achievementId,
      currentTier: userAchievements.currentTier,
      percentageComplete: userAchievements.percentageComplete,
      progress: userAchievements.progress,
      earnedAt: userAchievements.earnedAt,
      updatedAt: userAchievements.updatedAt,
      code: achievements.code,
      name: achievements.name,
      description: achievements.description,
      icon: achievements.icon,
      collectionType: achievements.collectionType,
      proteinCategory: achievements.proteinCategory,
      tierThresholds: achievements.tierThresholds,
      points: achievements.points,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(and(
      eq(userAchievements.userId, userId),
      eq(achievements.collectionType, 'dynamic_collection')
    ));

    // Include proteinCategories in the response for multi-category support
    return collections.map(c => ({
      ...c,
      proteinCategories: c.proteinCategories || (c.proteinCategory ? [c.proteinCategory] : [])
    }));
  }

  async getCollectionProgress(userId, proteinCategory) {
    // This method still accepts single category for backward compatibility
    // but will work with multi-category achievements too
    const { sql } = require('drizzle-orm');
    
    const collection = await this.db.select()
      .from(achievements)
      .where(and(
        eq(achievements.collectionType, 'dynamic_collection'),
        eq(achievements.isActive, 1),
        // Match if proteinCategory matches OR if proteinCategory is in proteinCategories array
        sql`(${achievements.proteinCategory} = ${proteinCategory} OR ${achievements.proteinCategories}::jsonb ? ${proteinCategory})`
      ))
      .limit(1);

    if (collection.length === 0) {
      return { percentage: 0, currentTier: null };
    }

    const progress = await this.calculateCollectionProgress(userId, collection[0]);
    return {
      percentage: progress.percentage,
      currentTier: progress.tier,
      totalAvailable: progress.totalAvailable,
      totalRanked: progress.totalRanked
    };
  }
}

module.exports = CollectionManager;
