const { sql, eq } = require('drizzle-orm');
const { userEngagementScores } = require('../../shared/schema');
const LeaderboardCache = require('../cache/LeaderboardCache');

class EngagementScoreService {
  constructor(db) {
    this.db = db;
    this.leaderboardCache = LeaderboardCache.getInstance();
  }

  async incrementAchievement(userId, increment = 1, timestamp = new Date()) {
    await this._incrementMetric(userId, {
      achievements_count: increment,
      achievements_count_week: increment,
      achievements_count_month: increment,
    }, timestamp);
  }

  async incrementPageView(userId, increment = 1, timestamp = new Date()) {
    await this._incrementMetric(userId, {
      page_views_count: increment,
      page_views_count_week: increment,
      page_views_count_month: increment,
    }, timestamp);
  }

  async incrementRanking(userId, increment = 1, uniqueProductsIncrement = 0, timestamp = new Date()) {
    await this._incrementMetric(userId, {
      rankings_count: increment,
      rankings_count_week: increment,
      rankings_count_month: increment,
      unique_products_count: uniqueProductsIncrement,
    }, timestamp);
  }

  async incrementSearch(userId, increment = 1, timestamp = new Date()) {
    await this._incrementMetric(userId, {
      searches_count: increment,
      searches_count_week: increment,
      searches_count_month: increment,
    }, timestamp);
  }

  async _incrementMetric(userId, metrics, timestamp = new Date()) {
    const updates = Object.entries(metrics)
      .map(([key, value]) => `${key} = ${key} + ${value}`)
      .join(', ');

    const allTimeFields = ['achievements_count', 'page_views_count', 'rankings_count', 'searches_count'];
    const allTimeIncrement = allTimeFields.reduce((sum, field) => {
      return sum + (metrics[field] || 0);
    }, 0);

    const weekFields = ['achievements_count_week', 'page_views_count_week', 'rankings_count_week', 'searches_count_week'];
    const weekIncrement = weekFields.reduce((sum, field) => {
      return sum + (metrics[field] || 0);
    }, 0);

    const monthFields = ['achievements_count_month', 'page_views_count_month', 'rankings_count_month', 'searches_count_month'];
    const monthIncrement = monthFields.reduce((sum, field) => {
      return sum + (metrics[field] || 0);
    }, 0);

    const query = `
      INSERT INTO user_engagement_scores (
        user_id, 
        ${Object.keys(metrics).join(', ')},
        engagement_score,
        engagement_score_week,
        engagement_score_month
      )
      VALUES (
        ${userId}, 
        ${Object.values(metrics).join(', ')},
        ${allTimeIncrement},
        ${weekIncrement},
        ${monthIncrement}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        ${updates},
        engagement_score = user_engagement_scores.engagement_score + ${allTimeIncrement},
        engagement_score_week = user_engagement_scores.engagement_score_week + ${weekIncrement},
        engagement_score_month = user_engagement_scores.engagement_score_month + ${monthIncrement},
        last_updated_at = NOW()
    `;
    
    await this.db.execute(sql.raw(query));
    
    // Invalidate affected cache entries (granular, timestamp-aware)
    await this.leaderboardCache.invalidateUser({
      userId,
      activityTimestamp: timestamp
    });
  }

