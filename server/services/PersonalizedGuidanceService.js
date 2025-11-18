const userClassificationService = require('./UserClassificationService');

/**
 * PersonalizedGuidanceService - Generates page-aware, journey-specific guidance
 * Enhanced with achievement progress integration for tactical context
 * 
 * Design principles:
 * - Encourage action (no passive messages)
 * - Push completionist behavior
 * - Clear CTAs (no unsupervised thinking)
 * - Fun jerky.com voice
 * - Context-aware (page + journey stage)
 * - Achievement-enriched (strategic + tactical hooks)
 */
class PersonalizedGuidanceService {
  /**
   * @param {ProgressTracker} progressTracker - Progress tracking service
   * @param {UserStatsAggregator} userStatsAggregator - Stats aggregation service
   */
  constructor(progressTracker, userStatsAggregator) {
    this.progressTracker = progressTracker;
    this.userStatsAggregator = userStatsAggregator;
  }

  /**
   * Get personalized guidance for user
   * @param {number} userId - User ID
   * @param {string} pageContext - Page context: 'rank', 'products', 'community', 'coinbook', 'general'
   * @param {number} totalRankableProducts - Total rankable products count
   * @returns {object} Guidance data with message, type, and classification
   */
  async getGuidance(userId, pageContext = 'general', totalRankableProducts = 162) {
    // Get or create classification
    let classification = await userClassificationService.getUserClassification(userId);
    
    if (!classification) {
      // First time - classify user
      classification = await userClassificationService.classifyUser(userId);
    }

    // Extract dominant flavor community from classification data
    const dominantCommunity = this._extractDominantFlavorCommunity(classification);

    // Get user stats for achievement tracking
    const stats = await this.userStatsAggregator.getStatsForAchievements(userId, totalRankableProducts);

    // Get closest achievement filtered by page context
    const categoryFilter = this._getRelevantCategory(pageContext);
    const nextAchievement = await this.progressTracker.getClosestUnearnedAchievement(
      userId, 
      stats, 
      categoryFilter
    );

    // Generate page-aware, journey-aware message enriched with achievement context AND flavor community
    const message = this._generateMessage(classification, dominantCommunity, pageContext, nextAchievement);

    return {
      message: message.text,
      title: message.title,
      type: message.type,
      icon: message.icon,
      classification: {
        journeyStage: classification.journeyStage,
        engagementLevel: classification.engagementLevel,
        explorationBreadth: classification.explorationBreadth,
        focusAreas: classification.focusAreas || []
      },
      stats: classification.classificationData,
      dominantCommunity: dominantCommunity // Include formatted community for UI display
    };
  }

  /**
   * Extract dominant flavor community from classification data
   * @private
   */
  _extractDominantFlavorCommunity(classification) {
    const flavorCommunities = classification?.classificationData?.flavorCommunities;
    
    if (!flavorCommunities || flavorCommunities.length === 0) {
      return null;
    }

    // Sort by engagement level priority: enthusiast > explorer > moderate > taster > seeker > curious
    const tierPriority = {
      'enthusiast': 6,
      'explorer': 5,
      'moderate': 4,
      'taster': 3,
      'seeker': 2,
      'curious': 1
    };

    // Find highest tier community
    const dominant = flavorCommunities.reduce((best, current) => {
      const currentPriority = tierPriority[current.tier] || 0;
      const bestPriority = tierPriority[best?.tier] || 0;
      return currentPriority > bestPriority ? current : best;
    }, null);

    if (!dominant) return null;

    // Map to community object format
    const flavorEmojis = {
      'Teriyaki': '🍜',
      'BBQ': '🍖',
      'Sweet': '🍯',
      'Spicy': '🌶️',
      'Savory': '🧂'
    };

    const tierLabels = {
      'curious': 'Curious',
      'seeker': 'Seeker',
      'taster': 'Taster',
      'moderate': 'Moderate',
      'explorer': 'Explorer',
      'enthusiast': 'Enthusiast'
    };

    return {
      name: `${dominant.flavorProfile} ${tierLabels[dominant.tier] || 'Member'}`,
      icon: flavorEmojis[dominant.flavorProfile] || '🎯',
      flavorProfile: dominant.flavorProfile,
      tier: dominant.tier,
      description: `You're on the ${dominant.flavorProfile} flavor journey!`
    };
  }

