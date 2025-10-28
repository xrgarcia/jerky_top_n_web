const { eq, and } = require('drizzle-orm');
const { achievements, userAchievements } = require('../../shared/schema');

class CollectionManager {
  constructor(achievementRepo, productsMetadataRepo, db, productsService = null) {
    this.achievementRepo = achievementRepo;
    this.productsMetadataRepo = productsMetadataRepo;
    this.db = db;
    this.productsService = productsService; // Injected to get rankable products
    
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
    const { requirement } = collection;
    const requirementType = requirement?.type;
    
    // Route to different product fetchers based on requirement type
    let allProductIds = [];
    let filterInfo = '';
    
    if (requirementType === 'complete_collection') {
      // Complete Collection: ALL rankable products
      allProductIds = await this.getAllRankableProducts();
      filterInfo = 'all products';
    } 
    else if (requirementType === 'brand_collection') {
      // Brand Collection: Filter by vendors
      const vendors = requirement?.vendors || [];
      if (vendors.length === 0) {
        console.warn(`Collection ${collection.code} has no vendors specified`);
        return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
      }
      allProductIds = await this.getProductsByVendors(vendors);
      filterInfo = `${vendors.length} brand(s): ${vendors.join(', ')}`;
    } 
    else if (requirementType === 'animal_collection' || requirement?.categories) {
      // Animal Collection: Filter by animal categories
      // Support both requirement.categories and legacy proteinCategory/proteinCategories
      let categories = [];
      
      if (requirement?.categories && Array.isArray(requirement.categories) && requirement.categories.length > 0) {
        categories = requirement.categories;
      } else if (collection.proteinCategories && Array.isArray(collection.proteinCategories) && collection.proteinCategories.length > 0) {
        categories = collection.proteinCategories;
      } else if (collection.proteinCategory) {
        categories = [collection.proteinCategory];
      }
      
      if (categories.length === 0) {
        console.warn(`Collection ${collection.code} has no animal categories`);
        return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
      }
      
      allProductIds = await this.getProductsByAnimals(categories);
      filterInfo = `${categories.length} animal(s): ${categories.join(', ')}`;
    }
    else {
      console.warn(`Collection ${collection.code} has unknown requirement type: ${requirementType}`);
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }
    
    const totalAvailable = allProductIds.length;
    
    console.log(`📊 Collection ${collection.code}: Found ${totalAvailable} products for ${filterInfo}`);

    if (totalAvailable === 0) {
      console.warn(`Collection ${collection.code} found 0 products`);
      return { percentage: 0, totalAvailable: 0, totalRanked: 0 };
    }
    
    // Get user's ranked products that match the collection
    const { productRankings } = require('../../shared/schema');
    const { inArray } = require('drizzle-orm');
    
    const rankedProducts = await this.db
      .select({ shopifyProductId: productRankings.shopifyProductId })
      .from(productRankings)
      .where(and(
        eq(productRankings.userId, userId),
        inArray(productRankings.shopifyProductId, allProductIds)
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
      requirementType // Include for debugging
    };
  }

  /**
   * Get ALL rankable products using ProductsService (respects "rankable" tag filtering)
   * Falls back to querying products_metadata if ProductsService not available
   * @returns {Promise<Array<string>>} - Array of Shopify product IDs
   */
  async getAllRankableProducts() {
    console.log(`🔍 CollectionManager.getAllRankableProducts() START`);
    
    // Use ProductsService if available (recommended - respects rankable tag)
    if (this.productsService) {
      console.log(`✅ Using ProductsService to get rankable products`);
      try {
        const products = await this.productsService.getAllProducts({ 
          includeMetadata: false, 
          includeRankingStats: false 
        });
        const productIds = products.map(p => p.id);
        console.log(`✅ ProductsService returned ${productIds.length} rankable products`);
        console.log(`📋 Sample product IDs:`, productIds.slice(0, 5));
        return productIds;
      } catch (error) {
        console.error(`❌ Error using ProductsService, falling back to products_metadata:`, error.message);
        // Fall through to fallback method
      }
    }
    
    // Fallback: Query products_metadata (may include non-rankable products)
    console.log(`⚠️ Using products_metadata fallback (may include non-rankable products)`);
    const { productsMetadata } = require('../../shared/schema');
    
    const products = await this.db
      .select({ shopifyProductId: productsMetadata.shopifyProductId })
      .from(productsMetadata)
      .groupBy(productsMetadata.shopifyProductId);
    
    const productIds = products.map(p => p.shopifyProductId);
    console.log(`⚠️ products_metadata returned ${productIds.length} products (WARNING: may not all be rankable)`);
    return productIds;
  }

  /**
   * Get products filtered by vendor/brand names
   * @param {Array<string>} vendors - Array of vendor names (e.g., ['Jerky.com', 'Wild Bill\'s'])
   * @returns {Promise<Array<string>>} - Array of Shopify product IDs
   */
  async getProductsByVendors(vendors) {
    const { productsMetadata } = require('../../shared/schema');
    const { inArray } = require('drizzle-orm');
    
    const products = await this.db
      .select({ shopifyProductId: productsMetadata.shopifyProductId })
      .from(productsMetadata)
      .where(inArray(productsMetadata.vendor, vendors))
      .groupBy(productsMetadata.shopifyProductId);
    
    return products.map(p => p.shopifyProductId);
  }

  /**
   * Get products filtered by animal categories
   * @param {Array<string>} categories - Array of animal display names (e.g., ['Beef', 'Pork', 'Turkey'])
   * @returns {Promise<Array<string>>} - Array of Shopify product IDs
   */
  async getProductsByAnimals(categories) {
    const { productsMetadata } = require('../../shared/schema');
    const { inArray } = require('drizzle-orm');
    
    const products = await this.db
      .select({ shopifyProductId: productsMetadata.shopifyProductId })
      .from(productsMetadata)
      .where(inArray(productsMetadata.animalDisplay, categories))
      .groupBy(productsMetadata.shopifyProductId);
    
    return products.map(p => p.shopifyProductId);
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

  /**
   * Get all intermediate tiers that should be awarded when first earning a tiered achievement
   * For example, if user hits 80% (gold), they should get bronze, silver, then gold
   */
  getIntermediateTiers(finalTier, tierThresholds) {
    if (!finalTier || !tierThresholds) {
      return [finalTier].filter(Boolean);
    }

    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const finalTierIndex = tierOrder.indexOf(finalTier);
    
    if (finalTierIndex === -1) {
      return [finalTier];
    }

    // Return all tiers up to and including the final tier
    return tierOrder.slice(0, finalTierIndex + 1);
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
      // Check prerequisite before awarding new achievement
      if (collection.prerequisiteAchievementId) {
        const prerequisiteEarned = await this.db.select()
          .from(userAchievements)
          .where(and(
            eq(userAchievements.userId, userId),
            eq(userAchievements.achievementId, collection.prerequisiteAchievementId)
          ))
          .limit(1);
        
        if (prerequisiteEarned.length === 0) {
          console.log(`⚠️ [${collection.code}] Prerequisite achievement not earned yet, skipping award`);
          return null;
        }
      }
      
      // For tiered achievements, award all intermediate tiers
      const tiersToAward = collection.hasTiers ? 
        this.getIntermediateTiers(tier, collection.tierThresholds) : 
        [tier];
      
      console.log(`🎯 [${collection.code}] Awarding ${tiersToAward.length} tier(s): ${tiersToAward.join(' → ')}`);
      
      const notifications = [];
      let currentRecord = null;
      
      for (let i = 0; i < tiersToAward.length; i++) {
        const currentTier = tiersToAward[i];
        const thresholds = collection.tierThresholds || this.DEFAULT_TIER_THRESHOLDS;
        
        // For non-tiered achievements (flavor coins, etc), use actual percentage and full points
        let tierPercentage, tierPoints;
        if (!collection.hasTiers || currentTier === 'complete') {
          tierPercentage = percentage;
          tierPoints = collection.points || 0;
        } else {
          tierPercentage = thresholds[currentTier];
          tierPoints = this.calculateProportionalPoints(tierPercentage, collection.points || 0, collection.tierThresholds);
        }
        
        if (i === 0) {
          // Insert the first tier
          const result = await this.db.insert(userAchievements)
            .values({
              userId,
              achievementId: collection.id,
              currentTier,
              percentageComplete: tierPercentage,
              pointsAwarded: tierPoints,
              progress: progressData,
            })
            .returning();
          
          currentRecord = result[0];
          console.log(`🎉 New collection earned: ${collection.name} (${currentTier}) - ${tierPoints} points`);
          
          notifications.push({
            type: 'new',
            achievement: collection,
            tier: currentTier,
            percentage: tierPercentage,
            pointsAwarded: tierPoints,
            userAchievement: currentRecord
          });
        } else {
          // Update to the next tier
          const previousTier = tiersToAward[i - 1];
          const previousThreshold = thresholds[previousTier];
          const previousPoints = this.calculateProportionalPoints(previousThreshold, collection.points || 0, collection.tierThresholds);
          const pointsGained = tierPoints - previousPoints;
          
          await this.db.update(userAchievements)
            .set({
              currentTier,
              percentageComplete: tierPercentage,
              pointsAwarded: tierPoints,
              progress: progressData,
              updatedAt: new Date(),
            })
            .where(eq(userAchievements.id, currentRecord.id));
          
          console.log(`⬆️ Tier upgrade: ${collection.name} (${previousTier} → ${currentTier}) - +${pointsGained} points (total: ${tierPoints})`);
          
          notifications.push({
            type: 'tier_upgrade',
            achievement: collection,
            previousTier,
            newTier: currentTier,
            percentage: tierPercentage,
            pointsAwarded: tierPoints,
            pointsGained,
            userAchievement: currentRecord
          });
        }
      }
      
      // If we only awarded one tier, return single notification for backward compatibility
      // Otherwise return all notifications
      return notifications.length === 1 ? notifications[0] : notifications;
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
