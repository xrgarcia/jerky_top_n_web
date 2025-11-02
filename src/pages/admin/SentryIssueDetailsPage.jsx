import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSentryIssueDetails, useSentryLatestEvent } from '../../hooks/useAdminTools';
import './AdminPages.css';

function SentryIssueDetailsPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stackTrace');
  const [copySuccess, setCopySuccess] = useState(false);

  const { data: issueData, isLoading: isLoadingIssue, isError: isErrorIssue, error: issueError } = useSentryIssueDetails(issueId);
  const { data: eventData, isLoading: isLoadingEvent, isError: isErrorEvent, error: eventError } = useSentryLatestEvent(issueId);

  const issue = issueData?.issue;
  const rawEvent = eventData?.event;

  // Normalize Sentry API response structure
  const event = rawEvent ? {
    ...rawEvent,
    // Extract exception data from entries
    exception: rawEvent.entries?.find(e => e.type === 'exception')?.data?.values || [],
    // Extract breadcrumbs from entries
    breadcrumbs: rawEvent.entries?.find(e => e.type === 'breadcrumbs')?.data?.values || [],
    // Extract request data from entries
    request: rawEvent.entries?.find(e => e.type === 'request')?.data || null,
    // Normalize contexts (plural) to context for consistency
    context: rawEvent.contexts || {},
    // Tags are already at root level
  } : null;

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

  const handleCopyForAI = async () => {
    if (!issue || !event) return;

    // Format stack trace with proper field names from Sentry API (lineno/colno, abs_path)
    const stackTrace = event.exception?.map(ex => {
      const exceptionHeader = `${ex.type || 'Exception'}: ${ex.value || 'No value'}`;
      const frames = ex.stacktrace?.frames?.map(frame => 
        `  at ${frame.function || 'anonymous'} (${frame.filename || frame.abs_path || frame.module || 'unknown'}:${frame.lineno || '?'}:${frame.colno || '?'})${frame.inApp ? ' [in app]' : ''}`
      ).reverse().join('\n') || '  No frames';
      return `${exceptionHeader}\n${frames}`;
    }).join('\n\n') || 'No stack trace available';

    const breadcrumbs = event.breadcrumbs?.map(bc => 
      `[${bc.timestamp || 'unknown time'}] ${bc.category || 'generic'} (${bc.level || 'info'}): ${bc.message || JSON.stringify(bc.data || {})}`
    ).join('\n') || 'No breadcrumbs available';

    const tags = issue.tags?.map(tag => `${tag.key}: ${tag.value}`).join('\n  ') || 'No tags';

    const context = event.context && Object.keys(event.context).length > 0 
      ? JSON.stringify(event.context, null, 2) 
      : 'No context available';

    const aiAnalysisText = `
=== SENTRY ERROR ANALYSIS REQUEST ===

Issue: ${issue.shortId || issue.id}
Title: ${issue.title}
Status: ${issue.status}
Level: ${issue.level}
Environment: ${event.tags?.find(t => t.key === 'environment')?.value || 'unknown'}

First Seen: ${issue.firstSeen}
Last Seen: ${issue.lastSeen}
Event Count: ${issue.count}
Users Affected: ${issue.userCount}

--- ERROR MESSAGE ---
${event.message || issue.title}

--- CULPRIT ---
${issue.culprit || event.culprit || 'N/A'}

--- STACK TRACE ---
${stackTrace}

--- BREADCRUMBS (Recent Activity) ---
${breadcrumbs}

--- TAGS ---
  ${tags}

--- CONTEXT ---
${context}

--- REQUEST (if applicable) ---
${event.request ? JSON.stringify(event.request, null, 2) : 'No request data'}

--- USER (if available) ---
${rawEvent.user ? JSON.stringify(rawEvent.user, null, 2) : 'No user data'}

--- SDK INFO ---
Platform: ${rawEvent.platform || 'unknown'}
SDK: ${rawEvent.sdk?.name || 'unknown'} ${rawEvent.sdk?.version || ''}

=== END ANALYSIS REQUEST ===

Please analyze this error and suggest:
1. Root cause
2. Potential fixes
3. Why this error occurred
4. How to prevent it in the future
`.trim();

    try {
      await navigator.clipboard.writeText(aiAnalysisText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isLoadingIssue || isLoadingEvent) {
    return (
      <div className="admin-page">
        <div className="loading-state">Loading issue details...</div>
      </div>
    );
  }

  if (isErrorIssue || isErrorEvent) {
    return (
      <div className="admin-page">
        <div className="error-state">
          <p>Failed to load issue details</p>
          <p>{issueError?.message || eventError?.message || 'Unknown error occurred'}</p>
          <button className="btn-primary" onClick={() => navigate('/admin/tools')}>
            Back to Admin Tools
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page sentry-details-page">
      <div className="sentry-details-header">
        <button className="btn-back" onClick={() => navigate('/admin/tools')}>
          ← Back to Issues
        </button>
        
        <div className="sentry-details-actions">
          <button 
            className={`btn-copy-ai ${copySuccess ? 'success' : ''}`}
            onClick={handleCopyForAI}
          >
            📋 {copySuccess ? 'Copied!' : 'Copy for AI Analysis'}
          </button>
          <a 
            href={issue.permalink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-open-sentry"
          >
            Open in Sentry →
          </a>
        </div>
      </div>

      <h1 className="sentry-issue-title">{issue.title}</h1>

      <div className="sentry-metadata-grid">
        <div className="metadata-card">
          <div className="metadata-label">Status</div>
          <div className="metadata-value">
            <span className={`status-badge ${getStatusBadgeClass(issue.status)}`}>
              {issue.status}
            </span>
          </div>
        </div>

        <div className="metadata-card">
          <div className="metadata-label">Level</div>
          <div className="metadata-value">
            <span className={`level-badge ${getLevelBadgeClass(issue.level)}`}>
              {issue.level?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="metadata-card">
          <div className="metadata-label">Events</div>
          <div className="metadata-value">{issue.count}</div>
        </div>

        <div className="metadata-card">
          <div className="metadata-label">Users Affected</div>
          <div className="metadata-value">{issue.userCount}</div>
        </div>

        <div className="metadata-card">
          <div className="metadata-label">First Seen</div>
          <div className="metadata-value">{formatTimeAgo(issue.firstSeen)}</div>
        </div>

        <div className="metadata-card">
          <div className="metadata-label">Last Seen</div>
          <div className="metadata-value">{formatTimeAgo(issue.lastSeen)}</div>
        </div>
      </div>

      <div className="error-message-section">
        <h3>Error Message</h3>
        <div className="error-message-content">
          {event.message || issue.title}
          {issue.culprit && (
            <div className="error-culprit">
              📍 {issue.culprit}
            </div>
          )}
        </div>
      </div>

      <div className="sentry-tabs">
        <div className="tab-headers">
          <button 
            className={`tab-header ${activeTab === 'stackTrace' ? 'active' : ''}`}
            onClick={() => setActiveTab('stackTrace')}
          >
            Stack Trace
          </button>
          <button 
            className={`tab-header ${activeTab === 'breadcrumbs' ? 'active' : ''}`}
            onClick={() => setActiveTab('breadcrumbs')}
          >
            Breadcrumbs
          </button>
          <button 
            className={`tab-header ${activeTab === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveTab('tags')}
          >
            Tags
          </button>
          <button 
            className={`tab-header ${activeTab === 'context' ? 'active' : ''}`}
            onClick={() => setActiveTab('context')}
          >
            Context
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'stackTrace' && (
            <div className="stack-trace-section">
              {event.exception && event.exception.length > 0 ? (
                event.exception.map((ex, exIdx) => (
                  <div key={exIdx} className="exception-block">
                    <h4>{ex.type || 'Exception'}: {ex.value}</h4>
                    {ex.stacktrace?.frames && (
                      <div className="stack-frames">
                        {ex.stacktrace.frames.slice().reverse().map((frame, idx) => (
                          <div key={idx} className={`stack-frame ${frame.inApp ? 'in-app' : ''}`}>
                            <div className="frame-function">{frame.function || 'anonymous'}</div>
                            <div className="frame-location">
                              {frame.filename || frame.abs_path || frame.module || 'unknown'}:{frame.lineno || '?'}:{frame.colno || '?'}
                            </div>
                            {(frame.preContext || frame.contextLine || frame.postContext) && (
                              <div className="frame-context">
                                {frame.preContext?.map((line, i) => (
                                  <div key={`pre-${i}`} className="context-line">{line}</div>
                                ))}
                                {frame.contextLine && (
                                  <div className="context-line highlight">{frame.contextLine}</div>
                                )}
                                {frame.postContext?.map((line, i) => (
                                  <div key={`post-${i}`} className="context-line">{line}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-tab-content">No stack trace available</div>
              )}
            </div>
          )}

          {activeTab === 'breadcrumbs' && (
            <div className="breadcrumbs-section">
              {event.breadcrumbs && event.breadcrumbs.length > 0 ? (
                <div className="breadcrumb-list">
                  {event.breadcrumbs.map((bc, idx) => (
                    <div key={idx} className="breadcrumb-item">
                      <div className="breadcrumb-header">
                        <span className="breadcrumb-category">
                          {bc.category || 'generic'} {bc.level ? `[${bc.level}]` : ''}
                        </span>
                        <span className="breadcrumb-timestamp">{bc.timestamp || 'unknown'}</span>
                      </div>
                      <div className="breadcrumb-message">
                        {bc.message || (bc.data ? JSON.stringify(bc.data, null, 2) : 'No message')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-tab-content">No breadcrumbs available</div>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="tags-section">
              {issue.tags && issue.tags.length > 0 ? (
                <div className="tags-grid">
                  {issue.tags.map((tag, idx) => (
                    <div key={idx} className="tag-item">
                      <span className="tag-key">{tag.key}</span>
                      <span className="tag-value">{tag.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-tab-content">No tags available</div>
              )}
            </div>
          )}

          {activeTab === 'context' && (
            <div className="context-section">
              {event.context && Object.keys(event.context).length > 0 ? (
                <pre className="context-json">
                  {JSON.stringify(event.context, null, 2)}
                </pre>
              ) : (
                <div className="empty-tab-content">No context data available</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SentryIssueDetailsPage;
