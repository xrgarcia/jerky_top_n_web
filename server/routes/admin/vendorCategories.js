const express = require('express');
const router = express.Router();
const { db } = require('../../db');
const { productsMetadata } = require('../../../shared/schema');
const { sql } = require('drizzle-orm');

/**
 * GET /api/admin/vendor-categories/with-counts
 * Fetches unique vendors with product counts for each vendor.
 * Useful for displaying how many products are available from each brand.
 */
router.get('/vendor-categories/with-counts', async (req, res) => {
  try {
    // Fetch vendors with product counts from products_metadata
    const vendorCounts = await db
      .select({
        vendor: productsMetadata.vendor,
        productCount: sql<number>`COUNT(DISTINCT ${productsMetadata.shopifyProductId})::int`,
      })
      .from(productsMetadata)
      .where(sql`${productsMetadata.vendor} IS NOT NULL`)
      .groupBy(productsMetadata.vendor)
      .orderBy(sql`COUNT(DISTINCT ${productsMetadata.shopifyProductId}) DESC`);

    const vendors = vendorCounts.map(v => ({
      name: v.vendor,
      productCount: v.productCount,
    }));

    res.json({
      success: true,
      vendors,
      count: vendors.length,
    });
  } catch (error) {
    console.error('Error fetching vendor categories with counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vendor categories with counts',
    });
  }
});

module.exports = router;
