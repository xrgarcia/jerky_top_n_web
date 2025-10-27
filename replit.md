# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, inspired by jerky.com's design. This application allows users to view top-rated jerky products and create personal rankings through an interactive interface. The project aims to provide a comprehensive and engaging platform for jerky enthusiasts, featuring advanced product filtering, gamification, and real-time social interaction capabilities. The business vision is to create a leading platform for jerky enthusiasts, leveraging gamification and social features to drive engagement and establish a vibrant community around jerky tasting and ranking.

## Recent Changes (October 27, 2025)
- **FEATURE**: Unified achievement detail pages for all coin types (collection and engagement)
  - Backend: `/api/gamification/achievement/:id/products` now detects achievement type and returns appropriate data
  - Engagement achievements return progress data (current value, required value, percentage, tier, points earned)
  - Collection achievements return product grids (ranked vs unranked products)
  - Frontend: `achievementDetail.js` dynamically renders based on achievement type
  - Engagement detail pages show progress bars, tier badges (bronze→silver→gold→platinum→diamond), goal stats, and points earned
  - Collection detail pages maintain existing product grid functionality with ranked/unranked visual distinction
  - Consistent user experience across all 26 achievement types (4 engagement types × N coins + 3 collection types)
  - Mobile-responsive design with tier badge scaling and flexible layouts
- **FEATURE ENHANCEMENT**: Unique product and profile view engagement tracking
  - Added `calculateProductViewEngagement()` and `calculateProfileViewEngagement()` to EngagementManager
  - New engagement achievement types: `product_view_count`, `unique_product_view_count`, `profile_view_count`, `unique_profile_view_count`
  - Unique views tracked using `COUNT(DISTINCT page_identifier)` for accurate deduplication
  - Leverages existing page view infrastructure: `pageType` and `pageIdentifier` fields automatically logged by frontend
  - Product detail views (`#product/123`) and profile views (`#user/456`) tracked via app.js page routing
  - Updated progress metadata handling in `calculateProgress()` and `getStatKey()` for accurate UI display
  - Achievement evaluators support both total and unique view requirements
  - Enables achievements like "Browse 50 unique products" or "Visit 10 different user profiles"
- **FEATURE ENHANCEMENT**: Real-time engagement achievement awards on search actions
  - Added engagement achievement checking to `/api/products/search` (Products page) and `/api/search/global` (navigation bar)
  - Users now receive instant toast notifications when earning search-based achievements (e.g., "Be Curious" for 10+ searches)
  - Fire-and-forget async pattern preserves non-blocking search responses while checking achievements
  - Includes duplicate prevention via RecentAchievementTracker (5-minute TTL)
  - Automatically invalidates home stats and leaderboard caches when achievements are earned
  - Search-based achievements now award immediately upon threshold, not delayed until next ranking action
- **CRITICAL BUG FIX**: Fixed engagement achievements not being evaluated
  - **Root Cause**: EngagementManager queried for `collection_type = 'engagement'` but database stores `'engagement_collection'`
  - **Fix**: Updated query in `EngagementManager.checkAndUpdateEngagementAchievements()` to use `'engagement_collection'`
  - **Impact**: Engagement achievements (e.g., "Be Curious" for 10+ searches) now properly trigger and award points with toast notifications
  - Search logging already working correctly - 36 searches tracked for test user
  - Verified database query now successfully finds engagement achievements
- **ARCHITECTURAL REFACTORING**: Renamed AchievementManager to EngagementManager for clearer separation of concerns
  - **EngagementManager**: Handles engagement-based achievements (searches, page views, streaks, logins)
  - **CollectionManager**: Handles product-based achievements (static collections, dynamic collections, flavor coins)
  - Added engagement calculation methods following CollectionManager pattern: `calculateSearchEngagement()`, `calculatePageViewEngagement()`, `calculateStreakEngagement()`, `calculateLoginEngagement()`
  - New `checkAndUpdateEngagementAchievements()` method mirrors CollectionManager's structure for consistent achievement processing
  - Updated ranking flow to check engagement achievements and emit toast notifications
  - All service references updated across codebase (gamification.js, server.js, routes)
  - Follows senior-level OOP principles: Single Responsibility, Encapsulation, Dependency Injection
- **CRITICAL BUG FIX**: Fixed static collection achievements not being evaluated at runtime
  - Updated `CollectionManager.checkAndUpdateCustomProductCollections()` to include `'static_collection'` type in database queries
  - Updated `achievementsAdmin.js` to trigger background recalculation for new `'static_collection'` achievements
  - Static collections now properly award achievements when users rank required products
  - Maintains backward compatibility with legacy `'custom_product_list'` naming

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## System Architecture
The application features a modern web architecture designed for responsiveness, scalability, and real-time interaction.

### UI/UX Decisions
- **Design Inspiration**: Clean, professional aesthetic inspired by jerky.com, utilizing an earth tone color palette (parchment, sage green, wood brown, muted gold).
- **Responsiveness**: Fully responsive layout optimized for desktop, tablet, and mobile devices.
- **Hero Gamification Dashboard**: Transformed hero section into a live engagement dashboard with stats counters, social proof, user progress bar, and dual CTAs with real-time updates via WebSockets. Displays only on the homepage.
- **Minimal Page Headers**: Content pages use compact headers (~150-200px) with breadcrumbs, title, subtitle, and page-specific action buttons, providing a content-focused experience.
- **Unified Product Cards**: Consistent card styling across Products and Rank pages for visual consistency.
- **Home Page Dashboard**: Dynamic Bento Box layout with engaging micro-copy and interactive CTAs within widgets.
- **Interactive Ranking**: Dual ranking system supporting drag-and-drop for desktop and dropdown selection for mobile with visual cues, badges, and animated sorting icons.
- **Navigation**: Single Page Application (SPA) with hash routing, preserving state and supporting deep-linking. Features a dropdown menu under Community for quick access. All pages automatically refresh their data when navigated to, ensuring users always see current information without requiring manual page reloads.

### Technical Implementations
- **Frontend**: Built with Vanilla JavaScript, an event-driven architecture using `EventBus` for pub/sub, and `ServiceRegistry` for dependency injection.
- **Backend**: Implemented with Node.js and Express.js, following a repository pattern.
- **User Privacy**: `CommunityService` centralizes user data handling, truncating last names.
- **Real-time Communication**: Socket.IO facilitates real-time bidirectional communication.
- **Session Persistence**: Dual-layer authentication using httpOnly cookies and localStorage sessionId.
- **Product Management**: `ProductsService` combines external product data with metadata and ranking statistics, including advanced filtering.
- **Gamification Architecture**: Dual-manager pattern for achievement processing:
  - **EngagementManager**: Calculates and awards engagement-based achievements (searches, page views, streaks, logins). Mirrors CollectionManager pattern with calculation methods, tier progression, and update flow. Supports unique view tracking for products and profiles using SQL `COUNT(DISTINCT ...)`. Fully supports tiered achievements with bronze→silver→gold→platinum→diamond progression.
  - **CollectionManager**: Handles product-based achievements (static collections, dynamic collections, flavor coins) with tier progression.
  - Event-driven system tracks achievements, user progress, streaks, and populates real-time leaderboards and activity feeds.
  - Proportional point system awards points dynamically for tiered achievements across both managers.
  - Toast notifications emitted via WebSocket for all achievement types with duplicate prevention.
- **Page View Tracking**: Asynchronous tracking for all pages with data stored in a dedicated `page_views` table. Tracks `pageType` (e.g., 'product_detail', 'profile') and `pageIdentifier` (e.g., productId, userId) for detailed analytics and unique view calculations.
- **Timestamp Handling**: All database timestamps converted to ISO 8601 UTC on the server, with client-side relative time calculation.
- **Top Rankers**: Calculated by an engagement score (achievements + page views + rankings + searches).
- **Most Debated Products**: Identifies products with the highest ranking variance using PostgreSQL STDDEV.
- **Streak Tracking**: Calendar-day-based streak calculation with multi-layer validation.
- **Performance Optimizations**: Extensive use of OOP design patterns, caching strategies, and query optimization for various system components (achievement system, leaderboards, homepage stats).
- **Search**: Global unified search with type-ahead for products and community members, including client-side instant search.
- **Styling**: Custom CSS with earth tone color palette.
- **Database Connection Strategy**: Dual-connection architecture using Neon PostgreSQL. Most queries use a pooled connection, while critical-path queries (e.g., achievement calculations) use a dedicated primary-only connection to ensure immediate data consistency.

### Feature Specifications
- **Ranking**: View top N jerky products, persistent rankings, visual ranking modal with duplicate prevention and optimistic UI.
- **Products Page**: Advanced sorting, animal and flavor filtering, client-side instant search, and server-side pagination.
- **Rank Page Products**: Server-side filtering to exclude already-ranked products before pagination.
- **Community**: Discover users, search, view profiles with ranking statistics, and display top rankers widget.
- **Leaderboard**: Dedicated page showing top 50 rankers with engagement scores, badges, and user position highlighting.
- **User Profile**: Displays user information and ranking statistics.
- **Gamification**: Achievement tracking with four collection types:
  - **Engagement Collections**: User site engagement (searches, logins, ranking streaks, ranking activity)
  - **Static Collections**: Pre-defined product lists (curated flavor collections, specific product sets)
  - **Dynamic Collections**: Protein-category-based with tier progression
  - **Flavor Coins**: Single product achievements with optional tier progression
  - User progress tracking, streak tracking, real-time leaderboards, activity feeds, and notifications.
- **Admin Tools**: Role-based access for managing achievements and monitoring live users with real-time updates. Includes custom icon upload functionality. Supports all engagement achievement types including product view tracking, unique product browsing, profile views, and unique profile visits.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icon uploads.