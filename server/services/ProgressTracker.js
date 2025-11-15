const { TIER_EMOJIS } = require('../../shared/constants/tierEmojis');

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
   * Includes tier upgrade progress for partially-earned tiered achievements
   * @param {number} userId - User ID
   * @param {Object} stats - User stats object with all required data
   * @param {string} categoryFilter - Optional category filter ('ranking', 'engagement', 'flavor', etc.)
   * @returns {Object|null} The closest unearned achievement with progress data
   */
  async getClosestUnearnedAchievement(userId, stats, categoryFilter = null) {
    try {
      // Get all achievements with their current progress (both collection and engagement)
      const achievements = await this.engagementManager.getAchievementsWithProgress(userId, stats);
      
      console.log(`📊 ProgressTracker: Found ${achievements.length} total achievements for user ${userId}`);
      const earnedCount = achievements.filter(a => a.earned).length;
      const unearnedCount = achievements.filter(a => !a.earned).length;
      console.log(`   ✅ Earned: ${earnedCount} | 🔒 Unearned: ${unearnedCount}`);
      
      // Filter to unearned achievements OR earned tiered achievements with tier upgrades available
      const candidateAchievements = achievements
        .filter(a => {
          // Apply category filter if specified (e.g., only 'ranking' achievements)
          if (categoryFilter && a.category !== categoryFilter) return false;
          
          // Exclude flavor_coin achievements - they're always one achievement away and skew the calculation
          if (a.collectionType === 'flavor_coin') return false;
          
          // Must have progress data
          if (!a.progress) return false;
          
          // Case 1: Unearned achievements (normal case)
          if (!a.earned && !a.earnedAt) {
            // Accept if has either engagement format (current/required) OR collection format (totalRanked/totalAvailable)
            return (a.progress.required !== undefined) || (a.progress.totalAvailable !== undefined);
          }
          
          // Case 2: Earned tiered achievements with tier upgrades available
          if ((a.earned || a.earnedAt) && a.hasTiers && a.tierThresholds) {
            const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
            const currentTierIndex = tierOrder.indexOf(a.currentTier);
            const maxTierIndex = tierOrder.length - 1;
            
            // Only include if there's a higher tier available
            if (currentTierIndex >= 0 && currentTierIndex < maxTierIndex) {
              console.log(`🔼 Tier upgrade available: ${a.name} (${a.currentTier} → next tier)`);
              return true;
            }
          }
          
          return false;
        })
        .map(a => {
          // Check if this is a tier upgrade scenario
          const isTierUpgrade = (a.earned || a.earnedAt) && a.hasTiers && a.tierThresholds;
          
          if (isTierUpgrade) {
            // Calculate progress toward next tier
            const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
            const currentTierIndex = tierOrder.indexOf(a.currentTier);
            const nextTier = tierOrder[currentTierIndex + 1];
            const nextTierThreshold = a.tierThresholds[nextTier];
            
            // Guard: Skip if next tier threshold is missing
            if (!nextTierThreshold || nextTierThreshold <= 0) {
              console.warn(`⚠️ Missing or invalid tier threshold for ${a.name} → ${nextTier}`);
              return null;
            }
            
            const currentPercentage = a.progress.percentage || 0;
            const progressTowardNextTier = (currentPercentage / nextTierThreshold) * 100;
            
            // Calculate how many more products needed
            const totalAvailable = a.progress.totalAvailable || 1;
            const currentRanked = a.progress.totalRanked || 0;
            const requiredForNextTier = Math.ceil((nextTierThreshold / 100) * totalAvailable);
            const remaining = Math.max(0, requiredForNextTier - currentRanked);
            
            console.log(`🎯 Tier upgrade: ${a.name} - ${currentRanked}/${requiredForNextTier} for ${nextTier} (${progressTowardNextTier.toFixed(1)}%)`);
            
            const milestone = {
              achievementId: a.id,
              achievementName: a.name,
              achievementIcon: a.iconType === 'image' ? a.icon : a.icon,
              achievementIconType: a.iconType,
              current: currentRanked,
              target: requiredForNextTier,
              remaining,
              progress: progressTowardNextTier,
              type: a.requirement?.type || 'unknown',
              label: this.getAchievementLabel(a),
              collectionType: a.collectionType,
              category: a.category,
              isTierUpgrade: true,
              currentTier: a.currentTier,
              nextTier,
            };
            
            // Add contextual action text
            milestone.actionText = this._generateActionText(milestone);
            
            return milestone;
          } else {
            // Normal unearned achievement
            const isCollection = a.progress.totalAvailable !== undefined;
            
            const current = isCollection ? (a.progress.totalRanked || 0) : (a.progress.current || 0);
            const required = isCollection ? (a.progress.totalAvailable || 1) : (a.progress.required || 1);
            const percentage = isCollection && a.progress.percentage !== undefined 
              ? a.progress.percentage 
              : Math.min(100, (current / required) * 100);
            
            const milestone = {
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
              isTierUpgrade: false,
            };
            
            // Add contextual action text
            milestone.actionText = this._generateActionText(milestone);
            
            return milestone;
          }
        });
      
      // Filter out any null values from the mapping (e.g., invalid tier thresholds)
      const validAchievements = candidateAchievements.filter(a => a !== null);
      
      console.log(`📊 ProgressTracker: ${validAchievements.length} achievements have progress data (including tier upgrades)`);
      
      // Sort by progress percentage (descending) to get the closest one
      const sortedByProgress = validAchievements.sort((a, b) => b.progress - a.progress);
      
      if (sortedByProgress.length > 0) {
        const closest = sortedByProgress[0];
        const tierInfo = closest.isTierUpgrade ? ` (${closest.currentTier} → ${closest.nextTier})` : '';
        console.log(`🎯 Closest milestone: ${closest.achievementName}${tierInfo} (${closest.progress.toFixed(1)}% complete - ${closest.current}/${closest.target})`);
        return closest;
      } else {
        console.log(`✅ ProgressTracker: No achievements with progress data (user may have earned all available achievements)`);
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
   * Generate contextual action text for milestone
   * Tells user exactly what to do to earn the achievement
   * @private
   */
  _generateActionText(milestone) {
    const { type, remaining, achievementName, isTierUpgrade, nextTier } = milestone;
    
    // Tier upgrade messaging
    if (isTierUpgrade) {
      const tierEmoji = TIER_EMOJIS[nextTier] || '';
      const tierName = nextTier ? nextTier.charAt(0).toUpperCase() + nextTier.slice(1) : 'next tier';
      
      // Extract collection type from achievement name if present
      const collectionHint = achievementName.toLowerCase().includes('hot') ? 'hot products' :
                            achievementName.toLowerCase().includes('original') ? 'original products' :
                            achievementName.toLowerCase().includes('exotic') ? 'exotic products' :
                            'products';
      
      return `Rank ${remaining} more ${collectionHint} to upgrade to ${tierName} ${tierEmoji}`;
    }
    
    // Action text by achievement type
    const pluralize = (count, singular, plural) => count === 1 ? singular : (plural || singular + 's');
    
    switch (type) {
      case 'streak_days':
        return `Rank a product for ${remaining} more ${pluralize(remaining, 'day')}`;
      
      case 'login_streak_days':
        return `Log in for ${remaining} more ${pluralize(remaining, 'day')}`;
      
      case 'rank_count':
        return `Rank ${remaining} more ${pluralize(remaining, 'product')}`;
      
      case 'rank_all_products':
        return `Rank ${remaining} more ${pluralize(remaining, 'product')} to complete the entire collection`;
      
      case 'static_collection':
      case 'flavor_coin':
        return `Rank ${remaining} more ${pluralize(remaining, 'product')} to complete ${achievementName}`;
      
      case 'rank_collection':
        return `Complete ${remaining} more ${pluralize(remaining, 'collection')} to earn ${achievementName}`;
      
      case 'rank_animal_categories':
        return `Rank products from ${remaining} more ${pluralize(remaining, 'animal category', 'animal categories')} to earn ${achievementName}`;
      
      case 'rank_vendors':
        return `Rank products from ${remaining} more ${pluralize(remaining, 'vendor')} to earn ${achievementName}`;
      
      case 'search_count':
        return `Search ${remaining} more ${pluralize(remaining, 'time')}`;
      
      case 'page_view_count':
        return `View ${remaining} more ${pluralize(remaining, 'page')}`;
      
      case 'product_view_count':
        return `View ${remaining} more ${pluralize(remaining, 'product')}`;
      
      case 'unique_product_view_count':
        return `View ${remaining} more unique ${pluralize(remaining, 'product')}`;
      
      case 'profile_view_count':
        return `View ${remaining} more ${pluralize(remaining, 'profile')}`;
      
      case 'unique_profile_view_count':
        return `View ${remaining} more unique ${pluralize(remaining, 'profile')}`;
      
      default:
        // Generic fallback
        return `Complete ${remaining} more ${pluralize(remaining, 'item')}`;
    }
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
