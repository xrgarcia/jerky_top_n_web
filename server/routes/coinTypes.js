const express = require('express');
const { coinTypeConfig } = require('../../shared/schema');
const { eq } = require('drizzle-orm');

/**
 * Coin Type Configuration Routes
 * Public endpoint for fetching coin type configs (used in coin profile pages)
 */
function createCoinTypesRoutes(db) {
  const router = express.Router();

  /**
   * GET /api/coin-types - Get all coin type configurations (public)
   */
  router.get('/coin-types', async (req, res) => {
    try {
      const configs = await db.select().from(coinTypeConfig);
      res.json({ configs });
    } catch (error) {
      console.error('Error fetching coin type configs:', error);
      res.status(500).json({ error: 'Failed to fetch coin type configurations' });
    }
  });

  /**
   * GET /api/coin-types/:type - Get specific coin type configuration (public)
   */
  router.get('/coin-types/:type', async (req, res) => {
    try {
      const { type } = req.params;
      
      const config = await db
        .select()
        .from(coinTypeConfig)
        .where(eq(coinTypeConfig.collectionType, type))
        .limit(1);

      if (config.length === 0) {
        return res.status(404).json({ error: 'Coin type configuration not found' });
      }

      res.json(config[0]);
    } catch (error) {
      console.error('Error fetching coin type config:', error);
      res.status(500).json({ error: 'Failed to fetch coin type configuration' });
    }
  });

  return router;
}

module.exports = createCoinTypesRoutes;
