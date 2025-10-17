/**
 * LeaderboardPositionCache - Singleton Pattern
 * 
 * Caches user leaderboard positions to avoid expensive window function queries.
 * Positions are cached per-user with a 5-minute TTL since they change more
 * frequently than achievement definitions but not on every request.
 */
class LeaderboardPositionCache {
  constructor() {
    if (LeaderboardPositionCache.instance) {
      return LeaderboardPositionCache.instance;
    }

    this.positions = new Map(); // userId -> { data, timestamp }
    this.TTL = 5 * 60 * 1000; // 5 minute TTL
    
    LeaderboardPositionCache.instance = this;
  }

  /**
   * Generate cache key from userId and period
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {string} Cache key
   */
  getCacheKey(userId, period = 'all_time') {
    return `${userId}:${period}`;
  }

  /**
   * Check if cached position is still valid
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {boolean} True if valid
   */
  isValid(userId, period = 'all_time') {
    const key = this.getCacheKey(userId, period);
    const cached = this.positions.get(key);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp;
    return age < this.TTL;
  }

  /**
   * Get cached position for a user
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {Object|null} Cached position data or null if invalid
   */
  get(userId, period = 'all_time') {
    if (this.isValid(userId, period)) {
      const key = this.getCacheKey(userId, period);
      const cached = this.positions.get(key);
      const ageSeconds = Math.floor((Date.now() - cached.timestamp) / 1000);
      console.log(`💾 LeaderboardPositionCache HIT: User ${userId} (${period}) position ${cached.data.rank} (age: ${ageSeconds}s)`);
      return cached.data;
    }
    
    console.log(`🚫 LeaderboardPositionCache MISS: User ${userId} (${period})`);
    return null;
  }

  /**
   * Set position for a user in cache
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {Object} data - Position data
   */
  set(userId, period = 'all_time', data) {
    const key = this.getCacheKey(userId, period);
    this.positions.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`✅ LeaderboardPositionCache SET: User ${userId} (${period}) rank ${data.rank}`);
  }

  /**
   * Invalidate cache for a specific user (all periods)
   * @param {number} userId - User ID
   */
  invalidate(userId) {
    if (userId) {
      const periods = ['all_time', 'week', 'month'];
      periods.forEach(period => {
        const key = this.getCacheKey(userId, period);
        this.positions.delete(key);
      });
      console.log(`🗑️ LeaderboardPositionCache INVALIDATE: User ${userId} (all periods)`);
    } else {
      console.log('🗑️ LeaderboardPositionCache INVALIDATE: All positions');
      this.positions.clear();
    }
  }

  /**
   * Invalidate all cached positions (e.g., when rankings change)
   */
  invalidateAll() {
    console.log('🗑️ LeaderboardPositionCache INVALIDATE ALL: Clearing all positions');
    this.positions.clear();
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!LeaderboardPositionCache.instance) {
      LeaderboardPositionCache.instance = new LeaderboardPositionCache();
    }
    return LeaderboardPositionCache.instance;
  }
}

// Ensure singleton instance
LeaderboardPositionCache.instance = null;

module.exports = LeaderboardPositionCache;
