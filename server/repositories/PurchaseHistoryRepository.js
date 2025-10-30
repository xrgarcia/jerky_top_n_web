const { customerOrderItems } = require('../../shared/schema.js');
const { db } = require('../db.js');
const { eq, and, sql } = require('drizzle-orm');
const Sentry = require('@sentry/node');

/**
 * PurchaseHistoryRepository
 * Handles data access for customer purchase history
 * Follows the Repository pattern for database operations
 */
class PurchaseHistoryRepository {
  /**
   * Get all Shopify product IDs that a user has purchased
   * @param {number} userId - The user's ID
   * @returns {Promise<string[]>} Array of Shopify product IDs
   */
  async getPurchasedProductIdsByUser(userId) {
    try {
      const purchasedProducts = await db
        .select({ shopifyProductId: customerOrderItems.shopifyProductId })
        .from(customerOrderItems)
        .where(eq(customerOrderItems.userId, userId));

      // Return unique product IDs (deduplicate in case of multiple orders)
      const uniqueProductIds = [...new Set(purchasedProducts.map(p => p.shopifyProductId))];
      return uniqueProductIds;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'purchase-history-repository' },
        extra: { userId }
      });
      console.error('Error fetching purchased product IDs:', error);
      return []; // Return empty array on error to prevent breaking the UI
    }
  }

  /**
   * Upsert a single order item
   * @param {Object} orderData - Order item data
   * @returns {Promise<Object>} Inserted/updated order item
   */
  async upsertOrderItem(orderData) {
    try {
      const [orderItem] = await db
        .insert(customerOrderItems)
        .values({
          orderNumber: orderData.orderNumber,
          orderDate: orderData.orderDate,
          shopifyProductId: orderData.shopifyProductId,
          sku: orderData.sku || null,
          quantity: orderData.quantity || 1,
          userId: orderData.userId,
          customerEmail: orderData.customerEmail,
          lineItemData: orderData.lineItemData || null,
        })
        .onConflictDoUpdate({
          target: [customerOrderItems.orderNumber, customerOrderItems.shopifyProductId, customerOrderItems.sku],
          set: {
            quantity: sql`EXCLUDED.quantity`,
            orderDate: sql`EXCLUDED.order_date`,
            lineItemData: sql`EXCLUDED.line_item_data`,
            updatedAt: new Date()
          }
        })
        .returning();

      return orderItem;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'purchase-history-repository' },
        extra: { orderData }
      });
      console.error('Error upserting order item:', error);
      throw error;
    }
  }

  /**
   * Bulk upsert order items (for efficient batch processing)
   * @param {Array<Object>} orderItems - Array of order item data
   * @returns {Promise<Array<Object>>} Inserted/updated order items
   */
  async bulkUpsertOrderItems(orderItems) {
    if (!orderItems || orderItems.length === 0) {
      return [];
    }

    try {
      // Deduplicate items by unique constraint (orderNumber, shopifyProductId, sku)
      // Sum quantities for duplicates
      const deduplicatedMap = new Map();
      
      for (const item of orderItems) {
        const key = `${item.orderNumber}:${item.shopifyProductId}:${item.sku || 'null'}`;
        
        if (deduplicatedMap.has(key)) {
          // Duplicate found - sum the quantities
          const existing = deduplicatedMap.get(key);
          existing.quantity += (item.quantity || 1);
        } else {
          // First occurrence - add to map
          deduplicatedMap.set(key, {
            orderNumber: item.orderNumber,
            orderDate: item.orderDate,
            shopifyProductId: item.shopifyProductId,
            sku: item.sku || null,
            quantity: item.quantity || 1,
            userId: item.userId,
            customerEmail: item.customerEmail,
            lineItemData: item.lineItemData || null,
          });
        }
      }
      
      const values = Array.from(deduplicatedMap.values());
      
      if (orderItems.length !== values.length) {
        console.log(`📦 Deduplicated ${orderItems.length} items to ${values.length} unique items`);
      }

      const result = await db
        .insert(customerOrderItems)
        .values(values)
        .onConflictDoUpdate({
          target: [customerOrderItems.orderNumber, customerOrderItems.shopifyProductId, customerOrderItems.sku],
          set: {
            quantity: sql`EXCLUDED.quantity`,
            orderDate: sql`EXCLUDED.order_date`,
            lineItemData: sql`EXCLUDED.line_item_data`,
            updatedAt: new Date()
          }
        })
        .returning();

      console.log(`✅ Bulk upserted ${result.length} order items`);
      return result;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'purchase-history-repository' },
        extra: { itemCount: orderItems.length }
      });
      console.error('Error bulk upserting order items:', error);
      throw error;
    }
  }

  /**
   * Get purchase history for a user with optional date filtering
   * @param {number} userId - The user's ID
   * @param {Date} sinceDate - Optional: only return orders since this date
   * @returns {Promise<Array<Object>>} Array of order items
   */
  async getUserPurchaseHistory(userId, sinceDate = null) {
    try {
      let query = db
        .select()
        .from(customerOrderItems)
        .where(eq(customerOrderItems.userId, userId));

      // Add date filtering if provided
      if (sinceDate) {
        query = query.where(
          and(
            eq(customerOrderItems.userId, userId),
            sql`${customerOrderItems.orderDate} >= ${sinceDate}`
          )
        );
      }

      const purchases = await query.orderBy(sql`${customerOrderItems.orderDate} DESC`);
      return purchases;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'purchase-history-repository' },
        extra: { userId, sinceDate }
      });
      console.error('Error fetching user purchase history:', error);
      return [];
    }
  }
}

module.exports = new PurchaseHistoryRepository();
