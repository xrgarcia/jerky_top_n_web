import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../hooks/useSocket';
import toast from 'react-hot-toast';
import './BulkImportPage.css';

function BulkImportPage() {
  const queryClient = useQueryClient();
  const [wsConnected, setWsConnected] = useState(false);
  const [reimportAll, setReimportAll] = useState(false);
  const [targetUnprocessedUsers, setTargetUnprocessedUsers] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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

  // Fetch API status
  const { data: statusData } = useQuery({
    queryKey: ['bulkImportStatus'],
    queryFn: async () => {
      const res = await fetch('/api/admin/bulk-import/status', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    staleTime: 60000, // 1 minute
  });

  // Subscribe to WebSocket events for real-time updates
  useEffect(() => {
    if (!socket) return;

    console.log('📦 Subscribing to bulk import updates...');

    // Subscribe to queue-monitor room (reuse existing room)
    socket.emit('subscribe:queue-monitor');

    // Listen for subscription confirmation
    const handleSubscriptionConfirmed = (data) => {
      if (data.room === 'queue-monitor') {
        console.log('✅ Subscribed to bulk import updates');
        setWsConnected(true);
      }
    };

    // Listen for real-time comprehensive progress updates (queue + user stats)
    const handleBulkImportProgress = (data) => {
      console.log('📦 Bulk import progress update received:', data);
      // Update progress query data with complete real-time data
      queryClient.setQueryData(['bulkImportProgress'], (oldData) => {
        return data;
      });
    };

    // Legacy handler for old queue stats events
    const handleBulkImportStats = (data) => {
      console.log('📦 Bulk import stats update received (legacy):', data);
      // Update progress query data with complete fallback for race condition
      queryClient.setQueryData(['bulkImportProgress'], (oldData) => {
        const defaults = {
          importInProgress: false,
          currentImportStats: null,
          users: {
            total: 0,
            imported: 0,
            pending: 0,
            inProgress: 0,
            failed: 0
          }
        };
        return oldData ? { ...oldData, queue: data } : { ...defaults, queue: data };
      });
    };

    socket.on('subscription:confirmed', handleSubscriptionConfirmed);
    socket.on('bulk-import:progress', handleBulkImportProgress);
    socket.on('bulk-import:stats', handleBulkImportStats);

    // Cleanup on unmount
    return () => {
      console.log('📦 Unsubscribing from bulk import updates...');
      socket.emit('unsubscribe:queue-monitor');
      socket.off('subscription:confirmed', handleSubscriptionConfirmed);
      socket.off('bulk-import:progress', handleBulkImportProgress);
      socket.off('bulk-import:stats', handleBulkImportStats);
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
          reimportAll,
          targetUnprocessedUsers: targetUnprocessedUsers ? parseInt(targetUnprocessedUsers) : null
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
      toast.success(`Import started successfully! ${data.jobsEnqueued} jobs enqueued.`);
    },
    onError: (error) => {
      toast.error(`Failed to start import: ${error.message}`);
    }
  });

  // Clean queue mutation
  const cleanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/bulk-import/queue/clean', {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to clean queue');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bulkImportProgress']);
      toast.success('Queue cleaned successfully');
    },
    onError: (error) => {
      toast.error(`Failed to clean queue: ${error.message}`);
    }
  });

  const handleStartImport = () => {
    if (!statusData?.shopifyApiAvailable) {
      toast.error('Shopify API is not configured. Please set SHOPIFY_ADMIN_ACCESS_TOKEN.');
      return;
    }

    // Show confirmation modal
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
  const users = progress.users || {};
  const importInProgress = progress.importInProgress || false;
  const currentStats = progress.currentImportStats;

  // Calculate progress percentage
  const totalJobs = queue.total || 0;
  const completedJobs = queue.completed || 0;
  const progressPercent = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  return (
    <div className="bulk-import-page">
      <div className="bulk-import-header">
        <h2>📦 Bulk Customer Import</h2>
        <p className="bulk-import-subtitle">
          Import all Shopify customers and their complete order history
        </p>
      </div>

      {/* API Status */}
      <div className="status-card">
        <h3>System Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Shopify API:</span>
            <span className={`status-badge ${statusData?.shopifyApiAvailable ? 'available' : 'unavailable'}`}>
              {statusData?.shopifyApiAvailable ? '🟢 Connected' : '🔴 Not Configured'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">WebSocket:</span>
            <span className={`status-badge ${wsConnected ? 'connected' : 'disconnected'}`}>
              {wsConnected ? '🟢 Live Updates' : '🔴 Disconnected'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Import Status:</span>
            <span className={`status-badge ${importInProgress ? 'in-progress' : 'idle'}`}>
              {importInProgress ? '⏳ In Progress' : '✅ Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* User Statistics */}
      <div className="stats-card">
        <h3>User Statistics</h3>
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-value">{users.total || 0}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-box success">
            <div className="stat-value">{users.imported || 0}</div>
            <div className="stat-label">Fully Imported</div>
          </div>
          <div className="stat-box warning">
            <div className="stat-value">{users.pending || 0}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-box info">
            <div className="stat-value">{users.inProgress || 0}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-box danger">
            <div className="stat-value">{users.failed || 0}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>
      </div>

      {/* Worker Progress - Real-time processing status */}
      {(queue.active > 0 || queue.waiting > 0) && (
        <div className="worker-progress-card">
          <h3>🔄 Worker Progress (Live)</h3>
          <div className="worker-progress-grid">
            <div className="worker-stat active-workers">
              <div className="worker-stat-value">{queue.active || 0}</div>
              <div className="worker-stat-label">Processing Now</div>
            </div>
            <div className="worker-stat waiting-jobs">
              <div className="worker-stat-value">{queue.waiting || 0}</div>
              <div className="worker-stat-label">In Queue</div>
            </div>
            <div className="worker-stat users-in-progress">
              <div className="worker-stat-value">{users.inProgress || 0}</div>
              <div className="worker-stat-label">Users Processing</div>
            </div>
            <div className="worker-stat users-remaining">
              <div className="worker-stat-value">{users.pending || 0}</div>
              <div className="worker-stat-label">Users Remaining</div>
            </div>
          </div>
          <div className="worker-progress-note">
            <span className="pulse-indicator"></span>
            <span>Live updates via WebSocket</span>
          </div>
        </div>
      )}

      {/* Queue Statistics */}
      <div className="queue-card">
        <h3>Queue Status</h3>
        
        {/* Progress Bar */}
        {totalJobs > 0 && (
          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {completedJobs} / {totalJobs} jobs completed ({progressPercent}%)
            </div>
          </div>
        )}

        <div className="queue-stats-grid">
          <div className="queue-stat">
            <span className="queue-stat-label">Waiting:</span>
            <span className="queue-stat-value waiting">{queue.waiting || 0}</span>
          </div>
          <div className="queue-stat">
            <span className="queue-stat-label">Active:</span>
            <span className="queue-stat-value active">{queue.active || 0}</span>
          </div>
          <div className="queue-stat">
            <span className="queue-stat-label">Completed:</span>
            <span className="queue-stat-value completed">{queue.completed || 0}</span>
          </div>
          <div className="queue-stat">
            <span className="queue-stat-label">Failed:</span>
            <span className="queue-stat-value failed">{queue.failed || 0}</span>
          </div>
        </div>

        {/* Current Import Stats */}
        {currentStats && (
          <div className="current-import-stats">
            <h4>Current Import Progress</h4>
            <div className="import-stats-grid">
              <div><strong>Phase:</strong> {currentStats.phase}</div>
              <div><strong>Customers Fetched:</strong> {currentStats.customersFetched}</div>
              <div><strong>Users Created:</strong> {currentStats.usersCreated}</div>
              <div><strong>Users Updated:</strong> {currentStats.usersUpdated}</div>
              <div><strong>Jobs Enqueued:</strong> {currentStats.jobsEnqueued}</div>
              <div><strong>Errors:</strong> {currentStats.errors}</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="controls-card">
        <h3>Import Controls</h3>
        
        <div className="import-options">
          <div className="option-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={reimportAll}
                onChange={(e) => setReimportAll(e.target.checked)}
                disabled={importInProgress}
              />
              <span>Reimport All Users (including already imported)</span>
            </label>
          </div>

          <div className="option-group">
            <label className="input-label">
              Number of Unprocessed Users to Import (intelligent mode):
              <input
                type="number"
                value={targetUnprocessedUsers}
                onChange={(e) => setTargetUnprocessedUsers(e.target.value)}
                placeholder="Leave empty to import all"
                className="number-input"
                disabled={importInProgress}
                min="1"
              />
            </label>
            <small style={{ color: '#777', marginTop: '4px', display: 'block' }}>
              System will automatically find and import this many users who haven't been imported yet
            </small>
          </div>
        </div>

        <div className="button-group">
          <button
            onClick={handleStartImport}
            disabled={importInProgress || startImportMutation.isPending || !statusData?.shopifyApiAvailable}
            className="btn-primary"
          >
            {startImportMutation.isPending ? 'Starting...' : '🚀 Start Bulk Import'}
          </button>

          <button
            onClick={() => cleanMutation.mutate()}
            disabled={cleanMutation.isPending || importInProgress}
            className="btn-secondary"
          >
            {cleanMutation.isPending ? 'Cleaning...' : '🗑️ Clean Completed Jobs'}
          </button>

          <button
            onClick={() => queryClient.invalidateQueries(['bulkImportProgress'])}
            className="btn-secondary"
          >
            🔄 Refresh Stats
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="info-card">
        <h4>ℹ️ How It Works</h4>
        <ol>
          <li><strong>Fetch Customers:</strong> Retrieves all customers from Shopify API</li>
          <li><strong>Create User Records:</strong> Creates/updates user entries in database</li>
          <li><strong>Enqueue Jobs:</strong> Creates background jobs for each user</li>
          <li><strong>Worker Processing:</strong> Workers fetch order history and trigger classification</li>
          <li><strong>Classification:</strong> Each user's flavor profiles are calculated for personalized guidance</li>
        </ol>
        <p className="info-note">
          <strong>Note:</strong> Jobs process in the background. You can safely close this page during import.
        </p>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={handleCancelImport}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Confirm Bulk Import</h3>
            </div>
            <div className="modal-body">
              <p>
                {reimportAll 
                  ? 'This will REIMPORT ALL users, even those already imported. This may take a significant amount of time and will trigger classification jobs for all users.' 
                  : 'This will import Shopify customers and their complete order history. This may take a significant amount of time.'}
              </p>
              {targetUnprocessedUsers && (
                <p className="modal-detail">
                  <strong>Target:</strong> {targetUnprocessedUsers} unprocessed user{parseInt(targetUnprocessedUsers) !== 1 ? 's' : ''}
                </p>
              )}
              <p className="modal-warning">
                Do you want to continue?
              </p>
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
                {reimportAll ? 'Reimport All' : 'Start Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkImportPage;
