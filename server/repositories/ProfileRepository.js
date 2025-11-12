const { db } = require('../db');
const { users, productRankings, customerOrderItems, productsMetadata } = require('../../shared/schema');
const { eq, and, desc, asc, sql } = require('drizzle-orm');
const Sentry = require('@sentry/node');

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
}

module.exports = ProfileRepository;
