/**
 * HomeStatsCache - Singleton Pattern
 * 
 * Caches home page statistics to avoid expensive repeated database queries.
 * Home stats include top rankers, trending products, community stats, etc.
 * Uses a 5-minute TTL since these stats don't need real-time accuracy.
 */
class HomeStatsCache {
  constructor() {
    if (HomeStatsCache.instance) {
      return HomeStatsCache.instance;
    }

    this.stats = null;
    this.timestamp = null;
    this.TTL = 5 * 60 * 1000; // 5 minute TTL (balance between freshness and performance)
    
    HomeStatsCache.instance = this;
  }

  /**
   * Check if cached data is still valid
   */
  isValid() {
    if (!this.stats || !this.timestamp) {
      return false;
    }
    
    const age = Date.now() - this.timestamp;
    return age < this.TTL;
  }

  /**
   * Get cached home stats
   * @returns {Object|null} Cached stats or null if invalid
   */
  get() {
    if (this.isValid()) {
      const ageSeconds = Math.floor((Date.now() - this.timestamp) / 1000);
      console.log(`💾 HomeStatsCache HIT: Returning stats (age: ${ageSeconds}s)`);
      return this.stats;
    }
    
    console.log('🚫 HomeStatsCache MISS: Data expired or not found');
    return null;
  }

  /**
   * Set home stats in cache
   * @param {Object} stats - Home stats object
   */
  set(stats) {
    this.stats = stats;
    this.timestamp = Date.now();
    console.log(`✅ HomeStatsCache SET: Cached home stats, valid for ${this.TTL / 1000}s`);
  }

  /**
   * Invalidate the cache (e.g., when rankings or achievements change)
   */
  invalidate() {
    console.log('🗑️ HomeStatsCache INVALIDATE: Clearing cache');
    this.stats = null;
    this.timestamp = null;
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!HomeStatsCache.instance) {
      HomeStatsCache.instance = new HomeStatsCache();
    }
    return HomeStatsCache.instance;
  }
}

// Ensure singleton instance
HomeStatsCache.instance = null;

module.exports = HomeStatsCache;
