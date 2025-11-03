const { eq, sql } = require('drizzle-orm');
const { TIER_EMOJIS } = require('../../shared/constants/tierEmojis');

/**
 * CommentaryService - Generates contextual, encouraging messages for user journeys
 * Integrates with ProgressTracker, EngagementManager, and StreakManager
 * to provide intelligent, milestone-aware commentary
 */
class CommentaryService {
  constructor({ db, progressTracker, engagementManager, streakManager, achievementRepo }) {
    this.db = db;
    this.progressTracker = progressTracker;
    this.engagementManager = engagementManager;
    this.streakManager = streakManager;
    this.achievementRepo = achievementRepo;
  }

  /**
   * Generate ranking progress message for the rank page
   * @param {number} userId - User ID
   * @param {number} totalRankableProducts - Total rankable products
   * @returns {Object} { message, icon, nextMilestone }
   */
  async generateRankingProgressMessage(userId, totalRankableProducts = 89) {
    try {
      const { productRankings } = require('../../shared/schema');

      // Get user's ranking stats
      const [rankingStats] = await this.db.select({
        totalRankings: sql`count(*)::int`,
        uniqueProducts: sql`count(distinct ${productRankings.shopifyProductId})::int`,
      })
      .from(productRankings)
      .where(eq(productRankings.userId, userId))
      .limit(1);

      const stats = rankingStats || { totalRankings: 0, uniqueProducts: 0 };
      const rankedCount = stats.uniqueProducts;

      // Get current streak
      const streaks = await this.streakManager.getUserStreaks(userId);
      const dailyStreak = streaks.find(s => s.streakType === 'daily_rank');
      const currentStreak = dailyStreak?.currentStreak || 0;

      // Get next closest milestone using ProgressTracker
      const userStats = {
        totalRankings: stats.totalRankings,
        uniqueProducts: rankedCount,
        currentStreak,
        totalRankableProducts,
        leaderboardPosition: 0,
      };

      // IMPORTANT: Only show 'ranking' category achievements in ranking progress commentary
      // This excludes flavor coins, engagement achievements, etc.
      const closestAchievement = await this.progressTracker.getClosestUnearnedAchievement(userId, userStats, 'ranking');

      // Generate contextual message based on progress tier
      const message = this._generateProgressMessage(rankedCount, totalRankableProducts, closestAchievement, currentStreak);

      return {
        rankedCount,
        totalProducts: totalRankableProducts,
        message: message.text,
        icon: message.icon,
        nextMilestone: closestAchievement ? {
          name: closestAchievement.achievementName,
          icon: closestAchievement.achievementIcon,
          iconType: closestAchievement.achievementIconType || 'emoji',
          current: closestAchievement.current,
          target: closestAchievement.target,
          remaining: closestAchievement.remaining,
          progress: closestAchievement.progress,
          metricLabel: this._getMetricLabel(closestAchievement.type, closestAchievement.target),
          isTierUpgrade: closestAchievement.isTierUpgrade || false,
          currentTier: closestAchievement.currentTier || null,
          nextTier: closestAchievement.nextTier || null
        } : null
      };
    } catch (error) {
      console.error('❌ Error generating ranking progress message:', error);
      return {
        rankedCount: 0,
        totalProducts: totalRankableProducts,
        message: 'Keep ranking to unlock achievements!',
        icon: '⭐',
        nextMilestone: null
      };
    }
  }

  /**
   * Map achievement requirement types to user-friendly metric labels
   * @private
   */
  _getMetricLabel(requirementType, count = 1) {
    const labels = {
      'streak_days': count === 1 ? 'day' : 'days',
      'total_rankings': count === 1 ? 'product' : 'products',
      'unique_products': count === 1 ? 'product' : 'products',
      'flavor_collection': count === 1 ? 'flavor' : 'flavors',
      'leaderboard_position': 'rank',
      'total_points': count === 1 ? 'point' : 'points',
    };
    // Fallback for unknown types to avoid blank messaging
    return labels[requirementType] || (count === 1 ? 'item' : 'items');
  }

