const { customerOrders, users } = require('../../shared/schema');
const { eq, and, gte, lte, like, sql } = require('drizzle-orm');

class CustomerOrdersRepository {
  constructor(database) {
    this.db = database;
  }

  /**
   * Get customer orders with filters
   * @param {Object} filters - Filter criteria
   * @param {string} filters.orderNumber - Filter by order number
   * @param {string} filters.customerEmail - Filter by customer email
   * @param {string} filters.productId - Filter by Shopify product ID
   * @param {string} filters.sku - Filter by SKU
   * @param {string} filters.dateFrom - Filter by date from (ISO string)
   * @param {string} filters.dateTo - Filter by date to (ISO string)
   * @param {number} filters.limit - Limit results (default 100)
   * @param {number} filters.offset - Offset for pagination
   * @returns {Promise<Array>} Customer orders with user information
   */
  async getOrders(filters = {}) {
    const {
      orderNumber,
      customerEmail,
      productId,
      sku,
      dateFrom,
      dateTo,
      limit = 100,
      offset = 0
    } = filters;

    // Build query conditions
    const conditions = [];

    if (orderNumber) {
      conditions.push(like(customerOrders.orderNumber, `%${orderNumber}%`));
    }

    if (customerEmail) {
      conditions.push(like(customerOrders.customerEmail, `%${customerEmail}%`));
    }

    if (productId) {
      conditions.push(eq(customerOrders.shopifyProductId, productId));
    }

    if (sku) {
      conditions.push(like(customerOrders.sku, `%${sku}%`));
    }

    if (dateFrom) {
      conditions.push(gte(customerOrders.orderDate, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(customerOrders.orderDate, new Date(dateTo)));
    }

    // Execute query with join to users table
    let query = this.db
      .select({
        id: customerOrders.id,
        orderNumber: customerOrders.orderNumber,
        orderDate: customerOrders.orderDate,
        shopifyProductId: customerOrders.shopifyProductId,
        sku: customerOrders.sku,
        quantity: customerOrders.quantity,
        customerEmail: customerOrders.customerEmail,
        lineItemData: customerOrders.lineItemData,
        createdAt: customerOrders.createdAt,
        updatedAt: customerOrders.updatedAt,
        userId: users.id,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(customerOrders)
      .leftJoin(users, eq(customerOrders.userId, users.id));

    // Apply conditions if any
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query
      .orderBy(sql`${customerOrders.orderDate} DESC`)
      .limit(limit)
      .offset(offset);

    const orders = await query;

    return orders;
  }

  /**
   * Get total count of orders matching filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<number>} Total count
   */
  async getOrdersCount(filters = {}) {
    const {
      orderNumber,
      customerEmail,
      productId,
      sku,
      dateFrom,
      dateTo
    } = filters;

    const conditions = [];

    if (orderNumber) {
      conditions.push(like(customerOrders.orderNumber, `%${orderNumber}%`));
    }

    if (customerEmail) {
      conditions.push(like(customerOrders.customerEmail, `%${customerEmail}%`));
    }

    if (productId) {
      conditions.push(eq(customerOrders.shopifyProductId, productId));
    }

    if (sku) {
      conditions.push(like(customerOrders.sku, `%${sku}%`));
    }

    if (dateFrom) {
      conditions.push(gte(customerOrders.orderDate, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(customerOrders.orderDate, new Date(dateTo)));
    }

    let query = this.db
      .select({ count: sql`count(*)` })
      .from(customerOrders);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return parseInt(result[0]?.count || 0);
  }

  /**
   * Get unique values for filters
   * @returns {Promise<Object>} Unique filter values
   */
  async getFilterOptions() {
    // Get distinct order numbers
    const orderNumbers = await this.db
      .selectDistinct({ orderNumber: customerOrders.orderNumber })
      .from(customerOrders)
      .orderBy(customerOrders.orderNumber)
      .limit(1000);

    // Get distinct customer emails
    const emails = await this.db
      .selectDistinct({ email: customerOrders.customerEmail })
      .from(customerOrders)
      .orderBy(customerOrders.customerEmail)
      .limit(1000);

    // Get distinct product IDs
    const productIds = await this.db
      .selectDistinct({ productId: customerOrders.shopifyProductId })
      .from(customerOrders)
      .orderBy(customerOrders.shopifyProductId)
      .limit(1000);

    // Get distinct SKUs
    const skus = await this.db
      .selectDistinct({ sku: customerOrders.sku })
      .from(customerOrders)
      .where(sql`${customerOrders.sku} IS NOT NULL`)
      .orderBy(customerOrders.sku)
      .limit(1000);

    return {
      orderNumbers: orderNumbers.map(o => o.orderNumber),
      emails: emails.map(e => e.email),
      productIds: productIds.map(p => p.productId),
      skus: skus.map(s => s.sku)
    };
  }
}

module.exports = CustomerOrdersRepository;
