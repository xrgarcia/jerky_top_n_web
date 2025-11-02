import React from 'react';
import './AdminPages.css';

function OrdersPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>🛒 Order Items</h2>
        <div className="count-badge">Loading...</div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Customer</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Order Date</th>
              <th>Line Item Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="7" className="empty-state">
                Loading orders...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OrdersPage;
