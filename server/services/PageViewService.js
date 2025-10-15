const { eq, desc, sql, gte } = require('drizzle-orm');
const { pageViews, productViews } = require('../../shared/schema');

/**
 * PageViewService - Domain service for tracking page views
 * Follows async, non-blocking patterns for performance
 */
class PageViewService {
  constructor(db, productViewRepo) {
    this.db = db;
    this.productViewRepo = productViewRepo;
  }

  /**
   * Track a page view asynchronously (fire and forget)
   * @param {Object} viewData - Page view data
   * @param {number|null} viewData.userId - User ID (null for anonymous)
   * @param {string} viewData.pageType - Page type (home, products, community, rank, profile, product_detail)
   * @param {string|null} viewData.pageIdentifier - Optional identifier (product ID, user ID, etc.)
   * @param {string|null} viewData.referrer - Referrer URL
   */
  async trackPageView(viewData) {
    const { userId, pageType, pageIdentifier, referrer } = viewData;

    try {
      // For product detail pages, track in both tables for compatibility
      if (pageType === 'product_detail' && pageIdentifier) {
        // Track in product_views for trending/ranking calculations
        await this.productViewRepo.logView(pageIdentifier, userId);
      }

      // Track in general page_views for engagement metrics
      await this.db.insert(pageViews).values({
        userId,
        pageType,
        pageIdentifier,
        referrer: referrer || null,
      });

      console.log(`📊 Page view tracked: ${pageType}${pageIdentifier ? ` (${pageIdentifier})` : ''} by user ${userId || 'anonymous'}`);
    } catch (error) {
      // Log but don't throw - tracking failures shouldn't break user experience
      console.error('❌ Error tracking page view:', error);
    }
  }

  /**
   * Track page view asynchronously without waiting
   * Fire-and-forget pattern for non-blocking performance
   */
  trackPageViewAsync(viewData) {
    // Use setImmediate to defer execution to next tick
    setImmediate(() => {
      this.trackPageView(viewData).catch(err => {
        console.error('❌ Async page view tracking failed:', err);
      });
    });
  }

  /**
   * Get page view count for a specific page
   */
  async getPageViewCount(pageType, pageIdentifier = null, hoursAgo = 24) {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    // Build query immutably by reassigning
    let query = this.db.select({
      count: sql`count(*)::int`
    })
    .from(pageViews)
    .where(eq(pageViews.pageType, pageType));

    // Chain additional filters
    if (pageIdentifier) {
      query = query.where(eq(pageViews.pageIdentifier, pageIdentifier));
    }

    query = query.where(gte(pageViews.viewedAt, since));

    const result = await query;
    return result[0]?.count || 0;
  }

  /**
   * Get user's total page views across all pages
   */
  async getUserPageViewCount(userId) {
    const result = await this.db.select({
      count: sql`count(*)::int`
    })
    .from(pageViews)
    .where(eq(pageViews.userId, userId));

    return result[0]?.count || 0;
  }

  /**
   * Get most viewed pages in last N hours
   */
  async getMostViewedPages(limit = 10, hoursAgo = 24) {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    return await this.db.select({
      pageType: pageViews.pageType,
      pageIdentifier: pageViews.pageIdentifier,
      viewCount: sql`count(*)::int`
    })
    .from(pageViews)
    .where(gte(pageViews.viewedAt, since))
    .groupBy(pageViews.pageType, pageViews.pageIdentifier)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  }
}

module.exports = PageViewService;
