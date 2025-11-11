const DistributedCache = require('../services/DistributedCache');

/**
 * AchievementCache - Redis-backed distributed cache for achievement definitions
 * Caches achievement definitions to avoid repeated database queries
 * 
 * Cache Keys:
 * - all → All achievement definitions
 * 
 * TTL: 1 hour (achievements rarely change)
 */
class AchievementCache {
  constructor() {
    if (AchievementCache.instance) {
      return AchievementCache.instance;
    }

    this.cache = new DistributedCache('achievement');
    this.TTL = 3600; // 1 hour in seconds (for Redis)
    this.initialized = false;
    
    AchievementCache.instance = this;
  }

  /**
   * Initialize the cache (must be called on startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ AchievementCache initialized');
    }
  }

  /**
   * Generate cache key for all achievements
   * @returns {string} Cache key
   */
  getCacheKey() {
    return 'all';
  }

  /**
   * Get cached achievement definitions
   * @returns {Promise<Array|null>} Cached definitions or null
   */
  async get() {
    try {
      const key = this.getCacheKey();
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 AchievementCache HIT: Returning ${data.length} definitions`);
        return data;
      }
      
      console.log('🚫 AchievementCache MISS: Data expired or not found');
      return null;
    } catch (error) {
      console.error('❌ AchievementCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Set achievement definitions in cache
   * @param {Array} definitions - Array of achievement definitions
   */
  async set(definitions) {
    try {
      const key = this.getCacheKey();
      const serialized = JSON.stringify(definitions);
      await this.cache.set(key, serialized, this.TTL);
      console.log(`✅ AchievementCache SET: Cached ${definitions.length} definitions`);
    } catch (error) {
      console.error('❌ AchievementCache SET error:', error.message);
    }
  }

  /**
   * Invalidate the cache (e.g., when definitions are updated)
   */
  async invalidate() {
    try {
      await this.cache.clear();
      console.log('🗑️ AchievementCache: Cache cleared');
    } catch (error) {
      console.error('❌ AchievementCache CLEAR error:', error.message);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!AchievementCache.instance) {
      AchievementCache.instance = new AchievementCache();
    }
    return AchievementCache.instance;
  }
}

// Ensure singleton instance
AchievementCache.instance = null;

module.exports = AchievementCache;
