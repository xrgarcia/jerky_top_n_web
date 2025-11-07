# Jerky Top N Web Application

## Overview
A web application for ranking jerky flavors, designed to be a comprehensive and engaging platform for jerky enthusiasts. The project aims to provide users with the ability to view top-rated flavors, create personal rankings, and interact within a community. Its core ambition is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced flavor filtering capabilities, with a business vision to capture a significant market share in the niche online food review and community space.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## Development Workflow

**CRITICAL: Frontend Build Process**

The application uses **two separate workflows** for different development modes:

### 1. Development Mode (Hot Reloading)
- **Workflow**: `Vite Dev` (port 5173)
- **Command**: `npm run dev:react`
- **Use When**: Actively developing frontend (CSS, JSX, component changes)
- **Benefits**: Instant hot-reload of CSS/JS changes - no manual rebuild needed
- **Access**: http://localhost:5173 (or via Replit webview)

### 2. Production Mode
- **Workflow**: `Server` (port 5000)
- **Command**: `npm start`
- **Use When**: Testing production builds, backend work, or final verification
- **How It Works**: 
  1. Vite builds `src/` → `public/dist/` with content-based hashes for automatic cache busting
  2. Express serves pre-built files from `public/dist/` with `Cache-Control: no-cache` headers on HTML
  3. **Any CSS/JS changes require rebuilding**: `npm run build:react`
- **Access**: http://localhost:5000 (default Replit URL)
- **Cache Busting**: Vite's `[hash]` generates unique filenames based on file content (e.g., `index-B0q4rGbc.js`). When code changes, hash changes automatically, forcing browsers to fetch new files. **Do not add `Date.now()` to Vite config** - it gets evaluated once at server startup and breaks cache busting on subsequent builds.

### Build Commands
- `npm run build:react` - Build React app for production (required after CSS/JS changes in production mode)
- `npm run dev:react` - Start Vite dev server with hot reload
- `npm start` - Start Express server (serves pre-built files)

### Quick Reference
| Change Type | Dev Mode | Production Mode |
|-------------|----------|-----------------|
| CSS changes | Auto-reload ✅ | Rebuild + restart ⚠️ |
| JSX changes | Auto-reload ✅ | Rebuild + restart ⚠️ |
| Backend changes | Restart `Server` | Restart `Server` |

**Best Practice**: Use **Dev Mode** (`Vite Dev`) for frontend development, then build and verify in **Production Mode** (`Server`) before deployment.

## Terminology
**CRITICAL DISTINCTION:**
- **Flavor Profile** = Taste category (e.g., Teriyaki, BBQ, Sweet, Spicy, Savory) - macro-level grouping
- **Flavor** = Specific product characteristic - micro-level attribute
- **Flavor Profile Communities** = User lifecycle tracking per flavor profile (Curious → Seeker → Taster → Enthusiast/Explorer/Moderate)

## System Architecture
The application utilizes a modern web architecture for responsiveness, scalability, and real-time interaction, built upon a recent migration to React.

**UI/UX Decisions:**
- **Design Inspiration**: Clean, professional aesthetic inspired by jerky.com, using an earth-tone color palette.
- **Responsiveness**: Optimized for desktop, tablet, and mobile with comprehensive mobile optimizations including a slide-in drawer navigation and responsive layouts.
- **Navigation**: Single Page Application (SPA) with smooth transitions, responsive navigation, and mobile-specific hamburger menu.
- **Unified Product Cards**: Consistent styling across all product displays.
- **Loading States**: Skeleton screens and loading indicators for async operations.
- **Error Handling**: User-friendly error messages with actionable feedback.
- **Admin Tools Styling**: Earth-tone styling with horizontal tab navigation.
- **Collection Progress Bar**: Tier-based colors, animated gradient, percentage display, and contextual encouragement.
- **Toast Notifications**: Sequential queue-based display system for real-time events (achievements, flavor_coins, tier upgrades).
- **Tier Emoji System**: Centralized JSON-based emoji constants for various tiers (bronze, silver, gold, platinum, diamond).

