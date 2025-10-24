const express = require('express');

/**
 * Super Admin Data Management Routes
 * Only accessible to ray@jerky.com
 */
module.exports = function createDataManagementRoutes(storage, db) {
  const router = express.Router();

  /**
   * Middleware: Require super admin authentication (ray@jerky.com only)
   */
  async function requireSuperAdmin(req, res, next) {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(403).json({ error: 'Access denied. Super admin authentication required.' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(403).json({ error: 'Access denied. Invalid session.' });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(403).json({ error: 'Access denied. User not found.' });
      }

      // Only allow ray@jerky.com
      if (user.email !== 'ray@jerky.com') {
        return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
      }
      
      req.session = session;
      req.userId = session.userId;
      req.user = user;
      req.db = db;
      
      next();
    } catch (error) {
      console.error('Error in requireSuperAdmin:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/admin/data/clear-cache
   * Clear all application caches
   */
  router.post('/data/clear-cache', requireSuperAdmin, async (req, res) => {
    try {
      console.log(`🗑️ Super admin ${req.user.email} clearing all caches...`);

      // Clear all 6 system caches
      const AchievementCache = require('../../cache/AchievementCache');
      const HomeStatsCache = require('../../cache/HomeStatsCache');
      const LeaderboardCache = require('../../cache/LeaderboardCache');
      const MetadataCache = require('../../cache/MetadataCache');
      const LeaderboardPositionCache = require('../../cache/LeaderboardPositionCache');
      const RankingStatsCache = require('../../cache/RankingStatsCache');

      AchievementCache.getInstance().invalidate();
      console.log('🗑️ Cleared AchievementCache');
      
      HomeStatsCache.getInstance().invalidate();
      console.log('🗑️ Cleared HomeStatsCache (metrics)');
      
      LeaderboardCache.getInstance().invalidate();
      console.log('🗑️ Cleared LeaderboardCache');
      
      new MetadataCache().invalidate();
      console.log('🗑️ Cleared MetadataCache (products)');
      
      LeaderboardPositionCache.getInstance().invalidateAll();
      console.log('🗑️ Cleared LeaderboardPositionCache');
      
      new RankingStatsCache().invalidate();
      console.log('🗑️ Cleared RankingStatsCache (rankings)');

      res.json({ 
        success: true, 
        message: 'All caches cleared successfully',
        clearedCaches: [
          'AchievementCache',
          'HomeStatsCache',
          'LeaderboardCache',
          'MetadataCache',
          'LeaderboardPositionCache',
          'RankingStatsCache'
        ]
      });
    } catch (error) {
      console.error('Error clearing caches:', error);
      res.status(500).json({ error: 'Failed to clear caches', details: error.message });
    }
  });

  /**
   * DELETE /api/admin/data/clear-all
   * Clear all achievement data (DANGEROUS - Super admin only)
   */
  router.delete('/data/clear-all', requireSuperAdmin, async (req, res) => {
    try {
      console.log(`⚠️ Super admin ${req.user.email} clearing ALL DATA...`);

      const { sql } = require('drizzle-orm');

      // Truncate all data tables using SQL TRUNCATE (faster and resets sequences)
      // NOTE: db.delete() without WHERE clause doesn't work in Drizzle
      await db.execute(sql`TRUNCATE TABLE page_views CASCADE`);
      console.log('🗑️ Truncated page_views');
      
      await db.execute(sql`TRUNCATE TABLE rankings CASCADE`);
      console.log('🗑️ Truncated rankings');
      
      await db.execute(sql`TRUNCATE TABLE user_product_searches CASCADE`);
      console.log('🗑️ Truncated user_product_searches');
      
      await db.execute(sql`TRUNCATE TABLE activity_logs CASCADE`);
      console.log('🗑️ Truncated activity_logs');
      
      await db.execute(sql`TRUNCATE TABLE product_rankings CASCADE`);
      console.log('🗑️ Truncated product_rankings');
      
      await db.execute(sql`TRUNCATE TABLE product_views CASCADE`);
      console.log('🗑️ Truncated product_views');
      
      await db.execute(sql`TRUNCATE TABLE user_achievements CASCADE`);
      console.log('🗑️ Truncated user_achievements');

      
      // Clear all 6 system caches after deletion
      const AchievementCache = require('../../cache/AchievementCache');
      const HomeStatsCache = require('../../cache/HomeStatsCache');
      const LeaderboardCache = require('../../cache/LeaderboardCache');
      const MetadataCache = require('../../cache/MetadataCache');
      const LeaderboardPositionCache = require('../../cache/LeaderboardPositionCache');
      const RankingStatsCache = require('../../cache/RankingStatsCache');

      AchievementCache.getInstance().invalidate();
      HomeStatsCache.getInstance().invalidate();
      LeaderboardCache.getInstance().invalidate();
      new MetadataCache().invalidate();
      LeaderboardPositionCache.getInstance().invalidateAll();
      new RankingStatsCache().invalidate();

      console.log('✅ All data and caches cleared successfully');

      res.json({ 
        success: true, 
        message: 'All achievement data cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing data:', error);
      res.status(500).json({ error: 'Failed to clear data', details: error.message });
    }
  });

  /**
   * GET /api/admin/data/check-access
   * Check if current user has super admin access
   */
  router.get('/data/check-access', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.json({ hasSuperAdminAccess: false });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.json({ hasSuperAdminAccess: false });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.json({ hasSuperAdminAccess: false });
      }

      const hasSuperAdminAccess = user.email === 'ray@jerky.com';

      res.json({ 
        hasSuperAdminAccess,
        email: hasSuperAdminAccess ? user.email : undefined
      });
    } catch (error) {
      console.error('Error checking super admin access:', error);
      res.json({ hasSuperAdminAccess: false });
    }
  });

  return router;
};
