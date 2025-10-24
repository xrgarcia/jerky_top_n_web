const redisClient = require('./RedisClient');

class DistributedCache {
  constructor(cacheName) {
    this.cacheName = cacheName;
    this.inMemoryCache = new Map();
    this.cacheExpiry = new Map();
    this.redisAvailable = false;
  }

  async initialize() {
    const client = await redisClient.connect();
    this.redisAvailable = !!client;
    
    if (this.redisAvailable) {
      console.log(`✅ ${this.cacheName}: Using Redis for distributed caching`);
    } else {
      console.log(`⚠️ ${this.cacheName}: Using in-memory cache (single-instance only)`);
    }
  }

  _buildKey(key) {
    return `${this.cacheName}:${key}`;
  }

  async get(key) {
    const fullKey = this._buildKey(key);

    if (this.redisAvailable) {
      return await redisClient.get(fullKey);
    } else {
      // Fallback to in-memory
      const now = Date.now();
      const expiry = this.cacheExpiry.get(key);
      
      if (expiry && now > expiry) {
        this.inMemoryCache.delete(key);
        this.cacheExpiry.delete(key);
        return null;
      }
      
      return this.inMemoryCache.get(key) || null;
    }
  }

  async set(key, value, ttlSeconds = null) {
    const fullKey = this._buildKey(key);

    if (this.redisAvailable) {
      return await redisClient.set(fullKey, value, ttlSeconds);
    } else {
      // Fallback to in-memory
      this.inMemoryCache.set(key, value);
      
      if (ttlSeconds) {
        const expiryTime = Date.now() + (ttlSeconds * 1000);
        this.cacheExpiry.set(key, expiryTime);
      }
      
      return true;
    }
  }

  async del(key) {
    const fullKey = this._buildKey(key);

    if (this.redisAvailable) {
      return await redisClient.del(fullKey);
    } else {
      // Fallback to in-memory
      this.inMemoryCache.delete(key);
      this.cacheExpiry.delete(key);
      return true;
    }
  }

  async clear() {
    if (this.redisAvailable) {
      // Delete all keys with this cache prefix
      const client = redisClient.getClient();
      if (client) {
        const keys = await client.keys(`${this.cacheName}:*`);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      }
    } else {
      // Clear in-memory cache
      this.inMemoryCache.clear();
      this.cacheExpiry.clear();
    }
    
    console.log(`🗑️ ${this.cacheName}: Cache cleared`);
    return true;
  }

  isUsingRedis() {
    return this.redisAvailable;
  }
}

module.exports = DistributedCache;
