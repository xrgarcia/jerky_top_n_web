const express = require('express');
const Sentry = require('@sentry/node');
const { achievements, users } = require('../../../shared/schema');
const { eq, and, inArray } = require('drizzle-orm');

module.exports = function createRecalculateRoutes(storage, db, productsService = null) {
  const router = express.Router();

  /**
   * Middleware: Require employee authentication
   */
  async function requireEmployeeAuth(req, res, next) {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(403).json({ error: 'Access denied. Employee authentication required.' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(403).json({ error: 'Access denied. Invalid session.' });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(403).json({ error: 'Access denied. User not found.' });
      }

      const hasAccess = user.role === 'employee_admin' || (user.email && user.email.endsWith('@jerky.com'));
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied. Employee authentication required.' });
      }
      
      req.session = session;
      req.userId = session.userId;
      req.user = user;
      req.db = db;
      
      next();
    } catch (error) {
      console.error('Error in requireEmployeeAuth:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/admin/achievements/:achievementId/recalculate
   * Retroactively award an achievement to all qualifying users
   * 
   * ACHIEVEMENT TYPES & BEHAVIOR:
   * 
   * 1. STATIC_COLLECTION (custom product lists):
   *    - Requires explicit product IDs in requirement.products
   *    - Awards based on how many products user has ranked
   * 
   * 2. DYNAMIC_COLLECTION (auto-calculated collections):
   *    - complete_collection: Awards based on % of ALL rankable products
   *    - brand_collection: Awards based on % of products from specific brands
   *    - animal_collection: Awards based on % of products from specific animals
   *    - If has_tiers = true: Awards tiers (bronze/silver/gold) at different percentages
   *    - If has_tiers = false: ONLY awards when user reaches 100% completion
   * 
   * 3. ENGAGEMENT_COLLECTION (user activity):
   *    - rank_count: Number of products ranked
   *    - search_count: Number of searches performed
   *    - Checks userStats against requirement.value
   */
  router.post('/achievements/:achievementId/recalculate', requireEmployeeAuth, async (req, res) => {
  // Extract achievementId outside try block so it's accessible in catch
  const { achievementId } = req.params;
  
  try {
    console.log(`🔄 Starting retroactive recalculation for achievement ${achievementId}...`);
    
    // Get the achievement
    const achievement = await db.select()
      .from(achievements)
      .where(eq(achievements.id, parseInt(achievementId)))
      .limit(1);
      
    if (achievement.length === 0) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    const ach = achievement[0];
    console.log(`📊 Recalculating achievement: ${ach.name} (${ach.code})`);
    console.log(`   Type: ${ach.collectionType}, Requirement: ${JSON.stringify(ach.requirement)}`);
    console.log(`   has_tiers: ${ach.hasTiers}, tier_thresholds: ${JSON.stringify(ach.tierThresholds)}`);
    
    // Get users for recalculation
    // Optimize by only checking users with relevant activity/data
    let allUsers;
    
    // Collection types that query productRankings (only need users who have rankings)
    const rankingBasedTypes = ['dynamic_collection', 'static_collection', 'custom_product_list', 'flavor_coin'];
    const isRankingBased = rankingBasedTypes.includes(ach.collectionType) || 
                           (ach.collectionType === 'engagement_collection' && ach.requirement?.type === 'rank_count');
    
    // Activity-based engagement types that query userActivities
    const activityBasedTypes = ['search_count', 'page_view_count', 'product_view_count', 
                                'unique_product_view_count', 'profile_view_count', 'unique_profile_view_count'];
    const isActivityBased = ach.collectionType === 'engagement_collection' && activityBasedTypes.includes(ach.requirement?.type);
    
    if (isRankingBased) {
      // For ranking-based achievements/collections, only check users who have rankings
      console.log(`⚡ Optimized query: Fetching only users with rankings (type: ${ach.collectionType})`);
      const { productRankings } = require('../../../shared/schema');
      
      const usersWithRankings = await db
        .selectDistinct({ userId: productRankings.userId })
        .from(productRankings);
      
      const userIds = usersWithRankings.map(u => u.userId);
      
      if (userIds.length === 0) {
        console.log(`⚠️ No users with rankings found`);
        allUsers = [];
      } else {
        allUsers = await db.select({ id: users.id }).from(users).where(inArray(users.id, userIds));
      }
      
      const totalUsers = await db.select({ count: users.id }).from(users);
      console.log(`✅ Optimized: Checking ${allUsers.length} users with rankings (saved checking ${totalUsers.length - allUsers.length} users with 0 rankings)`);
      
    } else if (isActivityBased) {
      // For activity-based achievements, only check users who have any activity
      console.log(`⚡ Optimized query: Fetching only users with activity records`);
      const { userActivities } = require('../../../shared/schema');
      
      const usersWithActivity = await db
        .selectDistinct({ userId: userActivities.userId })
        .from(userActivities);
      
      const userIds = usersWithActivity.map(u => u.userId);
      
      if (userIds.length === 0) {
        console.log(`⚠️ No users with activity found`);
        allUsers = [];
      } else {
        allUsers = await db.select({ id: users.id }).from(users).where(inArray(users.id, userIds));
      }
      
      const totalUsers = await db.select({ count: users.id }).from(users);
      console.log(`✅ Optimized: Checking ${allUsers.length} users with activity (saved checking ${totalUsers.length - allUsers.length} users with 0 activity)`);
      
    } else {
      // For other achievement types (streaks, leaderboard, etc.), check all users
      allUsers = await db.select({ id: users.id }).from(users);
      console.log(`👥 Found ${allUsers.length} users to process`);
    }
    
    // Get managers and repositories (create once, reuse for all users)
    const CollectionManager = require('../../services/CollectionManager');
    const EngagementManager = require('../../services/EngagementManager');
    const AchievementRepository = require('../../repositories/AchievementRepository');
    const ProductsMetadataRepository = require('../../repositories/ProductsMetadataRepository');
    const ActivityLogRepository = require('../../repositories/ActivityLogRepository');
    const { primaryDb } = require('../../db-primary');
    
    const achievementRepo = new AchievementRepository(db);
    const productsMetadataRepo = new ProductsMetadataRepository(db);
    const activityLogRepo = new ActivityLogRepository(db);
    
    const collectionManager = new CollectionManager(achievementRepo, productsMetadataRepo, primaryDb, productsService);
    const engagementManager = new EngagementManager(achievementRepo, activityLogRepo, primaryDb);
    
    // Process users in batches to avoid overload
    const BATCH_SIZE = 5;
    let awardedCount = 0;
    let upgradedCount = 0;
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
      const batch = allUsers.slice(i, i + BATCH_SIZE);
      
      // Process each user in the batch
      const batchPromises = batch.map(async (user) => {
        try {
          let result = null;
          
          // Handle different achievement types
          if (ach.collectionType === 'static_collection' || ach.collectionType === 'custom_product_list' || ach.collectionType === 'flavor_coin') {
            // Static collection (product list) or flavor coin - calculate progress
            const progress = await collectionManager.calculateCustomProductProgress(user.id, ach);
            if (progress.tier) {
              result = await collectionManager.updateCollectionProgress(user.id, ach, progress);
            }
          } else if (ach.collectionType === 'dynamic_collection') {
            // Dynamic collection - calculate progress
            const progress = await collectionManager.calculateCollectionProgress(user.id, ach);
            if (progress.tier) {
              result = await collectionManager.updateCollectionProgress(user.id, ach, progress);
            }
          } else if (ach.collectionType === 'engagement_collection') {
            // Engagement achievements (rankings, activity counts, etc.)
            // Calculate user stats directly from database
            const { productRankings, userActivities } = require('../../../shared/schema');
            const { count } = require('drizzle-orm');
            
            const [rankingsResult, searchesResult] = await Promise.all([
              db.select({ count: count() })
                .from(productRankings)
                .where(eq(productRankings.userId, user.id)),
              db.select({ count: count() })
                .from(userActivities)
                .where(and(
                  eq(userActivities.userId, user.id),
                  eq(userActivities.activityType, 'search')
                ))
            ]);
            
            const userStats = {
              totalRankings: rankingsResult[0]?.count || 0,
              totalSearches: searchesResult[0]?.count || 0
            };
            
            result = await engagementManager.checkAndAwardEngagementAchievement(user.id, ach, userStats);
          }
          
          processedCount++;
          
          if (result) {
            if (result.type === 'new') {
              awardedCount++;
              console.log(`   ✨ User ${user.id}: ${ach.name} awarded (${result.tier})`);
            } else if (result.type === 'tier_upgrade') {
              upgradedCount++;
              console.log(`   ⬆️ User ${user.id}: ${ach.name} upgraded (${result.previousTier} → ${result.newTier})`);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing user ${user.id}:`, error);
          Sentry.captureException(error, {
            tags: {
              endpoint: 'admin_recalculate',
              achievement_id: ach.id,
              achievement_code: ach.code,
              achievement_type: ach.collectionType,
              user_id: user.id
            },
            extra: {
              achievementName: ach.name,
              userId: user.id,
              batchNumber: Math.floor(i / BATCH_SIZE) + 1,
              processedCount,
              errorCount
            }
          });
          errorCount++;
        }
      });
      
      await Promise.all(batchPromises);
      console.log(`⏳ Processed ${Math.min(i + BATCH_SIZE, allUsers.length)}/${allUsers.length} users...`);
    }
    
    console.log(`✅ Recalculation complete: ${awardedCount} newly awarded, ${upgradedCount} upgraded, ${errorCount} errors`);
    
    // Invalidate caches after recalculation
    const AchievementCache = require('../../cache/AchievementCache');
    const HomeStatsCache = require('../../cache/HomeStatsCache');
    const LeaderboardCache = require('../../cache/LeaderboardCache');
    const RankingStatsCache = require('../../cache/RankingStatsCache');
    const LeaderboardPositionCache = require('../../cache/LeaderboardPositionCache');
    
    const achievementCache = AchievementCache.getInstance();
    const homeStatsCache = HomeStatsCache.getInstance();
    const leaderboardCache = LeaderboardCache.getInstance();
    const rankingStatsCache = RankingStatsCache.getInstance();
    const leaderboardPositionCache = LeaderboardPositionCache.getInstance();
    
    achievementCache.invalidate();
    homeStatsCache.invalidate();
    leaderboardCache.invalidate(); // invalidate() with no params clears all
    await rankingStatsCache.invalidate();
    leaderboardPositionCache.invalidateAll();
    console.log(`🗑️ All caches invalidated after recalculation`);
    
    res.json({
      success: true,
      achievement: {
        id: ach.id,
        code: ach.code,
        name: ach.name,
        type: ach.collectionType
      },
      stats: {
        totalUsers: allUsers.length,
        processed: processedCount,
        newAwards: awardedCount,
        tierUpgrades: upgradedCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('Error recalculating achievement:', error);
    
    // Capture error in Sentry with full context
    Sentry.captureException(error, {
      tags: {
        endpoint: 'admin_recalculate',
        achievement_id: achievementId
      },
      extra: {
        achievementId,
        errorMessage: error.message,
        errorStack: error.stack
      }
    });
    
    res.status(500).json({ error: 'Failed to recalculate achievement', details: error.message });
  }
  });

  return router;
};
