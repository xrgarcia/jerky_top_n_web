const userClassificationService = require('./UserClassificationService');
const tasteCommunityService = require('./TasteCommunityService');

/**
 * PersonalizedGuidanceService - Generates page-aware, journey-specific guidance
 * 
 * Design principles:
 * - Encourage action (no passive messages)
 * - Push completionist behavior
 * - Clear CTAs (no unsupervised thinking)
 * - Fun jerky.com voice
 * - Context-aware (page + journey stage)
 */
class PersonalizedGuidanceService {
  /**
   * Get personalized guidance for user
   * @param {number} userId - User ID
   * @param {string} pageContext - Page context: 'rank', 'products', 'community', 'coinbook', 'general'
   * @returns {object} Guidance data with message, type, and classification
   */
  async getGuidance(userId, pageContext = 'general') {
    // Get or create classification
    let classification = await userClassificationService.getUserClassification(userId);
    
    if (!classification) {
      // First time - classify user
      classification = await userClassificationService.classifyUser(userId);
      
      // Try to assign community
      await tasteCommunityService.assignCommunity(userId);
      
      // Refresh classification to get community
      classification = await userClassificationService.getUserClassification(userId);
    }

    // Get community info if assigned
    let community = null;
    if (classification.tasteCommunityId) {
      community = await tasteCommunityService.getCommunity(classification.tasteCommunityId);
    }

    // Generate page-aware, journey-aware message
    const message = this._generateMessage(classification, community, pageContext);

    return {
      message: message.text,
      title: message.title,
      type: message.type,
      icon: message.icon,
      classification: {
        journeyStage: classification.journeyStage,
        engagementLevel: classification.engagementLevel,
        explorationBreadth: classification.explorationBreadth,
        focusAreas: classification.focusAreas || [],
        community: community ? {
          id: community.id,
          name: community.name,
          icon: community.icon
        } : null
      },
      stats: classification.classificationData
    };
  }

  /**
   * Generate page-aware, journey-specific message
   * @private
   */
  _generateMessage(classification, community, pageContext) {
    const { journeyStage, engagementLevel, explorationBreadth, focusAreas, classificationData } = classification;
    const rankedCount = classificationData?.totalRankings || 0;

    // RANK PAGE - Action-focused, drag-and-drop emphasis
    if (pageContext === 'rank') {
      return this._getRankPageMessage(journeyStage, engagementLevel, rankedCount, community);
    }

    // PRODUCTS PAGE - Discovery and catalog exploration
    if (pageContext === 'products') {
      return this._getProductsPageMessage(journeyStage, engagementLevel, explorationBreadth, focusAreas);
    }

    // COMMUNITY PAGE - Social connection and comparison
    if (pageContext === 'community') {
      return this._getCommunityPageMessage(journeyStage, engagementLevel, community);
    }

    // COIN BOOK PAGE - Achievement hunting
    if (pageContext === 'coinbook') {
      return this._getCoinBookPageMessage(journeyStage, engagementLevel, rankedCount);
    }

    // GENERAL / FALLBACK - Journey-based only
    return this._getGeneralMessage(journeyStage, engagementLevel, rankedCount, community);
  }

