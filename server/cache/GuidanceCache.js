const DistributedCache = require('../services/DistributedCache');

/**
 * GuidanceCache - Redis-backed distributed cache for personalized guidance messages
 * Caches guidance messages per user per page context to reduce database queries
 * 
 * Cache Keys:
 * - user:{userId}:{pageContext} → Guidance message for specific page
 * - user:{userId}:all → All guidance messages for user (all page contexts)
 * 
 * TTL: 5 minutes (guidance updates on user events)
 */
class GuidanceCache {
  constructor() {
    if (GuidanceCache.instance) {
      return GuidanceCache.instance;
    }

    this.cache = new DistributedCache('guidance');
    this.TTL = 300; // 5 minutes in seconds (for Redis)
    this.initialized = false;
    
    GuidanceCache.instance = this;
  }

  /**
   * Initialize the cache (must be called on startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ GuidanceCache initialized');
    }
  }

  /**
   * Generate cache key for user guidance on specific page
   * @param {number} userId - User ID
   * @param {string} pageContext - Page context (e.g., 'general', 'rank', 'community')
   * @returns {string} Cache key
   */
  getCacheKey(userId, pageContext) {
    return `user:${userId}:${pageContext}`;
  }

  /**
   * Generate cache key for all user guidance
   * @param {number} userId - User ID
   * @returns {string} Cache key
   */
  getAllGuidanceCacheKey(userId) {
    return `user:${userId}:all`;
  }

  /**
   * Get cached guidance for a user on specific page
   * @param {number} userId - User ID
   * @param {string} pageContext - Page context
   * @returns {Promise<Object|null>} Cached guidance or null
   */
  async get(userId, pageContext) {
    try {
      const key = this.getCacheKey(userId, pageContext);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 GuidanceCache HIT: user ${userId} on ${pageContext}`);
        return data;
      }
      
      console.log(`🚫 GuidanceCache MISS: user ${userId} on ${pageContext}`);
      return null;
    } catch (error) {
      console.error('❌ GuidanceCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Get all cached guidance for a user (all page contexts)
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Cached guidance map or null
   */
  async getAllGuidance(userId) {
    try {
      const key = this.getAllGuidanceCacheKey(userId);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 GuidanceCache HIT: all guidance for user ${userId}`);
        return data;
      }
      
      console.log(`🚫 GuidanceCache MISS: all guidance for user ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ GuidanceCache GET ALL error:', error.message);
      return null;
    }
  }

  /**
   * Set guidance data in cache for a user on specific page
   * @param {number} userId - User ID
   * @param {string} pageContext - Page context
   * @param {Object} guidance - Guidance object
   */
  async set(userId, pageContext, guidance) {
    try {
      const key = this.getCacheKey(userId, pageContext);
      const serialized = JSON.stringify(guidance);
      await this.cache.set(key, serialized, this.TTL);
      console.log(`✅ GuidanceCache SET: user ${userId} on ${pageContext}`);
    } catch (error) {
      console.error('❌ GuidanceCache SET error:', error.message);
    }
  }

  /**
   * Set all guidance data in cache for a user (all page contexts)
   * @param {number} userId - User ID
   * @param {Object} guidanceMap - Map of page contexts to guidance objects
   */
  async setAllGuidance(userId, guidanceMap) {
    try {
      // Cache the complete map
      const allKey = this.getAllGuidanceCacheKey(userId);
      await this.cache.set(allKey, JSON.stringify(guidanceMap), this.TTL);
      
      // Also cache individual page contexts for faster lookups
      for (const [pageContext, guidance] of Object.entries(guidanceMap)) {
        const pageKey = this.getCacheKey(userId, pageContext);
        await this.cache.set(pageKey, JSON.stringify(guidance), this.TTL);
      }
      
      console.log(`✅ GuidanceCache SET: all guidance for user ${userId} (${Object.keys(guidanceMap).length} pages)`);
    } catch (error) {
      console.error('❌ GuidanceCache SET ALL error:', error.message);
    }
  }

  /**
   * Invalidate cache for a specific user
   * @param {number} userId - User ID
   */
  async invalidateUser(userId) {
    try {
      // Invalidate all guidance cache
      const allKey = this.getAllGuidanceCacheKey(userId);
      await this.cache.del(allKey);
      
      // Invalidate specific page contexts
      const pages = ['general', 'rank', 'community', 'products', 'coinbook'];
      for (const page of pages) {
        const pageKey = this.getCacheKey(userId, page);
        await this.cache.del(pageKey);
      }
      
      console.log(`🗑️ GuidanceCache INVALIDATE: user ${userId}`);
    } catch (error) {
      console.error('❌ GuidanceCache INVALIDATE error:', error.message);
    }
  }

  /**
   * Invalidate all guidance cache
   */
  async invalidate() {
    try {
      await this.cache.clear();
      console.log('🗑️ GuidanceCache: All cache cleared');
    } catch (error) {
      console.error('❌ GuidanceCache CLEAR error:', error.message);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!GuidanceCache.instance) {
      GuidanceCache.instance = new GuidanceCache();
    }
    return GuidanceCache.instance;
  }
}

// Ensure singleton instance
GuidanceCache.instance = null;

module.exports = GuidanceCache;
