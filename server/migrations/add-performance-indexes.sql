-- Performance indexes for high-concurrency queries (1K-5K users)
-- Run this with: npm run db:execute-sql < server/migrations/add-performance-indexes.sql

-- User achievements indexes (frequent joins and lookups)
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_achievement ON user_achievements(user_id, achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_earned_at ON user_achievements(earned_at DESC);

-- Product rankings indexes (high-frequency queries)
CREATE INDEX IF NOT EXISTS idx_product_rankings_user_id ON product_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_product_rankings_shopify_product_id ON product_rankings(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_product_rankings_ranking_list_id ON product_rankings(ranking_list_id);
CREATE INDEX IF NOT EXISTS idx_product_rankings_user_list ON product_rankings(user_id, ranking_list_id);
CREATE INDEX IF NOT EXISTS idx_product_rankings_updated_at ON product_rankings(updated_at DESC);

-- Page views indexes (analytics queries)
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_type ON page_views(page_type);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_user_page_date ON page_views(user_id, page_type, viewed_at DESC);

-- Activity logs indexes (community feed queries)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_is_public ON activity_logs(is_public);
CREATE INDEX IF NOT EXISTS idx_activity_logs_public_created ON activity_logs(is_public, created_at DESC);

-- Streaks indexes (leaderboard and user profile queries)
CREATE INDEX IF NOT EXISTS idx_streaks_user_id ON streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_streaks_streak_type ON streaks(streak_type);
CREATE INDEX IF NOT EXISTS idx_streaks_user_type ON streaks(user_id, streak_type);
CREATE INDEX IF NOT EXISTS idx_streaks_current_streak ON streaks(current_streak DESC);

-- User product searches indexes (search analytics)
CREATE INDEX IF NOT EXISTS idx_user_product_searches_user_id ON user_product_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_searches_searched_at ON user_product_searches(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_product_searches_page_name ON user_product_searches(page_name);

-- Sessions indexes (authentication lookups)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Products metadata indexes (product filtering)
CREATE INDEX IF NOT EXISTS idx_products_metadata_animal_type ON products_metadata(animal_type);
CREATE INDEX IF NOT EXISTS idx_products_metadata_primary_flavor ON products_metadata(primary_flavor);

-- Print success message
SELECT 'Performance indexes created successfully' AS status;
