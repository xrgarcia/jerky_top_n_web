const { db } = require('../db');
const { userFlavorCommunities, customerOrderItems, productRankings, productsMetadata, userActivities, classificationConfig } = require('../../shared/schema');
const { eq, and, sql, inArray } = require('drizzle-orm');

/**
 * FlavorCommunityService - Manages flavor profile micro-communities
 * 
 * Community States (Lifecycle):
 * 1. curious: User searches/views products with this flavor but hasn't purchased
 * 2. seeker: User purchased products with this flavor (not yet delivered)
 * 3. taster: User has delivered products with this flavor (must have tried it)
 * 4. enthusiast: User ranked products with this flavor highly (loves it!)
 * 5. explorer: User ranked products with this flavor low (took a risk - positive!)
 * 
 * A user can be in different states for different flavor profiles simultaneously.
 */
class FlavorCommunityService {
  constructor() {
    this.configCache = null;
    this.configCacheTime = null;
    this.configCacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get flavor community configuration with caching
   */
  async getConfig() {
    const now = Date.now();
    if (this.configCache && this.configCacheTime && (now - this.configCacheTime < this.configCacheTTL)) {
      return this.configCache;
    }

    const configRow = await db
      .select()
      .from(classificationConfig)
      .where(eq(classificationConfig.configKey, 'flavor_community_thresholds'))
      .limit(1);

    if (configRow.length === 0) {
      // Default configuration
      this.configCache = {
        enthusiast_top_pct: 40,
        explorer_bottom_pct: 40,
        min_products_for_state: 1,
        delivered_status: 'delivered'
      };
    } else {
      this.configCache = configRow[0].configValue;
    }

    this.configCacheTime = now;
    return this.configCache;
  }

  /**
   * Invalidate configuration cache
   */
  invalidateConfigCache() {
    this.configCache = null;
    this.configCacheTime = null;
  }

  /**
   * Update flavor community configuration
   * @param {object} configData - Configuration data
   * @param {string} updatedByEmail - Email of user making the update
   * @returns {object} Updated configuration
   */
  async updateConfig(configData, updatedByEmail) {
    const { enthusiast_top_pct, explorer_bottom_pct, min_products_for_state, delivered_status } = configData;

    // Validate input
    if (enthusiast_top_pct < 1 || enthusiast_top_pct > 100) {
      throw new Error('enthusiast_top_pct must be between 1 and 100');
    }
    if (explorer_bottom_pct < 1 || explorer_bottom_pct > 100) {
      throw new Error('explorer_bottom_pct must be between 1 and 100');
    }
    if (min_products_for_state < 0) {
      throw new Error('min_products_for_state must be >= 0');
    }

    const newConfig = {
      enthusiast_top_pct: parseInt(enthusiast_top_pct),
      explorer_bottom_pct: parseInt(explorer_bottom_pct),
      min_products_for_state: parseInt(min_products_for_state),
      delivered_status: delivered_status || 'delivered'
    };

    // Update config in database
    await db
      .update(classificationConfig)
      .set({
        configValue: newConfig,
        updatedAt: new Date(),
        updatedBy: updatedByEmail
      })
      .where(eq(classificationConfig.configKey, 'flavor_community_thresholds'));

    // Invalidate cache
    this.invalidateConfigCache();

    return newConfig;
  }

  /**
   * Update user's flavor communities based on current behavior
   * @param {number} userId - User ID
   * @returns {array} Array of flavor community states
   */
  async updateUserFlavorCommunities(userId) {
    const config = await this.getConfig();
    
    // Get all flavor profiles the user has interacted with
    const flavorInteractions = await this._getUserFlavorInteractions(userId);
    
    const flavorCommunities = [];

    for (const [flavorProfile, data] of Object.entries(flavorInteractions)) {
      const state = this._calculateCommunityState(data, config);
      
      // Upsert flavor community record
      const existing = await db
        .select()
        .from(userFlavorCommunities)
        .where(and(
          eq(userFlavorCommunities.userId, userId),
          eq(userFlavorCommunities.flavorProfile, flavorProfile)
        ))
        .limit(1);

      const communityData = {
        userId,
        flavorProfile,
        communityState: state,
        productsPurchased: data.productsPurchased,
        productsDelivered: data.productsDelivered,
        productsRanked: data.productsRanked,
        avgRankPosition: data.avgRankPosition,
        highestRankPosition: data.highestRankPosition,
        lowestRankPosition: data.lowestRankPosition,
        lastActivityAt: new Date(),
        updatedAt: new Date()
      };

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(userFlavorCommunities)
          .set(communityData)
          .where(eq(userFlavorCommunities.id, existing[0].id));
      } else {
        // Insert new record
        await db.insert(userFlavorCommunities).values(communityData);
      }

      flavorCommunities.push({
        flavorProfile,
        state,
        ...data
      });
    }

    return flavorCommunities;
  }

