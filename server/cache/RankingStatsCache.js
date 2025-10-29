/**
 * RankingStatsCache - A cache manager for product ranking statistics
 * Invalidated only by webhooks - no TTL expiration
 */
class RankingStatsCache {
  constructor() {
    this.data = null;
    this.timestamp = null;
    this.isLoading = false;
  }

  /**
   * Check if cached data exists
   */
  isValid() {
    return this.data !== null && this.timestamp !== null;
  }

  /**
   * Get cached ranking statistics
   * @returns {Object|null} Cached data or null if invalid/missing
   */
  get() {
    if (this.isValid()) {
      const ageMinutes = Math.floor((Date.now() - this.timestamp) / 60000);
      console.log(`💾 RankingStats Cache HIT: Returning data (age: ${ageMinutes} minutes)`);
      return this.data;
    }
    
    console.log('🚫 RankingStats Cache MISS: Data expired or not found');
    return null;
  }

  /**
   * Store ranking statistics in cache
   * @param {Object} stats - Ranking statistics data to cache
   */
  set(stats) {
    this.data = stats;
    this.timestamp = Date.now();
    
    console.log(`✅ RankingStats Cache UPDATED: Stored ${Object.keys(stats).length} product stats (webhook-invalidated only)`);
  }

  /**
   * Invalidate the cache (called by webhooks when rankings change)
   */
  invalidate() {
    this.data = null;
    this.timestamp = null;
    
    console.log('🗑️ RankingStats cache invalidated');
  }

  /**
   * Get cache age in minutes
   * @returns {number} Age in minutes, or -1 if no cache
   */
  getAge() {
    if (!this.timestamp) {
      return -1;
    }
    return Math.floor((Date.now() - this.timestamp) / 60000);
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache stats object
   */
  getStats() {
    return {
      hasData: this.data !== null,
      isValid: this.isValid(),
      ageMinutes: this.getAge(),
      ttl: 'webhook-only',
      itemCount: this.data ? Object.keys(this.data).length : 0
    };
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
