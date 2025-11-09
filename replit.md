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
- **Responsiveness**: Optimized for desktop, tablet, and mobile with comprehensive mobile optimizations.
- **Navigation**: Single Page Application (SPA) with smooth transitions, responsive navigation, and mobile-specific hamburger menu.
- **Unified Product Cards**: Consistent styling across all product displays.
- **Loading States**: Skeleton screens and loading indicators for async operations.
- **Error Handling**: User-friendly error messages with actionable feedback.
- **Admin Tools Styling**: Earth-tone styling with horizontal tab navigation.
- **Collection Progress Bar**: Tier-based colors, animated gradient, percentage display, and contextual encouragement.
- **Toast Notifications**: Sequential queue-based display system for real-time events.
- **Tier Emoji System**: Centralized JSON-based emoji constants for various tiers.

**Technical Implementations:**
- **Frontend**: React 19, React Router v7, TanStack Query for server state, Zustand for global state, Vite for tooling, and Socket.IO Client for real-time updates.
- **Auth Status Endpoint**: `/api/customer/status` fetches fresh user data from database on every request to ensure profile updates (handle, privacy settings, avatar) are immediately reflected in the frontend without requiring re-login.
- **Icon Rendering**: Unified icon utility (`src/utils/iconUtils.jsx`) handles all achievement icon types (emoji, URL, base64) consistently across all components. The `getAssetUrl()` helper returns relative paths (starting with `/`) as-is for same-origin serving. Vite dev server proxies `/objects` requests to backend on port 5000. All achievement icons are stored in Replit Object Storage with leading-slash paths (e.g., `/objects/achievement-icons/xxx.png`).
- **Code Splitting**: Route-based lazy loading using React.lazy() and Suspense, with manual vendor chunking (Socket.IO, DnD Kit, React Query, Sentry, Router). Main bundle reduced from 979 kB to 222 kB (77% reduction, gzipped: 294 kB → 70 kB). Individual route chunks load on-demand (1-30 kB each).
- **Backend**: Node.js and Express.js, employing a repository pattern.
- **Data Layer**: Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration for real-time query invalidation.
- **Real-time Communication**: Socket.IO for achievement notifications with pending queue and multi-device support.
- **Session Security**: Production-grade authentication using httpOnly cookies, 90-day server-side sessions, and single-domain enforcement.
- **Rate Limiting**: Authentication endpoints are rate-limited using Redis.
- **Product Management**: Combines external data with metadata and ranking statistics, including advanced filtering.
- **Shopify Synchronization**: Automatic sync of products and metadata via webhooks, with caching and orphan cleanup.
- **Gamification**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications. Automatic real-time achievement checking via WebSocket.
- **Page View Tracking**: Asynchronous tracking for analytics.
- **Timestamp Handling**: All database timestamps are ISO 8601 UTC; client-side relative time calculation.
- **Performance**: OOP design patterns, caching, query optimization.
- **Search**: Global unified search for products and community members.
- **Styling**: Custom CSS with an earth-tone palette and component-scoped class names.
- **Database Connection**: Dual-connection architecture using Neon PostgreSQL.
- **Feature Flags**: JSON-based configuration system for cross-environment compatibility.
- **Personalized Guidance System**: AI-driven, page-aware, and journey-aware system with an event-driven classification engine that analyzes user behavior to provide targeted messages with CTAs. Enhanced with achievement hooks and flavor profile community integration.
  - **Event-Driven Classification Architecture**: BullMQ-based background processing system where user activities trigger asynchronous classification jobs that pre-calculate and cache guidance messages.
  - **ClassificationQueue Service**: Smart hybrid debouncing using Redis tracking to prevent queue flooding.
  - **ClassificationWorker Background Service**: Processes queue jobs with a pipeline to classify users, update flavor communities, calculate guidance, and write to `user_guidance_cache`.
  - **Cache-First API Strategy**: `/api/gamification/user-guidance` endpoint reads from `user_guidance_cache` first.
- **Flavor Profile Communities**: Micro-community system tracking user journey states (Curious → Seeker → Taster → Enthusiast/Explorer/Moderate) for each flavor profile with admin-configurable thresholds.
- **User Classification System**: `UserClassificationService` tracks journey stages, engagement levels, and exploration breadth.
- **Unified Activity Tracking**: All user activities are tracked in the centralized `user_activities` table.
- **Engagement Tracking**: `EngagementManager` and `LeaderboardManager` read from the unified `user_activities` table.
- **Ranking Race Condition Fix**: Implemented sequence-based staleness detection to prevent data loss during rapid ranking operations.

**Feature Specifications:**
- **Ranking**: Persistent rankings with visual modal, duplicate prevention, optimistic UI, and a hybrid reliability system. Non-employee users can only rank purchased products.
- **Flavors Page**: Advanced sorting, filtering, client-side instant search, and server-side pagination.
- **Product Detail Page**: Comprehensive product information including image, brand, animal type, primary/secondary flavors, pricing, ranking statistics, and product tags.
- **Flavor Profile Pages**: Dynamic pages for each flavor type displaying all products with that flavor.
- **Purchase History**: Automatic background synchronization of Shopify orders on login.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget. Privacy-aware display with CommunityService as single source of truth for user formatting (respects hideNamePrivacy to show @handle or "FirstName L." format). Avatar support with profile images stored in Replit Object Storage.
- **Leaderboard**: Top 50 rankers with engagement scores and badges. LeaderboardManager uses CommunityService for privacy-aware formatting (displayName, initials, avatarUrl) with null-safe fallbacks. Avatar display integrated across home page top rankers widget (40px) and full leaderboard page (50px) with consistent styling.
- **User Profile**: "Flavors Ranked" section, public profiles with clickable flavor links, and clickable achievement coins.
- **Gamification**: Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Coin Book Widget**: Collapsible achievement tracker on the Rank page.
- **Coin Type Configuration**: Database-driven system for managing five coin types (engagement, static collection, dynamic collection, flavor, legacy) via an Admin UI, enabling dynamic updates.
- **Admin Tools**: React-based dashboard with EmployeeRoute protection and `employee_admin` role, including sections for managing coins, coin types, live users, products, customer order items, Sentry errors, managing data, flavor profile communities, user guidance analytics, and bulk import.
- **Bulk Import System**: Comprehensive system for importing all Shopify customers and their complete purchase history with real-time monitoring.
  - **Architecture**: Event-driven BullMQ-based background processing with `ShopifyCustomersService`, `BulkImportService`, `BulkImportQueue`, and `BulkImportWorker`.
  - **Network Reliability**: Exponential backoff retry utility (`retryWithBackoff.js`) handles transient network errors.
  - **Database Tracking**: Users table includes fields for tracking import completion.
  - **Worker Integration**: `BulkImportWorker` reuses existing `PurchaseHistoryService` for order synchronization and triggers `ClassificationQueue` jobs.
  - **Admin Interface**: `BulkImportPage.jsx` provides real-time progress monitoring via WebSocket.
  - **WebSocket Updates**: Real-time queue stats and Shopify gap stats broadcast for live progress tracking.
  - **API Routes**: Super admin protected endpoints for starting imports, checking status, and monitoring progress.
  - **UI Organization**: Logical 3-step pipeline (Fetch Customers → Import Users → Complete) with System Status, Shopify gap metric, Import Pipeline visualization, Current Step Details, and Import Controls.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io with comprehensive integration for backend and frontend.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.