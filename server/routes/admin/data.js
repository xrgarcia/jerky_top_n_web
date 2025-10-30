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

      
      // Clear all system caches after deletion
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

      // Clear recent achievement tracker to prevent false "recently emitted" blocks
      try {
        const gamificationServices = req.app.get('gamificationServices');
        if (gamificationServices?.recentAchievementTracker) {
          // Call clearAll() method if it exists
          if (typeof gamificationServices.recentAchievementTracker.clearAll === 'function') {
            await gamificationServices.recentAchievementTracker.clearAll();
            console.log('🗑️ Cleared RecentAchievementTracker');
          } else {
            console.log('ℹ️ RecentAchievementTracker does not have clearAll method, skipping');
          }
        }
      } catch (trackerError) {
        console.log('⚠️ Could not clear RecentAchievementTracker:', trackerError.message);
      }

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

  /**
   * GET /api/admin/cache-config
   * Get cache staleness configuration for both caches
   */
  router.get('/cache-config', requireSuperAdmin, async (req, res) => {
    try {
      const { sql } = require('drizzle-orm');
      
      const result = await db.execute(sql`
        SELECT key, value FROM system_config 
        WHERE key IN ('metadata_cache_stale_hours', 'ranking_stats_cache_stale_hours')
      `);
      
      // Build config object with defaults
      const config = {
        metadataCacheStaleHours: 168, // Default 7 days (products rarely change)
        rankingStatsCacheStaleHours: 48  // Default 2 days (stats update with orders)
      };
      
      // Update with database values if present
      for (const row of result.rows) {
        if (row.key === 'metadata_cache_stale_hours') {
          config.metadataCacheStaleHours = parseInt(row.value);
        } else if (row.key === 'ranking_stats_cache_stale_hours') {
          config.rankingStatsCacheStaleHours = parseInt(row.value);
        }
      }
      
      res.json(config);
    } catch (error) {
      console.error('Error getting cache config:', error);
      res.status(500).json({ error: 'Failed to get cache configuration' });
    }
  });

  /**
   * POST /api/admin/cache-config
   * Set cache staleness configuration for both caches
   */
  router.post('/cache-config', requireSuperAdmin, async (req, res) => {
    try {
      const { metadataCacheStaleHours, rankingStatsCacheStaleHours } = req.body;
      
      // Validate both inputs
      if (!metadataCacheStaleHours || metadataCacheStaleHours < 1 || metadataCacheStaleHours > 720) {
        return res.status(400).json({ error: 'Metadata cache stale hours must be between 1 and 720 (30 days)' });
      }
      
      if (!rankingStatsCacheStaleHours || rankingStatsCacheStaleHours < 1 || rankingStatsCacheStaleHours > 720) {
        return res.status(400).json({ error: 'Ranking stats cache stale hours must be between 1 and 720 (30 days)' });
      }
      
      const { sql } = require('drizzle-orm');
      
      // Upsert both configurations
      await db.execute(sql`
        INSERT INTO system_config (key, value, description, updated_at, updated_by)
        VALUES ('metadata_cache_stale_hours', ${metadataCacheStaleHours.toString()}, 'Maximum age in hours before metadata cache triggers Sentry alert', NOW(), ${req.user.email})
        ON CONFLICT (key) 
        DO UPDATE SET value = ${metadataCacheStaleHours.toString()}, updated_at = NOW(), updated_by = ${req.user.email}
      `);
      
      await db.execute(sql`
        INSERT INTO system_config (key, value, description, updated_at, updated_by)
        VALUES ('ranking_stats_cache_stale_hours', ${rankingStatsCacheStaleHours.toString()}, 'Maximum age in hours before ranking stats cache triggers Sentry alert', NOW(), ${req.user.email})
        ON CONFLICT (key) 
        DO UPDATE SET value = ${rankingStatsCacheStaleHours.toString()}, updated_at = NOW(), updated_by = ${req.user.email}
      `);
      
      console.log(`✅ Cache staleness thresholds updated by ${req.user.email}:`);
      console.log(`   - Metadata cache: ${metadataCacheStaleHours} hours`);
      console.log(`   - Ranking stats cache: ${rankingStatsCacheStaleHours} hours`);
      
      res.json({ 
        success: true,
        metadataCacheStaleHours,
        rankingStatsCacheStaleHours,
        message: `Cache staleness thresholds updated successfully`
      });
    } catch (error) {
      console.error('Error saving cache config:', error);
      res.status(500).json({ error: 'Failed to save cache configuration' });
    }
  });

  /**
   * GET /api/admin/environment-config
   * Get sanitized environment configuration (for debugging/verification)
   */
  router.get('/environment-config', requireSuperAdmin, async (req, res) => {
    try {
      // Helper function to mask passwords in URLs
      const maskPassword = (url) => {
        if (!url) return null;
        try {
          const urlObj = new URL(url);
          if (urlObj.password) {
            urlObj.password = '***';
          }
          return urlObj.toString();
        } catch (e) {
          // If URL parsing fails, try basic string replacement for Redis URLs
          if (url.includes('@')) {
            const parts = url.split('@');
            if (parts[0].includes(':')) {
              const authParts = parts[0].split(':');
              authParts[authParts.length - 1] = '***';
              return authParts.join(':') + '@' + parts.slice(1).join('@');
            }
          }
          return url;
        }
      };

      // Helper to extract host:port from URL
      const getHostPort = (url) => {
        if (!url) return null;
        try {
          const urlObj = new URL(url);
          // Use actual port if present, or infer default based on protocol
          let port = urlObj.port;
          if (!port) {
            // Infer default port based on protocol if not explicitly set
            if (urlObj.protocol === 'postgres:' || urlObj.protocol === 'postgresql:') {
              port = '5432';
            } else if (urlObj.protocol === 'redis:' || urlObj.protocol === 'rediss:') {
              port = '6379';
            }
          }
          return port ? `${urlObj.hostname}:${port}` : urlObj.hostname;
        } catch (e) {
          // Fallback for Redis URLs like redis://user:pass@host:port
          if (url.includes('@')) {
            const afterAt = url.split('@')[1];
            return afterAt.split('/')[0]; // Remove database number if present
          }
          return null;
        }
      };

      // Detect environment
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
      const environment = isProduction ? 'production' : 'development';
      
      // Get Redis URL based on environment
      const redisUrl = isProduction 
        ? process.env.UPSTASH_REDIS_URL_PROD 
        : process.env.UPSTASH_REDIS_URL;
      const redisUrlSource = isProduction ? 'UPSTASH_REDIS_URL_PROD' : 'UPSTASH_REDIS_URL';

      const config = {
        environment: {
          nodeEnv: process.env.NODE_ENV || 'undefined',
          replitDeployment: process.env.REPLIT_DEPLOYMENT || 'undefined',
          replitDomains: process.env.REPLIT_DOMAINS || 'undefined',
          detectedEnvironment: environment
        },
        redis: {
          urlSource: redisUrlSource,
          available: !!redisUrl,
          hostPort: getHostPort(redisUrl),
          maskedUrl: maskPassword(redisUrl)
        },
        database: {
          available: !!process.env.DATABASE_URL,
          hostPort: getHostPort(process.env.DATABASE_URL),
          maskedUrl: maskPassword(process.env.DATABASE_URL)
        },
        shopify: {
          shop: process.env.SHOPIFY_SHOP_NAME || 'undefined',
          apiKeySet: !!process.env.SHOPIFY_API_KEY,
          apiSecretSet: !!process.env.SHOPIFY_API_SECRET,
          accessTokenSet: !!process.env.SHOPIFY_ACCESS_TOKEN
        },
        sentry: {
          dsnSet: !!process.env.SENTRY_DSN,
          environment: process.env.SENTRY_ENVIRONMENT || 'undefined'
        }
      };

      res.json(config);
    } catch (error) {
      console.error('Error getting environment config:', error);
      res.status(500).json({ error: 'Failed to get environment configuration' });
    }
  });

  return router;
};
