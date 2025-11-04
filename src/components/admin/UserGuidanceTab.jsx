import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';
import './UserGuidanceTab.css';

export default function UserGuidanceTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchUserClassifications();
  }, []);

  const fetchUserClassifications = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/user-classifications');
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch user classifications:', err);
      toast.error('Failed to load user classifications');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (userId) => {
    try {
      const data = await api.get(`/admin/user-classifications/${userId}`);
      setSelectedUser(data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      toast.error('Failed to load user details');
    }
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="user-guidance-tab">
      <div className="tab-header">
        <h2>User Classifications & Personalized Guidance</h2>
        <p className="tab-description">
          View and manage user classification system that powers personalized guidance
        </p>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search users by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading user classifications...</div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Journey Stage</th>
                <th>Engagement</th>
                <th>Exploration</th>
                <th>Taste Community</th>
                <th>Ranked Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.displayName || 'Unknown'}</td>
                  <td className="email-cell">{user.email}</td>
                  <td>
                    {user.classification ? (
                      <span className={`badge badge-journey badge-${user.classification.journeyStage}`}>
                        {user.classification.journeyStage.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="badge badge-unclassified">Not Classified</span>
                    )}
                  </td>
                  <td>
                    {user.classification ? (
                      <span className={`badge badge-engagement badge-${user.classification.engagementLevel}`}>
                        {user.classification.engagementLevel.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {user.classification ? (
                      <span className="badge badge-exploration">
                        {user.classification.explorationBreadth}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {user.classification?.tasteCommunity || 
                      <span className="text-muted">None</span>}
                  </td>
                  <td className="text-center">{user.rankedCount}</td>
                  <td>
                    <button
                      onClick={() => handleViewDetails(user.id)}
                      className="btn-view-details"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="empty-state">
              {searchQuery ? 'No users match your search' : 'No users found'}
            </div>
          )}
        </div>
      )}

      {showDetailModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>User Classification Details</h3>
              <button onClick={() => setShowDetailModal(false)} className="modal-close">×</button>
            </div>

            <div className="modal-body">
              <div className="user-info">
                <h4>{selectedUser.user.displayName}</h4>
                <p className="user-email">{selectedUser.user.email}</p>
              </div>

              <div className="classification-details">
                <h5>Classification</h5>
                {selectedUser.classification ? (
                  <div className="classification-grid">
                    <div className="classification-item">
                      <label>Journey Stage:</label>
                      <span className={`badge badge-journey badge-${selectedUser.classification.journeyStage}`}>
                        {selectedUser.classification.journeyStage.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="classification-item">
                      <label>Engagement Level:</label>
                      <span className={`badge badge-engagement badge-${selectedUser.classification.engagementLevel}`}>
                        {selectedUser.classification.engagementLevel.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="classification-item">
                      <label>Exploration Breadth:</label>
                      <span className="badge badge-exploration">
                        {selectedUser.classification.explorationBreadth}
                      </span>
                    </div>
                    <div className="classification-item">
                      <label>Taste Community:</label>
                      <span>{selectedUser.classification.tasteCommunity || 'None'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="not-classified-message">
                    <span className="badge badge-unclassified">Not Classified</span>
                    <p>This user has not been classified yet. Users are classified after they demonstrate activity patterns through rankings, searches, and product interactions.</p>
                  </div>
                )}
              </div>

              {selectedUser.activities && (
                <div className="activity-summary">
                  <h5>Activity Summary</h5>
                  <div className="activity-stats">
                    <div className="stat-item">
                      <label>Total Searches:</label>
                      <span>{selectedUser.activities.totalSearches || 0}</span>
                    </div>
                    <div className="stat-item">
                      <label>Product Views:</label>
                      <span>{selectedUser.activities.totalProductViews || 0}</span>
                    </div>
                    <div className="stat-item">
                      <label>Profile Views:</label>
                      <span>{selectedUser.activities.totalProfileViews || 0}</span>
                    </div>
                    <div className="stat-item">
                      <label>Last Login:</label>
                      <span>{selectedUser.activities.lastLogin ? 
                        new Date(selectedUser.activities.lastLogin).toLocaleDateString() : 
                        'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowDetailModal(false)} className="btn-close-modal">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
