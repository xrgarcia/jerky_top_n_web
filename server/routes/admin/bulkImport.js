const express = require('express');
const bulkImportService = require('../../services/BulkImportService');
const bulkImportQueue = require('../../services/BulkImportQueue');

/**
 * Bulk Import Admin Routes
 * Accessible to employee_admin users
 */
module.exports = function createBulkImportRoutes(storage, db) {
  const router = express.Router();

  /**
   * Middleware: Require employee admin authentication
   */
  async function requireEmployeeAdmin(req, res, next) {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(403).json({ error: 'Access denied. Admin authentication required.' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(403).json({ error: 'Access denied. Invalid session.' });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(403).json({ error: 'Access denied. User not found.' });
      }

      // Only allow employee_admin role
      if (user.role !== 'employee_admin') {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }
      
      req.session = session;
      req.userId = session.userId;
      req.user = user;
      req.db = db;
      
      next();
    } catch (error) {
      console.error('Error in requireEmployeeAdmin:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/admin/bulk-import/status
   * Get Shopify API availability and queue status
   */
  router.get('/bulk-import/status', requireEmployeeAdmin, async (req, res) => {
    try {
      const isAvailable = bulkImportService.isAvailable();
      const queueStats = await bulkImportQueue.getStats();

      res.json({
        shopifyApiAvailable: isAvailable,
        queue: queueStats
      });
    } catch (error) {
      console.error('Error getting bulk import status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  /**
   * GET /api/admin/bulk-import/shopify-stats
   * Get Shopify customer count vs database user stats
   */
  router.get('/bulk-import/shopify-stats', requireEmployeeAdmin, async (req, res) => {
    try {
      const stats = await bulkImportService.getShopifyStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting Shopify stats:', error);
      res.status(500).json({ error: 'Failed to get Shopify stats' });
    }
  });

  /**
   * GET /api/admin/bulk-import/progress
   * Get current import progress and statistics
   */
  router.get('/bulk-import/progress', requireEmployeeAdmin, async (req, res) => {
    try {
      const progress = await bulkImportService.getProgress();
      res.json(progress);
    } catch (error) {
      console.error('Error getting import progress:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  });

  /**
   * GET /api/admin/bulk-import/users-without-history
   * Get list of users who haven't had their history imported
   */
  router.get('/bulk-import/users-without-history', requireEmployeeAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const users = await bulkImportService.getUsersWithoutHistory(limit);
      
      res.json({
        users,
        count: users.length
      });
    } catch (error) {
      console.error('Error getting users without history:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  });

  /**
   * POST /api/admin/bulk-import/start
   * Start bulk import of all Shopify customers
   * Body params:
   *   - reimportAll: boolean - Force reimport even if already imported
   *   - targetUnprocessedUsers: number - Intelligent mode: find and import X unprocessed users
   *   - maxCustomers: number - Legacy mode: fetch up to X customers total
   *   - fullImport: boolean - Full import mode: create ALL missing customers
   *   - batchSize: number - In full import mode, limit to this many customers (1000, 5000, etc)
   */
  router.post('/bulk-import/start', requireEmployeeAdmin, async (req, res) => {
    try {
      const { reimportAll = false, targetUnprocessedUsers = null, maxCustomers = null, fullImport = false, batchSize = null } = req.body;

      const mode = fullImport 
        ? `full import (batch: ${batchSize || 'unlimited'})` 
        : (targetUnprocessedUsers ? `target ${targetUnprocessedUsers} unprocessed` : (maxCustomers ? `fetch ${maxCustomers} customers` : 'incremental'));
      console.log(`🚀 Admin ${req.user.email} starting bulk import (reimportAll: ${reimportAll}, mode: ${mode})`);

      const result = await bulkImportService.startBulkImport({
        reimportAll,
        targetUnprocessedUsers,
        maxCustomers,
        fullImport,
        batchSize
      });

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error starting bulk import:', error);
      res.status(500).json({ error: 'Failed to start import' });
    }
  });

  /**
   * GET /api/admin/bulk-import/queue/stats
   * Get real-time queue statistics
   */
  router.get('/bulk-import/queue/stats', requireEmployeeAdmin, async (req, res) => {
    try {
      const stats = await bulkImportQueue.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting queue stats:', error);
      res.status(500).json({ error: 'Failed to get queue stats' });
    }
  });

  /**
   * GET /api/admin/bulk-import/queue/recent-jobs
   * Get recent jobs for monitoring
   */
  router.get('/bulk-import/queue/recent-jobs', requireEmployeeAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const jobs = await bulkImportQueue.getRecentJobs(limit);
      
      res.json({ jobs });
    } catch (error) {
      console.error('Error getting recent jobs:', error);
      res.status(500).json({ error: 'Failed to get recent jobs' });
    }
  });

  /**
   * POST /api/admin/bulk-import/queue/clean
   * Clean completed and failed jobs from queue
   */
  router.post('/bulk-import/queue/clean', requireEmployeeAdmin, async (req, res) => {
    try {
      console.log(`🗑️ Admin ${req.user.email} cleaning bulk import queue`);
      
      await bulkImportQueue.clean();
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error cleaning queue:', error);
      res.status(500).json({ error: 'Failed to clean queue' });
    }
  });

  return router;
};
