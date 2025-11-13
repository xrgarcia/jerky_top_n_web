const Sentry = require('@sentry/node');

/**
 * OrdersService
 * Fetches order data from Shopify Admin API
 */
class OrdersService {
  constructor() {
    this.shopDomain = 'jerky-com.myshopify.com';
    this.apiVersion = '2023-10';
    this.accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  }

  /**
   * Fetch all orders for a specific customer
   * @param {string} shopifyCustomerId - The Shopify customer ID
   * @param {string} customerEmail - The customer's email (fallback lookup)
   * @returns {Promise<Array>} Array of order objects with line items
   */
  async fetchCustomerOrders(shopifyCustomerId, customerEmail) {
    if (!this.accessToken) {
      console.warn('⚠️ Shopify Admin Access Token not configured - skipping order fetch');
      return [];
    }

    try {
      console.log(`📦 Fetching orders for customer ${shopifyCustomerId || customerEmail}`);
      
      const allOrders = [];
      let nextPageUrl = null;
      let pageCount = 0;
      const maxPages = 10; // Safety limit to prevent infinite loops

      // Build initial query URL
      // Use customer_id if available, otherwise use email
      const query = shopifyCustomerId 
        ? `customer_id:${shopifyCustomerId}`
        : `email:${customerEmail}`;
      
      const initialUrl = `https://${this.shopDomain}/admin/api/${this.apiVersion}/orders.json?status=any&limit=250&query=${encodeURIComponent(query)}`;
      
      nextPageUrl = initialUrl;

      // Paginate through all orders
      while (nextPageUrl && pageCount < maxPages) {
        pageCount++;
        
        const response = await fetch(nextPageUrl, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Shopify API error (${response.status}):`, errorText);
          
          Sentry.captureMessage(`Shopify Orders API error: ${response.status}`, {
            level: 'warning',
            tags: { service: 'orders-service', shopify_status: response.status },
            extra: { shopifyCustomerId, customerEmail, errorText }
          });
          
          // Don't throw - return what we have so far
          break;
        }

        const data = await response.json();
        const orders = data.orders || [];
        
        console.log(`📄 Fetched page ${pageCount}: ${orders.length} orders`);
        allOrders.push(...orders);

        // Check for pagination link in headers
        const linkHeader = response.headers.get('Link');
        nextPageUrl = this._parseNextPageUrl(linkHeader);
      }

      console.log(`✅ Fetched total ${allOrders.length} orders for customer ${shopifyCustomerId || customerEmail}`);
      return allOrders;
      
    } catch (error) {
      console.error('❌ Error fetching customer orders:', error);
      Sentry.captureException(error, {
        tags: { service: 'orders-service' },
        extra: { shopifyCustomerId, customerEmail }
      });
      
      // Return empty array on error - graceful degradation
      return [];
    }
  }

  /**
   * Parse Shopify Link header for pagination
   * @param {string} linkHeader - The Link header from response
   * @returns {string|null} Next page URL or null
   */
  _parseNextPageUrl(linkHeader) {
    if (!linkHeader) return null;

    const links = linkHeader.split(',');
    for (const link of links) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Extract line items from orders and format for database
   * @param {Array} orders - Array of Shopify order objects
   * @param {number} userId - User ID from our database
   * @param {string} customerEmail - Customer email
   * @returns {Array} Array of formatted order items ready for DB insert
   */
  extractOrderItems(orders, userId, customerEmail) {
    const orderItems = [];

    for (const order of orders) {
      const orderNumber = order.name || order.order_number?.toString();
      const orderDate = new Date(order.created_at || order.processed_at);

      if (!orderNumber || !orderDate) {
        console.warn('⚠️ Skipping order with missing order number or date:', order.id);
        continue;
      }

      const lineItems = order.line_items || [];
      
      for (const item of lineItems) {
        // Extract product ID (remove 'gid://shopify/Product/' prefix if present)
        let productId = item.product_id ? String(item.product_id) : null;
        
        // Handle GraphQL ID format if present
        if (item.product_id && typeof item.product_id === 'string' && item.product_id.includes('gid://')) {
          productId = item.product_id.split('/').pop();
        }

        if (!productId) {
          console.warn('⚠️ Skipping line item with missing product ID:', item.id);
          continue;
        }

        orderItems.push({
          orderNumber,
          orderDate,
          shopifyProductId: productId,
          sku: item.sku || null,
          quantity: item.quantity || 1,
          userId,
          customerEmail,
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
    }

    console.log(`📊 Extracted ${orderItems.length} line items from ${orders.length} orders`);
    return orderItems;
  }

  /**
   * Fetch customer data from Shopify by customer ID
   * @param {string} shopifyCustomerId - The Shopify customer ID
   * @returns {Promise<Object|null>} Customer data or null if not found
   */
  async fetchCustomer(shopifyCustomerId) {
    if (!this.accessToken) {
      console.warn('⚠️ Shopify Admin Access Token not configured - cannot fetch customer');
      return null;
    }

    try {
      console.log(`👤 Fetching customer ${shopifyCustomerId} from Shopify`);
      
      const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/customers/${shopifyCustomerId}.json`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ Customer ${shopifyCustomerId} not found in Shopify`);
          return null;
        }
        
        const errorText = await response.text();
        console.error(`❌ Shopify Customer API error (${response.status}):`, errorText);
        
        Sentry.captureMessage(`Shopify Customer API error: ${response.status}`, {
          level: 'warning',
          tags: { service: 'orders-service', shopify_status: response.status },
          extra: { shopifyCustomerId, errorText }
        });
        
        return null;
      }

      const data = await response.json();
      const customer = data.customer;
      
      console.log(`✅ Fetched customer ${shopifyCustomerId}: ${customer.email}`);
      return customer;
      
    } catch (error) {
      console.error('❌ Error fetching customer from Shopify:', error);
      Sentry.captureException(error, {
        tags: { service: 'orders-service' },
        extra: { shopifyCustomerId }
      });
      
      return null;
    }
  }

  /**
   * Check if Shopify API is available
   * @returns {boolean} True if configured
   */
  isAvailable() {
    return !!this.accessToken;
  }
}

module.exports = OrdersService;
