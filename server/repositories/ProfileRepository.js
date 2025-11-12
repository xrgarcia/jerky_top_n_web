const { db } = require('../db');
const { users, productRankings, customerOrderItems, productsMetadata, achievements, userAchievements, userClassifications } = require('../../shared/schema');
const { eq, and, desc, asc, sql, inArray } = require('drizzle-orm');
const Sentry = require('@sentry/node');
const JourneyCache = require('../cache/JourneyCache');

/**
 * ProfileRepository
 * Handles fetching user profile data including rankings, purchases, and timeline moments
 */
class ProfileRepository {
  constructor(productsService = null) {
    this.productsService = productsService;
  }
  /**
   * Get user profile data with basic stats (privacy-aware, sanitized DTO)
   * @param {number} userId - The user's ID
   * @returns {Promise<Object|null>} Sanitized user profile data (no PII leak)
   */
  async getUserProfileData(userId) {
    try {
      const userRow = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userRow || userRow.length === 0) {
        return null;
      }

      const user = userRow[0];

      // Get ranking count
      const rankingCount = await db
        .select({ count: sql`count(*)` })
        .from(productRankings)
        .where(and(
          eq(productRankings.userId, userId),
          eq(productRankings.rankingListId, 'default')
        ));

      // Generate privacy-aware display name and initials
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
      
      let displayName;
      if (user.handle) {
        displayName = `@${user.handle}`;
      } else if (user.hide_name_privacy) {
        // Privacy enabled: show initials only
        displayName = initials;
      } else {
        // Privacy disabled: show "FirstName L."
        if (firstName && lastName) {
          displayName = `${firstName} ${lastName.charAt(0)}.`;
        } else if (firstName) {
          displayName = firstName;
        } else {
          displayName = 'User';
        }
      }

      // Return sanitized DTO (no email, tokens, shopify IDs, or other PII)
      return {
        id: user.id,
        displayName,
        initials,
        handle: user.handle || null,
        avatarUrl: user.profile_image_url || null,
        hideNamePrivacy: user.hide_name_privacy || false,
        // Only include actual names if privacy is disabled
        firstName: user.hide_name_privacy ? null : firstName,
        lastName: user.hide_name_privacy ? null : lastName,
        // Stats
        rankingCount: parseInt(rankingCount[0]?.count || 0),
        engagementScore: user.engagement_score || 0,
        journeyStage: user.journey_stage || 'new_user',
        // Membership info
        memberSince: user.created_at
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'profile-repository', method: 'getUserProfileData' },
        extra: { userId }
      });
      console.error('Error fetching user profile data:', error);
      return null;
    }
  }

  /**
   * Get user's top 5 ranked products for the podium
   * @param {number} userId - The user's ID
   * @returns {Promise<Array>} Top 5 ranked products with metadata
   */
  async getTopRankedProducts(userId) {
    try {
      // 1. Query rankings from database (just positions and IDs)
      const topRankings = await db
        .select({
          shopifyProductId: productRankings.shopifyProductId,
          rankPosition: productRankings.ranking,
          rankedAt: productRankings.createdAt
        })
        .from(productRankings)
        .where(and(
          eq(productRankings.userId, userId),
          eq(productRankings.rankingListId, 'default')
        ))
        .orderBy(asc(productRankings.ranking))
        .limit(5);

      if (topRankings.length === 0) {
        return [];
      }

      // 2. Get enriched product data from ProductsService (golden source)
      if (!this.productsService) {
        console.warn('⚠️ ProductsService not injected into ProfileRepository');
        return topRankings;
      }

      const productIds = topRankings.map(r => r.shopifyProductId);
      const enrichedProducts = await this.productsService.getProductsByIds(productIds);

      // 3. Merge ranking positions with enriched product data
      const enrichedRankings = topRankings.map(ranking => {
        const product = enrichedProducts.find(p => p.id === ranking.shopifyProductId);
        
        // Defensive fallback: if product not found (deleted/cache miss), use minimal placeholder
        if (!product) {
          console.warn(`⚠️ Product ${ranking.shopifyProductId} not found in ProductsService for user ${userId}`);
          return {
            id: ranking.shopifyProductId,
            title: 'Product Unavailable',
            image: null,
            vendor: null,
            primaryFlavor: null,
            animalType: null,
            rankPosition: ranking.rankPosition,
            rankedAt: ranking.rankedAt
          };
        }
        
        return {
          ...product,
          rankPosition: ranking.rankPosition,
          rankedAt: ranking.rankedAt
        };
      });

      return enrichedRankings;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'profile-repository', method: 'getTopRankedProducts' },
        extra: { userId }
      });
      console.error('Error fetching top ranked products:', error);
      return [];
    }
  }

  /**
   * Get merged timeline moments (purchases + rankings chronologically)
   * @param {number} userId - The user's ID
   * @returns {Promise<Array>} Timeline moments sorted by date
   */
  async getTimelineMoments(userId) {
    try {
      // 1. Get all purchases (just IDs and dates)
      const purchases = await db
        .select({
          type: sql`'purchase'`,
          date: customerOrderItems.orderDate,
          orderNumber: customerOrderItems.orderNumber,
          shopifyProductId: customerOrderItems.shopifyProductId,
          quantity: customerOrderItems.quantity
        })
        .from(customerOrderItems)
        .where(eq(customerOrderItems.userId, userId))
        .orderBy(desc(customerOrderItems.orderDate));

      // 2. Get all rankings (just IDs and dates)
      const rankings = await db
        .select({
          type: sql`'ranking'`,
          date: productRankings.createdAt,
          shopifyProductId: productRankings.shopifyProductId,
          rankPosition: productRankings.ranking
        })
        .from(productRankings)
        .where(and(
          eq(productRankings.userId, userId),
          eq(productRankings.rankingListId, 'default')
        ))
        .orderBy(desc(productRankings.createdAt));

      // 3. Get all unique product IDs
      const allProductIds = [...new Set([
        ...purchases.map(p => p.shopifyProductId),
        ...rankings.map(r => r.shopifyProductId)
      ])];

      // 4. Get enriched product data from ProductsService
      let enrichedProductsMap = {};
      if (this.productsService && allProductIds.length > 0) {
        const enrichedProducts = await this.productsService.getProductsByIds(allProductIds);
        enrichedProductsMap = Object.fromEntries(
          enrichedProducts.map(p => [p.id, p])
        );
      }

      // 5. Enrich purchases and rankings with product data
      const enrichedPurchases = purchases.map(p => {
        const product = enrichedProductsMap[p.shopifyProductId];
        
        // Defensive fallback: if product not found, use minimal placeholder
        if (!product) {
          console.warn(`⚠️ Product ${p.shopifyProductId} not found in ProductsService for user ${userId} (purchase)`);
          return {
            ...p,
            title: 'Product Unavailable',
            image: null,
            vendor: null
          };
        }
        
        return {
          ...p,
          title: product.title,
          image: product.image,
          vendor: product.vendor
        };
      });

      const enrichedRankings = rankings.map(r => {
        const product = enrichedProductsMap[r.shopifyProductId];
        
        // Defensive fallback: if product not found, use minimal placeholder
        if (!product) {
          console.warn(`⚠️ Product ${r.shopifyProductId} not found in ProductsService for user ${userId} (ranking)`);
          return {
            ...r,
            title: 'Product Unavailable',
            image: null,
            vendor: null
          };
        }
        
        return {
          ...r,
          title: product.title,
          image: product.image,
          vendor: product.vendor
        };
      });

      // 6. Merge and sort by date
      const allEvents = [...enrichedPurchases, ...enrichedRankings].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );

      // 7. Group into timeline moments (by date + type)
      const moments = this._groupIntoMoments(allEvents);

      return moments;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'profile-repository', method: 'getTimelineMoments' },
        extra: { userId }
      });
      console.error('Error fetching timeline moments:', error);
      return [];
    }
  }

  /**
   * Get all user rankings with purchase dates
   * @param {number} userId - The user's ID
   * @returns {Promise<Array>} All rankings with product and purchase info
   */
  async getAllRankingsWithPurchases(userId) {
    try {
      // 1. Query rankings with purchase dates from database
      const rankings = await db
        .select({
          shopifyProductId: productRankings.shopifyProductId,
          rankPosition: productRankings.ranking,
          rankedAt: productRankings.createdAt,
          // Get most recent purchase date for this product
          purchaseDate: sql`(
            SELECT MIN(order_date) 
            FROM customer_order_items 
            WHERE user_id = ${userId} 
            AND shopify_product_id = ${productRankings.shopifyProductId}
          )`
        })
        .from(productRankings)
        .where(and(
          eq(productRankings.userId, userId),
          eq(productRankings.rankingListId, 'default')
        ))
        .orderBy(asc(productRankings.ranking));

      if (rankings.length === 0) {
        return [];
      }

      // 2. Get enriched product data from ProductsService
      if (!this.productsService) {
        console.warn('⚠️ ProductsService not injected into ProfileRepository');
        return rankings;
      }

      const productIds = rankings.map(r => r.shopifyProductId);
      const enrichedProducts = await this.productsService.getProductsByIds(productIds);

      // 3. Merge ranking data with enriched product data
      const enrichedRankings = rankings.map(ranking => {
        const product = enrichedProducts.find(p => p.id === ranking.shopifyProductId);
        
        // Defensive fallback: if product not found (deleted/cache miss), use minimal placeholder
        if (!product) {
          console.warn(`⚠️ Product ${ranking.shopifyProductId} not found in ProductsService for user ${userId}`);
          return {
            id: ranking.shopifyProductId,
            title: 'Product Unavailable',
            image: null,
            vendor: null,
            primaryFlavor: null,
            animalType: null,
            rankPosition: ranking.rankPosition,
            rankedAt: ranking.rankedAt,
            purchaseDate: ranking.purchaseDate
          };
        }
        
        return {
          ...product,
          rankPosition: ranking.rankPosition,
          rankedAt: ranking.rankedAt,
          purchaseDate: ranking.purchaseDate
        };
      });

      return enrichedRankings;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'profile-repository', method: 'getAllRankingsWithPurchases' },
        extra: { userId }
      });
      console.error('Error fetching rankings with purchases:', error);
      return [];
    }
  }

  /**
   * Group events into meaningful timeline moments
   * @private
   * @param {Array} events - All events sorted by date
   * @returns {Array} Grouped timeline moments
   */
  _groupIntoMoments(events) {
    const moments = [];
    const eventsByDate = {};

    // Group events by date
    events.forEach(event => {
      const dateKey = new Date(event.date).toISOString().split('T')[0];
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = {
          purchases: [],
          rankings: []
        };
      }
      if (event.type === 'purchase') {
        eventsByDate[dateKey].purchases.push(event);
      } else {
        eventsByDate[dateKey].rankings.push(event);
      }
    });

    // Create moment cards
    Object.entries(eventsByDate).forEach(([dateKey, dayEvents]) => {
      const date = new Date(dateKey);
      
      // Purchase moments
      if (dayEvents.purchases.length > 0) {
        // Group by order number
        const orderGroups = {};
        dayEvents.purchases.forEach(purchase => {
          if (!orderGroups[purchase.orderNumber]) {
            orderGroups[purchase.orderNumber] = [];
          }
          orderGroups[purchase.orderNumber].push(purchase);
        });

        Object.values(orderGroups).forEach(orderItems => {
          moments.push({
            type: 'purchase',
            date: date,
            orderNumber: orderItems[0].orderNumber,
            products: orderItems,
            count: orderItems.length
          });
        });
      }

      // Ranking moments
      if (dayEvents.rankings.length > 0) {
        moments.push({
          type: 'ranking',
          date: date,
          products: dayEvents.rankings,
          count: dayEvents.rankings.length
        });
      }
    });

    // Sort moments by date (newest first)
    return moments.sort((a, b) => b.date - a.date);
  }

  /**
   * Get journey milestones for narrative-driven film strip timeline
   * Returns ~10-15 milestone moments celebrating user's flavor journey
   * @param {number} userId - The user's ID
   * @returns {Promise<Array>} Array of milestone objects {type, date, productId, headline, subtitle, badge}
   */
  async getJourneyMilestones(userId) {
    try {
      // Check cache first (10min TTL)
      const journeyCache = JourneyCache.getInstance();
      const cached = await journeyCache.get(userId);
      if (cached) {
        return cached;
      }

      const milestones = [];

      // MILESTONE 1: First purchase ever
      const firstPurchase = await this._getFirstPurchase(userId);
      if (firstPurchase) milestones.push(firstPurchase);

      // MILESTONE 2-9: First flavor discoveries (Sweet, Spicy, Hot, Teriyaki, BBQ, Peppered, Smoky, Original)
      const flavorDiscoveries = await this._getFlavorDiscoveries(userId);
      milestones.push(...flavorDiscoveries);

      // MILESTONE 10: First exotic animal (bison, elk, venison, wild boar)
      const exoticAnimal = await this._getFirstExoticAnimal(userId);
      if (exoticAnimal) milestones.push(exoticAnimal);

      // MILESTONE 11: First achievement unlocked
      const firstAchievement = await this._getFirstAchievement(userId);
      if (firstAchievement) milestones.push(firstAchievement);

      // MILESTONE 12: Joined flavor community
      const communityJoin = await this._getCommunityJoinMoment(userId);
      if (communityJoin) milestones.push(communityJoin);

      // MILESTONE 13: 100th ranking milestone
      const hundredthRanking = await this._get100thRanking(userId);
      if (hundredthRanking) milestones.push(hundredthRanking);

      // MILESTONE 14: First #1 ranking
      const firstTopRanking = await this._getFirstTopRanking(userId);
      if (firstTopRanking) milestones.push(firstTopRanking);

      // Sort by date (oldest first for chronological storytelling)
      const sorted = milestones.sort((a, b) => a.date - b.date);

      // Limit to 15 most meaningful milestones
      const final = sorted.slice(0, 15);

      // Store in cache (10min TTL)
      await journeyCache.set(userId, final);

      return final;

    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'ProfileRepository', method: 'getJourneyMilestones' },
        extra: { userId }
      });
      console.error('Error fetching journey milestones:', error);
      return [];
    }
  }

  // Helper: Get first purchase ever
  async _getFirstPurchase(userId) {
    const result = await db
      .select({
        orderDate: customerOrderItems.orderDate,
        shopifyProductId: customerOrderItems.shopifyProductId
      })
      .from(customerOrderItems)
      .where(eq(customerOrderItems.userId, userId))
      .orderBy(asc(customerOrderItems.orderDate))
      .limit(1);

    if (result.length === 0) return null;

    return {
      type: 'first_purchase',
      date: result[0].orderDate,
      productId: result[0].shopifyProductId,
      headline: 'First Bite',
      subtitle: 'Your jerky journey began',
      badge: '🎬'
    };
  }

  // Helper: Get first flavor discoveries for each primary flavor (single grouped query)
  async _getFlavorDiscoveries(userId) {
    const flavorMeta = {
      'Sweet': { emoji: '🍯', headline: 'Sweet Discovery' },
      'Spicy': { emoji: '🌶️', headline: 'Spicy Awakening' },
      'Hot': { emoji: '🔥', headline: 'Heat Seeker' },
      'Teriyaki': { emoji: '🥢', headline: 'Teriyaki Journey' },
      'BBQ': { emoji: '🍖', headline: 'BBQ Tradition' },
      'Peppered': { emoji: '⚫', headline: 'Pepper Power' },
      'Smoky': { emoji: '💨', headline: 'Smoke Signals' },
      'Original': { emoji: '⭐', headline: 'Classic Taste' }
    };

    // Single query with grouped MIN to get first purchase per flavor
    const results = await db
      .select({
        primaryFlavor: productsMetadata.primaryFlavor,
        firstOrderDate: sql`MIN(${customerOrderItems.orderDate})`.as('first_order_date'),
        shopifyProductId: sql`(
          ARRAY_AGG(${customerOrderItems.shopifyProductId} ORDER BY ${customerOrderItems.orderDate} ASC)
        )[1]`.as('first_product_id')
      })
      .from(customerOrderItems)
      .innerJoin(productsMetadata, eq(customerOrderItems.shopifyProductId, productsMetadata.shopifyProductId))
      .where(eq(customerOrderItems.userId, userId))
      .groupBy(productsMetadata.primaryFlavor);

    // Map results to milestone objects
    return results
      .filter(r => flavorMeta[r.primaryFlavor]) // Only known flavors
      .map(r => ({
        type: 'flavor_discovery',
        date: new Date(r.firstOrderDate),
        productId: r.shopifyProductId,
        headline: flavorMeta[r.primaryFlavor].headline,
        subtitle: `First ${r.primaryFlavor} flavor`,
        badge: flavorMeta[r.primaryFlavor].emoji
      }));
  }

  // Helper: Get first exotic animal purchase
  async _getFirstExoticAnimal(userId) {
    const exoticAnimals = ['bison', 'elk', 'venison', 'wild_boar', 'alligator'];
    
    const result = await db
      .select({
        orderDate: customerOrderItems.orderDate,
        shopifyProductId: customerOrderItems.shopifyProductId,
        animalType: productsMetadata.animalType
      })
      .from(customerOrderItems)
      .innerJoin(productsMetadata, eq(customerOrderItems.shopifyProductId, productsMetadata.shopifyProductId))
      .where(and(
        eq(customerOrderItems.userId, userId),
        inArray(productsMetadata.animalType, exoticAnimals)
      ))
      .orderBy(asc(customerOrderItems.orderDate))
      .limit(1);

    if (result.length === 0) return null;

    return {
      type: 'exotic_animal',
      date: result[0].orderDate,
      productId: result[0].shopifyProductId,
      headline: 'Wild Side',
      subtitle: `First ${result[0].animalType} adventure`,
      badge: '🦌'
    };
  }

  // Helper: Get first achievement unlocked
  async _getFirstAchievement(userId) {
    const result = await db
      .select({
        earnedAt: userAchievements.earnedAt,
        name: achievements.name,
        icon: achievements.icon
      })
      .from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId))
      .orderBy(asc(userAchievements.earnedAt))
      .limit(1);

    if (result.length === 0) return null;

    return {
      type: 'achievement',
      date: result[0].earnedAt,
      productId: null, // Achievement has no product
      headline: 'Achievement Unlocked',
      subtitle: result[0].name,
      badge: result[0].icon
    };
  }

  // Helper: Get community join moment
  async _getCommunityJoinMoment(userId) {
    const result = await db
      .select({
        lastCalculated: userClassifications.lastCalculated,
        focusAreas: userClassifications.focusAreas
      })
      .from(userClassifications)
      .where(eq(userClassifications.userId, userId))
      .limit(1);

    if (result.length === 0 || !result[0].lastCalculated) return null;

    const focusAreas = result[0].focusAreas || [];
    const primaryFocus = focusAreas[0] || 'Flavor';

    return {
      type: 'community',
      date: result[0].lastCalculated,
      productId: null,
      headline: 'Joined the Tribe',
      subtitle: `${primaryFocus} community member`,
      badge: '👥'
    };
  }

  // Helper: Get 100th ranking milestone
  async _get100thRanking(userId) {
    const result = await db
      .select({
        createdAt: productRankings.createdAt,
        shopifyProductId: productRankings.shopifyProductId
      })
      .from(productRankings)
      .where(and(
        eq(productRankings.userId, userId),
        eq(productRankings.rankingListId, 'default')
      ))
      .orderBy(asc(productRankings.createdAt))
      .limit(100);

    if (result.length < 100) return null;

    const hundredthRanking = result[99]; // 0-indexed

    return {
      type: 'milestone_ranking',
      date: hundredthRanking.createdAt,
      productId: hundredthRanking.shopifyProductId,
      headline: 'Century Club',
      subtitle: '100 flavors ranked',
      badge: '💯'
    };
  }

  // Helper: Get first #1 ranking
  async _getFirstTopRanking(userId) {
    const result = await db
      .select({
        createdAt: productRankings.createdAt,
        shopifyProductId: productRankings.shopifyProductId
      })
      .from(productRankings)
      .where(and(
        eq(productRankings.userId, userId),
        eq(productRankings.rankingListId, 'default'),
        eq(productRankings.ranking, 1)
      ))
      .orderBy(asc(productRankings.createdAt))
      .limit(1);

    if (result.length === 0) return null;

    return {
      type: 'top_ranking',
      date: result[0].createdAt,
      productId: result[0].shopifyProductId,
      headline: 'Crowned Your Favorite',
      subtitle: 'First #1 ranking',
      badge: '👑'
    };
  }
}

module.exports = ProfileRepository;