  /**
   * Generate page-aware, journey-specific message
   * Enhanced with achievement hooks when available
   * @private
   */
  _generateMessage(classification, community, pageContext, nextAchievement = null) {
    const { journeyStage, engagementLevel, explorationBreadth, focusAreas, classificationData } = classification;
    const rankedCount = classificationData?.totalRankings || 0;

    // RANK PAGE - Action-focused, drag-and-drop emphasis
    if (pageContext === 'rank') {
      return this._getRankPageMessage(journeyStage, engagementLevel, rankedCount, community, nextAchievement);
    }

    // PRODUCTS PAGE - Discovery and catalog exploration
    if (pageContext === 'products') {
      return this._getProductsPageMessage(journeyStage, engagementLevel, explorationBreadth, focusAreas, community, nextAchievement);
    }

    // COMMUNITY PAGE - Social connection and comparison
    if (pageContext === 'community') {
      return this._getCommunityPageMessage(journeyStage, engagementLevel, community, nextAchievement);
    }

    // COIN BOOK PAGE - Achievement hunting
    if (pageContext === 'coinbook') {
      return this._getCoinBookPageMessage(journeyStage, engagementLevel, rankedCount, community, nextAchievement);
    }

    // GENERAL / FALLBACK - Journey-based only
    return this._getGeneralMessage(journeyStage, engagementLevel, rankedCount, community, nextAchievement);
  }

  /**
   * Determine relevant achievement category filter based on page context
   * Smart filtering ensures achievements match the page's purpose
   * @private
   */
  _getRelevantCategory(pageContext) {
    const categoryMap = {
      rank: 'ranking',        // Rank page: Show ranking achievements only
      products: 'engagement', // Products page: Show engagement achievements (searches, views)
      community: 'engagement', // Community page: Show engagement achievements
      coinbook: null,         // Coin Book: Show ALL achievements (no filter)
      general: null           // General: Show ALL achievements
    };
    return categoryMap[pageContext] || null;
  }

  /**
   * Format achievement hook for message enhancement
   * Converts achievement data into user-friendly tactical context
   * @private
   */
  _formatAchievementHook(achievement) {
    if (!achievement) return null;

    const { remaining, achievementName, achievementIcon, isTierUpgrade, nextTier, current, target } = achievement;
    
    // Format tier upgrade messaging
    if (isTierUpgrade) {
      const tierName = nextTier ? nextTier.charAt(0).toUpperCase() + nextTier.slice(1) : '';
      return {
        text: `${remaining} more to unlock ${tierName} tier ${achievementIcon}!`,
        detail: `${current}/${target} for ${achievementName}`
      };
    }
    
    // Format regular achievement messaging
    return {
      text: `${remaining} more to unlock "${achievementName}" ${achievementIcon}!`,
      detail: `${current}/${target} progress`
    };
  }

