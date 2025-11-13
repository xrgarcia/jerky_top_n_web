const Redis = require('ioredis');
const EventEmitter = require('events');

class RedisClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.dependents = new Set(); // Track duplicated connections for reinitialization
  }

  async connect() {
    // Return existing connection if already connected
    if (this.isConnected && this.client && this.client.status === 'ready') {
      console.log('💾 Redis: Using existing connection (connection pool)');
      return this.client;
    }

    // If already reconnecting, wait for that to complete
    if (this.isReconnecting) {
      console.log('⏳ Redis: Reconnection in progress, waiting...');
      return new Promise((resolve) => {
        this.once('reconnected', () => resolve(this.client));
        this.once('reconnect_failed', () => resolve(null));
      });
    }

    // Environment-specific Redis URL selection
    // Production: Use UPSTASH_REDIS_URL_PROD (workaround for Replit's broken secrets sync UI)
    // Development: Use UPSTASH_REDIS_URL (standard variable name)
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
    const redisUrl = isProduction 
      ? process.env.UPSTASH_REDIS_URL_PROD 
      : process.env.UPSTASH_REDIS_URL;
    
    const varName = isProduction ? 'UPSTASH_REDIS_URL_PROD' : 'UPSTASH_REDIS_URL';
    console.log(`🔍 Redis environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`🔍 Using Redis variable: ${varName}`);
    
    if (!redisUrl) {
      console.warn(`⚠️ ${varName} not found, using in-memory cache`);
      console.warn('⚠️ Dev uses UPSTASH_REDIS_URL, prod uses UPSTASH_REDIS_URL_PROD');
      return null;
    }

    try {
      console.log('🔌 Establishing Redis connection pool...');
      
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true, // Don't auto-connect (prevents duplicate() conflicts)
        tls: {}, // Required for Upstash Redis TLS connections
        keepAlive: 30000, // Send keepalive packets every 30s (prevents idle disconnections)
        connectTimeout: 10000, // 10 second connection timeout
        retryStrategy: (times) => {
          // Exponential backoff with jitter (prevents thundering herd)
          const baseDelay = Math.min(Math.pow(2, times) * 100, 5000); // Cap at 5s
          const jitter = Math.random() * 100; // Add 0-100ms jitter
          const delay = baseDelay + jitter;
          
          if (times > this.maxReconnectAttempts) {
            console.error(`❌ Redis retry limit exceeded (${times}/${this.maxReconnectAttempts}), giving up`);
            this.emit('reconnect_failed');
            return null; // Stop retrying
          }
          
          console.log(`🔄 Redis reconnecting in ${Math.round(delay)}ms (attempt ${times}/${this.maxReconnectAttempts})...`);
          return delay;
        },
        reconnectOnError: (err) => {
          // Reconnect on READONLY errors and connection resets
          const reconnectableErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
          const shouldReconnect = reconnectableErrors.some(errType => 
            err.message.includes(errType) || err.code === errType
          );
          
          if (shouldReconnect) {
            console.log(`🔄 Redis reconnecting due to ${err.code || err.message}`);
            return true;
          }
          return false;
        }
      });

      this._setupEventHandlers();

      // Explicitly connect (lazyConnect: true means we control when to connect)
      await this.client.connect();
      
      // Test the connection
      await this.client.ping();
      console.log('🏓 Redis PING successful - connection pool active');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      return this.client;
    } catch (error) {
      console.error('❌ Failed to establish Redis connection pool:', error.message);
      this.isConnected = false;
      return null;
    }
  }

  _setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('✅ Redis connection pool established');
      this.isConnected = true;
      this.emit('connect');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis ready for commands');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      if (this.isReconnecting) {
        this.isReconnecting = false;
        console.log('🎉 Redis successfully reconnected - reinitializing dependents');
        this.emit('reconnected');
        this._reinitializeDependents();
      }
      
      this.emit('ready');
    });

    this.client.on('error', (err) => {
      // Filter out expected reconnection errors to avoid Sentry spam
      const isExpectedError = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'].includes(err.code);
      
      if (isExpectedError) {
        console.warn('⚠️ Redis connection issue (will auto-retry):', err.code || err.message);
      } else {
        console.error('❌ Redis connection error:', err.message);
      }
      
      this.isConnected = false;
      this.emit('error', err);
    });

    this.client.on('close', () => {
      console.log('⚠️ Redis connection closed - will attempt reconnection');
      this.isConnected = false;
      this.isReconnecting = true;
      this.emit('close');
    });

    this.client.on('reconnecting', (delay) => {
      this.reconnectAttempts++;
      console.log(`🔄 Redis reconnecting (attempt ${this.reconnectAttempts}, delay: ${delay}ms)...`);
      this.isReconnecting = true;
      this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    });
  }

  /**
   * Register a duplicated connection as a dependent
   * @param {Redis} duplicatedClient - The duplicated Redis client
   */
  registerDependent(duplicatedClient) {
    this.dependents.add(duplicatedClient);
  }

  /**
   * Reinitialize all dependent duplicated connections after reconnection
   * This is fired after the base connection successfully reconnects
   */
  _reinitializeDependents() {
    if (this.dependents.size === 0) return;
    
    console.log(`🔄 Reinitializing ${this.dependents.size} dependent connection(s)...`);
    
    // Clear the old dependents set - workers will re-register when they reconnect
    const oldDependents = Array.from(this.dependents);
    this.dependents.clear();
    
    // Attempt to reconnect each dependent
    oldDependents.forEach(client => {
      try {
        // Check if client is disconnected
        if (client.status === 'end' || client.status === 'close' || client.status === 'reconnecting') {
          console.log(`🔄 Reconnecting dependent client (status: ${client.status})...`);
          
          // Disconnect old client cleanly
          if (client.status !== 'end') {
            client.disconnect(false).catch(() => {});
          }
          
          // Note: Workers should handle reconnection themselves by listening to
          // the 'reconnected' event from this base client and creating new duplicate
        } else if (client.status === 'ready' || client.status === 'connect') {
          // Client is already connected, re-register it
          this.dependents.add(client);
          console.log(`✅ Dependent client already connected (status: ${client.status})`);
        }
      } catch (err) {
        console.error('❌ Error reinitializing dependent:', err.message);
      }
    });
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
