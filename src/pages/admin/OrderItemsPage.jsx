import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCustomerOrders } from '../../hooks/useCustomerOrders';
import { useCustomerOrdersWebSocket } from '../../hooks/useCustomerOrdersWebSocket';
import { useToast } from '../../context/ToastContext';
import './AdminPages.css';

function OrderItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  
  // Read pagination from URL first to calculate offset
  const initialPage = parseInt(searchParams.get('page') || '1');
  const initialLimit = parseInt(searchParams.get('limit') || '50');
  const initialOffset = (initialPage - 1) * initialLimit;

  // Filter state (synced with URL)
  const [filters, setFilters] = useState({
    orderNumber: searchParams.get('orderNumber') || '',
    customerEmail: searchParams.get('customerEmail') || '',
    productId: searchParams.get('productId') || '',
    sku: searchParams.get('sku') || '',
    fulfillmentStatus: searchParams.get('fulfillmentStatus') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    limit: initialLimit,
    offset: initialOffset,
    sortBy: searchParams.get('sortBy') || 'orderDate',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [filterOptions, setFilterOptions] = useState({ fulfillmentStatuses: [] });

  // Fetch filter options from backend
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await fetch('/api/admin/customer-orders/filters', {
          credentials: 'include'
        });
        const result = await response.json();
        if (result.success) {
          setFilterOptions(result.filters);
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };
    fetchFilterOptions();
  }, []);

  // Fetch orders with current filters
  const { data, isLoading, isError, error, refetch } = useCustomerOrders(filters);

  // Memoize WebSocket callback to prevent resubscription on every render
  const handleOrderUpdate = useCallback((updateData) => {
    console.log('📦 Order update received:', updateData);
    
    // Show toast notification
    const action = updateData.action === 'upserted' ? 'New Order' : 
                   updateData.action === 'updated' ? 'Order Updated' : 
                   'Order Cancelled';
    
    const icon = updateData.action === 'upserted' ? '📦' : 
                 updateData.action === 'updated' ? '🔄' : '❌';
    
    // Format fulfillment statuses for display
    const statusText = updateData.fulfillmentStatuses && updateData.fulfillmentStatuses.length > 0
      ? ` (${updateData.fulfillmentStatuses.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')})`
      : '';
    
    showToast({
      type: updateData.action === 'deleted' ? 'warning' : 'info',
      icon,
      title: action,
      message: `Order ${updateData.orderNumber}: ${updateData.itemsCount || 0} item(s)${statusText}`,
      duration: 4000
    });
    
    // Refetch to get latest data
    refetch();
  }, [showToast, refetch]);

  // WebSocket for live updates
  useCustomerOrdersWebSocket({
    onOrderUpdate: handleOrderUpdate
  });

  // Update URL when filters change (including pagination)
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        params.set(key, value.toString());
      }
    });
    // Also include current page for linkable pagination
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    }
    setSearchParams(params, { replace: true });
  }, [filters, currentPage, setSearchParams]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Reset to first page when filters change
    }));
    setCurrentPage(1);
  };

  const handleApplyFilters = () => {
    setFilters(prev => ({ ...prev, offset: 0 }));
    setCurrentPage(1);
    refetch();
  };

  const handleClearFilters = () => {
    const defaults = {
      orderNumber: '',
      customerEmail: '',
      productId: '',
      sku: '',
      fulfillmentStatus: '',
      dateFrom: '',
      dateTo: '',
      limit: 50,
      offset: 0,
      sortBy: 'orderDate',
      sortOrder: 'desc',
    };
    setFilters(defaults);
    setCurrentPage(1);
  };

  const handleSort = (column) => {
    setFilters(prev => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      offset: 0
    }));
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    const newOffset = (newPage - 1) * filters.limit;
    setFilters(prev => ({ ...prev, offset: newOffset }));
    setCurrentPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setFilters(prev => ({
      ...prev,
      limit: parseInt(newLimit),
      offset: 0
    }));
    setCurrentPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / filters.limit) : 1;

  const getStatusBadgeClass = (status) => {
    switch(status?.toLowerCase()) {
      case 'fulfilled': return 'status-badge fulfilled';
      case 'unfulfilled': return 'status-badge unfulfilled';
      case 'partial': return 'status-badge partial';
      case 'restocked': return 'status-badge restocked';
      default: return 'status-badge';
    }
  };

  const getSortIcon = (column) => {
    if (filters.sortBy !== column) return ' ⇅';
    return filters.sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>📦 Order Items</h2>
        {data && (
          <span className="count-badge">{data.total} orders loaded</span>
        )}
      </div>

      {/* Filters */}
      <div className="filters-card">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Order Number</label>
            <input
              type="text"
              placeholder="Search order number..."
              value={filters.orderNumber}
              onChange={(e) => handleFilterChange('orderNumber', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Customer Email</label>
            <input
              type="text"
              placeholder="Search email..."
              value={filters.customerEmail}
              onChange={(e) => handleFilterChange('customerEmail', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Product ID</label>
            <input
              type="text"
              placeholder="Search product ID..."
              value={filters.productId}
              onChange={(e) => handleFilterChange('productId', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>SKU</label>
            <input
              type="text"
              placeholder="Search SKU..."
              value={filters.sku}
              onChange={(e) => handleFilterChange('sku', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Fulfillment Status</label>
            <select
              value={filters.fulfillmentStatus}
              onChange={(e) => handleFilterChange('fulfillmentStatus', e.target.value)}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              {filterOptions.fulfillmentStatuses?.map(status => (
                <option key={status} value={status}>
                  {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unfulfilled'}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Order Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Order Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-actions">
            <button className="btn-primary" onClick={handleApplyFilters}>
              🔍 Apply Filters
            </button>
            <button className="btn-secondary" onClick={handleClearFilters}>
              ✕ Clear
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="loading-state">
          <p>Loading orders...</p>
        </div>
      ) : isError ? (
        <div className="error-state">
          <p>⚠️ Error loading orders: {error?.message}</p>
          <button className="btn-primary" onClick={() => refetch()}>Retry</button>
        </div>
      ) : data && data.orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders found matching your filters.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="orders-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('orderNumber')} className="sortable">
                    Order Number{getSortIcon('orderNumber')}
                  </th>
                  <th onClick={() => handleSort('customerEmail')} className="sortable">
                    Customer{getSortIcon('customerEmail')}
                  </th>
                  <th onClick={() => handleSort('sku')} className="sortable">
                    SKU{getSortIcon('sku')}
                  </th>
                  <th onClick={() => handleSort('quantity')} className="sortable">
                    Qty{getSortIcon('quantity')}
                  </th>
                  <th onClick={() => handleSort('fulfillmentStatus')} className="sortable">
                    Status{getSortIcon('fulfillmentStatus')}
                  </th>
                  <th onClick={() => handleSort('orderDate')} className="sortable">
                    Order Date & Time{getSortIcon('orderDate')}
                  </th>
                  <th>Line Item Details</th>
                </tr>
              </thead>
              <tbody>
                {data?.orders.map((order, index) => (
                  <tr key={`${order.orderNumber}-${order.sku}-${index}`}>
                    <td className="order-number">{order.orderNumber}</td>
                    <td className="customer-info">
                      <div className="customer-name">
                        {order.userFirstName} {order.userLastName}
                      </div>
                      <div className="customer-email">{order.customerEmail}</div>
                    </td>
                    <td>{order.sku}</td>
                    <td className="qty">{order.quantity}</td>
                    <td>
                      <span className={getStatusBadgeClass(order.fulfillmentStatus)}>
                        {order.fulfillmentStatus || 'Unfulfilled'}
                      </span>
                    </td>
                    <td className="order-date">
                      {new Date(order.orderDate).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </td>
                    <td className="line-item-details">
                      <div className="product-title">{order.productTitle}</div>
                      <div className="product-price">${order.price}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {((currentPage - 1) * filters.limit) + 1} to {Math.min(currentPage * filters.limit, data.total)} of {data.total} orders
            </div>
            
            <div className="pagination-controls">
              <button
                className="btn-secondary"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              
              <span className="page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                className="btn-secondary"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Next →
              </button>
            </div>

            <div className="limit-selector">
              <label>Rows per page:</label>
              <select
                value={filters.limit}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="limit-select"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default OrderItemsPage;
