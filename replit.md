# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, designed to be a comprehensive and engaging platform for jerky enthusiasts. The project aims to provide users with the ability to view top-rated products, create personal rankings, and interact within a community. Its core ambition is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced product filtering capabilities.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## Recent Changes
- **Nov 2025**: Universal Coin Book progress tracking - Enhanced CoinBookWidget tooltips to display real-time progress for ALL locked achievement types (not just engagement). Shows "X of Y [label]" format with smart label detection: tiered achievements display "for [next tier]" (e.g., "50 of 100 for silver"), collection achievements show "flavors ranked", and engagement achievements show specific activity types ("searches", "unique product views", "streak days"). Handles both 'required' and 'target' field names from backend, guards against undefined values, and displays optional remaining count.
- **Nov 2025**: Engagement coin tracking migration - Updated `EngagementManager` to read from `user_activities` table instead of legacy tables (`user_product_searches`, `page_views`). Added search activity tracking and achievement checking to `/api/products/rankable` endpoint. Now tracks searches, product views, and profile views in unified `user_activities` table for engagement coin awards ("Be Curious", "Expand Your Horizons", etc.).
- **Nov 2025**: Major ranking sync fix - replaced UUID-based queue with single "current_state" operation using constant ID. Implemented smart auto-recovery on page load (prefers source with more products), added employee Force Sync button for manual recovery. Fixed critical data loss issue where IndexedDB had more products than backend.
- **Nov 2025**: Search filter persistence - added fallback chain (lastSearchedTerm → URL search param → empty) to preserve filters after ranking operations.

## System Architecture
The application utilizes a modern web architecture for responsiveness, scalability, and real-time interaction, built upon a recent migration to React.

**UI/UX Decisions:**
- **Design Inspiration**: Clean, professional aesthetic inspired by jerky.com, using an earth-tone color palette.
- **Responsiveness**: Optimized for desktop, tablet, and mobile.
- **Navigation**: Single Page Application (SPA) with smooth transitions.
- **Unified Product Cards**: Consistent styling across all product displays.
- **Loading States**: Skeleton screens and loading indicators for async operations.
- **Error Handling**: User-friendly error messages with actionable feedback.
- **Admin Tools Styling**: Earth-tone styling with horizontal tab navigation.
- **Collection Progress Bar**: Tier-based colors, animated gradient, percentage display, and contextual encouragement.

**Technical Implementations:**
- **Frontend**: React 19, React Router v7, TanStack Query for server state, Zustand for global state, Vite for tooling, and Socket.IO Client for real-time updates.
- **Backend**: Node.js and Express.js, employing a repository pattern.
- **Data Layer**: Centralized API client with httpOnly cookie-based session management, React Query hooks for data fetching, and WebSocket integration for real-time query invalidation.
- **User Privacy**: `CommunityService` truncates last names.
- **User Activation**: Users are `active=false` until first login.
- **Real-time Communication**: Socket.IO for achievement notifications with a pending queue and multi-device support.
- **Session Security**: Production-grade authentication using httpOnly cookies (`SameSite=none; Secure`), 90-day server-side sessions.
- **Single-Domain Requirement**: Enforced for cookie security.
- **Rate Limiting**: Authentication endpoints are rate-limited using Redis.
- **Product Management**: `ProductsService` combines external data with metadata and ranking statistics, including advanced filtering.
- **Shopify Synchronization**: Automatic sync of products and metadata via webhooks, with cache warming, selective updates, orphan cleanup, and dual cache staleness thresholds.
- **Gamification**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications.
- **Page View Tracking**: Asynchronous tracking for analytics.
- **Timestamp Handling**: All database timestamps are ISO 8601 UTC; client-side relative time calculation.
- **Performance**: OOP design patterns, caching, query optimization.
- **Search**: Global unified search for products and community members.
- **Styling**: Custom CSS with an earth-tone palette.
- **Database Connection**: Dual-connection architecture using Neon PostgreSQL.
- **Toast Notifications**: Sequential queue-based display system (FIFO) prevents message overlap, showing one toast at a time with 300ms transition delay and configurable duration (default 5s). WebSocket events (achievements:earned, flavor_coins:earned, tier:upgrade) trigger toasts with tier-specific formatting and emojis (🥉🥈🥇👑💠).
- **Tier Emoji System**: Centralized tier emoji constants using JSON-based single source of truth (`shared/constants/tierEmojis.json`) with module wrappers for both CommonJS (backend) and ESM (frontend). Tier emojis: bronze (🥉), silver (🥈), gold (🥇), platinum (👑 crown - visually distinct from diamond), diamond (💠). Used by: ProgressTracker, CommentaryService, CoinBookWidget, useCoinBookWebSocket hook, and legacy widgets.
- **Feature Flags**: JSON-based configuration system (`shared/constants/featureFlags.json`) with dual-module architecture for cross-environment compatibility. Current flags: `AUTO_FILL_RANKING_GAPS` (default: false) - controls whether rankings auto-renumber to fill gaps when items are added/removed. When disabled (current), rankings preserve user's exact rank numbers (e.g., #1, #3, #5); when enabled, ranks automatically renumber to sequential order (e.g., #1, #2, #3).

