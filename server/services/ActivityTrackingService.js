const { db } = require('../db');
const { userActivities } = require('../../shared/schema');
const { eq, and, gte, count, sql } = require('drizzle-orm');

/**
 * ActivityTrackingService - Logs comprehensive user activities for engagement analysis
 * 
 * Tracks:
 * - Searches (product, community)
 * - Page views (product details, user profiles)
 * - Rankings (save, update, delete)
 * - Coins earned
 * - Logins
 * - Purchases
 * 
 * Uses batching to minimize database writes while ensuring data freshness
 * Triggers classification queue for event-driven user classification
 */
class ActivityTrackingService {
  constructor() {
    // In-memory batch queue for performance
    this.batchQueue = [];
    this.batchSize = 10; // Flush after 10 activities
    this.batchTimeout = 5000; // Flush every 5 seconds
    this.batchTimer = null;
    this.classificationQueue = null; // Injected after initialization
  }
  
  /**
   * Set classification queue (dependency injection)
   */
  setClassificationQueue(queue) {
    this.classificationQueue = queue;
  }

  /**
   * Track user activity with optional batching
   * @param {number} userId - User ID
   * @param {string} activityType - Type: 'search', 'product_view', 'profile_view', 'ranking_saved', 'coin_earned', 'login', 'purchase'
   * @param {object} activityData - Additional context (search term, product ID, etc.)
   * @param {object} metadata - Extra tracking data
   * @param {boolean} immediate - Skip batching and write immediately
   */
  async track(userId, activityType, activityData = {}, metadata = {}, immediate = false) {
    if (!userId || !activityType) {
      console.warn('[ActivityTrackingService] Missing required fields:', { userId, activityType });
      return;
    }

    const activity = {
      userId,
      activityType,
      activityData,
      metadata,
      createdAt: new Date()
    };

    if (immediate) {
      // Write immediately for critical activities
      await this._writeActivity(activity);
    } else {
      // Add to batch queue
      this.batchQueue.push(activity);

      // Flush if batch size reached
      if (this.batchQueue.length >= this.batchSize) {
        await this.flush();
      } else {
        // Reset timer
        this._resetBatchTimer();
      }
    }
  }

  /**
   * Track search activity
   */
  async trackSearch(userId, searchTerm, resultCount, context = 'products') {
    await this.track(userId, 'search', {
      searchTerm,
      resultCount,
      context
    });
  }

  /**
   * Track product view
   */
  async trackProductView(userId, shopifyProductId, productTitle) {
    await this.track(userId, 'product_view', {
      shopifyProductId,
      productTitle
    });
  }

  /**
   * Track profile view
   */
  async trackProfileView(userId, viewedUserId, viewedUserName) {
    await this.track(userId, 'profile_view', {
      viewedUserId,
      viewedUserName
    });
  }

  /**
   * Track ranking saved (immediate - triggers classification update)
   */
  async trackRankingSaved(userId, shopifyProductId, ranking, totalRankings) {
    await this.track(userId, 'ranking_saved', {
      shopifyProductId,
      ranking,
      totalRankings
    }, {}, true); // Immediate write
  }

  /**
   * Track coin earned (immediate - triggers classification update)
   */
  async trackCoinEarned(userId, coinType, coinCode) {
    await this.track(userId, 'coin_earned', {
      coinType,
      coinCode
    }, {}, true); // Immediate write
  }

  /**
   * Track login (immediate - triggers classification update)
   */
  async trackLogin(userId, method = 'magic_link') {
    await this.track(userId, 'login', {
      method
    }, {}, true); // Immediate write
  }

  /**
   * Track purchase (immediate - triggers classification update)
   */
  async trackPurchase(userId, orderNumber, productCount, totalAmount) {
    await this.track(userId, 'purchase', {
      orderNumber,
      productCount,
      totalAmount
    }, {}, true); // Immediate write
  }

  /**
   * Flush batch queue to database and trigger classification
   */
  async flush(userId = null) {
    if (this.batchQueue.length === 0) {
      return;
    }

    const activities = [...this.batchQueue];
    this.batchQueue = [];
    this._clearBatchTimer();

    try {
      await db.insert(userActivities).values(activities);
      console.log(`[ActivityTrackingService] Flushed ${activities.length} activities`);
      
      // Trigger classification for affected users
      if (userId) {
        // Specific user flush (e.g., before classification)
        this._enqueueClassification(userId, 'batch_flush');
      } else {
        // General flush - enqueue for all unique users in batch
        const uniqueUsers = new Set(activities.map(a => a.userId));
        for (const uid of uniqueUsers) {
          const userActivities = activities.filter(a => a.userId === uid);
          const activityType = userActivities[0]?.activityType || 'batch_flush';
          this._enqueueClassification(uid, activityType);
        }
      }
    } catch (error) {
      console.error('[ActivityTrackingService] Error flushing batch:', error);
      // Re-queue failed activities
      this.batchQueue.unshift(...activities);
    }
  }

  /**
   * Write single activity to database and trigger classification
   */
  async _writeActivity(activity) {
    try {
      await db.insert(userActivities).values(activity);
      
      // Trigger classification queue for event-driven architecture
      this._enqueueClassification(activity.userId, activity.activityType);
    } catch (error) {
      console.error('[ActivityTrackingService] Error writing activity:', error);
    }
  }
  
  /**
   * Enqueue classification job based on activity
   */
  async _enqueueClassification(userId, activityType) {
    if (!this.classificationQueue) {
      return; // Queue not initialized
    }
    
    try {
      // Only enqueue for activity types that affect classification
      const classificationTriggers = ['search', 'product_view', 'profile_view', 'ranking_saved', 'purchase'];
      
      if (classificationTriggers.includes(activityType)) {
        await this.classificationQueue.enqueue(userId, activityType);
      }
    } catch (error) {
      console.error('[ActivityTrackingService] Error enqueueing classification:', error);
    }
  }

  /**
   * Reset batch timer
   */
  _resetBatchTimer() {
    this._clearBatchTimer();
    this.batchTimer = setTimeout(() => {
      this.flush();
    }, this.batchTimeout);
  }

  /**
   * Clear batch timer
   */
  _clearBatchTimer() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Get activity summary for user (last 30 days)
   */
  async getUserActivitySummary(userId, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const activities = await db
      .select()
      .from(userActivities)
      .where(
        and(
          eq(userActivities.userId, userId),
          gte(userActivities.createdAt, cutoffDate)
        )
      );

    // Aggregate by type
    const summary = {
      total: activities.length,
      byType: {},
      lastActivity: activities.length > 0 ? activities[activities.length - 1].createdAt : null
    };

    activities.forEach(activity => {
      if (!summary.byType[activity.activityType]) {
        summary.byType[activity.activityType] = 0;
      }
      summary.byType[activity.activityType]++;
    });

    return summary;
  }
}

// Singleton instance
const activityTrackingService = new ActivityTrackingService();

// Flush on process exit
process.on('SIGINT', async () => {
  await activityTrackingService.flush();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await activityTrackingService.flush();
  process.exit(0);
});

module.exports = activityTrackingService;
