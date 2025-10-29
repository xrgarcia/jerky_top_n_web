# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, inspired by jerky.com's design. This application allows users to view top-rated jerky products and create personal rankings through an interactive interface. The project aims to provide a comprehensive and engaging platform for jerky enthusiasts, featuring advanced product filtering, gamification, and real-time social interaction capabilities. The business vision is to create a leading platform for jerky enthusiasts, leveraging gamification and social features to drive engagement and establish a vibrant community around jerky tasting and ranking.

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
- **User Activation System**: Users have an `active` boolean flag (default: false) that gates community visibility:
  - **Webhook-Created Users**: Auto-created users from order webhooks default to `active=false` and remain hidden from community/leaderboard
  - **Login Activation**: First login sets `active=true`, making user visible in community features
  - **Community Filtering**: All community queries (CommunityService, LeaderboardManager) filter for `active=true` to show only engaged users
  - **Purpose**: Prevents community clutter from auto-created accounts that never engage with the platform
- **Real-time Communication**: Socket.IO facilitates real-time bidirectional communication with robust achievement notification delivery:
  - **Pending Achievement Queue**: WebSocketGateway maintains a temporary queue for achievements earned before socket authentication
  - **Race Condition Prevention**: `activeUsers` populated synchronously during auth to ensure `hasAuthenticatedSocket()` returns true immediately
  - **Multi-device Support**: Pending achievements flushed to entire `user:${userId}` room on authentication, reaching all connected devices
  - **Memory Management**: Periodic 5-minute cleanup removes stale pending entries older than 5-minute TTL
  - **Flavor Coin Accumulation**: All flavor coins accumulated without deduplication to preserve multiple drops of same flavor
  - **Reliable Delivery**: Achievements queued if socket not authenticated, then replayed on next authentication within 5-minute window
- **Session Persistence**: Dual-layer authentication using httpOnly cookies and localStorage sessionId.
- **Product Management**: `ProductsService` combines external product data with metadata and ranking statistics, including advanced filtering.
- **Shopify Synchronization**: Automatic synchronization system ensures products and metadata stay in sync with Shopify:
  - **Server Startup**: CacheWarmer automatically fetches products, syncs metadata, and cleans orphaned products on every server restart (non-blocking, ~7s)
  - **Cache Strategy**: MetadataCache and RankingStatsCache never expire - cache warms on startup and stays warm forever
  - **Selective Cache Updates**: Webhooks update only affected products instead of invalidating entire cache
    - Product webhooks update single product in MetadataCache using `updateProduct(shopifyProductId, metadata)` and reset timestamp
    - Order webhooks recalculate stats for affected products only using `updateProducts(statsMap)` and reset timestamp
  - **Shared Cache Instances**: Webhook routes receive shared cache instances from server.js to ensure consistency
  - **Orphan Cleanup**: Products removed from "rankable" tag in Shopify are automatically deleted from products_metadata during sync
  - **Cache Age Tracking**: Cache timestamp resets on both full loads (server startup) and partial updates (webhooks), tracking time since last activity
  - **Dual Cache Staleness Thresholds**: Admin dashboard provides separate configurable thresholds for each cache type with independent Sentry monitoring:
    - **Metadata Cache Threshold**: Default 168 hours (7 days) - products rarely change, suitable for longer staleness window
    - **Ranking Stats Cache Threshold**: Default 48 hours (2 days) - stats update with orders, requires shorter monitoring window
    - Each threshold independently configurable (1-720 hours) via admin dashboard "Manage Data" tab
    - Hourly monitoring sends distinct Sentry alerts tagged by cache type (metadata vs ranking_stats)
  - **Sentry Monitoring**: Separate alerts for metadata cache staleness and ranking stats cache staleness, plus alerts for Shopify API failures and orphaned product cleanup
  - **Fallback Handling**: Stale cache served as fallback when Shopify unavailable, with warning alerts
- **Gamification Architecture**: Dual-manager pattern for achievement processing:
  - **EngagementManager**: Calculates and awards engagement-based achievements (searches, page views, streaks, logins) with tiered progression (bronze→silver→gold→platinum→diamond). Supports unique view tracking for products and profiles.
  - **CollectionManager**: Handles product-based achievements (static collections, dynamic collections, flavor coins) with tier progression.
  - **ProgressTracker**: Calculates comprehensive progress across all achievement types, finding the closest unearned achievement by percentage complete. Supports both collection format (`totalRanked/totalAvailable`) and engagement format (`current/required`) for unified progress tracking.
  - Event-driven system tracks achievements, user progress, streaks, and populates real-time leaderboards and activity feeds.
  - Proportional point system awards points dynamically for tiered achievements across both managers.
  - Toast notifications emitted via WebSocket for all achievement types with duplicate prevention.
