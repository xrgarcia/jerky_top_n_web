import React, { useCallback, useState } from 'react';
import { useCustomerWebhooks } from '../../hooks/useCustomerWebhooks';
import { useCustomerWebhooksWebSocket } from '../../hooks/useCustomerWebhooksWebSocket';
import { useToast } from '../../context/ToastContext';
import './AdminPages.css';

function CustomerWebhooksPage() {
  const { showToast } = useToast();
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  
  const { data: webhooks = [], isLoading, isError, error, refetch } = useCustomerWebhooks(50);

  const handleWebhookUpdate = useCallback((updateData) => {
    console.log('👤 Webhook update received:', updateData);
    
    // Unwrap nested structure from WebSocket broadcast
    const topic = updateData.data?.topic || updateData.topic;
    const customerData = updateData.data?.data || updateData.data || {};
    
    const action = topic?.includes('update') ? 'Customer Updated' : 
                   topic?.includes('create') ? 'Customer Created' : 
                   'Customer Event';
    
    const customerName = customerData.first_name && customerData.last_name
      ? `${customerData.first_name} ${customerData.last_name}`
      : customerData.email || 'Unknown';
    
    showToast({
      type: 'info',
      icon: '👤',
      title: action,
      message: `${customerName} - ${topic}`,
      duration: 4000
    });
    
    refetch();
  }, [showToast, refetch]);

  useCustomerWebhooksWebSocket({
    onWebhookUpdate: handleWebhookUpdate
  });

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return timestamp;
    }
  };

  const getCustomerName = (webhook) => {
    const data = webhook.data?.data || webhook.data;
    if (data?.first_name && data?.last_name) {
      return `${data.first_name} ${data.last_name}`;
    }
    return 'N/A';
  };

  const getCustomerEmail = (webhook) => {
    const data = webhook.data?.data || webhook.data;
    return data?.email || 'N/A';
  };

  const getWebhookAction = (topic) => {
    if (topic?.includes('update')) return 'Update';
    if (topic?.includes('create')) return 'Create';
    if (topic?.includes('delete')) return 'Delete';
    return 'Unknown';
  };

  const getActionBadgeClass = (action) => {
    switch(action?.toLowerCase()) {
      case 'update': return 'status-badge partial';
      case 'create': return 'status-badge fulfilled';
      case 'delete': return 'status-badge unfulfilled';
      default: return 'status-badge';
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>👤 Customer Webhooks</h2>
        {webhooks && (
          <span className="count-badge">{webhooks.length} recent webhooks</span>
        )}
      </div>

      <div className="info-card" style={{ marginBottom: '20px' }}>
        <p>
          Real-time monitoring of Shopify customer webhook events. 
          This shows the most recent customer create/update events received from Shopify.
        </p>
      </div>

      {selectedWebhook && (
        <div className="modal-overlay" onClick={() => {
          setSelectedWebhook(null);
          setActiveTab('summary');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Webhook Details</h3>
              <button className="modal-close-btn" onClick={() => {
                setSelectedWebhook(null);
                setActiveTab('summary');
              }}>
                ×
              </button>
            </div>
            
            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '0 24px',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <button
                onClick={() => setActiveTab('summary')}
                style={{
                  padding: '12px 20px',
                  background: activeTab === 'summary' ? 'white' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'summary' ? '2px solid #7b8b52' : '2px solid transparent',
                  color: activeTab === 'summary' ? '#7b8b52' : '#666',
                  fontWeight: activeTab === 'summary' ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                📋 Summary
              </button>
              <button
                onClick={() => setActiveTab('full')}
                style={{
                  padding: '12px 20px',
                  background: activeTab === 'full' ? 'white' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'full' ? '2px solid #7b8b52' : '2px solid transparent',
                  color: activeTab === 'full' ? '#7b8b52' : '#666',
                  fontWeight: activeTab === 'full' ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                🔍 Full Payload
              </button>
            </div>

            <div className="modal-body">
              {activeTab === 'summary' ? (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#2c2c2c',
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Customer Information
                    </h4>
                    <div style={{
                      background: '#f9f9f9',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '16px'
                    }}>
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Email:</strong>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>
                          {selectedWebhook.data?.data?.email || 'N/A'}
                        </div>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Name:</strong>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>
                          {getCustomerName(selectedWebhook)}
                        </div>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Customer ID:</strong>
                        <div style={{ fontSize: '14px', marginTop: '4px', fontFamily: 'monospace' }}>
                          {selectedWebhook.data?.data?.id || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Topic:</strong>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>
                          {selectedWebhook.data?.topic || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#2c2c2c',
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Processing Details
                    </h4>
                    <div style={{
                      background: '#f9f9f9',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '16px'
                    }}>
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Job ID:</strong>
                        <div style={{ fontSize: '14px', marginTop: '4px', fontFamily: 'monospace' }}>
                          {selectedWebhook.id}
                        </div>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Status:</strong>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>
                          <span className={selectedWebhook.state === 'completed' ? 'status-badge fulfilled' : 'status-badge unfulfilled'}>
                            {selectedWebhook.state}
                          </span>
                        </div>
                      </div>
                      <div>
                        <strong style={{ color: '#666', fontSize: '13px' }}>Processed At:</strong>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>
                          {formatTimestamp(selectedWebhook.timestamp)}
                        </div>
                      </div>
                      {selectedWebhook.returnValue && (
                        <div style={{ marginTop: '12px' }}>
                          <strong style={{ color: '#666', fontSize: '13px' }}>Result:</strong>
                          <pre style={{
                            background: '#fff',
                            padding: '12px',
                            borderRadius: '6px',
                            marginTop: '4px',
                            fontSize: '12px',
                            lineHeight: '1.4',
                            overflow: 'auto',
                            maxHeight: '200px',
                            border: '1px solid #e0e0e0'
                          }}>
                            {JSON.stringify(selectedWebhook.returnValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ 
                    fontSize: '13px', 
                    color: '#666', 
                    marginBottom: '12px',
                    fontStyle: 'italic'
                  }}>
                    Complete BullMQ job data including all Shopify webhook payload fields
                  </p>
                  <pre style={{
                    background: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '8px',
                    overflow: 'auto',
                    maxHeight: '60vh',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    border: '1px solid #e0e0e0'
                  }}>
                    {JSON.stringify(selectedWebhook, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading-state">
          <p>Loading webhooks...</p>
        </div>
      ) : isError ? (
        <div className="error-state">
          <p>⚠️ Error loading webhooks: {error?.message}</p>
          <button className="btn-primary" onClick={() => refetch()}>Retry</button>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="empty-state">
          <p>No recent customer webhooks found.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Customer Email</th>
                <th>Customer Name</th>
                <th>Topic</th>
                <th>Job ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((webhook) => {
                const action = getWebhookAction(webhook.data?.topic);
                return (
                  <tr key={webhook.id}>
                    <td className="order-date">
                      {formatTimestamp(webhook.timestamp)}
                    </td>
                    <td>
                      <span className={getActionBadgeClass(action)}>
                        {action}
                      </span>
                    </td>
                    <td className="customer-email">
                      {getCustomerEmail(webhook)}
                    </td>
                    <td className="customer-name">
                      {getCustomerName(webhook)}
                    </td>
                    <td className="webhook-topic">
                      {webhook.data?.topic || 'N/A'}
                    </td>
                    <td className="job-id" style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                      {webhook.id}
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        onClick={() => setSelectedWebhook(webhook)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CustomerWebhooksPage;
