const express = require('express');
const router = express.Router();
const { db, storage } = require('../../storage');
const { productsMetadata } = require('../../../shared/schema');
const { eq } = require('drizzle-orm');

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