  /**
   * RANK PAGE: Encourage ranking action
   * @private
   */
  _getRankPageMessage(journeyStage, engagementLevel, rankedCount, community) {
    // NEW USERS: Onboarding, explain the mechanic
    if (journeyStage === 'new_user') {
      return {
        title: 'Welcome to Your Flavor Ranking!',
        icon: '🎯',
        type: 'onboarding',
        text: "Ready to build your flavor profile? Drag products below to rank them from favorite to least favorite. Each ranking earns you Flavor Coins and unlocks achievements!"
      };
    }

    // DORMANT: Re-engagement
    if (journeyStage === 'dormant') {
      return {
        title: 'Welcome Back, Flavor Hunter!',
        icon: '🔥',
        type: 'reengagement',
        text: "We've missed you! New flavors are waiting to be ranked. Jump back in and keep building your collection - your progress is still here!"
      };
    }

    // POWER USERS: Challenge and competition
    if (journeyStage === 'power_user') {
      const communityBadge = community ? ` ${community.icon}` : '';
      return {
        title: `You're Crushing It${communityBadge}`,
        icon: '🏆',
        type: 'challenge',
        text: `${rankedCount} flavors ranked! Keep that streak alive and climb the leaderboard. Every new ranking brings you closer to completing your Coin Book!`
      };
    }

    // ENGAGED: Momentum and streaks
    if (journeyStage === 'engaged') {
      return {
        title: 'Keep the Momentum Going!',
        icon: '💪',
        type: 'momentum',
        text: "You're on a roll! Rank more flavors today to maintain your streak and unlock tiered achievements. The more you rank, the more coins you earn!"
      };
    }

    // EXPLORING: Discovery and next steps
    if (journeyStage === 'exploring') {
      return {
        title: 'Great Start!',
        icon: '🚀',
        type: 'discovery',
        text: `${rankedCount} flavors ranked so far! Try the search feature below to find flavors you've purchased, then drag them into your ranking. Each one gets you closer to unlocking new coins!`
      };
    }

    // DEFAULT
    return {
      title: 'Build Your Rankings',
      icon: '📊',
      type: 'general',
      text: "Drag products to rank them! Every ranking earns Flavor Coins and brings you closer to completing your collection."
    };
  }

  /**
   * PRODUCTS PAGE: Discovery and catalog browsing
   * @private
   */
  _getProductsPageMessage(journeyStage, engagementLevel, explorationBreadth, focusAreas) {
    // NEW USERS: Browse and discover
    if (journeyStage === 'new_user') {
      return {
        title: 'Discover Your Next Favorite!',
        icon: '🔍',
        type: 'discovery',
        text: "Browse our full catalog of jerky flavors! When you find ones you've tried, head to the Rank page to add them to your collection and earn Flavor Coins."
      };
    }

    // NARROW FOCUS: Encourage exploration
    if (explorationBreadth === 'narrow' && focusAreas.length > 0) {
      const focusText = focusAreas.slice(0, 2).join(' and ');
      return {
        title: 'Branch Out & Discover!',
        icon: '🌟',
        type: 'exploration',
        text: `You seem to love ${focusText} - awesome! But there's more to explore. Try new flavor profiles and protein types to earn Engagement Coins and unlock collection achievements!`
      };
    }

    // POWER USERS: Complete the catalog
    if (journeyStage === 'power_user') {
      return {
        title: 'Complete Your Catalog!',
        icon: '📚',
        type: 'completion',
        text: "You're a flavor explorer extraordinaire! Find products you haven't ranked yet and add them to your collection. Every new flavor brings you closer to 100% catalog completion!"
      };
    }

    // EXPLORING/ENGAGED: Search and filter
    return {
      title: 'Explore the Catalog!',
      icon: '🎯',
      type: 'discovery',
      text: "Use filters to find flavors that match your taste! Try different animals, flavor profiles, or brands. The more you explore, the more you'll discover!"
    };
  }

  /**
   * COMMUNITY PAGE: Social connection
   * @private
   */
  _getCommunityPageMessage(journeyStage, engagementLevel, community) {
    // WITH COMMUNITY: Connect with tribe
    if (community) {
      return {
        title: `${community.icon} ${community.name}`,
        icon: '👥',
        type: 'community',
        text: `You're part of the ${community.name} community! ${community.description} Check out what fellow members are ranking and compare your collections!`
      };
    }

    // NEW USERS: Explain community
    if (journeyStage === 'new_user') {
      return {
        title: 'Find Your Flavor Tribe!',
        icon: '🤝',
        type: 'community',
        text: "See what other jerky lovers are ranking! As you rank more flavors, you'll be matched with a community of people who share your taste preferences."
      };
    }

    // POWER USERS: Compete
    if (journeyStage === 'power_user') {
      return {
        title: 'Compare & Compete!',
        icon: '🏅',
        type: 'competition',
        text: "Check out the leaderboard and see how your collection stacks up! Find players with similar tastes and discover flavors you might be missing."
      };
    }

    // DEFAULT
    return {
      title: 'Connect with Fellow Rankers!',
      icon: '👋',
      type: 'community',
      text: "See what the community is ranking! Compare collections, discover popular flavors, and find your flavor tribe."
    };
  }