  /**
   * Get user's flavor community states
   * @param {number} userId - User ID
   * @returns {array} Flavor communities with states
   */
  async getUserFlavorCommunities(userId) {
    const communities = await db
      .select()
      .from(userFlavorCommunities)
      .where(eq(userFlavorCommunities.userId, userId));

    return communities;
  }

  /**
   * Get flavor community summary across all users
   * @param {string} flavorProfile - Flavor profile (e.g., 'sweet', 'spicy')
   * @returns {object} Summary with counts per state
   */
  async getFlavorCommunitySummary(flavorProfile = null) {
    let query = db
      .select({
        flavorProfile: userFlavorCommunities.flavorProfile,
        communityState: userFlavorCommunities.communityState,
        userCount: sql`COUNT(DISTINCT ${userFlavorCommunities.userId})::int`
      })
      .from(userFlavorCommunities);

    if (flavorProfile) {
      query = query.where(eq(userFlavorCommunities.flavorProfile, flavorProfile));
    }

    const results = await query
      .groupBy(userFlavorCommunities.flavorProfile, userFlavorCommunities.communityState);

    return results;
  }

  /**
   * Gather user's interactions with flavor profiles
   * @private
   */
  async _getUserFlavorInteractions(userId) {
    const interactions = {};

    // 1. Get purchases and delivery status per flavor
    const purchaseData = await db
      .select({
        primaryFlavor: productsMetadata.primaryFlavor,
        secondaryFlavors: productsMetadata.secondaryFlavors,
        fulfillmentStatus: customerOrderItems.fulfillmentStatus,
        shopifyProductId: customerOrderItems.shopifyProductId
      })
      .from(customerOrderItems)
      .leftJoin(productsMetadata, eq(customerOrderItems.shopifyProductId, productsMetadata.shopifyProductId))
      .where(eq(customerOrderItems.userId, userId));

    // Process purchases
    for (const purchase of purchaseData) {
      const config = await this.getConfig();
      const isDelivered = purchase.fulfillmentStatus === config.delivered_status;

      // Track primary flavor
      if (purchase.primaryFlavor) {
        if (!interactions[purchase.primaryFlavor]) {
          interactions[purchase.primaryFlavor] = {
            productsPurchased: 0,
            productsDelivered: 0,
            productsRanked: 0,
            rankPositions: [],
            productIds: new Set()
          };
        }
        interactions[purchase.primaryFlavor].productsPurchased++;
        if (isDelivered) {
          interactions[purchase.primaryFlavor].productsDelivered++;
        }
        interactions[purchase.primaryFlavor].productIds.add(purchase.shopifyProductId);
      }

      // Track secondary flavors
      if (purchase.secondaryFlavors) {
        let secondaryArray = [];
        try {
          secondaryArray = typeof purchase.secondaryFlavors === 'string' 
            ? JSON.parse(purchase.secondaryFlavors) 
            : purchase.secondaryFlavors;
        } catch (e) {
          // Skip invalid JSON
        }

        for (const flavor of secondaryArray) {
          if (!interactions[flavor]) {
            interactions[flavor] = {
              productsPurchased: 0,
              productsDelivered: 0,
              productsRanked: 0,
              rankPositions: [],
              productIds: new Set()
            };
          }
          interactions[flavor].productsPurchased++;
          if (isDelivered) {
            interactions[flavor].productsDelivered++;
          }
          interactions[flavor].productIds.add(purchase.shopifyProductId);
        }
      }
    }

    // 2. Get rankings per flavor
    const rankingsData = await db
      .select({
        primaryFlavor: productsMetadata.primaryFlavor,
        secondaryFlavors: productsMetadata.secondaryFlavors,
        ranking: productRankings.ranking,
        shopifyProductId: productRankings.shopifyProductId
      })
      .from(productRankings)
      .leftJoin(productsMetadata, eq(productRankings.shopifyProductId, productsMetadata.shopifyProductId))
      .where(eq(productRankings.userId, userId));

    // Process rankings
    for (const ranking of rankingsData) {
      // Track primary flavor
      if (ranking.primaryFlavor) {
        if (!interactions[ranking.primaryFlavor]) {
          interactions[ranking.primaryFlavor] = {
            productsPurchased: 0,
            productsDelivered: 0,
            productsRanked: 0,
            rankPositions: [],
            productIds: new Set()
          };
        }
        interactions[ranking.primaryFlavor].productsRanked++;
        interactions[ranking.primaryFlavor].rankPositions.push(ranking.ranking);
      }

      // Track secondary flavors
      if (ranking.secondaryFlavors) {
        let secondaryArray = [];
        try {
          secondaryArray = typeof ranking.secondaryFlavors === 'string' 
            ? JSON.parse(ranking.secondaryFlavors) 
            : ranking.secondaryFlavors;
        } catch (e) {
          // Skip invalid JSON
        }

        for (const flavor of secondaryArray) {
          if (!interactions[flavor]) {
            interactions[flavor] = {
              productsPurchased: 0,
              productsDelivered: 0,
              productsRanked: 0,
              rankPositions: [],
              productIds: new Set()
            };
          }
          interactions[flavor].productsRanked++;
          interactions[flavor].rankPositions.push(ranking.ranking);
        }
      }
    }

    // 3. Get searches/views for flavors the user hasn't purchased (curious state)
    const searchActivities = await db
      .select({
        activityData: userActivities.activityData
      })
      .from(userActivities)
      .where(and(
        eq(userActivities.userId, userId),
        inArray(userActivities.activityType, ['search', 'product_view'])
      ));

    // Track flavor profiles from search/view activities
    const searchedProductIds = new Set();
    for (const activity of searchActivities) {
      if (activity.activityData?.shopifyProductId) {
        searchedProductIds.add(activity.activityData.shopifyProductId);
      }
    }

    // Get flavors for searched products
    if (searchedProductIds.size > 0) {
      const searchedProductFlavors = await db
        .select({
          primaryFlavor: productsMetadata.primaryFlavor,
          secondaryFlavors: productsMetadata.secondaryFlavors,
          shopifyProductId: productsMetadata.shopifyProductId
        })
        .from(productsMetadata)
        .where(inArray(productsMetadata.shopifyProductId, Array.from(searchedProductIds)));

      for (const product of searchedProductFlavors) {
        // Only track if not already purchased
        if (product.primaryFlavor && !interactions[product.primaryFlavor]?.productsPurchased) {
          if (!interactions[product.primaryFlavor]) {
            interactions[product.primaryFlavor] = {
              productsPurchased: 0,
              productsDelivered: 0,
              productsRanked: 0,
              rankPositions: [],
              productIds: new Set()
            };
          }
        }

        // Track secondary flavors
        if (product.secondaryFlavors) {
          let secondaryArray = [];
          try {
            secondaryArray = typeof product.secondaryFlavors === 'string' 
              ? JSON.parse(product.secondaryFlavors) 
              : product.secondaryFlavors;
          } catch (e) {
            // Skip invalid JSON
          }

          for (const flavor of secondaryArray) {
            if (!interactions[flavor]?.productsPurchased) {
              if (!interactions[flavor]) {
                interactions[flavor] = {
                  productsPurchased: 0,
                  productsDelivered: 0,
                  productsRanked: 0,
                  rankPositions: [],
                  productIds: new Set()
                };
              }
            }
          }
        }
      }
    }

    // Calculate aggregate stats
    for (const flavor of Object.keys(interactions)) {
      const positions = interactions[flavor].rankPositions;
      if (positions.length > 0) {
        interactions[flavor].avgRankPosition = Math.round(
          positions.reduce((sum, pos) => sum + pos, 0) / positions.length
        );
        interactions[flavor].highestRankPosition = Math.min(...positions);
        interactions[flavor].lowestRankPosition = Math.max(...positions);
      } else {
        interactions[flavor].avgRankPosition = null;
        interactions[flavor].highestRankPosition = null;
        interactions[flavor].lowestRankPosition = null;
      }

      // Clean up Set objects for return
      delete interactions[flavor].productIds;
      delete interactions[flavor].rankPositions;
    }

    return interactions;
  }

