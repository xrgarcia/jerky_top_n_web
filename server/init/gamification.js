/**
 * Gamification System Initialization
 * Wires together repositories, services, routes, and WebSocket gateway
 */

const AchievementRepository = require('../repositories/AchievementRepository');
const StreakRepository = require('../repositories/StreakRepository');
const ActivityLogRepository = require('../repositories/ActivityLogRepository');
const ProductViewRepository = require('../repositories/ProductViewRepository');
const FlavorCoinRepository = require('../repositories/FlavorCoinRepository');
const ProductsMetadataRepository = require('../repositories/ProductsMetadataRepository');

const AchievementManager = require('../services/AchievementManager');
const StreakManager = require('../services/StreakManager');
const LeaderboardManager = require('../services/LeaderboardManager');
const ProgressTracker = require('../services/ProgressTracker');
const HomeStatsService = require('../services/HomeStatsService');
const CommunityService = require('../services/CommunityService');
const PageViewService = require('../services/PageViewService');
const UserStatsAggregator = require('../services/UserStatsAggregator');
const CacheWarmer = require('../services/CacheWarmer');
const FlavorCoinManager = require('../services/FlavorCoinManager');
const CollectionManager = require('../services/CollectionManager');
const RecentAchievementTracker = require('../services/RecentAchievementTracker');

const HomeStatsCache = require('../cache/HomeStatsCache');

const createGamificationRoutes = require('../routes/gamification');
const WebSocketGateway = require('../websocket/gateway');

const { primaryDb } = require('../db-primary');

async function initializeGamification(app, io, db, storage, fetchAllShopifyProducts, getRankableProductCount, productsService = null, rateLimiters = null) {
  console.log('🎮 Initializing gamification system...');

  const achievementRepo = new AchievementRepository(db);
  const streakRepo = new StreakRepository(db);
  const activityLogRepo = new ActivityLogRepository(db);
  const productViewRepo = new ProductViewRepository(db);
  const flavorCoinRepo = new FlavorCoinRepository(db);
  const productsMetadataRepo = new ProductsMetadataRepository(db);

  // Initialize cache instances
  const homeStatsCache = HomeStatsCache.getInstance();

  const communityService = new CommunityService(db);
  const achievementManager = new AchievementManager(achievementRepo, activityLogRepo);
  const streakManager = new StreakManager(streakRepo, activityLogRepo);
  const leaderboardManager = new LeaderboardManager(db);
  const progressTracker = new ProgressTracker(achievementRepo, streakRepo, db);
  const pageViewService = new PageViewService(db, productViewRepo);
  const homeStatsService = new HomeStatsService(db, leaderboardManager, activityLogRepo, productViewRepo, communityService, homeStatsCache);
  const userStatsAggregator = new UserStatsAggregator(leaderboardManager, streakManager, productsService);
  const flavorCoinManager = new FlavorCoinManager(flavorCoinRepo, productsMetadataRepo, activityLogRepo);
  const collectionManager = new CollectionManager(achievementRepo, productsMetadataRepo, primaryDb);
  const recentAchievementTracker = RecentAchievementTracker;

  // Initialize RecentAchievementTracker for duplicate toast prevention
  await recentAchievementTracker.initialize();

  const services = {
    db,
    storage,
    achievementRepo,
    streakRepo,
    activityLogRepo,
    productViewRepo,
    flavorCoinRepo,
    productsMetadataRepo,
    communityService,
    achievementManager,
    streakManager,
    leaderboardManager,
    progressTracker,
    pageViewService,
    homeStatsService,
    userStatsAggregator,
    flavorCoinManager,
    collectionManager,
    recentAchievementTracker,
    fetchAllShopifyProducts,
    getRankableProductCount,
    productsService,
    io,
  };

  const gamificationRouter = createGamificationRoutes(services);
  
  // Apply rate limiting middleware if provided
  if (rateLimiters) {
    app.use('/api/gamification', rateLimiters.apiLimiter, gamificationRouter);
  } else {
    app.use('/api/gamification', gamificationRouter);
  }
  console.log('✅ Gamification routes registered at /api/gamification');

  const wsGateway = new WebSocketGateway(io, services);
  console.log('✅ WebSocket gateway initialized');

  services.wsGateway = wsGateway;

  // Seed achievements (this also warms AchievementCache)
  achievementManager.seedAchievements().then(() => {
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

  // Warm all caches asynchronously (non-blocking)
  // This runs in background after server starts accepting requests
  setImmediate(() => {
    cacheWarmer.warmAllAsync();
  });

  console.log('🎮 Gamification system initialized successfully');

  return services;
}

module.exports = initializeGamification;
