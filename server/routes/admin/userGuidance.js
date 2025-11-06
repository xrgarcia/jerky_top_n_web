const express = require('express');

/**
 * Admin routes for user classification and personalized guidance system
 * Provides endpoints for viewing classifications, managing config, and viewing taste communities
 */
function createUserGuidanceAdminRoutes(services) {
  const router = express.Router();
  
  // GET /api/admin/user-classifications/filter-options - Get distinct filter values from database
  router.get('/user-classifications/filter-options', async (req, res) => {
    try {
      const { db } = services;
      const { sql } = require('drizzle-orm');
      
      // Get distinct journey stages
      const journeyStagesResult = await db.execute(sql`
        SELECT DISTINCT journey_stage
        FROM user_classifications
        WHERE journey_stage IS NOT NULL
        ORDER BY journey_stage
      `);
      
      // Get distinct engagement levels
      const engagementLevelsResult = await db.execute(sql`
        SELECT DISTINCT engagement_level
        FROM user_classifications
        WHERE engagement_level IS NOT NULL
        ORDER BY engagement_level
      `);
      
      // Get distinct flavor profile communities
      const flavorProfilesResult = await db.execute(sql`
        SELECT DISTINCT flavor_profile
        FROM user_flavor_profile_communities
        ORDER BY flavor_profile
      `);
      
      res.json({
        journeyStages: journeyStagesResult.rows.map(r => r.journey_stage),
        engagementLevels: engagementLevelsResult.rows.map(r => r.engagement_level),
        flavorProfileCommunities: flavorProfilesResult.rows.map(r => r.flavor_profile)
      });
    } catch (error) {
      console.error('Error fetching filter options:', error);
      res.status(500).json({ error: 'Failed to fetch filter options' });
    }
  });
  
  // GET /api/admin/user-classifications - Get user classifications with pagination, sorting, and filtering
  router.get('/user-classifications', async (req, res) => {
    try {
      const { db, userClassificationService, storage } = services;
      const { sql } = require('drizzle-orm');
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const sortBy = req.query.sortBy || 'created_at';
      const sortOrder = req.query.sortOrder || 'desc';
      const journeyStage = req.query.journeyStage || '';
      const engagementLevel = req.query.engagementLevel || '';
      const flavorProfileCommunity = req.query.flavorProfileCommunity || '';
      const classified = req.query.classified || '';
      
      const allowedSortFields = ['email', 'display_name', 'created_at', 'ranked_count'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      // Build WHERE clause filters using Drizzle's sql template literals for proper parameter binding
      const filters = [];
      
      if (search) {
        const searchPattern = `%${search}%`;
        filters.push(sql`(u.email ILIKE ${searchPattern} OR u.display_name ILIKE ${searchPattern})`);
      }
      
      if (journeyStage) {
        filters.push(sql`uc.journey_stage = ${journeyStage}`);
      }
      
      if (engagementLevel) {
        filters.push(sql`uc.engagement_level = ${engagementLevel}`);
      }
      
      if (flavorProfileCommunity) {
        filters.push(sql`EXISTS (
          SELECT 1 FROM user_flavor_profile_communities ufpc 
          WHERE ufpc.user_id = u.id 
          AND ufpc.flavor_profile = ${flavorProfileCommunity}
        )`);
      }
      
      if (classified === 'true') {
        filters.push(sql`uc.user_id IS NOT NULL`);
      } else if (classified === 'false') {
        filters.push(sql`uc.user_id IS NULL`);
      }
      
      const whereClause = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;
      
      // Build count query with proper parameter binding using sql template
      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN user_classifications uc ON u.id = uc.user_id
        ${whereClause}
      `);
      const totalCount = parseInt(countResult.rows[0]?.total) || 0;
      const totalPages = Math.ceil(totalCount / limit);
      
      // Build data query with proper parameter binding using sql template
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
          MAX(pr.updated_at) as last_ranking_at,
          uc.journey_stage,
          uc.engagement_level,
          uc.exploration_breadth
        FROM users u
        LEFT JOIN product_rankings pr ON u.id = pr.user_id
        LEFT JOIN user_classifications uc ON u.id = uc.user_id
        ${whereClause}
        GROUP BY u.id, u.email, u.display_name, u.first_name, u.last_name, u.role, u.created_at, 
                 uc.journey_stage, uc.engagement_level, uc.exploration_breadth
        ORDER BY ${sql.raw(sortField)} ${sql.raw(sortDirection)}
        LIMIT ${limit} OFFSET ${offset}
      `);
      
      // Get flavor profile communities for each user
      const { flavorProfileCommunityService } = services;
      const users = await Promise.all(usersResult.rows.map(async (user) => {
        const flavorProfileCommunity = await flavorProfileCommunityService.getUserDominantFlavorCommunity(user.id);
        
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
          classification: user.journey_stage ? {
            journeyStage: user.journey_stage,
            engagementLevel: user.engagement_level,
            explorationBreadth: user.exploration_breadth,
            flavorProfileCommunity: flavorProfileCommunity
          } : null
        };
      }));
      
      res.json({ 
        users,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Error fetching user classifications:', error);
      res.status(500).json({ error: 'Failed to fetch user classifications' });
    }
  });
  
  // GET /api/admin/user-classifications/:userId - Get single user classification with reasoning
  router.get('/user-classifications/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { db, userClassificationService, activityTrackingService, flavorProfileCommunityService } = services;
      const { sql } = require('drizzle-orm');
      
      // Get user info with ranking stats
      const userResult = await db.execute(sql`
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
        WHERE u.id = ${userId}
        GROUP BY u.id, u.email, u.display_name, u.first_name, u.last_name, u.role, u.created_at
      `);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      // Get classification from database
      const classification = await userClassificationService.getUserClassification(userId);
      
      // Get flavor profile community details
      const flavorProfileCommunity = await flavorProfileCommunityService.getUserDominantFlavorCommunity(userId);
      
      // Get activity summary (last 30 days)
      const activities = await activityTrackingService.getUserActivitySummary(userId, 30);
      
      // Build classification response with reasoning
      const classificationResponse = classification ? {
        journeyStage: classification.journeyStage,
        engagementLevel: classification.engagementLevel,
        explorationBreadth: classification.explorationBreadth,
        focusAreas: classification.focusAreas,
        flavorProfileCommunity: flavorProfileCommunity,
        reasoning: classification.classificationData || {},
        lastCalculated: classification.lastCalculated
      } : null;
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          createdAt: user.created_at,
          rankedCount: parseInt(user.ranked_count) || 0,
          rankingListsCount: parseInt(user.ranking_lists_count) || 0,
          lastRankingAt: user.last_ranking_at
        },
        classification: classificationResponse,
        activities
      });
    } catch (error) {
      console.error('Error fetching user classification detail:', error);
      res.status(500).json({ error: 'Failed to fetch user classification detail' });
    }
  });
  
  // POST /api/admin/user-classifications/:userId/recalculate - Recalculate classification for a specific user
  router.post('/user-classifications/:userId/recalculate', async (req, res) => {
    try {
      const { userId } = req.params;
      const { userClassificationService, flavorProfileCommunityService, io } = services;
      
      console.log(`🔄 Admin triggering classification recalculation for user ${userId}`);
      
      // Recalculate user classification
      const classification = await userClassificationService.classifyUser(userId);
      
      // Update flavor profile communities
      await flavorProfileCommunityService.updateUserFlavorCommunities(userId);
      
      // Get the updated classification
      const updatedClassification = await userClassificationService.getUserClassification(userId);
      
      // Get dominant flavor profile community
      const flavorProfileCommunity = await flavorProfileCommunityService.getUserDominantFlavorCommunity(userId);
      
      // Build response
      const classificationResponse = updatedClassification ? {
        journeyStage: updatedClassification.journeyStage,
        engagementLevel: updatedClassification.engagementLevel,
        explorationBreadth: updatedClassification.explorationBreadth,
        focusAreas: updatedClassification.focusAreas,
        flavorProfileCommunity: flavorProfileCommunity,
        reasoning: updatedClassification.classificationData || {},
        lastCalculated: updatedClassification.lastCalculated
      } : null;
      
      // Broadcast classification update via WebSocket
      if (io) {
        const socketRoom = `${process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}:user:${userId}`;
        io.to(socketRoom).emit('classification:updated', {
          classification: classificationResponse
        });
        console.log(`📡 Broadcasting classification update to ${socketRoom}`);
      }
      
      console.log(`✅ Classification recalculated for user ${userId}: ${updatedClassification?.journeyStage}, ${updatedClassification?.engagementLevel}`);
      
      res.json({
        success: true,
        classification: classificationResponse
      });
    } catch (error) {
      console.error('Error recalculating user classification:', error);
      res.status(500).json({ error: 'Failed to recalculate classification' });
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
  
  return router;
}

module.exports = createUserGuidanceAdminRoutes;