  /**
   * RANK PAGE: Educational guidance with specific CTAs
   * Teaches drag-and-drop ranking, search features, and achievement progress
   * @private
   */
  _getRankPageMessage(journeyStage, engagementLevel, rankedCount, community, nextAchievement) {
    const achievementHook = this._formatAchievementHook(nextAchievement);
    const communityBadge = community ? ` ${community.icon}` : '';
    const communityName = community ? community.name : '';

    // NEW USERS: Teach the ranking mechanic step-by-step
    if (journeyStage === 'new_user') {
      const greeting = communityName
        ? `Welcome, **${communityName}**!`
        : 'Welcome!';
      const instruction = "**How to Rank:** Drag any product below and drop it into your list. Your top favorite goes first, least favorite goes last.";
      const tip = "**Tip:** Use the search box to find products you've purchased from jerky.com.";
      const text = achievementHook 
        ? `${greeting} ${instruction} ${tip} ${achievementHook.text}`
        : `${greeting} ${instruction} ${tip} Start ranking to earn your first Flavor Coin!`;
      
      return {
        title: communityName ? `Welcome to Your Flavor Ranking${communityBadge}` : 'Welcome to Your Flavor Ranking!',
        icon: '🎯',
        type: 'onboarding',
        text
      };
    }

    // DORMANT: Re-engagement with clear next step
    if (journeyStage === 'dormant') {
      const greeting = communityName
        ? `Welcome back, **${communityName}**! Your rankings are still here.`
        : "Welcome back! Your rankings are still here.";
      const action = "**Next Step:** Use the search below to find products from your recent purchases, then drag them in.";
      const text = achievementHook 
        ? `${greeting} ${action} ${achievementHook.text}`
        : `${greeting} ${action} Keep building your collection!`;
      
      return {
        title: `Welcome Back${communityBadge}`,
        icon: '🔥',
        type: 'reengagement',
        text
      };
    }

    // POWER USERS: Challenge with flavor community context
    if (journeyStage === 'power_user') {
      const progress = communityName 
        ? `You're a **${communityName}** with ${rankedCount} flavors ranked!`
        : `${rankedCount} flavors ranked!`;
      const action = "**Next Step:** Search below for unranked products and add them to climb the leaderboard.";
      const text = achievementHook 
        ? `${progress} ${action} ${achievementHook.text}`
        : `${progress} ${action} Complete your Coin Book!`;
      
      return {
        title: `You're Crushing It${communityBadge}`,
        icon: '🏆',
        type: 'challenge',
        text
      };
    }

    // ENGAGED: Momentum with streak teaching
    if (journeyStage === 'engaged') {
      const momentum = communityName
        ? `Great work, **${communityName}**! You're on a roll.`
        : "You're on a roll!";
      const teaching = "**Pro Tip:** Rank flavors daily to maintain your streak and earn bonus Engagement Coins.";
      const text = achievementHook 
        ? `${momentum} ${teaching} ${achievementHook.text}`
        : `${momentum} ${teaching}`;
      
      return {
        title: `Keep the Momentum${communityBadge}`,
        icon: '💪',
        type: 'momentum',
        text
      };
    }

    // EXPLORING: Discovery with search teaching
    if (journeyStage === 'exploring') {
      const progress = communityName
        ? `You've ranked ${rankedCount} flavors as a **${communityName}**!`
        : `${rankedCount} flavors ranked so far!`;
      const teaching = "**How to Find More:** Type a product name, brand, or flavor in the search box below, then drag it into your ranking.";
      const text = achievementHook 
        ? `${progress} ${teaching} ${achievementHook.text}`
        : `${progress} ${teaching}`;
      
      return {
        title: `Great Start${communityBadge}`,
        icon: '🚀',
        type: 'discovery',
        text
      };
    }

    // DEFAULT: Basic instruction with community context
    const identity = communityName ? `As a **${communityName}**, you can build your rankings! ` : '';
    const instruction = "**How it Works:** Drag any product below into your ranking list. Top = favorite, bottom = least favorite.";
    const text = achievementHook 
      ? `${identity}${instruction} ${achievementHook.text}`
      : `${identity}${instruction} Each ranking earns Flavor Coins!`;
    
    return {
      title: communityName ? `Build Your Rankings${communityBadge}` : 'Build Your Rankings',
      icon: '📊',
      type: 'general',
      text
    };
  }

