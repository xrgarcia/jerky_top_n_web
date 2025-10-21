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
    const { proteinCategory, requirement } = collection;
    
    if (!proteinCategory) {
      console.warn(`Collection ${collection.code} has no protein category`);
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }

    const availableProducts = await this.productsMetadataRepo.getProductsByAnimalType(proteinCategory);
    const totalAvailable = availableProducts.length;

    if (totalAvailable === 0) {
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }

    const { productRankings, productsMetadata } = require('../../shared/schema');
    const { sql, count } = require('drizzle-orm');
    
    const rankedProducts = await this.db
      .select({ shopifyProductId: productRankings.shopifyProductId })
      .from(productRankings)
      .innerJoin(
        productsMetadata,
        eq(productRankings.shopifyProductId, productsMetadata.shopifyProductId)
      )
      .where(and(
        eq(productRankings.userId, userId),
        eq(productsMetadata.animalType, proteinCategory)
      ))
      .groupBy(productRankings.shopifyProductId);

    const totalRanked = rankedProducts.length;
    const percentage = Math.round((totalRanked / totalAvailable) * 100);

    return {
      percentage,
      totalAvailable,
      totalRanked,
      tier: this.getTierFromPercentage(percentage, collection.tierThresholds)
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

    if (existing.length === 0) {
      const result = await this.db.insert(userAchievements)
        .values({
          userId,
          achievementId: collection.id,
          currentTier: tier,
          percentageComplete: percentage,
          progress: progressData,
        })
        .returning();
      
      return {
        type: 'new',
        achievement: collection,
        tier,
        percentage,
        userAchievement: result[0]
      };
    } else {
      const current = existing[0];
      
      if (current.currentTier !== tier || current.percentageComplete !== percentage) {
        await this.db.update(userAchievements)
          .set({
            currentTier: tier,
            percentageComplete: percentage,
            progress: progressData,
            updatedAt: new Date(),
          })
          .where(eq(userAchievements.id, current.id));

        return {
          type: 'tier_upgrade',
          achievement: collection,
          previousTier: current.currentTier,
          newTier: tier,
          percentage,
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

    return collections;
  }
}

module.exports = CollectionManager;
