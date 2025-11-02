import React from 'react';
import './AdminPages.css';

function ProductsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>🥩 Product Management</h2>
        <div className="count-badge">0 products</div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>Vendor</th>
              <th>Animal Type</th>
              <th>Primary Flavor</th>
              <th>Price</th>
              <th>Rankings</th>
              <th>Avg Rank</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="9" className="empty-state">
                Loading products...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProductsPage;
