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

    // Build stats object for getClosestUnearnedAchievement
    const userStats = {
      totalRankings: stats.totalRankings,
      uniqueProducts: stats.uniqueProducts,
      currentStreak: dailyStreak?.currentStreak || 0,
      totalRankableProducts,
      leaderboardPosition: 0, // Will be fetched if needed by managers
    };

    // Get closest unearned achievement (supports all types: collection & engagement)
    const closestAchievement = await this.getClosestUnearnedAchievement(userId, userStats);
    
    // Build nextMilestones array with the closest achievement
    const nextMilestones = closestAchievement ? [closestAchievement] : [];

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
   * Get the closest unearned achievement across all types (collection & engagement)
   * @param {number} userId - User ID
   * @param {Object} stats - User stats object with all required data
   * @returns {Object|null} The closest unearned achievement with progress data
   */
  async getClosestUnearnedAchievement(userId, stats) {
    try {
      // Get all achievements with their current progress (both collection and engagement)
      const achievements = await this.engagementManager.getAchievementsWithProgress(userId, stats);
      
      console.log(`📊 ProgressTracker: Found ${achievements.length} total achievements for user ${userId}`);
      const earnedCount = achievements.filter(a => a.earned).length;
      const unearnedCount = achievements.filter(a => !a.earned).length;
      console.log(`   ✅ Earned: ${earnedCount} | 🔒 Unearned: ${unearnedCount}`);
      
      // Filter to only unearned achievements with progress data
      const unearnedAchievements = achievements
        .filter(a => {
          if (a.earned || !a.progress) return false;
          // Accept if has either engagement format (current/required) OR collection format (totalRanked/totalAvailable)
          return (a.progress.required !== undefined) || (a.progress.totalAvailable !== undefined);
        })
        .map(a => {
          // Collection achievements use totalRanked/totalAvailable/percentage
          // Engagement achievements use current/required (need to calculate percentage)
          const isCollection = a.progress.totalAvailable !== undefined;
          
          const current = isCollection ? (a.progress.totalRanked || 0) : (a.progress.current || 0);
          const required = isCollection ? (a.progress.totalAvailable || 1) : (a.progress.required || 1);
          const percentage = isCollection && a.progress.percentage !== undefined 
            ? a.progress.percentage 
            : Math.min(100, (current / required) * 100);
          
          return {
            achievementId: a.id,
            achievementName: a.name,
            achievementIcon: a.iconType === 'image' ? a.icon : a.icon,
            achievementIconType: a.iconType,
            current,
            target: required,
            remaining: Math.max(0, required - current),
            progress: percentage,
            type: a.requirement?.type || 'unknown',
            label: this.getAchievementLabel(a),
            collectionType: a.collectionType,
            category: a.category,
          };
        });
      
      console.log(`📊 ProgressTracker: ${unearnedAchievements.length} unearned achievements have progress data`);
      
      // Sort by progress percentage (descending) to get the closest one
      const sortedByProgress = unearnedAchievements.sort((a, b) => b.progress - a.progress);
      
      if (sortedByProgress.length > 0) {
        const closest = sortedByProgress[0];
        console.log(`🎯 Closest unearned achievement: ${closest.achievementName} (${closest.progress.toFixed(1)}% complete - ${closest.current}/${closest.target})`);
        return closest;
      } else {
        console.log(`✅ ProgressTracker: No unearned achievements with progress data (user may have earned all available achievements)`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting closest unearned achievement:', error);
      return null;
    }
  }

  /**
   * Generate a readable label for an achievement
   */
  getAchievementLabel(achievement) {
    const type = achievement.requirement?.type;
    const value = achievement.requirement?.value || achievement.requirement?.days || 1;
    
    // Achievement type labels
    const labels = {
      rank_count: `${value} rankings`,
      rank_all_products: `all products`,
      search_count: `${value} searches`,
      streak_days: `${value}-day streak`,
      login_streak_days: `${value}-day login streak`,
      page_view_count: `${value} page views`,
      product_view_count: `${value} product views`,
      unique_product_view_count: `${value} unique products`,
      profile_view_count: `${value} profile views`,
      unique_profile_view_count: `${value} unique profiles`,
      rank_collection: achievement.name,
      rank_animal_categories: achievement.name,
      rank_vendors: achievement.name,
    };
    
    return labels[type] || achievement.name;
  }

  /**
   * Get next milestones for user - dynamically based on achievement definitions
   * DEPRECATED: Use getClosestUnearnedAchievement instead for better cross-type support
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
