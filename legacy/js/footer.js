/**
 * Footer Navigation Handler
 * Manages footer links and updates based on authentication state
 */

(function() {
  'use strict';

  // Handle footer navigation links
  function initializeFooterNavigation() {
    // All footer links now use proper hash hrefs in HTML
    // No need to manipulate them dynamically
    console.log('✅ Footer navigation links using native hash routing');
  }
  
  // Update footer based on authentication state
  function updateFooterAuthState() {
    const isLoggedIn = localStorage.getItem('sessionId');
    const footerLoginLink = document.getElementById('footerLoginLink');
    const footerProfileLink = document.getElementById('footerProfileLink');
    
    if (isLoggedIn) {
      if (footerLoginLink) {
        footerLoginLink.textContent = 'My Account';
        footerLoginLink.title = 'View your account';
      }
      if (footerProfileLink) {
        footerProfileLink.style.display = 'inline';
      }
    } else {
      if (footerLoginLink) {
        footerLoginLink.textContent = 'Log In';
        footerLoginLink.title = 'Log in to your account';
      }
      if (footerProfileLink) {
        footerProfileLink.style.display = 'none';
      }
    }
  }
  
  // Listen for authentication changes
  function setupAuthListeners() {
    // Listen for storage changes (login/logout)
    window.addEventListener('storage', (e) => {
      if (e.key === 'sessionId') {
        updateFooterAuthState();
      }
    });
    
    // Listen for custom auth events if they exist
    if (window.appEventBus) {
      window.appEventBus.on('auth:login', updateFooterAuthState);
      window.appEventBus.on('auth:logout', updateFooterAuthState);
    }
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeFooterNavigation();
      updateFooterAuthState();
      setupAuthListeners();
    });
  } else {
    initializeFooterNavigation();
    updateFooterAuthState();
    setupAuthListeners();
  }
  
  console.log('✅ Footer navigation initialized');
})();
