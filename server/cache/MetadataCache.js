/**
 * MetadataCache - Caches product metadata (animal categorization)
 * Invalidated only by webhooks - no TTL expiration
 */
class MetadataCache {
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
    
    console.log(`✅ Metadata Cache UPDATED: Stored ${Object.keys(metadataMap).length} products (webhook-invalidated only)`);
  }

  /**
   * Update a single product in the cache (called by webhooks)
   * @param {string} shopifyProductId - The product ID to update
   * @param {Object} metadata - The metadata to store
   */
  updateProduct(shopifyProductId, metadata) {
    if (!this.data) {
      console.log('⚠️ MetadataCache: Cache not initialized, cannot update single product');
      return;
    }
    
    this.data[shopifyProductId] = metadata;
    console.log(`✅ MetadataCache: Updated product ${shopifyProductId} (${metadata.title || 'unknown'})`);
  }

  /**
   * Invalidate entire cache (called by admin tools for manual cache clearing)
   */
  invalidate() {
    this.data = null;
    this.timestamp = null;
    
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
      ttl: 'webhook-only',
      itemCount: this.data ? Object.keys(this.data).length : 0
    };
  }
}

module.exports = MetadataCache;
