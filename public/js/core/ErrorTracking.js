/**
 * Frontend Error Tracking with Sentry
 */

class ErrorTracking {
  constructor() {
    this.initialized = false;
    this.Sentry = null;
  }

  async initialize() {
    try {
      // Fetch config from backend
      const response = await fetch('/api/config');
      const config = await response.json();

      if (!config.sentryDsn) {
        console.warn('⚠️  Sentry DSN not configured - frontend error tracking disabled');
        return;
      }

      // Load Sentry SDK from CDN
      await this.loadSentrySDK();

      // Initialize Sentry
      if (window.Sentry) {
        window.Sentry.init({
          dsn: config.sentryDsn,
          environment: config.environment || 'development',
          integrations: [
            new window.Sentry.BrowserTracing(),
            new window.Sentry.Replay({
              maskAllText: false,
              blockAllMedia: false,
            }),
          ],
          tracesSampleRate: 1.0,
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
        });

        this.Sentry = window.Sentry;
        this.initialized = true;
        console.log(`✅ Frontend error tracking initialized (${config.environment})`);
      }
    } catch (error) {
      console.error('Failed to initialize error tracking:', error);
    }
  }

  loadSentrySDK() {
    return new Promise((resolve, reject) => {
      if (window.Sentry) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://browser.sentry-cdn.com/7.119.0/bundle.tracing.replay.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Capture an exception
   * @param {Error} error - The error to capture
   * @param {Object} context - Additional context data
   */
  captureException(error, context = {}) {
    if (!this.initialized || !this.Sentry) {
      console.error('Error (Sentry not initialized):', error, context);
      return;
    }

    this.Sentry.captureException(error, {
      extra: context,
      tags: {
        source: 'frontend',
      },
    });
  }

  /**
   * Capture a message
   * @param {string} message - The message to capture
   * @param {string} level - The severity level (info, warning, error)
   * @param {Object} context - Additional context data
   */
  captureMessage(message, level = 'info', context = {}) {
    if (!this.initialized || !this.Sentry) {
      console.log(`Message (Sentry not initialized): ${message}`, context);
      return;
    }

    this.Sentry.captureMessage(message, {
      level,
      extra: context,
      tags: {
        source: 'frontend',
      },
    });
  }

  /**
   * Set user context
   * @param {Object} user - User information
   */
  setUser(user) {
    if (!this.initialized || !this.Sentry) return;

    this.Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.displayName || `${user.firstName} ${user.lastName}`,
    });
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (!this.initialized || !this.Sentry) return;
    this.Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging
   * @param {string} message - Breadcrumb message
   * @param {Object} data - Additional data
   */
  addBreadcrumb(message, data = {}) {
    if (!this.initialized || !this.Sentry) return;

    this.Sentry.addBreadcrumb({
      message,
      data,
      category: 'user-action',
    });
  }
}

// Create singleton instance
const errorTracking = new ErrorTracking();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => errorTracking.initialize());
} else {
  errorTracking.initialize();
}

// Export for use in other modules
window.ErrorTracking = errorTracking;
