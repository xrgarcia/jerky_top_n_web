const DistributedCache = require('../services/DistributedCache');

/**
 * UserClassificationCache - Redis-backed distributed cache for user classifications
 * Stores journey stages, engagement levels, focus areas, and flavor communities
 * 
 * Cache Keys:
 * - user:{userId} → Full classification object
 * 
 * TTL: 5 minutes (classifications update frequently with user activity)
 */
class UserClassificationCache {
  constructor() {
    if (UserClassificationCache.instance) {
      return UserClassificationCache.instance;
    }

    this.cache = new DistributedCache('user_classification');
    this.TTL = 300; // 5 minutes in seconds (for Redis)
    this.initialized = false;
    
    UserClassificationCache.instance = this;
  }

  /**
   * Initialize the cache (must be called on startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ UserClassificationCache initialized');
    }
  }

  /**
   * Generate cache key for user classification
   * @param {number} userId - User ID
   * @returns {string} Cache key
   */
  getCacheKey(userId) {
    return `user:${userId}`;
  }

  /**
   * Get cached classification for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Cached classification or null
   */
  async get(userId) {
    try {
      const key = this.getCacheKey(userId);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 UserClassificationCache HIT: user ${userId}`);
        return data;
      }
      
      console.log(`🚫 UserClassificationCache MISS: user ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ UserClassificationCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Set classification data in cache for a user
   * @param {number} userId - User ID
   * @param {Object} classification - Classification object
   */
  async set(userId, classification) {
    try {
      const key = this.getCacheKey(userId);
      const serialized = JSON.stringify(classification);
      await this.cache.set(key, serialized, this.TTL);
      console.log(`✅ UserClassificationCache SET: user ${userId}`);
    } catch (error) {
      console.error('❌ UserClassificationCache SET error:', error.message);
    }
  }

  /**
   * Invalidate cache for a specific user
   * @param {number} userId - User ID
   */
  async invalidateUser(userId) {
    try {
      const key = this.getCacheKey(userId);
      await this.cache.del(key);
      console.log(`🗑️ UserClassificationCache INVALIDATE: user ${userId}`);
    } catch (error) {
      console.error('❌ UserClassificationCache INVALIDATE error:', error.message);
    }
  }

  /**
   * Invalidate all classification cache
   */
  async invalidate() {
    try {
      await this.cache.clear();
      console.log('🗑️ UserClassificationCache: All cache cleared');
    } catch (error) {
      console.error('❌ UserClassificationCache CLEAR error:', error.message);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!UserClassificationCache.instance) {
      UserClassificationCache.instance = new UserClassificationCache();
    }
    return UserClassificationCache.instance;
  }
}

// Ensure singleton instance
UserClassificationCache.instance = null;

module.exports = UserClassificationCache;
