const DistributedCache = require('./DistributedCache');

/**
 * RecentAchievementTracker
 * 
 * Prevents duplicate achievement toast notifications by tracking recently emitted
 * achievements per user with a 5-minute TTL. This solves the issue where rapid
 * ranking operations trigger multiple recalculations of the same dynamic collection,
 * causing duplicate WebSocket emissions for already-achieved items.
 * 
 * Example scenario:
 * - User ranks products 20, 21, 22, 23, 24, 25 rapidly
 * - Product #24 completes "Original Master" (diamond tier)
 * - Product #25 recalculates and sees "Original Master" still at diamond
 * - Without tracking, both emit the same achievement toast
 * 
 * Solution:
 * - Track achievement signatures (code + tier) per user
 * - Skip re-emitting within 5-minute window
 * - Separate tracking for tier upgrades (silver vs gold are different events)
 */
class RecentAchievementTracker {
  constructor() {
    this.cache = new DistributedCache('recentAchievements');
    this.TTL_SECONDS = 300; // 5 minutes
  }

  async initialize() {
    await this.cache.initialize();
  }

  /**
   * Generate a unique signature for an achievement
   * Format: code_tier (e.g., "original_master_diamond")
   * Tier is included to allow separate notifications for tier upgrades
   */
  _getSignature(achievement) {
    const code = achievement.code;
    const tier = achievement.tier || achievement.newTier || 'base';
    return `${code}_${tier}`;
  }

  /**
   * Get the set of recently emitted achievement signatures for a user
   */
  async _getUserEmittedSet(userId) {
    const key = `user_${userId}`;
    const data = await this.cache.get(key);
    return data ? new Set(data) : new Set();
  }

  /**
   * Save the set of recently emitted achievement signatures for a user
   */
  async _saveUserEmittedSet(userId, emittedSet) {
    const key = `user_${userId}`;
    const data = Array.from(emittedSet);
    await this.cache.set(key, data, this.TTL_SECONDS);
  }

  /**
   * Check if an achievement was recently emitted to this user
   * Returns true if it was already emitted (should skip)
   */
  async wasRecentlyEmitted(userId, achievement) {
    const signature = this._getSignature(achievement);
    const emittedSet = await this._getUserEmittedSet(userId);
    return emittedSet.has(signature);
  }

  /**
   * Mark an achievement as emitted for this user
   */
  async markAsEmitted(userId, achievement) {
    const signature = this._getSignature(achievement);
    const emittedSet = await this._getUserEmittedSet(userId);
    emittedSet.add(signature);
    await this._saveUserEmittedSet(userId, emittedSet);
  }

  /**
   * Filter a list of achievements to remove recently emitted ones
   * Returns { filtered, skipped } where:
   * - filtered: achievements that should be emitted
   * - skipped: achievements that were recently emitted (for logging)
   */
  async filterAchievements(userId, achievements) {
    if (!achievements || achievements.length === 0) {
      return { filtered: [], skipped: [] };
    }

    const emittedSet = await this._getUserEmittedSet(userId);
    const filtered = [];
    const skipped = [];
    const newSignatures = new Set(emittedSet);

    for (const achievement of achievements) {
      const signature = this._getSignature(achievement);
      
      if (emittedSet.has(signature)) {
        // Already emitted recently, skip it
        skipped.push(achievement);
      } else {
        // New achievement, include it and mark for tracking
        filtered.push(achievement);
        newSignatures.add(signature);
      }
    }

    // Save updated set if any new achievements were added
    if (filtered.length > 0) {
      await this._saveUserEmittedSet(userId, newSignatures);
    }

    return { filtered, skipped };
  }

  /**
   * Clear tracking for a specific user (useful for testing)
   */
  async clearUser(userId) {
    const key = `user_${userId}`;
    await this.cache.del(key);
  }

  /**
   * Clear all tracking (useful for admin operations)
   */
  async clearAll() {
    await this.cache.clear();
  }

  isUsingRedis() {
    return this.cache.isUsingRedis();
  }
}

// Export singleton instance
const recentAchievementTracker = new RecentAchievementTracker();
module.exports = recentAchievementTracker;
