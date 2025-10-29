const Sentry = require('@sentry/node');
const { db } = require('../db');
const { customerOrders, users } = require('../../shared/schema');
const { eq, and } = require('drizzle-orm');
const OrdersService = require('./OrdersService');

class WebhookOrderService {
  constructor(webSocketGateway = null) {
    this.db = db;
    this.webSocketGateway = webSocketGateway;
    this.ordersService = new OrdersService();
  }

  async processOrderWebhook(orderData, topic) {
    try {
      console.log(`📦 Processing ${topic} webhook for order ${orderData.name || orderData.id}`);

      if (topic === 'orders/cancelled') {
        return await this.handleOrderCancelled(orderData);
      } else if (topic === 'orders/create' || topic === 'orders/updated') {
        return await this.handleOrderCreateOrUpdate(orderData);
      }

      console.warn(`⚠️ Unknown order webhook topic: ${topic}`);
      return { success: false, reason: 'unknown_topic' };
    } catch (error) {
      console.error('❌ Error processing order webhook:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook-order', topic },
        extra: { orderId: orderData.id, orderName: orderData.name }
      });
      throw error;
    }
  }

  /**
   * Create or update user from Shopify customer data
   * @param {string} shopifyCustomerId - Shopify customer ID
   * @param {string} customerEmail - Customer email
   * @returns {Promise<Object|null>} User object or null if creation failed
   */
  async findOrCreateUser(shopifyCustomerId, customerEmail) {
    try {
      // First try to find existing user by Shopify ID
      if (shopifyCustomerId) {
        const [existingUser] = await this.db
          .select()
          .from(users)
          .where(eq(users.shopifyCustomerId, shopifyCustomerId))
          .limit(1);
        
        if (existingUser) {
          console.log(`✅ Found existing user by Shopify ID: ${existingUser.id} (${existingUser.email})`);
          return existingUser;
        }
      }

      // Try to find by email
      if (customerEmail) {
        const [existingUser] = await this.db
          .select()
          .from(users)
          .where(eq(users.email, customerEmail))
          .limit(1);
        
        if (existingUser) {
          console.log(`✅ Found existing user by email: ${existingUser.id} (${existingUser.email})`);
          
          // Update Shopify customer ID if missing
          if (shopifyCustomerId && !existingUser.shopifyCustomerId) {
            await this.db
              .update(users)
              .set({ shopifyCustomerId })
              .where(eq(users.id, existingUser.id));
            
            console.log(`🔄 Updated user ${existingUser.id} with Shopify customer ID`);
            existingUser.shopifyCustomerId = shopifyCustomerId;
          }
          
          return existingUser;
        }
      }

      // User doesn't exist - fetch from Shopify and create
      if (!shopifyCustomerId) {
        console.warn(`⚠️ Cannot create user without Shopify customer ID`);
        return null;
      }

      console.log(`👤 User not found, fetching from Shopify: ${shopifyCustomerId}`);
      const shopifyCustomer = await this.ordersService.fetchCustomer(shopifyCustomerId);
      
      if (!shopifyCustomer) {
        console.warn(`⚠️ Could not fetch customer ${shopifyCustomerId} from Shopify`);
        return null;
      }

      // Create new user from Shopify data
      const firstName = shopifyCustomer.first_name || 'Customer';
      const lastName = shopifyCustomer.last_name || '';
      const email = shopifyCustomer.email || customerEmail;

      if (!email) {
        console.warn(`⚠️ Cannot create user without email`);
        return null;
      }

      try {
        const [newUser] = await this.db
          .insert(users)
          .values({
            email,
            firstName,
            lastName,
            shopifyCustomerId,
            role: 'customer',
            createdAt: new Date(),
          })
          .returning();

        console.log(`✨ Created new user ${newUser.id} from Shopify: ${email} (${firstName} ${lastName})`);

        return newUser;
      } catch (insertError) {
        // Handle race condition: another request may have created the user
        console.warn(`⚠️ User insert failed (likely race condition), retrying lookup: ${email}`);
        
        // Retry lookup by Shopify ID
        if (shopifyCustomerId) {
          const [existingUser] = await this.db
            .select()
            .from(users)
            .where(eq(users.shopifyCustomerId, shopifyCustomerId))
            .limit(1);
          
          if (existingUser) {
            console.log(`✅ Found user created by concurrent request: ${existingUser.id}`);
            return existingUser;
          }
        }
        
        // Retry lookup by email
        if (email) {
          const [existingUser] = await this.db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          
          if (existingUser) {
            console.log(`✅ Found user created by concurrent request: ${existingUser.id}`);
            return existingUser;
          }
        }
        
        // Still failed - log and return null
        console.error('❌ Failed to create user and retry lookups failed:', insertError);
        Sentry.captureException(insertError, {
          tags: { service: 'webhook-order', action: 'user_insert_failed' },
          extra: { shopifyCustomerId, email, originalError: insertError.message }
        });
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error finding/creating user:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook-order', action: 'find_or_create_user' },
        extra: { shopifyCustomerId, customerEmail }
      });
      return null;
    }
  }

  async handleOrderCancelled(orderData) {
    const orderNumber = orderData.name || orderData.order_number?.toString();
    
    if (!orderNumber) {
      console.warn('⚠️ Cannot process cancelled order: missing order number');
      return { success: false, reason: 'missing_order_number' };
    }

    console.log(`🗑️ Deleting customer_orders records for cancelled order: ${orderNumber}`);

    const deleted = await this.db
      .delete(customerOrders)
      .where(eq(customerOrders.orderNumber, orderNumber))
      .returning();

    console.log(`✅ Deleted ${deleted.length} customer_orders records for order ${orderNumber}`);

    const userId = deleted.length > 0 ? deleted[0].userId : null;
    const affectedProductIds = [...new Set(deleted.map(record => record.shopifyProductId).filter(Boolean))];

    if (this.webSocketGateway && deleted.length > 0) {
      this.webSocketGateway.broadcastCustomerOrdersUpdate({
        action: 'deleted',
        orderNumber,
        recordsCount: deleted.length
      });
    }

    return {
      success: true,
      action: 'deleted',
      orderNumber,
      userId,
      recordsDeleted: deleted.length,
      deletedRecords: deleted,
      affectedProductIds
    };
  }

  async handleOrderCreateOrUpdate(orderData) {
    const orderNumber = orderData.name || orderData.order_number?.toString();
    const orderDate = new Date(orderData.created_at || orderData.processed_at);
    const customerEmail = orderData.customer?.email || orderData.email;
    const shopifyCustomerId = orderData.customer?.id?.toString();

    // Log order processing (minimal)
    console.log(`📦 Processing order ${orderNumber}: ${orderData.line_items?.length || 0} line items`);

    if (!orderNumber || !orderDate) {
      console.warn('⚠️ Cannot process order: missing order number or date');
      return { success: false, reason: 'missing_order_data' };
    }

    if (!customerEmail && !shopifyCustomerId) {
      console.warn('⚠️ Cannot process order: missing customer email and ID');
      return { success: false, reason: 'missing_customer_data' };
    }

    // Find or create user from Shopify data
    const user = await this.findOrCreateUser(shopifyCustomerId, customerEmail);
    
    if (!user) {
      const errorMsg = `Failed to find or create user for order ${orderNumber} (customer: ${customerEmail}, shopifyId: ${shopifyCustomerId})`;
      console.error(`❌ ${errorMsg}`);
      
      // Throw error to trigger webhook retry - don't silently skip orders!
      const error = new Error(errorMsg);
      error.orderNumber = orderNumber;
      error.customerEmail = customerEmail;
      error.shopifyCustomerId = shopifyCustomerId;
      throw error;
    }

    const lineItems = orderData.line_items || [];
    const orderItems = [];
    const currentLineItemKeys = new Set();
    let skippedItems = 0;

    for (const item of lineItems) {
      let productId = item.product_id?.toString();

      if (item.product_id && typeof item.product_id === 'string' && item.product_id.includes('gid://')) {
        productId = item.product_id.split('/').pop();
      }

      if (!productId) {
        skippedItems++;
        // Only log if product_id is actually missing (not just null/undefined)
        console.warn(`⚠️ Skipped line item - missing product_id:`, {
          lineItemId: item.id,
          product_id_type: typeof item.product_id,
          product_id_value: item.product_id,
          sku: item.sku,
          variant_id: item.variant_id
        });
        continue;
      }

      const sku = item.sku || null;
      const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
      
      currentLineItemKeys.add(`${orderNumber}:${productId}:${sku}`);

      orderItems.push({
        orderNumber,
        orderDate,
        shopifyProductId: productId,
        sku,
        quantity,
        userId: user.id,
        customerEmail: customerEmail || user.email,
        lineItemData: {
          id: item.id,
          title: item.title,
          variant_id: item.variant_id,
          variant_title: item.variant_title,
          price: item.price,
          fulfillable_quantity: item.fulfillable_quantity,
        }
      });
    }

    const existingItems = await this.db
      .select()
      .from(customerOrders)
      .where(eq(customerOrders.orderNumber, orderNumber));

    const itemsToDelete = existingItems.filter(existing => {
      const key = `${existing.orderNumber}:${existing.shopifyProductId}:${existing.sku}`;
      return !currentLineItemKeys.has(key);
    });

    if (itemsToDelete.length > 0) {
      for (const item of itemsToDelete) {
        await this.db
          .delete(customerOrders)
          .where(eq(customerOrders.id, item.id));
      }
      console.log(`🗑️ Removed ${itemsToDelete.length} orphaned line items from order ${orderNumber}`);
    }

    // Log summary if items were skipped
    if (skippedItems > 0) {
      console.warn(`⚠️ Order ${orderNumber}: Skipped ${skippedItems}/${lineItems.length} items (missing product_id)`);
    }

    if (orderItems.length === 0) {
      console.warn(`⚠️ No valid items for order ${orderNumber}`);
      
      // Still broadcast if we deleted items (state changed)
      if (this.webSocketGateway && itemsToDelete.length > 0) {
        this.webSocketGateway.broadcastCustomerOrdersUpdate({
          action: 'updated',
          orderNumber,
          itemsCount: 0,
          deletedCount: itemsToDelete.length
        });
      }
      
      return { success: true, action: 'skipped', reason: 'no_line_items', orderNumber, userId: user.id };
    }

    const upserted = [];
    let deletedInLoop = 0;
    
    for (const item of orderItems) {
      const existing = await this.db
        .select()
        .from(customerOrders)
        .where(
          and(
            eq(customerOrders.orderNumber, item.orderNumber),
            eq(customerOrders.shopifyProductId, item.shopifyProductId),
            eq(customerOrders.sku, item.sku)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        if (item.quantity === 0) {
          await this.db
            .delete(customerOrders)
            .where(eq(customerOrders.id, existing[0].id));
          deletedInLoop++;
          console.log(`🗑️ Removed line item with quantity 0: ${item.shopifyProductId}`);
        } else {
          const [updated] = await this.db
            .update(customerOrders)
            .set({
              quantity: item.quantity,
              lineItemData: item.lineItemData,
              updatedAt: new Date(),
            })
            .where(eq(customerOrders.id, existing[0].id))
            .returning();
          upserted.push(updated);
        }
      } else if (item.quantity > 0) {
        const [inserted] = await this.db
          .insert(customerOrders)
          .values(item)
          .returning();
        upserted.push(inserted);
      }
    }

    console.log(`✅ Processed ${upserted.length} line items for order ${orderNumber} (user: ${user.id})`);

    // Broadcast if any state changed (upserts OR deletions in loop OR orphaned deletions)
    const totalDeletions = deletedInLoop + itemsToDelete.length;
    if (this.webSocketGateway && (upserted.length > 0 || totalDeletions > 0)) {
      const action = upserted.length > 0 ? 'upserted' : 'updated';
      this.webSocketGateway.broadcastCustomerOrdersUpdate({
        action,
        orderNumber,
        itemsCount: upserted.length,
        deletedCount: totalDeletions
      });
    }

    return {
      success: true,
      action: 'upserted',
      orderNumber,
      userId: user.id,
      itemsProcessed: upserted.length,
      items: upserted,
      affectedProductIds: [...new Set(upserted.map(item => item.shopifyProductId))] // unique product IDs
    };
  }

  /**
   * Get fresh ranking stats for specific products
   * Used to update cache after order changes
   * @param {Array<string>} productIds - Array of shopify product IDs
   * @returns {Promise<Object>} Map of productId -> stats
   */
  async getProductRankingStats(productIds) {
    if (!productIds || productIds.length === 0) {
      return {};
    }

    try {
      const { sql } = require('drizzle-orm');
      
      const results = await this.db.execute(sql`
        SELECT 
          shopify_product_id,
          COUNT(*) as rank_count,
          COUNT(DISTINCT user_id) as unique_rankers,
          AVG(ranking) as avg_rank,
          MIN(ranking) as best_rank,
          MAX(ranking) as worst_rank,
          MAX(created_at) as last_ranked_at
        FROM product_rankings
        WHERE shopify_product_id IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})
        GROUP BY shopify_product_id
      `);

      const statsMap = {};
      for (const row of results.rows) {
        statsMap[row.shopify_product_id] = {
          count: parseInt(row.rank_count) || 0,
          uniqueRankers: parseInt(row.unique_rankers) || 0,
          avgRank: row.avg_rank ? parseFloat(row.avg_rank) : null,
          bestRank: row.best_rank ? parseInt(row.best_rank) : null,
          worstRank: row.worst_rank ? parseInt(row.worst_rank) : null,
          lastRankedAt: row.last_ranked_at
        };
      }

      console.log(`📊 Recalculated ranking stats for ${Object.keys(statsMap).length} product(s)`);
      return statsMap;
    } catch (error) {
      console.error('❌ Error fetching product ranking stats:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook-order', method: 'getProductRankingStats' }
      });
      return {};
    }
  }
}

module.exports = WebhookOrderService;