  /**
   * Calculate community state based on user data and thresholds
   * @private
   */
  _calculateCommunityState(data, config) {
    const { productsPurchased, productsDelivered, productsRanked, avgRankPosition } = data;

    // Priority order for state determination:

    // 1. Enthusiast: Has delivered products AND ranked them highly
    if (productsRanked > 0 && avgRankPosition !== null) {
      // Calculate threshold position: top X% of their total rankings
      // If user has 10 products, top 40% = position 1-4 (enthusiast)
      // Bottom 40% = position 7-10 (explorer)
      const topThreshold = Math.ceil(productsRanked * (config.enthusiast_top_pct / 100));
      const bottomThreshold = productsRanked - Math.floor(productsRanked * (config.explorer_bottom_pct / 100));

      if (avgRankPosition <= topThreshold) {
        return 'enthusiast'; // They love it!
      }
      
      if (avgRankPosition >= bottomThreshold) {
        return 'explorer'; // Took a risk - positive attribute!
      }

      // Middle ground: they've tried and ranked, but not extreme either way
      return 'taster';
    }

    // 2. Taster: Has delivered products but hasn't ranked them yet
    if (productsDelivered > 0) {
      return 'taster'; // Must have tried it
    }

    // 3. Seeker: Has purchased but not delivered yet
    if (productsPurchased > 0) {
      return 'seeker'; // Discovering these flavors
    }

    // 4. Curious: Searches/views but no purchases
    return 'curious'; // Exploring/curious about this flavor
  }
}

module.exports = new FlavorCommunityService();