  /**
   * PRODUCTS PAGE: Educational guidance for catalog discovery
   * Teaches filtering, flavor profiles, and product exploration
   * @private
   */
  _getProductsPageMessage(journeyStage, engagementLevel, explorationBreadth, focusAreas, community, nextAchievement) {
    const achievementHook = this._formatAchievementHook(nextAchievement);
    const communityBadge = community ? ` ${community.icon}` : '';
    const communityName = community ? community.name : '';
    
    // NEW USERS: Teach navigation and filters
    if (journeyStage === 'new_user') {
      const greeting = communityName
        ? `Welcome, **${communityName}**!`
        : 'Welcome!';
      const teaching = "**Explore the Catalog:** Click any product card to see details, flavors, and reviews. Use the filters at the top to browse by animal type or flavor profile.";
      const action = "**Next Step:** Find products you've purchased, then visit the Rank page to add them to your collection.";
      const text = achievementHook 
        ? `${greeting} ${teaching} ${action} ${achievementHook.text}`
        : `${greeting} ${teaching} ${action}`;
      
      return {
        title: communityName ? `Discover Your Next Favorite${communityBadge}` : 'Discover Your Next Favorite!',
        icon: '🔍',
        type: 'discovery',
        text
      };
    }

    // NARROW FOCUS: Encourage exploration with specific guidance
    if (explorationBreadth === 'narrow' && focusAreas.length > 0) {
      const focusText = focusAreas.slice(0, 2).join(' and ');
      const observation = communityName
        ? `As a **${communityName}**, you love ${focusText} - that's great!`
        : `You love **${focusText}** - that's great!`;
      const teaching = "**Try Something New:** Use the flavor profile filter at the top to explore different taste categories (Teriyaki, BBQ, Sweet, Spicy, Savory).";
      const benefit = "Ranking diverse flavors earns Engagement Coins and unlocks collection achievements!";
      const text = achievementHook 
        ? `${observation} ${teaching} ${benefit} ${achievementHook.text}`
        : `${observation} ${teaching} ${benefit}`;
      
      return {
        title: `Branch Out & Discover${communityBadge}`,
        icon: '🌟',
        type: 'exploration',
        text
      };
    }

    // POWER USERS: Teach advanced filtering for completion
    if (journeyStage === 'power_user') {
      const progress = communityName
        ? `You're a **${communityName}** and a flavor explorer extraordinaire!`
        : "You're a flavor explorer extraordinaire!";
      const teaching = "**Pro Tip:** Combine multiple filters (animal + flavor) to find specific products you haven't ranked yet.";
      const action = "Click any unranked product to see details, then head to Rank to add it.";
      const text = achievementHook 
        ? `${progress} ${teaching} ${action} ${achievementHook.text}`
        : `${progress} ${teaching} ${action}`;
      
      return {
        title: `Complete Your Catalog${communityBadge}`,
        icon: '📚',
        type: 'completion',
        text
      };
    }

    // EXPLORING/ENGAGED: Teach filtering features
    const identity = communityName ? `As a **${communityName}**, you can explore the catalog! ` : '';
    const teaching = "**How to Filter:** Use the dropdowns at the top to browse by animal type (beef, turkey, pork, etc.) or flavor profile (Teriyaki, BBQ, Spicy, etc.).";
    const action = "**Next Step:** Click any product card to see full details, then visit Rank to add it to your collection.";
    const text = achievementHook 
      ? `${identity}${teaching} ${action} ${achievementHook.text}`
      : `${identity}${teaching} ${action}`;
    
    return {
      title: communityName ? `Explore the Catalog${communityBadge}` : 'Explore the Catalog!',
      icon: '🎯',
      type: 'discovery',
      text
    };
  }

  /**
   * COMMUNITY PAGE: Educational guidance for social features
   * Teaches user discovery, profiles, leaderboards, and flavor communities
   * @private
   */
  _getCommunityPageMessage(journeyStage, engagementLevel, community, nextAchievement) {
    const achievementHook = this._formatAchievementHook(nextAchievement);
    
    // WITH COMMUNITY: Personalized guidance with flavor community context
    if (community) {
      const identity = `You're a **${community.name}**! ${community.description}`;
      const teaching = "**Explore the Community:** Use the search above to find other members, or check the leaderboard to see top rankers.";
      const action = "**Try This:** Click any user's profile to see their rankings and compare flavors!";
      const text = achievementHook 
        ? `${identity} ${teaching} ${action} ${achievementHook.text}`
        : `${identity} ${teaching} ${action}`;
      
      return {
        title: `${community.icon} ${community.name}`,
        icon: '👥',
        type: 'community',
        text
      };
    }

    // NEW USERS: Teach community features
    if (journeyStage === 'new_user') {
      const teaching = "**Discover the Community:** Search for other jerky enthusiasts, view their profiles, and see what they're ranking.";
      const benefit = "As you rank more flavors, you'll join a flavor profile community (Teriyaki, BBQ, Spicy, etc.) based on your taste preferences!";
      const action = "**Next Step:** Search for a user above or check out the Top Rankers widget.";
      const text = achievementHook 
        ? `${teaching} ${benefit} ${action} ${achievementHook.text}`
        : `${teaching} ${benefit} ${action}`;
      
      return {
        title: 'Find Your Flavor Tribe!',
        icon: '🤝',
        type: 'community',
        text
      };
    }

    // POWER USERS: Teach competitive features
    if (journeyStage === 'power_user') {
      const teaching = "**Leaderboard Tips:** Your position is based on total rankings and engagement. View other top rankers' profiles to discover flavors you might have missed!";
      const action = "**Pro Tip:** Click any user's flavor profile links to see all products in that category.";
      const text = achievementHook 
        ? `${teaching} ${action} ${achievementHook.text}`
        : `${teaching} ${action}`;
      
      return {
        title: 'Compare & Compete!',
        icon: '🏅',
        type: 'competition',
        text
      };
    }

    // DEFAULT: Basic community teaching
    const teaching = "**How to Use:** Search for users above, or scroll down to see top rankers. Click any profile to compare rankings and discover new flavors!";
    const benefit = "Viewing profiles earns you Engagement Coins.";
    const text = achievementHook 
      ? `${teaching} ${benefit} ${achievementHook.text}`
      : `${teaching} ${benefit}`;
    
    return {
      title: 'Connect with Fellow Rankers!',
      icon: '👋',
      type: 'community',
      text
    };
  }

