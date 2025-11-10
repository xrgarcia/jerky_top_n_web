const express = require('express');
const EngagementBackfillQueue = require('../../services/EngagementBackfillQueue');

/**
 * Engagement Score Backfill Admin Routes
 * Accessible to super admin users only (ray@jerky.com)
 */
module.exports = function createEngagementBackfillRoutes(storage, db) {
  const router = express.Router();

  /**
   * Middleware: Require super admin authentication
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

      // Only allow super admin (ray@jerky.com)
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
   * POST /api/admin/engagement/backfill
   * Start backfilling engagement scores for all active users
   */
  router.post('/engagement/backfill', requireSuperAdmin, async (req, res) => {
    try {
      console.log(`🚀 Super admin ${req.user.email} starting engagement score backfill`);

      const result = await EngagementBackfillQueue.startBackfill();

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error starting engagement backfill:', error);
      res.status(500).json({ error: 'Failed to start backfill', details: error.message });
    }
  });

  /**
   * GET /api/admin/engagement/backfill/progress
   * Get current backfill progress and statistics
   */
  router.get('/engagement/backfill/progress', requireSuperAdmin, async (req, res) => {
    try {
      const stats = await EngagementBackfillQueue.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting backfill progress:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  });

  /**
   * POST /api/admin/engagement/backfill/clean
   * Clean completed and failed jobs from queue
   */
  router.post('/engagement/backfill/clean', requireSuperAdmin, async (req, res) => {
    try {
      console.log(`🗑️ Super admin ${req.user.email} cleaning engagement backfill queue`);
      
      await EngagementBackfillQueue.clean();
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error cleaning queue:', error);
      res.status(500).json({ error: 'Failed to clean queue' });
    }
  });

  return router;
};
