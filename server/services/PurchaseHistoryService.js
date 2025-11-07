const OrdersService = require('./OrdersService');
const PurchaseHistoryRepository = require('../repositories/PurchaseHistoryRepository');
const PurchaseHistoryCache = require('../cache/PurchaseHistoryCache');
const Sentry = require('@sentry/node');

/**
 * PurchaseHistoryService
 * Orchestrates fetching, persisting, and caching of customer purchase history
 */
class PurchaseHistoryService {
  constructor() {
    this.ordersService = new OrdersService();
    this.repository = PurchaseHistoryRepository;
    this.cache = new PurchaseHistoryCache(30); // 30-minute TTL
  }

  /**
   * Sync user's purchase history from Shopify
   * Background job triggered on login
   * @param {Object} user - User object with shopifyCustomerId and email
   * @returns {Promise<Object>} Sync result with counts
   */
  async syncUserOrders(user) {
    if (!user || !user.id) {
      console.warn('⚠️ Cannot sync orders: user object missing');
      return { success: false, itemsImported: 0 };
    }

    // Skip sync if Shopify API is not available
    if (!this.ordersService.isAvailable()) {
      console.warn('⚠️ Shopify API not configured - skipping order sync');
      return { success: false, itemsImported: 0, reason: 'shopify_unavailable' };
    }

    // STRATEGIC OPTIMIZATION: Skip if user's full history already imported
    // Webhooks maintain orders going forward, no need to re-sync
    if (user.fullHistoryImported) {
      console.log(`✅ User ${user.id} already has full history imported (${user.historyImportedAt}), skipping sync (webhooks maintain orders)`);
      return { 
        success: true, 
        itemsImported: 0, 
        skipped: true,
        reason: 'already_imported',
        importedAt: user.historyImportedAt
      };
    }

    try {
      console.log(`🔄 Starting FIRST-TIME order sync for user ${user.id} (${user.email})`);
      const startTime = Date.now();

      // OPTIMIZATION: Check if customer has any orders before fetching them all
      // This saves API calls and processing time for zero-order customers
      const customerData = await this.ordersService.fetchCustomer(user.shopifyCustomerId);
      
      if (customerData && customerData.orders_count === 0) {
        console.log(`⚡ Fast-path: User ${user.id} has 0 orders, skipping order fetch`);
        
        // Cache empty result to avoid repeated checks
        this.cache.set(user.id, []);
        
        const duration = Date.now() - startTime;
        return { 
          success: true, 
          itemsImported: 0, 
          ordersProcessed: 0,
          durationMs: duration,
          fastPath: true 
        };
      }

      // 1. Fetch orders from Shopify
      const orders = await this.ordersService.fetchCustomerOrders(
        user.shopifyCustomerId,
        user.email
      );

      if (!orders || orders.length === 0) {
        console.log(`ℹ️ No orders found for user ${user.id}`);
        
        // Cache empty result to avoid repeated API calls
        this.cache.set(user.id, []);
        
        return { success: true, itemsImported: 0, ordersProcessed: 0 };
      }

      // 2. Extract line items from orders
      const orderItems = this.ordersService.extractOrderItems(
        orders,
        user.id,
        user.email
      );

      if (orderItems.length === 0) {
        console.log(`ℹ️ No line items found in orders for user ${user.id}`);
        this.cache.set(user.id, []);
        return { success: true, itemsImported: 0, ordersProcessed: orders.length };
      }

      // 3. Bulk insert/update order items in database
      await this.repository.bulkUpsertOrderItems(orderItems);

      // 4. Invalidate cache to force refresh
      this.cache.invalidate(user.id);

      const duration = Date.now() - startTime;
      console.log(`✅ Order sync completed for user ${user.id}: ${orderItems.length} items from ${orders.length} orders in ${duration}ms`);

      return {
        success: true,
        itemsImported: orderItems.length,
        ordersProcessed: orders.length,
        durationMs: duration
      };

    } catch (error) {
      console.error(`❌ Error syncing orders for user ${user.id}:`, error);
      
      Sentry.captureException(error, {
        tags: { service: 'purchase-history', operation: 'sync' },
        extra: { userId: user.id, email: user.email }
      });

      // Don't throw - graceful degradation
      return { success: false, itemsImported: 0, error: error.message };
    }
  }

  /**
   * Get purchased product IDs for a user (with caching)
   * @param {number} userId - User ID
   * @returns {Promise<Array<string>>} Array of Shopify product IDs
   */
  async getPurchasedProductIds(userId) {
    try {
      // Check cache first
      const cached = this.cache.get(userId);
      if (cached !== null) {
        return cached;
      }

      // Fetch from database
      console.log(`🔍 Fetching purchase history from DB for user ${userId}`);
      const productIds = await this.repository.getPurchasedProductIdsByUser(userId);

      // Cache the result
      this.cache.set(userId, productIds);

      return productIds;
    } catch (error) {
      console.error(`❌ Error getting purchased products for user ${userId}:`, error);
      Sentry.captureException(error, {
        tags: { service: 'purchase-history' },
        extra: { userId }
      });

      // Return empty array on error
      return [];
    }
  }

  /**
   * Invalidate cache for a user (e.g., after manual order sync)
   * @param {number} userId - User ID
   */
  invalidateUserCache(userId) {
    this.cache.invalidate(userId);
  }

  /**
   * Check if user has purchased a specific product
   * @param {number} userId - User ID
   * @param {string} productId - Shopify product ID
   * @returns {Promise<boolean>} True if purchased
   */
  async hasPurchasedProduct(userId, productId) {
    const purchasedIds = await this.getPurchasedProductIds(userId);
    return purchasedIds.includes(productId);
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache stats
   */
  getCacheStats(userId = null) {
    return this.cache.getStats(userId);
  }
}

module.exports = PurchaseHistoryService;
