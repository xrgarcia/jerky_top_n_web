/**
 * MetadataCache - Caches product metadata (animal categorization)
 * Follows the same OOP pattern as RankingStatsCache
 */
class MetadataCache {
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
   * Get cached metadata map
   * @returns {Object|null} - Map of shopifyProductId -> metadata, or null if invalid
   */
  get() {
    if (this.isValid()) {
      const ageMinutes = Math.floor((Date.now() - this.timestamp) / 60000);
      console.log(`💾 Metadata Cache HIT: Returning data (age: ${ageMinutes} minutes)`);
      return this.data;
    }
    
    console.log('🚫 Metadata Cache MISS: Data expired or not found');
    return null;
  }

  /**
   * Store metadata in cache
   * @param {Object} metadataMap - Map of shopifyProductId -> metadata
   */
  set(metadataMap) {
    this.data = metadataMap;
    this.timestamp = Date.now();
    
    // Clear existing timer
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }
    
    // Schedule automatic invalidation
    this.invalidationTimer = setTimeout(() => {
      console.log('⏰ Metadata cache expired - will refresh on next request');
      this.invalidate();
    }, this.TTL);
    
    console.log(`✅ Metadata Cache UPDATED: Stored ${Object.keys(metadataMap).length} products, valid for ${this.TTL / 60000} minutes`);
    console.log(`⏰ Next cache invalidation scheduled in ${this.TTL / 60000} minutes`);
  }

  /**
   * Manually invalidate cache (e.g., when products are synced)
   */
  invalidate() {
    this.data = null;
    this.timestamp = null;
    
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
      this.invalidationTimer = null;
    }
    
    console.log('🗑️ Metadata cache invalidated');
  }

  /**
   * Get cache age in minutes
   */
  getAge() {
    if (!this.timestamp) return null;
    return Math.floor((Date.now() - this.timestamp) / 60000);
  }

  /**
   * Get cache statistics for monitoring
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

module.exports = MetadataCache;
