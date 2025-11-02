import React, { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import './AdminPages.css';

function LiveUsersPage() {
  const { socket, isConnected } = useSocket();
  const [activeUsers, setActiveUsers] = useState([]);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Subscribe to live users updates
    socket.emit('subscribe:live-users');

    // Listen for live user updates
    socket.on('live-users:update', (data) => {
      setActiveUsers(data.users || []);
      setUserCount(data.count || 0);
    });

    // Cleanup
    return () => {
      socket.emit('unsubscribe:live-users');
      socket.off('live-users:update');
    };
  }, [socket, isConnected]);

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
            {activeUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  {isConnected ? 'No users currently online' : 'Connecting to live feed...'}
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