  async recalculateUserScore(userId) {
    const query = `
      INSERT INTO user_engagement_scores (
        user_id,
        achievements_count,
        page_views_count,
        rankings_count,
        searches_count,
        unique_products_count,
        engagement_score,
        achievements_count_week,
        page_views_count_week,
        rankings_count_week,
        searches_count_week,
        engagement_score_week,
        achievements_count_month,
        page_views_count_month,
        rankings_count_month,
        searches_count_month,
        engagement_score_month,
        last_updated_at
      )
      SELECT 
        u.id as user_id,
        COALESCE(COUNT(DISTINCT ua.id), 0)::int,
        COALESCE(COUNT(DISTINCT act_pv.id), 0)::int,
        COALESCE(COUNT(DISTINCT pr.id), 0)::int,
        COALESCE(COUNT(DISTINCT act_s.id), 0)::int,
        COALESCE(COUNT(DISTINCT pr.shopify_product_id), 0)::int,
        (COALESCE(COUNT(DISTINCT ua.id), 0) + 
         COALESCE(COUNT(DISTINCT act_pv.id), 0) + 
         COALESCE(COUNT(DISTINCT pr.id), 0) + 
         COALESCE(COUNT(DISTINCT act_s.id), 0))::int,
        COALESCE(COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at >= NOW() - INTERVAL '7 days'), 0)::int,
        COALESCE(COUNT(DISTINCT act_pv.id) FILTER (WHERE act_pv.created_at >= NOW() - INTERVAL '7 days'), 0)::int,
        COALESCE(COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '7 days'), 0)::int,
        COALESCE(COUNT(DISTINCT act_s.id) FILTER (WHERE act_s.created_at >= NOW() - INTERVAL '7 days'), 0)::int,
        (COALESCE(COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at >= NOW() - INTERVAL '7 days'), 0) + 
         COALESCE(COUNT(DISTINCT act_pv.id) FILTER (WHERE act_pv.created_at >= NOW() - INTERVAL '7 days'), 0) + 
         COALESCE(COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '7 days'), 0) + 
         COALESCE(COUNT(DISTINCT act_s.id) FILTER (WHERE act_s.created_at >= NOW() - INTERVAL '7 days'), 0))::int,
        COALESCE(COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at >= NOW() - INTERVAL '30 days'), 0)::int,
        COALESCE(COUNT(DISTINCT act_pv.id) FILTER (WHERE act_pv.created_at >= NOW() - INTERVAL '30 days'), 0)::int,
        COALESCE(COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '30 days'), 0)::int,
        COALESCE(COUNT(DISTINCT act_s.id) FILTER (WHERE act_s.created_at >= NOW() - INTERVAL '30 days'), 0)::int,
        (COALESCE(COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at >= NOW() - INTERVAL '30 days'), 0) + 
         COALESCE(COUNT(DISTINCT act_pv.id) FILTER (WHERE act_pv.created_at >= NOW() - INTERVAL '30 days'), 0) + 
         COALESCE(COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '30 days'), 0) + 
         COALESCE(COUNT(DISTINCT act_s.id) FILTER (WHERE act_s.created_at >= NOW() - INTERVAL '30 days'), 0))::int,
        NOW()
      FROM users u
      LEFT JOIN product_rankings pr ON pr.user_id = u.id
      LEFT JOIN user_activities act_pv ON act_pv.user_id = u.id AND act_pv.activity_type = 'page_view'
      LEFT JOIN user_achievements ua ON ua.user_id = u.id
      LEFT JOIN user_activities act_s ON act_s.user_id = u.id AND act_s.activity_type = 'search'
      WHERE u.id = ${userId} AND u.active = true
      GROUP BY u.id
      ON CONFLICT (user_id) DO UPDATE SET
        achievements_count = EXCLUDED.achievements_count,
        page_views_count = EXCLUDED.page_views_count,
        rankings_count = EXCLUDED.rankings_count,
        searches_count = EXCLUDED.searches_count,
        unique_products_count = EXCLUDED.unique_products_count,
        engagement_score = EXCLUDED.engagement_score,
        achievements_count_week = EXCLUDED.achievements_count_week,
        page_views_count_week = EXCLUDED.page_views_count_week,
        rankings_count_week = EXCLUDED.rankings_count_week,
        searches_count_week = EXCLUDED.searches_count_week,
        engagement_score_week = EXCLUDED.engagement_score_week,
        achievements_count_month = EXCLUDED.achievements_count_month,
        page_views_count_month = EXCLUDED.page_views_count_month,
        rankings_count_month = EXCLUDED.rankings_count_month,
        searches_count_month = EXCLUDED.searches_count_month,
        engagement_score_month = EXCLUDED.engagement_score_month,
        last_updated_at = NOW()
    `;

    await this.db.execute(sql.raw(query));
  }

  async resetWeeklyScores() {
    await this.db.execute(sql`
      UPDATE user_engagement_scores 
      SET achievements_count_week = 0,
          page_views_count_week = 0,
          rankings_count_week = 0,
          searches_count_week = 0,
          engagement_score_week = 0,
          last_updated_at = NOW()
    `);
    console.log('✅ Weekly engagement scores reset successfully');
  }

  async resetMonthlyScores() {
    await this.db.execute(sql`
      UPDATE user_engagement_scores 
      SET achievements_count_month = 0,
          page_views_count_month = 0,
          rankings_count_month = 0,
          searches_count_month = 0,
          engagement_score_month = 0,
          last_updated_at = NOW()
    `);
    console.log('✅ Monthly engagement scores reset successfully');
  }

  async getUserScore(userId) {
    const result = await this.db
      .select()
      .from(userEngagementScores)
      .where(eq(userEngagementScores.userId, userId))
      .limit(1);

    return result[0] || null;
  }
}

module.exports = EngagementScoreService;
