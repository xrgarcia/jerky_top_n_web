const { desc, sql, and, gte } = require('drizzle-orm');
const { anonymousSearches } = require('../../shared/schema');

/**
 * AnonymousSearchRepository - Data access layer for anonymous search tracking
 * Captures search behavior from unauthenticated users for analytics purposes
 */
class AnonymousSearchRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Log an anonymous search
   * @param {string} searchTerm - The search query
   * @param {number} resultCount - Number of results returned
   * @param {string} context - Search context (e.g., 'products', 'rank_page', 'global_search')
   * @param {string|null} sessionHash - Anonymized session identifier (optional)
   * @param {object|null} metadata - Additional analytics data (optional)
   */
  async logSearch(searchTerm, resultCount, context, sessionHash = null, metadata = null) {
    const result = await this.db.insert(anonymousSearches)
      .values({
        searchTerm,
        resultCount,
        context,
        sessionHash,
        metadata,
      })
      .returning();
    return result[0];
  }

  /**
   * Get recent anonymous searches for analytics
   * @param {number} limit - Maximum number of searches to return
   * @param {number} hoursAgo - Only include searches from this many hours ago
   */
  async getRecentSearches(limit = 100, hoursAgo = 24) {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    return await this.db.select()
      .from(anonymousSearches)
      .where(gte(anonymousSearches.createdAt, since))
      .orderBy(desc(anonymousSearches.createdAt))
      .limit(limit);
  }

  /**
   * Get top search terms by frequency
   * @param {number} limit - Maximum number of terms to return
   * @param {number} hoursAgo - Only include searches from this many hours ago
   * @param {string|null} context - Filter by context (optional)
   */
  async getTopSearchTerms(limit = 20, hoursAgo = 24, context = null) {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    const query = this.db.select({
      searchTerm: anonymousSearches.searchTerm,
      searchCount: sql`count(*)::int`,
      avgResults: sql`avg(${anonymousSearches.resultCount})::int`,
    })
    .from(anonymousSearches)
    .where(
      context 
        ? and(
            gte(anonymousSearches.createdAt, since),
            sql`${anonymousSearches.context} = ${context}`
          )
        : gte(anonymousSearches.createdAt, since)
    )
    .groupBy(anonymousSearches.searchTerm)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
    
    return await query;
  }

  /**
   * Get search volume by context for analytics dashboards
   * @param {number} hoursAgo - Only include searches from this many hours ago
   */
  async getSearchVolumeByContext(hoursAgo = 24) {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    return await this.db.select({
      context: anonymousSearches.context,
      searchCount: sql`count(*)::int`,
    })
    .from(anonymousSearches)
    .where(gte(anonymousSearches.createdAt, since))
    .groupBy(anonymousSearches.context)
    .orderBy(desc(sql`count(*)`));
  }
}

module.exports = AnonymousSearchRepository;
