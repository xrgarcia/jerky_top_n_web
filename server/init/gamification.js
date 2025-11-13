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
const BulkImportService = require('../services/BulkImportService');
const EngagementBackfillQueue = require('../services/EngagementBackfillQueue');
const EngagementBackfillWorker = require('../services/EngagementBackfillWorker');
const WebhookQueue = require('../services/WebhookQueue');
const WebhookWorker = require('../services/WebhookWorker');

const HomeStatsCache = require('../cache/HomeStatsCache');

const createGamificationRoutes = require('../routes/gamification');
const createCommunityRoutes = require('../routes/community');
const createFlavorProfileCommunitiesRoutes = require('../routes/flavorProfileCommunities');
const createProfileRoutes = require('../routes/profile');
const healthRouter = require('../routes/health');
const WebSocketGateway = require('../websocket/gateway');

const { primaryDb, ensureDatabaseReady } = require('../db-primary');
const Sentry = require('@sentry/node');

async function initializeGamification(app, io, db, storage, fetchAllShopifyProducts, getRankableProductCount, productsService = null, rateLimiters = null, purchaseHistoryService = null) {
  console.log('🎮 Initializing gamification system...');

  // Ensure both database instances are query-ready before proceeding
  // This prevents cold-start errors on Neon Serverless
  // Warm both the primary DB and the injected pooled DB
  let isColdStart = false;
  
  try {
    const [primaryWarmup, pooledWarmup] = await Promise.all([
      ensureDatabaseReady(primaryDb),
      ensureDatabaseReady(db)
    ]);
    
    // Detect cold start from warmup metadata
    // A cold start is when warmup took >1s or required multiple attempts
    isColdStart = primaryWarmup.isColdStart || pooledWarmup.isColdStart;
    
    console.log('✅ Database instances warmed and ready for queries');
    
    if (isColdStart) {
      console.log('🧊 Cold start detected - cache warming will use sequential strategy');
    }
  } catch (error) {
    console.warn('⚠️ Database warmup failed during initialization, but proceeding anyway');
    console.warn(`   Warmup error: ${error.message}`);
    
    // Assume cold start if warmup failed
    isColdStart = true;
    
    // Log to Sentry as warning (not error) since this doesn't break functionality
    Sentry.captureException(error, {
      level: 'warning',
      tags: {
        service: 'gamification',
        operation: 'database_warmup'
      },
      extra: {
        errorMessage: error.message,
        context: 'Database warmup failed but initialization continuing - connections will be established on first query'
      }
    });
    
    // Continue with initialization - database connections will be established when first used
  }

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
  const leaderboardManager = new LeaderboardManager(db, communityService);
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
  const profileRouter = createProfileRoutes(services);
  
  // Apply rate limiting middleware if provided
  if (rateLimiters) {
    app.use('/api/gamification', rateLimiters.apiLimiter, gamificationRouter);
    app.use('/api/community', rateLimiters.apiLimiter, communityRouter);
    app.use('/api/flavor-profile-communities', rateLimiters.apiLimiter, flavorProfileCommunitiesRouter);
    app.use('/api/profile', rateLimiters.apiLimiter, profileRouter);
  } else {
    app.use('/api/gamification', gamificationRouter);
    app.use('/api/community', communityRouter);
    app.use('/api/flavor-profile-communities', flavorProfileCommunitiesRouter);
    app.use('/api/profile', profileRouter);
  }
  
  // Health check endpoints (no rate limiting)
  app.use('/api/health', healthRouter);
  
  console.log('✅ Gamification routes registered at /api/gamification');
  console.log('✅ Community routes registered at /api/community');
  console.log('✅ Flavor profile communities routes registered at /api/flavor-profile-communities');
  console.log('✅ Profile routes registered at /api/profile');
  console.log('✅ Health check routes registered at /api/health');

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
  
  // Initialize BulkImportService with WebSocket gateway and classification queue
  const bulkImportService = BulkImportService; // Singleton instance
  bulkImportService.initialize(wsGateway, classificationQueue);
  
  // Initialize BulkImportWorker (BullMQ background processor)
  const bulkImportWorker = BulkImportWorker; // Singleton instance
  await bulkImportWorker.initialize(services);
  
  services.bulkImportQueue = bulkImportQueue;
  services.bulkImportService = bulkImportService;
  services.bulkImportWorker = bulkImportWorker;
  
  // Initialize EngagementBackfillQueue (BullMQ with Redis)
  const engagementBackfillQueue = EngagementBackfillQueue; // Singleton instance
  await engagementBackfillQueue.initialize();
  
  // Initialize EngagementBackfillWorker (BullMQ background processor)
  const engagementBackfillWorker = EngagementBackfillWorker; // Singleton instance
  await engagementBackfillWorker.initialize(services);
  
  services.engagementBackfillQueue = engagementBackfillQueue;
  services.engagementBackfillWorker = engagementBackfillWorker;
  
  // Initialize WebhookQueue (BullMQ with Redis for Shopify webhooks)
  const webhookQueue = WebhookQueue; // Singleton instance
  await webhookQueue.initialize();
  
  // Initialize WebhookWorker (BullMQ background processor for all 3 webhook types)
  const webhookWorker = WebhookWorker; // Singleton instance
  await webhookWorker.initialize({
    orderService: null, // Will be set when webhook routes are created
    productService: null, // Will be set when webhook routes are created
    customerService: null, // Will be set when webhook routes are created
    purchaseHistoryService,
    rankingStatsCache: null, // Will be set when webhook routes are created
    metadataCache: null, // Will be set when webhook routes are created
    classificationQueue,
  });
  
  services.webhookQueue = webhookQueue;
  services.webhookWorker = webhookWorker;

  // Seed achievements with retry logic (this also warms AchievementCache)
  // Using fire-and-forget pattern with proper error handling
  engagementManager.seedAchievements().then(() => {
    console.log('✅ Achievements seeded');
  }).catch(err => {
    console.error('❌ Failed to seed achievements:', err.message);
    
    // Send to Sentry for monitoring
    const Sentry = require('@sentry/node');
    Sentry.captureException(err, {
      level: 'error',
      tags: {
        service: 'gamification',
        operation: 'achievement_seeding'
      },
      extra: {
        errorMessage: err.message,
        stackTrace: err.stack
      }
    });
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
  // Uses adaptive strategy based on cold-start detection
  setImmediate(() => {
    cacheWarmer.warmAllAsync({ isColdStart });
  });

  console.log('🎮 Gamification system initialized successfully');

  return services;
}

module.exports = initializeGamification;
