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
  const [fullImport, setFullImport] = useState(false);
  const [batchSize, setBatchSize] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [workerProgressState, setWorkerProgressState] = useState('idle');
  const [lastCompletedStats, setLastCompletedStats] = useState(null);
  const completionTimerRef = React.useRef(null);
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
          targetUnprocessedUsers: targetUnprocessedUsers ? parseInt(targetUnprocessedUsers) : null,
          fullImport,
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
      toast.success(`Import started! Created ${data.usersCreated} users, enqueued ${data.jobsEnqueued} jobs.`);
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
    console.log('🚀 Start Import clicked', { fullImport, batchSize, reimportAll, targetUnprocessedUsers, importInProgress });
    
    if (!statusData?.shopifyApiAvailable) {
      console.error('❌ Shopify API not available');
      toast.error('Shopify API is not configured. Please set SHOPIFY_ADMIN_ACCESS_TOKEN.');
      return;
    }

    // Show confirmation modal
    console.log('✅ Opening confirmation modal');
    setShowConfirmModal(true);
  };

  const handleConfirmImport = () => {
    console.log('✅ Import confirmed, triggering mutation', { fullImport, batchSize, reimportAll, targetUnprocessedUsers });
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

  // Track worker progress state transitions
  useEffect(() => {
    const hasActiveJobs = (queue.active || 0) > 0 || (queue.waiting || 0) > 0;
    
    if (hasActiveJobs) {
      // Jobs are running - clear completion timer and set to active
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
      setWorkerProgressState('active');
      setLastCompletedStats(null); // Clear old completion stats
    } else if (workerProgressState === 'active' && !hasActiveJobs) {
      // Jobs just finished - capture stats and show "Recently Completed" for 10 seconds
      setLastCompletedStats({
        completed: queue.completed || 0,
        failed: queue.failed || 0,
        usersImported: users.imported || 0,
        timestamp: new Date()
      });
      setWorkerProgressState('recentlyCompleted');
      
      // Auto-return to idle after 10 seconds (store in ref to prevent cleanup)
      completionTimerRef.current = setTimeout(() => {
        setWorkerProgressState('idle');
        completionTimerRef.current = null;
      }, 10000);
    }
    // If we're in recentlyCompleted or idle, let the timer run (don't clear it)
  }, [queue.active, queue.waiting, queue.completed, queue.failed, users.imported, workerProgressState]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  // Determine current pipeline step - always return a step, even when idle
  const getCurrentStep = () => {
    // If import is in progress, determine based on phase
    if (importInProgress && currentStats) {
      const phase = currentStats.phase;
      if (phase === 'fetching_customers' || phase === 'processing_customers') return 1;
      if (phase === 'enqueuing_jobs') return 2;
      if (phase === 'completed') return 4;
      // Default to step 3 if import is in progress but phase isn't clear
      return 3;
    }
    
    // If jobs are still running (queue has active/waiting), we're in step 3
    if (queue.active > 0 || queue.waiting > 0) return 3;
    
    // If recently completed, show step 4
    if (currentStats && currentStats.phase === 'completed') return 4;
    
    // Default: ready to start (step 0 means idle/ready state)
    return 0;
  };

  const currentStep = getCurrentStep();
  const hasRecentImport = currentStats && currentStats.phase === 'completed';
  const steps = [
    { id: 1, label: 'Fetch Customers', icon: '📥', desc: 'Fetching from Shopify' },
    { id: 2, label: 'Create Users', icon: '👤', desc: 'Creating database records' },
    { id: 3, label: 'Process Jobs', icon: '⚙️', desc: 'Importing orders & classifying' },
    { id: 4, label: 'Complete', icon: '✅', desc: 'All users processed' }
  ];
  
  const totalSteps = 4;

  return (
    <div className="bulk-import-page">
      <div className="bulk-import-header">
        <h2>📦 Bulk Customer Import</h2>
        <p className="bulk-import-subtitle">
          Import Shopify customers and their complete order history
        </p>
      </div>

      {/* SECTION 1: Overall Import Pipeline Status - Always Visible */}
      <div className="pipeline-status-card">
        <h3>📊 Import Pipeline</h3>
        <div className="pipeline-overview">
          <div className="pipeline-header">
            {currentStep === 0 ? (
              <>
                <span className="pipeline-title">Ready to Import</span>
                <span className="pipeline-subtitle">Configure import settings below and click Start</span>
              </>
            ) : currentStep === 4 ? (
              <>
                <span className="pipeline-title">Import Complete</span>
                <span className="pipeline-subtitle">
                  {currentStats ? `${currentStats.customersFetched || 0} customers processed: ${currentStats.usersCreated || 0} new, ${currentStats.usersUpdated || 0} updated` : 'Processing complete'}
                </span>
              </>
            ) : (
              <>
                <span className="pipeline-title">
                  {importInProgress ? `Step ${currentStep} of ${totalSteps}` : 'Processing'}
                </span>
                <span className="pipeline-subtitle">{steps[currentStep - 1].label}</span>
              </>
            )}
          </div>
          
          <div className="pipeline-stepper">
            {steps.map((step) => (
              <div 
                key={step.id}
                className={`pipeline-step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''} ${currentStep < step.id ? 'pending' : ''} ${currentStep === 0 ? 'idle' : ''}`}
              >
                <div className="step-icon">{step.icon}</div>
                <div className="step-content">
                  <div className="step-label">{step.label}</div>
                  <div className="step-desc">{step.desc}</div>
                </div>
                {step.id < 4 && <div className="step-connector"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: Current Step Details - Show when import is active or recently completed */}
      {(importInProgress || hasRecentImport || (queue.active > 0 || queue.waiting > 0)) && currentStep > 0 && (
        <div className="current-step-card">
          <h3>🔍 Current Step: {steps[currentStep - 1].label}</h3>
          
          {currentStep === 1 && currentStats && (
            <div className="step-details">
              <div className="step-main-stat">
                <div className="main-stat-value">{currentStats.customersFetched || 0}</div>
                <div className="main-stat-label">Customers Fetched from Shopify</div>
              </div>
              {batchSize && (
                <div className="step-progress-bar">
                  <div className="progress-bar-wrapper">
                    <div 
                      className="progress-bar-fill"
                      style={{ width: `${Math.min(100, ((currentStats.customersFetched || 0) / parseInt(batchSize)) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {currentStats.customersFetched || 0} of {parseInt(batchSize).toLocaleString()} customers
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && currentStats && (
            <div className="step-details">
              <div className="step-stats-grid">
                <div className="step-stat">
                  <div className="step-stat-value">{currentStats.usersCreated || 0}</div>
                  <div className="step-stat-label">Users Created</div>
                </div>
                <div className="step-stat">
                  <div className="step-stat-value">{currentStats.usersUpdated || 0}</div>
                  <div className="step-stat-label">Users Updated</div>
                </div>
                <div className="step-stat">
                  <div className="step-stat-value">{currentStats.jobsEnqueued || 0}</div>
                  <div className="step-stat-label">Jobs Enqueued</div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-details">
              <div className="step-main-stat">
                <div className="main-stat-value">{queue.active || 0}</div>
                <div className="main-stat-label">Workers Active</div>
              </div>
              <div className="step-progress-bar">
                <div className="progress-bar-wrapper">
                  <div 
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {completedJobs} of {totalJobs} jobs completed ({progressPercent}%)
                </div>
              </div>
              <div className="step-stats-grid">
                <div className="step-stat">
                  <div className="step-stat-value">{queue.waiting || 0}</div>
                  <div className="step-stat-label">Waiting</div>
                </div>
                <div className="step-stat success">
                  <div className="step-stat-value">{queue.completed || 0}</div>
                  <div className="step-stat-label">Completed</div>
                </div>
                <div className="step-stat danger">
                  <div className="step-stat-value">{queue.failed || 0}</div>
                  <div className="step-stat-label">Failed</div>
                </div>
              </div>
              <div className="step-note">
                <small>Each job imports orders and calculates user classification</small>
              </div>
            </div>
          )}

          {currentStep === 4 && currentStats && (
            <div className="step-details">
              <div className="step-complete-message">
                <div className="complete-icon">✅</div>
                <div className="complete-text">
                  <h4>Import Complete!</h4>
                  <p>Successfully processed {currentStats.customersFetched || 0} customers from Shopify</p>
                </div>
              </div>
              <div className="step-stats-grid">
                <div className="step-stat success">
                  <div className="step-stat-value">{currentStats.customersFetched || 0}</div>
                  <div className="step-stat-label">Customers Fetched</div>
                </div>
                <div className="step-stat success">
                  <div className="step-stat-value">{currentStats.usersCreated || 0}</div>
                  <div className="step-stat-label">New Users Created</div>
                </div>
                <div className="step-stat">
                  <div className="step-stat-value">{currentStats.usersUpdated || 0}</div>
                  <div className="step-stat-label">Existing Users Updated</div>
                </div>
                <div className="step-stat success">
                  <div className="step-stat-value">{currentStats.jobsEnqueued || 0}</div>
                  <div className="step-stat-label">Jobs Processed</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Shopify vs Database - Key Metric at Top */}
      {shopifyStats && !shopifyStats.error && (
        <div className="shopify-stats-card">
          <h3>📊 Shopify vs Database</h3>
          <div className="shopify-stats-summary">
            <div className="shopify-stat-main">
              <div className="shopify-stat-box shopify">
                <div className="shopify-stat-value">{shopifyStats.shopify?.totalCustomers?.toLocaleString() || 0}</div>
                <div className="shopify-stat-label">Shopify Customers</div>
              </div>
              <div className="shopify-stat-arrow">→</div>
              <div className="shopify-stat-box database">
                <div className="shopify-stat-value">{shopifyStats.database?.totalUsers?.toLocaleString() || 0}</div>
                <div className="shopify-stat-label">Database Users</div>
              </div>
              <div className="shopify-stat-box gap">
                <div className="shopify-stat-value missing">{shopifyStats.gap?.missingUsers?.toLocaleString() || 0}</div>
                <div className="shopify-stat-label">Missing</div>
              </div>
            </div>
            {shopifyStats.gap?.missingUsers > 0 && (
              <div className="shopify-warning">
                <span className="warning-icon">⚠️</span>
                <span>Only {shopifyStats.gap?.percentageInDb || 0}% of Shopify customers are in the database. Use <strong>Full Import Mode</strong> below to import all missing customers.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: System Status - Low Priority Info */}
      <div className="status-card-compact">
        <h3>🔌 System Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-icon">{statusData?.shopifyApiAvailable ? '🟢' : '🔴'}</span>
            <span className="status-label">Shopify API</span>
          </div>
          <div className="status-item">
            <span className="status-icon">{wsConnected ? '🟢' : '🔴'}</span>
            <span className="status-label">WebSocket</span>
          </div>
          <div className="status-item">
            <span className="status-icon">{importInProgress ? '⏳' : '✅'}</span>
            <span className="status-label">{importInProgress ? 'Importing' : 'Ready'}</span>
          </div>
        </div>
      </div>


      {/* Controls */}
      <div className="controls-card">
        <h3>Import Controls</h3>
        
        <div className="import-options">
          <div className="option-group mode-selector">
            <label className="checkbox-label full-import-toggle">
              <input
                type="checkbox"
                checked={fullImport}
                onChange={(e) => {
                  setFullImport(e.target.checked);
                  if (e.target.checked) {
                    setTargetUnprocessedUsers(''); // Clear intelligent mode when switching to full import
                  } else {
                    setBatchSize(''); // Clear batch size when switching to incremental
                  }
                }}
                disabled={importInProgress}
              />
              <span><strong>Full Import Mode</strong> - Create ALL missing customers from Shopify</span>
            </label>
          </div>

          {fullImport ? (
            <div className="option-group">
              <label className="input-label">
                Batch Size (customers to import per session):
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  className="batch-size-select"
                  disabled={importInProgress}
                >
                  <option value="">All Customers (⚠️ {shopifyStats?.gap?.missingUsers?.toLocaleString() || '?'})</option>
                  <option value="1000">1,000 customers</option>
                  <option value="5000">5,000 customers</option>
                  <option value="10000">10,000 customers</option>
                  <option value="25000">25,000 customers</option>
                  <option value="50000">50,000 customers</option>
                  <option value="100000">100,000 customers</option>
                </select>
              </label>
              <small style={{ color: '#777', marginTop: '4px', display: 'block' }}>
                System will fetch and create users for up to {batchSize || 'ALL'} Shopify customers
              </small>
            </div>
          ) : (
            <div className="option-group">
              <label className="input-label">
                Number of Unprocessed Users to Import (intelligent mode):
                <input
                  type="number"
                  value={targetUnprocessedUsers}
                  onChange={(e) => setTargetUnprocessedUsers(e.target.value)}
                  placeholder="Leave empty to import all unprocessed"
                  className="number-input"
                  disabled={importInProgress}
                  min="1"
                />
              </label>
              <small style={{ color: '#777', marginTop: '4px', display: 'block' }}>
                System will automatically find and import this many users who haven't been imported yet
              </small>
            </div>
          )}

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
              <h3>⚠️ Confirm {fullImport ? 'Full' : 'Incremental'} Import</h3>
            </div>
            <div className="modal-body">
              {fullImport ? (
                <>
                  <p className="modal-main">
                    <strong>Full Import Mode:</strong> This will create user records for {batchSize ? `up to ${parseInt(batchSize).toLocaleString()}` : `ALL ${shopifyStats?.gap?.missingUsers?.toLocaleString() || '?'}`} Shopify customers and import their complete order history.
                  </p>
                  <p className="modal-detail">
                    <strong>Estimated time:</strong> {batchSize ? 
                      `~${Math.ceil(parseInt(batchSize) / 1000)} - ${Math.ceil(parseInt(batchSize) / 500)} minutes` : 
                      shopifyStats?.gap?.missingUsers ? 
                        `~${Math.ceil(shopifyStats.gap.missingUsers / 1000)} - ${Math.ceil(shopifyStats.gap.missingUsers / 100)} hours` : 
                        'Unknown'}
                  </p>
                  <p className="modal-warning">
                    This is a large operation that will run in the background. You can safely close this page during import.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {reimportAll 
                      ? 'This will REIMPORT ALL users, even those already imported. This may take a significant amount of time and will trigger classification jobs for all users.' 
                      : 'This will find and import unprocessed users along with their complete order history.'}
                  </p>
                  {targetUnprocessedUsers && (
                    <p className="modal-detail">
                      <strong>Target:</strong> {targetUnprocessedUsers} unprocessed user{parseInt(targetUnprocessedUsers) !== 1 ? 's' : ''}
                    </p>
                  )}
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
