import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import './QueueMonitorPage.css';

function QueueMonitorPage() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch queue stats with auto-refresh
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['queueStats'],
    queryFn: async () => {
      const res = await fetch('/api/tools/classification-queue/stats', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch queue stats');
      return res.json();
    },
    refetchInterval: autoRefresh ? 3000 : false, // Auto-refresh every 3 seconds
  });

  // Manual enqueue mutation
  const enqueueMutation = useMutation({
    mutationFn: async (userId) => {
      const res = await fetch(`/api/tools/classification-queue/enqueue/${userId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to enqueue job');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['queueStats']);
      setSelectedUserId('');
      alert(data.message || 'Job enqueued successfully');
    }
  });

  // Clean queue mutation
  const cleanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tools/classification-queue/clean', {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to clean queue');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['queueStats']);
      alert('Queue cleaned successfully');
    }
  });

  const stats = statsData?.stats || {};
  const timestamp = statsData?.timestamp;

  const handleEnqueue = (e) => {
    e.preventDefault();
    if (!selectedUserId || isNaN(selectedUserId)) {
      alert('Please enter a valid user ID');
      return;
    }
    enqueueMutation.mutate(parseInt(selectedUserId));
  };

  return (
    <div className="queue-monitor-page">
      <div className="queue-monitor-header">
        <h2>🔄 Classification Queue Monitor</h2>
        <p className="queue-monitor-subtitle">
          Real-time monitoring of background classification jobs
        </p>
      </div>

      <div className="queue-controls">
        <label className="auto-refresh-toggle">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span>Auto-refresh (3s)</span>
        </label>
        {timestamp && (
          <span className="last-updated">
            Last updated: {new Date(timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="queue-loading">Loading queue statistics...</div>
      ) : (
        <>
          <div className="queue-stats-grid">
            <div className="queue-stat-card waiting">
              <div className="stat-icon">⏳</div>
              <div className="stat-content">
                <div className="stat-value">{stats.waiting || 0}</div>
                <div className="stat-label">Waiting</div>
              </div>
            </div>

            <div className="queue-stat-card active">
              <div className="stat-icon">⚡</div>
              <div className="stat-content">
                <div className="stat-value">{stats.active || 0}</div>
                <div className="stat-label">Active</div>
              </div>
            </div>

            <div className="queue-stat-card completed">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <div className="stat-value">{stats.completed || 0}</div>
                <div className="stat-label">Completed</div>
              </div>
            </div>

            <div className="queue-stat-card failed">
              <div className="stat-icon">❌</div>
              <div className="stat-content">
                <div className="stat-value">{stats.failed || 0}</div>
                <div className="stat-label">Failed</div>
              </div>
            </div>

            <div className="queue-stat-card delayed">
              <div className="stat-icon">⏰</div>
              <div className="stat-content">
                <div className="stat-value">{stats.delayed || 0}</div>
                <div className="stat-label">Delayed</div>
              </div>
            </div>
          </div>

          <div className="queue-actions-section">
            <div className="action-card">
              <h3>📋 Manual Trigger</h3>
              <p>Queue a classification job for a specific user</p>
              <form onSubmit={handleEnqueue} className="enqueue-form">
                <input
                  type="number"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  placeholder="Enter User ID"
                  className="user-id-input"
                  disabled={enqueueMutation.isPending}
                />
                <button
                  type="submit"
                  className="btn-enqueue"
                  disabled={enqueueMutation.isPending}
                >
                  {enqueueMutation.isPending ? 'Enqueueing...' : 'Enqueue Job'}
                </button>
              </form>
            </div>

            <div className="action-card">
              <h3>🧹 Queue Maintenance</h3>
              <p>Remove completed and failed jobs from the queue</p>
              <button
                onClick={() => cleanMutation.mutate()}
                className="btn-clean"
                disabled={cleanMutation.isPending}
              >
                {cleanMutation.isPending ? 'Cleaning...' : 'Clean Queue'}
              </button>
            </div>
          </div>

          <div className="queue-info-section">
            <h3>ℹ️ How It Works</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Waiting:</strong> Jobs queued but not yet processing
              </div>
              <div className="info-item">
                <strong>Active:</strong> Jobs currently being processed by workers
              </div>
              <div className="info-item">
                <strong>Completed:</strong> Successfully finished jobs
              </div>
              <div className="info-item">
                <strong>Failed:</strong> Jobs that encountered errors
              </div>
              <div className="info-item">
                <strong>Delayed:</strong> Jobs waiting for retry (after failure)
              </div>
            </div>

            <div className="trigger-info">
              <h4>🔔 Automatic Triggers</h4>
              <ul>
                <li>User creates or updates a ranking</li>
                <li>User searches for products or profiles</li>
                <li>User views any page (tracked via WebSocket)</li>
                <li>User makes a purchase (Shopify webhook)</li>
              </ul>
            </div>

            <div className="debounce-info">
              <h4>⚙️ Smart Debouncing</h4>
              <p>
                First activity triggers immediate classification. Subsequent activities 
                are throttled to max 1 job per 5 minutes per user to prevent queue flooding.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default QueueMonitorPage;
