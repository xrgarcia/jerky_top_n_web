const userClassificationService = require('./UserClassificationService');
const tasteCommunityService = require('./TasteCommunityService');

/**
 * PersonalizedGuidanceService - Generates targeted guidance messages based on user classification
 * 
 * Message categories:
 * 1. New users - explain the game
 * 2. Low engagement - encourage exploration  
 * 3. Narrow focus - encourage discovery
 * 4. High performers - positive reinforcement
 * 5. Community-based - connect with similar users
 */
class PersonalizedGuidanceService {
  /**
   * Get personalized guidance for user
   * @param {number} userId - User ID
   * @returns {object} Guidance data with message, type, and classification
   */
  async getGuidance(userId) {
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

    // Generate message based on classification
    const message = this._generateMessage(classification, community);

    return {
      message: message.text,
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
   * Generate personalized message based on classification
   */
  _generateMessage(classification, community) {
    const { journeyStage, engagementLevel, explorationBreadth, focusAreas } = classification;

    // Priority 1: New users need onboarding
    if (journeyStage === 'new_user') {
      return {
        type: 'onboarding',
        icon: '👋',
        text: "Welcome to the Coin Book! As you rank flavors you've purchased, you'll earn Flavor Coins and unlock achievements. Each ranking helps you discover your taste profile and connects you with a community of fellow jerky enthusiasts."
      };
    }

    // Priority 2: Dormant users need re-engagement
    if (journeyStage === 'dormant') {
      return {
        type: 'reengagement',
        icon: '🎯',
        text: "We've missed you! New flavors have been added since your last visit. Come back and rank your recent purchases to earn more coins and see how your collection has grown."
      };
    }

    // Priority 3: High performers get positive reinforcement
    if (journeyStage === 'power_user' && engagementLevel === 'very_high') {
      const communityText = community 
        ? ` You're a valued member of the ${community.icon} ${community.name} community!`
        : '';
      return {
        type: 'celebration',
        icon: '🌟',
        text: `You're crushing it! With your collection progress and engagement, you're one of our top players.${communityText} Keep exploring new flavors to unlock even more achievements.`
      };
    }

    // Priority 4: Narrow focus + low engagement = encourage exploration
    if (explorationBreadth === 'narrow' && (engagementLevel === 'none' || engagementLevel === 'low')) {
      const focusText = focusAreas.length > 0 
        ? ` You seem to enjoy ${focusAreas.slice(0, 2).join(' and ')} flavors.`
        : '';
      return {
        type: 'exploration',
        icon: '🔍',
        text: `${focusText} Try branching out! Ranking different flavor profiles and protein types will help you discover new favorites and earn more Engagement Coins.`
      };
    }

    // Priority 5: Community-based guidance
    if (community) {
      const memberCount = community.memberCount || 0;
      return {
        type: 'community',
        icon: community.icon,
        text: `You're part of the ${community.name} community! ${community.description} Connect with ${memberCount} other members who share your taste.`
      };
    }

    // Priority 6: Engaged users - encourage consistency
    if (journeyStage === 'engaged' && engagementLevel === 'medium') {
      return {
        type: 'encouragement',
        icon: '🎖️',
        text: "You're building a solid collection! Keep your ranking streak going to earn more Engagement Coins and unlock tiered achievements."
      };
    }

    // Priority 7: Exploring users - guide next steps
    if (journeyStage === 'exploring') {
      const rankedCount = classification.classificationData?.totalRankings || 0;
      return {
        type: 'guidance',
        icon: '📈',
        text: `Great start with ${rankedCount} flavors ranked! Try the search feature to find flavors that match your preferences, and check out the community to see what other players are ranking.`
      };
    }

    // Default: Generic encouragement
    return {
      type: 'general',
      icon: '📖',
      text: "Keep building your Coin Book! Every flavor you rank brings you closer to completing collections and unlocking new achievements."
    };
  }

  /**
   * Get message based on specific classification override (for admin testing)
   */
  async getMessageForClassification(journeyStage, engagementLevel, explorationBreadth, focusAreas = [], communityId = null) {
    let community = null;
    if (communityId) {
      community = await tasteCommunityService.getCommunity(communityId);
    }

    const mockClassification = {
      journeyStage,
      engagementLevel,
      explorationBreadth,
      focusAreas,
      classificationData: {}
    };

    return this._generateMessage(mockClassification, community);
  }
}

const personalizedGuidanceService = new PersonalizedGuidanceService();
module.exports = personalizedGuidanceService;
