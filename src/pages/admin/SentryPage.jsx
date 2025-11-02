import React from 'react';
import './AdminPages.css';

function SentryPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>🔍 Sentry Error Monitoring</h2>
        <div className="count-badge">Loading...</div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Issue</th>
              <th>Environment</th>
              <th>Count</th>
              <th>Users</th>
              <th>First Seen</th>
              <th>Last Seen</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="9" className="empty-state">
                Loading Sentry issues...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SentryPage;
