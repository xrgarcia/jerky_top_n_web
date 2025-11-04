import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';
import './CoinTypesPageAdmin.css';

function CoinTypesPageAdmin() {
  const queryClient = useQueryClient();
  const [editingCoin, setEditingCoin] = useState(null);
  const [formData, setFormData] = useState({});

  // Fetch coin type configurations
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['admin', 'coin-types'],
    queryFn: async () => {
      const response = await api.get('/admin/coin-types');
      return response.configs || [];
    }
  });

  // Update coin type configuration
  const updateMutation = useMutation({
    mutationFn: async ({ type, data }) => {
      return await api.put(`/admin/coin-types/${type}`, data);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries(['admin', 'coin-types']);
      toast.success(response.message || 'Coin type updated successfully!');
      setEditingCoin(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update coin type');
    }
  });

  const handleEdit = (config) => {
    setEditingCoin(config.collectionType || config.collection_type);
    setFormData({
      displayName: config.displayName || config.display_name,
      tagline: config.tagline,
      description: config.description,
      icon: config.icon,
      color: config.color,
      howToEarn: config.howToEarn || config.how_to_earn
    });
  };

  const handleSave = () => {
    updateMutation.mutate({
      type: editingCoin,
      data: formData
    });
  };

  const handleCancel = () => {
    setEditingCoin(null);
    setFormData({});
  };

  if (isLoading) {
    return <div className="coin-types-admin loading">Loading coin types...</div>;
  }

  return (
    <div className="coin-types-admin">
      <div className="page-header">
        <h2>🪙 Coin Type Configuration</h2>
        <p>Manage branding and content for each coin type</p>
      </div>

      <div className="coins-table-container">
        <table className="coins-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Display Name</th>
              <th>Tagline</th>
              <th>Icon</th>
              <th>Color</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => {
              const type = config.collectionType || config.collection_type;
              const displayName = config.displayName || config.display_name;
              
              return (
                <tr key={type}>
                  <td className="type-cell"><code>{type}</code></td>
                  <td>{displayName}</td>
                  <td className="tagline-cell">{config.tagline}</td>
                  <td className="icon-cell">
                    <span style={{ fontSize: '24px' }}>{config.icon}</span>
                  </td>
                  <td>
                    <div className="color-preview">
                      <div 
                        className="color-swatch" 
                        style={{ backgroundColor: config.color }}
                      ></div>
                      <code>{config.color}</code>
                    </div>
                  </td>
                  <td>
                    <button 
                      className="edit-btn"
                      onClick={() => handleEdit(config)}
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingCoin && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Coin Type: <code>{editingCoin}</code></h3>
              <button className="close-btn" onClick={handleCancel}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Display Name *</label>
                <input
                  type="text"
                  value={formData.displayName || ''}
                  onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                  placeholder="e.g., Engagement Coins"
                />
              </div>

              <div className="form-group">
                <label>Tagline *</label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => setFormData({...formData, tagline: e.target.value})}
                  placeholder="e.g., Earned through active participation"
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Full description of this coin type..."
                  rows="4"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Icon (Emoji) *</label>
                  <input
                    type="text"
                    value={formData.icon || ''}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    placeholder="🏆"
                  />
                </div>

                <div className="form-group">
                  <label>Color (Hex) *</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      value={formData.color || '#c4a962'}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                    />
                    <input
                      type="text"
                      value={formData.color || ''}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      placeholder="#c4a962"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>How to Earn *</label>
                <textarea
                  value={formData.howToEarn || ''}
                  onChange={(e) => setFormData({...formData, howToEarn: e.target.value})}
                  placeholder="Instructions on earning these coins..."
                  rows="3"
                />
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
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoinTypesPageAdmin;
