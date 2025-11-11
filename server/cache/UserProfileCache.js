const DistributedCache = require('../services/DistributedCache');

/**
 * UserProfileCache - Redis-backed distributed cache for user profile data
 * Stores name, avatar, handle, initials, and privacy settings
 * 
 * Cache Keys:
 * - user:{userId} → Full profile object with formatted display data
 * 
 * TTL: 10 minutes (user data changes infrequently)
 */
class UserProfileCache {
  constructor() {
    if (UserProfileCache.instance) {
      return UserProfileCache.instance;
    }

    this.cache = new DistributedCache('user_profile');
    this.TTL = 600; // 10 minutes in seconds (for Redis)
    this.initialized = false;
    
    UserProfileCache.instance = this;
  }

  /**
   * Initialize the cache (must be called on startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ UserProfileCache initialized');
    }
  }

  /**
   * Generate cache key for user profile
   * @param {number} userId - User ID
   * @returns {string} Cache key
   */
  getCacheKey(userId) {
    return `user:${userId}`;
  }

  /**
   * Get cached profile for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Cached profile or null
   */
  async get(userId) {
    try {
      const key = this.getCacheKey(userId);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 UserProfileCache HIT: user ${userId}`);
        return data;
      }
      
      console.log(`🚫 UserProfileCache MISS: user ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ UserProfileCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Set profile data in cache for a user
   * @param {number} userId - User ID
   * @param {Object} profile - Profile object (displayName, avatarUrl, initials, handle, etc.)
   */
  async set(userId, profile) {
    try {
      const key = this.getCacheKey(userId);
      const serialized = JSON.stringify(profile);
      await this.cache.set(key, serialized, this.TTL);
      console.log(`✅ UserProfileCache SET: user ${userId}`);
    } catch (error) {
      console.error('❌ UserProfileCache SET error:', error.message);
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
      console.log(`🗑️ UserProfileCache INVALIDATE: user ${userId}`);
    } catch (error) {
      console.error('❌ UserProfileCache INVALIDATE error:', error.message);
    }
  }

  /**
   * Invalidate all profile cache
   */
  async invalidate() {
    try {
      await this.cache.clear();
      console.log('🗑️ UserProfileCache: All cache cleared');
    } catch (error) {
      console.error('❌ UserProfileCache CLEAR error:', error.message);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!UserProfileCache.instance) {
      UserProfileCache.instance = new UserProfileCache();
    }
    return UserProfileCache.instance;
  }
}

// Ensure singleton instance
UserProfileCache.instance = null;

module.exports = UserProfileCache;
