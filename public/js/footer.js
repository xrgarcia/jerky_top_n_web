/**
 * Footer Navigation Handler
 * Manages footer links and updates based on authentication state
 */

(function() {
  'use strict';

  // Handle footer navigation links
  function initializeFooterNavigation() {
    const footerLinks = document.querySelectorAll('.footer-links a[data-page]');
    
    footerLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        
        if (page === 'profile') {
          // Check if user is logged in
          const isLoggedIn = localStorage.getItem('sessionId');
          if (!isLoggedIn) {
            // Redirect to login
            document.getElementById('loginBtn')?.click();
            return;
          }
          // Navigate to profile page
          if (typeof showProfilePage === 'function') {
            showProfilePage();
          }
        } else {
          // Use existing navigation functions
          const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
          if (navLink) {
            navLink.click();
          }
        }
      });
    });
    
    // Handle login link in footer
    const footerLoginLink = document.getElementById('footerLoginLink');
    if (footerLoginLink) {
      footerLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        const isLoggedIn = localStorage.getItem('sessionId');
        
        if (isLoggedIn) {
          // Already logged in, go to profile
          const profileLink = document.getElementById('footerProfileLink');
          profileLink?.click();
        } else {
          // Trigger login
          document.getElementById('loginBtn')?.click();
        }
      });
    }
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
