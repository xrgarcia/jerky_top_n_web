import React from 'react';
import './AdminPages.css';

function CoinsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>🏆 Coin Book Admin Dashboard</h2>
        <button className="btn-primary">+ Create Coin</button>
      </div>

      <div className="filter-nav">
        <button className="filter-btn active">All Coins</button>
        <button className="filter-btn">📚 Engagement Coins</button>
        <button className="filter-btn">🏛️ Static Collection Coins</button>
        <button className="filter-btn">🔄 Dynamic Collection Coins</button>
        <button className="filter-btn">🪙 Flavor Coins</button>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Icon</th>
              <th>Name</th>
              <th>Type</th>
              <th>Category</th>
              <th>Description</th>
              <th>Points</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="8" className="empty-state">
                Loading achievements...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CoinsPage;
