const DistributedCache = require('../services/DistributedCache');

/**
 * MetadataCache - Redis-backed distributed cache for product metadata
 * Caches animal categorization, vendor, and other metadata
 * Invalidated only by webhooks - no TTL expiration
 * 
 * Cache Keys:
 * - all_metadata → Entire map of shopifyProductId -> metadata
 * - timestamp → Last update timestamp for age tracking
 * 
 * TTL: No expiration (webhook-invalidated only)
 */
class MetadataCache {
  constructor() {
    this.cache = new DistributedCache('metadata');
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
      console.log('✅ MetadataCache initialized');
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

      const data = await this.cache.get('all_metadata');
      const timestamp = await this.cache.get('timestamp');
      return data !== null && timestamp !== null;
    } catch (error) {
      console.error('❌ MetadataCache isValid error:', error.message);
      return false;
    }
  }

  /**
   * Get cached metadata map
   * @returns {Object|null} - Map of shopifyProductId -> metadata, or null if invalid
   */
  async get() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const data = await this.cache.get('all_metadata');
      
      if (data) {
        const timestamp = await this.cache.get('timestamp');
        if (timestamp) {
          const ageMinutes = Math.floor((Date.now() - timestamp) / 60000);
          console.log(`💾 Metadata Cache HIT: Returning data (age: ${ageMinutes} minutes)`);
        } else {
          console.log(`💾 Metadata Cache HIT: Returning data`);
        }
        return data; // Already deserialized by DistributedCache
      }
      
      console.log('🚫 Metadata Cache MISS: Data expired or not found');
      return null;
    } catch (error) {
      console.error('❌ MetadataCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Store metadata in cache
   * @param {Object} metadataMap - Map of shopifyProductId -> metadata
   */
  async set(metadataMap) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await this.cache.set('all_metadata', metadataMap, null); // No TTL, DistributedCache handles serialization
      await this.cache.set('timestamp', Date.now(), null);
      
      console.log(`✅ Metadata Cache UPDATED: Stored ${Object.keys(metadataMap).length} products (webhook-invalidated only)`);
    } catch (error) {
      console.error('❌ MetadataCache SET error:', error.message);
    }
  }

  /**
   * Update a single product in the cache (called by webhooks)
   * @param {string} shopifyProductId - The product ID to update
   * @param {Object} metadata - The metadata to store
   */
  async updateProduct(shopifyProductId, metadata) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const data = await this.cache.get('all_metadata');
      
      if (!data) {
        console.log('⚠️ MetadataCache: Cache not initialized, cannot update single product');
        return;
      }
      
      const metadataMap = data; // Already deserialized by DistributedCache
      metadataMap[shopifyProductId] = metadata;
      
      await this.cache.set('all_metadata', metadataMap, null); // DistributedCache handles serialization
      await this.cache.set('timestamp', Date.now(), null);
      
      console.log(`✅ MetadataCache: Updated product ${shopifyProductId} (${metadata.title || 'unknown'}) - timestamp reset`);
    } catch (error) {
      console.error('❌ MetadataCache updateProduct error:', error.message);
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

      await this.cache.del('all_metadata');
      await this.cache.del('timestamp');
      
      console.log('🗑️ Metadata cache invalidated');
    } catch (error) {
      console.error('❌ MetadataCache invalidate error:', error.message);
    }
  }

  /**
   * Get cache age in minutes
   */
  async getAge() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const timestamp = await this.cache.get('timestamp');
      if (!timestamp) return null;
      return Math.floor((Date.now() - timestamp) / 60000);
    } catch (error) {
      console.error('❌ MetadataCache getAge error:', error.message);
      return null;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const data = await this.cache.get('all_metadata');
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
      console.error('❌ MetadataCache getStats error:', error.message);
      return {
        hasData: false,
        isValid: false,
        ageMinutes: null,
        ttl: 'webhook-only',
        itemCount: 0,
        usingRedis: this.cache.isUsingRedis()
      };
    }
  }
}

module.exports = MetadataCache;
