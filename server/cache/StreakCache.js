const DistributedCache = require('../services/DistributedCache');

/**
 * StreakCache - Redis-backed distributed cache for user streaks
 * Stores current and longest streaks for daily ranking and login activities
 * 
 * Cache Keys:
 * - user:{userId}:all → All streaks for a user (array)
 * - user:{userId}:{streakType} → Specific streak type (e.g., daily_rank)
 * 
 * TTL: 10 minutes (streaks only change daily, can cache longer)
 */
class StreakCache {
  constructor() {
    if (StreakCache.instance) {
      return StreakCache.instance;
    }

    this.cache = new DistributedCache('streak');
    this.TTL = 600; // 10 minutes in seconds (for Redis)
    this.initialized = false;
    
    StreakCache.instance = this;
  }

  /**
   * Initialize the cache (must be called on startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ StreakCache initialized');
    }
  }

  /**
   * Generate cache key for all user streaks
   * @param {number} userId - User ID
   * @returns {string} Cache key
   */
  getAllStreaksCacheKey(userId) {
    return `user:${userId}:all`;
  }

  /**
   * Generate cache key for specific streak type
   * @param {number} userId - User ID
   * @param {string} streakType - Streak type (e.g., 'daily_rank', 'daily_login')
   * @returns {string} Cache key
   */
  getStreakTypeCacheKey(userId, streakType) {
    return `user:${userId}:${streakType}`;
  }

  /**
   * Get all cached streaks for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array|null>} Cached streaks array or null
   */
  async getAllStreaks(userId) {
    try {
      const key = this.getAllStreaksCacheKey(userId);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 StreakCache HIT: all streaks for user ${userId} (${data.length} streaks)`);
        return data;
      }
      
      console.log(`🚫 StreakCache MISS: all streaks for user ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ StreakCache GET ALL error:', error.message);
      return null;
    }
  }

  /**
   * Get cached streak for specific type
   * @param {number} userId - User ID
   * @param {string} streakType - Streak type
   * @returns {Promise<Object|null>} Cached streak or null
   */
  async getStreakType(userId, streakType) {
    try {
      const key = this.getStreakTypeCacheKey(userId, streakType);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 StreakCache HIT: ${streakType} for user ${userId}`);
        return data;
      }
      
      console.log(`🚫 StreakCache MISS: ${streakType} for user ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ StreakCache GET TYPE error:', error.message);
      return null;
    }
  }

  /**
   * Set all streaks in cache for a user
   * @param {number} userId - User ID
   * @param {Array} streaks - Array of streak objects
   */
  async setAllStreaks(userId, streaks) {
    try {
      const key = this.getAllStreaksCacheKey(userId);
      const serialized = JSON.stringify(streaks);
      await this.cache.set(key, serialized, this.TTL);
      console.log(`✅ StreakCache SET: all streaks for user ${userId} (${streaks.length} streaks)`);
      
      // Also cache individual streak types for faster lookups
      for (const streak of streaks) {
        if (streak.streakType) {
          const typeKey = this.getStreakTypeCacheKey(userId, streak.streakType);
          await this.cache.set(typeKey, JSON.stringify(streak), this.TTL);
        }
      }
    } catch (error) {
      console.error('❌ StreakCache SET ALL error:', error.message);
    }
  }

  /**
   * Invalidate cache for a specific user
   * @param {number} userId - User ID
   */
  async invalidateUser(userId) {
    try {
      // Invalidate all streaks cache
      const allKey = this.getAllStreaksCacheKey(userId);
      await this.cache.del(allKey);
      
      // Invalidate specific streak types
      const types = ['daily_rank', 'daily_login'];
      for (const type of types) {
        const typeKey = this.getStreakTypeCacheKey(userId, type);
        await this.cache.del(typeKey);
      }
      
      console.log(`🗑️ StreakCache INVALIDATE: user ${userId}`);
    } catch (error) {
      console.error('❌ StreakCache INVALIDATE error:', error.message);
    }
  }

  /**
   * Invalidate all streak cache
   */
  async invalidate() {
    try {
      await this.cache.clear();
      console.log('🗑️ StreakCache: All cache cleared');
    } catch (error) {
      console.error('❌ StreakCache CLEAR error:', error.message);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!StreakCache.instance) {
      StreakCache.instance = new StreakCache();
    }
    return StreakCache.instance;
  }
}

// Ensure singleton instance
StreakCache.instance = null;

module.exports = StreakCache;
