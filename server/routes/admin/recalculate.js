const express = require('express');
const { achievements, users } = require('../../../shared/schema');
const { eq } = require('drizzle-orm');

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
   */
  router.post('/achievements/:achievementId/recalculate', requireEmployeeAuth, async (req, res) => {
  try {
    const { achievementId } = req.params;
    
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
    
    // Get all users from the database
    const allUsers = await db.select({ id: users.id }).from(users);
    console.log(`👥 Found ${allUsers.length} users to process`);
    
    // Get the CollectionManager for custom collections
    const CollectionManager = require('../../services/CollectionManager');
    const AchievementRepository = require('../../repositories/AchievementRepository');
    const ProductsMetadataRepository = require('../../repositories/ProductsMetadataRepository');
    const { primaryDb } = require('../../db-primary');
    
    const achievementRepo = new AchievementRepository(db);
    const productsMetadataRepo = new ProductsMetadataRepository(db);
    const collectionManager = new CollectionManager(achievementRepo, productsMetadataRepo, primaryDb, productsService);
    
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
            const EngagementManager = require('../../services/EngagementManager');
            const engagementManager = new EngagementManager(storage, db);
            result = await engagementManager.checkAndAwardEngagementAchievement(user.id, ach);
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
    rankingStatsCache.invalidate();
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
    res.status(500).json({ error: 'Failed to recalculate achievement', details: error.message });
  }
  });

  return router;
};
