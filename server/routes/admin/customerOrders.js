const express = require('express');
const CustomerOrdersRepository = require('../../repositories/CustomerOrdersRepository');

module.exports = function createCustomerOrdersRoutes(db) {
  const router = express.Router();
  const repository = new CustomerOrdersRepository(db);

  /**
   * Get customer orders with filtering
   * GET /api/admin/customer-orders
   */
  router.get('/customer-orders', async (req, res) => {
    try {
      const {
        orderNumber,
        customerEmail,
        productId,
        sku,
        dateFrom,
        dateTo,
        limit = 100,
        offset = 0
      } = req.query;

      const filters = {
        orderNumber,
        customerEmail,
        productId,
        sku,
        dateFrom,
        dateTo,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const [orders, total] = await Promise.all([
        repository.getOrders(filters),
        repository.getOrdersCount(filters)
      ]);

      // Format dates to ISO strings for frontend
      const formattedOrders = orders.map(order => ({
        ...order,
        orderDate: order.orderDate?.toISOString(),
        createdAt: order.createdAt?.toISOString(),
        updatedAt: order.updatedAt?.toISOString(),
      }));

      res.json({
        success: true,
        orders: formattedOrders,
        total,
        limit: filters.limit,
        offset: filters.offset
      });

    } catch (error) {
      console.error('Error fetching customer orders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customer orders',
        message: error.message
      });
    }
  });

  /**
   * Get filter options (distinct values for dropdowns)
   * GET /api/admin/customer-orders/filters
   */
  router.get('/customer-orders/filters', async (req, res) => {
    try {
      const filterOptions = await repository.getFilterOptions();

      res.json({
        success: true,
        filters: filterOptions
      });

    } catch (error) {
      console.error('Error fetching filter options:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch filter options',
        message: error.message
      });
    }
  });

  return router;
};