  /**
   * COIN BOOK PAGE: Educational guidance for achievement system
   * Teaches how coins work, progress tracking, and actionable next steps
   * @private
   */
  _getCoinBookPageMessage(journeyStage, engagementLevel, rankedCount, community, nextAchievement) {
    const achievementHook = this._formatAchievementHook(nextAchievement);
    const communityBadge = community ? ` ${community.icon}` : '';
    const communityName = community ? community.name : '';
    
    // NEW USERS: Explain achievement system from scratch
    if (journeyStage === 'new_user') {
      const greeting = communityName
        ? `Welcome, **${communityName}**!`
        : 'Welcome!';
      const explanation = "**What is This?** This is your Coin Book - it tracks all achievements you can earn on jerky.com!";
      const teaching = "**How to Earn:** Ranking flavors earns Flavor Coins. Daily activity earns Engagement Coins. Completing animal categories earns Collection Coins.";
      const action = "**Next Step:** Visit the Rank page and rank your first flavor to unlock your first coin!";
      const text = achievementHook 
        ? `${greeting} ${explanation} ${teaching} ${action} ${achievementHook.text}`
        : `${greeting} ${explanation} ${teaching} ${action}`;
      
      return {
        title: communityName ? `Your Achievement Journey${communityBadge}` : 'Your Achievement Journey!',
        icon: '🎖️',
        type: 'achievement',
        text
      };
    }

    // POWER USERS: Push completion with specific guidance
    if (journeyStage === 'power_user') {
      const progress = communityName
        ? `You're crushing it as a **${communityName}**! Look at those progress bars filling up.`
        : "You're crushing it! Look at those progress bars filling up.";
      const teaching = "**Tier System:** Each achievement has 5 tiers (Bronze → Silver → Gold → Platinum → Diamond). Keep ranking to climb tiers!";
      const action = achievementHook
        ? `**Your Next Coin:** ${achievementHook.text} Visit the Rank page to work toward it!`
        : "**Next Step:** Check which coins have progress bars, then head to Rank to complete them!";
      
      return {
        title: `Complete Your Coin Book${communityBadge}`,
        icon: '💎',
        type: 'completion',
        text: `${progress} ${teaching} ${action}`
      };
    }

    // EXPLORING/ENGAGED: Teach progress tracking and next actions
    const identity = communityName ? `As a **${communityName}**, you're building your collection! ` : '';
    const teaching = "**How to Track:** Each coin shows your progress with a bar. Gray = locked, colored border = in progress, glowing = earned!";
    const action = achievementHook
      ? `**Your Next Coin:** ${achievementHook.text}`
      : "**Check Your Progress:** Look for coins with progress bars to see what's close to unlocking.";
    const cta = "**Next Step:** Visit the Rank page to rank more flavors and earn coins!";
    
    return {
      title: communityName ? `Unlock More Coins${communityBadge}` : 'Unlock More Coins!',
      icon: '🪙',
      type: 'progress',
      text: `${identity}${teaching} ${action} ${cta}`
    };
  }

