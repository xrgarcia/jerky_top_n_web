/**
 * LeaderboardCache - Singleton Pattern
 * 
 * Caches top rankers leaderboard data to avoid expensive repeated queries.
 * Uses period-aware keys to cache different leaderboard views (all_time, week, month).
 */
class LeaderboardCache {
  constructor() {
    if (LeaderboardCache.instance) {
      return LeaderboardCache.instance;
    }

    this.cache = new Map(); // key: `${period}:${limit}` -> { data, timestamp }
    this.TTL = 5 * 60 * 1000; // 5 minute TTL (same as HomeStatsCache)
    
    LeaderboardCache.instance = this;
  }

  /**
   * Generate cache key from period and limit
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {number} limit - Number of top rankers
   * @returns {string} Cache key
   */
  getCacheKey(period = 'all_time', limit = 50) {
    return `${period}:${limit}`;
  }

  /**
   * Check if cached data is still valid
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {number} limit - Number of top rankers
   * @returns {boolean} True if valid
   */
  isValid(period = 'all_time', limit = 50) {
    const key = this.getCacheKey(period, limit);
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp;
    return age < this.TTL;
  }

  /**
   * Get cached leaderboard data
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {number} limit - Number of top rankers
   * @returns {Array|null} Cached leaderboard or null if invalid
   */
  get(period = 'all_time', limit = 50) {
    if (this.isValid(period, limit)) {
      const key = this.getCacheKey(period, limit);
      const cached = this.cache.get(key);
      const ageSeconds = Math.floor((Date.now() - cached.timestamp) / 1000);
      console.log(`💾 LeaderboardCache HIT: ${key} (age: ${ageSeconds}s)`);
      return cached.data;
    }
    
    console.log(`🚫 LeaderboardCache MISS: ${period}:${limit}`);
    return null;
  }

  /**
   * Set leaderboard data in cache
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {number} limit - Number of top rankers
   * @param {Array} data - Leaderboard data
   */
  set(period = 'all_time', limit = 50, data) {
    const key = this.getCacheKey(period, limit);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`✅ LeaderboardCache SET: ${key} cached ${data.length} entries`);
  }

  /**
   * Invalidate cache for specific period or all
   * @param {string|null} period - 'all_time', 'week', 'month' or null for all
   */
  invalidate(period = null) {
    if (period) {
      // Invalidate all entries for this period (different limits)
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${period}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`🗑️ LeaderboardCache INVALIDATE: ${period} (${keysToDelete.length} entries)`);
    } else {
      // Invalidate all
      console.log('🗑️ LeaderboardCache INVALIDATE: All entries');
      this.cache.clear();
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!LeaderboardCache.instance) {
      LeaderboardCache.instance = new LeaderboardCache();
    }
    return LeaderboardCache.instance;
  }
}

// Ensure singleton instance
LeaderboardCache.instance = null;

module.exports = LeaderboardCache;
