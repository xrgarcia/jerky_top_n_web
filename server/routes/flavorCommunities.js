const express = require('express');
const router = express.Router();

/**
 * Flavor Communities API Routes
 * Handles flavor profile micro-community tracking and state management
 */

function createFlavorCommunitiesRoutes(services) {
  const { flavorCommunityService } = services;

  /**
   * GET /api/flavor-communities/users/:userId
   * Get user's flavor community states across all flavor profiles
   */
  router.get('/users/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const communities = await flavorCommunityService.getUserFlavorCommunities(userId);
      
      res.json({ 
        userId,
        flavorCommunities: communities 
      });
    } catch (error) {
      console.error('Error fetching user flavor communities:', error);
      res.status(500).json({ error: 'Failed to fetch flavor communities' });
    }
  });

  /**
   * POST /api/flavor-communities/users/:userId/refresh
   * Recalculate user's flavor communities
   */
  router.post('/users/:userId/refresh', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const communities = await flavorCommunityService.updateUserFlavorCommunities(userId);
      
      res.json({ 
        userId,
        flavorCommunities: communities,
        message: 'Flavor communities updated successfully'
      });
    } catch (error) {
      console.error('Error updating user flavor communities:', error);
      res.status(500).json({ error: 'Failed to update flavor communities' });
    }
  });

  /**
   * GET /api/flavor-communities/summary
   * Get summary of flavor community distribution
   * Query params: flavorProfile (optional)
   */
  router.get('/summary', async (req, res) => {
    try {
      const { flavorProfile } = req.query;
      
      const summary = await flavorCommunityService.getFlavorCommunitySummary(flavorProfile || null);
      
      res.json({ summary });
    } catch (error) {
      console.error('Error fetching flavor community summary:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  });

  /**
   * GET /api/flavor-communities/config
   * Get current flavor community configuration
   */
  router.get('/config', async (req, res) => {
    try {
      const config = await flavorCommunityService.getConfig();
      
      res.json({ config });
    } catch (error) {
      console.error('Error fetching flavor community config:', error);
      res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  });

  /**
   * POST /api/flavor-communities/config (Admin only)
   * Update flavor community configuration
   */
  router.post('/config', async (req, res) => {
    try {
      // Check if user is admin (employee_admin role)
      if (!req.session?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { db } = services;
      const { users, classificationConfig } = require('../../shared/schema');
      const { eq } = require('drizzle-orm');

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user.length || user[0].role !== 'employee_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { enthusiast_top_pct, explorer_bottom_pct, min_products_for_state, delivered_status } = req.body;

      // Validate input
      if (enthusiast_top_pct < 1 || enthusiast_top_pct > 100) {
        return res.status(400).json({ error: 'enthusiast_top_pct must be between 1 and 100' });
      }
      if (explorer_bottom_pct < 1 || explorer_bottom_pct > 100) {
        return res.status(400).json({ error: 'explorer_bottom_pct must be between 1 and 100' });
      }
      if (min_products_for_state < 0) {
        return res.status(400).json({ error: 'min_products_for_state must be >= 0' });
      }

      const newConfig = {
        enthusiast_top_pct: parseInt(enthusiast_top_pct),
        explorer_bottom_pct: parseInt(explorer_bottom_pct),
        min_products_for_state: parseInt(min_products_for_state),
        delivered_status: delivered_status || 'delivered'
      };

      // Update config in database
      await db
        .update(classificationConfig)
        .set({
          configValue: newConfig,
          updatedAt: new Date(),
          updatedBy: user[0].email
        })
        .where(eq(classificationConfig.configKey, 'flavor_community_thresholds'));

      // Invalidate cache
      flavorCommunityService.invalidateConfigCache();

      res.json({ 
        config: newConfig,
        message: 'Configuration updated successfully'
      });
    } catch (error) {
      console.error('Error updating flavor community config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  return router;
}

module.exports = createFlavorCommunitiesRoutes;
