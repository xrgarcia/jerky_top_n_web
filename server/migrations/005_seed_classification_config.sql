-- Migration: Seed classification_config table with initial configuration data
-- Created: 2025-11-13
-- Description: Inserts the required configuration rows for user classification system
--              (journey stages, engagement levels, exploration breadth, flavor communities)
-- Issue: JERKY-RANK-UI-2V - Classification jobs failing due to empty config table

-- Insert journey stage thresholds (only if key doesn't exist - preserves customizations)
INSERT INTO classification_config (config_key, config_value, description, updated_at, updated_by)
VALUES (
  'journey_stage_thresholds',
  '{"dormant": {"days_since_last_activity": 30}, "engaged": {"max_rankings": 30, "min_rankings": 11, "min_engagement_coins": 3}, "new_user": {"max_rankings": 0, "max_days_active": 7}, "exploring": {"max_rankings": 10, "min_rankings": 1, "min_activities": 5}, "power_user": {"min_rankings": 31, "min_login_streak": 3, "min_engagement_coins": 10}}'::jsonb,
  'Thresholds for determining user journey stage',
  NOW(),
  NULL
)
ON CONFLICT (config_key) DO NOTHING;

-- Insert engagement level rules (only if key doesn't exist - preserves customizations)
INSERT INTO classification_config (config_key, config_value, description, updated_at, updated_by)
VALUES (
  'engagement_level_rules',
  '{"low": {"min_activities_30d": 1, "max_engagement_coins": 2}, "high": {"max_engagement_coins": 19, "min_engagement_coins": 10}, "none": {"max_activities_30d": 0, "max_engagement_coins": 0}, "medium": {"max_engagement_coins": 9, "min_engagement_coins": 3}, "very_high": {"min_engagement_coins": 20}}'::jsonb,
  'Rules for categorizing user engagement levels',
  NOW(),
  NULL
)
ON CONFLICT (config_key) DO NOTHING;

-- Insert exploration breadth rules (only if key doesn't exist - preserves customizations)
INSERT INTO classification_config (config_key, config_value, description, updated_at, updated_by)
VALUES (
  'exploration_breadth_rules',
  '{"narrow": {"max_unique_animals": 1, "max_unique_flavors": 3}, "diverse": {"min_unique_animals": 3, "min_unique_flavors": 9}, "moderate": {"max_unique_flavors": 8, "min_unique_animals": 2, "min_unique_flavors": 4}}'::jsonb,
  'Rules for determining exploration breadth based on variety of ranked products',
  NOW(),
  NULL
)
ON CONFLICT (config_key) DO NOTHING;

-- Insert flavor community thresholds (only if key doesn't exist - preserves customizations)
INSERT INTO classification_config (config_key, config_value, description, updated_at, updated_by)
VALUES (
  'flavor_community_thresholds',
  '{"delivered_status": "delivered", "enthusiast_top_pct": 40, "explorer_bottom_pct": 40, "min_products_for_state": 1}'::jsonb,
  'Thresholds for flavor community state calculation: enthusiast (top 40% of rankings), explorer (bottom 40%), seeker (undelivered), taster (delivered but unranked)',
  NOW(),
  'system'
)
ON CONFLICT (config_key) DO NOTHING;

-- Verify all 4 required config keys exist
DO $$
DECLARE
  config_count INTEGER;
  missing_keys TEXT[];
BEGIN
  -- Check for all required keys
  SELECT ARRAY_AGG(required_key) INTO missing_keys
  FROM (VALUES 
    ('journey_stage_thresholds'),
    ('engagement_level_rules'),
    ('exploration_breadth_rules'),
    ('flavor_community_thresholds')
  ) AS required(required_key)
  WHERE NOT EXISTS (
    SELECT 1 FROM classification_config 
    WHERE config_key = required_key
  );
  
  IF missing_keys IS NOT NULL AND array_length(missing_keys, 1) > 0 THEN
    RAISE EXCEPTION 'Migration failed: Missing required config keys: %', missing_keys;
  END IF;
  
  SELECT COUNT(*) INTO config_count FROM classification_config;
  RAISE NOTICE 'Classification config successfully seeded: % rows (4 required keys present)', config_count;
END $$;
