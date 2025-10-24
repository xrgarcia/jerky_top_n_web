const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected && this.client) {
      return this.client;
    }

    const redisUrl = process.env.UPSTASH_REDIS_URL;
    
    if (!redisUrl) {
      console.warn('⚠️ UPSTASH_REDIS_URL not found, using in-memory cache (not recommended for production)');
      return null;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError(err) {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        }
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('⚠️ Redis connection closed');
        this.isConnected = false;
      });

      // Test the connection
      await this.client.ping();
      console.log('🏓 Redis PING successful');
      this.isConnected = true;

      return this.client;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error.message);
      this.isConnected = false;
      return null;
    }
  }

  async get(key) {
    if (!this.client || !this.isConnected) return null;
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`❌ Redis GET error for key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = null) {
    if (!this.client || !this.isConnected) return false;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`❌ Redis SET error for key ${key}:`, error.message);
      return false;
    }
  }

  async del(key) {
    if (!this.client || !this.isConnected) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Redis DEL error for key ${key}:`, error.message);
      return false;
    }
  }

  async flush() {
    if (!this.client || !this.isConnected) return false;
    
    try {
      await this.client.flushdb();
      console.log('🗑️ Redis cache flushed');
      return true;
    } catch (error) {
      console.error('❌ Redis FLUSH error:', error.message);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('👋 Redis disconnected');
    }
  }

  getClient() {
    return this.client;
  }
}

// Singleton instance
const redisClient = new RedisClient();

module.exports = redisClient;