**Feature Specifications:**
- **Ranking**: Persistent rankings with visual modal, duplicate prevention, optimistic UI, and hybrid reliability system. Non-employee users can only rank purchased products.
    - **Ranking Data Synchronization**: Robust sync system with automatic recovery and manual Force Sync (Nov 2025 fix):
        - **IndexedDB Queue Pattern**: Single "current_state" operation with constant ID (not UUIDs) ensures complete state snapshots, preventing fragmented data loss
        - **Auto-Recovery on Page Load**: Compares IndexedDB vs backend count, prefers whichever has MORE products, saves to backend, updates UI immediately
        - **Force Sync Button**: Employee-only manual recovery that reads IndexedDB directly, shows reconciliation analysis, syncs to backend, updates UI state
        - **Reconciliation Endpoint**: `/api/rankings/reconcile` compares frontend vs backend product IDs, returns missing/extra items for debugging
        - **State Update Critical Path**: Both recovery paths call `setRankedProducts()` BEFORE clearing queue to ensure UI reflects recovered data
        - **Backfill Migration**: Handles legacy multiple-operation queues by merging to single authoritative state
        - Prevents data loss when IndexedDB has unflushed changes that backend lacks
- **Products Page**: Advanced sorting, filtering (animal, flavor), client-side instant search, and server-side pagination.
- **Purchase History**: Automatic background synchronization of Shopify orders on login.
- **Shopify Webhook Integration**: Real-time sync for orders and products with HMAC SHA-256 verification.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget.
- **Leaderboard**: Top 50 rankers with engagement scores and badges.
- **User Profile**: Personal stats and rankings.
- **Gamification**: Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Ranking Commentary**: Dynamic, contextual encouragement messages with intelligent percentage-based tiers (0-10%, 11-25%, 26-50%, 51-75%, 76-90%, 91-99%) calculated from progress toward specific achievement milestones, filtered to show only `category='ranking'` achievements.
- **Collection Progress Commentary**: Simple percentage-based encouragement messages in 10% tiers (0%, 1-10%, 11-20%, 21-30%, etc.) calculated from actual overall progress (rankedCount / totalProducts). Uses glossary terminology referring to products as "flavors" and emphasizing "Coin Book" completion. All messages focus on how many flavors remain to complete the Coin Book, avoiding confusion with the four distinct coin types (Flavor Coins, Engagement Coins, Static Collection Coins, Dynamic Collection Coins).
- **Collection Progress Bar**: User-specific progress tracking on the Rank page, indicating progress towards achievements.
- **Coin Book Widget**: Wood-inspired, collapsible achievement tracker on the Rank page featuring:
    - Wood-frame design with earth-tone palette (sage green #7b8b52, earthy gold #c4a962)
    - Collapsed state: User stats (rankings, streak), last earned achievement icon
    - Expanded state: Next milestone with progress bar + achievement grid with tier-based colored borders
    - Real-time updates via WebSocket (achievements:earned, flavor_coins:earned, tier:upgrade, gamification:progress:updated events)
    - Progress updates broadcast after rankings saved, triggering live refresh of "Your Progress" section
    - Custom hooks for `/api/gamification/achievements` and `/api/gamification/progress` endpoints
    - Clickable coins navigate to dynamic profile pages
    - Strategic CSS: Coins use 120px minmax grid width, 12px font, overflow-wrap for natural word boundaries (prevents mid-word breaking like "Gett ing Star ted"), with proportional responsive breakpoints (tablet: 100px/11px, mobile: 85px/10px)
    - Universal Progress Tooltips: ALL locked achievements with progress data display real-time tracking in tooltips. Smart label detection: tiered → "X of Y for [next tier]", collection → "X of Y flavors ranked", engagement → "X of Y [activity type]". Shows optional remaining count and handles both backend field name formats ('required' and 'target')
- **Coin Type Configuration**: Database-driven system for managing coin branding and messaging:
    - `coin_type_config` table stores metadata for 5 coin types (engagement, static collection, dynamic collection, flavor, legacy)
    - Admin UI at `/admin/tools/coin-types` for editing display names, taglines, descriptions, icons, colors, and how-to-earn instructions
    - Public API endpoints for fetching configs (`/api/coin-types` and `/api/coin-types/:type`)
    - Dynamic coin profile pages at `/coinbook/:coinId` showing achievement details, progress tracking, type-specific branding, and CTAs
    - Allows content updates without code deployments
- **Admin Tools**: React-based dashboard with:
    - EmployeeRoute protection, `employee_admin` role.
    - Nested routing (`/admin/tools/*`).
    - Super Admin Access: Dynamic backend-driven access control with immediate cache invalidation.
    - Eight Sections: Manage Coins, Coin Types (database-driven config for coin branding/messaging), Live Users, Manage Products (searchable table, multi-filter UI, edit modal with optimistic updates), Customer Order Items (7 filters, sortable columns, pagination, WebSocket live updates, linkable URL state), Sentry Errors, Manage Data (super admin-only), User Guidance (classification analytics).
- **Personalized Guidance System**: AI-driven user journey optimization featuring:
    - Event-driven classification engine analyzing user behavior patterns
    - Four classification dimensions: Journey Stage (new_user → engaged_explorer → dedicated_collector → completionist), Engagement Level (low/medium/high), Activity Type (casual_browser → active_ranker → super_user), Taste Community (6 communities based on flavor/animal preferences)
    - Rule-based analysis system with configurable thresholds (JSON-based config, admin-editable)
    - Activity tracking with intelligent batching (10 activities/5 seconds) for performance
    - Comprehensive activity logging: searches, product views, profile views, rankings, coins earned, logins, purchases
    - Real-time WebSocket updates for classification changes and guidance refresh
    - Targeted message templates personalized per classification (journey stage, engagement level, taste community)
    - Frontend widget with earth-tone styling positioned above Coin Book on Rank page
    - Collapsible interface with dynamic content refresh on user activity
    - Admin dashboard tab with searchable user classifications table, detailed view modals, color-coded badges
    - Future-ready for status/flair system integration (badges, journey icons, engagement indicators)
    - Services: UserClassificationService, TasteCommunityService, ActivityTrackingService, PersonalizedGuidanceService
    - Database tables: user_activities, user_classifications, taste_communities, classification_config

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io (backend and frontend with session replay).
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.