import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSuperAdminAccess } from '../../hooks/useAdminAccess';
import './AdminPages.css';

function DataPage() {
  const { data: isSuperAdmin, isLoading, isError, error } = useSuperAdminAccess();

  if (isLoading) {
    return (
      <div className="admin-page">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          Verifying access permissions...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h2>⚠️ Access Verification Failed</h2>
        </div>
        <div style={{ 
          padding: '40px', 
          background: '#fff3cd', 
          border: '2px solid #ffc107', 
          borderRadius: '8px',
          color: '#856404'
        }}>
          <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>
            Unable to verify super admin access.
          </p>
          <p style={{ margin: 0 }}>
            {error?.message || 'Please try refreshing the page or contact support if the issue persists.'}
          </p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/tools" replace />;
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>🔐 Data Management</h2>
        <p className="warning-text">⚠️ Super Admin Only - Destructive operations</p>
      </div>

      <div className="data-management-grid">
        <div className="data-card">
          <div className="data-card-header">
            <span className="data-icon">⏰</span>
            <div>
              <h3>Cache Staleness Configuration</h3>
              <p>Configure cache thresholds for metadata and ranking stats</p>
            </div>
          </div>
          <div className="data-card-content">
            <p>Cache configuration controls coming soon...</p>
          </div>
        </div>

        <div className="data-card">
          <div className="data-card-header">
            <span className="data-icon">🗑️</span>
            <div>
              <h3>Clear All Cache</h3>
              <p>Clears all cached data - rebuilds automatically</p>
            </div>
          </div>
          <div className="data-card-content">
            <button className="btn-warning">🗑️ Clear All Cache</button>
          </div>
        </div>

        <div className="data-card danger">
          <div className="data-card-header">
            <span className="data-icon">⚠️</span>
            <div>
              <h3>Clear All Achievement Data</h3>
              <p><strong>DANGER:</strong> Permanently deletes all user achievement progress</p>
            </div>
          </div>
          <div className="data-card-content">
            <button className="btn-danger">⚠️ Clear All Data</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataPage;
