import React, { useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useLiveUsers } from '../../hooks/useAdminTools';
import { useQueryClient } from '@tanstack/react-query';
import './AdminPages.css';

function LiveUsersPage() {
  const { socket, isConnected, isSocketAuthenticated } = useSocket();
  const queryClient = useQueryClient();
  
  // Fetch initial data from API
  const { data, isLoading, isError } = useLiveUsers();
  const activeUsers = data?.users || [];
  const userCount = data?.count || 0;

  // Subscribe to WebSocket updates for real-time data
  useEffect(() => {
    if (!socket || !isConnected || !isSocketAuthenticated) return;

    // Subscribe to live users updates
    socket.emit('subscribe:live-users');

    // Listen for live user updates and invalidate the query to refetch
    socket.on('live-users:update', () => {
      queryClient.invalidateQueries({ queryKey: ['liveUsers'] });
    });

    // Cleanup
    return () => {
      socket.emit('unsubscribe:live-users');
      socket.off('live-users:update');
    };
  }, [socket, isConnected, isSocketAuthenticated, queryClient]);

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getPageIcon = (page) => {
    const pageMap = {
      'home': '🏠',
      'rank': '📝',
      'coinbook': '🏆',
      'tools': '🛠️',
      'leaderboard': '📊',
      'profile': '👤'
    };
    return pageMap[page?.toLowerCase()] || '📄';
  };

  const getPageLabel = (page) => {
    if (!page) return 'Unknown';
    return page.charAt(0).toUpperCase() + page.slice(1);
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>👥 Active Users</h2>
        <div className="live-stats">
          <span className="live-count-badge">{userCount} online</span>
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
            {isLoading ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  Loading live users...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan="6" className="empty-state" style={{ color: '#e74c3c' }}>
                  Failed to load live users
                </td>
              </tr>
            ) : activeUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  No users currently online
                </td>
              </tr>
            ) : (
              activeUsers.map((user) => (
                <tr key={user.socketId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{user.firstName} {user.lastName}</span>
                      {user.connectionCount > 1 && (
                        <span className="badge" style={{ fontSize: '11px', padding: '2px 6px' }}>
                          {user.connectionCount} tabs
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{getPageIcon(user.currentPage)}</span>
                      <span>{getPageLabel(user.currentPage)}</span>
                    </span>
                  </td>
                  <td>{formatTimeAgo(user.connectedAt)}</td>
                  <td>{formatTimeAgo(user.lastActivity)}</td>
                  <td>
                    <code style={{ fontSize: '12px', color: '#666' }}>
                      {user.socketId.substring(0, 12)}...
                    </code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LiveUsersPage;