  /**
   * Get tier-specific information (emoji and formatted name)
   * @private
   */
  _getTierInfo(milestone) {
    return {
      emoji: TIER_EMOJIS[milestone.nextTier] || '⭐',
      tierName: milestone.nextTier ? milestone.nextTier.charAt(0).toUpperCase() + milestone.nextTier.slice(1) : ''
    };
  }

  /**
   * Generate contextual progress message based on user state
   * Uses intelligent percentage-based tiers when a milestone exists,
   * calculated from progress toward the SPECIFIC achievement (not total products)
   * Supports tier upgrades for tiered achievements
   * @private
   */
  _generateProgressMessage(rankedCount, totalProducts, milestone, currentStreak) {
    // STATE: No rankings yet
    if (rankedCount === 0) {
      return {
        text: 'Start your flavor journey! Drag a product to rank it 🎯',
        icon: '🚀'
      };
    }

    // If we have a milestone, use SMART percentage-based messaging
    // based on progress toward the SPECIFIC achievement
    if (milestone) {
      const metricLabel = this._getMetricLabel(milestone.type, milestone.remaining);
      const progressPercent = (milestone.current / milestone.target) * 100;
      
      // Get tier emoji and tier upgrade messaging if applicable
      const tierInfo = milestone.isTierUpgrade ? this._getTierInfo(milestone) : null;
      
      // Different display format for tier upgrades vs new achievements
      // For tier upgrades, include both the tier AND the achievement name for clarity
      const achievementDisplay = tierInfo 
        ? `${tierInfo.tierName} tier ${tierInfo.emoji} in ${milestone.achievementName}` 
        : `"${milestone.achievementName}"`;
      
      // Different action verb for tier upgrades vs new achievements
      const actionVerb = milestone.isTierUpgrade ? 'upgrade to' : 'unlock';

      // TIER 1: Just started (0-10% progress)
      if (progressPercent <= 10) {
        return {
          text: `Just getting started! ${milestone.remaining} more ${metricLabel} to ${actionVerb} ${achievementDisplay} 🎯`,
          icon: '🚀'
        };
      }

      // TIER 2: Early progress (11-25%)
      if (progressPercent <= 25) {
        return {
          text: `Great start! ${milestone.remaining} more ${metricLabel} to ${actionVerb} ${achievementDisplay} 🌟`,
          icon: '✨'
        };
      }

      // TIER 3: Building momentum (26-50%)
      if (progressPercent <= 50) {
        return {
          text: `Making progress! ${milestone.remaining} more ${metricLabel} to ${actionVerb} ${achievementDisplay} 🔥`,
          icon: '🔥'
        };
      }

      // TIER 4: More than halfway (51-75%)
      if (progressPercent <= 75) {
        return {
          text: `More than halfway! ${milestone.remaining} more ${metricLabel} to ${actionVerb} ${achievementDisplay} 💪`,
          icon: '💪'
        };
      }

      // TIER 5: Almost there (76-90%)
      if (progressPercent <= 90) {
        return {
          text: `Almost there! ${milestone.remaining} more ${metricLabel} to ${actionVerb} ${achievementDisplay} 🏆`,
          icon: '🎯'
        };
      }

      // TIER 6: So close! (91-99%)
      return {
        text: `So close! ${milestone.remaining} more ${metricLabel} to ${actionVerb} ${achievementDisplay} ⭐`,
        icon: '⭐'
      };
    }

    // FALLBACK: No milestone available - use general encouragement based on total count
    if (rankedCount <= 5) {
      return {
        text: 'Great start! Keep discovering flavors 🔍',
        icon: '✨'
      };
    }

    if (rankedCount <= 15) {
      if (currentStreak >= 3) {
        return {
          text: `${currentStreak}-day streak! Keep the momentum going 🔥`,
          icon: '⚡'
        };
      }
      return {
        text: "You're on a roll! More jerky awaits 🚀",
        icon: '🚀'
      };
    }

    if (rankedCount <= 30) {
      return {
        text: `${rankedCount} flavors explored! You're a jerky connoisseur 🌟`,
        icon: '🌟'
      };
    }

    const percentage = (rankedCount / totalProducts) * 100;
    if (percentage < 60) {
      return {
        text: 'Keep building your collection! 💪',
        icon: '💪'
      };
    }

    if (percentage < 85) {
      return {
        text: 'Impressive collection! The finish line is in sight 🎖️',
        icon: '🎖️'
      };
    }

    if (rankedCount < totalProducts) {
      const remaining = totalProducts - rankedCount;
      return {
        text: `Just ${remaining} more to complete the entire collection! 🏆`,
        icon: '👑'
      };
    }

    // Complete collection
    return {
      text: "You've ranked them all! Legend status achieved 🎉",
      icon: '🎉'
    };
  }

