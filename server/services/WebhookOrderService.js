const Sentry = require('@sentry/node');
const { db } = require('../db');
const { customerOrderItems, users } = require('../../shared/schema');
const { eq, and } = require('drizzle-orm');
const OrdersService = require('./OrdersService');

class WebhookOrderService {
  /**
   * @param {Object} webSocketGateway - WebSocket gateway for real-time updates
   * @param {Object} dedicatedDb - Optional dedicated database connection (prevents pool exhaustion)
   */
  constructor(webSocketGateway = null, dedicatedDb = null) {
    this.db = dedicatedDb || db; // Use dedicated connection if provided, otherwise fall back to shared pool
    this.webSocketGateway = webSocketGateway;
    this.ordersService = new OrdersService();
    
    if (dedicatedDb) {
      console.log('✅ WebhookOrderService using dedicated database pool');
    }
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
      const errorMessage = error.message || 'Unknown error';
      const cause = error.cause?.message || error.cause || '';
      const fullErrorDetails = `${errorMessage}${cause ? ` | Cause: ${cause}` : ''}`;
      
      console.error('❌ Error processing order webhook:', fullErrorDetails);
      console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      Sentry.captureException(error, {
        tags: { service: 'webhook-order', topic },
        extra: { 
          orderId: orderData.id, 
          orderName: orderData.name,
          errorMessage,
          cause: String(cause),
          fullErrorDetails
        }
      });
      throw error;
    }
  }

  /**
   * Create or update user from Shopify customer data
   * Falls back to creating a placeholder user if customer data is missing
   * @param {string} shopifyCustomerId - Shopify customer ID
   * @param {string} customerEmail - Customer email
   * @param {string} orderNumber - Order number (for placeholder email generation)
   * @returns {Promise<Object>} User object (never null - creates placeholder if needed)
   */
  async findOrCreateUser(shopifyCustomerId, customerEmail, orderNumber) {
    try {
      // CRITICAL: Ensure shopifyCustomerId is always a string for Drizzle/Neon binding
      // Neon serverless driver is strict about parameter types and will bind numbers as numbers,
      // causing query failures against TEXT columns. This guards against cached webhook payloads
      // or other sources that may pass numeric IDs.
      if (shopifyCustomerId && typeof shopifyCustomerId !== 'string') {
        shopifyCustomerId = String(shopifyCustomerId);
        console.warn(`⚠️ Converted numeric Shopify customer ID to string: ${shopifyCustomerId}`);
      }
      
      // Log customer data for debugging
      if (!shopifyCustomerId) {
        console.warn(`⚠️ Order ${orderNumber}: Missing Shopify customer ID`, {
          customerEmail: customerEmail || 'none',
          orderNumber
        });
      }
      
      // First try to find existing user by Shopify ID
      if (shopifyCustomerId) {
        const [existingUser] = await this.db
          .select()
          .from(users)
          .where(eq(users.shopifyCustomerId, shopifyCustomerId))
          .limit(1);
        
        if (existingUser) {
          console.log(`✅ Found existing user by Shopify ID: ${existingUser.id} (${existingUser.email})`);
          
          // If this was a placeholder user and we now have real email, update it
          if (customerEmail && existingUser.email.includes('@placeholder.jerky.com') && customerEmail !== existingUser.email) {
            await this.db
              .update(users)
              .set({ 
                email: customerEmail,
                updatedAt: new Date()
              })
              .where(eq(users.id, existingUser.id));
            
            // Also update all customer orders associated with this user to have the real email
            await this.db
              .update(customerOrderItems)
              .set({ 
                customerEmail: customerEmail,
                updatedAt: new Date()
              })
              .where(eq(customerOrderItems.userId, existingUser.id));
            
            console.log(`🔄 Updated placeholder user ${existingUser.id} with real email: ${customerEmail} (and updated all associated orders)`);
            existingUser.email = customerEmail;
          }
          
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

      // User doesn't exist - try to fetch from Shopify and create
      let firstName = 'Guest';
      let lastName = 'Customer';
      let email = null;

      let shopifyCreatedAt = null;
      
      if (shopifyCustomerId) {
        console.log(`👤 User not found, fetching from Shopify: ${shopifyCustomerId}`);
        const shopifyCustomer = await this.ordersService.fetchCustomer(shopifyCustomerId);
        
        if (shopifyCustomer) {
          firstName = shopifyCustomer.first_name || firstName;
          lastName = shopifyCustomer.last_name || lastName;
          email = shopifyCustomer.email || customerEmail;
          shopifyCreatedAt = shopifyCustomer.created_at ? new Date(shopifyCustomer.created_at) : null;
        } else {
          console.warn(`⚠️ Could not fetch customer ${shopifyCustomerId} from Shopify`);
        }
      }

      // Use provided email if available, otherwise create placeholder
      if (!email && customerEmail) {
        email = customerEmail;
      }
      
      if (!email) {
        // Create placeholder email - use Shopify customer ID if available, otherwise order number
        const identifier = shopifyCustomerId || `order-${orderNumber}`;
        email = `guest-${identifier}@placeholder.jerky.com`;
        console.warn(`⚠️ Creating placeholder user with email: ${email}`);
      }

      try {
        const [newUser] = await this.db
          .insert(users)
          .values({
            email,
            firstName,
            lastName,
            shopifyCustomerId: shopifyCustomerId || null,
            role: 'customer',
            shopifyCreatedAt,
            createdAt: new Date(),
          })
          .returning();

        console.log(`✨ Created new user ${newUser.id}: ${email} (${firstName} ${lastName})`);

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
        const [existingUser] = await this.db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        
        if (existingUser) {
          console.log(`✅ Found user created by concurrent request: ${existingUser.id}`);
          return existingUser;
        }
        
        // Still failed - this is a real error, capture and throw
        console.error('❌ Failed to create user and retry lookups failed:', insertError);
        Sentry.captureException(insertError, {
          tags: { service: 'webhook-order', action: 'user_insert_failed' },
          extra: { shopifyCustomerId, email, orderNumber, originalError: insertError.message }
        });
        throw insertError;
      }
      
    } catch (error) {
      console.error('❌ Error finding/creating user:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook-order', action: 'find_or_create_user' },
        extra: { shopifyCustomerId, customerEmail, orderNumber }
      });
      throw error;
    }
  }

  async handleOrderCancelled(orderData) {
    const orderNumber = orderData.name || orderData.order_number?.toString();
    
    if (!orderNumber) {
      console.warn('⚠️ Cannot process cancelled order: missing order number');
      return { success: false, reason: 'missing_order_number' };
    }

    console.log(`🗑️ Deleting customer_orders records for cancelled order: ${orderNumber}`);

    // Step 1: Delete order items
    const deleted = await this.db
      .delete(customerOrderItems)
      .where(eq(customerOrderItems.orderNumber, orderNumber))
      .returning();

    console.log(`✅ Deleted ${deleted.length} customer_orders records for order ${orderNumber}`);

    const userId = deleted.length > 0 ? deleted[0].userId : null;
    const affectedProductIds = [...new Set(deleted.map(record => record.shopifyProductId).filter(Boolean))];

    let rankingDeletionResult = null;
    
    // Step 2: Delete rankings for affected products (cascade deletion)
    if (userId && affectedProductIds.length > 0) {
      try {
        const ProductRankingRepository = require('../repositories/ProductRankingRepository');
        rankingDeletionResult = await ProductRankingRepository.bulkDeleteRankingsForProducts(userId, affectedProductIds);
        
        if (rankingDeletionResult.deletedCount > 0) {
          console.log(`🗑️ Cascade: Deleted ${rankingDeletionResult.deletedCount} rankings for cancelled products`);
        }
      } catch (error) {
        console.error('❌ Failed to delete rankings for cancelled order:', error);
        Sentry.captureException(error, {
          tags: { service: 'webhook-order', action: 'delete_rankings' },
          extra: { userId, affectedProductIds, orderNumber }
        });
      }
    }

    // Step 3: Enqueue coin recalculation (non-blocking)
    if (userId && rankingDeletionResult?.deletedCount > 0) {
      try {
        const coinRecalculationQueue = require('./CoinRecalculationQueue');
        await coinRecalculationQueue.enqueue(
          userId,
          'all', // Recalculate all coin types
          'order_cancelled',
          {
            orderNumber,
            deletedProductIds: affectedProductIds,
            deletedRankingsCount: rankingDeletionResult.deletedCount
          }
        );
        console.log(`🪙 Queued coin recalculation for user ${userId} (${rankingDeletionResult.deletedCount} rankings deleted)`);
      } catch (error) {
        console.error('❌ Failed to enqueue coin recalculation:', error);
        Sentry.captureException(error, {
          tags: { service: 'webhook-order', action: 'enqueue_recalculation' },
          extra: { userId, orderNumber }
        });
      }
    }

    // Step 4: Broadcast WebSocket update
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
      affectedProductIds,
      rankingsDeleted: rankingDeletionResult?.deletedCount || 0,
      coinRecalculationQueued: userId && rankingDeletionResult?.deletedCount > 0
    };
  }

  /**
   * Get the fulfillment status for a line item by checking if it's in a delivered fulfillment
   * @param {Object} lineItem - The line item from Shopify order
   * @param {Array} fulfillments - Array of fulfillments from the order
   * @param {Object} orderData - The full order data
   * @returns {string|null} - The fulfillment status to use
   */
  getFulfillmentStatusForLineItem(lineItem, fulfillments, orderData) {
    // Check if this line item is in any fulfillment
    if (fulfillments && fulfillments.length > 0) {
      for (const fulfillment of fulfillments) {
        // Check if this line item is in this fulfillment
        const lineItemInFulfillment = fulfillment.line_items?.find(
          fi => fi.id === lineItem.id
        );
        
        if (lineItemInFulfillment) {
          // If the fulfillment's shipment status is delivered, use "delivered"
          if (fulfillment.shipment_status === 'delivered') {
            return 'delivered';
          }
        }
      }
    }
    
    // Fall back to line item's fulfillment status or order-level status
    return lineItem.fulfillment_status || orderData.fulfillment_status || null;
  }

  async handleOrderCreateOrUpdate(orderData) {
    const orderNumber = orderData.name || orderData.order_number?.toString();
    const orderDate = new Date(orderData.created_at || orderData.processed_at);
    const customerEmail = orderData.customer?.email || orderData.email;
    const shopifyCustomerId = orderData.customer?.id ? String(orderData.customer.id) : null;

    // Log order processing (minimal)
    console.log(`📦 Processing order ${orderNumber}: ${orderData.line_items?.length || 0} line items`);
    
    // Validate customer data
    if (!shopifyCustomerId && !customerEmail) {
      console.warn(`⚠️ Order ${orderNumber}: No customer ID or email available`, {
        hasCustomerObject: !!orderData.customer,
        customerId: orderData.customer?.id,
        customerEmail: orderData.customer?.email
      });
    }

    if (!orderNumber || !orderDate) {
      console.warn('⚠️ Cannot process order: missing order number or date');
      return { success: false, reason: 'missing_order_data' };
    }

    // Find or create user from Shopify data (creates placeholder if customer data missing)
    const user = await this.findOrCreateUser(shopifyCustomerId, customerEmail, orderNumber);

    const lineItems = orderData.line_items || [];
    const fulfillments = orderData.fulfillments || [];
    const orderItems = [];
    const currentLineItemKeys = new Set();
    let skippedItems = 0;

    for (const item of lineItems) {
      let productId = item.product_id ? String(item.product_id) : null;

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
      
      // Get fulfillment status by checking if line item is in a delivered fulfillment
      const fulfillmentStatus = this.getFulfillmentStatusForLineItem(item, fulfillments, orderData);
      
      currentLineItemKeys.add(`${orderNumber}:${productId}:${sku}`);

      orderItems.push({
        orderNumber,
        orderDate,
        shopifyProductId: productId,
        sku,
        quantity,
        fulfillmentStatus,
        userId: user.id,
        customerEmail: customerEmail || user.email,
        lineItemData: {
          id: item.id,
          title: item.title,
          variant_id: item.variant_id,
          variant_title: item.variant_title,
          price: item.price,
          fulfillable_quantity: item.fulfillable_quantity,
          fulfillment_status: item.fulfillment_status,
        }
      });
    }

    const existingItems = await this.db
      .select()
      .from(customerOrderItems)
      .where(eq(customerOrderItems.orderNumber, orderNumber));

    // Track fulfillment status downgrades (delivered → not delivered)
    const downgradedProducts = [];
    for (const existing of existingItems) {
      if (existing.fulfillmentStatus === 'delivered') {
        // Find matching new item
        const key = `${existing.orderNumber}:${existing.shopifyProductId}:${existing.sku}`;
        const newItem = orderItems.find(item => 
          `${item.orderNumber}:${item.shopifyProductId}:${item.sku}` === key
        );
        
        if (newItem && newItem.fulfillmentStatus !== 'delivered') {
          downgradedProducts.push(existing.shopifyProductId);
          console.log(`⬇️ Fulfillment downgrade detected: ${existing.shopifyProductId} (delivered → ${newItem.fulfillmentStatus || 'null'})`);
        }
      }
    }

    const itemsToDelete = existingItems.filter(existing => {
      const key = `${existing.orderNumber}:${existing.shopifyProductId}:${existing.sku}`;
      return !currentLineItemKeys.has(key);
    });

    if (itemsToDelete.length > 0) {
      for (const item of itemsToDelete) {
        await this.db
          .delete(customerOrderItems)
          .where(eq(customerOrderItems.id, item.id));
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
      if (item.quantity === 0) {
        const deleted = await this.db
          .delete(customerOrderItems)
          .where(
            and(
              eq(customerOrderItems.orderNumber, item.orderNumber),
              eq(customerOrderItems.shopifyProductId, item.shopifyProductId),
              eq(customerOrderItems.sku, item.sku)
            )
          )
          .returning();
        
        if (deleted.length > 0) {
          deletedInLoop++;
          console.log(`🗑️ Removed line item with quantity 0: ${item.shopifyProductId}`);
        }
      } else {
        try {
          const [result] = await this.db
            .insert(customerOrderItems)
            .values({
              ...item,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                customerOrderItems.orderNumber,
                customerOrderItems.shopifyProductId,
                customerOrderItems.sku
              ],
              set: {
                quantity: item.quantity,
                fulfillmentStatus: item.fulfillmentStatus,
                lineItemData: item.lineItemData,
                userId: item.userId,
                customerEmail: item.customerEmail,
                orderDate: item.orderDate,
                updatedAt: new Date(),
              }
            })
            .returning();
          
          upserted.push(result);
        } catch (error) {
          const errorMessage = error.message || 'Unknown error';
          const cause = error.cause?.message || error.cause || '';
          const fullErrorDetails = `${errorMessage}${cause ? ` | Cause: ${cause}` : ''}`;
          
          console.error(`❌ Failed to upsert order item:`, fullErrorDetails);
          console.error('Item data:', JSON.stringify(item, null, 2));
          
          Sentry.captureException(error, {
            tags: { service: 'webhook-order', method: 'handleOrderCreateOrUpdate', operation: 'upsert_item' },
            extra: { 
              item,
              orderNumber,
              errorMessage,
              cause: String(cause),
              fullErrorDetails
            }
          });
          throw error;
        }
      }
    }

    console.log(`✅ Processed ${upserted.length} line items for order ${orderNumber} (user: ${user.id})`);

    // Handle fulfillment status downgrades (delivered → not delivered)
    let rankingDeletionResult = null;
    if (downgradedProducts.length > 0) {
      const uniqueDowngradedProducts = [...new Set(downgradedProducts)];
      
      try {
        const ProductRankingRepository = require('../repositories/ProductRankingRepository');
        rankingDeletionResult = await ProductRankingRepository.bulkDeleteRankingsForProducts(
          user.id,
          uniqueDowngradedProducts
        );
        
        if (rankingDeletionResult.deletedCount > 0) {
          console.log(`🗑️ Cascade: Deleted ${rankingDeletionResult.deletedCount} rankings for downgraded products`);
          
          // Enqueue coin recalculation
          const coinRecalculationQueue = require('./CoinRecalculationQueue');
          await coinRecalculationQueue.enqueue(
            user.id,
            'all',
            'fulfillment_downgrade',
            {
              orderNumber,
              downgradedProductIds: uniqueDowngradedProducts,
              deletedRankingsCount: rankingDeletionResult.deletedCount
            }
          );
          console.log(`🪙 Queued coin recalculation for user ${user.id} (fulfillment downgrade)`);
        }
      } catch (error) {
        console.error('❌ Failed to handle fulfillment downgrade:', error);
        Sentry.captureException(error, {
          tags: { service: 'webhook-order', action: 'handle_downgrade' },
          extra: { userId: user.id, downgradedProducts, orderNumber }
        });
      }
    }

    // Broadcast if any state changed (upserts OR deletions in loop OR orphaned deletions)
    const totalDeletions = deletedInLoop + itemsToDelete.length;
    if (this.webSocketGateway && (upserted.length > 0 || totalDeletions > 0)) {
      const action = upserted.length > 0 ? 'upserted' : 'updated';
      
      // Get unique fulfillment statuses from upserted items
      const fulfillmentStatuses = [...new Set(
        upserted
          .map(item => item.fulfillmentStatus)
          .filter(status => status !== null && status !== undefined)
      )];
      
      this.webSocketGateway.broadcastCustomerOrdersUpdate({
        action,
        orderNumber,
        itemsCount: upserted.length,
        deletedCount: totalDeletions,
        fulfillmentStatuses
      });
    }

    return {
      success: true,
      action: 'upserted',
      orderNumber,
      userId: user.id,
      itemsProcessed: upserted.length,
      items: upserted,
      affectedProductIds: [...new Set(upserted.map(item => item.shopifyProductId))], // unique product IDs
      downgradedProducts: downgradedProducts.length > 0 ? [...new Set(downgradedProducts)] : undefined,
      rankingsDeleted: rankingDeletionResult?.deletedCount || 0
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
      
      // Log warning if we expected stats but got none (indicates potential issue)
      if (productIds.length > 0 && Object.keys(statsMap).length === 0) {
        console.warn(`⚠️ No ranking stats found for ${productIds.length} product(s) - products may not have been ranked yet`);
      }
      
      return statsMap;
    } catch (error) {
      // Extract nested error message from Drizzle wrapper
      const errorMessage = error.message || 'Unknown error';
      const cause = error.cause?.message || error.cause || 'No cause provided';
      const fullErrorDetails = `${errorMessage}${cause !== 'No cause provided' ? ` | Cause: ${cause}` : ''}`;
      
      // CRITICAL ERROR: Database query failed - this is NOT normal
      console.error('❌ CRITICAL: Failed to fetch product ranking stats (database connection issue?)');
      console.error(`   Error: ${fullErrorDetails}`);
      console.error(`   Affected products: ${productIds.join(', ')}`);
      console.error('   Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Check if this is a connection pool exhaustion error
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || 
          errorMessage.includes('pool') || errorMessage.includes('connection')) {
        console.error('   ⚠️ This appears to be a database connection pool exhaustion issue');
      }
      
      Sentry.captureException(error, {
        level: 'error',
        tags: { 
          service: 'webhook-order', 
          method: 'getProductRankingStats',
          error_type: 'database_query_failure'
        },
        extra: { 
          productIds,
          productCount: productIds.length,
          errorMessage,
          errorCode: error.code,
          cause: String(cause),
          fullErrorDetails
        }
      });
      
      // Return empty object but error has been logged with severity
      return {};
    }
  }
}

module.exports = WebhookOrderService;
