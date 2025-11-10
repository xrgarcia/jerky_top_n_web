const Sentry = require('@sentry/node');

/**
 * ProfileDashboardService
 * Orchestrates data for the private profile dashboard
 * Combines user guidance, purchase analytics, and progress stats
 */
class ProfileDashboardService {
  constructor(dependencies) {
    this.personalizedGuidanceService = dependencies.personalizedGuidanceService;
    this.purchaseHistoryRepo = dependencies.purchaseHistoryRepo;
    this.productsService = dependencies.productsService;
    this.userStatsAggregator = dependencies.userStatsAggregator;
    this.engagementManager = dependencies.engagementManager;
    this.progressTracker = dependencies.progressTracker;
  }

  /**
   * Get comprehensive dashboard data for a user
   * @param {number} userId - The user's ID
   * @param {number} totalRankableProducts - Total number of rankable products
   * @returns {Promise<Object>} Dashboard data including guidance, purchase stats, and progress
   */
  async getDashboardData(userId, totalRankableProducts) {
    try {
      console.log(`📊 [ProfileDashboard] Fetching dashboard data for user ${userId}`);

      // Fetch all data in parallel for performance
      const [
        guidanceData,
        uniqueProductCount,
        favoriteProductRaw,
        userStats,
        achievementsData
      ] = await Promise.all([
        // 1. User guidance insights (cache-first via PersonalizedGuidanceService)
        this.getGuidanceData(userId, totalRankableProducts),
        
        // 2. Purchase analytics - unique products count
        this.purchaseHistoryRepo.countDistinctProductsByUser(userId),
        
        // 3. Purchase analytics - favorite product
        this.purchaseHistoryRepo.getFavoriteProductByUser(userId),
        
        // 4. User stats for progress
        this.userStatsAggregator.getStatsForAchievements(userId, totalRankableProducts),
        
        // 5. Achievements with progress
        this.getAchievementsData(userId)
      ]);

      // Enrich favorite product with metadata if available
      const favoriteProduct = await this.enrichFavoriteProduct(favoriteProductRaw);

      // Assemble the complete dashboard payload
      const dashboard = {
        guidance: guidanceData,
        purchaseStats: {
          uniqueProductCount,
          favoriteProduct,
          hasOrders: uniqueProductCount > 0
        },
        progress: {
          totalRankings: userStats.totalRankings || 0,
          achievementsEarned: userStats.totalCoinsEarned || 0,
          totalAchievements: achievementsData.total || 30,
          currentStreak: userStats.currentStreak || 0,
          longestStreak: userStats.longestStreak || 0,
          totalPoints: userStats.totalEngagementPoints || 0,
          uniqueFlavors: userStats.uniqueFlavors || 0,
          uniqueAnimals: userStats.uniqueAnimals || 0,
          leaderboardPosition: userStats.leaderboardPosition || null
        },
        meta: {
          timestamp: new Date().toISOString(),
          userId
        }
      };

      console.log(`✅ [ProfileDashboard] Dashboard data fetched successfully for user ${userId}`);
      return dashboard;

    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'profile-dashboard' },
        extra: { userId, totalRankableProducts }
      });
      console.error('❌ [ProfileDashboard] Error fetching dashboard data:', error);
      
      // Return minimal safe defaults on complete failure
      return this.getEmptyDashboard(userId);
    }
  }

  /**
   * Get user guidance data with fallback
   * @private
   */
  async getGuidanceData(userId, totalRankableProducts) {
    try {
      const guidance = await this.personalizedGuidanceService.getGuidance(
        userId,
        'general', // Use 'general' context for profile dashboard
        totalRankableProducts
      );
      return guidance;
    } catch (error) {
      console.warn(`⚠️ [ProfileDashboard] Failed to fetch guidance for user ${userId}:`, error.message);
      return null; // Null-safe default
    }
  }

  /**
   * Get achievements data with fallback
   * @private
   */
  async getAchievementsData(userId) {
    try {
      const achievements = await this.progressTracker.getAllUserAchievements(userId);
      const earned = achievements.filter(a => a.earned).length;
      return {
        total: achievements.length,
        earned
      };
    } catch (error) {
      console.warn(`⚠️ [ProfileDashboard] Failed to fetch achievements for user ${userId}:`, error.message);
      return { total: 30, earned: 0 };
    }
  }

  /**
   * Enrich favorite product with metadata (title, image, etc.)
   * @private
   */
  async enrichFavoriteProduct(favoriteProductRaw) {
    if (!favoriteProductRaw) {
      return null;
    }

    try {
      // Fetch product metadata from ProductsService cache
      const product = await this.productsService.getProductById(favoriteProductRaw.shopifyProductId);
      
      if (product) {
        return {
          shopifyProductId: favoriteProductRaw.shopifyProductId,
          title: product.title,
          primaryImageUrl: product.primaryImageUrl || product.images?.[0]?.src || null,
          totalQuantity: favoriteProductRaw.totalQuantity,
          lastOrderDate: favoriteProductRaw.lastOrderDate
        };
      }

      // Fallback if product not found in cache
      return {
        shopifyProductId: favoriteProductRaw.shopifyProductId,
        title: 'Product',
        primaryImageUrl: null,
        totalQuantity: favoriteProductRaw.totalQuantity,
        lastOrderDate: favoriteProductRaw.lastOrderDate
      };
    } catch (error) {
      console.warn(`⚠️ [ProfileDashboard] Failed to enrich favorite product:`, error.message);
      return {
        shopifyProductId: favoriteProductRaw.shopifyProductId,
        title: 'Product',
        primaryImageUrl: null,
        totalQuantity: favoriteProductRaw.totalQuantity,
        lastOrderDate: favoriteProductRaw.lastOrderDate
      };
    }
  }

  /**
   * Get empty dashboard with safe defaults
   * @private
   */
  getEmptyDashboard(userId) {
    return {
      guidance: null,
      purchaseStats: {
        uniqueProductCount: 0,
        favoriteProduct: null,
        hasOrders: false
      },
      progress: {
        totalRankings: 0,
        achievementsEarned: 0,
        totalAchievements: 30,
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        uniqueFlavors: 0,
        uniqueAnimals: 0,
        leaderboardPosition: null
      },
      meta: {
        timestamp: new Date().toISOString(),
        userId
      }
    };
  }
}

module.exports = ProfileDashboardService;