  /**
   * Generate collection progress message with contextual encouragement
   * REUSABLE across different UI contexts (Available Products, Coin Book, Profile, etc.)
   * @param {number} userId - User ID
   * @param {string} context - Context for message tone ('available_products', 'coin_book', 'profile')
   * @param {number} totalRankableProducts - Total rankable products
   * @returns {Object} { rankedCount, totalProducts, percentage, message, icon, progressColor }
   */
  async generateCollectionProgressMessage(userId, context = 'available_products', totalRankableProducts = 89) {
    try {
      const { productRankings } = require('../../shared/schema');

      // Get user's ranking stats
      const [rankingStats] = await this.db.select({
        totalRankings: sql`count(*)::int`,
        uniqueProducts: sql`count(distinct ${productRankings.shopifyProductId})::int`,
      })
      .from(productRankings)
      .where(eq(productRankings.userId, userId))
      .limit(1);

      const stats = rankingStats || { totalRankings: 0, uniqueProducts: 0 };
      const rankedCount = stats.uniqueProducts;
      const remaining = totalRankableProducts - rankedCount;
      const percentage = totalRankableProducts > 0 ? (rankedCount / totalRankableProducts) * 100 : 0;

      // Generate contextual message based on context and progress tier
      const message = this._generateCollectionMessage(rankedCount, remaining, totalRankableProducts, percentage, context);

      return {
        rankedCount,
        totalProducts: totalRankableProducts,
        remaining,
        percentage: Math.round(percentage),
        message: message.text,
        icon: message.icon,
        progressColor: message.color
      };
    } catch (error) {
      console.error('❌ Error generating collection progress message:', error);
      return {
        rankedCount: 0,
        totalProducts: totalRankableProducts,
        remaining: totalRankableProducts,
        percentage: 0,
        message: 'Start exploring!',
        icon: '🚀',
        progressColor: 'gray'
      };
    }
  }

