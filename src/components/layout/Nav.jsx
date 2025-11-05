import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import MobileNavDrawer from './MobileNavDrawer';
import './Nav.css';

function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isEmployee, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ products: [], users: [] });
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchRef = useRef(null);

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const getUserInitial = () => {
    if (!user?.firstName) return 'U';
    return user.firstName.charAt(0).toUpperCase();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults({ products: [], users: [] });
        setShowDropdown(false);
        return;
      }

      try {
        const response = await fetch(`/api/search/global?q=${encodeURIComponent(searchQuery)}`, {
          credentials: 'include'
        });
        const data = await response.json();
        setSearchResults(data);
        setShowDropdown(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults({ products: [], users: [] });
      }
    };

    const debounceTimer = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleUserClick = (userId) => {
    navigate(`/community/${userId}`);
    setSearchQuery('');
    setShowDropdown(false);
  };

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <button 
          className="hamburger-btn" 
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <a href="https://jerky.com" className="logo" target="_blank" rel="noopener noreferrer">
          <img src="https://www.jerky.com/cdn/shop/files/jerky_logo_aeed54c0-3f7f-462d-93c3-785b3c97af9d_150x.png?v=1678208718" alt="Jerky.com Logo" className="logo-img" loading="eager" />
        </a>

        <div className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/')}`}>
            Home
          </Link>
          <Link to="/products" className={`nav-link ${isActive('/products')}`}>
            Flavors
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
          {isEmployee && (
            <Link to="/admin/tools" className={`nav-link ${isActive('/admin/tools')}`}>
              Tools
            </Link>
          )}
        </div>

        <div className="nav-actions">
          <div className="search-container" ref={searchRef}>
            <input
              type="text"
              className="nav-search-input"
              placeholder="Search for people or product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="search-btn" aria-label="Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
            
            {showDropdown && (searchResults.products.length > 0 || searchResults.users.length > 0) && (
              <div className="search-dropdown active">
                {searchResults.products.length > 0 && (
                  <div className="search-dropdown-section">
                    <div className="search-dropdown-section-title">Products</div>
                    {searchResults.products.slice(0, 5).map((product) => (
                      <div
                        key={product.id}
                        className="search-dropdown-item"
                        onClick={() => handleProductClick(product.id)}
                      >
                        <img
                          src={product.image || '/favicon.png'}
                          alt={product.title}
                          className="search-dropdown-item-image"
                        />
                        <div className="search-dropdown-item-info">
                          <div className="search-dropdown-item-title">{product.title}</div>
                          {product.animal && (
                            <div className="search-dropdown-item-subtitle">{product.animal}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchResults.users.length > 0 && (
                  <div className="search-dropdown-section">
                    <div className="search-dropdown-section-title">Community</div>
                    {searchResults.users.slice(0, 5).map((user) => (
                      <div
                        key={user.id}
                        className="search-dropdown-item"
                        onClick={() => handleUserClick(user.id)}
                      >
                        <div className="search-dropdown-item-info">
                          <div className="search-dropdown-item-title">{user.displayShort}</div>
                          <div className="search-dropdown-item-subtitle">
                            {user.rankedCount} products ranked
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {isAuthenticated ? (
            <div className="user-actions">
              <div className="user-profile">
                <Link to="/profile" className="user-avatar" title={`${user?.firstName || 'User'} ${user?.lastName || ''}`}>
                  {getUserInitial()}
                </Link>
                <button onClick={logout} className="logout-btn" aria-label="Log out of your account">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
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

      <MobileNavDrawer 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)}
      />
    </nav>
  );
}

export default Nav;
