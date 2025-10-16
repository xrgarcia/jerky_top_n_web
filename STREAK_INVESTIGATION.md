# Streak Data Corruption Investigation

## Root Cause Identified
**Critical Input Validation Vulnerability**

### The Problem
`server/routes/gamification.js` accepts `streakType` from request body without validation:
```javascript
const { streakType = 'daily_rank' } = req.body;
const streakUpdate = await streakManager.updateStreak(userId, streakType);
```

This allows clients to inject ANY value into the database as a streak_type.

### Valid Streak Types (as defined in schema.js)
- `'daily_rank'` - Daily ranking activity
- `'daily_login'` - Daily login activity (not currently used)

### Questions to Answer from Production Data

#### 1. What are the invalid streak_type values?
```sql
-- Get sample of corrupted streak types
SELECT streak_type, COUNT(*) as count
FROM streaks
WHERE streak_type NOT IN ('daily_rank', 'daily_login')
GROUP BY streak_type
ORDER BY count DESC
LIMIT 50;
```

#### 2. When were they created?
```sql
-- Timeline of corrupted data creation
SELECT 
  DATE(created_at) as date,
  COUNT(*) as corrupt_records
FROM streaks
WHERE streak_type NOT IN ('daily_rank', 'daily_login')
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### 3. Which users are affected?
```sql
-- User impact analysis
SELECT 
  user_id,
  COUNT(*) as corrupt_streak_count,
  COUNT(DISTINCT streak_type) as unique_corrupt_types,
  MIN(created_at) as first_corrupt,
  MAX(created_at) as last_corrupt
FROM streaks
WHERE streak_type NOT IN ('daily_rank', 'daily_login')
GROUP BY user_id
ORDER BY corrupt_streak_count DESC
LIMIT 20;
```

#### 4. Are there patterns in the corrupted values?
```sql
-- Look for patterns (e.g., typos, JSON fragments, etc.)
SELECT 
  streak_type,
  LENGTH(streak_type) as length,
  COUNT(*) as occurrences,
  MIN(created_at) as first_seen
FROM streaks
WHERE streak_type NOT IN ('daily_rank', 'daily_login')
GROUP BY streak_type, LENGTH(streak_type)
ORDER BY occurrences DESC
LIMIT 100;
```

## Immediate Fix Applied
Query now filters for valid types only:
```sql
WHERE streak_type IN ('daily_rank', 'daily_login')
LIMIT 10
```

## Comprehensive Solution Implemented

### 1. ✅ Input Validation (API Layer)
- Created `shared/constants.js` with `VALID_STREAK_TYPES` array
- Added validation in `server/routes/gamification.js` to reject invalid types
- Returns 400 error with warning log for invalid attempts

### 2. ✅ Service Layer Validation (Defense in Depth)
- Added validation in `StreakManager.updateStreak()` 
- Throws error if invalid type reaches service layer
- Prevents any path to database with invalid data

### 3. ✅ Query Layer Protection
- `StreakRepository.getAllUserStreaks()` filters for valid types only
- Added LIMIT 10 as safety measure
- Corrupted data cannot be retrieved even if it exists

### 4. 🔧 Database Constraint (Optional but Recommended)
- See `DATABASE_CONSTRAINT.sql` for CHECK constraint
- **Must run AFTER cleaning corrupted data**
- Prevents future corruption at database level

### 5. 📋 Data Cleanup (One-time Required)
- See `PRODUCTION_STREAK_CLEANUP.md` for cleanup SQL
- **Must be done before adding database constraint**
- Removes all invalid streak_type values

## Scale Considerations
- With 1,776+ corrupted records for ONE user, this could be exponentially worse with thousands of users
- Each corrupted record adds to query time and JSON payload size
- Without constraints, corruption can continue to accumulate
- Database indexes become ineffective with thousands of unique values
