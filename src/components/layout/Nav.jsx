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

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <Link to="/" className="logo">
          <img src="/logo.png" alt="Jerky Top N" className="logo-img" />
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
          <Link to="/coinbook" className={`nav-link ${isActive('/coinbook')}`}>
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
            <>
              <Link to="/profile" className="nav-link">
                {user?.first_name || 'Profile'}
              </Link>
              <button onClick={logout} className="nav-link logout-btn">
                Logout
              </button>
            </>
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
