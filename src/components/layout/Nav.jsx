import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './Nav.css';

function Nav() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const getUserInitial = () => {
    if (!user?.firstName) return 'U';
    return user.firstName.charAt(0).toUpperCase();
  };

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <Link to="/" className="logo">
          <img src="/favicon.png" alt="Jerky Top N" className="logo-img" />
        </Link>

        <div className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/')}`}>
            Home
          </Link>
          <Link to="/products" className={`nav-link ${isActive('/products')}`}>
            Products
          </Link>
          {isAuthenticated && (
            <Link to="/rank" className={`nav-link ${isActive('/rank')}`}>
              Rank
            </Link>
          )}
          <Link to="/coin-book" className={`nav-link ${isActive('/coin-book')}`}>
            Coin Book
          </Link>
          {isAuthenticated && (
            <>
              <Link to="/community" className={`nav-link ${isActive('/community')}`}>
                Community
              </Link>
              <Link to="/leaderboard" className={`nav-link ${isActive('/leaderboard')}`}>
                Leaderboard
              </Link>
            </>
          )}
        </div>

        <div className="nav-actions">
          {isAuthenticated ? (
            <div className="user-actions">
              <div className="user-profile">
                <Link to="/profile" className="user-avatar" title={`${user?.firstName || 'User'} ${user?.lastName || ''}`}>
                  {getUserInitial()}
                </Link>
                <button onClick={logout} className="logout-btn" title="Logout">
                  →
                </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="nav-link">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Nav;
