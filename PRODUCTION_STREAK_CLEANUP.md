# Production Streak Data Cleanup

## Problem
Production database has accumulated duplicate streak records. For example, user 4 has 2,823 streak records when they should only have 1-5 (one per streak type).

This causes:
- Slow API responses (5+ seconds)
- Large JSON payloads that timeout
- 500 errors due to response truncation

## Fix Applied
Updated `StreakRepository.getAllUserStreaks()` to use `DISTINCT ON` to return only the most recent streak per type. This handles the duplicate data gracefully.

## Optional: Clean Up Duplicate Data in Production

**⚠️ CAUTION: Run this during low traffic or maintenance window**

### Step 1: Check for duplicates
```sql
-- See how many duplicate streaks exist per user
SELECT user_id, streak_type, COUNT(*) as count
FROM streaks
GROUP BY user_id, streak_type
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

### Step 2: Backup the streaks table
```sql
-- Create a backup before cleanup
CREATE TABLE streaks_backup_20251016 AS SELECT * FROM streaks;
```

### Step 3: Delete duplicates, keeping only the most recent
```sql
-- Delete all but the most recent streak per user per type
DELETE FROM streaks
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, streak_type) id
  FROM streaks
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
