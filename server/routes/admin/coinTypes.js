const express = require('express');
const { coinTypeConfig } = require('../../../shared/schema');
const { eq } = require('drizzle-orm');

/**
 * Admin Coin Type Configuration Routes
 * Allows admins to update coin type configurations
 */
function createCoinTypesAdminRoutes(storage, db) {
  const router = express.Router();

  /**
   * Middleware: Require employee authentication
   */
  async function requireEmployeeAuth(req, res, next) {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(403).json({ error: 'Access denied. Employee authentication required.' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(403).json({ error: 'Access denied. Invalid session.' });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(403).json({ error: 'Access denied. User not found.' });
      }

      // Allow access if user has employee_admin role OR email ends with @jerky.com
      const hasAccess = user.role === 'employee_admin' || (user.email && user.email.endsWith('@jerky.com'));
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied. Employee authentication required.' });
      }
      
      req.session = session;
      req.userId = session.userId;
      req.user = user;
      
      next();
    } catch (error) {
      console.error('Error in requireEmployeeAuth:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/admin/coin-types - Get all coin type configurations
   */
  router.get('/coin-types', requireEmployeeAuth, async (req, res) => {
    try {
      const configs = await db.select().from(coinTypeConfig);
      res.json({ configs });
    } catch (error) {
      console.error('Error fetching coin type configs:', error);
      res.status(500).json({ error: 'Failed to fetch coin type configurations' });
    }
  });

  /**
   * PUT /api/admin/coin-types/:type - Update coin type configuration
   */
  router.put('/coin-types/:type', requireEmployeeAuth, async (req, res) => {
    try {
      const { type } = req.params;
      const { displayName, tagline, description, icon, color, howToEarn, metadata } = req.body;

      console.log(`📝 Admin ${req.user.email} updating coin type config: ${type}`);

      // Validate required fields
      if (!displayName || !tagline || !description || !icon || !color || !howToEarn) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['displayName', 'tagline', 'description', 'icon', 'color', 'howToEarn']
        });
      }

      // Check if config exists
      const existing = await db
        .select()
        .from(coinTypeConfig)
        .where(eq(coinTypeConfig.collectionType, type))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Coin type configuration not found' });
      }

      // Update the configuration
      const updated = await db
        .update(coinTypeConfig)
        .set({
          displayName,
          tagline,
          description,
          icon,
          color,
          howToEarn,
          metadata: metadata || null,
          updatedAt: new Date()
        })
        .where(eq(coinTypeConfig.collectionType, type))
        .returning();

      console.log(`✅ Coin type config updated: ${type}`);
      res.json({ 
        success: true, 
        config: updated[0],
        message: `${displayName} configuration updated successfully` 
      });
    } catch (error) {
      console.error('Error updating coin type config:', error);
      res.status(500).json({ error: 'Failed to update coin type configuration' });
    }
  });

  return router;
}

module.exports = createCoinTypesAdminRoutes;
