/**
 * ProgressTracker - Domain service for tracking user progress and milestones
 */
class ProgressTracker {
  constructor(achievementRepo, streakRepo, db, collectionManager, engagementManager) {
    this.achievementRepo = achievementRepo;
    this.streakRepo = streakRepo;
    this.db = db;
    this.collectionManager = collectionManager;
    this.engagementManager = engagementManager;
  }

  /**
   * Get comprehensive user progress data
   * @param {number} userId - User ID
   * @param {number} totalRankableProducts - Total number of rankable products (for dynamic milestones)
   * @returns {Object} Complete progress information
   */
  async getUserProgress(userId, totalRankableProducts = 89) {
    const { productRankings } = require('../../shared/schema');
    const { eq, sql } = require('drizzle-orm');

    const [achievements, streaks, rankingStats, allAchievements] = await Promise.all([
      this.achievementRepo.getUserAchievements(userId),
      this.streakRepo.getAllUserStreaks(userId),
      this.db.select({
        totalRankings: sql`count(*)::int`,
        uniqueProducts: sql`count(distinct ${productRankings.shopifyProductId})::int`,
      })
      .from(productRankings)
      .where(eq(productRankings.userId, userId))
      .limit(1),
      this.achievementRepo.getAllAchievements(),
    ]);

    const stats = rankingStats[0] || { totalRankings: 0, uniqueProducts: 0 };
    const dailyStreak = streaks.find(s => s.streakType === 'daily_rank');
    const totalPoints = await this.achievementRepo.getUserTotalPoints(userId);

    const nextMilestones = this.getNextMilestones(
      stats.totalRankings, 
      stats.uniqueProducts,
      allAchievements,
      totalRankableProducts
    );

    return {
      totalRankings: stats.totalRankings,
      uniqueProducts: stats.uniqueProducts,
      achievementsEarned: achievements.length,
      totalPoints,
      currentStreak: dailyStreak?.currentStreak || 0,
      longestStreak: dailyStreak?.longestStreak || 0,
      nextMilestones,
      recentAchievements: achievements.slice(0, 10),
    };
  }

  /**
   * Get next milestones for user - dynamically based on achievement definitions
   */
  getNextMilestones(currentRankings, uniqueProducts, allAchievements, totalRankableProducts) {
    const milestones = [];
    
    // Extract rank_count based milestones from achievements
    allAchievements.forEach(achievement => {
      if (achievement.requirement.type === 'rank_count') {
        const target = achievement.requirement.value;
        if (target > currentRankings) {
          milestones.push({
            target,
            current: currentRankings,
            remaining: target - currentRankings,
            progress: Math.min(100, (currentRankings / target) * 100),
            type: 'rank_count',
            label: `${target} rankings`,
            achievementName: achievement.name,
            achievementIcon: achievement.icon,
          });
        }
      } else if (achievement.requirement.type === 'rank_all_products') {
        // Dynamic "Complete Collection" milestone
        if (uniqueProducts < totalRankableProducts) {
          milestones.push({
            target: totalRankableProducts,
            current: uniqueProducts,
            remaining: totalRankableProducts - uniqueProducts,
            progress: Math.min(100, (uniqueProducts / totalRankableProducts) * 100),
            type: 'rank_all_products',
            label: `all ${totalRankableProducts} products`,
            achievementName: achievement.name,
            achievementIcon: achievement.icon,
          });
        }
      }
    });
    
    // Sort by target and return top 3
    return milestones
      .sort((a, b) => a.target - b.target)
      .slice(0, 3);
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