  /**
   * GENERAL / FALLBACK: Journey-based messaging
   * @private
   */
  _getGeneralMessage(journeyStage, engagementLevel, rankedCount, community, nextAchievement) {
    const achievementHook = this._formatAchievementHook(nextAchievement);
    const communityBadge = community ? ` ${community.icon}` : '';
    const communityName = community ? community.name : '';
    
    // NEW USERS
    if (journeyStage === 'new_user') {
      const teaching = "Rank the flavors you've purchased to earn Flavor Coins and unlock achievements.";
      const benefit = "Each ranking helps you discover your taste profile!";
      const communityNote = communityName
        ? ` As a **${communityName}**, you're already on a flavor journey!`
        : '';
      const text = achievementHook 
        ? `${teaching} ${benefit}${communityNote} ${achievementHook.text}`
        : `${teaching} ${benefit}${communityNote}`;
      
      return {
        title: communityName ? `Welcome to the Coin Book${communityBadge}` : 'Welcome to the Coin Book!',
        icon: '👋',
        type: 'onboarding',
        text
      };
    }

    // DORMANT
    if (journeyStage === 'dormant') {
      const greeting = communityName
        ? `Welcome back, **${communityName}**! New flavors have been added since your last visit.`
        : "New flavors have been added since your last visit!";
      const action = "Come back and rank your recent purchases to earn more coins.";
      const text = achievementHook 
        ? `${greeting} ${action} ${achievementHook.text}`
        : `${greeting} ${action} See how your collection has grown!`;
      
      return {
        title: `We Missed You${communityBadge}`,
        icon: '🎯',
        type: 'reengagement',
        text
      };
    }

    // POWER USERS
    if (journeyStage === 'power_user') {
      const communityText = community ? ` You're a valued ${community.icon} ${community.name} member!` : '';
      const baseText = `${rankedCount} flavors ranked!${communityText} Keep building your collection and climbing the leaderboard.`;
      const text = achievementHook 
        ? `${baseText} ${achievementHook.text}`
        : `${baseText}!`;
      
      return {
        title: `You're a Flavor Legend${communityBadge}`,
        icon: '🌟',
        type: 'celebration',
        text
      };
    }

    // ENGAGED
    if (journeyStage === 'engaged') {
      const progress = communityName
        ? `Great work, **${communityName}**! You're making great progress.`
        : "You're making great progress!";
      const teaching = "Keep your ranking streak alive to earn Engagement Coins.";
      const text = achievementHook 
        ? `${progress} ${teaching} ${achievementHook.text}`
        : `${progress} ${teaching} Unlock tiered achievements!`;
      
      return {
        title: `Building Your Collection${communityBadge}`,
        icon: '🎖️',
        type: 'momentum',
        text
      };
    }

    // EXPLORING
    if (journeyStage === 'exploring') {
      const progress = communityName
        ? `${rankedCount} flavors ranked as a **${communityName}**!`
        : `${rankedCount} flavors ranked!`;
      const teaching = "Use the search feature to find more products you've tried, and check out the community to see what others are ranking.";
      const text = achievementHook 
        ? `${progress} ${teaching} ${achievementHook.text}`
        : `${progress} ${teaching}`;
      
      return {
        title: `Great Progress${communityBadge}`,
        icon: '📈',
        type: 'guidance',
        text
      };
    }

    // DEFAULT
    const identity = communityName ? `As a **${communityName}**, ` : '';
    const baseText = `${identity}Every flavor you rank brings you closer to completing collections and unlocking new achievements!`;
    const text = achievementHook 
      ? `${baseText} ${achievementHook.text}`
      : baseText;
    
    return {
      title: communityName ? `Build Your Coin Book${communityBadge}` : 'Build Your Coin Book!',
      icon: '📖',
      type: 'general',
      text
    };
  }

  /**
   * Get message based on specific classification override (for admin testing)
   */
  async getMessageForClassification(journeyStage, engagementLevel, explorationBreadth, focusAreas = [], pageContext = 'general') {
    const mockClassification = {
      journeyStage,
      engagementLevel,
      explorationBreadth,
      focusAreas,
      classificationData: { totalRankings: 0 }
    };

    return this._generateMessage(mockClassification, null, pageContext, null);
  }
}

// Export class for dependency injection
module.exports = PersonalizedGuidanceService;
