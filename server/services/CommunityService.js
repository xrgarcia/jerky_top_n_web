const { sql, eq, desc } = require('drizzle-orm');
const { users, productRankings } = require('../../shared/schema');

/**
 * CommunityService - Centralized service for user data and community features
 * Handles user display name formatting with privacy (last name truncation)
 */
class CommunityService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Format user display name with last name truncated to first letter
   * @param {Object} user - User object with firstName and lastName
   * @returns {string} Formatted display name (e.g., "John D.")
   */
  formatDisplayName(user) {
    if (!user) return 'User';
    
    // If we have firstName and lastName, format as "FirstName L."
    if (user.firstName || user.first_name) {
      const firstName = user.firstName || user.first_name;
      const lastName = user.lastName || user.last_name;
      const lastInitial = lastName ? ` ${lastName.charAt(0)}.` : '';
      return `${firstName}${lastInitial}`;
    }
    
    // Fallback to displayName or 'User'
    return user.displayName || user.display_name || 'User';
  }

  /**
   * Get all community users with ranking statistics
   * @param {number} limit - Number of users to return
   * @param {number} offset - Offset for pagination
   * @returns {Array} Users with formatted display names and stats
   */
  async getCommunityUsers(limit = 20, offset = 0) {
    const results = await this.db.execute(sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.display_name,
        COUNT(DISTINCT pr.shopify_product_id) AS ranked_count,
        COUNT(DISTINCT pr.ranking_list_id) AS ranking_lists_count
      FROM users u
      LEFT JOIN product_rankings pr ON pr.user_id = u.id
      WHERE u.active = true
      GROUP BY u.id, u.first_name, u.last_name, u.display_name
      ORDER BY ranked_count DESC, u.id ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return results.rows.map(user => ({
      id: user.id,
      displayName: this.formatDisplayName(user),
      rankedCount: parseInt(user.ranked_count) || 0,
      rankingListsCount: parseInt(user.ranking_lists_count) || 0
    }));
  }

  /**
   * Search community users by name or products they've ranked
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @returns {Array} Matching users with formatted display names
   */
  async searchCommunityUsers(query, limit = 10) {
    const searchPattern = `%${query.toLowerCase()}%`;
    
    const results = await this.db.execute(sql`
      SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        u.display_name,
        COUNT(DISTINCT pr.shopify_product_id) as ranked_count
      FROM users u
      LEFT JOIN product_rankings pr ON pr.user_id = u.id
      WHERE 
        u.active = true
        AND (
          LOWER(u.first_name) LIKE ${searchPattern}
          OR LOWER(u.last_name) LIKE ${searchPattern}
          OR LOWER(u.display_name) LIKE ${searchPattern}
          OR EXISTS (
            SELECT 1 FROM product_rankings pr2
            WHERE pr2.user_id = u.id
            AND LOWER(pr2.product_data->>'title') LIKE ${searchPattern}
          )
        )
      GROUP BY u.id, u.first_name, u.last_name, u.display_name
      ORDER BY ranked_count DESC
      LIMIT ${limit}
    `);

    return results.rows.map(user => ({
      id: user.id,
      displayName: this.formatDisplayName(user),
      rankedCount: parseInt(user.ranked_count) || 0,
      type: 'user'
    }));
  }

  /**
   * Get top rankers with formatted display names
   * @param {Array} rankers - Leaderboard entries with user data
   * @returns {Array} Rankers with formatted display names
   */
  formatTopRankers(rankers) {
    return rankers.map(ranker => ({
      ...ranker,
      displayName: this.formatDisplayName({
        firstName: ranker.firstName,
        lastName: ranker.lastName,
        displayName: ranker.displayName
      })
    }));
  }

  /**
   * Get user by ID with formatted display name
   * @param {number} userId - User ID
   * @returns {Object} User with formatted display name
   */
  async getUserById(userId) {
    const [user] = await this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
        email: users.email
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    return {
      ...user,
      displayName: this.formatDisplayName(user)
    };
  }
}

module.exports = CommunityService;