**Technical Implementations:**
- **Frontend**: React 19, React Router v7, TanStack Query for server state, Zustand for global state, Vite for tooling, and Socket.IO Client for real-time updates.
- **Backend**: Node.js and Express.js, employing a repository pattern.
- **Data Layer**: Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration for real-time query invalidation.
- **Real-time Communication**: Socket.IO for achievement notifications with pending queue and multi-device support.
- **Session Security**: Production-grade authentication using httpOnly cookies, 90-day server-side sessions, and single-domain enforcement.
- **Rate Limiting**: Authentication endpoints are rate-limited using Redis.
- **Product Management**: Combines external data with metadata and ranking statistics, including advanced filtering.
- **Shopify Synchronization**: Automatic sync of products and metadata via webhooks, with caching and orphan cleanup.
- **Gamification**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications. Automatic real-time achievement checking via WebSocket after all activity tracking (page views, product views, profile views), ensuring immediate award of engagement achievements when thresholds are met.
- **Page View Tracking**: Asynchronous tracking for analytics.
- **Timestamp Handling**: All database timestamps are ISO 8601 UTC; client-side relative time calculation.
- **Performance**: OOP design patterns, caching, query optimization.
- **Search**: Global unified search for products and community members.
- **Styling**: Custom CSS with an earth-tone palette and component-scoped class names to prevent global CSS conflicts.
- **Database Connection**: Dual-connection architecture using Neon PostgreSQL.
- **Feature Flags**: JSON-based configuration system for cross-environment compatibility.
- **Personalized Guidance System**: AI-driven, page-aware, and journey-aware system with an event-driven classification engine that analyzes user behavior to provide targeted messages with CTAs. Enhanced with achievement hooks and flavor profile community integration.
  - **Event-Driven Classification Architecture**: BullMQ-based background processing system where user activities (rankings, searches, page views, purchases) trigger asynchronous classification jobs that pre-calculate and cache guidance messages for instant delivery.
  - **ClassificationQueue Service**: Smart hybrid debouncing (immediate first event, max 1 job per 5 min per user) using Redis tracking to prevent queue flooding while ensuring fresh classifications.
  - **ClassificationWorker Background Service**: Processes queue jobs with pipeline: classify user → update flavor communities → calculate guidance for ALL page contexts (rank, products, community, coinbook, general) → write to `user_guidance_cache` table.
  - **Cache-First API Strategy**: `/api/gamification/user-guidance` endpoint reads from `user_guidance_cache` first for instant delivery, falls back to real-time calculation on cache miss.
  - **Queue Integration Points**: EngagementManager (after coin awards), ActivityTrackingService (all activity methods), WebSocketGateway (page:view events), Shopify webhooks (order events).
- **Flavor Profile Communities**: Micro-community system tracking user journey states (Curious → Seeker → Taster → Enthusiast/Explorer/Moderate) for each flavor profile (Teriyaki, BBQ, Sweet, Spicy, Savory) with admin-configurable thresholds. Integrated with User Guidance admin interface to display users' dominant flavor profile engagement.
- **User Classification System**: `UserClassificationService` tracks journey stages, engagement levels, and exploration breadth. Works alongside `FlavorProfileCommunityService` to provide comprehensive user behavior analysis for personalized guidance.
- **Unified Activity Tracking**: All user activities (page views, rankings, searches, logins, product views, profile views, purchases) are tracked in the centralized `user_activities` table. Activity types include: `page_view`, `ranking_saved`, `search`, `login`, `product_view`, `profile_view`, `purchase`, and `coin_earned`.
- **Engagement Tracking**: `EngagementManager` and `LeaderboardManager` read from the unified `user_activities` table for tracking all user engagement metrics.
- **Ranking Race Condition Fix**: Implemented sequence-based staleness detection to prevent data loss during rapid ranking operations.

