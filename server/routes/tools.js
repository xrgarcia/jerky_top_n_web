const express = require('express');

/**
 * Tools Routes - Admin/Employee tools
 * Protected by employee_admin role
 */
function createToolsRoutes(services) {
  const router = express.Router();
  const { storage, achievementRepo, engagementManager } = services;

  // Middleware to check employee role
  async function checkEmployeeRole(req, res, next) {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.role !== 'employee_admin') {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'You do not have permission to access this resource' 
        });
      }

      req.user = user;
      req.session = session;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  // Get all achievements for management
  router.get('/achievements', checkEmployeeRole, async (req, res) => {
    try {
      const achievements = await achievementRepo.getAllAchievements();
      
      // Add earning stats for each achievement
      const achievementsWithStats = await Promise.all(
        achievements.map(async (achievement) => {
          const earningCount = await achievementRepo.getAchievementEarningCount(achievement.id);
          return {
            ...achievement,
            earningCount: earningCount || 0
          };
        })
      );

      res.json({ achievements: achievementsWithStats });
    } catch (error) {
      console.error('Error fetching achievements for tools:', error);
      res.status(500).json({ error: 'Failed to fetch achievements' });
    }
  });

  // Get live active users (WebSocket connections)
  router.get('/live-users', checkEmployeeRole, async (req, res) => {
    try {
      const { wsGateway } = services;
      
      if (!wsGateway) {
        return res.status(503).json({ error: 'WebSocket service unavailable' });
      }

      const activeUsers = wsGateway.getActiveUsers();
      
      const sanitizedUsers = activeUsers.map(user => ({
        ...user,
        lastName: user.lastName ? user.lastName.charAt(0) + '.' : '',
        email: user.role === 'employee_admin' ? user.email : user.email.split('@')[0] + '@***'
      }));
      
      res.json({ 
        users: sanitizedUsers,
        count: sanitizedUsers.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching live users:', error);
      res.status(500).json({ error: 'Failed to fetch live users' });
    }
  });

  // Get all products for management
  router.get('/products', checkEmployeeRole, async (req, res) => {
    try {
      const { productsService } = services;
      
      if (!productsService) {
        return res.status(503).json({ error: 'Products service unavailable' });
      }

      const products = await productsService.getAllProducts();
      
      res.json({ 
        products: products,
        count: products.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching products for tools:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Clear achievements for a specific user
  router.delete('/achievements/user/:userId', checkEmployeeRole, async (req, res) => {
    try {
      if (!engagementManager) {
        return res.status(503).json({ error: 'Achievement service unavailable' });
      }

      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const deletedCount = await engagementManager.clearUserAchievements(userId);
      
      console.log(`🗑️ Cleared ${deletedCount} achievements for user ${userId} by ${req.user.email}`);
      
      res.json({ 
        success: true,
        deletedCount,
        userId,
        message: `Cleared ${deletedCount} achievement(s) for user ${userId}`
      });
    } catch (error) {
      console.error('Error clearing user achievements:', error);
      res.status(500).json({ error: 'Failed to clear user achievements' });
    }
  });

  // Clear all achievements and streaks for all users
  router.delete('/achievements/all', checkEmployeeRole, async (req, res) => {
    try {
      if (!engagementManager) {
        return res.status(503).json({ error: 'Achievement service unavailable' });
      }

      const result = await engagementManager.clearAllAchievements(req.user.id);
      
      console.log(`🗑️ Cleared ${result.achievements} achievements and ${result.streaks} streaks by ${req.user.email}`);
      
      res.json({ 
        success: true,
        deletedCount: result.total,
        achievements: result.achievements,
        streaks: result.streaks,
        rankings: result.rankings,
        pageViews: result.pageViews,
        searches: result.searches,
        message: `Cleared ${result.achievements} achievement(s) and ${result.streaks} streak(s) for all users`
      });
    } catch (error) {
      console.error('Error clearing all achievements and streaks:', error);
      res.status(500).json({ error: 'Failed to clear all achievements and streaks' });
    }
  });

  // Clear all cache data
  router.post('/cache/clear', checkEmployeeRole, async (req, res) => {
    try {
      const cacheStatus = {};
      
      // Clear NEW distributed cache system (Redis + in-memory fallback)
      const { cacheService } = require('../init-scalability');
      if (cacheService) {
        await cacheService.invalidateHomeStats();
        cacheStatus.distributedCache_homeStats = 'cleared (Redis + in-memory)';
        
        await cacheService.invalidateLeaderboard();
        cacheStatus.distributedCache_leaderboard = 'cleared (Redis + in-memory)';
        
        await cacheService.invalidateLeaderboardPosition();
        cacheStatus.distributedCache_leaderboardPosition = 'cleared (Redis + in-memory)';
        
        await cacheService.invalidateAchievements();
        cacheStatus.distributedCache_achievements = 'cleared (Redis + in-memory)';
        
        await cacheService.invalidateMetadata();
        cacheStatus.distributedCache_metadata = 'cleared (Redis + in-memory)';
        
        await cacheService.invalidateRankingStats();
        cacheStatus.distributedCache_rankingStats = 'cleared (Redis + in-memory)';
        
        await cacheService.invalidateProducts();
        cacheStatus.distributedCache_products = 'cleared (Redis + in-memory)';
      } else {
        cacheStatus.distributedCache = 'unavailable (scalability not initialized)';
      }
      
      // Import OLD singleton cache classes (legacy support)
      const AchievementCache = require('../cache/AchievementCache');
      const HomeStatsCache = require('../cache/HomeStatsCache');
      const LeaderboardCache = require('../cache/LeaderboardCache');
      const LeaderboardPositionCache = require('../cache/LeaderboardPositionCache');
      
      // Clear OLD singleton caches (legacy)
      AchievementCache.getInstance().invalidate();
      cacheStatus.legacy_achievementCache = 'cleared';
      
      HomeStatsCache.getInstance().invalidate();
      cacheStatus.legacy_homeStatsCache = 'cleared';
      
      LeaderboardCache.getInstance().invalidate();
      cacheStatus.legacy_leaderboardCache = 'cleared';
      
      LeaderboardPositionCache.getInstance().invalidateAll();
      cacheStatus.legacy_leaderboardPositionCache = 'cleared';
      
      // Clear ProductsService caches (accessible through services if available)
      if (services.productsService) {
        await services.productsService.rankingStatsCache.invalidate();
        cacheStatus.legacy_rankingStatsCache = 'cleared';
        
        await services.productsService.metadataCache.invalidate();
        cacheStatus.legacy_metadataCache = 'cleared';
      } else {
        cacheStatus.productsServiceCaches = 'unavailable';
      }
      
      console.log(`🗑️ All caches cleared by ${req.user.email}:`, cacheStatus);
      
      res.json({ 
        success: true,
        caches: cacheStatus,
        message: 'All caches cleared successfully (Redis + in-memory + legacy)'
      });
    } catch (error) {
      console.error('Error clearing caches:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to clear caches',
        details: error.message 
      });
    }
  });

  // GET /api/tools/classification-queue/stats - Get queue statistics
  router.get('/classification-queue/stats', checkEmployeeRole, async (req, res) => {
    try {
      const { classificationQueue } = services;
      
      if (!classificationQueue) {
        return res.status(503).json({ error: 'Classification queue unavailable' });
      }

      const stats = await classificationQueue.getStats();
      
      res.json({ 
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching classification queue stats:', error);
      res.status(500).json({ error: 'Failed to fetch queue stats' });
    }
  });

  // POST /api/tools/classification-queue/enqueue/:userId - Manually trigger classification for user
  router.post('/classification-queue/enqueue/:userId', checkEmployeeRole, async (req, res) => {
    try {
      const { classificationQueue } = services;
      const userId = parseInt(req.params.userId);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      if (!classificationQueue) {
        return res.status(503).json({ error: 'Classification queue unavailable' });
      }

      const enqueued = await classificationQueue.enqueue(userId, 'manual_admin');
      
      res.json({ 
        success: true,
        enqueued,
        userId,
        message: enqueued 
          ? 'Classification job enqueued successfully' 
          : 'Classification throttled (user already queued or recently processed)'
      });
    } catch (error) {
      console.error('Error enqueueing classification job:', error);
      res.status(500).json({ error: 'Failed to enqueue classification job' });
    }
  });

  // POST /api/tools/classification-queue/clean - Clean completed and failed jobs
  router.post('/classification-queue/clean', checkEmployeeRole, async (req, res) => {
    try {
      const { classificationQueue } = services;
      
      if (!classificationQueue) {
        return res.status(503).json({ error: 'Classification queue unavailable' });
      }

      await classificationQueue.clean();
      
      res.json({ 
        success: true,
        message: 'Queue cleaned successfully'
      });
    } catch (error) {
      console.error('Error cleaning classification queue:', error);
      res.status(500).json({ error: 'Failed to clean queue' });
    }
  });

  return router;
}

module.exports = createToolsRoutes;
