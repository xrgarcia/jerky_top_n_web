/**
 * ProgressTracker - Domain service for tracking user progress and milestones
 */
class ProgressTracker {
  constructor(achievementRepo, streakRepo, db) {
    this.achievementRepo = achievementRepo;
    this.streakRepo = streakRepo;
    this.db = db;
  }

  /**
   * Get comprehensive user progress data
   * @param {number} userId - User ID
   * @returns {Object} Complete progress information
   */
  async getUserProgress(userId) {
    const { productRankings } = require('../../shared/schema');
    const { eq, sql } = require('drizzle-orm');

    const [achievements, streaks, rankingStats] = await Promise.all([
      this.achievementRepo.getUserAchievements(userId),
      this.streakRepo.getAllUserStreaks(userId),
      this.db.select({
        totalRankings: sql`count(*)::int`,
        uniqueProducts: sql`count(distinct ${productRankings.shopifyProductId})::int`,
      })
      .from(productRankings)
      .where(eq(productRankings.userId, userId))
      .limit(1),
    ]);

    const stats = rankingStats[0] || { totalRankings: 0, uniqueProducts: 0 };
    const dailyStreak = streaks.find(s => s.streakType === 'daily_rank');
    const totalPoints = await this.achievementRepo.getUserTotalPoints(userId);

    const nextMilestones = this.getNextMilestones(stats.totalRankings);

    return {
      totalRankings: stats.totalRankings,
      uniqueProducts: stats.uniqueProducts,
      achievementsEarned: achievements.length,
      totalPoints,
      currentStreak: dailyStreak?.currentStreak || 0,
      longestStreak: dailyStreak?.longestStreak || 0,
      nextMilestones,
      recentAchievements: achievements.slice(0, 5),
    };
  }

  /**
   * Get next milestones for user
   */
  getNextMilestones(currentRankings) {
    const milestones = [1, 10, 25, 50, 100, 250, 500];
    const next = milestones.filter(m => m > currentRankings);
    
    return next.slice(0, 3).map(target => ({
      target,
      current: currentRankings,
      remaining: target - currentRankings,
      progress: Math.min(100, (currentRankings / target) * 100),
    }));
  }

  /**
   * Calculate user insights based on their rankings
   * @param {number} userId - User ID
   * @returns {Object} User insights
   */
  async getUserInsights(userId) {
    const { productRankings } = require('../../shared/schema');
    const { eq, sql } = require('drizzle-orm');

    const rankings = await this.db.select({
      productData: productRankings.productData,
      ranking: productRankings.ranking,
    })
    .from(productRankings)
    .where(eq(productRankings.userId, userId));

    const vendors = {};
    const topRanked = rankings.filter(r => r.ranking <= 5);
    
    rankings.forEach(r => {
      const vendor = r.productData?.vendor || 'Unknown';
      vendors[vendor] = (vendors[vendor] || 0) + 1;
    });

    const favoriteVendor = Object.entries(vendors)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalProducts: rankings.length,
      favoriteVendor: favoriteVendor ? {
        name: favoriteVendor[0],
        count: favoriteVendor[1],
      } : null,
      topRankedCount: topRanked.length,
      diversityScore: Object.keys(vendors).length,
    };
  }
}

module.exports = ProgressTracker;
