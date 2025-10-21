# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, inspired by jerky.com's design. This application allows users to view top-rated jerky products and create their own personal rankings through an interactive drag-and-drop or dropdown interface. The project aims to provide a comprehensive and engaging platform for jerky enthusiasts, featuring advanced product filtering, gamification, and real-time social interaction capabilities. The business vision is to create a leading platform for jerky enthusiasts, leveraging gamification and social features to drive engagement and establish a vibrant community around jerky tasting and ranking.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## System Architecture
The application features a modern web architecture designed for responsiveness, scalability, and real-time interaction.

### UI/UX Decisions
- **Design Inspiration**: Clean, professional design aesthetic inspired by jerky.com, utilizing an **earth tone color palette** (parchment background #f5f3ed, sage green accents #7b8b52, wood brown typography #3b2f25, muted gold #c4a962).
- **Responsiveness**: Fully responsive layout optimized for desktop, tablet, and mobile devices.
- **Hero Gamification Dashboard**: Transformed hero section into a live engagement dashboard featuring live stats counters, a social proof slider, user progress bar, and dual CTAs with real-time updates via WebSockets. Displays only on homepage for maximum engagement.
- **Minimal Page Headers**: Content pages (Products, Community, Rank, Profile, Tools) use compact ~150-200px headers with breadcrumbs, page title with icon, subtitle, and page-specific action buttons. Features sage green gradients, sage green borders, wood brown breadcrumbs, and responsive design for mobile devices. Provides content-focused experience without hero distraction.
- **Unified Product Cards**: Products and Rank pages share consistent card styling with 14px titles, 12px vendor names, 14px prices, and full-height images (auto-scaling with min-height constraints). Ensures visual consistency across all product displays.
- **Home Page Dashboard**: Dynamic Bento Box layout with engaging micro-copy and interactive CTAs within widgets. Includes quick-action buttons on product items and improved empty states with encouraging CTAs. Accessibility is ensured with proper `aria-labels` and touch-friendly targets.
- **Interactive Ranking**: Dual ranking system supporting drag-and-drop for desktop and dropdown selection for mobile with visual cues, badges, and animated sorting icons.
- **Navigation**: Single Page Application (SPA) with hash routing (#home, #products, #leaderboard, etc.), preserving state and supporting deep-linking. URL hash is the single source of truth for routing. Browser back/forward buttons work correctly with proper history management. Protected route redirects use history.replaceState() to avoid navigation loops. SPA navigation controls hero section visibility (shown only on homepage). Features dropdown menu under Community navigation for quick access to Community and Leaderboard pages.

### Technical Implementations
- **Frontend**: Built with Vanilla JavaScript, an event-driven architecture using `EventBus` for pub/sub, and `ServiceRegistry` for dependency injection. Key services handle gamification, social proof, activity feeds, progress tracking, and leaderboards. Page navigation triggers automatic data reloading for achievements and streaks.
- **Backend**: Implemented with Node.js and Express.js, following a repository pattern. Domain services like `AchievementManager`, `LeaderboardManager`, `ProgressTracker`, `StreakManager`, and `CommunityService` manage business logic.
- **User Privacy**: `CommunityService` centralizes user data handling, truncating last names for privacy.
- **Real-time Communication**: Socket.IO facilitates real-time bidirectional communication for live updates and notifications.
- **Session Persistence**: Dual-layer authentication using httpOnly cookies and localStorage sessionId, with WebSocket re-authentication.
- **Product Management**: `ProductsService` combines external product data with metadata and ranking statistics. Advanced filtering includes animal categories and flavor profiles.
- **Gamification**: An event-driven system tracks 17 achievements (including dynamic "Complete Collection"), user progress with dynamic milestone tracking, streaks, and populates real-time leaderboards and activity feeds. Streak tracking runs asynchronously.
- **Page View Tracking**: Asynchronous tracking system for all pages using `PageViewService` (backend) and `PageViewTracker` (frontend) with data stored in a dedicated `page_views` table.
- **Timestamp Handling**: All database timestamps are explicitly converted to ISO 8601 UTC format on the server, with client-side `getTimeAgo` function for relative time calculation.
- **Top Rankers**: Calculated by an engagement score (achievements + page views + rankings + searches). Both home and community pages auto-refresh.
- **Most Debated Products**: Identifies products with the highest ranking variance using PostgreSQL STDDEV, requiring a minimum of two rankings with actual variance.
- **Streak Tracking**: Calendar-day-based streak calculation (UTC normalized) with multi-layer validation and optimized database queries.
- **Performance Optimizations**: Extensive use of OOP design patterns, caching strategies, and query optimization for achievement system (SQL aggregation, Facade pattern, Singleton cache), leaderboard position (COUNT-based query, position cache), home page stats (Home Stats Cache, Cache Warming), and community page leaderboard (Leaderboard Cache, Cache Warming). Achieves significant speed improvements (e.g., home page stats <1ms).
- **Search**: Global unified search with type-ahead functionality for products and community members, including client-side instant search for products.
- **Styling**: Custom CSS with earth tone color palette for consistent look and feel. Content pages use shared `.page-header-minimal` theme with sage green accents. Product cards share unified base styles (`.product-card`, `.product-title`, `.product-vendor`, `.product-price`) across Products and Rank pages.

### Feature Specifications
- **Ranking**: View top N jerky products (3, 5, or 8), persistent rankings with database storage, and a visual ranking modal with product images. Includes multi-layer duplicate prevention and an optimistic UI pattern for immediate feedback.
- **Products Page**: Advanced sorting, animal and flavor filtering, client-side instant search, and server-side pagination with dynamic "Load More" functionality.
- **Rank Page Products**: Server-side filtering via `/api/products/rankable` to exclude already-ranked products before pagination. All ranking operations use `rankingListId='default'` consistently. Optimistic UI pattern for immediate product removal on ranking, with restoration on failure. Server-side search never returns already-ranked products.
- **Community**: Discover users, search by name or ranked products, and view user profiles with ranking statistics. Displays top 5 rankers widget.
- **Leaderboard**: Dedicated page showing top 50 jerky rankers with engagement scores, products ranked, achievement badges, and user position highlighting. Features medal emojis (🥇🥈🥉) for top 3 positions, sage green highlighting for current user, and gold gradient backgrounds for medal winners.
- **User Profile**: Displays user information, ranking statistics, and links to update external profiles.
- **Gamification**: Achievement tracking, user progress monitoring, streak tracking, real-time leaderboards, live activity feeds, and real-time notifications.
- **Admin Tools**: Role-based access for @jerky.com employees with features to manage achievements and monitor live users with real-time WebSocket updates and privacy-preserving data sanitization. Achievement admin includes custom icon upload functionality supporting PNG/JPG/WebP images (128x128px, max 500KB) via Replit Object Storage with file validation and preview capabilities.

## Glossary of Terms

### User-Facing Terms (Gamification System)

**Coin Book**
- The player's visual binder of all Flavor Coins, Collection Achievements, and Hidden Achievements. Designed to evoke the feel of a physical quarter-collection book — progress is tactile, gaps are visible, and completion feels rewarding.

**Flavor Coin**
- A coin earned when a user ranks a unique flavor for the first time. Appears on the Flavor Coins Page of the Coin Book. Each coin represents both participation (XP) and flavor history.

**Static Collection Coin**
- An achievement for completing a fixed, finite set of flavors (e.g., Classic Beef). These never change and can only be earned once.

**Dynamic Collection Coin**
- An achievement tied to a living flavor group that updates automatically as new flavors are released or retired (e.g., All Beef or All Poultry). Progress is measured by percentage of flavors ranked, determining the user's tier (Bronze → Diamond).

**Hidden Collection Coin**
- A secret or themed achievement that is hidden until the player unlocks it by meeting hidden criteria. Examples: BBQ Lovers, Sweet Tooth, Heat Seeker.

**Dynamic Master Collection**
- The umbrella term for the highest-level Dynamic Collections such as Beef Master, Exotic Master, Pork Master, and Poultry Master. Each represents an evolving mastery challenge that tracks every flavor within its protein category. Completion tiers follow the 5-tier system (Bronze 40%, Silver 60%, Gold 75%, Platinum 90%, Diamond 100%).

**Tiered Achievement**
- Any achievement that progresses through visible ranks (Bronze → Silver → Gold → Platinum → Diamond). Each tier unlocks automatically when the user passes the defined completion percentage.

**Exploration** (Internal Term)
- Internal behavior type tracking breadth — how many new things a user tries. Powers XP and achievement triggers but is never shown to players directly.

**Discovery** (Internal Term)
- Internal behavior type tracking depth — how much a user refines or defines their preferences (e.g., re-ranking favorites, curating their Top 10). Also invisible to players but used for balancing XP and achievement logic.

### Technical Implementation Terms

**collectionType**
- Database field categorizing achievements: `'static_collection'`, `'dynamic_collection'`, `'hidden_collection'`, or `'legacy'`. Determines how the achievement behaves and displays in the Coin Book.

**iconType**
- Database field indicating icon format: `'emoji'` (text emoji) or `'image'` (URL to uploaded image). Allows achievements to use either emojis or custom uploaded images.

**proteinCategory**
- Database field for dynamic master collections: `'cattle'`, `'poultry'`, `'pork'`, `'fish'`, `'game'`, `'exotic'`. Used to group products by animal type for collection achievements.

**tierThresholds**
- JSONB field defining completion percentages for each tier: `{bronze: 40, silver: 60, gold: 75, platinum: 90, diamond: 100}`. Applied to dynamic collections.

**requirement**
- JSONB field storing achievement unlock criteria: `{type: 'rank_count', value: 10}`, `{type: 'complete_animal_category', value: 1}`, etc. Evaluated by the AchievementManager.

**engagementScore**
- Calculated metric for leaderboards: achievements + page views + rankings + searches. Determines user ranking position.

**streakType**
- Valid values: `'daily_rank'` (ranking streak) or `'daily_login'` (login streak). Defined in `shared/constants.js` and validated server-side.

**rankableProducts**
- Products available for a user to rank. Filtered to exclude already-ranked products from the user's list.

**rankingListId**
- Identifier for different ranking contexts. Currently uses `'default'` for all operations. Future expansion may include `'topN'`, `'favorites'`, etc.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM for data persistence. Utilizes a dual migration system (`db:push`, `db:migrate`) and performance indexes.
- **Error Tracking**: Sentry.io for error monitoring and performance tracking.
- **Real-time**: Socket.IO for WebSocket communication.
- **Email**: Custom SMTP service using nodemailer with Google Workspace for authentication magic links.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icon uploads with presigned URL upload flow and public access.