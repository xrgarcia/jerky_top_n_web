# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, providing a comprehensive and engaging platform for jerky enthusiasts. The application allows users to view top-rated products, create personal rankings, and engage with a community through interactive features. The project aims to become a leading platform in the jerky enthusiast community by leveraging gamification, social interaction, and advanced product filtering.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## Development & Testing
- **Dev Login Endpoint**: `/dev/login/:token` - Secure development-only login bypass for testing
  - **Security**: Multi-layered protection (environment checks, localhost-only socket IP validation, token validation)
  - **Requirements**: 
    - `DEV_LOGIN_TOKEN` environment variable (GUID format, e.g., `1d27b23c-215b-4f18-b0a8-493494066288`)
    - `DEV_LOGIN_EMAIL` environment variable (email of user to impersonate)
  - **Restrictions**: Only works when `NODE_ENV != production` AND `REPLIT_DEPLOYMENT != 1` AND request from localhost socket
  - **Usage**: Visit `http://localhost:5000/dev/login/{YOUR_TOKEN}` → auto-creates 90-day session → redirects to app
  - **Session Handling**: Creates httpOnly cookie with `SameSite=none; Secure` (required for Replit iframe) + stores sessionId in localStorage via `#login-success` hash route
  - **IMPORTANT**: If you previously logged in before November 1, 2025, clear your `session_id` cookie or visit dev login again to get new SameSite=none cookie

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

### Frontend Architecture (React Migration - November 2025)
The application was migrated from vanilla JavaScript to React + React Router for improved maintainability and developer experience.

**Technology Stack:**
- **React 19** - Modern UI library with component-based architecture
- **React Router v7** - Client-side routing with protected routes
- **TanStack Query (React Query)** - Server state management with automatic caching, background refetching, and query invalidation
- **Zustand** - Lightweight global state management for auth and UI state
- **Vite** - Fast build tool and dev server
- **Socket.IO Client** - Real-time WebSocket integration with automatic query invalidation

**Project Structure:**
```
src/
├── main.jsx                 # App entry point with providers
├── App.jsx                  # Root component with routing
├── components/
│   ├── layout/             # AppLayout, Header, Nav, Footer
│   └── auth/               # ProtectedRoute wrapper
├── pages/                  # Page components (Home, Products, CoinBook, etc.)
├── hooks/                  # React Query hooks and custom hooks
│   ├── useProducts.js
│   ├── useGamification.js
│   ├── useCommunity.js
│   ├── useRankings.js
│   └── useSocket.js
├── store/                  # Zustand stores
│   └── authStore.js
├── utils/                  # Utilities
│   └── api.js             # API client with error handling
└── styles/                 # Global and component-scoped CSS
```

**Data Layer:**
- **API Client**: Centralized fetch wrapper with automatic credential inclusion (httpOnly cookies) and error handling
- **Session Management**: All API endpoints use httpOnly cookies for authentication (with query param fallback for backwards compatibility)
- **React Query Hooks**: All server data fetched via hooks with proper cache keys and stale times
- **Query Invalidation**: Mutations automatically invalidate related queries for real-time UI updates
- **WebSocket Integration**: Socket events trigger query invalidations for live data synchronization

**Pages Migrated:**
- Home - Hero dashboard with yellow banner, live stats (using `/api/gamification/hero-stats`), achievements slider, and dual CTAs
- Products - Search, filter, sort functionality
- Leaderboard - Top 50 rankers with badges
- Coin Book - Achievement grid with earned/locked states
- Community - User search and profiles
- Profile - Personal stats and rankings
- Rank - Product ranking with proper error handling
- Login - Magic link authentication

### UI/UX Decisions
- **Design Inspiration**: Clean, professional aesthetic inspired by jerky.com, using an earth-tone color palette.
- **Responsiveness**: Optimized for desktop, tablet, and mobile.
- **Navigation**: Single Page Application (SPA) with React Router, smooth transitions without page flashing
- **Unified Product Cards**: Consistent card styling across all product displays.
- **Loading States**: Skeleton screens and loading indicators for all async operations
- **Error Handling**: User-friendly error messages with actionable feedback

### Technical Implementations
- **Frontend**: React with component-based architecture, TanStack Query for server state, Zustand for client state.
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
- **Ranking Commentary System**: Dynamic, contextual encouragement messages on the Rank page that adapt to user progress (0, 1-5, 6-15, 16-30, 31-50, 51-75, 76-88, 89 complete tiers), incorporating streak information and displaying next closest achievement milestones with progress indicators.
- **Admin Tools**: Role-based access for managing achievements, monitoring live users, custom icon uploads, and a Customer Order Items dashboard with fulfillment status tracking, real-time updates via WebSockets, and filterable, sortable, paginated Shopify order line item data.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io for both backend (Node.js SDK) and frontend (Browser SDK with session replay).
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icon uploads.