/**
 * Gamification System Initialization
 * Wires together repositories, services, routes, and WebSocket gateway
 */

const AchievementRepository = require('../repositories/AchievementRepository');
const StreakRepository = require('../repositories/StreakRepository');
const ActivityLogRepository = require('../repositories/ActivityLogRepository');
const ProductViewRepository = require('../repositories/ProductViewRepository');
const ProductsMetadataRepository = require('../repositories/ProductsMetadataRepository');

const EngagementManager = require('../services/EngagementManager');
const StreakManager = require('../services/StreakManager');
const LeaderboardManager = require('../services/LeaderboardManager');
const ProgressTracker = require('../services/ProgressTracker');
const HomeStatsService = require('../services/HomeStatsService');
const CommunityService = require('../services/CommunityService');
const PageViewService = require('../services/PageViewService');
const UserStatsAggregator = require('../services/UserStatsAggregator');
const CacheWarmer = require('../services/CacheWarmer');
const CollectionManager = require('../services/CollectionManager');
const RecentAchievementTracker = require('../services/RecentAchievementTracker');
const CommentaryService = require('../services/CommentaryService');
const ActivityTrackingService = require('../services/ActivityTrackingService');
const UserClassificationService = require('../services/UserClassificationService');
const FlavorProfileCommunityService = require('../services/FlavorProfileCommunityService');
const PersonalizedGuidanceService = require('../services/PersonalizedGuidanceService');
const ClassificationQueue = require('../services/ClassificationQueue');
const ClassificationWorker = require('../services/ClassificationWorker');
const BulkImportQueue = require('../services/BulkImportQueue');
const BulkImportWorker = require('../services/BulkImportWorker');

const HomeStatsCache = require('../cache/HomeStatsCache');

const createGamificationRoutes = require('../routes/gamification');
const createCommunityRoutes = require('../routes/community');
const createFlavorProfileCommunitiesRoutes = require('../routes/flavorProfileCommunities');
const WebSocketGateway = require('../websocket/gateway');

const { primaryDb } = require('../db-primary');

