import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';
import './CoinTypesPageAdmin.css';

function FlavorCommunitiesPageAdmin() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  // Fetch flavor profile community configuration
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['admin', 'flavor-profile-communities-config'],
    queryFn: async () => {
      console.log('🔍 Fetching flavor profile communities config...');
      const response = await api.get('/flavor-profile-communities/config');
      console.log('✅ Config response:', response);
      return response.config || {};
    },
    retry: 1
  });

  // Update flavor profile community configuration
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await api.post('/flavor-profile-communities/config', data);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries(['admin', 'flavor-profile-communities-config']);
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

  // Show error state
  if (error) {
    console.error('❌ Error fetching config:', error);
    toast.error('Failed to load configuration: ' + (error.message || 'Unknown error'));
    return (
      <div className="coin-types-admin">
        <div className="page-header">
          <h2>🌶️ Flavor Profile Communities Configuration</h2>
          <p style={{color: 'red'}}>Error loading configuration: {error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !config) {
    return <div className="coin-types-admin loading">Loading flavor communities configuration...</div>;
  }

  const moderatePct = 100 - (config.enthusiast_top_pct || 40) - (config.explorer_bottom_pct || 40);

  return (
    <div className="coin-types-admin">
      <div className="page-header">
        <h2>🌶️ Flavor Profile Communities Configuration</h2>
        <p>Manage thresholds for flavor profile micro-community lifecycle states</p>
      </div>

      {/* How It Works Accordion */}
      <div className="accordion-section" style={{ marginBottom: '2rem' }}>
        <button 
          className="accordion-header"
          onClick={() => setIsAccordionOpen(!isAccordionOpen)}
          style={{
            width: '100%',
            padding: '1rem 1.5rem',
            background: '#f8f5f0',
            border: '2px solid #d4c5a9',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '1.1rem',
            fontWeight: '600',
            color: '#5a4a3a',
            transition: 'all 0.2s ease'
          }}
        >
          <span>📖 How Flavor Profile Communities Work</span>
          <span style={{ fontSize: '1.5rem' }}>{isAccordionOpen ? '−' : '+'}</span>
        </button>
        
        {isAccordionOpen && (
          <div 
            className="accordion-content"
            style={{
              marginTop: '1rem',
              padding: '1.5rem',
              background: 'white',
              border: '2px solid #d4c5a9',
              borderRadius: '8px',
              lineHeight: '1.6'
            }}
          >
            <h3 style={{ marginTop: 0, color: '#5a4a3a' }}>Understanding Flavor Profile Communities</h3>
            
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
              Think of flavor communities like a journey your customers take with each <strong>flavor profile</strong> they discover. 
              As they interact with products featuring a specific flavor profile (like "Teriyaki" or "BBQ"), they naturally 
              progress through different stages of their exploration.
            </p>
            
            <p style={{ fontSize: '0.95rem', marginBottom: '1.5rem', padding: '0.75rem', background: '#f8f5f0', borderRadius: '6px', color: '#666' }}>
              <strong>Note:</strong> A <em>flavor profile</em> is a taste category (like Savory, Sweet, Spicy, Teriyaki, BBQ, etc.) 
              that can appear across many different products. This is different from a <em>flavor</em>, which refers to a specific 
              product (like "Beef Teriyaki" or "Spicy Turkey").
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#8b6f47', marginBottom: '0.5rem' }}>🗺️ The Flavor Profile Journey</h4>
              <p>Each customer moves through these stages for every flavor profile they encounter:</p>
            </div>

            <div style={{ borderLeft: '3px solid #d4c5a9', paddingLeft: '1rem', marginBottom: '1rem' }}>
              <h5 style={{ color: '#5a4a3a', marginBottom: '0.3rem' }}>1. 🤔 Curious</h5>
              <p style={{ margin: 0, color: '#666' }}>
                They've browsed or searched for products with this flavor profile, but haven't bought anything yet. 
                They're window shopping and learning what's available.
              </p>
            </div>

            <div style={{ borderLeft: '3px solid #d4c5a9', paddingLeft: '1rem', marginBottom: '1rem' }}>
              <h5 style={{ color: '#5a4a3a', marginBottom: '0.3rem' }}>2. 🔍 Seeker</h5>
              <p style={{ margin: 0, color: '#666' }}>
                They've purchased products with this flavor profile! The order is on its way, and they're excited to try it. 
                They've committed to exploring this flavor profile.
              </p>
            </div>

            <div style={{ borderLeft: '3px solid #d4c5a9', paddingLeft: '1rem', marginBottom: '1rem' }}>
              <h5 style={{ color: '#5a4a3a', marginBottom: '0.3rem' }}>3. 👅 Taster</h5>
              <p style={{ margin: 0, color: '#666' }}>
                Their order has been delivered! They've tried the flavor profile and are forming their opinion. 
                At this stage, they're still discovering whether they love it or not.
              </p>
            </div>

            <div style={{ borderLeft: '3px solid #8b6f47', paddingLeft: '1rem', marginBottom: '1rem', background: '#fef9f3', padding: '0.75rem' }}>
              <h5 style={{ color: '#5a4a3a', marginBottom: '0.3rem' }}>4. 🌟 Enthusiast</h5>
              <p style={{ margin: 0, color: '#666' }}>
                They love this flavor profile! After ranking several products with this flavor profile, their rankings show they 
                consistently rate it highly. These customers are passionate advocates for this flavor profile.
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontStyle: 'italic', color: '#8b6f47' }}>
                → Determined by the "Enthusiast Top %" threshold (e.g., top 40% of rankers)
              </p>
            </div>

            <div style={{ borderLeft: '3px solid #8b6f47', paddingLeft: '1rem', marginBottom: '1rem', background: '#fef9f3', padding: '0.75rem' }}>
              <h5 style={{ color: '#5a4a3a', marginBottom: '0.3rem' }}>5. 🧭 Explorer</h5>
              <p style={{ margin: 0, color: '#666' }}>
                They're adventurous! After trying this flavor profile, they've ranked it lower compared to others—but 
                that's positive! It means they're exploring different options and discovering what they like best.
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontStyle: 'italic', color: '#8b6f47' }}>
                → Determined by the "Explorer Bottom %" threshold (e.g., bottom 40% of rankers)
              </p>
            </div>

            <div style={{ borderLeft: '3px solid #8b6f47', paddingLeft: '1rem', background: '#fef9f3', padding: '0.75rem' }}>
              <h5 style={{ color: '#5a4a3a', marginBottom: '0.3rem' }}>6. 🎯 Moderate</h5>
              <p style={{ margin: 0, color: '#666' }}>
                They like this flavor profile, but it's not their absolute favorite or their least favorite. 
                They fall somewhere in the middle, enjoying it alongside other flavor profiles.
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontStyle: 'italic', color: '#8b6f47' }}>
                → Automatically assigned to everyone between Enthusiast and Explorer percentages
              </p>
            </div>

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0f8f0', borderRadius: '6px', border: '1px solid #c8e6c9' }}>
              <h4 style={{ color: '#2e7d32', marginTop: 0 }}>💡 Why This Matters</h4>
              <p style={{ margin: 0 }}>
                Understanding where customers are in their flavor profile journey helps you:
              </p>
              <ul style={{ marginBottom: 0, paddingLeft: '1.5rem' }}>
                <li>Identify which flavor profiles have passionate fan bases (Enthusiasts)</li>
                <li>Discover which customers are still exploring and might need recommendations</li>
                <li>See which flavor profiles generate the most engagement across all stages</li>
                <li>Understand the complete customer experience from curiosity to loyalty</li>
              </ul>
            </div>

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fff3e0', borderRadius: '6px', border: '1px solid #ffe0b2' }}>
              <h4 style={{ color: '#e65100', marginTop: 0 }}>⚙️ Configuring the Thresholds</h4>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                The settings below control how customers move from "Taster" to the ranked states:
              </p>
              <ul style={{ marginBottom: 0, paddingLeft: '1.5rem' }}>
                <li><strong>Enthusiast Top %:</strong> What percentage of customers with the highest rankings become "Enthusiasts"</li>
                <li><strong>Explorer Bottom %:</strong> What percentage of customers with lower rankings become "Explorers"</li>
                <li><strong>Minimum Products:</strong> How many products they must rank before we categorize them (ensures meaningful data)</li>
              </ul>
            </div>
          </div>
        )}
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
              <h3>Edit Flavor Profile Communities Configuration</h3>
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
