import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './MobileNavDrawer.css';

export default function MobileNavDrawer({ isOpen, onClose }) {
  const location = useLocation();
  const { isAuthenticated, isEmployee } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    onClose();
  }, [location.pathname]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="mobile-nav-backdrop" onClick={handleBackdropClick}>
      <div className={`mobile-nav-drawer ${isOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          <h2 className="mobile-nav-title">Menu</h2>
          <button 
            className="mobile-nav-close" 
            onClick={onClose}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        
        <nav className="mobile-nav-links">
          <Link to="/" className="mobile-nav-link" onClick={onClose}>
            Home
          </Link>
          <Link to="/flavors" className="mobile-nav-link" onClick={onClose}>
            Flavors
          </Link>
          {isAuthenticated && (
            <Link to="/rank" className="mobile-nav-link" onClick={onClose}>
              Rank
            </Link>
          )}
          <Link to="/coinbook" className="mobile-nav-link" onClick={onClose}>
            Coin Book
          </Link>
          {isAuthenticated && (
            <>
              <Link to="/community" className="mobile-nav-link" onClick={onClose}>
                Community
              </Link>
              <Link to="/leaderboard" className="mobile-nav-link" onClick={onClose}>
                Leaderboard
              </Link>
            </>
          )}
          {isEmployee && (
            <Link to="/admin/tools" className="mobile-nav-link" onClick={onClose}>
              Tools
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
