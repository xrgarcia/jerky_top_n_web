const db = require('../db');
const { tasteCommunities, userClassifications, productRankings, productsMetadata } = require('../../shared/schema');
const { eq, and, sql } = require('drizzle-orm');

/**
 * TasteCommunityService - Assigns users to taste-based communities based on their preferences
 * 
 * Communities are defined by:
 * - Dominant flavors (spicy, sweet, smoky, bbq, etc.)
 * - Dominant animals (beef, exotic, poultry, etc.)
 * - Minimum rankings required
 * - Percentage thresholds
 */
class TasteCommunityService {
  /**
   * Assign user to best-matching taste community
   * @param {number} userId - User ID
   * @returns {number|null} Community ID or null if no match
   */
  async assignCommunity(userId) {
    // Get all active communities
    const communities = await db
      .select()
      .from(tasteCommunities)
      .where(eq(tasteCommunities.isActive, 1));

    if (communities.length === 0) {
      return null;
    }

    // Get user's ranking distribution
    const userProfile = await this._getUserProfile(userId);

    if (userProfile.totalRankings === 0) {
      return null; // Can't assign without rankings
    }

    // Find best matching community
    let bestMatch = null;
    let bestScore = 0;

    for (const community of communities) {
      const score = this._calculateCommunityMatch(userProfile, community);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = community;
      }
    }

    // Require minimum match score of 50% to assign community
    if (bestScore < 0.5) {
      return null;
    }

    // Update user classification with community ID
    const communityId = bestMatch.id;
    await db
      .update(userClassifications)
      .set({ 
        tasteCommunityId: communityId,
        updatedAt: new Date()
      })
      .where(eq(userClassifications.userId, userId));

    // Update community member count
    await this._updateCommunityMemberCount(communityId);

    return communityId;
  }

  /**
   * Get user's flavor and animal profile from rankings
   */
  async _getUserProfile(userId) {
    const rankings = await db
      .select({
        shopifyProductId: productRankings.shopifyProductId,
        animalType: productsMetadata.animalType,
        primaryFlavor: productsMetadata.primaryFlavor
      })
      .from(productRankings)
      .leftJoin(productsMetadata, eq(productRankings.shopifyProductId, productsMetadata.shopifyProductId))
      .where(eq(productRankings.userId, userId));

    const flavorCounts = {};
    const animalCounts = {};
    let totalRankings = rankings.length;

    rankings.forEach(r => {
      if (r.primaryFlavor) {
        flavorCounts[r.primaryFlavor] = (flavorCounts[r.primaryFlavor] || 0) + 1;
      }
      if (r.animalType) {
        animalCounts[r.animalType] = (animalCounts[r.animalType] || 0) + 1;
      }
    });

    return {
      totalRankings,
      flavorCounts,
      animalCounts
    };
  }

  /**
   * Calculate how well user matches a community
   * Returns score between 0 and 1
   */
  _calculateCommunityMatch(userProfile, community) {
    const criteria = community.criteria;
    let score = 0;
    let checks = 0;

    // Check minimum rankings requirement
    if (criteria.min_rankings) {
      if (userProfile.totalRankings < criteria.min_rankings) {
        return 0; // Hard requirement
      }
      checks++;
      score += 0.2; // Bonus for meeting requirement
    }

    // Check dominant flavors
    if (criteria.dominant_flavors && criteria.dominant_flavors.length > 0) {
      const dominantFlavors = criteria.dominant_flavors;
      let flavorMatches = 0;
      let totalFlavorRankings = 0;

      dominantFlavors.forEach(flavor => {
        const count = userProfile.flavorCounts[flavor] || 0;
        flavorMatches += count;
      });

      totalFlavorRankings = Object.values(userProfile.flavorCounts).reduce((sum, count) => sum + count, 0);
      const flavorPercentage = totalFlavorRankings > 0 ? (flavorMatches / totalFlavorRankings) * 100 : 0;

      // Check percentage thresholds
      if (criteria.min_spicy_percentage && flavorPercentage >= criteria.min_spicy_percentage) {
        score += 0.4;
      } else if (criteria.min_bbq_percentage && flavorPercentage >= criteria.min_bbq_percentage) {
        score += 0.4;
      } else if (criteria.min_sweet_percentage && flavorPercentage >= criteria.min_sweet_percentage) {
        score += 0.4;
      } else if (flavorPercentage >= 40) { // Generic threshold
        score += 0.3;
      }
      checks++;
    }

    // Check dominant animals
    if (criteria.dominant_animals && criteria.dominant_animals.length > 0) {
      const dominantAnimals = criteria.dominant_animals;
      let animalMatches = 0;
      let totalAnimalRankings = 0;

      dominantAnimals.forEach(animal => {
        const count = userProfile.animalCounts[animal] || 0;
        animalMatches += count;
      });

      totalAnimalRankings = Object.values(userProfile.animalCounts).reduce((sum, count) => sum + count, 0);
      const animalPercentage = totalAnimalRankings > 0 ? (animalMatches / totalAnimalRankings) * 100 : 0;

      // Check percentage thresholds
      if (criteria.min_beef_percentage && animalPercentage >= criteria.min_beef_percentage) {
        score += 0.4;
      } else if (criteria.min_exotic_percentage && animalPercentage >= criteria.min_exotic_percentage) {
        score += 0.4;
      } else if (criteria.min_poultry_percentage && animalPercentage >= criteria.min_poultry_percentage) {
        score += 0.4;
      } else if (animalPercentage >= 40) { // Generic threshold
        score += 0.3;
      }
      checks++;
    }

    // Normalize score
    return checks > 0 ? score / checks : 0;
  }

  /**
   * Update community member count
   */
  async _updateCommunityMemberCount(communityId) {
    const result = await db
      .select({ count: sql`COUNT(*)` })
      .from(userClassifications)
      .where(eq(userClassifications.tasteCommunityId, communityId));

    const memberCount = result[0]?.count || 0;

    await db
      .update(tasteCommunities)
      .set({ 
        memberCount: parseInt(memberCount),
        updatedAt: new Date()
      })
      .where(eq(tasteCommunities.id, communityId));
  }

  /**
   * Get community details
   */
  async getCommunity(communityId) {
    const result = await db
      .select()
      .from(tasteCommunities)
      .where(eq(tasteCommunities.id, communityId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get all communities
   */
  async getAllCommunities() {
    return await db
      .select()
      .from(tasteCommunities)
      .where(eq(tasteCommunities.isActive, 1));
  }

  /**
   * Get users in a community (with basic info)
   */
  async getCommunityMembers(communityId, limit = 50) {
    return await db
      .select()
      .from(userClassifications)
      .where(eq(userClassifications.tasteCommunityId, communityId))
      .limit(limit);
  }

  /**
   * Find similar users (same community)
   */
  async findSimilarUsers(userId, limit = 10) {
    // Get user's community
    const userClassification = await db
      .select()
      .from(userClassifications)
      .where(eq(userClassifications.userId, userId))
      .limit(1);

    if (userClassification.length === 0 || !userClassification[0].tasteCommunityId) {
      return [];
    }

    const communityId = userClassification[0].tasteCommunityId;

    // Get other users in same community
    const similarUsers = await db
      .select()
      .from(userClassifications)
      .where(
        and(
          eq(userClassifications.tasteCommunityId, communityId),
          sql`${userClassifications.userId} != ${userId}`
        )
      )
      .limit(limit);

    return similarUsers;
  }
}

const tasteCommunityService = new TasteCommunityService();
module.exports = tasteCommunityService;
