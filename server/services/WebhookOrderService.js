const Sentry = require('@sentry/node');
const { db } = require('../db');
const { customerOrders, users } = require('../../shared/schema');
const { eq, and } = require('drizzle-orm');

class WebhookOrderService {
  constructor(webSocketGateway = null) {
    this.db = db;
    this.webSocketGateway = webSocketGateway;
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
      deletedRecords: deleted
    };
  }

  async handleOrderCreateOrUpdate(orderData) {
    const orderNumber = orderData.name || orderData.order_number?.toString();
    const orderDate = new Date(orderData.created_at || orderData.processed_at);
    const customerEmail = orderData.customer?.email || orderData.email;
    const shopifyCustomerId = orderData.customer?.id?.toString();

    if (!orderNumber || !orderDate) {
      console.warn('⚠️ Cannot process order: missing order number or date');
      return { success: false, reason: 'missing_order_data' };
    }

    if (!customerEmail && !shopifyCustomerId) {
      console.warn('⚠️ Cannot process order: missing customer email and ID');
      return { success: false, reason: 'missing_customer_data' };
    }

    let user = null;
    if (shopifyCustomerId) {
      const [foundUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.shopifyCustomerId, shopifyCustomerId))
        .limit(1);
      user = foundUser;
    }

    if (!user && customerEmail) {
      const [foundUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, customerEmail))
        .limit(1);
      user = foundUser;
    }

    if (!user) {
      console.log(`ℹ️ No user found for order ${orderNumber} (customer: ${customerEmail || shopifyCustomerId})`);
      return { success: true, action: 'skipped', reason: 'user_not_found', orderNumber };
    }

    const lineItems = orderData.line_items || [];
    const orderItems = [];
    const currentLineItemKeys = new Set();

    for (const item of lineItems) {
      let productId = item.product_id?.toString();

      if (item.product_id && typeof item.product_id === 'string' && item.product_id.includes('gid://')) {
        productId = item.product_id.split('/').pop();
      }

      if (!productId) {
        console.warn('⚠️ Skipping line item with missing product ID:', item.id);
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

    if (orderItems.length === 0) {
      console.log(`ℹ️ No line items to process for order ${orderNumber}`);
      return { success: true, action: 'skipped', reason: 'no_line_items', orderNumber, userId: user.id };
    }

    const upserted = [];
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

    if (this.webSocketGateway && upserted.length > 0) {
      this.webSocketGateway.broadcastCustomerOrdersUpdate({
        action: 'upserted',
        orderNumber,
        itemsCount: upserted.length
      });
    }

    return {
      success: true,
      action: 'upserted',
      orderNumber,
      userId: user.id,
      itemsProcessed: upserted.length,
      items: upserted
    };
  }
}

module.exports = WebhookOrderService;
