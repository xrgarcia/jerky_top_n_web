const { db } = require('../db');
const { userClassifications, classificationConfig, productRankings, userAchievements, achievements, userActivities, productsMetadata, customerOrderItems } = require('../../shared/schema');
const { eq, and, gte, count, sql } = require('drizzle-orm');
const flavorProfileCommunityService = require('./FlavorProfileCommunityService');

/**
 * UserClassificationService - Analyzes user behavior and assigns classification attributes
 * 
 * Classification Dimensions:
 * 1. Journey Stage: new_user, exploring, engaged, power_user, dormant
 * 2. Engagement Level: none, low, medium, high, very_high
 * 3. Exploration Breadth: narrow, moderate, diverse
 * 4. Focus Areas: dominant flavor/animal preferences
 * 5. Taste Community: assigned community based on preferences
 * 6. Flavor Communities: micro-communities per flavor profile (curious/seeker/taster/enthusiast/explorer)
 */
class UserClassificationService {
  constructor({ db: dbInstance = db, flavorProfileCommunityService: communityService = flavorProfileCommunityService } = {}) {
    this.db = dbInstance;
    this.flavorProfileCommunityService = communityService;
    this.configCache = null;
    this.configCacheTime = null;
    this.configCacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get classification configuration from database with caching
   */
  async getConfig() {
    const now = Date.now();
    if (this.configCache && this.configCacheTime && (now - this.configCacheTime < this.configCacheTTL)) {
      return this.configCache;
    }

    const configs = await this.db.select().from(classificationConfig);
    
    const configMap = {};
    configs.forEach(config => {
      configMap[config.configKey] = config.configValue;
    });

    this.configCache = configMap;
    this.configCacheTime = now;

    return configMap;
  }

  /**
   * Invalidate configuration cache
   */
  invalidateConfigCache() {
    this.configCache = null;
    this.configCacheTime = null;
  }

  /**
   * Classify user and store/update classification
   * @param {number} userId - User ID
   * @returns {object} Classification data
   */
  async classifyUser(userId) {
    const config = await this.getConfig();
    
    // Gather user data
    const userData = await this._gatherUserData(userId);
    
    // Calculate classifications
    const journeyStage = this._determineJourneyStage(userData, config);
    const engagementLevel = this._determineEngagementLevel(userData, config);
    const explorationBreadth = this._determineExplorationBreadth(userData, config);
    const focusAreas = this._determineFocusAreas(userData);

    // Update flavor profile communities (micro-communities per flavor profile)
    const flavorCommunities = await this.flavorProfileCommunityService.updateUserFlavorCommunities(userId);

    const classificationData = {
      totalRankings: userData.totalRankings,
      totalEngagementCoins: userData.totalEngagementCoins,
      uniqueFlavors: userData.uniqueFlavors,
      uniqueAnimals: userData.uniqueAnimals,
      activities30d: userData.activities30d,
      daysSinceLastActivity: userData.daysSinceLastActivity,
      daysSinceRegistration: userData.daysSinceRegistration,
      flavorDistribution: userData.flavorDistribution,
      animalDistribution: userData.animalDistribution,
      longestStreak: userData.longestStreak,
      flavorCommunities: flavorCommunities // Add flavor communities to classification data
    };

    // Store or update classification
    const existing = await this.db
      .select()
      .from(userClassifications)
      .where(eq(userClassifications.userId, userId))
      .limit(1);

    const classificationRecord = {
      userId,
      journeyStage,
      engagementLevel,
      explorationBreadth,
      focusAreas,
      classificationData,
      lastCalculated: new Date(),
      updatedAt: new Date()
    };

    if (existing.length > 0) {
      await this.db
        .update(userClassifications)
        .set(classificationRecord)
        .where(eq(userClassifications.userId, userId));
    } else {
      await this.db.insert(userClassifications).values(classificationRecord);
    }

    return {
      userId,
      journeyStage,
      engagementLevel,
      explorationBreadth,
      focusAreas,
      classificationData
    };
  }

  /**
   * Get user classification (from database)
   */
  async getUserClassification(userId) {
    const result = await this.db
      .select()
      .from(userClassifications)
      .where(eq(userClassifications.userId, userId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Gather all relevant user data for classification
   */
  async _gatherUserData(userId) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get total rankings with metadata
    const rankings = await this.db
      .select({
        shopifyProductId: productRankings.shopifyProductId,
        createdAt: productRankings.createdAt,
        animalType: productsMetadata.animalType,
        primaryFlavor: productsMetadata.primaryFlavor
      })
      .from(productRankings)
      .leftJoin(productsMetadata, eq(productRankings.shopifyProductId, productsMetadata.shopifyProductId))
      .where(eq(productRankings.userId, userId));

    // Get engagement coins
    const engagementCoins = await this.db
      .select()
      .from(userAchievements)
      .leftJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(achievements.collectionType, 'engagement_collection')
        )
      );

    // Get activities in last 30 days
    const recentActivities = await this.db
      .select()
      .from(userActivities)
      .where(
        and(
          eq(userActivities.userId, userId),
          gte(userActivities.createdAt, thirtyDaysAgo)
        )
      );

    // Calculate flavor and animal distributions
    const flavorDistribution = {};
    const animalDistribution = {};
    const uniqueFlavors = new Set();
    const uniqueAnimals = new Set();

    rankings.forEach(r => {
      if (r.primaryFlavor) {
        uniqueFlavors.add(r.primaryFlavor);
        flavorDistribution[r.primaryFlavor] = (flavorDistribution[r.primaryFlavor] || 0) + 1;
      }
      if (r.animalType) {
        uniqueAnimals.add(r.animalType);
        animalDistribution[r.animalType] = (animalDistribution[r.animalType] || 0) + 1;
      }
    });

    // Get last activity date
    let lastActivityDate = null;
    if (rankings.length > 0) {
      lastActivityDate = rankings.reduce((latest, r) => {
        return r.createdAt > latest ? r.createdAt : latest;
      }, rankings[0].createdAt);
    }
    if (recentActivities.length > 0) {
      const lastRecentActivity = recentActivities[recentActivities.length - 1].createdAt;
      if (!lastActivityDate || lastRecentActivity > lastActivityDate) {
        lastActivityDate = lastRecentActivity;
      }
    }

    const daysSinceLastActivity = lastActivityDate 
      ? Math.floor((now - new Date(lastActivityDate)) / (24 * 60 * 60 * 1000))
      : 999;

    // Calculate days since registration (use first ranking or first activity)
    let registrationDate = rankings.length > 0 ? rankings[0].createdAt : null;
    if (recentActivities.length > 0 && (!registrationDate || recentActivities[0].createdAt < registrationDate)) {
      registrationDate = recentActivities[0].createdAt;
    }
    const daysSinceRegistration = registrationDate
      ? Math.floor((now - new Date(registrationDate)) / (24 * 60 * 60 * 1000))
      : 0;

    return {
      totalRankings: rankings.length,
      totalEngagementCoins: engagementCoins.length,
      uniqueFlavors: uniqueFlavors.size,
      uniqueAnimals: uniqueAnimals.size,
      activities30d: recentActivities.length,
      daysSinceLastActivity,
      daysSinceRegistration,
      flavorDistribution,
      animalDistribution,
      longestStreak: 0 // Can be enhanced with streak data later
    };
  }

  /**
   * Determine journey stage based on activity patterns
   * 
   * JOURNEY STAGE THRESHOLDS:
   * - Dormant: 30+ days since last activity
   * - New User: No rankings, registered within 7 days
   * - Power User: 31+ rankings AND 20+ activities (30 days)
   * - Engaged: 11-30 rankings AND 5+ activities (30 days)
   * - Exploring: 1-10 rankings AND 1+ activities (30 days) - any recent activity
   * 
   * NOTE: Thresholds align with engagement levels (1-4=low, 5-19=medium, 20-49=high, 50+=very high)
   * to ensure journey stage and engagement level classifications are consistent.
   * 
   * TODO: Make configurable via database for easier adjustments
   */
  _determineJourneyStage(userData, config) {
    const rules = config.journey_stage_thresholds || {};

    // Dormant: inactive for 30+ days
    if (userData.daysSinceLastActivity >= (rules.dormant?.days_since_last_activity || 30)) {
      return 'dormant';
    }

    // New user: no rankings yet, within first week
    if (userData.totalRankings === 0 && userData.daysSinceRegistration <= (rules.new_user?.max_days_active || 7)) {
      return 'new_user';
    }

    // Power user: 31+ rankings AND high recent activity (20+ activities in 30 days)
    if (
      userData.totalRankings >= (rules.power_user?.min_rankings || 31) &&
      userData.activities30d >= (rules.power_user?.min_activities_30d || 20)
    ) {
      return 'power_user';
    }

    // Engaged: 11-30 rankings AND moderate activity (5+ activities in 30 days)
    if (
      userData.totalRankings >= (rules.engaged?.min_rankings || 11) &&
      userData.totalRankings <= (rules.engaged?.max_rankings || 30) &&
      userData.activities30d >= (rules.engaged?.min_activities_30d || 5)
    ) {
      return 'engaged';
    }

    // Exploring: 1-10 rankings AND any recent activity (1+ activities in 30 days)
    // Lowered from 5 to 1 to align with engagement level "low" tier (1-4 activities)
    if (
      userData.totalRankings >= (rules.exploring?.min_rankings || 1) &&
      userData.totalRankings <= (rules.exploring?.max_rankings || 10) &&
      userData.activities30d >= (rules.exploring?.min_activities || 1)
    ) {
      return 'exploring';
    }

    // Default: exploring if they have any rankings, otherwise new_user
    return userData.totalRankings > 0 ? 'exploring' : 'new_user';
  }

  /**
   * Determine engagement level based on recent user activity
   * 
   * ENGAGEMENT LEVEL THRESHOLDS (based on activities in last 30 days):
   * - Very High: 50+ activities
   * - High: 20-49 activities
   * - Medium: 5-19 activities
   * - Low: 1-4 activities
   * - None: 0 activities
   * 
   * Activities include: page views, rankings saved, searches, logins, product views, profile views
   * 
   * TODO: Make these thresholds configurable via database (feature flags or admin settings)
   * so jerky.com employees can adjust ranges without code changes.
   */
  _determineEngagementLevel(userData, config) {
    const rules = config.engagement_level_rules || {};
    const activityCount = userData.activities30d;

    // Very high: 50+ activities in last 30 days
    if (activityCount >= (rules.very_high?.min_activities_30d || 50)) {
      return 'very_high';
    }

    // High: 20-49 activities
    if (activityCount >= (rules.high?.min_activities_30d || 20)) {
      return 'high';
    }

    // Medium: 5-19 activities
    if (activityCount >= (rules.medium?.min_activities_30d || 5)) {
      return 'medium';
    }

    // Low: 1-4 activities
    if (activityCount >= (rules.low?.min_activities_30d || 1)) {
      return 'low';
    }

    // None: no engagement
    return 'none';
  }

  /**
   * Determine exploration breadth based on variety
   */
  _determineExplorationBreadth(userData, config) {
    const rules = config.exploration_breadth_rules || {};

    // Diverse: 9+ unique flavors, 3+ animals
    if (
      userData.uniqueFlavors >= (rules.diverse?.min_unique_flavors || 9) &&
      userData.uniqueAnimals >= (rules.diverse?.min_unique_animals || 3)
    ) {
      return 'diverse';
    }

    // Moderate: 4-8 unique flavors, 2+ animals
    if (
      userData.uniqueFlavors >= (rules.moderate?.min_unique_flavors || 4) &&
      userData.uniqueFlavors <= (rules.moderate?.max_unique_flavors || 8) &&
      userData.uniqueAnimals >= (rules.moderate?.min_unique_animals || 2)
    ) {
      return 'moderate';
    }

    // Narrow: focused preferences
    return 'narrow';
  }

  /**
   * Determine focus areas (dominant flavors and animals)
   */
  _determineFocusAreas(userData) {
    const focusAreas = [];

    // Get top 2 flavors
    const flavorEntries = Object.entries(userData.flavorDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    
    flavorEntries.forEach(([flavor, count]) => {
      if (count >= 3) { // Minimum threshold
        focusAreas.push(flavor);
      }
    });

    // Get top 2 animals
    const animalEntries = Object.entries(userData.animalDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    
    animalEntries.forEach(([animal, count]) => {
      if (count >= 3) { // Minimum threshold
        focusAreas.push(animal);
      }
    });

    return focusAreas;
  }

  /**
   * Get all users with classifications for admin view
   */
  async getAllClassifications(limit = 100, offset = 0) {
    return await this.db
      .select()
      .from(userClassifications)
      .limit(limit)
      .offset(offset);
  }
}

// Default singleton instance for HTTP routes (uses general pool)
const userClassificationService = new UserClassificationService();

// Factory function for creating worker-specific instances
function createUserClassificationService({ db: dbInstance, flavorProfileCommunityService: communityService }) {
  return new UserClassificationService({ db: dbInstance, flavorProfileCommunityService: communityService });
}

module.exports = userClassificationService;
module.exports.createUserClassificationService = createUserClassificationService;
