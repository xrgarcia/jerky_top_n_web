# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, providing a comprehensive and engaging platform for jerky enthusiasts. The application allows users to view top-rated products, create personal rankings, and engage with a community through interactive features. The project aims to become a leading platform in the jerky enthusiast community by leveraging gamification, social interaction, and advanced product filtering.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## Production Deployment
- **Custom Domain**: rank.jerky.com
- **Domain Detection**: Uses `REPLIT_DOMAINS` environment variable in production (automatically set by Replit when custom domain is configured)
- **Environment**: Set `NODE_ENV=production` for production deployments
- **Redis Configuration** (workaround for Replit's broken secrets sync UI):
  - **Development**: Set `UPSTASH_REDIS_URL` in workspace secrets (standard variable name)
  - **Production**: Set `UPSTASH_REDIS_URL_PROD` in deployment secrets only (separate variable to avoid sync bugs)
  - Code automatically detects production via `REPLIT_DEPLOYMENT=1` and selects correct variable
  - When Replit fixes their secrets UI, dev will continue to work with standard `UPSTASH_REDIS_URL`

## System Architecture
The application employs a modern web architecture for responsiveness, scalability, and real-time interaction.

### UI/UX Decisions
- **Design Inspiration**: Clean, professional aesthetic inspired by jerky.com, using an earth-tone color palette.
- **Responsiveness**: Optimized for desktop, tablet, and mobile.
- **Layout Width**: Expanded from 1200px to 1600px for better screen utilization on large displays.
- **Hero Gamification Dashboard**: Homepage hero section features a live engagement dashboard with stats, social proof, user progress, and real-time updates via WebSockets.
- **Minimal Page Headers**: Content pages utilize compact headers with breadcrumbs, title, subtitle, and action buttons. Achievement detail pages use an ultra-minimal header (breadcrumbs + action button only) to let the dynamic hero section be the primary visual focus.
- **Unified Product Cards**: Consistent card styling across all product displays.
- **Home Page Dashboard**: Dynamic Bento Box layout with interactive widgets.
- **Interactive Ranking**: Supports drag-and-drop for desktop and dropdown selection for mobile with visual cues and badges.
- **Achievement Detail Pages**: Enhanced gamification with animated progress rings, "Next Up" spotlight, motivational callouts, quick-rank buttons, and locked item effects. Static collections feature a unified adaptive hero section that consolidates progress visualization, stats, and smart commentary into a single component (replaces separate stats cards, header, and callout) with three states: discovery (blue gradient with shop CTA), progress (orange gradient with stats row and ring), and success (green gradient with celebration).
- **Terminology Glossary Alignment**: Commentary system follows official glossary where "Explore" = breadth (trying new things) and "Discover" = depth (refining preferences). Discovery state (0% completion) uses "Explore" language to encourage trying new products.
- **Navigation**: Single Page Application (SPA) with hash routing, preserving state and supporting deep-linking, with automatic data refresh on navigation.

### Technical Implementations
- **Frontend**: Vanilla JavaScript with an event-driven `EventBus` and `ServiceRegistry` for dependency injection.
- **Backend**: Node.js and Express.js, using a repository pattern.
- **User Privacy**: `CommunityService` centralizes user data handling, truncating last names.
- **User Activation System**: Users default to `active=false` (hidden from community) until their first login, after which `active=true`.
- **Real-time Communication**: Socket.IO for bidirectional communication, managing achievement notifications with a pending queue and multi-device support.
- **Session Persistence**: Dual-layer authentication using httpOnly cookies and localStorage sessionId.
- **Rate Limiting**: Authentication endpoints protected with 10 requests per 15 minutes per IP (applies to both email-login and magic-login), using Redis for distributed tracking across instances.
- **Product Management**: `ProductsService` combines external product data with metadata and ranking statistics, including advanced filtering.
- **Shopify Synchronization**: Automatic sync system for products and metadata with Shopify, featuring cache warming on startup, selective cache updates via webhooks, orphan cleanup, and dual cache staleness thresholds with Sentry monitoring.
- **Gamification Architecture**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) for achievement processing, with an event-driven system for tracking progress, streaks, leaderboards, and notifications. `ProgressTracker` unifies progress calculation across achievement types.
- **Page View Tracking**: Asynchronous tracking for detailed analytics.
- **Timestamp Handling**: All database timestamps are converted to ISO 8601 UTC, with client-side relative time calculation.
- **Top Rankers**: Calculated by an engagement score.
- **Most Debated Products**: Identified using PostgreSQL STDDEV for ranking variance.
- **Streak Tracking**: Calendar-day-based streak calculation.
- **Performance Optimizations**: OOP design patterns, caching, and query optimization.
- **Search**: Global unified search with type-ahead for products and community members.
- **Styling**: Custom CSS with an earth-tone color palette.
- **Database Connection Strategy**: Dual-connection architecture using Neon PostgreSQL for pooled and dedicated connections.

### Feature Specifications
- **Ranking**: Persistent rankings with a visual modal, duplicate prevention, optimistic UI, and a hybrid reliability system (IndexedDB-backed queue, server-side idempotency, automatic retry, recovery).
- **Products Page**: Advanced sorting, filtering by animal and flavor, client-side instant search, and server-side pagination.
- **Rank Page Products**: Server-side filtering to exclude already-ranked products. Non-employee users can only rank purchased products, with automatic Shopify order synchronization on login. Employee users bypass purchase restrictions.
- **Purchase History System**: Automatic background synchronization of Shopify orders on user login with caching and optimized database indexes.
- **Shopify Webhook Integration**: Real-time synchronization for customer orders and product data via webhooks (orders/create, orders/updated, orders/cancelled, products/update, products/create) with HMAC SHA-256 verification, orphan cleanup, and cache invalidation. Tracks individual order line items with fulfillment status (fulfilled, unfulfilled, partial, restocked).
- **Community**: Discover users, search, view profiles with ranking statistics, and display top rankers widget.
- **Leaderboard**: Displays top 50 rankers with engagement scores and badges.
- **User Profile**: Displays user information and ranking statistics.
- **Gamification**: Tracks engagement, static collections, dynamic collections, and flavor coin achievements with progress tracking, streaks, leaderboards, and notifications.
- **Admin Tools**: Role-based access for managing achievements, monitoring live users, custom icon uploads, and a Customer Order Items dashboard with fulfillment status tracking, real-time updates via WebSockets, and filterable, sortable, paginated Shopify order line item data.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io for both backend (Node.js SDK) and frontend (Browser SDK with session replay).
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icon uploads.