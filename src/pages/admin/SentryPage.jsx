import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSentryIssues, useSentryEnvironments, useSentryCurrentEnvironment } from '../../hooks/useAdminTools';
import './AdminPages.css';

function SentryPage() {
  const navigate = useNavigate();
  const { data: currentEnvData } = useSentryCurrentEnvironment();
  const defaultEnv = currentEnvData?.environment || 'production';

  const [appliedFilters, setAppliedFilters] = useState({
    environment: defaultEnv,
    status: 'unresolved',
    limit: 25
  });

  const [draftFilters, setDraftFilters] = useState({
    environment: defaultEnv,
    status: 'unresolved',
    limit: 25
  });

  const { data: envData } = useSentryEnvironments();
  const { data, isLoading, isError, error, refetch } = useSentryIssues(appliedFilters);

  useEffect(() => {
    if (defaultEnv && appliedFilters.environment !== defaultEnv) {
      setAppliedFilters(prev => ({ ...prev, environment: defaultEnv }));
      setDraftFilters(prev => ({ ...prev, environment: defaultEnv }));
    }
  }, [defaultEnv]);

  const issues = data?.issues || [];
  const environments = envData?.environments || [];

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '-';
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getLevelBadgeClass = (level) => {
    const levelMap = {
      'error': 'level-badge-error',
      'warning': 'level-badge-warning',
      'info': 'level-badge-info',
      'debug': 'level-badge-debug'
    };
    return levelMap[level?.toLowerCase()] || 'level-badge-error';
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'unresolved': 'status-badge-unresolved',
      'resolved': 'status-badge-resolved',
      'resolved_in_release': 'status-badge-resolved',
      'auto_resolved': 'status-badge-resolved',
      'ignored': 'status-badge-ignored'
    };
    return statusMap[status?.toLowerCase()] || 'status-badge-unresolved';
  };

  const getStatusLabel = (status) => {
    const labelMap = {
      'unresolved': 'unresolved',
      'resolved': 'resolved',
      'resolved_in_release': 'resolved',
      'auto_resolved': 'resolved',
      'ignored': 'ignored'
    };
    return labelMap[status?.toLowerCase()] || status?.toLowerCase() || 'unresolved';
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>🔍 Sentry Error Monitoring</h2>
        <div className="count-badge">
          {isLoading ? 'Loading...' : `${issues.length} issue${issues.length !== 1 ? 's' : ''} found`}
        </div>
      </div>

      <div className="sentry-filters">
        <div className="filter-group">
          <label>Environment:</label>
          <select 
            className="filter-select"
            value={draftFilters.environment}
            onChange={(e) => setDraftFilters({ ...draftFilters, environment: e.target.value })}
          >
            <option value="all">All Environments</option>
            <option value="production">PRODUCTION</option>
            {environments.map(env => (
              env !== 'production' && (
                <option key={env} value={env}>{env.toUpperCase()}</option>
              )
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select 
            className="filter-select"
            value={draftFilters.status}
            onChange={(e) => setDraftFilters({ ...draftFilters, status: e.target.value })}
          >
            <option value="all">All</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>

        <button className="btn-apply-filters" onClick={handleApplyFilters}>
          Apply Filters
        </button>

        <button className="btn-refresh-sentry" onClick={handleRefresh}>
          🔄 Refresh
        </button>
      </div>

      {isError && (
        <div className="error-state">
          <p>Failed to load Sentry issues</p>
          <p>{error?.message || 'Unknown error occurred'}</p>
          <button className="btn-primary" onClick={handleRefresh}>Try Again</button>
        </div>
      )}

      {!isError && (
        <div className="admin-table-container">
          <table className="admin-table sentry-table">
            <thead>
              <tr>
                <th>LEVEL</th>
                <th>ISSUE</th>
                <th>ENVIRONMENT</th>
                <th>COUNT</th>
                <th>USERS</th>
                <th>FIRST SEEN</th>
                <th>LAST SEEN</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="empty-state">
                    Loading Sentry issues...
                  </td>
                </tr>
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-state">
                    No Sentry issues found for the selected filters
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr 
                    key={issue.id} 
                    className="clickable-row"
                    onClick={() => navigate(`/admin/tools/sentry/${issue.id}`)}
                  >
                    <td>
                      <span className={`level-badge ${getLevelBadgeClass(issue.level)}`}>
                        {issue.level?.toUpperCase() || 'ERROR'}
                      </span>
                    </td>
                    <td className="issue-cell">
                      <div className="issue-title">{issue.title}</div>
                      {issue.culprit && (
                        <div className="issue-culprit">{issue.culprit}</div>
                      )}
                      <div className="issue-type">Error</div>
                    </td>
                    <td>
                      <span className="env-badge">
                        {issue.environment?.toUpperCase() || 'PRODUCTION'}
                      </span>
                    </td>
                    <td className="count-cell">{issue.count || 0}</td>
                    <td className="count-cell">{issue.userCount || 0}</td>
                    <td className="time-cell">{formatTimeAgo(issue.firstSeen)}</td>
                    <td className="time-cell">{formatTimeAgo(issue.lastSeen)}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(issue.status)}`}>
                        {getStatusLabel(issue.status)}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <a 
                        href={issue.permalink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-view-details"
                      >
                        Sentry →
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SentryPage;
