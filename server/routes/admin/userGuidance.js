const express = require('express');

/**
 * Admin routes for user classification and personalized guidance system
 * Provides endpoints for viewing classifications, managing config, and viewing taste communities
 */
function createUserGuidanceAdminRoutes(services) {
  const router = express.Router();
  
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
      const tasteCommunity = req.query.tasteCommunity || '';
      const classified = req.query.classified || '';
      
      const allowedSortFields = ['email', 'display_name', 'created_at', 'ranked_count'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      let whereConditions = [];
      let params = [];
      
      if (search) {
        whereConditions.push(`(u.email ILIKE $${params.length + 1} OR u.display_name ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }
      
      if (journeyStage) {
        whereConditions.push(`uc.journey_stage = $${params.length + 1}`);
        params.push(journeyStage);
      }
      
      if (engagementLevel) {
        whereConditions.push(`uc.engagement_level = $${params.length + 1}`);
        params.push(engagementLevel);
      }
      
      if (tasteCommunity) {
        whereConditions.push(`tc.name = $${params.length + 1}`);
        params.push(tasteCommunity);
      }
      
      if (classified === 'true') {
        whereConditions.push(`uc.user_id IS NOT NULL`);
      } else if (classified === 'false') {
        whereConditions.push(`uc.user_id IS NULL`);
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      let countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN user_classifications uc ON u.id = uc.user_id
        LEFT JOIN taste_communities tc ON uc.taste_community_id = tc.id
        ${whereClause}
      `;
      
      let countParams = [...params];
      let paramIndex = params.length;
      
      // Replace placeholders with actual $1, $2, etc.
      for (let i = 0; i < paramIndex; i++) {
        countQuery = countQuery.replace(`$${i + 1}`, `$${i + 1}`);
      }
      
      const countResult = await db.execute(sql.raw(countQuery, countParams));
      const totalCount = parseInt(countResult.rows[0]?.total) || 0;
      const totalPages = Math.ceil(totalCount / limit);
      
      let dataQuery = `
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
          uc.exploration_breadth,
          uc.taste_community_id,
          tc.name as taste_community_name
        FROM users u
        LEFT JOIN product_rankings pr ON u.id = pr.user_id
        LEFT JOIN user_classifications uc ON u.id = uc.user_id
        LEFT JOIN taste_communities tc ON uc.taste_community_id = tc.id
        ${whereClause}
        GROUP BY u.id, u.email, u.display_name, u.first_name, u.last_name, u.role, u.created_at, 
                 uc.journey_stage, uc.engagement_level, uc.exploration_breadth, uc.taste_community_id, tc.name
        ORDER BY ${sortField} ${sortDirection}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const dataParams = [...params];
      const usersResult = await db.execute(sql.raw(dataQuery, dataParams));
      
      const users = usersResult.rows.map(user => ({
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
          tasteCommunity: user.taste_community_name
        } : null
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
      const { db, userClassificationService, activityTrackingService, tasteCommunityService } = services;
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
      
      // Get taste community details if assigned
      let tasteCommunity = null;
      if (classification && classification.tasteCommunityId) {
        tasteCommunity = await tasteCommunityService.getCommunity(classification.tasteCommunityId);
      }
      
      // Get activity summary (last 30 days)
      const activities = await activityTrackingService.getUserActivitySummary(userId, 30);
      
      // Build classification response with reasoning
      const classificationResponse = classification ? {
        journeyStage: classification.journeyStage,
        engagementLevel: classification.engagementLevel,
        explorationBreadth: classification.explorationBreadth,
        focusAreas: classification.focusAreas,
        tasteCommunity: tasteCommunity ? {
          id: tasteCommunity.id,
          name: tasteCommunity.name,
          description: tasteCommunity.description
        } : null,
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
