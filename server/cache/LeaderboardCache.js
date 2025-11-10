const DistributedCache = require('../services/DistributedCache');

/**
 * LeaderboardCache - Singleton Pattern with Redis Backend
 * 
 * Caches top rankers leaderboard data to avoid expensive repeated queries.
 * Uses Redis-backed DistributedCache for cross-instance consistency.
 * 
 * Key Schema:
 * - Aggregate lists: `period:${period}:top:${limit}` (e.g., 'period:all_time:top:50')
 * - User positions: `user:${userId}:${period}` (for granular invalidation)
 */
class LeaderboardCache {
  constructor() {
    if (LeaderboardCache.instance) {
      return LeaderboardCache.instance;
    }

    this.cache = new DistributedCache('leaderboard');
    this.TTL = 300; // 5 minutes in seconds (for Redis)
    this.initialized = false;
    
    LeaderboardCache.instance = this;
  }

  /**
   * Initialize the cache (must be called on startup)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('✅ LeaderboardCache initialized');
    }
  }

  /**
   * Generate cache key for aggregate leaderboard lists
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {number} limit - Number of top rankers
   * @returns {string} Cache key
   */
  getCacheKey(period = 'all_time', limit = 50) {
    return `period:${period}:top:${limit}`;
  }

  /**
   * Generate cache key for user-specific position data
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {string} Cache key
   */
  getUserCacheKey(userId, period = 'all_time') {
    return `user:${userId}:${period}`;
  }

  /**
   * Get cached leaderboard data
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {number} limit - Number of top rankers
   * @returns {Promise<Array|null>} Cached leaderboard or null if invalid
   */
  async get(period = 'all_time', limit = 50) {
    try {
      const key = this.getCacheKey(period, limit);
      const cached = await this.cache.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`💾 LeaderboardCache HIT: ${key} (${data.length} entries)`);
        return data;
      }
      
      console.log(`🚫 LeaderboardCache MISS: ${key}`);
      return null;
    } catch (error) {
      console.error('❌ LeaderboardCache GET error:', error.message);
      return null;
    }
  }

  /**
   * Set leaderboard data in cache
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {number} limit - Number of top rankers
   * @param {Array} data - Leaderboard data
   */
  async set(period = 'all_time', limit = 50, data) {
    try {
      const key = this.getCacheKey(period, limit);
      const serialized = JSON.stringify(data);
      await this.cache.set(key, serialized, this.TTL);
      console.log(`✅ LeaderboardCache SET: ${key} cached ${data.length} entries`);
    } catch (error) {
      console.error('❌ LeaderboardCache SET error:', error.message);
    }
  }

  /**
   * Get cached user position data
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @returns {Promise<Object|null>} Cached position or null
   */
  async getUserPosition(userId, period = 'all_time') {
    try {
      const key = this.getUserCacheKey(userId, period);
      const cached = await this.cache.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('❌ LeaderboardCache getUserPosition error:', error.message);
      return null;
    }
  }

  /**
   * Set user position data in cache
   * @param {number} userId - User ID
   * @param {string} period - 'all_time', 'week', 'month'
   * @param {Object} data - Position data
   */
  async setUserPosition(userId, period = 'all_time', data) {
    try {
      const key = this.getUserCacheKey(userId, period);
      const serialized = JSON.stringify(data);
      await this.cache.set(key, serialized, this.TTL);
    } catch (error) {
      console.error('❌ LeaderboardCache setUserPosition error:', error.message);
    }
  }

  /**
   * Invalidate cache entries based on activity metadata
   * GRANULAR: Only invalidates affected periods based on timestamp
   * @param {Object} options - Invalidation options
   * @param {number} options.userId - User ID whose data changed
   * @param {Date} options.activityTimestamp - When the activity occurred
   */
  async invalidateUser(options = {}) {
    const { userId, activityTimestamp } = options;
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    const activityTime = activityTimestamp ? new Date(activityTimestamp).getTime() : now;

    try {
      // Helper: Delete all keys matching a pattern using Redis SCAN
      const deletePattern = async (pattern) => {
        if (this.cache.isUsingRedis()) {
          const redisClient = require('../services/RedisClient');
          const client = redisClient.getClient();
          if (client) {
            const fullPattern = `leaderboard:${pattern}`;
            const keys = await client.keys(fullPattern);
            if (keys.length > 0) {
              await client.del(...keys);
              console.log(`  🗑️ Deleted ${keys.length} keys matching: ${pattern}`);
            }
          }
        } else {
          // Fallback for in-memory cache (not pattern-based, delete known variants)
          const knownLimits = [5, 10, 20, 50, 100];
          for (const limit of knownLimits) {
            const key = pattern.replace('*', limit);
            await this.cache.del(key);
          }
        }
      };
      
      // Always invalidate all_time leaderboards (activity affects lifetime stats)
      await deletePattern(`period:all_time:top:*`);
      
      // Only invalidate week/month if activity falls within those windows
      if (activityTime >= weekAgo) {
        await deletePattern(`period:week:top:*`);
      }
      
      if (activityTime >= monthAgo) {
        await deletePattern(`period:month:top:*`);
      }
      
      // Invalidate user-specific position caches
      if (userId) {
        await this.cache.del(`user:${userId}:all_time`);
        if (activityTime >= weekAgo) {
          await this.cache.del(`user:${userId}:week`);
        }
        if (activityTime >= monthAgo) {
          await this.cache.del(`user:${userId}:month`);
        }
      }
      
      console.log(`🗑️ LeaderboardCache INVALIDATE USER: ${userId} (granular, timestamp-aware, pattern-based)`);
    } catch (error) {
      console.error('❌ LeaderboardCache invalidateUser error:', error.message);
    }
  }

  /**
   * Invalidate cache for specific period or all (legacy method)
   * @param {string|null} period - 'all_time', 'week', 'month' or null for all
   */
  async invalidate(period = null) {
    try {
      if (period) {
        // Invalidate all entries for this period (all limits) using pattern matching
        if (this.cache.isUsingRedis()) {
          const redisClient = require('../services/RedisClient');
          const client = redisClient.getClient();
          if (client) {
            const pattern = `leaderboard:period:${period}:top:*`;
            const keys = await client.keys(pattern);
            if (keys.length > 0) {
              await client.del(...keys);
              console.log(`🗑️ LeaderboardCache INVALIDATE: ${period} (${keys.length} keys)`);
            }
          }
        } else {
          // Fallback for in-memory cache
          const knownLimits = [5, 10, 20, 50, 100];
          for (const limit of knownLimits) {
            await this.cache.del(`period:${period}:top:${limit}`);
          }
          console.log(`🗑️ LeaderboardCache INVALIDATE: ${period}`);
        }
      } else {
        // Invalidate all (clear entire cache namespace)
        await this.cache.clear();
        console.log('🗑️ LeaderboardCache INVALIDATE: All entries');
      }
    } catch (error) {
      console.error('❌ LeaderboardCache invalidate error:', error.message);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!LeaderboardCache.instance) {
      LeaderboardCache.instance = new LeaderboardCache();
    }
    return LeaderboardCache.instance;
  }
}

// Ensure singleton instance
LeaderboardCache.instance = null;

module.exports = LeaderboardCache;
