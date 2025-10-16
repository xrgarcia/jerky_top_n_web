# Production Streak Data Cleanup

## Problem
Production database has severe data corruption in the streaks table:
- User 4 has 1,776+ **unique** streak_type values (corrupted data)
- Valid streak types should only be: `daily_rank`, `daily_login`
- This causes:
  - Slow API responses (5+ seconds)
  - Large JSON payloads that timeout
  - 500 errors due to response truncation

## Fix Applied
Updated `StreakRepository.getAllUserStreaks()` to:
1. Use `DISTINCT ON` to get only the most recent streak per type
2. **Filter for valid streak types only** (`daily_rank`, `daily_login`)
3. Add `LIMIT 10` as a safety measure
This prevents corrupted streak_type values from breaking the API.

## Optional: Clean Up Duplicate Data in Production

**⚠️ CAUTION: Run this during low traffic or maintenance window**

### Step 1: Check for corrupted data
```sql
-- See invalid streak types
SELECT streak_type, COUNT(*) as count
FROM streaks
WHERE streak_type NOT IN ('daily_rank', 'daily_login')
GROUP BY streak_type
ORDER BY count DESC
LIMIT 20;

-- Count total corrupted records
SELECT COUNT(*) as corrupted_count
FROM streaks
WHERE streak_type NOT IN ('daily_rank', 'daily_login');

-- Check duplicates of valid types
SELECT user_id, streak_type, COUNT(*) as count
FROM streaks
WHERE streak_type IN ('daily_rank', 'daily_login')
GROUP BY user_id, streak_type
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

### Step 2: Backup the streaks table
```sql
-- Create a backup before cleanup
CREATE TABLE streaks_backup_20251016 AS SELECT * FROM streaks;
```

### Step 3: Delete corrupted and duplicate data
```sql
-- First, delete all records with invalid streak_type values
DELETE FROM streaks
WHERE streak_type NOT IN ('daily_rank', 'daily_login');

-- Then, delete duplicates of valid types, keeping only the most recent
DELETE FROM streaks
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, streak_type) id
  FROM streaks
  WHERE streak_type IN ('daily_rank', 'daily_login')
  ORDER BY user_id, streak_type, updated_at DESC
);
```

### Step 4: Verify cleanup
```sql
-- Should show max count of 1 per user/type combination
SELECT user_id, streak_type, COUNT(*) as count
FROM streaks
GROUP BY user_id, streak_type
ORDER BY count DESC;

-- Check total streak count
SELECT COUNT(*) FROM streaks;
```

## Prevention
The code fix ensures duplicates are handled gracefully, but to prevent future duplicates:

1. Ensure `updateStreak()` is always used instead of creating new records
2. Consider adding a unique constraint: `UNIQUE(user_id, streak_type)`

### Add Unique Constraint (Optional)
```sql
-- This will prevent duplicate streaks from being created
ALTER TABLE streaks
ADD CONSTRAINT streaks_user_type_unique 
UNIQUE (user_id, streak_type);
```

**Note:** Only add this constraint AFTER cleaning up existing duplicates.
