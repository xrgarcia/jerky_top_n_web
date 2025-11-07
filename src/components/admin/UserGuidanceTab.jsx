import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';
import './UserGuidanceTab.css';

// Admin interface for managing user classifications and personalized guidance
export default function UserGuidanceTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalCount: 0, totalPages: 0 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ journeyStages: [], engagementLevels: [], flavorProfileCommunities: [] });

  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const journeyStage = searchParams.get('journeyStage') || '';
  const engagementLevel = searchParams.get('engagementLevel') || '';
  const flavorProfileCommunity = searchParams.get('flavorProfileCommunity') || '';
  const classified = searchParams.get('classified') || '';

  useEffect(() => {
    fetchFilterOptions();
    fetchUserClassifications();
  }, [page, limit, search, sortBy, sortOrder, journeyStage, engagementLevel, flavorProfileCommunity, classified]);

  const fetchFilterOptions = async () => {
    try {
      const data = await api.get('/admin/user-classifications/filter-options');
      setFilterOptions(data);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  const fetchUserClassifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        sortBy,
        sortOrder,
        ...(journeyStage && { journeyStage }),
        ...(engagementLevel && { engagementLevel }),
        ...(flavorProfileCommunity && { flavorProfileCommunity }),
        ...(classified && { classified })
      });

      const data = await api.get(`/admin/user-classifications?${params}`);
      setUsers(data.users || []);
      setPagination(data.pagination || { page: 1, limit: 20, totalCount: 0, totalPages: 0 });
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

  const handleRecalculate = async () => {
    if (!selectedUser?.user?.id) return;
    
    try {
      setRecalculating(true);
      const data = await api.post(`/admin/user-classifications/${selectedUser.user.id}/recalculate`);
      
      if (data.success) {
        toast.success('Classification recalculated successfully!');
        
        // Refresh the user details
        const updatedData = await api.get(`/admin/user-classifications/${selectedUser.user.id}`);
        setSelectedUser(updatedData);
        
        // Refresh the table data to show updated classification
        await fetchUserClassifications();
      }
    } catch (err) {
      console.error('Failed to recalculate classification:', err);
      toast.error('Failed to recalculate classification');
    } finally {
      setRecalculating(false);
    }
  };

  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    if (updates.page === undefined && !updates.limit) {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  const handleSort = (field) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    updateParams({ sortBy: field, sortOrder: newOrder, page: '1' });
  };

  const handleSearch = (value) => {
    updateParams({ search: value, page: '1' });
  };

  const handleFilterChange = (filterType, value) => {
    updateParams({ [filterType]: value, page: '1' });
  };

  const handlePageChange = (newPage) => {
    updateParams({ page: newPage.toString() });
  };

  const handleLimitChange = (newLimit) => {
    updateParams({ limit: newLimit.toString(), page: '1' });
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="user-guidance-tab">
      <div className="tab-header">
        <h2>User Classifications & Personalized Guidance</h2>
        <p className="tab-description">
          View and manage user classification system that powers personalized guidance
        </p>
      </div>

      <div className="filters-section">
        <div className="user-guidance-search-container">
          <input
            type="text"
            placeholder="Search users by email or name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="user-guidance-search-field"
          />
        </div>

        <div className="filter-controls">
          <select
            value={journeyStage}
            onChange={(e) => handleFilterChange('journeyStage', e.target.value)}
            className="filter-select"
          >
            <option value="">All Journey Stages</option>
            {filterOptions.journeyStages.map(stage => (
              <option key={stage} value={stage}>
                {stage.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </option>
            ))}
          </select>

          <select
            value={engagementLevel}
            onChange={(e) => handleFilterChange('engagementLevel', e.target.value)}
            className="filter-select"
          >
            <option value="">All Engagement Levels</option>
            {filterOptions.engagementLevels.map(level => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={flavorProfileCommunity}
            onChange={(e) => handleFilterChange('flavorProfileCommunity', e.target.value)}
            className="filter-select"
          >
            <option value="">All Flavor Profile Communities</option>
            {filterOptions.flavorProfileCommunities.map(community => (
              <option key={community} value={community}>
                {community}
              </option>
            ))}
          </select>

          <select
            value={classified}
            onChange={(e) => handleFilterChange('classified', e.target.value)}
            className="filter-select"
          >
            <option value="">All Users</option>
            <option value="true">Classified Only</option>
            <option value="false">Not Classified</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading user classifications...</div>
      ) : (
        <>
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('display_name')} className="sortable-header">
                    User {getSortIcon('display_name')}
                  </th>
                  <th onClick={() => handleSort('email')} className="sortable-header">
                    Email {getSortIcon('email')}
                  </th>
                  <th>Journey Stage</th>
                  <th>Engagement</th>
                  <th>Exploration</th>
                  <th>Flavor Profile</th>
                  <th onClick={() => handleSort('ranked_count')} className="sortable-header">
                    Ranked Count {getSortIcon('ranked_count')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
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
                    {user.classification?.flavorProfileCommunity || 
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

            {users.length === 0 && (
              <div className="empty-state">
                {search ? 'No users match your search' : 'No users found'}
              </div>
            )}
          </div>

          {pagination.totalCount > 0 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.totalCount)} of {pagination.totalCount} users
              </div>

              <div className="pagination-buttons">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!pagination.hasPrev}
                  className="pagination-btn"
                >
                  Previous
                </button>

                <span className="page-indicator">
                  Page {page} of {pagination.totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!pagination.hasNext}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>

              <div className="page-size-selector">
                <label>Per page:</label>
                <select
                  value={limit}
                  onChange={(e) => handleLimitChange(e.target.value)}
                  className="page-size-select"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          )}
        </>
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
                <h5>Current Classification</h5>
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
                      <label>Flavor Profile Community:</label>
                      <span>{selectedUser.classification.flavorProfileCommunity || 'None'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="not-classified-message">
                    <span className="badge badge-unclassified">Not Classified</span>
                    <p>This user has not been classified yet. Users are classified after they demonstrate activity patterns through rankings, searches, and product interactions.</p>
                  </div>
                )}
              </div>

              <div className="calculation-section-divider">
                <h5 className="section-title">How Classifications Are Calculated</h5>
              </div>

              <div className="journey-stage-calculation-info">
                <h5>Journey Stage Calculation</h5>
                <div className="calculation-details">
                  <div className="dual-inputs">
                    <div className="stat-item highlight">
                      <label>Total Rankings (Lifetime):</label>
                      <span className="activity-count">{selectedUser.stats?.totalRankings || 0}</span>
                    </div>
                    <div className="stat-item highlight">
                      <label>Activities (Last 30 Days):</label>
                      <span className="activity-count">{selectedUser.activities?.activities30d || 0}</span>
                    </div>
                  </div>
                  <div className="threshold-guide">
                    <p className="guide-intro">Journey stage is based on lifetime rankings AND recent activity (checked in priority order):</p>
                    <ul className="threshold-list">
                      <li><strong>Dormant:</strong> 30+ days since last activity</li>
                      <li><strong>New User:</strong> 0 rankings, registered within 7 days</li>
                      <li><strong>Power User:</strong> 31+ rankings AND 20+ activities (30 days)</li>
                      <li><strong>Engaged:</strong> 11-30 rankings AND 5+ activities (30 days)</li>
                      <li><strong>Exploring:</strong> 1-10 rankings AND 1+ activities (30 days)</li>
                    </ul>
                    <p className="guide-note">
                      <em>Journey stage requires BOTH criteria to be met. If a user has rankings but low recent activity, they may be classified as Dormant.</em>
                    </p>
                  </div>
                </div>
              </div>

              <div className="engagement-calculation-info">
                <h5>Engagement Level Calculation</h5>
                <div className="calculation-details">
                  <div className="stat-item highlight">
                    <label>Activities (Last 30 Days):</label>
                    <span className="activity-count">{selectedUser.activities?.activities30d || 0}</span>
                  </div>
                  <div className="threshold-guide">
                    <p className="guide-intro">Engagement level is based on total user activities in the last 30 days:</p>
                    <ul className="threshold-list">
                      <li><strong>Very High:</strong> 50+ activities</li>
                      <li><strong>High:</strong> 20-49 activities</li>
                      <li><strong>Medium:</strong> 5-19 activities</li>
                      <li><strong>Low:</strong> 1-4 activities</li>
                      <li><strong>None:</strong> 0 activities</li>
                    </ul>
                    <p className="guide-note">
                      <em>Activities include: page views, rankings saved, searches, logins, product views, and profile views.</em>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flavor-community-calculation-info">
                <h5>Flavor Profile Community Assignment</h5>
                <div className="calculation-details">
                  <div className="stat-item highlight">
                    <label>Dominant Community:</label>
                    <span className="activity-count">{selectedUser.classification?.flavorProfileCommunity || 'None'}</span>
                  </div>
                  <div className="threshold-guide">
                    <p className="guide-intro">Users are assigned to flavor profile communities based on their interaction level with each flavor (Teriyaki, BBQ, Sweet, Spicy, Savory). The dominant community is the flavor where they're most engaged:</p>
                    <ul className="threshold-list">
                      <li><strong>Curious:</strong> Searched or viewed products with this flavor but hasn't purchased</li>
                      <li><strong>Seeker:</strong> Purchased products with this flavor (delivery pending)</li>
                      <li><strong>Taster:</strong> Received and tried products with this flavor (not yet ranked)</li>
                      <li><strong>Enthusiast:</strong> Ranked products with this flavor highly (top 40% of their rankings)</li>
                      <li><strong>Explorer:</strong> Ranked products with this flavor (bottom 40% of their rankings)</li>
                    </ul>
                    <p className="guide-note">
                      <em>Users progress through states (Curious → Seeker → Taster → Enthusiast/Explorer) as they interact more deeply with each flavor profile. A user can be in different states for different flavors simultaneously.</em>
                    </p>
                  </div>
                </div>
              </div>

              {selectedUser.activities && (
                <div className="activity-summary">
                  <h5>Activity Breakdown</h5>
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
              <button 
                onClick={handleRecalculate} 
                disabled={recalculating}
                className="btn-recalculate"
              >
                {recalculating ? 'Recalculating...' : 'Recalculate Classification'}
              </button>
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
