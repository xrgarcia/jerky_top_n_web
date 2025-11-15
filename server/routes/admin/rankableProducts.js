const express = require('express');

module.exports = function createRankableProductsAdminRoutes(storage, productsService, purchaseHistoryService) {
  const router = express.Router();

  /**
   * Middleware to require employee authentication
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

      // Get user from database to check role and email
      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(403).json({ error: 'Access denied. User not found.' });
      }

      // Allow access if user has employee_admin role OR email ends with @jerky.com
      const hasAccess = user.role === 'employee_admin' || (user.email && user.email.endsWith('@jerky.com'));
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied. Employee authentication required.' });
      }
      
      // Attach user info to request for use in route handlers
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
   * GET /api/admin/rankable-products/:userId
   * Get rankable products for a specific user (for admin validation/debugging)
   * Returns products with reason metadata (why each product is rankable)
   */
  router.get('/rankable-products/:userId', requireEmployeeAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid userId parameter',
        });
      }

      // Get the user to check their email and role
      const targetUser = await storage.getUserById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Use the SAME method the rank page uses
      const rankableProducts = await productsService.getRankableProductsForUser(userId, {
        user: targetUser, // Pass user object so service can check @jerky.com email
      });

      // Get additional metadata to show WHY each product is rankable
      const isEmployee = targetUser.role === 'employee_admin' || targetUser.email?.endsWith('@jerky.com');
      
      let purchasedProductIds = new Set();
      let metadataMap = {};
      
      if (!isEmployee && purchaseHistoryService) {
        purchasedProductIds = new Set(await purchaseHistoryService.getPurchasedProductIds(userId));
        metadataMap = await productsService._getMetadata();
      }

      // Enrich each product with reason metadata
      const enrichedProducts = rankableProducts.map(product => {
        let reasons = [];
        
        if (isEmployee) {
          reasons.push('admin_email');
        } else {
          const isPurchased = purchasedProductIds.has(product.id);
          const isForceRankable = metadataMap[product.id]?.forceRankable === true;
          
          if (isPurchased) reasons.push('purchased');
          if (isForceRankable) reasons.push('force_rankable');
        }

        return {
          ...product,
          rankableReasons: reasons,
        };
      });

      res.json({
        success: true,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          username: targetUser.username,
          role: targetUser.role,
          isEmployee,
        },
        products: enrichedProducts,
        totalCount: enrichedProducts.length,
      });
    } catch (error) {
      console.error('Error fetching rankable products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch rankable products',
        message: error.message,
      });
    }
  });

  return router;
};
