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
   * GET /api/admin/bulk-import/shopify-stats
   * Get Shopify customer count vs database user stats
   * Query params:
   * - bypassCache: true/false - Force fresh data from Shopify API
   */
  router.get('/bulk-import/shopify-stats', requireEmployeeAdmin, async (req, res) => {
    try {
      const bypassCache = req.query.bypassCache === 'true';
      const stats = await bulkImportService.getShopifyStats({ bypassCache });
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
   *   - mode: 'full' | 'reprocess' - Import mode (full: create new users only, reprocess: update existing users)
   *   - reimportAll: boolean - Force reimport even if already imported
   *   - targetUnprocessedUsers: number - Intelligent mode: find and import X unprocessed users
   *   - maxCustomers: number - Legacy mode: fetch up to X customers total
   *   - fullImport: boolean - Full import mode: create ALL missing customers (DEPRECATED: use mode='full')
   *   - batchSize: number - Limit to this many customers (1000, 5000, etc)
   */
  router.post('/bulk-import/start', requireEmployeeAdmin, async (req, res) => {
    console.log(`📨 [API] Received bulk import start request from ${req.user?.email || 'unknown'}`);
    console.log(`📦 [API] Request body:`, JSON.stringify(req.body, null, 2));
    
    try {
      const { mode = null, reimportAll = false, targetUnprocessedUsers = null, maxCustomers = null, fullImport = false, batchSize = null } = req.body;

      const modeDesc = mode === 'full' 
        ? `full import (create new users only, batch: ${batchSize || 'unlimited'})`
        : mode === 'reprocess'
        ? `re-processing (update existing users, batch: ${batchSize || 'unlimited'})`
        : (fullImport 
          ? `full import (batch: ${batchSize || 'unlimited'})` 
          : (targetUnprocessedUsers ? `target ${targetUnprocessedUsers} unprocessed` : (maxCustomers ? `fetch ${maxCustomers} customers` : 'incremental')));
      console.log(`🚀 [API] Admin ${req.user.email} starting bulk import (mode: ${modeDesc}, reimportAll: ${reimportAll})`);

      const result = await bulkImportService.startBulkImport({
        mode,
        reimportAll,
        targetUnprocessedUsers,
        maxCustomers,
        fullImport,
        batchSize
      });

      console.log(`✅ [API] Bulk import started successfully:`, { jobsEnqueued: result.jobsEnqueued, usersCreated: result.usersCreated });

      if (result.success) {
        res.json(result);
      } else {
        console.error(`⚠️ [API] Bulk import returned failure:`, result);
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('❌ [API] Error starting bulk import:', error);
      console.error('❌ [API] Stack trace:', error.stack);
      res.status(500).json({ error: 'Failed to start import', details: error.message });
    }
  });

  /**
   * POST /api/admin/bulk-import/resume
   * Resume import by enqueuing all pending users
   * This is used when jobs were not enqueued or the worker stopped
   */
  router.post('/bulk-import/resume', requireEmployeeAdmin, async (req, res) => {
    try {
      console.log(`🔄 Admin ${req.user.email} resuming bulk import for pending users`);

      const result = await bulkImportService.resumeImport();

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error resuming import:', error);
      res.status(500).json({ error: 'Failed to resume import' });
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

  /**
   * POST /api/admin/bulk-import/queue/obliterate
   * Obliterate ALL jobs in the queue (waiting, active, completed, failed)
   * Use this to completely reset the queue
   * NOTE: Returns immediately, processes in background due to large job counts
   */
  router.post('/bulk-import/queue/obliterate', requireEmployeeAdmin, async (req, res) => {
    console.log(`🗑️ [API] Admin ${req.user.email} requested obliteration of ALL jobs`);
    
    // Return immediately to avoid timeout
    res.json({ 
      status: 'started',
      message: 'Started queue obliteration. Monitor progress below.'
    });
    
    // Process in background with progress tracking
    setImmediate(async () => {
      try {
        console.log('📊 [API] Starting background obliteration with progress tracking...');
        
        // Progress callback to broadcast via WebSocket
        const progressCallback = (progress) => {
          if (bulkImportService.wsGateway && bulkImportService.wsGateway.io) {
            const roomName = bulkImportService.wsGateway.room('admin', 'queue-monitor');
            bulkImportService.wsGateway.io.to(roomName).emit('queue:obliterate-progress', progress);
          }
        };
        
        const result = await bulkImportQueue.obliterateWithProgress(progressCallback);
        console.log(`✅ [API] Background obliteration completed:`, result);
        
        // Broadcast completion
        if (bulkImportService.wsGateway && bulkImportService.wsGateway.io) {
          const roomName = bulkImportService.wsGateway.room('admin', 'queue-monitor');
          bulkImportService.wsGateway.io.to(roomName).emit('queue:obliterate-complete', result);
        }
      } catch (error) {
        console.error('❌ [API] Background obliteration failed:', error);
        
        // Broadcast error
        if (bulkImportService.wsGateway && bulkImportService.wsGateway.io) {
          const roomName = bulkImportService.wsGateway.room('admin', 'queue-monitor');
          bulkImportService.wsGateway.io.to(roomName).emit('queue:obliterate-error', { 
            error: error.message 
          });
        }
      }
    });
  });

  /**
   * POST /api/admin/bulk-import/queue/clear-completed
   * Clear only completed jobs from the queue
   */
  router.post('/bulk-import/queue/clear-completed', requireEmployeeAdmin, async (req, res) => {
    try {
      console.log(`🗑️ Admin ${req.user.email} clearing completed jobs from bulk import queue`);
      
      const result = await bulkImportQueue.clearCompleted();
      
      res.json(result);
    } catch (error) {
      console.error('Error clearing completed jobs:', error);
      res.status(500).json({ error: 'Failed to clear completed jobs' });
    }
  });

  /**
   * POST /api/admin/bulk-import/queue/clear-failed
   * Clear only failed jobs from the queue
   */
  router.post('/bulk-import/queue/clear-failed', requireEmployeeAdmin, async (req, res) => {
    try {
      console.log(`🗑️ Admin ${req.user.email} clearing failed jobs from bulk import queue`);
      
      const result = await bulkImportQueue.clearFailed();
      
      res.json(result);
    } catch (error) {
      console.error('Error clearing failed jobs:', error);
      res.status(500).json({ error: 'Failed to clear failed jobs' });
    }
  });

  return router;
};
