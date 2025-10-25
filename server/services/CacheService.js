const DistributedCache = require('./DistributedCache');

class CacheService {
  constructor() {
    // Initialize all distributed caches with their respective TTLs
    this.homeStats = new DistributedCache('homeStats');
    this.leaderboard = new DistributedCache('leaderboard');
    this.leaderboardPosition = new DistributedCache('leaderboardPosition');
    this.achievement = new DistributedCache('achievement');
    this.metadata = new DistributedCache('metadata');
    this.rankingStats = new DistributedCache('rankingStats');
    this.productCache = new DistributedCache('products');
    
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log('🚀 Initializing distributed cache service...');
    
    // Initialize shared Redis connection ONCE before setting up caches
    const redisClient = require('./RedisClient');
    await redisClient.connect();
    
    // Now initialize all caches (they'll check if Redis is available)
    await Promise.all([
      this.homeStats.initialize(),
      this.leaderboard.initialize(),
      this.leaderboardPosition.initialize(),
      this.achievement.initialize(),
      this.metadata.initialize(),
      this.rankingStats.initialize(),
      this.productCache.initialize()
    ]);

    this.initialized = true;
    
    const isRedis = this.homeStats.isUsingRedis();
    if (isRedis) {
      console.log('✅ All caches using Redis for distributed caching');
    } else {
      console.log('⚠️ All caches using in-memory storage (single-instance only)');
    }
  }

  // HomeStats Cache Methods
  async getHomeStats() {
    return await this.homeStats.get('stats');
  }

  async setHomeStats(stats, ttlSeconds = 300) { // 5 minutes default
    return await this.homeStats.set('stats', stats, ttlSeconds);
  }

  async invalidateHomeStats() {
    return await this.homeStats.del('stats');
  }

  // Leaderboard Cache Methods
  async getLeaderboard(period = 'all_time', limit = 50) {
    const key = `${period}:${limit}`;
    return await this.leaderboard.get(key);
  }

  async setLeaderboard(period = 'all_time', limit = 50, data, ttlSeconds = 300) { // 5 minutes default
    const key = `${period}:${limit}`;
    return await this.leaderboard.set(key, data, ttlSeconds);
  }

  async invalidateLeaderboard(period = null) {
    if (period) {
      // Clear specific period entries
      const limits = [5, 10, 50];
      for (const limit of limits) {
        await this.leaderboard.del(`${period}:${limit}`);
      }
    } else {
      // Clear all
      await this.leaderboard.clear();
    }
  }

  // Leaderboard Position Cache Methods
  async getLeaderboardPosition(userId, period = 'all_time') {
    const key = `${userId}:${period}`;
    return await this.leaderboardPosition.get(key);
  }

  async setLeaderboardPosition(userId, period = 'all_time', data, ttlSeconds = 300) {
    const key = `${userId}:${period}`;
    return await this.leaderboardPosition.set(key, data, ttlSeconds);
  }

  async invalidateLeaderboardPosition(userId = null) {
    if (userId) {
      // Clear specific user's position cache for all periods
      const periods = ['all_time', 'week', 'month'];
      for (const period of periods) {
        await this.leaderboardPosition.del(`${userId}:${period}`);
      }
    } else {
      // Clear ALL leaderboard position entries (for admin cache clear)
      await this.leaderboardPosition.clear();
    }
  }

  // Achievement Cache Methods
  async getAchievements() {
    return await this.achievement.get('definitions');
  }

  async setAchievements(definitions, ttlSeconds = 3600) { // 1 hour default
    return await this.achievement.set('definitions', definitions, ttlSeconds);
  }

  async invalidateAchievements() {
    return await this.achievement.del('definitions');
  }

  // Metadata Cache Methods
  async getMetadata() {
    return await this.metadata.get('data');
  }

  async setMetadata(data, ttlSeconds = 1800) { // 30 minutes default
    return await this.metadata.set('data', data, ttlSeconds);
  }

  async invalidateMetadata() {
    return await this.metadata.del('data');
  }

  // Ranking Stats Cache Methods
  async getRankingStats() {
    return await this.rankingStats.get('data');
  }

  async setRankingStats(data, ttlSeconds = 1800) { // 30 minutes default
    return await this.rankingStats.set('data', data, ttlSeconds);
  }

  async invalidateRankingStats() {
    return await this.rankingStats.del('data');
  }

  // Product Cache Methods
  async getProducts() {
    return await this.productCache.get('data');
  }

  async setProducts(data, ttlSeconds = 1800) { // 30 minutes default
    return await this.productCache.set('data', data, ttlSeconds);
  }

  async invalidateProducts() {
    return await this.productCache.del('data');
  }

  // Check if using Redis
  isUsingRedis() {
    return this.homeStats.isUsingRedis();
  }
}

// Export singleton instance
const cacheService = new CacheService();
module.exports = cacheService;
