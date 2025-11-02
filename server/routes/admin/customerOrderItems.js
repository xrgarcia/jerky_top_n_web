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
        fulfillmentStatus,
        dateFrom,
        dateTo,
        limit = 100,
        offset = 0,
        sortBy = 'orderDate',
        sortOrder = 'desc'
      } = req.query;

      const filters = {
        orderNumber,
        customerEmail,
        productId,
        sku,
        fulfillmentStatus,
        dateFrom,
        dateTo,
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy,
        sortOrder
      };

      const [orders, total] = await Promise.all([
        repository.getOrders(filters),
        repository.getOrdersCount(filters)
      ]);

      // Format dates to ISO strings and extract lineItemData fields for frontend
      const formattedOrders = orders.map(order => ({
        ...order,
        orderDate: order.orderDate?.toISOString(),
        createdAt: order.createdAt?.toISOString(),
        updatedAt: order.updatedAt?.toISOString(),
        // Extract commonly used fields from lineItemData JSON
        productTitle: order.lineItemData?.title || null,
        price: order.lineItemData?.price || null,
        variantTitle: order.lineItemData?.variant_title || null,
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
   * NOTE: This must come before /:orderNumber route to avoid conflicts
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

  /**
   * Get order details by order number (all items)
   * GET /api/admin/customer-orders/:orderNumber
   */
  router.get('/customer-orders/:orderNumber', async (req, res) => {
    try {
      const { orderNumber } = req.params;
      
      // Fetch all order items for this order number
      const items = await repository.getOrders({
        orderNumber,
        limit: 1000, // Get all items
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'asc'
      });
      
      if (items.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }
      
      // Format dates to ISO strings for frontend
      const formattedItems = items.map(item => ({
        ...item,
        orderDate: item.orderDate?.toISOString(),
        createdAt: item.createdAt?.toISOString(),
        updatedAt: item.updatedAt?.toISOString(),
      }));
      
      // Extract order-level information from the first item
      const orderInfo = {
        orderNumber: formattedItems[0].orderNumber,
        orderDate: formattedItems[0].orderDate,
        customerEmail: formattedItems[0].customerEmail,
        userFirstName: formattedItems[0].userFirstName,
        userLastName: formattedItems[0].userLastName
      };
      
      res.json({
        success: true,
        order: orderInfo,
        items: formattedItems
      });
      
    } catch (error) {
      console.error('Error fetching order details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order details',
        message: error.message
      });
    }
  });

  return router;
};
