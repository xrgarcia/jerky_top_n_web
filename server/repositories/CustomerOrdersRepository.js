const { customerOrderItems, users } = require('../../shared/schema');
const { eq, and, gte, lte, like, sql, asc, desc } = require('drizzle-orm');

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
   * @param {string} filters.sortBy - Column to sort by
   * @param {string} filters.sortOrder - Sort direction ('asc' or 'desc')
   * @returns {Promise<Array>} Customer orders with user information
   */
  async getOrders(filters = {}) {
    const {
      orderNumber,
      customerEmail,
      productId,
      sku,
      fulfillmentStatus,
      dateFrom,
      dateTo,
      limit = 100,
      offset = 0,
      sortBy = 'orderDate',
      sortOrder = 'desc'
    } = filters;

    // Build query conditions
    const conditions = [];

    if (orderNumber) {
      conditions.push(like(customerOrderItems.orderNumber, `%${orderNumber}%`));
    }

    if (customerEmail) {
      conditions.push(like(customerOrderItems.customerEmail, `%${customerEmail}%`));
    }

    if (productId) {
      conditions.push(eq(customerOrderItems.shopifyProductId, productId));
    }

    if (sku) {
      conditions.push(like(customerOrderItems.sku, `%${sku}%`));
    }

    if (fulfillmentStatus) {
      conditions.push(eq(customerOrderItems.fulfillmentStatus, fulfillmentStatus));
    }

    if (dateFrom) {
      conditions.push(gte(customerOrderItems.orderDate, new Date(dateFrom)));
    }

    if (dateTo) {
      // Make dateTo inclusive by adding 1 day (end of the selected date)
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(customerOrderItems.orderDate, endDate));
    }

    // Execute query with join to users table
    let query = this.db
      .select({
        id: customerOrderItems.id,
        orderNumber: customerOrderItems.orderNumber,
        orderDate: customerOrderItems.orderDate,
        shopifyProductId: customerOrderItems.shopifyProductId,
        sku: customerOrderItems.sku,
        quantity: customerOrderItems.quantity,
        fulfillmentStatus: customerOrderItems.fulfillmentStatus,
        customerEmail: customerOrderItems.customerEmail,
        lineItemData: customerOrderItems.lineItemData,
        createdAt: customerOrderItems.createdAt,
        updatedAt: customerOrderItems.updatedAt,
        userId: users.id,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(customerOrderItems)
      .leftJoin(users, eq(customerOrderItems.userId, users.id));

    // Apply conditions if any
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    const sortColumn = this.getSortColumn(sortBy);
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? asc : desc;
    
    query = query
      .orderBy(sortDirection(sortColumn))
      .limit(limit)
      .offset(offset);

    const orders = await query;

    return orders;
  }

  /**
   * Get the column to sort by
   * @param {string} sortBy - Column name
   * @returns {Object} Drizzle column reference
   */
  getSortColumn(sortBy) {
    const sortableColumns = {
      'orderNumber': customerOrderItems.orderNumber,
      'orderDate': customerOrderItems.orderDate,
      'customerEmail': customerOrderItems.customerEmail,
      'sku': customerOrderItems.sku,
      'quantity': customerOrderItems.quantity,
      'userFirstName': users.firstName,
      'userLastName': users.lastName
    };

    return sortableColumns[sortBy] || customerOrderItems.orderDate;
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
      fulfillmentStatus,
      dateFrom,
      dateTo
    } = filters;

    const conditions = [];

    if (orderNumber) {
      conditions.push(like(customerOrderItems.orderNumber, `%${orderNumber}%`));
    }

    if (customerEmail) {
      conditions.push(like(customerOrderItems.customerEmail, `%${customerEmail}%`));
    }

    if (productId) {
      conditions.push(eq(customerOrderItems.shopifyProductId, productId));
    }

    if (sku) {
      conditions.push(like(customerOrderItems.sku, `%${sku}%`));
    }

    if (fulfillmentStatus) {
      conditions.push(eq(customerOrderItems.fulfillmentStatus, fulfillmentStatus));
    }

    if (dateFrom) {
      conditions.push(gte(customerOrderItems.orderDate, new Date(dateFrom)));
    }

    if (dateTo) {
      // Make dateTo inclusive by adding 1 day (end of the selected date)
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(customerOrderItems.orderDate, endDate));
    }

    let query = this.db
      .select({ count: sql`count(*)` })
      .from(customerOrderItems);

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
      .selectDistinct({ orderNumber: customerOrderItems.orderNumber })
      .from(customerOrderItems)
      .orderBy(customerOrderItems.orderNumber)
      .limit(1000);

    // Get distinct customer emails
    const emails = await this.db
      .selectDistinct({ email: customerOrderItems.customerEmail })
      .from(customerOrderItems)
      .orderBy(customerOrderItems.customerEmail)
      .limit(1000);

    // Get distinct product IDs
    const productIds = await this.db
      .selectDistinct({ productId: customerOrderItems.shopifyProductId })
      .from(customerOrderItems)
      .orderBy(customerOrderItems.shopifyProductId)
      .limit(1000);

    // Get distinct SKUs
    const skus = await this.db
      .selectDistinct({ sku: customerOrderItems.sku })
      .from(customerOrderItems)
      .where(sql`${customerOrderItems.sku} IS NOT NULL`)
      .orderBy(customerOrderItems.sku)
      .limit(1000);

    // Get distinct fulfillment statuses
    const fulfillmentStatuses = await this.db
      .selectDistinct({ status: customerOrderItems.fulfillmentStatus })
      .from(customerOrderItems)
      .where(sql`${customerOrderItems.fulfillmentStatus} IS NOT NULL`)
      .orderBy(customerOrderItems.fulfillmentStatus);

    return {
      orderNumbers: orderNumbers.map(o => o.orderNumber),
      emails: emails.map(e => e.email),
      productIds: productIds.map(p => p.productId),
      skus: skus.map(s => s.sku),
      fulfillmentStatuses: fulfillmentStatuses.map(f => f.status)
    };
  }
}

module.exports = CustomerOrdersRepository;
