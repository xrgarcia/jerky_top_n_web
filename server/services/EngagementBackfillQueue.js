const { Queue } = require('bullmq');
const redisClient = require('./RedisClient');
const { primaryDb } = require('../db-primary');
const { users } = require('../../shared/schema');
const { eq, sql } = require('drizzle-orm');

class EngagementBackfillQueue {
  static queue = null;
  static redis = null;

  /**
   * Initialize the BullMQ queue
   */
  static async initialize() {
    try {
      const baseClient = await redisClient.connect();
      
      if (!baseClient) {
        console.warn('⚠️  Redis not available, engagement backfill queue disabled');
        return false;
      }

      // Duplicate the hardened RedisClient connection for BullMQ
      const connection = baseClient.duplicate({
        lazyConnect: false,
        keepAlive: 30000,
        enableReadyCheck: true,
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Queue connection timeout')), 10000);
        connection.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Store Redis client reference for per-run metrics
      this.redis = baseClient;

      // Create BullMQ queue with dedicated connection
      this.queue = new Queue('engagement-backfill', {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            count: 100, // Keep last 100 completed
            age: 3600, // Remove after 1 hour
          },
          removeOnFail: {
            count: 50, // Keep last 50 failed
            age: 7200, // Remove after 2 hours
          },
        },
      });

      console.log('✅ Engagement backfill queue initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize engagement backfill queue:', error);
      return false;
    }
  }

  /**
   * Start backfilling engagement scores for all active users
   * @returns {Promise<Object>} Result object with success status and job count
   */
  static async startBackfill() {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    console.log('🚀 Starting engagement score backfill for all active users...');

    // Get all active users
    const activeUsers = await primaryDb
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.active, true));

    console.log(`📊 Found ${activeUsers.length} active users to process`);

    if (activeUsers.length === 0) {
      return {
        success: true,
        jobsEnqueued: 0,
        message: 'No active users found to backfill'
      };
    }

    // Store per-run metrics in Redis (using hash for atomic increments)
    const runKey = 'engagement-backfill:current-run';
    await this.redis.del(runKey); // Clear previous run
    await this.redis.hset(runKey, {
      total: activeUsers.length,
      completed: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
    });
    await this.redis.expire(runKey, 86400); // Expire after 24 hours

    // Enqueue jobs for each user
    const jobs = activeUsers.map(user => ({
      name: `backfill-user-${user.id}`,
      data: {
        userId: user.id,
        email: user.email,
        displayName: user.displayName || user.email,
      },
    }));

    await this.queue.addBulk(jobs);

    console.log(`✅ Enqueued ${jobs.length} backfill jobs`);

    return {
      success: true,
      jobsEnqueued: jobs.length,
      totalUsers: activeUsers.length,
    };
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue stats
   */
  static async getStats() {
    if (!this.queue || !this.redis) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        total: 0,
        isRunning: false,
        progress: 0,
      };
    }

    const [waiting, active] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
    ]);

    // Get per-run metrics from Redis
    const runKey = 'engagement-backfill:current-run';
    const runData = await this.redis.hgetall(runKey);
    
    const total = parseInt(runData.total) || 0;
    const completed = parseInt(runData.completed) || 0;
    const failed = parseInt(runData.failed) || 0;

    const isRunning = active > 0 || waiting > 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      waiting,
      active,
      completed,
      failed,
      total,
      isRunning,
      progress,
    };
  }

  /**
   * Increment completed count for current run (atomic)
   */
  static async incrementCompleted() {
    if (!this.redis) return;

    const runKey = 'engagement-backfill:current-run';
    await this.redis.hincrby(runKey, 'completed', 1);
  }

  /**
   * Increment failed count for current run (atomic)
   */
  static async incrementFailed() {
    if (!this.redis) return;

    const runKey = 'engagement-backfill:current-run';
    await this.redis.hincrby(runKey, 'failed', 1);
  }

  /**
   * Clean completed and failed jobs
   */
  static async clean() {
    if (!this.queue) {
      return { success: false, message: 'Queue not initialized' };
    }

    await this.queue.clean(0, 1000, 'completed');
    await this.queue.clean(0, 1000, 'failed');

    console.log('✅ Engagement backfill queue cleaned');
    return { success: true };
  }

  /**
   * Obliterate all jobs
   */
  static async obliterate() {
    if (!this.queue) {
      return { success: false, message: 'Queue not initialized' };
    }

    await this.queue.obliterate({ force: true });

    console.log('✅ Engagement backfill queue obliterated');
    return { success: true };
  }
}

module.exports = EngagementBackfillQueue;