  /**
   * COIN BOOK PAGE: Achievement hunting
   * @private
   */
  _getCoinBookPageMessage(journeyStage, engagementLevel, rankedCount) {
    // NEW USERS: Explain achievements
    if (journeyStage === 'new_user') {
      return {
        title: 'Your Achievement Journey!',
        icon: '🎖️',
        type: 'achievement',
        text: "This is your Coin Book! Every flavor you rank, search you make, and streak you maintain earns achievements and coins. Start ranking to unlock your first coin!"
      };
    }

    // POWER USERS: Push completion
    if (journeyStage === 'power_user') {
      return {
        title: 'Complete Your Coin Book!',
        icon: '💎',
        type: 'completion',
        text: "You're on fire! Track your progress toward Diamond tier and complete every collection. Unlock all the coins to become a true jerky legend!"
      };
    }

    // EXPLORING/ENGAGED: Next milestone
    return {
      title: 'Unlock More Coins!',
      icon: '🪙',
      type: 'progress',
      text: "Each achievement brings you closer to completing your Coin Book! Check your progress bars to see what's next, then jump to the Rank page to keep earning!"
    };
  }

  /**
   * GENERAL / FALLBACK: Journey-based messaging
   * @private
   */
  _getGeneralMessage(journeyStage, engagementLevel, rankedCount, community) {
    // NEW USERS
    if (journeyStage === 'new_user') {
      return {
        title: 'Welcome to the Coin Book!',
        icon: '👋',
        type: 'onboarding',
        text: "Rank the flavors you've purchased to earn Flavor Coins and unlock achievements. Each ranking helps you discover your taste profile!"
      };
    }

    // DORMANT
    if (journeyStage === 'dormant') {
      return {
        title: 'We Missed You!',
        icon: '🎯',
        type: 'reengagement',
        text: "New flavors have been added since your last visit! Come back and rank your recent purchases to earn more coins and see how your collection has grown."
      };
    }

    // POWER USERS
    if (journeyStage === 'power_user') {
      const communityText = community ? ` You're a valued ${community.icon} ${community.name} member!` : '';
      return {
        title: "You're a Flavor Legend!",
        icon: '🌟',
        type: 'celebration',
        text: `${rankedCount} flavors ranked!${communityText} Keep building your collection and climbing the leaderboard!`
      };
    }

    // ENGAGED
    if (journeyStage === 'engaged') {
      return {
        title: 'Building Your Collection!',
        icon: '🎖️',
        type: 'momentum',
        text: "You're making great progress! Keep your ranking streak alive to earn Engagement Coins and unlock tiered achievements."
      };
    }

    // EXPLORING
    if (journeyStage === 'exploring') {
      return {
        title: 'Great Progress!',
        icon: '📈',
        type: 'guidance',
        text: `${rankedCount} flavors ranked! Use the search feature to find more products you've tried, and check out the community to see what others are ranking.`
      };
    }

    // DEFAULT
    return {
      title: 'Build Your Coin Book!',
      icon: '📖',
      type: 'general',
      text: "Every flavor you rank brings you closer to completing collections and unlocking new achievements!"
    };
  }

  /**
   * Get message based on specific classification override (for admin testing)
   */
  async getMessageForClassification(journeyStage, engagementLevel, explorationBreadth, focusAreas = [], communityId = null, pageContext = 'general') {
    let community = null;
    if (communityId) {
      community = await tasteCommunityService.getCommunity(communityId);
    }

    const mockClassification = {
      journeyStage,
      engagementLevel,
      explorationBreadth,
      focusAreas,
      classificationData: { totalRankings: 0 }
    };

    return this._generateMessage(mockClassification, community, pageContext);
  }
}

const personalizedGuidanceService = new PersonalizedGuidanceService();
module.exports = personalizedGuidanceService;
