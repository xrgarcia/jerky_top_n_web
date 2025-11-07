const Sentry = require('@sentry/node');

/**
 * ShopifyCustomersService
 * Fetches ALL customers from Shopify Admin API for bulk import
 */
class ShopifyCustomersService {
  constructor() {
    this.shopDomain = 'jerky-com.myshopify.com';
    this.apiVersion = '2023-10';
    
    // Cache customer count to avoid excessive API calls
    this.customerCountCache = null;
    this.customerCountCacheTime = null;
    this.CACHE_TTL = 60000; // 1 minute cache
  }

  /**
   * Get access token from environment (not cached to support runtime token injection)
   * @returns {string|undefined}
   */
  get accessToken() {
    return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  }

  /**
   * Check if Shopify API is available
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.accessToken;
  }

  /**
   * Get total customer count from Shopify
   * @param {Object} options - Query options
   * @param {boolean} options.bypassCache - Force fresh API call, ignoring cache
   * @returns {Promise<number>} Total customer count
   */
  async getCustomerCount(options = {}) {
    const { bypassCache = false } = options;
    
    if (!this.accessToken) {
      console.warn('⚠️ Shopify Admin Access Token not configured');
      return 0;
    }
    
    // Return cached count if valid and not bypassing cache
    const now = Date.now();
    if (!bypassCache && this.customerCountCache !== null && this.customerCountCacheTime && (now - this.customerCountCacheTime < this.CACHE_TTL)) {
      console.log(`📊 Shopify customer count (cached): ${this.customerCountCache.toLocaleString()}`);
      return this.customerCountCache;
    }

    try {
      const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/customers/count.json`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Shopify customer count API error (${response.status}):`, errorText);
        
        Sentry.captureMessage(`Shopify customer count API error: ${response.status}`, {
          level: 'error',
          tags: { service: 'shopify-customers', shopify_status: response.status },
          extra: { errorText }
        });
        
        return 0;
      }

      const data = await response.json();
      const count = data.count || 0;
      
      // Update cache
      this.customerCountCache = count;
      this.customerCountCacheTime = Date.now();
      
      console.log(`📊 Shopify customer count (fresh): ${count.toLocaleString()}`);
      return count;

    } catch (error) {
      console.error('❌ Error fetching customer count from Shopify:', error);
      Sentry.captureException(error, {
        tags: { service: 'shopify-customers' }
      });
      
      return 0;
    }
  }

  /**
   * Fetch all customers from Shopify with pagination
   * @param {Object} options - Pagination options
   * @param {number} options.limit - Results per page (max 250)
   * @param {number} options.maxPages - Maximum pages to fetch (safety limit)
   * @returns {Promise<Object>} { customers: Array, totalFetched: number, pagesFetched: number }
   */
  async fetchAllCustomers(options = {}) {
    const { limit = 250, maxPages = 1000 } = options;

    if (!this.accessToken) {
      console.warn('⚠️ Shopify Admin Access Token not configured - cannot fetch customers');
      return { customers: [], totalFetched: 0, pagesFetched: 0 };
    }

    try {
      console.log(`👥 Starting bulk customer fetch from Shopify (limit: ${limit}, maxPages: ${maxPages})`);
      
      const allCustomers = [];
      let nextPageUrl = null;
      let pageCount = 0;

      // Build initial URL
      const initialUrl = `https://${this.shopDomain}/admin/api/${this.apiVersion}/customers.json?limit=${limit}`;
      nextPageUrl = initialUrl;

      // Paginate through all customers
      while (nextPageUrl && pageCount < maxPages) {
        pageCount++;
        
        const response = await fetch(nextPageUrl, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Shopify Customers API error (${response.status}):`, errorText);
          
          Sentry.captureMessage(`Shopify Customers API error: ${response.status}`, {
            level: 'error',
            tags: { service: 'shopify-customers', shopify_status: response.status },
            extra: { errorText, pageCount }
          });
          
          // Don't throw - return what we have so far
          break;
        }

        const data = await response.json();
        const customers = data.customers || [];
        
        console.log(`📄 Fetched page ${pageCount}: ${customers.length} customers (total so far: ${allCustomers.length + customers.length})`);
        allCustomers.push(...customers);

        // Check for pagination link in headers
        const linkHeader = response.headers.get('Link');
        nextPageUrl = this._parseNextPageUrl(linkHeader);

        // Small delay to respect Shopify rate limits
        if (nextPageUrl) {
          await this._delay(200); // 200ms between requests
        }
      }

      console.log(`✅ Bulk customer fetch completed: ${allCustomers.length} customers from ${pageCount} pages`);
      
      return {
        customers: allCustomers,
        totalFetched: allCustomers.length,
        pagesFetched: pageCount
      };
      
    } catch (error) {
      console.error('❌ Error fetching all customers from Shopify:', error);
      Sentry.captureException(error, {
        tags: { service: 'shopify-customers' }
      });
      
      // Don't throw - return empty result
      return { customers: [], totalFetched: 0, pagesFetched: 0 };
    }
  }

  /**
   * Fetch a single batch of customers (for progressive loading)
   * Uses proper cursor-based pagination via Link headers
   * @param {Object} options - Pagination options
   * @param {string} options.pageUrl - Full URL for next page (from Link header)
   * @param {number} options.limit - Results per page (max 250)
   * @returns {Promise<Object>} { customers: Array, hasMore: boolean, nextPageUrl: string }
   */
  async fetchCustomerBatch(options = {}) {
    const { pageUrl, limit = 250 } = options;

    if (!this.accessToken) {
      console.warn('⚠️ Shopify Admin Access Token not configured');
      return { customers: [], hasMore: false, nextPageUrl: null };
    }

    try {
      // Use provided page URL or build initial URL
      const url = pageUrl || `https://${this.shopDomain}/admin/api/${this.apiVersion}/customers.json?limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Shopify API error (${response.status}):`, errorText);
        return { customers: [], hasMore: false, nextPageUrl: null };
      }

      const data = await response.json();
      const customers = data.customers || [];

      // Parse Link header for next page URL (proper cursor pagination)
      const linkHeader = response.headers.get('Link');
      const nextPageUrl = this._parseNextPageUrl(linkHeader);
      const hasMore = !!nextPageUrl;

      console.log(`📦 Fetched batch: ${customers.length} customers (hasMore: ${hasMore})`);

      return {
        customers,
        hasMore,
        nextPageUrl
      };

    } catch (error) {
      console.error('❌ Error fetching customer batch:', error);
      Sentry.captureException(error, {
        tags: { service: 'shopify-customers' }
      });
      
      return { customers: [], hasMore: false, nextPageUrl: null };
    }
  }

  /**
   * Parse next page URL from Link header
   * @private
   * @param {string} linkHeader - HTTP Link header value
   * @returns {string|null} Next page URL or null
   */
  _parseNextPageUrl(linkHeader) {
    if (!linkHeader) return null;

    // Link header format: <url>; rel="next", <url>; rel="previous"
    const links = linkHeader.split(',');
    for (const link of links) {
      if (link.includes('rel="next"')) {
        const match = link.match(/<([^>]+)>/);
        return match ? match[1] : null;
      }
    }

    return null;
  }

  /**
   * Delay helper for rate limiting
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ShopifyCustomersService;
