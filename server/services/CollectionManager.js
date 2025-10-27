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

  async checkAndUpdateCustomProductCollections(userId) {
    const { inArray } = require('drizzle-orm');
    
    // Query for all product-list-based collections: static_collection (new), custom_product_list (legacy), and flavor_coin
    const allCollections = await this.db.select()
      .from(achievements)
      .where(and(
        inArray(achievements.collectionType, ['static_collection', 'custom_product_list', 'flavor_coin']),
        eq(achievements.isActive, 1)
      ));

    // Filter to only those with custom product list or flavor_coin requirement
    const customProductCollections = allCollections.filter(c => 
      c.requirement && 
      (c.requirement.type === 'static_collection' || c.requirement.type === 'custom_product_list' || c.requirement.type === 'flavor_coin') && 
      Array.isArray(c.requirement.productIds) && c.requirement.productIds.length > 0
    );

    const updates = [];

    for (const collection of customProductCollections) {
      const progress = await this.calculateCustomProductProgress(userId, collection);
      const update = await this.updateCollectionProgress(userId, collection, progress);
      if (update) {
        updates.push(update);
      }
    }

    return updates;
  }

  async calculateCustomProductProgress(userId, collection) {
    const { requirement } = collection;
    
    if (!requirement || !requirement.productIds || !Array.isArray(requirement.productIds)) {
      console.warn(`Collection ${collection.code} has no product IDs`);
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }

    const productIds = requirement.productIds;
    const totalAvailable = productIds.length;
    
    if (totalAvailable === 0) {
      console.warn(`Collection ${collection.code} has empty product list`);
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }

    const { productRankings } = require('../../shared/schema');
    const { inArray } = require('drizzle-orm');

    console.log(`🔍 [${collection.code}] CALC START - User ${userId}, Required products: ${totalAvailable}`, productIds);

    // Get user's ranked products that match the custom product list
    const rankedProducts = await this.db
      .select({ shopifyProductId: productRankings.shopifyProductId })
      .from(productRankings)
      .where(and(
        eq(productRankings.userId, userId),
        inArray(productRankings.shopifyProductId, productIds)
      ))
      .groupBy(productRankings.shopifyProductId);

    const rankedProductIds = rankedProducts.map(p => p.shopifyProductId);
    const totalRanked = rankedProducts.length;
    const percentage = Math.round((totalRanked / totalAvailable) * 100);
    
    // Only calculate tier if achievement has tiers enabled
    const tier = collection.hasTiers ? this.getTierFromPercentage(percentage, collection.tierThresholds) : (percentage === 100 ? 'complete' : null);
    
    console.log(`✅ [${collection.code}] CALC RESULT - User ${userId}: ${totalRanked}/${totalAvailable} (${percentage}%) → TIER: ${tier} (hasTiers: ${collection.hasTiers})`);
    console.log(`📋 [${collection.code}] Ranked product IDs:`, rankedProductIds);

    return {
      percentage,
      totalAvailable,
      totalRanked,
      tier,
      productIds // Include for debugging
    };
  }

  async calculateCollectionProgress(userId, collection) {
    const { proteinCategory, proteinCategories, requirement } = collection;
    
    // Priority order for categories:
    // 1. requirement.categories (new dynamic collections with animal display names)
    // 2. proteinCategories (legacy multi-category)
    // 3. proteinCategory (legacy single category)
    let categories = [];
    
    if (requirement && requirement.categories && Array.isArray(requirement.categories) && requirement.categories.length > 0) {
      categories = requirement.categories;
    } else if (proteinCategories && Array.isArray(proteinCategories) && proteinCategories.length > 0) {
      categories = proteinCategories;
    } else if (proteinCategory) {
      categories = [proteinCategory];
    }
    
    if (categories.length === 0) {
      console.warn(`Collection ${collection.code} has no protein categories`);
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }

    const { productRankings, productsMetadata } = require('../../shared/schema');
    const { inArray } = require('drizzle-orm');

    // Fetch products from all categories and deduplicate
    // For new dynamic collections, categories are animal display names (Alligator, Beef, etc.)
    // Query by animalDisplay field
    const allProducts = await this.db
      .select({ shopifyProductId: productsMetadata.shopifyProductId })
      .from(productsMetadata)
      .where(inArray(productsMetadata.animalDisplay, categories))
      .groupBy(productsMetadata.shopifyProductId);
    
    const totalAvailable = allProducts.length;
    
    console.log(`📊 Collection ${collection.code}: Found ${totalAvailable} products for ${categories.length} animals:`, categories);

    if (totalAvailable === 0) {
      console.warn(`Collection ${collection.code} found 0 products for categories:`, categories);
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }
    
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
        inArray(productsMetadata.animalDisplay, categories)
      ))
      .groupBy(productRankings.shopifyProductId);

    const totalRanked = rankedProducts.length;
    const percentage = Math.round((totalRanked / totalAvailable) * 100);
    
    // Only calculate tier if achievement has tiers enabled
    const tier = collection.hasTiers ? this.getTierFromPercentage(percentage, collection.tierThresholds) : (percentage === 100 ? 'complete' : null);
    
    console.log(`📊 Collection ${collection.code}: User ${userId} ranked ${totalRanked}/${totalAvailable} products (${percentage}%) → TIER: ${tier} (hasTiers: ${collection.hasTiers})`);

    return {
      percentage,
      totalAvailable,
      totalRanked,
      tier,
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

    console.log(`🔄 [${collection.code}] UPDATE START - User ${userId}: New calc shows ${tier} (${percentage}%)`);

    if (!tier) {
      console.log(`⚠️ [${collection.code}] No tier calculated, skipping update`);
      return null;
    }

    const existing = await this.db.select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, collection.id)
      ))
      .limit(1);
    
    console.log(`📊 [${collection.code}] DB STATE - User ${userId}: Current tier in DB: ${existing.length > 0 ? existing[0].currentTier : 'NONE'}`);

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
      
      // Check if tier has actually changed for notifications
      const tierChanged = current.currentTier !== tier;
      const percentageChanged = current.percentageComplete !== percentage;
      
      // Always update the database if there's any progress change
      if (tierChanged || percentageChanged) {
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

        // Only trigger notification if tier actually changed
        if (tierChanged) {
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
        } else {
          // Progress updated but tier didn't change - no notification
          console.log(`📊 Progress updated: ${collection.name} (${tier}) ${current.percentageComplete}% → ${percentage}% - +${pointsGained} points (total: ${pointsAwarded})`);
        }
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
