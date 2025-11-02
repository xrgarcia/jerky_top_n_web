import React from 'react';
import { useAuthStore } from '../store/authStore';

function ToolsPage() {
  const { user } = useAuthStore();

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Employee Tools</h1>
      <p>Welcome, {user?.firstName}! This is the employee tools dashboard.</p>
      
      <div style={{ marginTop: '40px' }}>
        <h2>Available Tools</h2>
        <p>Employee-only tools and features will be added here.</p>
        
        <div style={{ marginTop: '20px', display: 'grid', gap: '20px' }}>
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            background: '#f9f9f9'
          }}>
            <h3>Achievement Management</h3>
            <p>Manage achievements, view statistics, and configure rewards.</p>
          </div>
          
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            background: '#f9f9f9'
          }}>
            <h3>Live Users Monitor</h3>
            <p>View currently active users and their activity.</p>
          </div>
          
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            background: '#f9f9f9'
          }}>
            <h3>Product Management</h3>
            <p>Manage product metadata and categories.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ToolsPage;
