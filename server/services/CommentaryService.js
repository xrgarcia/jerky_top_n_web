const { eq, sql } = require('drizzle-orm');

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
          current: closestAchievement.current,
          target: closestAchievement.target,
          remaining: closestAchievement.remaining,
          progress: closestAchievement.progress,
          metricLabel: this._getMetricLabel(closestAchievement.type, closestAchievement.target)
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
   * Generate contextual progress message based on user state
   * @private
   */
  _generateProgressMessage(rankedCount, totalProducts, milestone, currentStreak) {
    const percentage = (rankedCount / totalProducts) * 100;

    // STATE: No rankings yet
    if (rankedCount === 0) {
      return {
        text: 'Start your flavor journey! Drag a product to rank it 🎯',
        icon: '🚀'
      };
    }

    // STATE: Early (1-5 ranked)
    if (rankedCount <= 5) {
      if (milestone) {
        const metricLabel = this._getMetricLabel(milestone.type, milestone.remaining);
        return {
          text: `Great start! ${milestone.remaining} more ${metricLabel} to unlock "${milestone.achievementName}" 🎯`,
          icon: '✨'
        };
      }
      return {
        text: 'Great start! Keep discovering flavors 🔍',
        icon: '✨'
      };
    }

    // STATE: Building momentum (6-15 ranked)
    if (rankedCount <= 15) {
      if (milestone && milestone.remaining <= 5) {
        const metricLabel = this._getMetricLabel(milestone.type, milestone.remaining);
        return {
          text: `${milestone.remaining} ${metricLabel} away from "${milestone.achievementName}"! 🎯`,
          icon: '🔥'
        };
      }
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

    // STATE: Establishing habits (16-30 ranked)
    if (rankedCount <= 30) {
      if (milestone && milestone.remaining <= 3) {
        const metricLabel = this._getMetricLabel(milestone.type, milestone.remaining);
        return {
          text: `So close! ${milestone.remaining} more ${metricLabel} for "${milestone.achievementName}" ⭐`,
          icon: '🎯'
        };
      }
      return {
        text: `${rankedCount} flavors explored! You're a jerky connoisseur 🌟`,
        icon: '🌟'
      };
    }

    // STATE: Halfway milestone (31-50 ranked)
    if (percentage < 60) {
      if (milestone) {
        return {
          text: `Halfway there! Next up: "${milestone.achievementName}" 💪`,
          icon: '💪'
        };
      }
      return {
        text: 'Halfway to legendary status! 💪',
        icon: '💪'
      };
    }

    // STATE: Advanced collector (51-75 ranked)
    if (percentage < 85) {
      if (milestone && milestone.remaining <= 5) {
        const metricLabel = this._getMetricLabel(milestone.type, milestone.remaining);
        return {
          text: `Almost there! ${milestone.remaining} more ${metricLabel} for "${milestone.achievementName}" 🏆`,
          icon: '🔥'
        };
      }
      return {
        text: 'Impressive collection! The finish line is in sight 🎖️',
        icon: '🎖️'
      };
    }

    // STATE: Near complete (76-88 ranked)
    if (rankedCount < totalProducts) {
      const remaining = totalProducts - rankedCount;
      return {
        text: `Just ${remaining} more to complete the entire collection! 🏆`,
        icon: '👑'
      };
    }

    // STATE: Complete collection
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
   * @private
   */
  _generateCollectionMessage(rankedCount, remaining, totalProducts, percentage, context) {
    // Define message templates by context
    const templates = {
      available_products: {
        empty: { text: "Let's start your flavor journey! Search to find products 🚀", icon: '🚀', color: 'blue' },
        starting: { text: `You've tasted ${rankedCount} flavor${rankedCount !== 1 ? 's' : ''}—let's find your next favorite!`, icon: '✨', color: 'green' },
        momentum: { text: `${rankedCount} down, ${remaining} to go! You're on a roll 🔥`, icon: '🔥', color: 'orange' },
        halfway: { text: `Halfway there! ${remaining} more flavors await 💪`, icon: '💪', color: 'purple' },
        advanced: { text: `Impressive! Only ${remaining} left to complete your collection 🏆`, icon: '🎖️', color: 'gold' },
        nearComplete: { text: `Almost legendary! Just ${remaining} more 👑`, icon: '👑', color: 'gold' },
        complete: { text: "Legend status! You've ranked them all 🎉", icon: '🎉', color: 'rainbow' }
      },
      coin_book: {
        empty: { text: 'Start ranking to unlock achievements!', icon: '🎯', color: 'blue' },
        starting: { text: `${rankedCount} ranked—keep going to unlock more!`, icon: '⭐', color: 'green' },
        momentum: { text: `${rankedCount} products ranked! Achievements await 🔥`, icon: '🔥', color: 'orange' },
        halfway: { text: `${rankedCount} ranked—you're unstoppable! 💪`, icon: '💪', color: 'purple' },
        advanced: { text: `${rankedCount} ranked! Almost at legend status 🏆`, icon: '🏆', color: 'gold' },
        nearComplete: { text: `${rankedCount} ranked! Finish strong 👑`, icon: '👑', color: 'gold' },
        complete: { text: 'All products ranked! 🎉', icon: '🎉', color: 'rainbow' }
      }
    };

    const contextTemplates = templates[context] || templates.available_products;

    // Tier logic (matches ranking progress tiers for consistency)
    if (rankedCount === 0) {
      return contextTemplates.empty;
    } else if (rankedCount <= 5) {
      return contextTemplates.starting;
    } else if (rankedCount <= 15) {
      return contextTemplates.momentum;
    } else if (percentage < 60) {
      return contextTemplates.halfway;
    } else if (percentage < 85) {
      return contextTemplates.advanced;
    } else if (rankedCount < totalProducts) {
      return contextTemplates.nearComplete;
    } else {
      return contextTemplates.complete;
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
