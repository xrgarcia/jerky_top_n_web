const DistributedCache = require('../services/DistributedCache');

/**
 * ProgressCache - Redis-backed distributed cache for user progress milestones
 * Stores next achievement milestone and progress percentage
 * 
 * Cache Keys:
 * - user:{userId} → Next milestone with progress data
 * 
 * TTL: 5 minutes (progress updates frequently with rankings/achievements)
 */
class ProgressCache {
  constructor() {
    if (ProgressCache.instance) {
      return ProgressCache.instance;
    }

    this.cache = new DistributedCache('progress');
    this.TTL = 300; // 5 minutes in seconds (for Redis)
    this.initialized = false;
    
    ProgressCache.instance = this;
  }

  /**
   * Initialize the cache (must be called on startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ ProgressCache initialized');
    }
  }

  /**
   * Generate cache key for user progress
   * @param {number} userId - User ID
   * @returns {string} Cache key
   */
  getCacheKey(userId) {
    return `user:${userId}`;
  }

  /**
   * Get cached progress for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Cached progress or null
   */
  async get(userId) {
    try {
      const key = this.getCacheKey(userId);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 ProgressCache HIT: user ${userId}`);
        return data;
      }
      
      console.log(`🚫 ProgressCache MISS: user ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ ProgressCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Set progress data in cache for a user
   * @param {number} userId - User ID
   * @param {Object} progress - Progress object with milestone data
   * @param {number} ttlSeconds - Optional TTL in seconds (defaults to 5 minutes)
   */
  async set(userId, progress, ttlSeconds = null) {
    try {
      const key = this.getCacheKey(userId);
      const serialized = JSON.stringify(progress);
      const ttl = ttlSeconds !== null ? ttlSeconds : this.TTL;
      await this.cache.set(key, serialized, ttl);
      console.log(`✅ ProgressCache SET: user ${userId} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('❌ ProgressCache SET error:', error.message);
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
      console.log(`🗑️ ProgressCache INVALIDATE: user ${userId}`);
    } catch (error) {
      console.error('❌ ProgressCache INVALIDATE error:', error.message);
    }
  }

  /**
   * Invalidate all progress cache
   */
  async invalidate() {
    try {
      await this.cache.clear();
      console.log('🗑️ ProgressCache: All cache cleared');
    } catch (error) {
      console.error('❌ ProgressCache CLEAR error:', error.message);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!ProgressCache.instance) {
      ProgressCache.instance = new ProgressCache();
    }
    return ProgressCache.instance;
  }
}

// Ensure singleton instance
ProgressCache.instance = null;

module.exports = ProgressCache;
