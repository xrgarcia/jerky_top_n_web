const express = require('express');
const router = express.Router();

/**
 * Gamification API Routes
 * Handles achievements, streaks, leaderboards, and activity feeds
 */

function createGamificationRoutes(services) {
  const { 
    achievementManager, 
    streakManager, 
    leaderboardManager, 
    progressTracker,
    activityLogRepo,
    productViewRepo,
    homeStatsService,
    communityService
  } = services;

  router.get('/achievements', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;

      const userStats = await leaderboardManager.getUserStats(userId);
      const position = await leaderboardManager.getUserPosition(userId);
      
      // Get total rankable products count for dynamic achievement
      const { products } = await services.fetchAllShopifyProducts();
      const totalRankableProducts = products.length;
      
      const stats = {
        ...userStats,
        leaderboardPosition: position.rank || 999,
        totalRankings: userStats.totalRankings,
        currentStreak: 0,
        totalRankableProducts,
      };

      const streaks = await streakManager.getUserStreaks(userId);
      const dailyStreak = streaks.find(s => s.streakType === 'daily_rank');
      if (dailyStreak) {
        stats.currentStreak = dailyStreak.currentStreak;
      }

      const achievements = await achievementManager.getAchievementsWithProgress(userId, stats);

      res.json({ achievements, stats });
    } catch (error) {
      console.error('Error fetching achievements:', error);
      res.status(500).json({ error: 'Failed to fetch achievements' });
    }
  });

  router.get('/progress', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;

      // Get total rankable products count for dynamic milestones
      const { products } = await services.fetchAllShopifyProducts();
      const totalRankableProducts = products.length;

      const progress = await progressTracker.getUserProgress(userId, totalRankableProducts);
      const insights = await progressTracker.getUserInsights(userId);

      res.json({ progress, insights });
    } catch (error) {
      console.error('Error fetching progress:', error);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  });

  router.get('/leaderboard', async (req, res) => {
    try {
      const { period = 'all_time', limit = 50 } = req.query;
      const leaderboard = await leaderboardManager.getTopRankers(parseInt(limit), period);

      // Format user display names with CommunityService (last name truncation)
      const formattedLeaderboard = leaderboard.map(entry => ({
        ...entry,
        displayName: communityService.formatDisplayName(entry)
      }));

      res.json({ leaderboard: formattedLeaderboard, period });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  router.get('/leaderboard/position', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      const { period = 'all_time' } = req.query;
      const position = await leaderboardManager.getUserPosition(userId, period);

      res.json(position);
    } catch (error) {
      console.error('Error fetching position:', error);
      res.status(500).json({ error: 'Failed to fetch position' });
    }
  });

  router.get('/activity-feed', async (req, res) => {
    try {
      const { limit = 50, type } = req.query;
      
      let activities;
      if (type) {
        activities = await activityLogRepo.getActivityByType(type, parseInt(limit));
      } else {
        activities = await activityLogRepo.getRecentActivity(parseInt(limit));
      }

      res.json({ activities });
    } catch (error) {
      console.error('Error fetching activity feed:', error);
      res.status(500).json({ error: 'Failed to fetch activity feed' });
    }
  });

  router.get('/streaks', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      const streaks = await streakManager.getUserStreaks(userId);
      res.json({ streaks });
    } catch (error) {
      console.error('Error fetching streaks:', error);
      res.status(500).json({ error: 'Failed to fetch streaks' });
    }
  });

  router.post('/streaks/update', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      const { streakType = 'daily_rank' } = req.body;
      const streakUpdate = await streakManager.updateStreak(userId, streakType);

      if (services.io) {
        services.io.to(`user:${userId}`).emit('streak:updated', streakUpdate);
      }

      res.json({ streak: streakUpdate });
    } catch (error) {
      console.error('Error updating streak:', error);
      res.status(500).json({ error: 'Failed to update streak' });
    }
  });

  router.post('/product-view', async (req, res) => {
    try {
      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
      }

      let userId = null;
      const sessionId = req.cookies.session_id;
      if (sessionId) {
        const session = await services.storage.getSession(sessionId);
        if (session) {
          userId = session.userId;
        }
      }

      await productViewRepo.logView(productId, userId);

      const viewCount = await productViewRepo.getViewCount(productId, 24);

      if (services.io) {
        services.io.emit('product:viewed', {
          productId,
          viewCount,
        });
      }

      res.json({ success: true, viewCount });
    } catch (error) {
      console.error('Error logging product view:', error);
      res.status(500).json({ error: 'Failed to log view' });
    }
  });

  router.get('/trending-products', async (req, res) => {
    try {
      const { limit = 10, hours = 24 } = req.query;
      const trending = await productViewRepo.getTrendingProducts(
        parseInt(limit),
        parseInt(hours)
      );

      res.json({ trending });
    } catch (error) {
      console.error('Error fetching trending products:', error);
      res.status(500).json({ error: 'Failed to fetch trending products' });
    }
  });

  router.get('/user/compare/:userId', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await services.storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = session.userId;
      const targetUserId = parseInt(req.params.userId);
      const comparison = await leaderboardManager.compareUsers(userId, targetUserId);

      res.json(comparison);
    } catch (error) {
      console.error('Error comparing users:', error);
      res.status(500).json({ error: 'Failed to compare users' });
    }
  });

  // Home page statistics
  router.get('/home-stats', async (req, res) => {
    try {
      const stats = await homeStatsService.getAllHomeStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching home stats:', error);
      res.status(500).json({ error: 'Failed to fetch home stats' });
    }
  });

  // Track page view (async, fire-and-forget)
  router.post('/track-view', async (req, res) => {
    try {
      const { pageType, pageIdentifier, referrer } = req.body;

      if (!pageType) {
        return res.status(400).json({ error: 'pageType is required' });
      }

      // Get user ID from session (optional - allow anonymous tracking)
      let userId = null;
      const sessionId = req.cookies.session_id;
      if (sessionId) {
        const session = await services.storage.getSession(sessionId);
        if (session) {
          userId = session.userId;
        }
      }

      // Track asynchronously (fire and forget)
      services.pageViewService.trackPageViewAsync({
        userId,
        pageType,
        pageIdentifier,
        referrer,
      });

      // Respond immediately without waiting
      res.status(202).json({ success: true, message: 'View tracked' });
    } catch (error) {
      console.error('Error tracking page view:', error);
      // Still return success - tracking failures shouldn't block user
      res.status(202).json({ success: true, message: 'View tracking queued' });
    }
  });

  return router;
}

module.exports = createGamificationRoutes;
