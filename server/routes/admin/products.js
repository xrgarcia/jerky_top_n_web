const express = require('express');
const { productsMetadata } = require('../../../shared/schema');
const { eq } = require('drizzle-orm');

module.exports = function createProductsAdminRoutes(storage, db) {
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
 * GET /api/admin/products
 * Fetch all products for admin product selector
 */
router.get('/products', requireEmployeeAuth, async (req, res) => {
  try {
    const { limit = 500 } = req.query;
    
    console.log(`📦 Admin products endpoint called, limit: ${limit}`);
    
    // Simple approach: make an internal request to the existing /api/products/all endpoint
    // This reuses all the existing logic without duplication (Node 20+ has native fetch)
    const baseUrl = `http://localhost:5000`;
    
    const response = await fetch(`${baseUrl}/api/products/all`, {
      headers: {
        'Cookie': req.headers.cookie || ''
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }
    
    const data = await response.json();
    const allProducts = data.products || [];
    
    // Limit results
    const limitedProducts = allProducts.slice(0, parseInt(limit));
    
    console.log(`📦 Admin products endpoint: Returning ${limitedProducts.length} products`);
    
    res.json({
      success: true,
      products: limitedProducts,
      total: allProducts.length
    });
  } catch (error) {
    console.error('Error fetching products for admin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

/**
 * PATCH /api/admin/products/:productId/metadata
 * Update product metadata (animal_type, animal_display, animal_icon)
 */
router.patch('/products/:productId/metadata', async (req, res) => {
  try {
    const { productId } = req.params;
    const { animalType, animalDisplay, animalIcon } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required',
      });
    }

    // Build update object (only include fields that are provided)
    const updateData = {};
    if (animalType !== undefined) updateData.animalType = animalType;
    if (animalDisplay !== undefined) updateData.animalDisplay = animalDisplay;
    if (animalIcon !== undefined) updateData.animalIcon = animalIcon;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    // Update the product metadata
    const result = await db
      .update(productsMetadata)
      .set(updateData)
      .where(eq(productsMetadata.shopifyProductId, productId))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    console.log(`✅ Updated product ${productId} metadata:`, updateData);

    res.json({
      success: true,
      product: result[0],
      message: 'Product metadata updated successfully',
    });
  } catch (error) {
    console.error('Error updating product metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product metadata',
    });
  }
});

module.exports = router;