  /**
   * Generate contextual collection messages based on progress tier and context
   * Simple percentage-based tiers every 10% with encouraging variations
   * @private
   */
  _generateCollectionMessage(rankedCount, remaining, totalProducts, percentage, context) {
    // Define message templates by context - simple percentage-based tiers
    // Uses Coin Book and Flavor Coin terminology from the glossary
    const templates = {
      available_products: {
        tier_0: { text: "Start filling your Coin Book! Rank your purchases 🪙", icon: '🪙', color: 'blue' },
        tier_1_10: { text: `${remaining} flavors left to complete your Coin Book! Keep ranking 🪙`, icon: '🪙', color: 'blue' },
        tier_11_20: { text: `Building momentum! ${remaining} flavors left to complete your Coin Book 💪`, icon: '💪', color: 'green' },
        tier_21_30: { text: `Great progress! ${remaining} flavors left to complete your Coin Book 🔥`, icon: '🔥', color: 'orange' },
        tier_31_40: { text: `Over one-third done! ${remaining} flavors left to complete your Coin Book ⭐`, icon: '⭐', color: 'purple' },
        tier_41_50: { text: `Almost halfway! ${remaining} flavors left to complete your Coin Book 🎯`, icon: '🎯', color: 'purple' },
        tier_51_60: { text: `Past halfway! ${remaining} flavors left to complete your Coin Book 🏆`, icon: '🏆', color: 'gold' },
        tier_61_70: { text: `Two-thirds done! Only ${remaining} flavors left to complete your Coin Book 💎`, icon: '💎', color: 'gold' },
        tier_71_80: { text: `Home stretch! ${remaining} flavors left to complete your Coin Book 🌟`, icon: '🌟', color: 'gold' },
        tier_81_90: { text: `Nearly complete! Just ${remaining} flavors left to complete your Coin Book ⚡`, icon: '⚡', color: 'gold' },
        tier_91_99: { text: `So close! Only ${remaining} flavors left to complete your Coin Book 🎉`, icon: '🎉', color: 'rainbow' },
        tier_100: { text: "Coin Book complete! You've ranked them all 👑", icon: '👑', color: 'rainbow' }
      },
      coin_book: {
        tier_0: { text: 'Start ranking to unlock achievements!', icon: '🎯', color: 'blue' },
        tier_1_10: { text: `${rankedCount} ranked! Keep going 🚀`, icon: '🚀', color: 'blue' },
        tier_11_20: { text: `${rankedCount} ranked! Building momentum 💪`, icon: '💪', color: 'green' },
        tier_21_30: { text: `${rankedCount} ranked! Great progress 🔥`, icon: '🔥', color: 'orange' },
        tier_31_40: { text: `${rankedCount} ranked! Over one-third done ⭐`, icon: '⭐', color: 'purple' },
        tier_41_50: { text: `${rankedCount} ranked! Almost halfway 🎯`, icon: '🎯', color: 'purple' },
        tier_51_60: { text: `${rankedCount} ranked! Past halfway 🏆`, icon: '🏆', color: 'gold' },
        tier_61_70: { text: `${rankedCount} ranked! Two-thirds done 💎`, icon: '💎', color: 'gold' },
        tier_71_80: { text: `${rankedCount} ranked! Home stretch 🌟`, icon: '🌟', color: 'gold' },
        tier_81_90: { text: `${rankedCount} ranked! Nearly there ⚡`, icon: '⚡', color: 'gold' },
        tier_91_99: { text: `${rankedCount} ranked! So close 🎉`, icon: '🎉', color: 'rainbow' },
        tier_100: { text: 'All products ranked! 👑', icon: '👑', color: 'rainbow' }
      }
    };

    const contextTemplates = templates[context] || templates.available_products;

    // Simple 10% tier logic based on actual percentage
    if (rankedCount === 0) {
      return contextTemplates.tier_0;
    } else if (percentage <= 10) {
      return contextTemplates.tier_1_10;
    } else if (percentage <= 20) {
      return contextTemplates.tier_11_20;
    } else if (percentage <= 30) {
      return contextTemplates.tier_21_30;
    } else if (percentage <= 40) {
      return contextTemplates.tier_31_40;
    } else if (percentage <= 50) {
      return contextTemplates.tier_41_50;
    } else if (percentage <= 60) {
      return contextTemplates.tier_51_60;
    } else if (percentage <= 70) {
      return contextTemplates.tier_61_70;
    } else if (percentage <= 80) {
      return contextTemplates.tier_71_80;
    } else if (percentage <= 90) {
      return contextTemplates.tier_81_90;
    } else if (percentage < 100) {
      return contextTemplates.tier_91_99;
    } else {
      return contextTemplates.tier_100;
    }
  }

  /**
   * Generate collection-specific commentary (for Coin Book)
   * @param {number} userId - User ID
   * @param {string} collectionId - Collection/achievement ID
   * @returns {Object} Commentary object
   */
  async generateCollectionMessage(userId, collectionId) {
    // Future enhancement: Move legacy generateSmartCommentary logic here
    // For now, this is a placeholder for future expansion
    return {
      message: 'Collection progress tracking',
      icon: '⭐',
      type: 'progress'
    };
  }

  /**
   * Generate milestone guidance (next achievement hints)
   * @param {number} userId - User ID
   * @returns {Object} Guidance message
   */
  async generateMilestoneGuidance(userId) {
    try {
      const progress = await this.progressTracker.getUserProgress(userId);
      
      if (progress.nextMilestones && progress.nextMilestones.length > 0) {
        const next = progress.nextMilestones[0];
        return {
          message: `${next.remaining} more to unlock "${next.achievementName}"`,
          icon: next.achievementIcon || '🎯',
          milestone: next
        };
      }

      return {
        message: 'Keep exploring to unlock new achievements!',
        icon: '⭐',
        milestone: null
      };
    } catch (error) {
      console.error('❌ Error generating milestone guidance:', error);
      return {
        message: 'Keep ranking to progress!',
        icon: '⭐',
        milestone: null
      };
    }
  }
}

module.exports = CommentaryService;
