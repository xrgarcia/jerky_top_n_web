const express = require('express');
const router = express.Router();

/**
 * Flavor Communities API Routes
 * Handles flavor profile micro-community tracking and state management
 */

function createFlavorCommunitiesRoutes(services) {
  const { flavorCommunityService, db, storage } = services;
  const { users } = require('../../shared/schema');
  const { eq } = require('drizzle-orm');

  /**
   * Middleware: Verify user authentication and authorization
   */
  const requireAuth = async (req, res, next) => {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user.length) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.session = session;
      req.userId = session.userId;
      req.user = user[0];
      next();
    } catch (error) {
      console.error('Error in requireAuth:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Middleware: Verify user can access requested userId (self or admin)
   */
  const requireSelfOrAdmin = async (req, res, next) => {
    const requestedUserId = parseInt(req.params.userId);
    const currentUserId = req.userId;

    if (isNaN(requestedUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Allow if user is requesting their own data
    if (requestedUserId === currentUserId) {
      return next();
    }

    // Check if user is admin
    const hasAccess = req.user.role === 'employee_admin' || (req.user.email && req.user.email.endsWith('@jerky.com'));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };

  /**
   * GET /api/flavor-communities/users/:userId
   * Get user's flavor community states across all flavor profiles
   * Requires: User must be authenticated and accessing their own data or be admin
   */
  router.get('/users/:userId', requireAuth, requireSelfOrAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

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
   * Requires: User must be authenticated and accessing their own data or be admin
   */
  router.post('/users/:userId/refresh', requireAuth, requireSelfOrAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

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
   * Middleware: Require employee_admin role
   */
  const requireAdmin = async (req, res, next) => {
    // User info is already attached by requireAuth middleware
    const hasAccess = req.user.role === 'employee_admin' || (req.user.email && req.user.email.endsWith('@jerky.com'));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  };

  /**
   * GET /api/flavor-communities/summary (Admin only)
   * Get summary of flavor community distribution
   * Query params: flavorProfile (optional)
   */
  router.get('/summary', requireAuth, requireAdmin, async (req, res) => {
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
   * GET /api/flavor-communities/config (Admin only)
   * Get current flavor community configuration
   */
  router.get('/config', requireAuth, requireAdmin, async (req, res) => {
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
  router.post('/config', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { enthusiast_top_pct, explorer_bottom_pct, min_products_for_state, delivered_status } = req.body;

      // Delegate to service (follows OOP principles)
      const updatedConfig = await flavorCommunityService.updateConfig({
        enthusiast_top_pct,
        explorer_bottom_pct,
        min_products_for_state,
        delivered_status
      }, req.user.email);

      res.json({ 
        config: updatedConfig,
        message: 'Configuration updated successfully'
      });
    } catch (error) {
      console.error('Error updating flavor community config:', error);
      
      // Handle validation errors
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  return router;
}

module.exports = createFlavorCommunitiesRoutes;
