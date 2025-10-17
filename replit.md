# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, inspired by jerky.com's design. This application allows users to view top-rated jerky products and create their own personal rankings through an interactive drag-and-drop or dropdown interface. The project aims to provide a comprehensive and engaging platform for jerky enthusiasts, featuring advanced product filtering, gamification, and real-time social interaction capabilities.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## System Architecture
The application features a modern web architecture designed for responsiveness, scalability, and real-time interaction.

### UI/UX Decisions
- **Design Inspiration**: Clean, professional design aesthetic inspired by jerky.com, utilizing a blue/purple color scheme.
- **Responsiveness**: Fully responsive layout optimized for desktop, tablet, and mobile devices.
- **Interactive Ranking**: Dual ranking system supporting drag-and-drop for desktop and dropdown selection for mobile.
- **Visual Cues**: Product images in ranking modals, visual badges for flavor profiles and average rankings, and animated sorting icons.
- **Navigation**: SPA with hash routing, preserving state on page refresh, and deep-linking support for products and user profiles.

### Technical Implementations
- **Frontend**: Built with Vanilla JavaScript and an event-driven architecture utilizing an `EventBus` for pub/sub communication and `ServiceRegistry` for dependency injection. Key domain services include Gamification, Social Proof, Activity Feed, Progress Tracking, and Leaderboard, supported by reusable UI components for notifications and widgets. Page navigation triggers automatic data reloading: achievements and streaks are always refreshed when navigating to the rank page, ensuring users see up-to-date progress regardless of navigation path (direct link, referrer, or site navigation).
- **Backend**: Implemented with Node.js and Express.js, following a repository pattern for data access. Domain services like `AchievementManager`, `LeaderboardManager`, `ProgressTracker`, `StreakManager`, and `CommunityService` handle core business logic.
- **User Privacy**: Centralized `CommunityService` handles all user data formatting with last name truncation (e.g., "John D." instead of "John Doe") for privacy across all features including top rankers, community pages, leaderboards, and search results.
- **Real-time Communication**: Powered by Socket.IO for real-time bidirectional communication, enabling live updates for achievements, streaks, and notifications.
- **Session Persistence**: Dual-layer authentication using httpOnly cookies and localStorage sessionId. PostMessage listener with origin validation (same-origin only) and payload validation receives authentication from Shopify popup and stores sessionId in localStorage. WebSocket re-authenticates using localStorage sessionId on reconnect, validated against database sessions to maintain user authentication across server restarts.
- **Product Management**: A centralized `ProductsService` combines product data from external sources with metadata and ranking statistics. Advanced filtering includes animal categories (15 unique types with icons and counts) and flavor profiles (8 distinct types with visual badges and searchability).
- **Gamification**: An event-driven system tracks 17 achievements (including dynamic "Complete Collection" for ranking all available products), user progress with dynamic milestone tracking based on actual achievement definitions, streaks, and populates real-time leaderboards and activity feeds. The milestone system automatically adapts to product catalog changes. Streak tracking runs asynchronously during ranking saves to credit users for consecutive daily ranking activity without slowing down API responses. Brand-based discovery achievements (Taste Explorer, Flavor Adventurer, Global Taster) are calibrated to match the actual product catalog (3 brands: 1, 2, 3 brands respectively).
- **Page View Tracking**: Comprehensive async tracking system for all pages (home, products, community, product_detail, profile) following OOP principles with `PageViewService` (backend) and `PageViewTracker` (frontend). Fire-and-forget pattern ensures non-blocking async tracking. Data stored in dedicated `page_views` table with page type, optional identifier, referrer, and timestamp. Product detail views are also bridged to legacy `product_views` table for compatibility.
- **Timestamp Handling**: All database timestamps are explicitly converted to ISO 8601 UTC format (with 'Z' suffix) on the server before sending to clients. Client-side `getTimeAgo` function validates timestamps and calculates relative time (e.g., "2h ago", "5d ago") with proper UTC timezone handling. Edge cases like invalid timestamps and future dates are gracefully handled with fallback displays.
- **Top Rankers**: Calculated by engagement score (sum of achievements + page views + rankings + searches), providing a comprehensive measure of user activity across all interactions. Displays total engagement count without breakdown for simplicity. Both home and community pages auto-refresh on navigation and WebSocket updates to ensure consistent engagement scores.
- **Most Debated Products**: Identifies products with highest ranking variance (disagreement) using PostgreSQL STDDEV. Requires minimum 2 rankings with actual variance (STDDEV > 0) to ensure only products with genuine disagreement appear. Products sorted by variance descending to highlight community debate.
- **Streak Tracking**: Calendar-day-based streak calculation (UTC normalized) ensures consistent streak detection across timezones. Daily ranking streaks update automatically when users rank products, with real-time WebSocket notifications for streak continuations and breaks. Multi-layer validation (API, service, query) enforces valid streak types ('daily_rank', 'daily_login') preventing data corruption. The `getAllUserStreaks` query uses `DISTINCT ON` with type filtering and LIMIT 10 to return only valid streaks, protecting against corrupted data and API timeouts.
- **Performance Optimizations**: System optimized using OOP design patterns, caching strategies, and query optimization:
  - **Achievement System** (~95% faster, 10s → 300-400ms):
    - **SQL Aggregation**: `getUserTotalPoints()` uses SQL SUM() instead of JavaScript reduce, reducing query time from ~150ms to ~8ms
    - **Facade Pattern**: `UserStatsAggregator` batches database queries with Promise.all, reducing achievement route latency from ~300ms to ~120ms
    - **Singleton Pattern**: `AchievementCache` with 1-hour TTL caches achievement definitions, improving cache hit performance from ~100ms to ~15ms. Cache automatically invalidates when definitions are seeded/updated
    - **Product Count Optimization**: `getRankableProductCount()` eliminates unnecessary full product fetching (163 products) from achievements endpoint, using cached count instead
  - **Leaderboard Position** (~93% faster, 4-5s → 280-350ms):
    - **COUNT-based Query**: `getUserPosition()` uses optimized CTE with COUNT() subqueries instead of window functions scanning all users
    - **Position Cache**: `LeaderboardPositionCache` singleton with 5-minute TTL and period-aware keys (all_time, week, month) prevents repeated expensive queries
    - Cache invalidation hooks on ranking changes ensure data consistency
    - Single optimized query with HAVING clause filters active users efficiently
    - **Future optimization path**: Materialized views or pre-aggregated stats needed to reach <100ms target
