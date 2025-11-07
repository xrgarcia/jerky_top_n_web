import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { useEnvironmentConfig } from '../../hooks/useAdminTools';
import toast from 'react-hot-toast';
import './BulkImportPage.css';

function BulkImportPage() {
  const queryClient = useQueryClient();
  const [wsConnected, setWsConnected] = useState(false);
  const [mode, setMode] = useState('full'); // 'full' or 'reprocess'
  const [batchSize, setBatchSize] = useState('');
  const [workerConcurrency, setWorkerConcurrency] = useState('3');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [obliterateProgress, setObliterateProgress] = useState(null);
  const { socket } = useSocket();

  // Fetch import progress
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ['bulkImportProgress'],
    queryFn: async () => {
      const res = await fetch('/api/admin/bulk-import/progress', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch import progress');
      return res.json();
    },
    refetchInterval: 5000, // Fallback polling every 5s
    staleTime: 2000,
  });

  // Fetch environment config (includes Shopify status)
  const { data: config } = useEnvironmentConfig();

  // Fetch Shopify stats
  const { data: shopifyStats, isLoading: shopifyStatsLoading } = useQuery({
    queryKey: ['shopifyStats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/bulk-import/shopify-stats', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch Shopify stats');
      return res.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Subscribe to WebSocket events for real-time updates
  useEffect(() => {
    if (!socket) return;

    console.log('📦 Subscribing to bulk import updates...');

    // Subscribe to queue-monitor room
    socket.emit('subscribe:queue-monitor');

    // Listen for subscription confirmation
    const handleSubscriptionConfirmed = (data) => {
      if (data.room === 'queue-monitor') {
        console.log('✅ Subscribed to bulk import updates');
        setWsConnected(true);
      }
    };

    // Listen for real-time progress updates
    const handleBulkImportProgress = (data) => {
      console.log('📦 Bulk import progress update received:', data);
      queryClient.setQueryData(['bulkImportProgress'], (oldData) => {
        return data;
      });
    };

    // Listen for real-time Shopify stats updates
    const handleShopifyStatsUpdate = (data) => {
      console.log('📊 Shopify stats update received:', data);
      queryClient.setQueryData(['shopifyStats'], data);
    };

    // Listen for obliterate progress updates
    const handleObliterateProgress = (progress) => {
      console.log('🗑️ Obliterate progress:', progress);
      setObliterateProgress(progress);
    };

    // Listen for obliterate completion
    const handleObliterateComplete = (result) => {
      console.log('✅ Obliterate complete:', result);
      setObliterateProgress(null);
      queryClient.invalidateQueries(['bulkImportProgress']);
      toast.success(`Queue obliterated! Deleted ${result.removed?.toLocaleString()} keys in ${(result.duration / 1000).toFixed(1)}s`);
    };

    // Listen for obliterate errors
    const handleObliterateError = (data) => {
      console.error('❌ Obliterate error:', data);
      setObliterateProgress(null);
      toast.error(`Queue deletion failed: ${data.error}`);
    };

    socket.on('subscription:confirmed', handleSubscriptionConfirmed);
    socket.on('bulk-import:progress', handleBulkImportProgress);
    socket.on('shopify-stats:update', handleShopifyStatsUpdate);
    socket.on('queue:obliterate-progress', handleObliterateProgress);
    socket.on('queue:obliterate-complete', handleObliterateComplete);
    socket.on('queue:obliterate-error', handleObliterateError);

    // Cleanup on unmount
    return () => {
      console.log('📦 Unsubscribing from bulk import updates...');
      socket.emit('unsubscribe:queue-monitor');
      socket.off('subscription:confirmed', handleSubscriptionConfirmed);
      socket.off('bulk-import:progress', handleBulkImportProgress);
      socket.off('shopify-stats:update', handleShopifyStatsUpdate);
      socket.off('queue:obliterate-progress', handleObliterateProgress);
      socket.off('queue:obliterate-complete', handleObliterateComplete);
      socket.off('queue:obliterate-error', handleObliterateError);
      setWsConnected(false);
    };
  }, [socket, queryClient]);

  // Start bulk import mutation
  const startImportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/bulk-import/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          batchSize: batchSize ? parseInt(batchSize) : null
        })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to start import');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bulkImportProgress']);
      queryClient.invalidateQueries(['shopifyStats']);
      
      if (mode === 'full') {
        toast.success(`Full Import started! Created ${data.usersCreated || 0} new users, enqueued ${data.jobsEnqueued || 0} jobs.`);
      } else {
        toast.success(`Re-processing started! Enqueued ${data.jobsEnqueued || 0} existing users for re-sync.`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to start import: ${error.message}`);
    }
  });

  // Queue management mutations
  const obliterateQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/bulk-import/queue/obliterate', {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to obliterate queue');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bulkImportProgress']);
      
      // Handle background processing response
      if (data.status === 'started') {
        toast.success(`🗑️ Queue deletion started in background. Monitor the queue stats below to see progress.`, {
          duration: 5000
        });
      } else {
        // Legacy response format
        toast.success(`Obliterated all ${data.removed || 0} jobs from queue`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to obliterate queue: ${error.message}`);
    }
  });

  const clearCompletedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/bulk-import/queue/clear-completed', {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to clear completed jobs');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bulkImportProgress']);
      toast.success(`Cleared ${data.removed || 0} completed jobs`);
    },
    onError: (error) => {
      toast.error(`Failed to clear completed jobs: ${error.message}`);
    }
  });

  const clearFailedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/bulk-import/queue/clear-failed', {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to clear failed jobs');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bulkImportProgress']);
      toast.success(`Cleared ${data.removed || 0} failed jobs`);
    },
    onError: (error) => {
      toast.error(`Failed to clear failed jobs: ${error.message}`);
    }
  });

  const handleStartImport = () => {
    if (!config?.shopify?.accessTokenSet) {
      toast.error('Shopify API is not configured. Please set SHOPIFY_ADMIN_ACCESS_TOKEN.');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmImport = () => {
    setShowConfirmModal(false);
    startImportMutation.mutate();
  };

  const handleCancelImport = () => {
    setShowConfirmModal(false);
  };

  const progress = progressData || {};
  const queue = progress.queue || {};
  const queueRedis = queue.redis || {}; // Direct Redis counts (total in storage)
  const importInProgress = progress.importInProgress || false;
  const currentStats = progress.currentImportStats;

  // Determine current phase and active mode (use backend-reported mode if available)
  const phase = currentStats?.phase || 'idle';
  const isActive = importInProgress || (queue.active > 0 || queue.waiting > 0);
  const activeMode = currentStats?.mode || mode; // Use backend mode during active import, fallback to local selection

  return (
    <div className="bulk-import-page">
      <div className="page-header">
        <Link to="/tools" className="back-link">← Back to Admin Tools</Link>
        <h1>Bulk Customer Import</h1>
        <p>Import Shopify customers with order history and personalized classifications</p>
      </div>

      {/* System Status */}
      <div className="status-card">
        <h3>System Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-label">Shopify API</div>
            <div className={`status-value ${config?.shopify?.accessTokenSet ? 'success' : 'danger'}`}>
              {config?.shopify?.accessTokenSet ? '✅ Connected' : '❌ Not Configured'}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">WebSocket</div>
            <div className={`status-value ${wsConnected ? 'success' : 'warning'}`}>
              {wsConnected ? '✅ Live Updates' : '⚠️ Polling Mode'}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Workers</div>
            <div className="status-value">
              {queue.active || 0} active / {workerConcurrency} max
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Queue Status</div>
            <div className="status-value">
              {isActive ? '🔄 Processing' : '✓ Idle'}
            </div>
          </div>
        </div>

        {shopifyStats?.gap && (
          <div className="shopify-gap-metric">
            <div className="gap-label">Shopify Gap:</div>
            <div className="gap-value">
              {shopifyStats.gap.missingUsers?.toLocaleString() || 0} customers not yet imported
            </div>
          </div>
        )}
      </div>

      {/* Import Controls */}
      <div className="controls-card">
        <h3>Import Configuration</h3>
        
        <div className="control-group">
          <label className="control-label">Import Mode:</label>
          <div className="mode-selector">
            <label className={`mode-option ${mode === 'full' ? 'selected' : ''}`}>
              <input
                type="radio"
                value="full"
                checked={mode === 'full'}
                onChange={(e) => setMode(e.target.value)}
                disabled={isActive}
              />
              <div className="mode-content">
                <div className="mode-title">🆕 Full Import</div>
                <div className="mode-desc">Create new users only (skip existing)</div>
              </div>
            </label>
            <label className={`mode-option ${mode === 'reprocess' ? 'selected' : ''}`}>
              <input
                type="radio"
                value="reprocess"
                checked={mode === 'reprocess'}
                onChange={(e) => setMode(e.target.value)}
                disabled={isActive}
              />
              <div className="mode-content">
                <div className="mode-title">🔄 Re-processing</div>
                <div className="mode-desc">Update existing users (skip non-existent)</div>
              </div>
            </label>
          </div>
        </div>

        {mode === 'full' && (
          <div className="control-group">
            <label className="control-label">Batch Size:</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              className="control-select"
              disabled={isActive}
            >
              <option value="">All Customers (⚠️ {shopifyStats?.gap?.missingUsers?.toLocaleString() || '?'})</option>
              <option value="1000">1,000 customers</option>
              <option value="5000">5,000 customers</option>
              <option value="10000">10,000 customers</option>
              <option value="25000">25,000 customers</option>
              <option value="50000">50,000 customers</option>
              <option value="100000">100,000 customers</option>
            </select>
          </div>
        )}

        <div className="control-group">
          <label className="control-label">Worker Concurrency:</label>
          <select
            value={workerConcurrency}
            onChange={(e) => setWorkerConcurrency(e.target.value)}
            className="control-select"
            disabled={isActive}
          >
            <option value="1">1 worker (slowest, safest)</option>
            <option value="3">3 workers (recommended)</option>
            <option value="5">5 workers</option>
            <option value="10">10 workers (fastest, high load)</option>
          </select>
          <div className="control-note">
            Higher concurrency = faster processing but more database load
          </div>
        </div>

        <div className="button-row">
          <button
            onClick={handleStartImport}
            disabled={isActive || startImportMutation.isPending || !config?.shopify?.accessTokenSet}
            className="btn-primary btn-large"
          >
            {startImportMutation.isPending ? 'Starting...' : `🚀 Start ${mode === 'full' ? 'Full Import' : 'Re-processing'}`}
          </button>
        </div>
      </div>

      {/* Real-time Metrics Dashboard */}
      {currentStats && (
        <div className="metrics-card">
          <h3>📊 Real-Time Metrics</h3>
          
          <div className="phase-indicator">
            <div className="phase-label">Current Phase:</div>
            <div className={`phase-value phase-${phase}`}>
              {phase === 'fetching_customers' && '📥 Fetching Customers from Shopify'}
              {phase === 'processing_customers' && '⚙️ Processing Customers'}
              {phase === 'enqueuing_jobs' && '📋 Enqueuing Import Jobs'}
              {phase === 'completed' && '✅ Import Complete'}
              {phase === 'idle' && '⏸️ Idle'}
            </div>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-value">{currentStats.customersFetched || 0}</div>
              <div className="metric-label">Customers Fetched</div>
            </div>
            
            {activeMode === 'full' && currentStats.alreadyInDB !== undefined && (
              <div className="metric-card warning">
                <div className="metric-value">{currentStats.alreadyInDB || 0}</div>
                <div className="metric-label">Already in DB (Skipped)</div>
              </div>
            )}
            
            {activeMode === 'reprocess' && currentStats.notInDB !== undefined && (
              <div className="metric-card warning">
                <div className="metric-value">{currentStats.notInDB || 0}</div>
                <div className="metric-label">Not in DB (Skipped)</div>
              </div>
            )}
            
            {activeMode === 'full' && (
              <div className="metric-card success">
                <div className="metric-value">{currentStats.usersCreated || 0}</div>
                <div className="metric-label">New Users Created</div>
              </div>
            )}

            {activeMode === 'reprocess' && currentStats.jobsPendingEnqueue !== undefined && phase === 'fetching_customers' && (
              <div className="metric-card">
                <div className="metric-value">{currentStats.jobsPendingEnqueue || 0}</div>
                <div className="metric-label">Jobs Pending Enqueue</div>
              </div>
            )}
            
            <div className="metric-card">
              <div className="metric-value">{currentStats.jobsEnqueued || 0}</div>
              <div className="metric-label">Jobs Enqueued</div>
            </div>
            
            {currentStats.errors > 0 && (
              <div className="metric-card danger">
                <div className="metric-value">{currentStats.errors}</div>
                <div className="metric-label">Errors</div>
              </div>
            )}
          </div>

          {currentStats.startedAt && (
            <div className="metrics-footer">
              <div className="metric-time">
                Started: {new Date(currentStats.startedAt).toLocaleTimeString()}
                {currentStats.completedAt && (
                  <span> • Completed: {new Date(currentStats.completedAt).toLocaleTimeString()}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue Stats */}
      <div className="queue-card">
        <h3>Queue Statistics</h3>
        
        <div className="queue-section">
          <div className="queue-section-header">
            <h4>Active Queue (Within Retention)</h4>
            <div className="queue-section-desc">Jobs BullMQ is managing (2h for completed, 24h for failed)</div>
          </div>
          <div className="queue-stats-grid">
            <div className="queue-stat">
              <div className="queue-stat-value">{queue.waiting || 0}</div>
              <div className="queue-stat-label">Waiting</div>
            </div>
            <div className="queue-stat active">
              <div className="queue-stat-value">{queue.active || 0}</div>
              <div className="queue-stat-label">Active</div>
            </div>
            <div className="queue-stat success">
              <div className="queue-stat-value">{queue.completed || 0}</div>
              <div className="queue-stat-label">Completed</div>
            </div>
            <div className="queue-stat danger">
              <div className="queue-stat-value">{queue.failed || 0}</div>
              <div className="queue-stat-label">Failed</div>
            </div>
            <div className="queue-stat">
              <div className="queue-stat-value">{queue.total || 0}</div>
              <div className="queue-stat-label">Total</div>
            </div>
          </div>
        </div>

        <div className="queue-section">
          <div className="queue-section-header">
            <h4>Redis Storage (Total in Database)</h4>
            <div className="queue-section-desc">All jobs in Redis, including those aged out by retention policy</div>
          </div>
          <div className="queue-stats-grid">
            <div className="queue-stat">
              <div className="queue-stat-value">{queueRedis.waiting?.toLocaleString() || 0}</div>
              <div className="queue-stat-label">Waiting</div>
            </div>
            <div className="queue-stat active">
              <div className="queue-stat-value">{queueRedis.active?.toLocaleString() || 0}</div>
              <div className="queue-stat-label">Active</div>
            </div>
            <div className="queue-stat success">
              <div className="queue-stat-value">{queueRedis.completed?.toLocaleString() || 0}</div>
              <div className="queue-stat-label">Completed</div>
            </div>
            <div className="queue-stat danger">
              <div className="queue-stat-value">{queueRedis.failed?.toLocaleString() || 0}</div>
              <div className="queue-stat-label">Failed</div>
            </div>
            <div className="queue-stat">
              <div className="queue-stat-value">{queueRedis.total?.toLocaleString() || 0}</div>
              <div className="queue-stat-label">Total</div>
            </div>
          </div>
        </div>

        <div className="queue-management">
          <h4>Queue Management</h4>
          <div className="button-row">
            <button
              onClick={() => obliterateQueueMutation.mutate()}
              disabled={obliterateQueueMutation.isPending || (queueRedis.total || 0) === 0}
              className="btn-danger"
              title="Remove ALL jobs (waiting, active, completed, failed)"
            >
              {obliterateQueueMutation.isPending ? 'Clearing...' : `🗑️ Obliterate All Jobs${queueRedis.total ? ` (${queueRedis.total.toLocaleString()})` : ''}`}
            </button>
            
            <button
              onClick={() => clearCompletedMutation.mutate()}
              disabled={clearCompletedMutation.isPending || (queueRedis.completed || 0) === 0}
              className="btn-secondary"
              title="Remove only completed jobs"
            >
              {clearCompletedMutation.isPending ? 'Clearing...' : `✓ Clear Completed${queueRedis.completed ? ` (${queueRedis.completed.toLocaleString()})` : ''}`}
            </button>
            
            <button
              onClick={() => clearFailedMutation.mutate()}
              disabled={clearFailedMutation.isPending || (queueRedis.failed || 0) === 0}
              className="btn-secondary"
              title="Remove only failed jobs"
            >
              {clearFailedMutation.isPending ? 'Clearing...' : `❌ Clear Failed${queueRedis.failed ? ` (${queueRedis.failed.toLocaleString()})` : ''}`}
            </button>

            <button
              onClick={() => queryClient.invalidateQueries(['bulkImportProgress'])}
              className="btn-secondary"
            >
              🔄 Refresh Stats
            </button>
          </div>
          
          {/* Obliterate Progress Indicator */}
          {obliterateProgress && (
            <div className="obliterate-progress">
              {obliterateProgress.phase === 'scanning' && (
                <div className="progress-info">
                  <div className="progress-label">🔍 Scanning for queue keys...</div>
                  <div className="progress-stats">Found {obliterateProgress.keysFound?.toLocaleString()} keys (est. {obliterateProgress.estimatedTotal?.toLocaleString()} jobs)</div>
                </div>
              )}
              {obliterateProgress.phase === 'deleting' && (
                <div className="progress-info">
                  <div className="progress-label">🗑️ Deleting queue keys... Batch {obliterateProgress.batchNum}/{obliterateProgress.totalBatches}</div>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${obliterateProgress.percentage}%` }}
                    >
                      <span className="progress-percentage">{obliterateProgress.percentage}%</span>
                    </div>
                  </div>
                  <div className="progress-stats">{obliterateProgress.deleted?.toLocaleString()} / {obliterateProgress.total?.toLocaleString()} keys deleted</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="info-card">
        <h4>ℹ️ Import Modes Explained</h4>
        <div className="mode-explanation">
          <div className="mode-explain">
            <strong>🆕 Full Import Mode:</strong>
            <p>Fetches customers from Shopify and creates new user records only. If a customer already exists in the database, they are skipped (counted in "Already in DB"). Use this to onboard new customers without affecting existing data.</p>
          </div>
          <div className="mode-explain">
            <strong>🔄 Re-processing Mode:</strong>
            <p>Fetches customers from Shopify and enqueues jobs to re-sync orders and reclassify existing users only. If a customer doesn't exist in the database, they are skipped (counted in "Not in DB"). Use this to refresh data for existing customers.</p>
          </div>
        </div>
        <p className="info-note">
          <strong>Note:</strong> Jobs process in the background. You can safely close this page during import.
          Track classification queue status on the <Link to="/tools/queue-monitor" style={{ color: '#8B4513', textDecoration: 'underline' }}>Queue Monitor page</Link>.
        </p>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={handleCancelImport}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Confirm {mode === 'full' ? 'Full Import' : 'Re-processing'}</h3>
            </div>
            <div className="modal-body">
              {mode === 'full' ? (
                <>
                  <p className="modal-main">
                    <strong>Full Import Mode:</strong> This will create user records for {batchSize ? `up to ${parseInt(batchSize).toLocaleString()}` : `ALL ${shopifyStats?.gap?.missingUsers?.toLocaleString() || '?'}`} NEW Shopify customers and import their complete order history.
                  </p>
                  <p className="modal-detail">
                    Existing customers will be skipped automatically.
                  </p>
                  <p className="modal-warning">
                    This operation will run in the background. You can safely close this page during import.
                  </p>
                </>
              ) : (
                <>
                  <p className="modal-main">
                    <strong>Re-processing Mode:</strong> This will re-sync orders and reclassify EXISTING users found in Shopify. Non-existent customers will be skipped.
                  </p>
                  <p className="modal-detail">
                    {batchSize ? `Up to ${parseInt(batchSize).toLocaleString()} customers will be processed.` : 'All existing customers will be processed.'}
                  </p>
                  <p className="modal-warning">
                    Do you want to continue?
                  </p>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button 
                onClick={handleCancelImport}
                className="btn-modal-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmImport}
                className="btn-modal-confirm"
              >
                {mode === 'full' ? 'Start Full Import' : 'Start Re-processing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkImportPage;
