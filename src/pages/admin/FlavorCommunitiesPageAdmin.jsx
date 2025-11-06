import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';
import './CoinTypesPageAdmin.css';

function FlavorCommunitiesPageAdmin() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  // Fetch flavor community configuration
  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'flavor-communities-config'],
    queryFn: async () => {
      const response = await api.get('/flavor-communities/config');
      return response.config || {};
    }
  });

  // Update flavor community configuration
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await api.post('/flavor-communities/config', data);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries(['admin', 'flavor-communities-config']);
      toast.success(response.message || 'Configuration updated successfully!');
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update configuration');
    }
  });

  const handleEdit = () => {
    setIsEditing(true);
    setFormData({
      enthusiast_top_pct: config.enthusiast_top_pct || 40,
      explorer_bottom_pct: config.explorer_bottom_pct || 40,
      min_products_for_state: config.min_products_for_state || 3,
      delivered_status: config.delivered_status || 'delivered'
    });
  };

  const handleSave = () => {
    // Validate percentages
    const topPct = parseFloat(formData.enthusiast_top_pct);
    const bottomPct = parseFloat(formData.explorer_bottom_pct);
    const minProducts = parseInt(formData.min_products_for_state);

    if (topPct < 0 || topPct > 100) {
      toast.error('Enthusiast percentage must be between 0 and 100');
      return;
    }

    if (bottomPct < 0 || bottomPct > 100) {
      toast.error('Explorer percentage must be between 0 and 100');
      return;
    }

    if (topPct + bottomPct > 100) {
      toast.error('Combined percentages cannot exceed 100%');
      return;
    }

    if (minProducts < 1) {
      toast.error('Minimum products must be at least 1');
      return;
    }

    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  if (isLoading || !config) {
    return <div className="coin-types-admin loading">Loading flavor communities configuration...</div>;
  }

  const moderatePct = 100 - (config.enthusiast_top_pct || 40) - (config.explorer_bottom_pct || 40);

  return (
    <div className="coin-types-admin">
      <div className="page-header">
        <h2>🌶️ Flavor Communities Configuration</h2>
        <p>Manage thresholds for flavor profile micro-community lifecycle states</p>
      </div>

      <div className="config-info-card">
        <h3>Current Configuration</h3>
        
        <div className="config-section">
          <h4>Lifecycle State Thresholds</h4>
          <div className="config-grid">
            <div className="config-item">
              <label>Enthusiast (Top %)</label>
              <div className="config-value">
                {config.enthusiast_top_pct || 40}%
                <span className="config-help">Users who rank flavors in the top positions</span>
              </div>
            </div>

            <div className="config-item">
              <label>Moderate (Middle %)</label>
              <div className="config-value">
                {moderatePct}%
                <span className="config-help">Auto-calculated: 100% - enthusiast% - explorer%</span>
              </div>
            </div>

            <div className="config-item">
              <label>Explorer (Bottom %)</label>
              <div className="config-value">
                {config.explorer_bottom_pct || 40}%
                <span className="config-help">Users exploring different flavor options</span>
              </div>
            </div>

            <div className="config-item">
              <label>Minimum Products for State</label>
              <div className="config-value">
                {config.min_products_for_state || 3}
                <span className="config-help">Products required to transition from "taster" to ranking-based states</span>
              </div>
            </div>

            <div className="config-item">
              <label>Delivered Status</label>
              <div className="config-value">
                <code>{config.delivered_status || 'delivered'}</code>
                <span className="config-help">Fulfillment status considered as "delivered"</span>
              </div>
            </div>
          </div>
        </div>

        <div className="config-section">
          <h4>Lifecycle States Explained</h4>
          <ul className="lifecycle-states">
            <li><strong>Curious 🤔</strong> - No products with this flavor purchased yet</li>
            <li><strong>Seeker 🔍</strong> - Purchased products but not yet delivered</li>
            <li><strong>Taster 👅</strong> - Delivered products but fewer than {config.min_products_for_state || 3} ranked</li>
            <li><strong>Enthusiast 🌟</strong> - Ranked {config.min_products_for_state || 3}+ products with high average position (top {config.enthusiast_top_pct || 40}%)</li>
            <li><strong>Explorer 🧭</strong> - Ranked {config.min_products_for_state || 3}+ products, exploring different options (positive framing)</li>
          </ul>
        </div>

        <div className="config-actions">
          <button className="edit-btn" onClick={handleEdit}>
            ✏️ Edit Configuration
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Flavor Communities Configuration</h3>
              <button className="close-btn" onClick={handleCancel}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Enthusiast Top % *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={formData.enthusiast_top_pct || ''}
                  onChange={(e) => setFormData({...formData, enthusiast_top_pct: parseFloat(e.target.value)})}
                  placeholder="40"
                />
                <small>Percentage of users with highest average ranking positions (top rankers)</small>
              </div>

              <div className="form-group">
                <label>Explorer Bottom % *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={formData.explorer_bottom_pct || ''}
                  onChange={(e) => setFormData({...formData, explorer_bottom_pct: parseFloat(e.target.value)})}
                  placeholder="40"
                />
                <small>Percentage of users exploring different options (positive framing)</small>
              </div>

              <div className="form-group">
                <label>Moderate % (Auto-calculated)</label>
                <input
                  type="text"
                  value={100 - (parseFloat(formData.enthusiast_top_pct) || 0) - (parseFloat(formData.explorer_bottom_pct) || 0)}
                  disabled
                />
                <small>Automatically calculated as the middle range</small>
              </div>

              <div className="form-group">
                <label>Minimum Products for State *</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={formData.min_products_for_state || ''}
                  onChange={(e) => setFormData({...formData, min_products_for_state: parseInt(e.target.value)})}
                  placeholder="3"
                />
                <small>How many products must be ranked to transition from "taster" to ranking-based states</small>
              </div>

              <div className="form-group">
                <label>Delivered Status *</label>
                <input
                  type="text"
                  value={formData.delivered_status || ''}
                  onChange={(e) => setFormData({...formData, delivered_status: e.target.value})}
                  placeholder="delivered"
                />
                <small>Shopify fulfillment status considered as "delivered" (e.g., "delivered", "fulfilled")</small>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlavorCommunitiesPageAdmin;
