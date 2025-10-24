# Cache System Documentation

## Overview
The application uses 6 in-memory caches to optimize database queries and API calls.

## Cache Inventory

### 1. AchievementCache
- **Location**: `server/cache/AchievementCache.js`
- **Type**: Singleton
- **TTL**: 5 minutes (300s)
- **Stores**: Achievement definitions from database
- **Invalidation**: `AchievementCache.getInstance().invalidate()`
- **Auto-clears**: When achievements are seeded/updated

### 2. HomeStatsCache
- **Location**: `server/cache/HomeStatsCache.js`
- **Type**: Singleton
- **TTL**: 5 minutes (300s)
- **Stores**: Home page dashboard metrics (top rankers, top products, trending, debated)
- **Invalidation**: `HomeStatsCache.getInstance().invalidate()`
- **Notes**: Metrics cache

### 3. LeaderboardCache
- **Location**: `server/cache/LeaderboardCache.js`
- **Type**: Singleton with keyed entries
- **TTL**: 5 minutes (300s)
- **Stores**: Leaderboard data by period and limit (e.g., `all_time:50`)
- **Invalidation**: `LeaderboardCache.getInstance().invalidate()`
- **Notes**: Warmed on startup

### 4. MetadataCache
- **Location**: `server/cache/MetadataCache.js`
- **Type**: Class instance (not singleton)
- **TTL**: 30 minutes (1800s)
- **Stores**: Product metadata with animal/flavor enrichment
- **Invalidation**: `new MetadataCache().invalidate()`
- **Notes**: Products cache

### 5. LeaderboardPositionCache
- **Location**: `server/cache/LeaderboardPositionCache.js`
- **Type**: Singleton with keyed entries
- **TTL**: 5 minutes (300s)
- **Stores**: Individual user leaderboard positions (e.g., `user_2_all_time`)
- **Invalidation**: `LeaderboardPositionCache.getInstance().invalidateAll()`

### 6. RankingStatsCache
- **Location**: `server/cache/RankingStatsCache.js`
- **Type**: Class instance (not singleton)
- **TTL**: 30 minutes (1800s)
- **Stores**: Product ranking statistics (count, avg, best, worst, unique rankers)
- **Invalidation**: `new RankingStatsCache().invalidate()`
- **Notes**: Rankings cache

## Cache Clearing

### Manual Clear (Admin Tools)
Super admin only - clears all 6 caches:
```javascript
POST /api/admin/data/clear-cache
```

### Programmatic Clear
```javascript
// Clear all caches
AchievementCache.getInstance().invalidate();
HomeStatsCache.getInstance().invalidate();
LeaderboardCache.getInstance().invalidate();
new MetadataCache().invalidate();
LeaderboardPositionCache.getInstance().invalidateAll();
new RankingStatsCache().invalidate();
```

## Cache Warming
On server startup, 2 caches are pre-warmed:
- HomeStatsCache
- LeaderboardCache (all_time:5 and all_time:50)

## Design Patterns
- **Singleton**: AchievementCache, HomeStatsCache, LeaderboardCache, LeaderboardPositionCache
- **Instance**: MetadataCache, RankingStatsCache (instantiated in ProductsService)
