const DistributedCache = require('../services/DistributedCache');

/**
 * PurchaseHistoryCache - Redis-backed distributed cache for user purchase history
 * Caches purchased product IDs per user to minimize database queries
 * 
 * Cache Keys:
 * - user:{userId} → Array of purchased product IDs
 * 
 * TTL: 30 minutes (purchase history doesn't change frequently)
 */
class PurchaseHistoryCache {
  constructor(ttlMinutes = 30) {
    this.cache = new DistributedCache('purchase_history');
    this.TTL = ttlMinutes * 60; // Convert minutes to seconds for Redis
    this.initialized = false;
  }

  /**
   * Initialize the cache (called automatically in PurchaseHistoryService)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ PurchaseHistoryCache initialized');
    }
  }

  /**
   * Generate cache key for user purchase history
   * @param {number} userId - User ID
   * @returns {string} Cache key
   */
  getCacheKey(userId) {
    return `user:${userId}`;
  }

  /**
   * Get cached purchase history for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array<string>|null>} Array of product IDs or null if expired
   */
  async get(userId) {
    try {
      // Ensure cache is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      const key = this.getCacheKey(userId);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 Purchase Cache HIT for user ${userId} (${data.length} products)`);
        return data;
      }
      
      console.log(`🚫 Purchase Cache MISS for user ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ PurchaseHistoryCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Store purchase history in cache for a user
   * @param {number} userId - User ID
   * @param {Array<string>} productIds - Array of purchased product IDs
   */
  async set(userId, productIds) {
    try {
      // Ensure cache is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      const key = this.getCacheKey(userId);
      const serialized = JSON.stringify(productIds);
      await this.cache.set(key, serialized, this.TTL);
      
      console.log(`✅ Purchase Cache UPDATED for user ${userId}: ${productIds.length} products, valid for ${this.TTL / 60} minutes`);
    } catch (error) {
      console.error('❌ PurchaseHistoryCache SET error:', error.message);
    }
  }

  /**
   * Manually invalidate cache for a user
   * @param {number} userId - User ID (if null, clears all)
   */
  async invalidate(userId = null) {
    try {
      // Ensure cache is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      if (userId === null) {
        await this.cache.clear();
        console.log('🗑️ Purchase cache cleared for all users');
      } else {
        const key = this.getCacheKey(userId);
        await this.cache.del(key);
        console.log(`🗑️ Purchase cache invalidated for user ${userId}`);
      }
    } catch (error) {
      console.error('❌ PurchaseHistoryCache INVALIDATE error:', error.message);
    }
  }

  /**
   * Get cache statistics for monitoring
   * @param {number} userId - Optional user ID for specific stats
   * @returns {Object} Cache stats
   */
  getStats(userId = null) {
    return {
      ttlMinutes: this.TTL / 60,
      usingRedis: this.cache.isUsingRedis(),
      ...(userId && { userId })
    };
  }
}

module.exports = PurchaseHistoryCache;
