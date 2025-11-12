const DistributedCache = require('../services/DistributedCache');

/**
 * JourneyCache - Redis-backed distributed cache for user journey milestones
 * Caches narrative timeline moments (first purchase, flavor discoveries, achievements, etc.)
 * 
 * Cache Keys:
 * - user:{userId} → Array of milestone objects
 * 
 * TTL: 10 minutes (balances freshness with expensive JOIN queries)
 */
class JourneyCache {
  constructor() {
    if (JourneyCache.instance) {
      return JourneyCache.instance;
    }

    this.cache = new DistributedCache('journey');
    this.TTL = 600; // 10 minutes in seconds (for Redis)
    this.initialized = false;
    
    JourneyCache.instance = this;
  }

  /**
   * Initialize the cache (must be called on startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ JourneyCache initialized');
    }
  }

  /**
   * Generate cache key for user journey milestones
   * @param {number} userId - User ID
   * @returns {string} Cache key
   */
  getCacheKey(userId) {
    return `user:${userId}`;
  }

  /**
   * Get cached journey milestones for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array|null>} Array of milestone objects or null
   */
  async get(userId) {
    try {
      const key = this.getCacheKey(userId);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 JourneyCache HIT: user ${userId} (${data.length} milestones)`);
        return data;
      }
      
      console.log(`🚫 JourneyCache MISS: user ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ JourneyCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Cache journey milestones for a user
   * @param {number} userId - User ID
   * @param {Array} milestones - Array of milestone objects
   * @returns {Promise<boolean>} Success status
   */
  async set(userId, milestones) {
    try {
      const key = this.getCacheKey(userId);
      const value = JSON.stringify(milestones);
      await this.cache.set(key, value, this.TTL);
      console.log(`✅ JourneyCache SET: user ${userId} (${milestones.length} milestones, TTL: ${this.TTL}s)`);
      return true;
    } catch (error) {
      console.error('❌ JourneyCache SET error:', error.message);
      return false;
    }
  }

  /**
   * Invalidate journey cache for a specific user
   * Called when user makes purchase, ranking, or unlocks achievement
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async invalidateUser(userId) {
    try {
      const key = this.getCacheKey(userId);
      await this.cache.del(key);
      console.log(`🗑️ JourneyCache INVALIDATE: user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ JourneyCache INVALIDATE error:', error.message);
      return false;
    }
  }

  /**
   * Clear all journey cache entries (admin/debugging)
   * @returns {Promise<boolean>} Success status
   */
  async invalidateAll() {
    try {
      await this.cache.clear();
      console.log('🗑️ JourneyCache: All cache entries cleared');
      return true;
    } catch (error) {
      console.error('❌ JourneyCache CLEAR error:', error.message);
      return false;
    }
  }

  /**
   * Get singleton instance
   * @returns {JourneyCache} Singleton instance
   */
  static getInstance() {
    if (!JourneyCache.instance) {
      JourneyCache.instance = new JourneyCache();
    }
    return JourneyCache.instance;
  }
}

module.exports = JourneyCache;
