# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, designed to be a comprehensive and engaging platform for jerky enthusiasts. The project aims to provide users with the ability to view top-rated products, create personal rankings, and interact within a community. Its core ambition is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced product filtering capabilities, with a business vision to capture a significant market share in the niche online food review and community space.

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
- **Unified Product Cards**: Consistent styling across all product displays.
- **Loading States**: Skeleton screens and loading indicators for async operations.
- **Error Handling**: User-friendly error messages with actionable feedback.
- **Admin Tools Styling**: Earth-tone styling with horizontal tab navigation.
- **Collection Progress Bar**: Tier-based colors, animated gradient, percentage display, and contextual encouragement.
- **Toast Notifications**: Sequential queue-based display system for WebSocket events (achievements:earned, flavor_coins:earned, tier:upgrade) with tier-specific formatting and emojis.
- **Tier Emoji System**: Centralized JSON-based emoji constants for bronze (🥉), silver (🥈), gold (🥇), platinum (👑), diamond (💠) used across UI components.

**Technical Implementations:**
- **Frontend**: React 19, React Router v7, TanStack Query for server state, Zustand for global state, Vite for tooling, and Socket.IO Client for real-time updates.
- **Backend**: Node.js and Express.js, employing a repository pattern.
- **Data Layer**: Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration for real-time query invalidation.
- **User Privacy**: `CommunityService` truncates last names.
- **User Activation**: Users are `active=false` until first login.
- **Real-time Communication**: Socket.IO for achievement notifications with a pending queue and multi-device support.
- **Session Security**: Production-grade authentication using httpOnly cookies (`SameSite=none; Secure`), 90-day server-side sessions, and single-domain enforcement.
- **Rate Limiting**: Authentication endpoints are rate-limited using Redis.
- **Product Management**: `ProductsService` combines external data with metadata and ranking statistics, including advanced filtering.
- **Shopify Synchronization**: Automatic sync of products and metadata via webhooks, with caching and orphan cleanup.
- **Gamification**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications.
- **Page View Tracking**: Asynchronous tracking for analytics.
- **Timestamp Handling**: All database timestamps are ISO 8601 UTC; client-side relative time calculation.
- **Performance**: OOP design patterns, caching, query optimization.
- **Search**: Global unified search for products and community members.
- **Styling**: Custom CSS with an earth-tone palette.
- **Database Connection**: Dual-connection architecture using Neon PostgreSQL.
- **Feature Flags**: JSON-based configuration system (`featureFlags.json`) for cross-environment compatibility (e.g., `AUTO_FILL_RANKING_GAPS`).
- **Personalized Guidance System**: AI-driven, page-aware, and journey-aware system with an event-driven classification engine that analyzes user behavior (Journey Stage, Engagement Level, Activity Type, Taste Community) to provide targeted, action-oriented messages with CTAs. Rule-based analysis with configurable thresholds and real-time WebSocket updates. Enhanced with achievement hooks via dependency injection (ProgressTracker + UserStatsAggregator) to append tactical achievement progress (e.g., "3 more flavors to unlock Silver 🥈") to strategic journey messages, with smart category filtering by page context (rank→ranking achievements, products/community→engagement achievements, coinbook→all achievements).
- **Engagement Tracking**: `EngagementManager` reads from a unified `user_activities` table for tracking searches, product views, and profile views for engagement coin awards.

**Feature Specifications:**
- **Ranking**: Persistent rankings with visual modal, duplicate prevention, optimistic UI, and a hybrid reliability system. Non-employee users can only rank purchased products. A robust sync system with automatic recovery (prefers source with more products) and manual "Force Sync" for employees using IndexedDB state snapshots.
- **Products Page**: Advanced sorting, filtering (animal, flavor), client-side instant search, and server-side pagination. Search filters persist across ranking operations.
- **Purchase History**: Automatic background synchronization of Shopify orders on login.
- **Shopify Webhook Integration**: Real-time sync for orders and products with HMAC SHA-256 verification.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget.
- **Leaderboard**: Top 50 rankers with engagement scores and badges.
- **User Profile**: Personal stats and rankings.
- **Gamification**: Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Ranking Commentary**: Dynamic, contextual encouragement messages based on progress toward specific ranking achievements.
- **Collection Progress Commentary**: Percentage-based encouragement messages focusing on "flavors" remaining to complete the "Coin Book."
- **Collection Progress Bar**: User-specific progress tracking on the Rank page.
- **Coin Book Widget**: Wood-inspired, collapsible achievement tracker on the Rank page with user stats, last earned achievement, next milestone progress, and a grid of achievements with tier-based colored borders. Features real-time updates via WebSocket and clickable coins linking to dynamic profile pages. Tooltips show real-time progress for all locked achievement types.
- **Coin Type Configuration**: Database-driven system (`coin_type_config` table) for managing five coin types (engagement, static collection, dynamic collection, flavor, legacy) via an Admin UI, enabling dynamic updates to display names, taglines, descriptions, icons, colors, and how-to-earn instructions. Public API endpoints support fetching configurations, and dynamic coin profile pages (`/coinbook/:coinId`) show achievement details and CTAs.
- **Admin Tools**: React-based dashboard with EmployeeRoute protection and `employee_admin` role. Includes sections for managing coins, coin types, live users, products, customer order items, Sentry errors, managing data (super admin-only), and user guidance analytics.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io with comprehensive integration:
  - **Backend**: Node.js SDK with request tracing, breadcrumbs, and user context
  - **Frontend**: React SDK (@sentry/react) with session replay, React error boundaries, and detailed error context
  - **Error Queue**: Queues errors that occur before Sentry initialization and flushes after DSN loads
  - **User Context**: Automatically sets user ID, email, and role on login and after Sentry initialization
  - **Instrumentation**: RankPage and useRanking hook instrumented with breadcrumbs (search, force sync, API flow) and comprehensive error captures including page, user, operation, result, error type, and operation-specific metadata
  - **Error Boundary**: React ErrorBoundary wrapping AppLayout provides user-facing fallback UI for uncaught errors
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.