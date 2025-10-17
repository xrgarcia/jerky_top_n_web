/**
 * AchievementCache - Singleton Pattern
 * 
 * Caches achievement definitions to avoid repeated database queries.
 * Since achievement definitions rarely change, we can keep them in memory
 * with a longer TTL or invalidate only when definitions are updated.
 */
class AchievementCache {
  constructor() {
    if (AchievementCache.instance) {
      return AchievementCache.instance;
    }

    this.definitions = null;
    this.timestamp = null;
    this.TTL = 60 * 60 * 1000; // 1 hour TTL (achievements rarely change)
    
    AchievementCache.instance = this;
  }

  /**
   * Check if cached data is still valid
   */
  isValid() {
    if (!this.definitions || !this.timestamp) {
      return false;
    }
    
    const age = Date.now() - this.timestamp;
    return age < this.TTL;
  }

  /**
   * Get cached achievement definitions
   * @returns {Array|null} Cached definitions or null if invalid
   */
  get() {
    if (this.isValid()) {
      const ageMinutes = Math.floor((Date.now() - this.timestamp) / 60000);
      console.log(`💾 AchievementCache HIT: Returning ${this.definitions.length} definitions (age: ${ageMinutes} minutes)`);
      return this.definitions;
    }
    
    console.log('🚫 AchievementCache MISS: Data expired or not found');
    return null;
  }

  /**
   * Set achievement definitions in cache
   * @param {Array} definitions - Array of achievement definitions
   */
  set(definitions) {
    this.definitions = definitions;
    this.timestamp = Date.now();
    console.log(`✅ AchievementCache SET: Cached ${definitions.length} definitions`);
  }

  /**
   * Invalidate the cache (e.g., when definitions are updated)
   */
  invalidate() {
    console.log('🗑️ AchievementCache INVALIDATE: Clearing cache');
    this.definitions = null;
    this.timestamp = null;
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
