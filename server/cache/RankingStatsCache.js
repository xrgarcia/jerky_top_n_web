const DistributedCache = require('../services/DistributedCache');

/**
 * RankingStatsCache - Redis-backed distributed cache for product ranking statistics
 * Caches avgRank, rankingCount, uniqueRankers, etc. for each product
 * Invalidated only by webhooks - no TTL expiration
 * 
 * Cache Keys:
 * - all_stats → Entire map of shopifyProductId -> ranking stats
 * - timestamp → Last update timestamp for age tracking
 * 
 * TTL: No expiration (webhook-invalidated only)
 */
class RankingStatsCache {
  constructor() {
    this.cache = new DistributedCache('ranking_stats');
    this.initialized = false;
    this.isLoading = false;
  }

  /**
   * Initialize the cache (called on server startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ RankingStatsCache initialized');
    }
  }

  /**
   * Check if cached data exists
   */
  async isValid() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const data = await this.cache.get('all_stats');
      const timestamp = await this.cache.get('timestamp');
      return data !== null && timestamp !== null;
    } catch (error) {
      console.error('❌ RankingStatsCache isValid error:', error.message);
      return false;
    }
  }

  /**
   * Get cached ranking statistics
   * @returns {Object|null} Cached data or null if invalid/missing
   */
  async get() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const data = await this.cache.get('all_stats');
      
      if (data) {
        const timestamp = await this.cache.get('timestamp');
        if (timestamp) {
          const ageMinutes = Math.floor((Date.now() - timestamp) / 60000);
          console.log(`💾 RankingStats Cache HIT: Returning data (age: ${ageMinutes} minutes)`);
        } else {
          console.log(`💾 RankingStats Cache HIT: Returning data`);
        }
        return data; // Already deserialized by DistributedCache
      }
      
      console.log('🚫 RankingStats Cache MISS: Data expired or not found');
      return null;
    } catch (error) {
      console.error('❌ RankingStatsCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Store ranking statistics in cache
   * @param {Object} stats - Ranking statistics data to cache
   */
  async set(stats) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await this.cache.set('all_stats', stats, null); // No TTL, DistributedCache handles serialization
      await this.cache.set('timestamp', Date.now(), null);
      
      console.log(`✅ RankingStats Cache UPDATED: Stored ${Object.keys(stats).length} product stats (webhook-invalidated only)`);
    } catch (error) {
      console.error('❌ RankingStatsCache SET error:', error.message);
    }
  }

  /**
   * Update specific products in the cache (called by webhooks)
   * @param {Object} productsStats - Map of shopifyProductId -> stats to update
   */
  async updateProducts(productsStats) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const data = await this.cache.get('all_stats');
      
      if (!data) {
        console.log('⚠️ RankingStatsCache: Cache not initialized, cannot update products');
        return;
      }
      
      const statsMap = data; // Already deserialized by DistributedCache
      const productIds = Object.keys(productsStats);
      
      for (const productId of productIds) {
        statsMap[productId] = productsStats[productId];
      }
      
      await this.cache.set('all_stats', statsMap, null); // DistributedCache handles serialization
      await this.cache.set('timestamp', Date.now(), null);
      
      console.log(`✅ RankingStatsCache: Updated ${productIds.length} product(s): ${productIds.join(', ')} - timestamp reset`);
    } catch (error) {
      console.error('❌ RankingStatsCache updateProducts error:', error.message);
    }
  }

  /**
   * Invalidate entire cache (called by admin tools for manual cache clearing)
   */
  async invalidate() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await this.cache.del('all_stats');
      await this.cache.del('timestamp');
      
      console.log('🗑️ RankingStats cache invalidated');
    } catch (error) {
      console.error('❌ RankingStatsCache invalidate error:', error.message);
    }
  }

  /**
   * Get cache age in minutes
   * @returns {number} Age in minutes, or -1 if no cache
   */
  async getAge() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const timestamp = await this.cache.get('timestamp');
      if (!timestamp) return -1;
      return Math.floor((Date.now() - timestamp) / 60000);
    } catch (error) {
      console.error('❌ RankingStatsCache getAge error:', error.message);
      return -1;
    }
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache stats object
   */
  async getStats() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const data = await this.cache.get('all_stats');
      const timestamp = await this.cache.get('timestamp');
      const ageMinutes = await this.getAge();
      
      return {
        hasData: data !== null,
        isValid: data !== null && timestamp !== null,
        ageMinutes: ageMinutes,
        ttl: 'webhook-only',
        itemCount: data ? Object.keys(data).length : 0, // data is already deserialized
        usingRedis: this.cache.isUsingRedis()
      };
    } catch (error) {
      console.error('❌ RankingStatsCache getStats error:', error.message);
      return {
        hasData: false,
        isValid: false,
        ageMinutes: -1,
        ttl: 'webhook-only',
        itemCount: 0,
        usingRedis: this.cache.isUsingRedis()
      };
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!RankingStatsCache.instance) {
      RankingStatsCache.instance = new RankingStatsCache();
    }
    return RankingStatsCache.instance;
  }
}

// Ensure singleton instance
RankingStatsCache.instance = null;

module.exports = RankingStatsCache;