- **Page View Tracking**: Asynchronous tracking for all pages with data stored in a dedicated `page_views` table, including `pageType` and `pageIdentifier` for detailed analytics.
- **Timestamp Handling**: All database timestamps converted to ISO 8601 UTC on the server, with client-side relative time calculation.
- **Top Rankers**: Calculated by an engagement score (achievements + page views + rankings + searches).
- **Most Debated Products**: Identifies products with the highest ranking variance using PostgreSQL STDDEV.
- **Streak Tracking**: Calendar-day-based streak calculation with multi-layer validation.
- **Performance Optimizations**: Extensive use of OOP design patterns, caching strategies, and query optimization.
- **Search**: Global unified search with type-ahead for products and community members, including client-side instant search.
- **Styling**: Custom CSS with earth tone color palette.
- **Database Connection Strategy**: Dual-connection architecture using Neon PostgreSQL, with pooled connections for most queries and dedicated primary-only connections for critical-path queries.

### Feature Specifications
- **Ranking**: View top N jerky products, persistent rankings, visual ranking modal with duplicate prevention and optimistic UI. **Hybrid reliability system** ensures bulletproof save delivery:
  - **Client-side**: IndexedDB-backed persistent queue survives page refreshes, browser crashes, and network failures
  - **Server-side**: Operation ID-based idempotency prevents duplicate saves
  - **Automatic retry**: Exponential backoff (1s → 30s max, 5 attempts) with network detection
  - **Recovery**: Pending operations automatically processed on page reload
- **Products Page**: Advanced sorting, animal and flavor filtering, client-side instant search, and server-side pagination.
- **Rank Page Products**: Server-side filtering to exclude already-ranked products before pagination. **Purchase-based restriction**: Non-employee users can only rank products they've purchased from Shopify, with automatic order synchronization on login and graceful fallback during sync.
- **Purchase History System**: Automatic background synchronization of Shopify orders on user login:
  - **Order Sync**: Background job fetches user's Shopify orders and stores purchase history in `customer_orders` table
  - **Caching Strategy**: 30-minute TTL cache reduces API calls and database queries
  - **Singleton Service**: Shared PurchaseHistoryService instance ensures cache persistence across requests
  - **Database Indexes**: Optimized indexes on `user_id`, `(user_id, shopify_product_id)`, and `(user_id, order_date)` for efficient lookups
  - **Employee Bypass**: Users with @jerky.com email or employee_admin role can rank all products without purchase restriction
  - **Graceful Degradation**: If purchase history is empty (during initial sync or no orders), users see all unranked products to prevent empty state
  - **Real-time Webhook Updates**: Shopify webhooks maintain real-time synchronization of customer orders and product metadata
- **Shopify Webhook Integration**: Real-time synchronization system for customer orders and product data:
  - **Order Webhooks**: Automated handlers for orders/create, orders/updated, and orders/cancelled events that update `customer_orders` table
  - **Product Webhooks**: Handlers for products/update and products/create events that sync `products_metadata` with latest animal types and flavors
  - **Security**: HMAC SHA-256 signature verification with fail-closed policy and timing-safe comparison using crypto.timingSafeEqual
  - **Orphan Cleanup**: Automatic removal of customer_orders records for cancelled orders or line items removed from order updates
  - **Zero-Quantity Handling**: Line items with quantity 0 are automatically deleted from customer_orders
  - **Cache Invalidation**: User-specific (PurchaseHistoryService) and global caches (MetadataCache, RankingStatsCache) invalidated on all modifying webhooks
  - **Automatic Registration**: All 5 webhooks automatically registered with Shopify Admin API on server startup with deduplication
  - **Error Monitoring**: Comprehensive Sentry logging for webhook failures and processing errors
- **Community**: Discover users, search, view profiles with ranking statistics, and display top rankers widget.
- **Leaderboard**: Dedicated page showing top 50 rankers with engagement scores, badges, and user position highlighting.
- **User Profile**: Displays user information and ranking statistics.
- **Gamification**: Achievement tracking with four collection types:
  - **Engagement Collections**: User site engagement (searches, logins, ranking streaks, ranking activity, product views, profile views).
  - **Static Collections**: Pre-defined product lists.
  - **Dynamic Collections**: Protein-category-based with tier progression.
  - **Flavor Coins**: Single product achievements with optional tier progression.
  - User progress tracking, streak tracking, real-time leaderboards, activity feeds, and notifications.
- **Admin Tools**: Role-based access for managing achievements and monitoring live users with real-time updates, including custom icon upload functionality. **Customer Orders dashboard** displays all Shopify orders synced via webhooks:
  - **Filterable Table**: Filter by order number, customer email, product ID, SKU, and date range with server-side pagination (50 orders per page)
  - **Sortable Columns**: Click column headers to sort by order number, customer email, SKU, quantity, or order date with visual indicators (▲/▼ arrows and gold highlighting)
  - **Data Display**: Shows order details, customer information, product IDs, quantities, and line item data from `customer_orders` table
  - **Repository Pattern**: CustomerOrdersRepository with dynamic filtering and sorting using Drizzle ORM's immutable query builder
  - **Access Control**: Requires employee_admin role or @jerky.com email to view synced orders

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icon uploads.