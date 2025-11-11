const cacheService = require('./services/CacheService');
const redisClient = require('./services/RedisClient');
const { createAdapter } = require('@socket.io/redis-adapter');
const LeaderboardCache = require('./cache/LeaderboardCache');
const UserClassificationCache = require('./cache/UserClassificationCache');
const StreakCache = require('./cache/StreakCache');
const ProgressCache = require('./cache/ProgressCache');
const AchievementCache = require('./cache/AchievementCache');
const UserProfileCache = require('./cache/UserProfileCache');
const PurchaseHistoryCache = require('./cache/PurchaseHistoryCache');
const GuidanceCache = require('./cache/GuidanceCache');

async function initializeScalability(io) {
  console.log('🚀 Initializing scalability features...');
  
  // Initialize Redis cache service (establishes shared connection pool)
  await cacheService.initialize();
  
  // Initialize all Redis-backed distributed caches
  console.log('📦 Initializing distributed caches...');
  
  const leaderboardCache = LeaderboardCache.getInstance();
  await leaderboardCache.initialize();
  
  const userClassificationCache = UserClassificationCache.getInstance();
  await userClassificationCache.initialize();
  
  const streakCache = StreakCache.getInstance();
  await streakCache.initialize();
  
  const progressCache = ProgressCache.getInstance();
  await progressCache.initialize();
  
  const achievementCache = AchievementCache.getInstance();
  await achievementCache.initialize();
  
  const userProfileCache = UserProfileCache.getInstance();
  await userProfileCache.initialize();
  
  const guidanceCache = GuidanceCache.getInstance();
  await guidanceCache.initialize();
  
  console.log('✅ All distributed caches initialized');
  
  // Setup Socket.IO Redis adapter for cross-instance communication
  const client = redisClient.getClient();
  if (client && client.status === 'ready') {
    try {
      console.log('🔌 Setting up Socket.IO Redis adapter with shared connection...');
      
      // Create duplicate connections for pub/sub (Socket.IO requirement)
      const pubClient = client.duplicate();
      const subClient = client.duplicate();
      
      await Promise.all([
        pubClient.connect ? pubClient.connect() : Promise.resolve(),
        subClient.connect ? subClient.connect() : Promise.resolve()
      ]);
      
      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.IO using Redis adapter for cross-instance communication');
    } catch (error) {
      console.error('❌ Failed to setup Socket.IO Redis adapter:', error.message);
      console.log('⚠️ Socket.IO using default in-memory adapter');
    }
  } else {
    console.log('⚠️ Redis not available - Socket.IO using in-memory adapter (single-instance only)');
  }
  
  console.log('✅ Scalability initialization complete');
}

module.exports = { initializeScalability, cacheService };
