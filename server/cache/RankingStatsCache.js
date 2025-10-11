/**
 * RankingStatsCache - A cache manager for product ranking statistics
 * Follows OOP principles with encapsulation and single responsibility
 */
class RankingStatsCache {
  constructor(ttlMinutes = 30) {
    this.data = null;
    this.timestamp = null;
    this.isLoading = false;
    this.TTL = ttlMinutes * 60 * 1000; // Convert minutes to milliseconds
    this.invalidationTimer = null;
  }

  /**
   * Check if cached data is still valid
   */
  isValid() {
    if (!this.data || !this.timestamp) {
      return false;
    }
    
    const age = Date.now() - this.timestamp;
    return age < this.TTL;
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
    
    // Clear existing timer
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }
    
    // Schedule automatic invalidation
    this.invalidationTimer = setTimeout(() => {
      console.log('⏰ RankingStats cache expired - will refresh on next request');
      this.invalidate();
    }, this.TTL);
    
    console.log(`✅ RankingStats Cache UPDATED: Stored ${Object.keys(stats).length} product stats, valid for ${this.TTL / 60000} minutes`);
    console.log(`⏰ Next cache invalidation scheduled in ${this.TTL / 60000} minutes`);
  }

  /**
   * Manually invalidate the cache
   */
  invalidate() {
    this.data = null;
    this.timestamp = null;
    
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
      this.invalidationTimer = null;
    }
    
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
      ttlMinutes: this.TTL / 60000,
      itemCount: this.data ? Object.keys(this.data).length : 0
    };
  }
}

module.exports = RankingStatsCache;
