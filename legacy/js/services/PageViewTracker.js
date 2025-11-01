/**
 * PageViewTracker - Frontend service for tracking page views
 * Follows OOP principles with async, non-blocking patterns
 */
class PageViewTracker {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.apiEndpoint = '/api/gamification/track-view';
    this.currentPage = null;
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for page navigation
   */
  setupEventListeners() {
    // Listen to page:shown events
    this.eventBus.on('page:shown', (data) => {
      this.trackPageView(data.page, data.identifier);
    });
  }

  /**
   * Track a page view asynchronously
   * @param {string} pageType - Type of page (home, products, community, rank, profile, product_detail)
   * @param {string|null} pageIdentifier - Optional identifier (product ID, user ID, etc.)
   */
  trackPageView(pageType, pageIdentifier = null) {
    // Prevent duplicate tracking of same page
    const pageKey = `${pageType}:${pageIdentifier || ''}`;
    if (this.currentPage === pageKey) {
      return;
    }

    this.currentPage = pageKey;

    // Get referrer
    const referrer = document.referrer || null;

    // Send tracking request asynchronously (fire and forget)
    this.sendTrackingRequest({
      pageType,
      pageIdentifier,
      referrer,
    });

    console.log(`📊 Page view tracked: ${pageType}${pageIdentifier ? ` (${pageIdentifier})` : ''}`);
  }

  /**
   * Track product detail page view
   * @param {string} productId - Shopify product ID
   */
  trackProductView(productId) {
    this.trackPageView('product_detail', productId);
  }

  /**
   * Track user profile page view
   * @param {number} userId - User ID
   */
  trackProfileView(userId) {
    this.trackPageView('profile', userId.toString());
  }

  /**
   * Send tracking request to backend (async, non-blocking)
   * Uses fire-and-forget pattern - doesn't wait for response
   */
  async sendTrackingRequest(data) {
    try {
      // Use fetch with no-cors mode for truly async fire-and-forget
      // Don't await the response
      fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookie
        body: JSON.stringify(data),
        // Fire and forget - don't wait for response
      }).catch(err => {
        // Silent fail - tracking shouldn't disrupt user experience
        console.debug('Page view tracking request failed (silent):', err);
      });
    } catch (error) {
      // Silent fail - tracking failures shouldn't impact user
      console.debug('Page view tracking error (silent):', error);
    }
  }

  /**
   * Manually track a custom page view
   * @param {Object} viewData - Page view data
   */
  trackCustomView(viewData) {
    this.sendTrackingRequest(viewData);
  }
}

// Register service in global registry when app initializes
if (window.serviceRegistry) {
  window.serviceRegistry.register('pageViewTracker', PageViewTracker);
}
