# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, designed to be a comprehensive and engaging platform for jerky enthusiasts. The project aims to provide users with the ability to view top-rated products, create personal rankings, and interact within a community. Its core ambition is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced product filtering capabilities.

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
- **Toast Notifications**: Sequential queue-based display system (FIFO) prevents message overlap, showing one toast at a time with 300ms transition delay and configurable duration (default 5s). WebSocket events (achievements:earned, flavor_coins:earned, tier:upgrade) trigger toasts with tier-specific formatting and emojis (🥉🥈🥇💎💠).

**Feature Specifications:**
- **Ranking**: Persistent rankings with visual modal, duplicate prevention, optimistic UI, and hybrid reliability system. Non-employee users can only rank purchased products.
- **Products Page**: Advanced sorting, filtering (animal, flavor), client-side instant search, and server-side pagination.
- **Purchase History**: Automatic background synchronization of Shopify orders on login.
- **Shopify Webhook Integration**: Real-time sync for orders and products with HMAC SHA-256 verification.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget.
- **Leaderboard**: Top 50 rankers with engagement scores and badges.
- **User Profile**: Personal stats and rankings.
- **Gamification**: Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Ranking Commentary**: Dynamic, contextual encouragement messages with intelligent percentage-based tiers (0-10%, 11-25%, 26-50%, 51-75%, 76-90%, 91-99%) calculated from progress toward specific achievement milestones, filtered to show only `category='ranking'` achievements.
- **Collection Progress Bar**: User-specific progress tracking on the Rank page, indicating progress towards achievements.
- **Coin Book Widget**: Wood-inspired, collapsible achievement tracker on the Rank page featuring:
    - Wood-frame design with earth-tone palette (sage green #7b8b52, earthy gold #c4a962)
    - Collapsed state: User stats (rankings, streak), last earned achievement icon
    - Expanded state: Next milestone with progress bar + achievement grid with tier-based colored borders
    - Real-time updates via WebSocket (achievements:earned, flavor_coins:earned, tier:upgrade, gamification:progress:updated events)
    - Progress updates broadcast after rankings saved, triggering live refresh of "Your Progress" section
    - Custom hooks for `/api/gamification/achievements` and `/api/gamification/progress` endpoints
- **Admin Tools**: React-based dashboard with:
    - EmployeeRoute protection, `employee_admin` role.
    - Nested routing (`/admin/tools/*`).
    - Super Admin Access: Dynamic backend-driven access control with immediate cache invalidation.
    - Six Sections: Manage Coins, Live Users, Manage Products (searchable table, multi-filter UI, edit modal with optimistic updates), Customer Order Items (7 filters, sortable columns, pagination, WebSocket live updates, linkable URL state), Sentry Errors, Manage Data (super admin-only).

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io (backend and frontend with session replay).
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.