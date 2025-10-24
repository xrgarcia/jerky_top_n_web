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

      // Import and clear all caches
      const AchievementCache = require('../../cache/AchievementCache');
      const HomeStatsCache = require('../../cache/HomeStatsCache');
      const LeaderboardCache = require('../../cache/LeaderboardCache');
      const MetadataCache = require('../../cache/MetadataCache');
      const LeaderboardPositionCache = require('../../cache/LeaderboardPositionCache');

      const achievementCache = AchievementCache.getInstance();
      achievementCache.invalidate();
      
      const homeStatsCache = HomeStatsCache.getInstance();
      homeStatsCache.invalidate();
      
      const leaderboardCache = LeaderboardCache.getInstance();
      leaderboardCache.invalidate(); // null = invalidate all
      
      const metadataCache = MetadataCache.getInstance();
      metadataCache.invalidate();
      
      const leaderboardPositionCache = LeaderboardPositionCache.getInstance();
      leaderboardPositionCache.invalidateAll();

      console.log('✅ All caches cleared successfully');

      res.json({ 
        success: true, 
        message: 'All caches cleared successfully',
        clearedCaches: [
          'AchievementCache',
          'HomeStatsCache',
          'LeaderboardCache',
          'MetadataCache',
          'LeaderboardPositionCache'
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
      console.log(`⚠️ Super admin ${req.user.email} clearing ALL achievement data...`);

      const { userAchievements } = require('../../../shared/schema');

      // Delete all user achievements
      const result = await db.delete(userAchievements);
      
      // Clear all caches after deletion
      const AchievementCache = require('../../cache/AchievementCache');
      const HomeStatsCache = require('../../cache/HomeStatsCache');
      const LeaderboardCache = require('../../cache/LeaderboardCache');
      const MetadataCache = require('../../cache/MetadataCache');
      const LeaderboardPositionCache = require('../../cache/LeaderboardPositionCache');

      const achievementCache = AchievementCache.getInstance();
      achievementCache.invalidate();
      
      const homeStatsCache = HomeStatsCache.getInstance();
      homeStatsCache.invalidate();
      
      const leaderboardCache = LeaderboardCache.getInstance();
      leaderboardCache.invalidate(); // null = invalidate all
      
      const metadataCache = MetadataCache.getInstance();
      metadataCache.invalidate();
      
      const leaderboardPositionCache = LeaderboardPositionCache.getInstance();
      leaderboardPositionCache.invalidateAll();

      console.log('✅ All achievement data cleared successfully');

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
