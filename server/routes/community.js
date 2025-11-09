const express = require('express');
const router = express.Router();

/**
 * Community API Routes
 * Handles user discovery, search, and public profiles
 */

function createCommunityRoutes(services) {
  const { 
    communityService, 
    storage, 
    leaderboardManager,
    achievementRepo,
    db
  } = services;

  /**
   * GET /api/community/users
   * List all users or search by name/flavor
   * Query params: search, page, limit
   */
  router.get('/users', async (req, res) => {
    try {
      const { search = '', page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let users;
      if (search.trim()) {
        users = await communityService.searchCommunityUsers(search, parseInt(limit));
      } else {
        users = await communityService.getCommunityUsers(parseInt(limit), offset);
      }

      // Enrich user data with engagement scores and badges
      const enrichedUsers = await Promise.all(
        users.map(async (user) => {
          // Get engagement score from leaderboard
          const position = await leaderboardManager.getUserPosition(user.id, 'all_time');
          
          // Get earned achievements (badges)
          const achievements = await achievementRepo.getUserAchievements(user.id);
          const badges = achievements.slice(0, 3).map(ach => ({
            icon: ach.icon,
            name: ach.name,
            iconType: ach.iconType
          }));

          return {
            user_id: user.id,
            display_name: user.displayName,
            first_name: user.firstName || null,
            last_name: user.lastName || null,
            unique_products: user.rankedCount || 0,
            engagement_score: position?.engagementScore || 0,
            badges
          };
        })
      );

      res.json({ users: enrichedUsers });
    } catch (error) {
      console.error('Error fetching community users:', error);
      res.status(500).json({ error: 'Failed to fetch community users' });
    }
  });

  /**
   * GET /api/community/users/:userId
   * Get specific user's public profile
   */
  router.get('/users/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Get user basic info
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Format display name
      const displayName = communityService.formatDisplayName({
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName
      });

      // Get user stats
      const position = await leaderboardManager.getUserPosition(userId, 'all_time');
      
      // Get products ranked count
      const { sql } = require('drizzle-orm');
      const productsRankedResult = await db.execute(sql`
        SELECT COUNT(DISTINCT shopify_product_id) as count
        FROM product_rankings
        WHERE user_id = ${userId}
          AND ranking_list_id = 'default'
      `);
      const productsRanked = parseInt(productsRankedResult.rows[0]?.count) || 0;

      // Get earned achievements
      const achievements = await achievementRepo.getUserAchievements(userId);

      // Get user's ALL ranked products with metadata for filtering
      const allRankingsResult = await db.execute(sql`
        SELECT 
          pr.shopify_product_id,
          pr.product_data,
          pr.ranking,
          pr.created_at,
          pm.animal_type,
          pm.primary_flavor,
          pm.vendor
        FROM product_rankings pr
        LEFT JOIN products_metadata pm ON pr.shopify_product_id = pm.shopify_product_id
        WHERE pr.user_id = ${userId}
          AND pr.ranking_list_id = 'default'
        ORDER BY pr.ranking ASC
      `);

      const allProducts = allRankingsResult.rows.map(row => ({
        id: row.shopify_product_id,
        title: row.product_data?.title || 'Unknown Product',
        image: row.product_data?.image,
        rank: row.ranking,
        animalType: row.animal_type,
        primaryFlavor: row.primary_flavor,
        vendor: row.vendor || row.product_data?.vendor
      }));

      // Calculate streak
      const streakResult = await db.execute(sql`
        SELECT current_streak
        FROM streaks
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const currentStreak = streakResult.rows[0]?.current_streak || 0;

      // Get member since date
      const memberSince = user.createdAt;

      res.json({
        user: {
          id: userId,
          displayName,
          memberSince
        },
        stats: {
          productsRanked,
          engagementScore: position?.engagementScore || 0,
          leaderboardPosition: position?.rank || null,
          currentStreak,
          achievementsEarned: achievements.length
        },
        achievements: achievements.map(ach => ({
          id: ach.id,
          name: ach.name,
          icon: ach.icon,
          iconType: ach.iconType,
          description: ach.description,
          earnedAt: ach.earnedAt,
          currentTier: ach.currentTier,
          points: ach.pointsAwarded
        })),
        topProducts: allProducts
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

  return router;
}

module.exports = createCommunityRoutes;
