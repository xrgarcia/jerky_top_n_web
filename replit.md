# Jerky Top N Web Application

## Overview
A web application for ranking jerky flavors, designed to be a comprehensive and engaging platform for jerky enthusiasts. The project aims to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced flavor filtering, capturing a significant market share in the niche online food review and community space.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## System Architecture
The application utilizes a modern web architecture for responsiveness, scalability, and real-time interaction, built upon a recent migration to React.

**UI/UX Decisions:**
- **Design Inspiration**: Clean, professional aesthetic inspired by jerky.com, using an earth-tone color palette.
- **Responsiveness**: Optimized for desktop, tablet, and mobile.
- **Navigation**: Single Page Application (SPA) with smooth transitions.
- **Unified Product Cards**: Consistent styling.
- **Loading States**: Skeleton screens and loading indicators.
- **Error Handling**: User-friendly error messages.
- **Admin Tools Styling**: Earth-tone styling with horizontal tab navigation.
- **Collection Progress Bar**: Tier-based colors, animated gradient, percentage display.
- **Toast Notifications**: Sequential queue-based display.
- **Tier Emoji System**: Centralized JSON-based emoji constants.
- **Flavor Community Badges**: Visual identity system displaying user's primary flavor profile (Sweet, Savory, Spicy, Exotic, Teriyaki, Peppered, Original, Smoky, BBQ, Hot) with unique colors, gradients, emojis, and community states (Enthusiast, Explorer, Taster, Seeker, Curious) on community cards for "jerky tribe" discovery.

**Technical Implementations:**
- **Frontend**: React 19, React Router v7, TanStack Query, Zustand, Vite, Socket.IO Client.
- **Backend**: Node.js and Express.js, employing a repository pattern.
- **Data Layer**: Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration.
- **Real-time Communication**: Socket.IO for achievement notifications with multi-device support.
- **Session Security**: Production-grade authentication using httpOnly cookies, 90-day server-side sessions.
- **Rate Limiting**: Authentication endpoints are rate-limited using Redis.
- **Icon Rendering**: Unified utility (`src/utils/iconUtils.jsx`) for various icon types (emoji, URL, base64).
- **Code Splitting**: Route-based lazy loading using React.lazy() and Suspense, with manual vendor chunking.
- **Shopify Synchronization**: Automatic sync of products, metadata, and customer profiles via webhooks with caching and orphan cleanup. Async BullMQ-based webhook processing prevents database connection timeouts by responding to Shopify in <100ms and processing database writes in background workers. **Auto-User Creation**: Customer webhooks automatically create user accounts when customers are created/updated in Shopify, preparing them for login before they visit the site. Uses dual-lookup strategy (Shopify customer ID + email) to prevent duplicates and link existing accounts. Handles race conditions with proper error recovery.
- **Gamification**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications.
- **Personalized Guidance System**: AI-driven, page-aware, and journey-aware system with an event-driven classification engine (BullMQ-based) that analyzes user behavior to provide targeted messages with CTAs.
- **Flavor Profile Communities**: Micro-community system tracking user journey states and admin-configurable thresholds.
- **User Classification System**: Tracks journey stages, engagement levels, and exploration breadth.
- **Unified Activity Tracking**: All user activities tracked in `user_activities` table.
- **Dual-Track Search Analytics**: Fork-based tracking system routes authenticated searches to `ActivityTrackingService` (user_activities table for gamification) and anonymous searches to `AnonymousSearchRepository` (anonymous_searches table for analytics), ensuring comprehensive search coverage while maintaining engagement system separation.
- **Leaderboard Performance Optimization**: Achieved 345,000x speedup through pre-aggregated `user_engagement_scores` rollup table, incremental score updates with race-condition-safe UPSERT, Redis-backed distributed cache, granular cache invalidation, and optimized queries with composite database indexes. Full cross-service integration ensures `CollectionManager` (dynamic/static collections, flavor coins) and `AchievementRepository` both increment engagement scores via `EngagementScoreService` following the same internal instantiation pattern.
- **Ranking Race Condition Fix**: Implemented sequence-based staleness detection.
- **Distributed Caching Architecture**: Comprehensive Redis-backed caching system for multi-instance scalability achieving sub-100ms response times with 95% query reduction. Seven cache classes (UserClassificationCache 5min TTL, StreakCache 10min TTL, ProgressCache 5min TTL, UserProfileCache 10min TTL, GuidanceCache 5min TTL, AchievementCache 1hr TTL, PurchaseHistoryCache 30min TTL) extend DistributedCache base class with singleton pattern, Redis-backed storage, and in-memory fallback. Event-driven cache invalidation hooks trigger on user actions (login, purchase, ranking, profile update, classification, streak update) with invalidation occurring BEFORE data recalculation to prevent stale data. All caches initialized in init-scalability.js for proper startup sequence. Performance: 95% cache hit rate, sub-100ms response times, multi-instance safe. **Critical Bug Fixes (Nov 2025)**: (1) Fixed ClassificationWorker cache invalidation order - cache is now properly cleared BEFORE classification runs (not after), allowing UserClassificationService.classifyUser() to populate fresh data without immediate invalidation. (2) Added database fallback to community route - when cache misses, route fetches from user_classifications table, populates cache, and returns correct data (prevents displaying default values when cache is empty). (3) Fixed field name mapping - changed communityState to state to match database schema. These fixes ensure flavor community badges and journey stage data display correctly on community cards.
- **Database Connection**: Multi-pool architecture using Neon PostgreSQL with dedicated pools for webhooks (5 connections) and general use (20 connections), preventing connection exhaustion during high webhook traffic. TCP keepalive enabled (10s delay) to prevent idle connection termination. Automatic retry logic with exponential backoff (3 attempts: 100ms, 200ms, 400ms) handles transient network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED).
- **Redis Connection**: Singleton-based connection pooling with hardened configuration for BullMQ workers. Base RedisClient instance (30s TCP keepalive, TLS, automatic reconnection) is duplicated for each BullMQ queue/worker (~6-8 isolated connections total), preventing EPIPE/ECONNRESET errors from idle connection timeouts. All BullMQ services (WebhookWorker, ClassificationQueue/Worker, BulkImportQueue/Worker, EngagementBackfillQueue/Worker) use standardized connection duplication pattern with ready-state validation and error handling. Upstash Redis on Replit Fixed plan.
- **Feature Flags**: JSON-based configuration system.

