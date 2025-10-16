-- Database Constraint for Streak Types
-- This prevents corrupted streak_type values at the database level

-- Add CHECK constraint to enforce valid streak types
ALTER TABLE streaks
ADD CONSTRAINT streaks_type_check 
CHECK (streak_type IN ('daily_rank', 'daily_login'));

-- Note: Run this AFTER cleaning up corrupted data
-- If you run this before cleanup, it will fail due to existing invalid values

-- To verify the constraint is in place:
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'streaks'::regclass
  AND conname = 'streaks_type_check';
