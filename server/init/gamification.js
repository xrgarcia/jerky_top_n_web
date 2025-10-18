/**
 * Gamification System Initialization
 * Wires together repositories, services, routes, and WebSocket gateway
 */

const AchievementRepository = require('../repositories/AchievementRepository');
const StreakRepository = require('../repositories/StreakRepository');
const ActivityLogRepository = require('../repositories/ActivityLogRepository');
const ProductViewRepository = require('../repositories/ProductViewRepository');

const AchievementManager = require('../services/AchievementManager');
const StreakManager = require('../services/StreakManager');
const LeaderboardManager = require('../services/LeaderboardManager');
const ProgressTracker = require('../services/ProgressTracker');
const HomeStatsService = require('../services/HomeStatsService');
const CommunityService = require('../services/CommunityService');
const PageViewService = require('../services/PageViewService');
const UserStatsAggregator = require('../services/UserStatsAggregator');
const CacheWarmer = require('../services/CacheWarmer');

const HomeStatsCache = require('../cache/HomeStatsCache');

const createGamificationRoutes = require('../routes/gamification');
const WebSocketGateway = require('../websocket/gateway');

async function initializeGamification(app, io, db, storage, fetchAllShopifyProducts, getRankableProductCount, productsService = null) {
  console.log('🎮 Initializing gamification system...');

  const achievementRepo = new AchievementRepository(db);
  const streakRepo = new StreakRepository(db);
  const activityLogRepo = new ActivityLogRepository(db);
  const productViewRepo = new ProductViewRepository(db);

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

  const services = {
    db,
    storage,
    achievementRepo,
    streakRepo,
    activityLogRepo,
    productViewRepo,
    communityService,
    achievementManager,
    streakManager,
    leaderboardManager,
    progressTracker,
    pageViewService,
    homeStatsService,
    userStatsAggregator,
    fetchAllShopifyProducts,
    getRankableProductCount,
    productsService,
    io,
  };

  const gamificationRouter = createGamificationRoutes(services);
  app.use('/api/gamification', gamificationRouter);
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

  // Warm all caches asynchronously (non-blocking)
  // This runs in background after server starts accepting requests
  setImmediate(() => {
    cacheWarmer.warmAllAsync();
  });

  console.log('🎮 Gamification system initialized successfully');

  return services;
}

module.exports = initializeGamification;
