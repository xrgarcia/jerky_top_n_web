# Production Migration Fix - Classification Config Seed

## Problem Summary
The `005_seed_classification_config` migration reported success but didn't insert data due to a critical bug in the migration runner. The Neon serverless driver's `sql.unsafe()` method only executes the **first statement** in a multi-statement SQL file and silently ignores the rest.

## Root Cause
- **Previous Implementation**: Used `neon()` HTTP driver with `sql.unsafe(migrationSQL)`
- **Issue**: Neon's HTTP driver executes only ONE statement per call
- **Result**: Multi-statement migrations (4 INSERTs + 1 DO block) appeared successful but only the first INSERT executed

## Fix Implemented
Switched to WebSocket-backed `Pool/Client` for true multi-statement execution with transactional guarantees:
- Uses `neonConfig.webSocketConstructor = ws` for Node.js WebSocket support
- Executes each migration in a `BEGIN -> query(file) -> COMMIT` transaction
- Provides automatic `ROLLBACK` on failure
- Properly handles complex PostgreSQL syntax (DO blocks, functions, triggers)

## Production Deployment Steps

### 1. Clean Up Production Database
Run this SQL in the **Production Database** panel:

```sql
-- Remove the false success record
DELETE FROM _migrations WHERE name = '005_seed_classification_config';

-- Verify it was removed
SELECT name FROM _migrations ORDER BY executed_at;
```

### 2. Deploy Fixed Migration Runner
The deployment configuration already includes `npm run db:migrate` in the build step, so:

1. **Push this fix to production** (commit is already made)
2. **Trigger deployment** 
3. **Monitor build logs** - should see `✅ Completed: 005_seed_classification_config`

### 3. Verify Production
After deployment, check the production database:

```sql
-- Should return 4 rows
SELECT config_key, description FROM classification_config ORDER BY id;
```

Expected output:
```
journey_stage_thresholds | Thresholds for determining user journey stage
engagement_level_rules | Rules for categorizing user engagement levels
exploration_breadth_rules | Rules for determining exploration breadth based on variety of ranked products
flavor_community_thresholds | Thresholds for flavor community state calculation: enthusiast (top 40% of rankings), explorer (bottom 40%), seeker (undelivered), taster (delivered but unranked)
```

### 4. Verify Sentry Warnings Resolved
The Sentry warnings about missing `journey_stage_thresholds` config should stop appearing after the migration runs successfully.

## Technical Details

### Before (Broken)
```javascript
const sql = neon(process.env.DATABASE_URL);
await sql.unsafe(migrationSQL); // Only executes first statement!
```

### After (Fixed)
```javascript
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

await client.query('BEGIN');
await client.query(migrationSQL); // Executes ALL statements
await client.query('COMMIT');
```

## Future Migration Best Practices
- ✅ Multi-statement SQL files now work correctly
- ✅ Complex PostgreSQL syntax (DO blocks, functions) fully supported
- ✅ True transactional guarantees with automatic rollback
- ✅ No need to split SQL files or avoid complex syntax