**Feature Specifications:**
- **Ranking**: Persistent rankings with visual modal, duplicate prevention, optimistic UI, and a hybrid reliability system. Non-employee users can only rank purchased products. Robust sync system with automatic recovery and manual "Force Sync" for employees using IndexedDB state snapshots.
- **Flavors Page**: Advanced sorting, filtering (animal, flavor), client-side instant search, and server-side pagination. Clickable product cards navigate to individual product detail pages and flavor profile pages.
- **Product Detail Page**: Comprehensive product information including image, brand, animal type, primary/secondary flavors (with clickable links), pricing, ranking statistics, and product tags.
- **Flavor Profile Pages**: Dynamic pages for each flavor type displaying all products with that flavor, featuring animal type filtering, search functionality, and product stats.
- **Purchase History**: Automatic background synchronization of Shopify orders on login.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget.
- **Leaderboard**: Top 50 rankers with engagement scores and badges.
- **User Profile**: "Flavors Ranked" section, public profiles with clickable flavor links, and clickable achievement coins.
- **Gamification**: Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Collection Progress Bar**: User-specific progress tracking on the Rank page.
- **Coin Book Widget**: Collapsible achievement tracker on the Rank page with user stats, last earned achievement, next milestone progress, and a grid of achievements with tier-based colored borders.
- **Coin Type Configuration**: Database-driven system for managing five coin types (engagement, static collection, dynamic collection, flavor, legacy) via an Admin UI, enabling dynamic updates to display names, taglines, descriptions, icons, colors, and how-to-earn instructions. Public API endpoints support fetching configurations, and dynamic coin profile pages.
- **Admin Tools**: React-based dashboard with EmployeeRoute protection and `employee_admin` role, including sections for managing coins, coin types, live users, products, customer order items, Sentry errors, managing data, flavor profile communities, user guidance analytics with flavor profile community filtering, and bulk import for historical Shopify data.
- **Bulk Import System**: Comprehensive system for importing all Shopify customers and their complete purchase history into the platform with real-time monitoring.
  - **Architecture**: Event-driven BullMQ-based background processing with ShopifyCustomersService (paginated customer fetching), BulkImportService (orchestration), BulkImportQueue (job management), and BulkImportWorker (background processing with concurrency of 3).
  - **Database Tracking**: Users table includes `fullHistoryImported`, `historyImportedAt`, `lastOrderSyncedAt`, and `importStatus` fields for tracking import completion.
  - **Worker Integration**: BulkImportWorker reuses existing PurchaseHistoryService for order synchronization, updates user status fields, and triggers ClassificationQueue jobs for personalized guidance.
  - **Admin Interface**: BulkImportPage.jsx provides real-time progress monitoring via WebSocket with queue statistics, import status, and controls for full or incremental imports. UI displays clear breakdown distinguishing customers fetched vs new users created vs existing users updated.
  - **WebSocket Updates**: Real-time queue stats and Shopify gap stats broadcast to 'admin:queue-monitor' room for live progress tracking. WebSocket events include 'bulk-import:progress' (queue stats) and 'shopify-stats:update' (database vs Shopify comparison) for instant UI updates as imports progress.
  - **API Routes**: Super admin protected endpoints at `/api/admin/bulk-import/*` for starting imports, checking status, and monitoring progress.
  - **UI Organization**: Logical 3-step pipeline (Fetch Customers → Import Users → Complete) with System Status at top, Shopify gap metric, Import Pipeline visualization, Current Step Details, and Import Controls at bottom.
  - **BullMQ Configuration**: Classification queue retains 100 completed jobs, Bulk Import queue retains 50,000 completed jobs to prevent counter capping during large imports.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io with comprehensive integration for backend and frontend, including session replay, React error boundaries, user context, and breadcrumbs.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.