-- Migration: Create user_engagement_scores rollup table for leaderboard performance
-- Created: 2025-11-10
-- Description: Creates a pre-aggregated table that stores engagement metrics per user
--              to eliminate expensive multi-table joins on every leaderboard query

-- Create the rollup table
CREATE TABLE IF NOT EXISTS user_engagement_scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  
  -- All-time metrics
  achievements_count INTEGER NOT NULL DEFAULT 0,
  page_views_count INTEGER NOT NULL DEFAULT 0,
  rankings_count INTEGER NOT NULL DEFAULT 0,
  searches_count INTEGER NOT NULL DEFAULT 0,
  unique_products_count INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  
  -- Weekly metrics
  achievements_count_week INTEGER NOT NULL DEFAULT 0,
  page_views_count_week INTEGER NOT NULL DEFAULT 0,
  rankings_count_week INTEGER NOT NULL DEFAULT 0,
  searches_count_week INTEGER NOT NULL DEFAULT 0,
  engagement_score_week INTEGER NOT NULL DEFAULT 0,
  
  -- Monthly metrics
  achievements_count_month INTEGER NOT NULL DEFAULT 0,
  page_views_count_month INTEGER NOT NULL DEFAULT 0,
  rankings_count_month INTEGER NOT NULL DEFAULT 0,
  searches_count_month INTEGER NOT NULL DEFAULT 0,
  engagement_score_month INTEGER NOT NULL DEFAULT 0,
  
  last_updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_engagement_scores_user_id 
  ON user_engagement_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_scores_engagement 
  ON user_engagement_scores(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_engagement_scores_week 
  ON user_engagement_scores(engagement_score_week DESC);
CREATE INDEX IF NOT EXISTS idx_user_engagement_scores_month 
  ON user_engagement_scores(engagement_score_month DESC);

-- Initial population: Calculate scores for all existing active users
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
  -- All-time counts
  COALESCE(COUNT(DISTINCT ua.id), 0)::int as achievements_count,
  COALESCE(COUNT(DISTINCT act_pv.id), 0)::int as page_views_count,
  COALESCE(COUNT(DISTINCT pr.id), 0)::int as rankings_count,
  COALESCE(COUNT(DISTINCT act_s.id), 0)::int as searches_count,
  COALESCE(COUNT(DISTINCT pr.shopify_product_id), 0)::int as unique_products_count,
  (COALESCE(COUNT(DISTINCT ua.id), 0) + 
   COALESCE(COUNT(DISTINCT act_pv.id), 0) + 
   COALESCE(COUNT(DISTINCT pr.id), 0) + 
   COALESCE(COUNT(DISTINCT act_s.id), 0))::int as engagement_score,
  -- Weekly counts
  COALESCE(COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at >= NOW() - INTERVAL '7 days'), 0)::int as achievements_count_week,
  COALESCE(COUNT(DISTINCT act_pv.id) FILTER (WHERE act_pv.created_at >= NOW() - INTERVAL '7 days'), 0)::int as page_views_count_week,
  COALESCE(COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '7 days'), 0)::int as rankings_count_week,
  COALESCE(COUNT(DISTINCT act_s.id) FILTER (WHERE act_s.created_at >= NOW() - INTERVAL '7 days'), 0)::int as searches_count_week,
  (COALESCE(COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at >= NOW() - INTERVAL '7 days'), 0) + 
   COALESCE(COUNT(DISTINCT act_pv.id) FILTER (WHERE act_pv.created_at >= NOW() - INTERVAL '7 days'), 0) + 
   COALESCE(COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '7 days'), 0) + 
   COALESCE(COUNT(DISTINCT act_s.id) FILTER (WHERE act_s.created_at >= NOW() - INTERVAL '7 days'), 0))::int as engagement_score_week,
  -- Monthly counts
  COALESCE(COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at >= NOW() - INTERVAL '30 days'), 0)::int as achievements_count_month,
  COALESCE(COUNT(DISTINCT act_pv.id) FILTER (WHERE act_pv.created_at >= NOW() - INTERVAL '30 days'), 0)::int as page_views_count_month,
  COALESCE(COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '30 days'), 0)::int as rankings_count_month,
  COALESCE(COUNT(DISTINCT act_s.id) FILTER (WHERE act_s.created_at >= NOW() - INTERVAL '30 days'), 0)::int as searches_count_month,
  (COALESCE(COUNT(DISTINCT ua.id) FILTER (WHERE ua.earned_at >= NOW() - INTERVAL '30 days'), 0) + 
   COALESCE(COUNT(DISTINCT act_pv.id) FILTER (WHERE act_pv.created_at >= NOW() - INTERVAL '30 days'), 0) + 
   COALESCE(COUNT(DISTINCT pr.id) FILTER (WHERE pr.created_at >= NOW() - INTERVAL '30 days'), 0) + 
   COALESCE(COUNT(DISTINCT act_s.id) FILTER (WHERE act_s.created_at >= NOW() - INTERVAL '30 days'), 0))::int as engagement_score_month,
  NOW() as last_updated_at
FROM users u
LEFT JOIN product_rankings pr ON pr.user_id = u.id
LEFT JOIN user_activities act_pv ON act_pv.user_id = u.id AND act_pv.activity_type = 'page_view'
LEFT JOIN user_achievements ua ON ua.user_id = u.id
LEFT JOIN user_activities act_s ON act_s.user_id = u.id AND act_s.activity_type = 'search'
WHERE u.active = true
GROUP BY u.id
HAVING (COALESCE(COUNT(DISTINCT ua.id), 0) + 
        COALESCE(COUNT(DISTINCT act_pv.id), 0) + 
        COALESCE(COUNT(DISTINCT pr.id), 0) + 
        COALESCE(COUNT(DISTINCT act_s.id), 0)) > 0
ON CONFLICT (user_id) DO NOTHING;

SELECT 'User engagement scores rollup table created and populated successfully' AS status;