- **Search**: Global unified search with type-ahead functionality, searching both products and community members. Client-side instant search for products with multi-word support.
- **Styling**: Custom CSS for a consistent look and feel.

### Feature Specifications
- **Ranking**: View top N jerky products (3, 5, or 8), persistent rankings with database storage, and a visual ranking modal with product images. Multi-layer duplicate prevention validates that no product can be ranked twice through client-side pre-checks (`isProductAlreadyRanked`), server-side validation, and smart event emission that only fires for newly added products.
- **Products Page**: Advanced sorting (Name, Recently Ranked, Avg Ranking, Total Rankings), animal and flavor filtering, client-side instant search, and server-side pagination (20 products per page) with dynamic "Load More" button showing remaining count ("Load 20 more products" or "Load X more products").
- **Rank Page Products**: Server-side filtering via `/api/products/rankable` endpoint using `ProductRankingRepository` and `ProductsService.getRankableProductsForUser()` to exclude already-ranked products BEFORE pagination. Ensures users with extensive ranking history (70+ products) always see unranked products on initial load without manual pagination. Event-driven product removal: when products are successfully ranked and saved, they are immediately removed from the available products list using `product:ranked` events, providing instant visual feedback.
- **Community**: Discover users, search by name or ranked products, and view user profiles with ranking statistics.
- **User Profile**: Displays user information, ranking statistics, and links to update external profiles.
- **Gamification**: Achievement tracking, user progress monitoring, streak tracking, real-time leaderboards, live activity feeds, and real-time notifications.
- **Admin Tools**: Role-based access for @jerky.com employees with dedicated Tools section featuring:
  - **Manage Achievements**: View all achievements with tier, category, requirements, points, and earning statistics in a sortable table
  - **Live Users**: Real-time monitoring of active users on the site, showing current page, connection time, and activity. Features WebSocket-based live updates with employee-only access and privacy-preserving data sanitization (last name truncation, email redaction for non-employees)

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM for all data persistence. Dual migration system: `npm run db:push` for schema changes (tables, columns), `npm run db:migrate` for custom SQL (indexes, constraints). Migration tracking in `_migrations` table ensures idempotent execution. Performance indexes on foreign keys and timestamps reduce leaderboard queries from 4s to <300ms.
- **Error Tracking**: Sentry.io for error monitoring and performance tracking, integrated into services with detailed context.
- **Real-time**: Socket.IO for WebSocket communication.
- **Email**: Custom SMTP service using nodemailer with Google Workspace (no-reply@jerky.com) for authentication magic links. Requires EMAIL_PASSWORD (App Password), SMTP_HOST (smtp.gmail.com), and SMTP_PORT (587) environment variables.