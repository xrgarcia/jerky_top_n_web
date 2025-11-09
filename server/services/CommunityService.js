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
   * Format user display name respecting privacy settings
   * @param {Object} user - User object with firstName, lastName, handle, hideNamePrivacy
   * @returns {string} Formatted display name (e.g., "John D." or "@smokybeef247")
   */
  formatDisplayName(user) {
    if (!user) return 'User';
    
    // Check if privacy is enabled
    const hideNamePrivacy = user.hideNamePrivacy || user.hide_name_privacy;
    const handle = user.handle;
    
    // If privacy enabled and handle exists, show handle
    if (hideNamePrivacy && handle) {
      return `@${handle}`;
    }
    
    // If privacy enabled but no handle, anonymize
    if (hideNamePrivacy) {
      return 'Anonymous User';
    }
    
    // Privacy disabled: show name as "FirstName L."
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
   * Get avatar URL for user
   * @param {Object} user - User object with profile_image_url or profileImageUrl
   * @returns {string|null} Avatar URL or null
   */
  getAvatarUrl(user) {
    if (!user) return null;
    return user.profile_image_url || user.profileImageUrl || null;
  }

  /**
   * Get user initials for avatar fallback
   * @param {Object} user - User object with firstName, lastName, hideNamePrivacy
   * @returns {string} User initials (e.g., "JD") or "?" for anonymous
   */
  getUserInitials(user) {
    if (!user) return '?';
    
    // If privacy enabled, don't show initials from real name
    const hideNamePrivacy = user.hideNamePrivacy || user.hide_name_privacy;
    if (hideNamePrivacy) {
      const handle = user.handle;
      // Use first 2 chars of handle if available
      if (handle) {
        return handle.substring(0, 2).toUpperCase();
      }
      return '?';
    }
    
    // Privacy disabled: use real initials
    const firstName = user.firstName || user.first_name || '';
    const lastName = user.lastName || user.last_name || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    
    return '?';
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
        u.profile_image_url,
        u.handle,
        u.hide_name_privacy,
        COUNT(DISTINCT pr.shopify_product_id) AS ranked_count,
        COUNT(DISTINCT pr.ranking_list_id) AS ranking_lists_count
      FROM users u
      LEFT JOIN product_rankings pr ON pr.user_id = u.id
      WHERE u.active = true
      GROUP BY u.id, u.first_name, u.last_name, u.display_name, u.profile_image_url, u.handle, u.hide_name_privacy
      ORDER BY ranked_count DESC, u.id ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return results.rows.map(user => {
      const hideNamePrivacy = user.hide_name_privacy;
      
      return {
        id: user.id,
        displayName: this.formatDisplayName(user),
        avatarUrl: user.profile_image_url,
        initials: this.getUserInitials(user),
        rankedCount: parseInt(user.ranked_count) || 0,
        rankingListsCount: parseInt(user.ranking_lists_count) || 0,
        // Only include handle if user wants to show it (privacy off or privacy on with handle)
        handle: hideNamePrivacy ? null : user.handle
      };
    });
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
        u.profile_image_url,
        u.handle,
        u.hide_name_privacy,
        COUNT(DISTINCT pr.shopify_product_id) as ranked_count
      FROM users u
      LEFT JOIN product_rankings pr ON pr.user_id = u.id
      WHERE 
        u.active = true
        AND (
          LOWER(u.first_name) LIKE ${searchPattern}
          OR LOWER(u.last_name) LIKE ${searchPattern}
          OR LOWER(u.display_name) LIKE ${searchPattern}
          OR LOWER(u.handle) LIKE ${searchPattern}
          OR EXISTS (
            SELECT 1 FROM product_rankings pr2
            WHERE pr2.user_id = u.id
            AND LOWER(pr2.product_data->>'title') LIKE ${searchPattern}
          )
        )
      GROUP BY u.id, u.first_name, u.last_name, u.display_name, u.profile_image_url, u.handle, u.hide_name_privacy
      ORDER BY ranked_count DESC
      LIMIT ${limit}
    `);

    return results.rows.map(user => {
      const hideNamePrivacy = user.hide_name_privacy;
      
      return {
        id: user.id,
        displayName: this.formatDisplayName(user),
        avatarUrl: user.profile_image_url,
        initials: this.getUserInitials(user),
        rankedCount: parseInt(user.ranked_count) || 0,
        type: 'user',
        // Only include handle if user wants to show it
        handle: hideNamePrivacy ? null : user.handle
      };
    });
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
        email: users.email,
        profileImageUrl: users.profileImageUrl,
        handle: users.handle,
        hideNamePrivacy: users.hideNamePrivacy
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    const hideNamePrivacy = user.hideNamePrivacy;

    return {
      id: user.id,
      displayName: this.formatDisplayName(user),
      avatarUrl: user.profileImageUrl,
      initials: this.getUserInitials(user),
      email: user.email,
      // Only include handle if user wants to show it
      handle: hideNamePrivacy ? null : user.handle
    };
  }

  /**
   * Get ALL users (including inactive) for admin purposes with pagination
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of users to return (default 100)
   * @param {number} options.offset - Number of users to skip (default 0)
   * @param {string} options.search - Optional search query for name or email
   * @returns {Object} { users: Array, total: number, hasMore: boolean }
   */
  async getAllUsersForAdmin({ limit = 100, offset = 0, search = '' } = {}) {
    const searchPattern = search ? `%${search.toLowerCase()}%` : null;
    
    // Get total count
    const countQuery = searchPattern
      ? sql`
          SELECT COUNT(*) as total
          FROM users u
          WHERE 
            LOWER(u.first_name) LIKE ${searchPattern}
            OR LOWER(u.last_name) LIKE ${searchPattern}
            OR LOWER(u.email) LIKE ${searchPattern}
        `
      : sql`SELECT COUNT(*) as total FROM users`;
    
    const countResult = await this.db.execute(countQuery);
    const total = parseInt(countResult.rows[0]?.total || 0);
    
    // Get paginated users
    const usersQuery = searchPattern
      ? sql`
          SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.display_name,
            u.email,
            u.active
          FROM users u
          WHERE 
            LOWER(u.first_name) LIKE ${searchPattern}
            OR LOWER(u.last_name) LIKE ${searchPattern}
            OR LOWER(u.email) LIKE ${searchPattern}
          ORDER BY u.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `
      : sql`
          SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.display_name,
            u.email,
            u.active
          FROM users u
          ORDER BY u.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `;
    
    const results = await this.db.execute(usersQuery);
    
    const users = results.rows.map(user => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name,
      email: user.email,
      active: user.active
    }));
    
    return {
      users,
      total,
      hasMore: (offset + limit) < total,
      offset,
      limit
    };
  }
}

module.exports = CommunityService;
