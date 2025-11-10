import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSuperAdminAccess } from '../../hooks/useAdminAccess';
import { useEnvironmentConfig, useCacheConfig } from '../../hooks/useAdminTools';
import { useClearCache, useClearAllData, useSaveCacheConfig } from '../../hooks/useAdminMutations';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../hooks/useSocket';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ConfirmationModal from '../../components/ConfirmationModal';
import './AdminPages.css';

function DataPage() {
  const { data: isSuperAdmin, isLoading: loadingAccess, isError, error } = useSuperAdminAccess();
  const { data: config, isLoading: loadingConfig, isError: configError, error: configErrorDetails } = useEnvironmentConfig();
  const { data: cacheConfig, isLoading: loadingCacheConfig } = useCacheConfig();
  const { showToast } = useToast();
  const clearCacheMutation = useClearCache();
  const clearAllDataMutation = useClearAllData();
  const saveCacheConfigMutation = useSaveCacheConfig();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  
  // Cache configuration form state
  const [metadataHours, setMetadataHours] = useState('');
  const [rankingStatsHours, setRankingStatsHours] = useState('');
  
  // Initialize form values when cache config loads
  useEffect(() => {
    if (cacheConfig) {
      setMetadataHours(cacheConfig.metadataCacheStaleHours?.toString() || '168');
      setRankingStatsHours(cacheConfig.rankingStatsCacheStaleHours?.toString() || '48');
    }
  }, [cacheConfig]);

  // Fetch engagement backfill progress
  const { data: backfillProgress, isLoading: backfillLoading } = useQuery({
    queryKey: ['engagementBackfillProgress'],
    queryFn: async () => {
      const res = await fetch('/api/admin/engagement/backfill/progress', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch backfill progress');
      return res.json();
    },
    refetchInterval: 3000, // Fallback polling every 3s
    staleTime: 1000,
  });

  // Subscribe to WebSocket events for real-time backfill updates
  useEffect(() => {
    if (!socket) return;

    console.log('📊 Subscribing to engagement backfill updates...');

    // Subscribe to admin room (for backfill progress)
    socket.emit('subscribe:admin');

    // Listen for real-time progress updates
    const handleBackfillProgress = (data) => {
      console.log('📊 Engagement backfill progress update received:', data);
      queryClient.setQueryData(['engagementBackfillProgress'], data);
    };

    socket.on('bulk-import:backfill-progress', handleBackfillProgress);

    // Cleanup on unmount
    return () => {
      console.log('📊 Unsubscribing from engagement backfill updates...');
      socket.emit('unsubscribe:admin');
      socket.off('bulk-import:backfill-progress', handleBackfillProgress);
    };
  }, [socket, queryClient]);

  // Start engagement backfill mutation
  const startBackfillMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/engagement/backfill', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(error.error || 'Failed to start backfill');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['engagementBackfillProgress']);
      
      showToast({
        type: 'success',
        icon: '🚀',
        title: 'Backfill Started',
        message: `Enqueued ${data.totalUsers || 0} users for engagement score calculation`,
        duration: 5000
      });
    },
    onError: (error) => {
      showToast({
        type: 'error',
        icon: '❌',
        title: 'Error',
        message: `Failed to start backfill: ${error.message}`,
        duration: 5000
      });
    }
  });

  const handleClearCache = async () => {
    try {
      const result = await clearCacheMutation.mutateAsync();
      const cacheNames = result.clearedCaches ? result.clearedCaches.join(', ') : 'all caches';
      
      showToast({
        type: 'success',
        icon: '🗑️',
        title: 'Cache Cleared',
        message: `Successfully cleared: ${cacheNames}`,
        duration: 5000
      });
    } catch (error) {
      if (error.status === 403) {
        showToast({
          type: 'error',
          icon: '🔐',
          title: 'Access Denied',
          message: 'Super admin privileges required (ray@jerky.com only).',
          duration: 5000
        });
      } else {
        showToast({
          type: 'error',
          icon: '❌',
          title: 'Error',
          message: `Failed to clear cache: ${error.message}`,
          duration: 5000
        });
      }
    }
  };

  const handleClearAllData = async () => {
    try {
      const result = await clearAllDataMutation.mutateAsync();
      
      showToast({
        type: 'success',
        icon: '✅',
        title: 'Success',
        message: result.message || 'Successfully cleared all achievement data',
        duration: 5000
      });
    } catch (error) {
      if (error.status === 403) {
        showToast({
          type: 'error',
          icon: '🔐',
          title: 'Access Denied',
          message: 'Super admin privileges required (ray@jerky.com only).',
          duration: 5000
        });
      } else {
        showToast({
          type: 'error',
          icon: '❌',
          title: 'Error',
          message: `Failed to clear all data: ${error.message}`,
          duration: 5000
        });
      }
    }
  };

  const handleSaveCacheConfig = async () => {
    // Validate inputs
    const metadataValue = parseInt(metadataHours);
    const rankingStatsValue = parseInt(rankingStatsHours);
    
    if (isNaN(metadataValue) || metadataValue < 1 || metadataValue > 720) {
      showToast({
        type: 'error',
        icon: '⚠️',
        title: 'Invalid Input',
        message: 'Product Metadata Cache hours must be between 1 and 720',
        duration: 5000
      });
      return;
    }
    
    if (isNaN(rankingStatsValue) || rankingStatsValue < 1 || rankingStatsValue > 720) {
      showToast({
        type: 'error',
        icon: '⚠️',
        title: 'Invalid Input',
        message: 'Ranking Stats Cache hours must be between 1 and 720',
        duration: 5000
      });
      return;
    }
    
    try {
      await saveCacheConfigMutation.mutateAsync({
        metadataCacheStaleHours: metadataValue,
        rankingStatsCacheStaleHours: rankingStatsValue
      });
      
      showToast({
        type: 'success',
        icon: '💾',
        title: 'Configuration Saved',
        message: `Cache staleness thresholds updated successfully`,
        duration: 5000
      });
    } catch (error) {
      if (error.status === 403) {
        showToast({
          type: 'error',
          icon: '🔐',
          title: 'Access Denied',
          message: 'Super admin privileges required (ray@jerky.com only).',
          duration: 5000
        });
      } else {
        showToast({
          type: 'error',
          icon: '❌',
          title: 'Error',
          message: `Failed to save configuration: ${error.message}`,
          duration: 5000
        });
      }
    }
  };

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
        <div className="data-card cache-config-card">
          <div className="data-card-header">
            <span className="data-icon">⏰</span>
            <div>
              <h3>Cache Staleness Configuration</h3>
              <p>Configure staleness thresholds for each cache. Sentry alerts when thresholds exceeded.</p>
            </div>
          </div>
          <div className="data-card-content">
            {loadingCacheConfig ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                Loading configuration...
              </div>
            ) : (
              <div className="cache-config-form">
                <div className="cache-input-group">
                  <label className="cache-label">
                    <span className="label-icon">📦</span>
                    <span className="label-text">Product Metadata Cache Age</span>
                  </label>
                  <p className="cache-description">
                    Product details, animal types, and flavors from Shopify. Updates when products change.
                  </p>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={metadataHours}
                      onChange={(e) => setMetadataHours(e.target.value)}
                      className="cache-input"
                      placeholder="168"
                    />
                    <span className="input-unit">hours</span>
                  </div>
                  {cacheConfig && (
                    <p className="current-value">Current: {cacheConfig.metadataCacheStaleHours} hours</p>
                  )}
                </div>

                <div className="cache-input-group">
                  <label className="cache-label">
                    <span className="label-icon">📊</span>
                    <span className="label-text">Ranking Stats Cache Age</span>
                  </label>
                  <p className="cache-description">
                    Product ranking statistics and averages. Updates with every order and ranking.
                  </p>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={rankingStatsHours}
                      onChange={(e) => setRankingStatsHours(e.target.value)}
                      className="cache-input"
                      placeholder="48"
                    />
                    <span className="input-unit">hours</span>
                  </div>
                  {cacheConfig && (
                    <p className="current-value">Current: {cacheConfig.rankingStatsCacheStaleHours} hours</p>
                  )}
                </div>

                <button 
                  className="btn-success btn-save-config" 
                  onClick={handleSaveCacheConfig}
                  disabled={saveCacheConfigMutation.isPending}
                >
                  {saveCacheConfigMutation.isPending ? '⏳ Saving...' : '💾 Save Configuration'}
                </button>
              </div>
            )}
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
            <button 
              className="btn-warning" 
              onClick={() => setShowClearCacheModal(true)}
              disabled={clearCacheMutation.isPending}
            >
              {clearCacheMutation.isPending ? '⏳ Clearing...' : '🗑️ Clear All Cache'}
            </button>
          </div>
        </div>

        <div className="data-card">
          <div className="data-card-header">
            <span className="data-icon">📊</span>
            <div>
              <h3>Backfill Engagement Scores</h3>
              <p>Recalculate engagement scores for all users (populates leaderboard rollup table)</p>
            </div>
          </div>
          <div className="data-card-content">
            {backfillProgress && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '8px',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  <span>Progress: {backfillProgress.completed || 0} / {backfillProgress.total || 0}</span>
                  <span>{backfillProgress.progress || 0}%</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '24px',
                  background: '#e8dfd0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    width: `${backfillProgress.progress || 0}%`,
                    height: '100%',
                    background: backfillProgress.isRunning 
                      ? 'linear-gradient(90deg, #8b7355 0%, #6b4423 50%, #8b7355 100%)'
                      : '#6b4423',
                    transition: 'width 0.3s ease',
                    animation: backfillProgress.isRunning ? 'shimmer 2s infinite' : 'none',
                    backgroundSize: '200% 100%'
                  }} />
                </div>
                {backfillProgress.failed > 0 && (
                  <div style={{ 
                    marginTop: '8px', 
                    fontSize: '13px', 
                    color: '#dc3545' 
                  }}>
                    ⚠️ {backfillProgress.failed} failed
                  </div>
                )}
              </div>
            )}
            <button 
              className="btn-success" 
              onClick={() => startBackfillMutation.mutate()}
              disabled={startBackfillMutation.isPending || backfillProgress?.isRunning}
            >
              {startBackfillMutation.isPending ? '⏳ Starting...' : 
               backfillProgress?.isRunning ? '🔄 Running...' : 
               '🚀 Start Backfill'}
            </button>
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
            <button 
              className="btn-danger" 
              onClick={() => setShowClearDataModal(true)}
              disabled={clearAllDataMutation.isPending}
            >
              {clearAllDataMutation.isPending ? '⏳ Clearing...' : '⚠️ Clear All Data'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showClearCacheModal}
        onClose={() => setShowClearCacheModal(false)}
        onConfirm={handleClearCache}
        title="Clear All Cache"
        message="⚠️ This will clear all cached data including achievements, leaderboards, product metadata, and home stats. The cache will automatically rebuild on next request."
        requiredText="delete cache"
        confirmButtonText="Confirm"
        confirmButtonClass="btn-warning"
      />

      <ConfirmationModal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        onConfirm={handleClearAllData}
        title="Clear All Data"
        message="⚠️ This will permanently delete ALL data for ALL users including: achievements, streaks, rankings, page views, and searches. This action cannot be undone."
        requiredText="delete all data"
        confirmButtonText="Confirm"
        confirmButtonClass="btn-danger"
      />
    </div>
  );
}

export default DataPage;
