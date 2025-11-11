import React, { useCallback } from 'react';
import { useCustomerWebhooks } from '../../hooks/useCustomerWebhooks';
import { useCustomerWebhooksWebSocket } from '../../hooks/useCustomerWebhooksWebSocket';
import { useToast } from '../../context/ToastContext';
import './AdminPages.css';

function CustomerWebhooksPage() {
  const { showToast } = useToast();
  
  const { data: webhooks = [], isLoading, isError, error, refetch } = useCustomerWebhooks(50);

  const handleWebhookUpdate = useCallback((updateData) => {
    console.log('👤 Webhook update received:', updateData);
    
    const action = updateData.topic?.includes('update') ? 'Customer Updated' : 
                   updateData.topic?.includes('create') ? 'Customer Created' : 
                   'Customer Event';
    
    const customerName = updateData.data?.first_name && updateData.data?.last_name
      ? `${updateData.data.first_name} ${updateData.data.last_name}`
      : updateData.data?.email || 'Unknown';
    
    showToast({
      type: 'info',
      icon: '👤',
      title: action,
      message: `${customerName} - ${updateData.topic}`,
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
