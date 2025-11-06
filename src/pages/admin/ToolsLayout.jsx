import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSuperAdminAccess } from '../../hooks/useAdminAccess';
import './ToolsLayout.css';

function ToolsLayout() {
  const { user } = useAuthStore();
  const location = useLocation();
  const { data: isSuperAdmin = false } = useSuperAdminAccess();
  
  const tabs = [
    { path: '/admin/tools/coins', label: 'Manage Coins', icon: '🏆' },
    { path: '/admin/tools/coin-types', label: 'Coin Types', icon: '🪙' },
    { path: '/admin/tools/flavor-profile-communities', label: 'Flavor Profile Communities', icon: '🌶️' },
    { path: '/admin/tools/live-users', label: 'Live Users', icon: '👥' },
    { path: '/admin/tools/products', label: 'Manage Products', icon: '🥩' },
    { path: '/admin/tools/orders', label: 'Order Items', icon: '🛒' },
    { path: '/admin/tools/user-guidance', label: 'User Guidance', icon: '🎯' },
    { path: '/admin/tools/queue-monitor', label: 'Classification Queue Monitor', icon: '🔄' },
    { path: '/admin/tools/bulk-import', label: 'Customer Import', icon: '📦' },
    { path: '/admin/tools/sentry', label: 'Sentry Issues', icon: '🔍' },
  ];
  
  if (isSuperAdmin) {
    tabs.push({ path: '/admin/tools/data', label: 'Manage Data', icon: '🔐' });
  }

  return (
    <div className="tools-page">
      <div className="tools-header">
        <div className="tools-header-content">
          <div className="tools-header-text">
            <div className="tools-breadcrumbs">
              <NavLink to="/">Home</NavLink>
              <span>›</span>
              <span>Admin Tools</span>
            </div>
            <h1 className="tools-title">
              <span className="tools-icon">🛠️</span>
              <span>Admin Tools</span>
            </h1>
            <p className="tools-subtitle">Management tools for jerky.com employees</p>
          </div>
        </div>
      </div>

      <div className="tools-container">
        <nav className="tools-nav">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) => 
                `tools-nav-btn ${isActive ? 'active' : ''}`
              }
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="tools-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default ToolsLayout;
