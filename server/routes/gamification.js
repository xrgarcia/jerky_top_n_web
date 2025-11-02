const express = require('express');
const router = express.Router();
const ProductRankingRepository = require('../repositories/ProductRankingRepository');

/**
 * Gamification API Routes
 * Handles achievements, streaks, leaderboards, and activity feeds
 */

function createGamificationRoutes(services) {
  const { 
    engagementManager, 
    streakManager, 
    leaderboardManager, 
    progressTracker,
    activityLogRepo,
    productViewRepo,
    homeStatsService,
    communityService,
    userStatsAggregator,
    commentaryService
  } = services;

  router.get('/achievements', async (req, res) => {
    let userId = null;
    try {
      console.log('🔍 Achievements endpoint called');
      
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        console.log('⚠️ Achievements request without session_id cookie');
        return res.status(401).json({ error: 'Not authenticated' });
      }
      console.log(`🔑 Session ID present: ${sessionId.substring(0, 8)}...`);

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        console.log('⚠️ Invalid session for achievements request:', sessionId);
        return res.status(401).json({ error: 'Invalid session' });
      }
      console.log(`✅ Session validated for user ${session.userId}`);

      userId = session.userId;
      console.log(`📊 Fetching achievements for user ${userId}`);

      // Get product count from cache (optimized - no full product fetch)
      const totalRankableProducts = services.getRankableProductCount();
      console.log(`✅ Product count retrieved: ${totalRankableProducts} rankable products`);

      // Use UserStatsAggregator to batch all user stats queries (Facade Pattern)
      console.log(`🔄 Batching user stats queries...`);
      const stats = await userStatsAggregator.getStatsForAchievements(userId, totalRankableProducts);
      console.log(`✅ User stats aggregated: position ${stats.leaderboardPosition}, streak ${stats.currentStreak}`);

      console.log(`🔄 Getting achievements with progress...`);
      const achievements = await engagementManager.getAchievementsWithProgress(userId, stats);
      console.log(`✅ Achievements fetched successfully for user ${userId}: ${achievements.length} achievement(s)`);

      res.json({ achievements, stats });
    } catch (error) {
      console.error('❌ Error fetching achievements:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('User ID:', userId);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to fetch achievements' });
      }
    }
  });

  router.get('/progress', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;

      // Get total rankable products count for dynamic milestones
      const { products } = await services.fetchAllShopifyProducts();
      const totalRankableProducts = products.length;

      const progress = await progressTracker.getUserProgress(userId, totalRankableProducts);
      const insights = await progressTracker.getUserInsights(userId);

      res.json({ progress, insights });
    } catch (error) {
      console.error('Error fetching progress:', error);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  });

  router.get('/leaderboard', async (req, res) => {
    try {
      const { period = 'all_time', limit = 50 } = req.query;
      const leaderboard = await leaderboardManager.getTopRankers(parseInt(limit), period);

      // Format user display names with CommunityService (last name truncation)
      const formattedLeaderboard = leaderboard.map(entry => ({
        ...entry,
        displayName: communityService.formatDisplayName(entry)
      }));

      res.json({ leaderboard: formattedLeaderboard, period });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  router.get('/leaderboard/position', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      const { period = 'all_time' } = req.query;
      const position = await leaderboardManager.getUserPosition(userId, period);

      res.json(position);
    } catch (error) {
      console.error('Error fetching position:', error);
      res.status(500).json({ error: 'Failed to fetch position' });
    }
  });

  router.get('/ranking-progress-commentary', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      
      // Get total rankable products count
      const totalRankableProducts = services.getRankableProductCount();

      // Generate ranking progress commentary
      const commentary = await commentaryService.generateRankingProgressMessage(userId, totalRankableProducts);

      res.json(commentary);
    } catch (error) {
      console.error('Error generating ranking progress commentary:', error);
      res.status(500).json({ error: 'Failed to generate commentary' });
    }
  });

  router.get('/collection-progress', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      
      // Get context from query (defaults to 'available_products')
      const context = req.query.context || 'available_products';
      
      // Get total rankable products count
      const totalRankableProducts = services.getRankableProductCount();

      // Generate collection progress message (REUSABLE for different contexts)
      const progress = await commentaryService.generateCollectionProgressMessage(userId, context, totalRankableProducts);

      res.json(progress);
    } catch (error) {
      console.error('Error generating collection progress:', error);
      res.status(500).json({ error: 'Failed to generate collection progress' });
    }
  });

  router.get('/activity-feed', async (req, res) => {
    try {
      const { limit = 50, type } = req.query;
      
      let activities;
      if (type) {
        activities = await activityLogRepo.getActivityByType(type, parseInt(limit));
      } else {
        activities = await activityLogRepo.getRecentActivity(parseInt(limit));
      }

      res.json({ activities });
    } catch (error) {
      console.error('Error fetching activity feed:', error);
      res.status(500).json({ error: 'Failed to fetch activity feed' });
    }
  });

  router.get('/streaks', async (req, res) => {
    let userId = null;
    try {
      console.log('🔍 Streaks endpoint called');
      
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        console.log('⚠️ Streaks request without session_id cookie');
        return res.status(401).json({ error: 'Not authenticated' });
      }
      console.log(`🔑 Session ID present: ${sessionId.substring(0, 8)}...`);

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        console.log('⚠️ Invalid session for streaks request:', sessionId);
        return res.status(401).json({ error: 'Invalid session' });
      }
      console.log(`✅ Session validated for user ${session.userId}`);

      userId = session.userId;
      console.log(`📊 Fetching streaks for user ${userId}`);
      
      let streaks = [];
      try {
        streaks = await streakManager.getUserStreaks(userId);
        console.log(`✅ Database query completed: ${streaks ? streaks.length : 0} streak(s) found`);
      } catch (dbError) {
        console.error('❌ Database error in getUserStreaks:', dbError);
        console.error('DB Error stack:', dbError.stack);
        throw dbError;
      }
      
      console.log(`✅ Streaks fetched successfully for user ${userId}: ${streaks.length} streak(s)`);
      res.json({ streaks: streaks || [] });
    } catch (error) {
      console.error('❌ Error fetching streaks:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('User ID:', userId);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to fetch streaks' });
      }
    }
  });

  router.post('/streaks/update', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      const { streakType = 'daily_rank' } = req.body;
      
      // CRITICAL: Validate streak type to prevent database corruption
      const { VALID_STREAK_TYPES } = require('../../shared/constants');
      if (!VALID_STREAK_TYPES.includes(streakType)) {
        console.warn(`⚠️ Invalid streak type rejected: "${streakType}" from user ${userId}`);
        return res.status(400).json({ error: 'Invalid streak type' });
      }
      
      const streakUpdate = await streakManager.updateStreak(userId, streakType);

      if (services.io) {
        const { getRoomName } = require('../websocket/gateway');
        services.io.to(getRoomName(`user:${userId}`)).emit('streak:updated', streakUpdate);
      }

      res.json({ streak: streakUpdate });
    } catch (error) {
      console.error('Error updating streak:', error);
      res.status(500).json({ error: 'Failed to update streak' });
    }
  });

  router.post('/product-view', async (req, res) => {
    try {
      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
      }

      let userId = null;
      const sessionId = req.cookies.session_id;
      if (sessionId) {
        const session = await services.storage.getSession(sessionId);
        if (session) {
          userId = session.userId;
        }
      }

      await productViewRepo.logView(productId, userId);

      const viewCount = await productViewRepo.getViewCount(productId, 24);

      if (services.io) {
        services.io.emit('product:viewed', {
          productId,
          viewCount,
        });
      }

      res.json({ success: true, viewCount });
    } catch (error) {
      console.error('Error logging product view:', error);
      res.status(500).json({ error: 'Failed to log view' });
    }
  });

  router.get('/trending-products', async (req, res) => {
    try {
      const { limit = 10, hours = 24 } = req.query;
      const trending = await productViewRepo.getTrendingProducts(
        parseInt(limit),
        parseInt(hours)
      );

      res.json({ trending });
    } catch (error) {
      console.error('Error fetching trending products:', error);
      res.status(500).json({ error: 'Failed to fetch trending products' });
    }
  });

  router.get('/user/compare/:userId', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      const targetUserId = parseInt(req.params.userId);
      const comparison = await leaderboardManager.compareUsers(userId, targetUserId);

      res.json(comparison);
    } catch (error) {
      console.error('Error comparing users:', error);
      res.status(500).json({ error: 'Failed to compare users' });
    }
  });

  // Public endpoint: Get achievements for a specific user (optimized - earned only)
  router.get('/user/:userId/achievements', async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.userId);
      
      if (!targetUserId || isNaN(targetUserId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      console.log(`📊 Fetching public achievements for user ${targetUserId} (earned only)`);

      // For public viewing, only return already-earned achievements from database
      // No need to calculate current stats/progress - just show what they've achieved
      const achievementRepo = services.achievementRepo;
      const earnedAchievements = await achievementRepo.getUserAchievements(targetUserId);

      console.log(`✅ Public achievements fetched for user ${targetUserId}: ${earnedAchievements.length} earned`);

      res.json({ achievements: earnedAchievements });
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      res.status(500).json({ error: 'Failed to fetch user achievements' });
    }
  });

  // Home page statistics
  router.get('/home-stats', async (req, res) => {
    try {
      const stats = await homeStatsService.getAllHomeStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching home stats:', error);
      res.status(500).json({ error: 'Failed to fetch home stats' });
    }
  });

  // Hero dashboard statistics (lightweight version)
  router.get('/hero-stats', async (req, res) => {
    try {
      const stats = await homeStatsService.getHeroDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching hero stats:', error);
      res.status(500).json({ error: 'Failed to fetch hero stats' });
    }
  });

  // Track page view (async, fire-and-forget)
  router.post('/track-view', async (req, res) => {
    try {
      const { pageType, pageIdentifier, referrer } = req.body;

      if (!pageType) {
        return res.status(400).json({ error: 'pageType is required' });
      }

      // Get user ID from session (optional - allow anonymous tracking)
      let userId = null;
      const sessionId = req.cookies.session_id;
      if (sessionId) {
        const session = await services.storage.getSession(sessionId);
        if (session) {
          userId = session.userId;
        }
      }

      // Track asynchronously (fire and forget)
      services.pageViewService.trackPageViewAsync({
        userId,
        pageType,
        pageIdentifier,
        referrer,
      });

      // Respond immediately without waiting
      res.status(202).json({ success: true, message: 'View tracked' });
    } catch (error) {
      console.error('Error tracking page view:', error);
      // Still return success - tracking failures shouldn't block user
      res.status(202).json({ success: true, message: 'View tracking queued' });
    }
  });

  // Get user's flavor coins
  router.get('/flavor-coins', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      const flavorCoins = await services.flavorCoinManager.getUserFlavorCoins(userId);
      
      res.json({ flavorCoins });
    } catch (error) {
      console.error('Error fetching flavor coins:', error);
      res.status(500).json({ error: 'Failed to fetch flavor coins' });
    }
  });

  // Get collections progress
  router.get('/collections-progress', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      
      // Get all achievements
      const allAchievements = await services.achievementRepo.getAllAchievements();
      
      // Get user's earned achievements to filter hidden ones
      const userAchievements = await services.achievementRepo.getUserAchievements(userId);
      const earnedIds = new Set(userAchievements.map(a => a.achievementId));
      
      // Filter out hidden achievements that haven't been earned
      const achievements = allAchievements.filter(achievement => {
        const isHidden = achievement.isHidden === 1 || achievement.collectionType === 'hidden_collection';
        return !isHidden || earnedIds.has(achievement.id);
      });
      
      // Get user progress for collections
      const userProgress = {};
      
      for (const achievement of achievements) {
        if (achievement.collectionType === 'dynamic_collection' && achievement.proteinCategory) {
          const progress = await services.collectionManager.getCollectionProgress(
            userId,
            achievement.proteinCategory
          );
          userProgress[achievement.proteinCategory] = progress;
        }
        
        // For static and hidden achievements, check if user has earned them
        const hasAchievement = await services.achievementRepo.hasAchievement(userId, achievement.id);
        userProgress[achievement.id] = {
          completed: hasAchievement,
          unlocked: hasAchievement,
          percentage: hasAchievement ? 100 : 0
        };
      }
      
      res.json({ achievements, userProgress });
    } catch (error) {
      console.error('Error fetching collections progress:', error);
      res.status(500).json({ error: 'Failed to fetch collections progress' });
    }
  });

  // Get detail data for a specific achievement (for detail page)
  // Accepts achievement code (slug) or ID for backward compatibility
  router.get('/achievement/:code/products', async (req, res) => {
    try {
      const codeOrId = req.params.code;
      
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;

      // Get achievement details from all achievements (cached)
      const allAchievements = await services.achievementRepo.getAllAchievements();
      
      // Try to find by code first (new format: #coins/be_curious)
      let achievement = allAchievements.find(a => a.code === codeOrId);
      
      // If not found and parameter is numeric, try to find by ID (legacy format: #achievement/6474)
      if (!achievement && !isNaN(codeOrId)) {
        const achievementId = parseInt(codeOrId);
        achievement = allAchievements.find(a => a.id === achievementId);
      }
      
      if (!achievement) {
        return res.status(404).json({ error: 'Achievement not found' });
      }

      // Check if achievement is hidden and user hasn't earned it
      const isHidden = achievement.isHidden === 1 || achievement.collectionType === 'hidden_collection';
      if (isHidden) {
        const hasEarned = await services.achievementRepo.hasAchievement(userId, achievement.id);
        if (!hasEarned) {
          return res.status(404).json({ error: 'Achievement not found' });
        }
      }

      const { COLLECTION_TYPES } = require('../../shared/constants/collectionTypes');
      
      // Check if this is an engagement achievement
      // Support both new format (collectionType = 'engagement_collection') and legacy format (requirement type indicates engagement)
      const engagementRequirementTypes = ['search_count', 'page_view_count', 'product_view_count', 'unique_product_view_count', 
                                          'profile_view_count', 'unique_profile_view_count', 'streak_days', 'daily_login_streak'];
      const isEngagementAchievement = achievement.collectionType === COLLECTION_TYPES.ENGAGEMENT ||
                                      (achievement.collectionType === COLLECTION_TYPES.LEGACY && 
                                       engagementRequirementTypes.includes(achievement.requirement?.type));

      // Engagement achievements: Return progress data instead of products
      if (isEngagementAchievement) {
        // Get user's achievement record
        const { userAchievements } = require('../../shared/schema');
        const { eq, and } = require('drizzle-orm');
        const userAchievementResult = await services.db.select()
          .from(userAchievements)
          .where(and(
            eq(userAchievements.userId, userId),
            eq(userAchievements.achievementId, achievement.id)
          ))
          .limit(1);
        const userAchievement = userAchievementResult[0] || null;
        
        // Calculate current progress
        const requirementType = achievement.requirement?.type;
        const requirementValue = achievement.requirement?.value || achievement.requirement?.days || 1;
        
        // Fetch user stats based on requirement type
        let currentValue = 0;
        if (requirementType === 'search_count') {
          // Use EngagementManager to get search count
          const searchData = await services.engagementManager.calculateSearchEngagement(userId);
          currentValue = searchData.totalSearches;
        } else if (requirementType === 'page_view_count') {
          const pageViewData = await services.engagementManager.calculatePageViewEngagement(userId);
          currentValue = pageViewData.totalPageViews;
        } else if (requirementType === 'product_view_count') {
          const productViewData = await services.engagementManager.calculateProductViewEngagement(userId, false);
          currentValue = productViewData.totalProductViews;
        } else if (requirementType === 'unique_product_view_count') {
          const productViewData = await services.engagementManager.calculateProductViewEngagement(userId, true);
          currentValue = productViewData.uniqueProductViews;
        } else if (requirementType === 'profile_view_count') {
          const profileViewData = await services.engagementManager.calculateProfileViewEngagement(userId, false);
          currentValue = profileViewData.totalProfileViews;
        } else if (requirementType === 'unique_profile_view_count') {
          const profileViewData = await services.engagementManager.calculateProfileViewEngagement(userId, true);
          currentValue = profileViewData.uniqueProfileViews;
        } else if (requirementType === 'streak_days' || requirementType === 'daily_login_streak') {
          const streakData = await services.streakTracker.getCurrentStreak(userId);
          currentValue = requirementType === 'daily_login_streak' ? streakData.loginStreak : streakData.currentStreak;
        }

        const percentage = Math.min(Math.round((currentValue / requirementValue) * 100), 100);
        
        return res.json({
          achievement: {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            iconType: achievement.iconType,
            collectionType: achievement.collectionType,
            hasTiers: achievement.hasTiers,
            tierThresholds: achievement.tierThresholds,
            points: achievement.points
          },
          type: 'engagement',
          progress: {
            currentValue,
            requiredValue: requirementValue,
            percentage,
            currentTier: userAchievement?.currentTier || null,
            pointsEarned: userAchievement?.pointsAwarded || 0,
            requirementType,
            requirementLabel: getRequirementLabel(requirementType)
          },
          stats: {
            percentage,
            earned: userAchievement !== null
          }
        });
      }

      // Product-based achievements: Return products
      const allEnrichedProducts = await services.productsService.getAllProducts();
      
      // Get all products for this achievement based on its type
      let productIds = [];
      
      if (achievement.collectionType === COLLECTION_TYPES.STATIC ||
          achievement.collectionType === COLLECTION_TYPES.FLAVOR_COIN ||
          achievement.collectionType === 'custom_product_list') { // Legacy support
        // Static collection or flavor coin - get specific products from requirement
        // ProductsService returns IDs as strings, so ensure achievement IDs are strings too
        productIds = (achievement.requirement.productIds || []).map(id => String(id));
      } else if (achievement.collectionType === 'dynamic_collection') {
        // Dynamic collection - filter products by categories
        const categories = achievement.requirement?.categories || [];
        if (categories.length > 0) {
          const categoryProducts = allEnrichedProducts.filter(product => {
            const productCategories = product.tags?.split(',').map(t => t.trim().toLowerCase()) || [];
            return categories.some(cat => 
              productCategories.includes(cat.toLowerCase())
            );
          });
          productIds = categoryProducts.map(p => p.id);
        }
      }

      // Get user info to determine if employee
      const user = await services.storage.getUserById(userId);
      const isEmployee = user?.role === 'employee_admin' || user?.email?.endsWith('@jerky.com');
      
      // Get user's ranked product IDs to mark which are ranked
      const rankedProductIds = await ProductRankingRepository.getRankedProductIdsByUser(userId, 'default');
      const rankedSet = new Set(rankedProductIds);
      
      // Get user's purchased product IDs to determine which can be ranked (non-employees only)
      let purchasedSet = new Set();
      if (!isEmployee && services.purchaseHistoryService) {
        const purchasedProductIds = await services.purchaseHistoryService.getPurchasedProductIds(userId);
        purchasedSet = new Set(purchasedProductIds);
      }

      // Map ALL products in achievement with isRanked AND isRankable status (collection book view)
      const products = productIds
        .map(productId => {
          const product = allEnrichedProducts.find(p => p.id === productId);
          if (!product) {
            return null;
          }
          
          const isRanked = rankedSet.has(product.id);
          
          // Product is rankable if:
          // - User is an employee (can rank anything), OR
          // - User has purchased this product
          const isRankable = isEmployee || purchasedSet.has(product.id);
          
          return {
            id: product.id,
            title: product.title,
            image: product.image,
            price: product.price,
            handle: product.handle,
            isRanked: isRanked, // Mark if user has ranked this product
            isRankable: isRankable // Mark if user CAN rank this product (has purchased or is employee)
          };
        })
        .filter(p => p !== null);

      const totalProducts = products.length;
      const rankedCount = products.filter(p => p.isRanked).length;
      const unrankedCount = products.filter(p => !p.isRanked).length;
      const percentage = totalProducts > 0 ? Math.round((rankedCount / totalProducts) * 100) : 0;

      // Get user's achievement record for tier info
      const { userAchievements } = require('../../shared/schema');
      const { eq, and } = require('drizzle-orm');
      const userAchievementResult = await services.db.select()
        .from(userAchievements)
        .where(and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievement.id)
        ))
        .limit(1);
      const userAchievement = userAchievementResult[0] || null;

      // Add metadata specific to each collection type
      const metadata = {};
      
      if (achievement.collectionType === 'dynamic_collection') {
        // Dynamic collection: Add animal category info
        const categories = achievement.requirement?.categories || [];
        metadata.animalCategories = categories;
        metadata.currentTier = userAchievement?.currentTier || null;
        metadata.requirementType = achievement.requirement?.type;
      } else if (achievement.collectionType === COLLECTION_TYPES.FLAVOR_COIN) {
        // Flavor coin: Add single product spotlight info
        metadata.isSingleProduct = true;
        if (products.length > 0) {
          const product = allEnrichedProducts.find(p => p.id === products[0].id);
          if (product) {
            metadata.productDetails = {
              vendor: product.vendor,
              tags: product.tags,
              productType: product.productType
            };
          }
        }
      } else if (achievement.collectionType === 'hidden_collection') {
        // Hidden collection: Add mystery/locked state
        metadata.isHidden = true;
        metadata.isUnlocked = userAchievement !== null;
      } else if (achievement.collectionType === COLLECTION_TYPES.STATIC) {
        // Static collection: Add category theme and analyze products for commentary
        metadata.theme = achievement.category;
        
        // Analyze collection products to extract themes for smart commentary
        const productAnalysis = analyzeCollectionProducts(productIds, allEnrichedProducts);
        metadata.productAnalysis = productAnalysis;
        
        // Count rankable products for commentary generation
        const rankableCount = products.filter(p => p.isRankable).length;
        metadata.rankableCount = rankableCount;
        metadata.unrankableCount = totalProducts - rankableCount;
      }

      res.json({
        achievement: {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          iconType: achievement.iconType,
          collectionType: achievement.collectionType,
          hasTiers: achievement.hasTiers,
          tierThresholds: achievement.tierThresholds,
          points: achievement.points,
          category: achievement.category
        },
        type: 'collection',
        products,
        stats: {
          total: totalProducts,
          ranked: rankedCount,
          unranked: unrankedCount,
          percentage: percentage,
          earned: userAchievement !== null,
          currentTier: userAchievement?.currentTier || null,
          pointsEarned: userAchievement?.pointsAwarded || 0
        },
        metadata
      });
    } catch (error) {
      console.error('❌ Error fetching achievement products:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to fetch achievement products' });
    }
  });

  // Helper function to analyze collection products and extract themes
  function analyzeCollectionProducts(productIds, allEnrichedProducts) {
    const collectionProducts = productIds
      .map(id => allEnrichedProducts.find(p => p.id === id))
      .filter(p => p);
    
    if (collectionProducts.length === 0) {
      return {};
    }
    
    // Extract all tags from products (lowercased for consistency)
    const allTags = collectionProducts
      .flatMap(p => p.tags || [])
      .map(tag => tag.toLowerCase());
    
    // Count tag frequency
    const tagFrequency = {};
    allTags.forEach(tag => {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });
    
    // Get most common tags (appearing in at least 30% of products)
    const threshold = Math.ceil(collectionProducts.length * 0.3);
    const commonTags = Object.entries(tagFrequency)
      .filter(([_, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, _]) => tag);
    
    // Detect flavor profiles from tags and titles
    const flavorKeywords = {
      hot: ['hot', 'spicy', 'fire', 'jalapeno', 'habanero', 'ghost pepper', 'carolina reaper'],
      sweet: ['sweet', 'honey', 'maple', 'brown sugar', 'teriyaki'],
      savory: ['original', 'classic', 'traditional', 'peppered', 'cracked pepper'],
      exotic: ['exotic', 'unique', 'special', 'wild']
    };
    
    const detectedFlavors = [];
    for (const [flavor, keywords] of Object.entries(flavorKeywords)) {
      const hasKeyword = allTags.some(tag => keywords.some(keyword => tag.includes(keyword))) ||
        collectionProducts.some(p => keywords.some(keyword => p.title.toLowerCase().includes(keyword)));
      if (hasKeyword) {
        detectedFlavors.push(flavor);
      }
    }
    
    // Detect animal types from titles and product types
    const animalTypes = {};
    const animalKeywords = {
      beef: ['beef', 'brisket', 'steak'],
      turkey: ['turkey'],
      pork: ['pork', 'bacon'],
      chicken: ['chicken'],
      bison: ['bison', 'buffalo'],
      venison: ['venison', 'deer'],
      elk: ['elk'],
      exotic: ['alligator', 'kangaroo', 'ostrich', 'wild boar', 'salmon']
    };
    
    for (const [animal, keywords] of Object.entries(animalKeywords)) {
      const count = collectionProducts.filter(p => 
        keywords.some(keyword => 
          p.title.toLowerCase().includes(keyword) || 
          (p.productType && p.productType.toLowerCase().includes(keyword))
        )
      ).length;
      if (count > 0) {
        animalTypes[animal] = count;
      }
    }
    
    // Get unique vendors
    const vendors = [...new Set(collectionProducts.map(p => p.vendor).filter(Boolean))];
    
    return {
      commonTags,
      flavorProfiles: detectedFlavors,
      animalTypes,
      vendors,
      totalProducts: collectionProducts.length
    };
  }

  // Helper function to get user-friendly labels for requirement types
  function getRequirementLabel(requirementType) {
    const labels = {
      'search_count': 'Searches',
      'page_view_count': 'Page Views',
      'streak_days': 'Streak Days',
      'daily_login_streak': 'Login Streak Days',
      'product_view_count': 'Product Views',
      'unique_product_view_count': 'Unique Products Viewed',
      'profile_view_count': 'Profile Views',
      'unique_profile_view_count': 'Unique Profiles Viewed'
    };
    return labels[requirementType] || requirementType;
  }

  return router;
}

module.exports = createGamificationRoutes;
