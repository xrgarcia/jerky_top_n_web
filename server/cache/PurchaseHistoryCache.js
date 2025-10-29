/**
 * PurchaseHistoryCache - Caches user purchase history (purchased product IDs)
 * Per-user cache with TTL to minimize database queries
 */
class PurchaseHistoryCache {
  constructor(ttlMinutes = 30) {
    this.cache = new Map(); // userId -> { data, timestamp }
    this.TTL = ttlMinutes * 60 * 1000; // Convert minutes to milliseconds
  }

  /**
   * Check if cached data is still valid for a user
   * @param {number} userId - User ID
   * @returns {boolean} True if cache is valid
   */
  isValid(userId) {
    const cached = this.cache.get(userId);
    if (!cached || !cached.timestamp) {
      return false;
    }
    
    const age = Date.now() - cached.timestamp;
    return age < this.TTL;
  }

  /**
   * Get cached purchase history for a user
   * @param {number} userId - User ID
   * @returns {Array<string>|null} Array of product IDs or null if expired
   */
  get(userId) {
    if (this.isValid(userId)) {
      const cached = this.cache.get(userId);
      const ageMinutes = Math.floor((Date.now() - cached.timestamp) / 60000);
      console.log(`💾 Purchase Cache HIT for user ${userId} (age: ${ageMinutes} minutes)`);
      return cached.data;
    }
    
    console.log(`🚫 Purchase Cache MISS for user ${userId}`);
    return null;
  }

  /**
   * Store purchase history in cache for a user
   * @param {number} userId - User ID
   * @param {Array<string>} productIds - Array of purchased product IDs
   */
  set(userId, productIds) {
    const timestamp = Date.now();
    this.cache.set(userId, { data: productIds, timestamp });
    
    console.log(`✅ Purchase Cache UPDATED for user ${userId}: ${productIds.length} products, valid for ${this.TTL / 60000} minutes`);
    
    // Schedule automatic cleanup for this user's cache
    setTimeout(() => {
      this.invalidate(userId);
    }, this.TTL);
  }

  /**
   * Manually invalidate cache for a user
   * @param {number} userId - User ID (if null, clears all)
   */
  invalidate(userId = null) {
    if (userId === null) {
      console.log('🗑️ Purchase cache cleared for all users');
      this.cache.clear();
    } else {
      this.cache.delete(userId);
      console.log(`🗑️ Purchase cache invalidated for user ${userId}`);
    }
  }

  /**
   * Get cache age in minutes for a user
   * @param {number} userId - User ID
   * @returns {number|null} Age in minutes or null
   */
  getAge(userId) {
    const cached = this.cache.get(userId);
    if (!cached || !cached.timestamp) return null;
    return Math.floor((Date.now() - cached.timestamp) / 60000);
  }

  /**
   * Get cache statistics for monitoring
   * @param {number} userId - Optional user ID for specific stats
   * @returns {Object} Cache stats
   */
  getStats(userId = null) {
    if (userId !== null) {
      const cached = this.cache.get(userId);
      return {
        hasData: !!cached,
        isValid: this.isValid(userId),
        ageMinutes: this.getAge(userId),
        ttlMinutes: this.TTL / 60000,
        itemCount: cached?.data?.length || 0
      };
    }
    
    // Global stats
    return {
      totalUsers: this.cache.size,
      ttlMinutes: this.TTL / 60000,
    };
  }
}

module.exports = PurchaseHistoryCache;
