/**
 * UserStatsAggregator - Facade Pattern
 * 
 * Aggregates multiple user statistics queries into batched operations
 * for improved performance. Follows the Facade design pattern to provide
 * a simplified interface for complex subsystem interactions.
 */
class UserStatsAggregator {
  constructor(leaderboardManager, streakManager, productsService) {
    this.leaderboardManager = leaderboardManager;
    this.streakManager = streakManager;
    this.productsService = productsService;
  }

  /**
   * Fetch all user statistics in parallel batches
   * Uses Promise.all to execute independent queries concurrently
   * 
   * @param {number} userId - User ID
   * @returns {Object} Aggregated user statistics
   */
  async getAggregatedUserStats(userId) {
    const startTime = Date.now();
    
    // Batch 1: Execute all independent queries in parallel
    const batch1Start = Date.now();
    const [userStats, position, streaks] = await Promise.all([
      this.leaderboardManager.getUserStats(userId),
      this.leaderboardManager.getUserPosition(userId),
      this.streakManager.getUserStreaks(userId)
    ]);
    const batch1Time = Date.now() - batch1Start;
    console.log(`⏱️ Batch 1 completed in ${batch1Time}ms (getUserStats + getUserPosition + getUserStreaks)`);

    // Batch 2: Execute dependent queries (needs productsService)
    const batch2Start = Date.now();
    const completedAnimalCategories = await this.leaderboardManager.getCompletedAnimalCategories(
      userId, 
      this.productsService
    );
    const batch2Time = Date.now() - batch2Start;
    console.log(`⏱️ Batch 2 completed in ${batch2Time}ms (getCompletedAnimalCategories)`);

    // Extract daily streak
    const dailyStreak = streaks.find(s => s.streakType === 'daily_rank');

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ Total aggregation time: ${totalTime}ms`);

    // Return aggregated data transfer object (DTO)
    return {
      userStats,
      leaderboardPosition: position.rank || 999,
      currentStreak: dailyStreak?.currentStreak || 0,
      longestStreak: dailyStreak?.longestStreak || 0,
      completedAnimalCategories,
      streaks
    };
  }

  /**
   * Get combined stats for achievements calculation
   * Optimized specifically for achievement progress tracking
   * 
   * @param {number} userId - User ID
   * @param {number} totalRankableProducts - Total products available
   * @returns {Object} Stats object ready for achievement evaluation
   */
  async getStatsForAchievements(userId, totalRankableProducts) {
    const aggregatedStats = await this.getAggregatedUserStats(userId);

    return {
      ...aggregatedStats.userStats,
      leaderboardPosition: aggregatedStats.leaderboardPosition,
      totalRankings: aggregatedStats.userStats.totalRankings,
      currentStreak: aggregatedStats.currentStreak,
      totalRankableProducts,
      completedAnimalCategories: aggregatedStats.completedAnimalCategories,
    };
  }
}

module.exports = UserStatsAggregator;
