import React from 'react';
import './AdminPages.css';

function LiveUsersPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>👥 Active Users</h2>
        <div className="live-stats">
          <span className="live-count-badge">0 online</span>
          <span className="live-indicator">🟢 Live</span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Current Page</th>
              <th>Connected</th>
              <th>Last Activity</th>
              <th>Connection ID</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="6" className="empty-state">
                Loading active users...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LiveUsersPage;