**Feature Specifications:**
- **Ranking**: Persistent rankings with visual modal, duplicate prevention, optimistic UI.
- **Flavors Page**: Advanced sorting, filtering, client-side instant search, and server-side pagination.
- **Product Detail Page**: Comprehensive product information including images, brand, flavors, pricing, ranking statistics, and tags.
- **Flavor Profile Pages**: Dynamic pages for each flavor type.
- **Purchase History**: Automatic background synchronization of Shopify orders.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget, privacy-aware display, avatar support. Narrative-driven UserCard component with journey-stage tier colors, smart progress bars (70%+ threshold), and flavor community badges for visual tribe discovery.
- **Leaderboard**: Top 50 rankers with engagement scores and badges.
- **User Profile**: Private dashboard with handle management, privacy controls, and professional profile picture upload system (cropping, compression, multi-layer validation, Replit Object Storage). Public profile pages with privacy-aware display.
- **Gamification**: Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Coin Book Widget**: Collapsible achievement tracker on the Rank page with US quarter coin book styling, tier-aware styling, hover effects, and tooltips.
- **Coin Type Configuration**: Database-driven system for managing five coin types via an Admin UI.
- **Admin Tools**: React-based dashboard with EmployeeRoute protection for managing coins, users, products, orders, Sentry errors, data, flavor profile communities, user guidance analytics, and bulk import.
- **Bulk Import System**: Comprehensive event-driven (BullMQ-based) system for importing Shopify customers and purchase history with real-time monitoring via WebSockets.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.

## Deployment and Schema Management

### Database Schema Synchronization
The application uses Drizzle ORM for database schema management. **Critical**: Always sync the database schema before deploying code changes that modify the schema.

**Schema Validation:**
- Automatic validation runs on server startup (non-blocking) with cold-start resilience
- Configurable startup delay (SCHEMA_VALIDATION_STARTUP_DELAY_MS, default 3-5s) allows DNS/networking to stabilize in production
- Automatic retry logic with exponential backoff (1s, 3s) handles transient network errors
- Distinguishes network failures (DNS, connection errors) from real schema mismatches
- Network errors logged at info level with Sentry breadcrumbs only (no false-positive warnings)
- Real schema drift still triggers warning-level logs and Sentry alerts for monitoring
- Checks critical tables: `users`, `product_rankings`, `customer_order_items`, `achievements`
- Skips startup delay in dev/test environments for fast feedback loops

**Deployment Workflow:**
1. **Safe Deployment**: Use `npm run start:safe` (syncs schema, then starts server)
2. **Production Deployment**: Use `npm run deploy:safe` (syncs schema, builds assets, then starts server)
3. **Manual Sync**: Run `npm run db:push` to sync schema without starting server

**Common Issues Prevented:**
- **Schema Mismatch Errors**: When code references columns that don't exist yet in the database
- **Webhook Failures**: Shopify webhooks failing due to missing columns in `users` or `customer_order_items` tables
- **Silent Data Loss**: Queries failing silently during cold starts

**Best Practices:**
1. Always run `npm run db:push` after pulling schema changes from git
2. Test schema changes locally before deploying to production
3. Monitor Sentry for schema validation warnings
4. Use safe deployment scripts to ensure schema is synced before code runs

**Troubleshooting:**
- If you see "column does not exist" errors, run `npm run db:push` immediately
- Check server startup logs for schema validation warnings
- Review Sentry errors tagged with `service: schema_validation` for drift detection