import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSuperAdminAccess } from '../../hooks/useAdminAccess';
import { useEnvironmentConfig } from '../../hooks/useAdminTools';
import './AdminPages.css';

function DataPage() {
  const { data: isSuperAdmin, isLoading: loadingAccess, isError, error } = useSuperAdminAccess();
  const { data: config, isLoading: loadingConfig, isError: configError, error: configErrorDetails } = useEnvironmentConfig();

  if (loadingAccess) {
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
        <h2>🔧 Manage Data</h2>
        <p className="warning-text">⚠️ Super Admin Only - Environment configuration and system management</p>
      </div>

      {/* Environment Configuration Section */}
      {loadingConfig ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          Loading environment configuration...
        </div>
      ) : configError ? (
        <div style={{ 
          padding: '40px', 
          background: '#fff3cd', 
          border: '2px solid #ffc107', 
          borderRadius: '12px',
          color: '#856404',
          marginBottom: '40px'
        }}>
          <p style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '16px' }}>
            ⚠️ Failed to load environment configuration
          </p>
          <p style={{ margin: 0, fontSize: '14px' }}>
            {configErrorDetails?.message || 'Unable to fetch environment data. Please try refreshing the page.'}
          </p>
        </div>
      ) : config && (
        <div className="env-config-container" style={{ marginBottom: '40px' }}>
          {/* Environment Detection Section */}
          <div className="config-section">
            <div className="section-header">
              <span className="section-icon">🌍</span>
              <h2>Environment Detection</h2>
            </div>
            <div className="config-grid">
              <div className="config-row">
                <span className="config-label">Detected Environment</span>
                <span className={`env-badge ${config.environment?.detectedEnvironment || 'development'}`}>
                  {(config.environment?.detectedEnvironment || 'unknown').toUpperCase()}
                </span>
              </div>
              <div className="config-row">
                <span className="config-label">NODE_ENV</span>
                <span className="config-value">{config.environment?.nodeEnv || 'undefined'}</span>
              </div>
              <div className="config-row">
                <span className="config-label">REPLIT_DEPLOYMENT</span>
                <span className="config-value">{config.environment?.replitDeployment || 'undefined'}</span>
              </div>
              <div className="config-row">
                <span className="config-label">Domain</span>
                <span className="config-value domain-value">{config.environment?.replitDomains || 'undefined'}</span>
              </div>
            </div>
          </div>

          {/* Redis Cache Configuration Section */}
          <div className="config-section">
            <div className="section-header">
              <span className="section-icon">⚡</span>
              <h2>Redis Cache Configuration</h2>
            </div>
            <div className="config-grid">
              <div className="config-row">
                <span className="config-label">Secret Source</span>
                <span className="config-value code-value">{config.redis?.urlSource || 'Not configured'}</span>
              </div>
              <div className="config-row">
                <span className="config-label">Connection Status</span>
                <span className={`status-badge ${config.redis?.available ? 'connected' : 'disconnected'}`}>
                  {config.redis?.available ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
              {config.redis?.hostPort && (
                <div className="config-row">
                  <span className="config-label">Host:Port</span>
                  <span className="config-value highlight-value">{config.redis.hostPort}</span>
                </div>
              )}
              {config.redis?.maskedUrl && (
                <div className="config-row">
                  <span className="config-label">Full URL (masked)</span>
                  <span className="config-value code-value masked-url">{config.redis.maskedUrl}</span>
                </div>
              )}
              {config.redis?.note && (
                <div className="config-note">
                  <span className="note-icon">ℹ️</span>
                  {config.redis.note}
                </div>
              )}
            </div>
          </div>

          {/* Database Configuration Section */}
          <div className="config-section">
            <div className="section-header">
              <span className="section-icon">🗄️</span>
              <h2>Database Configuration</h2>
            </div>
            <div className="config-grid">
              <div className="config-row">
                <span className="config-label">Connection Status</span>
                <span className={`status-badge ${config.database?.available ? 'connected' : 'disconnected'}`}>
                  {config.database?.available ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
              {config.database?.hostPort && (
                <div className="config-row">
                  <span className="config-label">Host:Port</span>
                  <span className="config-value highlight-value">{config.database.hostPort}</span>
                </div>
              )}
              {config.database?.maskedUrl && (
                <div className="config-row">
                  <span className="config-label">Full URL (masked)</span>
                  <span className="config-value code-value masked-url">{config.database.maskedUrl}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shopify Integration Section */}
          <div className="config-section">
            <div className="section-header">
              <span className="section-icon">🛍️</span>
              <h2>Shopify Integration</h2>
            </div>
            <div className="config-grid">
              <div className="config-row">
                <span className="config-label">Shop Domain</span>
                <span className="config-value">{config.shopify?.shop || 'undefined'}</span>
              </div>
              <div className="config-row">
                <span className="config-label">API Key Set</span>
                <span className={`status-badge ${config.shopify?.apiKeySet ? 'connected' : 'disconnected'}`}>
                  {config.shopify?.apiKeySet ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="config-row">
                <span className="config-label">API Secret Set</span>
                <span className={`status-badge ${config.shopify?.apiSecretSet ? 'connected' : 'disconnected'}`}>
                  {config.shopify?.apiSecretSet ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="config-row">
                <span className="config-label">Access Token Set</span>
                <span className={`status-badge ${config.shopify?.accessTokenSet ? 'connected' : 'disconnected'}`}>
                  {config.shopify?.accessTokenSet ? '✅ Yes' : '❌ No'}
                </span>
              </div>
            </div>
          </div>

          {/* Sentry Error Tracking Section */}
          <div className="config-section">
            <div className="section-header">
              <span className="section-icon">🐛</span>
              <h2>Sentry Error Tracking</h2>
            </div>
            <div className="config-grid">
              <div className="config-row">
                <span className="config-label">DSN Configured</span>
                <span className={`status-badge ${config.sentry?.dsnSet ? 'connected' : 'disconnected'}`}>
                  {config.sentry?.dsnSet ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="config-row">
                <span className="config-label">Environment</span>
                <span className="config-value">{config.sentry?.environment || 'development'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Management Tools Section */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.6em', color: '#2c2c2c', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>
          Data Management Tools
        </h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Cache configuration and system operations
        </p>
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
