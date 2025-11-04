const express = require('express');

/**
 * Admin routes for user classification and personalized guidance system
 * Provides endpoints for viewing classifications, managing config, and viewing taste communities
 */
function createUserGuidanceAdminRoutes(services) {
  const router = express.Router();
  
  // GET /api/admin/user-classifications - Get all user classifications with stats
  router.get('/user-classifications', async (req, res) => {
    try {
      const { db, userClassificationService, storage } = services;
      const { sql } = require('drizzle-orm');
      
      // Get all users with classification data
      const usersResult = await db.execute(sql`
        SELECT 
          u.id,
          u.email,
          u.display_name,
          u.first_name,
          u.last_name,
          u.role,
          u.created_at,
          COUNT(DISTINCT pr.shopify_product_id) as ranked_count,
          COUNT(DISTINCT pr.ranking_list_id) as ranking_lists_count,
          MAX(pr.updated_at) as last_ranking_at
        FROM users u
        LEFT JOIN product_rankings pr ON u.id = pr.user_id
        GROUP BY u.id, u.email, u.display_name, u.first_name, u.last_name, u.role, u.created_at
        ORDER BY u.created_at DESC
        LIMIT 100
      `);
      
      const users = await Promise.all(usersResult.rows.map(async (user) => {
        // Get classification for each user
        const classification = await userClassificationService.getUserClassification(user.id);
        
        return {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          createdAt: user.created_at,
          rankedCount: parseInt(user.ranked_count) || 0,
          rankingListsCount: parseInt(user.ranking_lists_count) || 0,
          lastRankingAt: user.last_ranking_at,
          classification: classification ? {
            journeyStage: classification.journeyStage,
            engagementLevel: classification.engagementLevel,
            explorationBreadth: classification.explorationBreadth,
            tasteCommunity: classification.tasteCommunity
          } : null
        };
      }));
      
      res.json({ users });
    } catch (error) {
      console.error('Error fetching user classifications:', error);
      res.status(500).json({ error: 'Failed to fetch user classifications' });
    }
  });
  
  // GET /api/admin/user-classifications/:userId - Get single user classification with reasoning
  router.get('/user-classifications/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { db, userClassificationService, activityTrackingService, storage } = services;
      const { sql } = require('drizzle-orm');
      
      // Get user info
      const userResult = await db.execute(sql`
        SELECT 
          u.id,
          u.email,
          u.display_name,
          u.first_name,
          u.last_name,
          u.role,
          u.created_at
        FROM users u
        WHERE u.id = ${userId}
      `);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      // Get full classification with reasoning
      const classification = await userClassificationService.getUserClassificationWithReasoning(userId);
      
      // Get activity summary
      const activities = await activityTrackingService.getActivitySummary(userId);
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          createdAt: user.created_at
        },
        classification,
        activities
      });
    } catch (error) {
      console.error('Error fetching user classification detail:', error);
      res.status(500).json({ error: 'Failed to fetch user classification detail' });
    }
  });
  
  // GET /api/admin/classification-config - Get classification configuration
  router.get('/classification-config', async (req, res) => {
    try {
      const { userClassificationService } = services;
      
      const config = await userClassificationService.getConfig();
      
      res.json({ config });
    } catch (error) {
      console.error('Error fetching classification config:', error);
      res.status(500).json({ error: 'Failed to fetch classification config' });
    }
  });
  
  // PUT /api/admin/classification-config - Update classification configuration
  router.put('/classification-config', async (req, res) => {
    try {
      const { userClassificationService } = services;
      const { config } = req.body;
      
      if (!config) {
        return res.status(400).json({ error: 'Configuration data required' });
      }
      
      await userClassificationService.updateConfig(config);
      
      console.log('✅ Classification configuration updated by admin');
      
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating classification config:', error);
      res.status(500).json({ error: 'Failed to update classification config' });
    }
  });
  
  // GET /api/admin/taste-communities - Get all taste communities with member counts
  router.get('/taste-communities', async (req, res) => {
    try {
      const { tasteCommunityService, db } = services;
      const { sql } = require('drizzle-orm');
      
      // Get all communities
      const communities = await tasteCommunityService.getAllCommunities();
      
      // Get member counts for each community
      const communitiesWithCounts = await Promise.all(communities.map(async (community) => {
        const membersResult = await db.execute(sql`
          SELECT COUNT(*) as member_count
          FROM user_classifications
          WHERE taste_community = ${community.id}
        `);
        
        return {
          ...community,
          memberCount: parseInt(membersResult.rows[0]?.member_count) || 0
        };
      }));
      
      res.json({ communities: communitiesWithCounts });
    } catch (error) {
      console.error('Error fetching taste communities:', error);
      res.status(500).json({ error: 'Failed to fetch taste communities' });
    }
  });
  
  return router;
}

module.exports = createUserGuidanceAdminRoutes;
