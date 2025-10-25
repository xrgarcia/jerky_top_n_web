const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    // Return existing connection if already connected
    if (this.isConnected && this.client && this.client.status === 'ready') {
      console.log('💾 Redis: Using existing connection (connection pool)');
      return this.client;
    }

    // Detect environment: production deployment vs development
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
    const environment = isProduction ? 'production' : 'development';
    
    // Select appropriate Redis URL based on environment
    const redisUrl = isProduction 
      ? process.env.UPSTASH_REDIS_URL_PROD 
      : process.env.UPSTASH_REDIS_URL;
    
    const urlSource = isProduction ? 'UPSTASH_REDIS_URL_PROD' : 'UPSTASH_REDIS_URL';
    
    // Production safety: NEVER fall back to dev Redis (causes cache pollution/data leaks)
    if (!redisUrl) {
      if (isProduction) {
        console.error('❌ CRITICAL: UPSTASH_REDIS_URL_PROD not found in production!');
        console.error('❌ Production MUST have its own Redis database for data isolation.');
        console.error('❌ Falling back to in-memory cache (single-instance only).');
        console.error('❌ ADD UPSTASH_REDIS_URL_PROD SECRET IMMEDIATELY!');
      } else {
        console.warn(`⚠️ ${urlSource} not found for ${environment}, using in-memory cache`);
      }
      return null;
    }

    try {
      console.log(`🔌 Establishing Redis connection pool for ${environment}...`);
      console.log(`📍 Using Redis database: ${urlSource}`);
      
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false, // Connect immediately
        retryStrategy(times) {
          if (times > 3) {
            console.log('❌ Redis retry limit exceeded, using in-memory fallback');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 100, 2000);
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
        console.log('✅ Redis connection pool established');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis ready for commands');
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
      console.log(`🏓 Redis PING successful - connection pool active (${environment})`);
      this.isConnected = true;

      return this.client;
    } catch (error) {
      console.error('❌ Failed to establish Redis connection pool:', error.message);
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
