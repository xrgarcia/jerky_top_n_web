import React, { useCallback, useState } from 'react';
import { useCustomerWebhooks } from '../../hooks/useCustomerWebhooks';
import { useCustomerWebhooksWebSocket } from '../../hooks/useCustomerWebhooksWebSocket';
import { useToast } from '../../context/ToastContext';
import './AdminPages.css';

function CustomerWebhooksPage() {
  const { showToast } = useToast();
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  
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
        <div className="modal-overlay" onClick={() => setSelectedWebhook(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Webhook Details</h3>
              <button className="modal-close-btn" onClick={() => setSelectedWebhook(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <pre style={{
                background: '#f5f5f5',
                padding: '16px',
                borderRadius: '8px',
                overflow: 'auto',
                maxHeight: '60vh',
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                {JSON.stringify(selectedWebhook, null, 2)}
              </pre>
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