async function initializeGamification(app, io, db, storage, fetchAllShopifyProducts, getRankableProductCount, productsService = null, rateLimiters = null, purchaseHistoryService = null) {
  console.log('🎮 Initializing gamification system...');

  const achievementRepo = new AchievementRepository(db);
  const streakRepo = new StreakRepository(db);
  const activityLogRepo = new ActivityLogRepository(db);
  const productViewRepo = new ProductViewRepository(db);
  const productsMetadataRepo = new ProductsMetadataRepository(db);

  // Initialize cache instances
  const homeStatsCache = HomeStatsCache.getInstance();

  const communityService = new CommunityService(db);
  const engagementManager = new EngagementManager(achievementRepo, activityLogRepo, primaryDb);
  const streakManager = new StreakManager(streakRepo, activityLogRepo);
  const leaderboardManager = new LeaderboardManager(db);
  const collectionManager = new CollectionManager(achievementRepo, productsMetadataRepo, primaryDb, productsService);
  const progressTracker = new ProgressTracker(achievementRepo, streakRepo, db, collectionManager, engagementManager);
  const pageViewService = new PageViewService(db, productViewRepo);
  const homeStatsService = new HomeStatsService(db, leaderboardManager, activityLogRepo, productViewRepo, communityService, homeStatsCache);
  const userStatsAggregator = new UserStatsAggregator(leaderboardManager, streakManager, productsService);
  const recentAchievementTracker = RecentAchievementTracker;
  const commentaryService = new CommentaryService({ db, progressTracker, engagementManager, streakManager, achievementRepo });
  const activityTrackingService = ActivityTrackingService; // Singleton instance
  const userClassificationService = UserClassificationService; // Singleton instance
  const flavorProfileCommunityService = FlavorProfileCommunityService; // Singleton instance
  
  // PersonalizedGuidanceService with dependency injection
  const personalizedGuidanceService = new PersonalizedGuidanceService(progressTracker, userStatsAggregator);

  // Initialize RecentAchievementTracker for duplicate toast prevention
  await recentAchievementTracker.initialize();
  
  // Initialize ClassificationQueue (BullMQ with Redis)
  const classificationQueue = ClassificationQueue; // Singleton instance
  await classificationQueue.initialize();
  
  // Inject classification queue into ActivityTrackingService
  activityTrackingService.setClassificationQueue(classificationQueue);

  const services = {
    db,
    storage,
    achievementRepo,
    streakRepo,
    activityLogRepo,
    productViewRepo,
    productsMetadataRepo,
    communityService,
    engagementManager,
    streakManager,
    leaderboardManager,
    progressTracker,
    pageViewService,
    homeStatsService,
    userStatsAggregator,
    collectionManager,
    recentAchievementTracker,
    commentaryService,
    activityTrackingService,
    userClassificationService,
    flavorProfileCommunityService,
    personalizedGuidanceService,
    classificationQueue,
    fetchAllShopifyProducts,
    getRankableProductCount,
    productsService,
    purchaseHistoryService,
    io,
  };

  const gamificationRouter = createGamificationRoutes(services);
  const communityRouter = createCommunityRoutes(services);
  const flavorProfileCommunitiesRouter = createFlavorProfileCommunitiesRoutes(services);
  
  // Apply rate limiting middleware if provided
  if (rateLimiters) {
    app.use('/api/gamification', rateLimiters.apiLimiter, gamificationRouter);
    app.use('/api/community', rateLimiters.apiLimiter, communityRouter);
    app.use('/api/flavor-profile-communities', rateLimiters.apiLimiter, flavorProfileCommunitiesRouter);
  } else {
    app.use('/api/gamification', gamificationRouter);
    app.use('/api/community', communityRouter);
    app.use('/api/flavor-profile-communities', flavorProfileCommunitiesRouter);
  }
  console.log('✅ Gamification routes registered at /api/gamification');
  console.log('✅ Community routes registered at /api/community');
  console.log('✅ Flavor profile communities routes registered at /api/flavor-profile-communities');

  const wsGateway = new WebSocketGateway(io, services);
  console.log('✅ WebSocket gateway initialized');

  services.wsGateway = wsGateway;
  
  // Initialize ClassificationWorker (BullMQ background processor)
  const classificationWorker = new ClassificationWorker({
    userClassificationService,
    personalizedGuidanceService,
    getRankableProductCount,
    wsGateway  // Add WebSocket gateway for real-time queue stats broadcasting
  });
  await classificationWorker.initialize();
  
  services.classificationWorker = classificationWorker;
  
  // Initialize BulkImportQueue (BullMQ with Redis)
  const bulkImportQueue = BulkImportQueue; // Singleton instance
  await bulkImportQueue.initialize();
  
  // Initialize BulkImportWorker (BullMQ background processor)
  const bulkImportWorker = BulkImportWorker; // Singleton instance
  await bulkImportWorker.initialize(services);
  
  services.bulkImportQueue = bulkImportQueue;
  services.bulkImportWorker = bulkImportWorker;

  // Seed achievements (this also warms AchievementCache)
  engagementManager.seedAchievements().then(() => {
    console.log('✅ Achievements seeded');
  }).catch(err => {
    console.error('❌ Failed to seed achievements:', err);
  });

  // Initialize cache warmer and register global caches
  const cacheWarmer = new CacheWarmer();
  
  // Register HomeStatsCache warming
  cacheWarmer.register('HomeStatsCache', async () => {
    await homeStatsService.getAllHomeStats();
  });
  
  // Register LeaderboardCache warming (top 5 for home/community, top 50 for leaderboard page)
  cacheWarmer.register('LeaderboardCache', async () => {
    // Warm top 5 for home/community pages
    await leaderboardManager.getTopRankers(5, 'all_time');
    
    // Warm top 50 for dedicated leaderboard page
    const leaderboard = await leaderboardManager.getTopRankers(50, 'all_time');
    
    // Format user display names
    const formatted = leaderboard.map(entry => ({
      ...entry,
      displayName: communityService.formatDisplayName(entry)
    }));
    return formatted;
  });

  // Register ProductsCache warming with metadata sync and cleanup
  // This ensures products and metadata are synchronized on every server startup
  if (productsService) {
    cacheWarmer.register('ProductsCache', async () => {
      // getAllProducts with includeMetadata=true will:
      // 1. Fetch fresh products from Shopify if cache is invalid
      // 2. Sync metadata for all current products
      // 3. Clean up orphaned products no longer tagged as "rankable"
      const products = await productsService.getAllProducts({
        includeMetadata: true
      });
      console.log(`🏷️ Products cache warmed and metadata synchronized: ${products.length} products`);
      return products;
    });
  }

  // Warm all caches asynchronously (non-blocking)
  // This runs in background after server starts accepting requests
  setImmediate(() => {
    cacheWarmer.warmAllAsync();
  });

  console.log('🎮 Gamification system initialized successfully');

  return services;
}

module.exports = initializeGamification;
