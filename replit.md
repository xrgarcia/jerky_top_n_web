# Jerky Top N Web Application

## Overview
A web application for ranking jerky flavors, aiming to be a comprehensive and engaging platform for jerky enthusiasts. The project's vision is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced flavor filtering, capturing a significant market share in the niche online food review and community space.

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
- **Unified Components**: Consistent styling for product cards, loading states, error handling, and admin tools.
- **Gamification Visuals**: Collection progress bar with tier-based colors, animated gradient, and percentage display. Tier emoji system and centralized JSON-based emoji constants.
- **Flavor Community Badges**: Visual identity system displaying user's primary flavor profile with unique colors, gradients, emojis, and community states on community cards.
- **Journey Film Reel Feature**: Apple-style storytelling for public profile pages, celebrating user flavor discovery journeys with horizontal scrolling film strips, product images, and narrative moments.
- **Journey → Achievements Transition**: Storytelling-driven section transition with specific padding and margin for a "chapter break" effect, and staggered sequential reveal animation for achievements.
- **HomePage Narrative Transition**: Dark-to-light gradient transition section between HeroCarousel and stats section with radial golden glow effect, creating smooth visual and narrative bridge following three-act pattern (Hero → Introduction → Action).
- **Toast Notifications**: Sequential queue-based display.

**Technical Implementations:**
- **Frontend**: React 19, React Router v7, TanStack Query, Zustand, Vite, Socket.IO Client.
- **Routing Architecture**: Unified `/flavors/:id` route with intelligent FlavorRouter component that differentiates numeric product IDs from string flavor names using component-level validation (React Router v7 removed regex pattern support). Automatic redirects from legacy `/products/:id` URLs for backwards compatibility. Product detail pages accessed via `/flavors/[numeric-id]` and flavor profile pages via `/flavors/[flavor-name]`.
- **Build Configuration**: Vite builds to `dist/` directory (separate from `public/` to avoid publicDir/outDir conflict). Express serves both unbundled public assets (logo, favicon, robots.txt) and built SPA bundle. Production branding uses "RANK." logo (Nov 2025).
- **Backend**: Node.js and Express.js, employing a repository pattern.
- **Data Layer**: Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration.
- **Real-time Communication**: Socket.IO for achievement notifications with multi-device support.
- **Security**: Production-grade authentication using httpOnly cookies (90-day server-side sessions) and Redis-backed rate limiting for authentication endpoints.
- **Error Monitoring**: Comprehensive Sentry instrumentation with automatic context enrichment. Zero per-request database overhead - user identity (id/email/username/role) fetched lazily via beforeSend hook only when errors occur. Middleware tags endpoint/method and uses scope-level event processor to capture matched Express routes. Every error report includes full context without impacting performance on successful requests.
- **Icon Rendering**: Unified utility (`src/utils/iconUtils.jsx`) for various icon types (emoji, URL, base64).
- **Performance**: Route-based lazy loading with React.lazy() and Suspense, manual vendor chunking, and state-driven IntersectionObserver for scroll animations.
- **Shopify Synchronization**: Automatic sync of products, metadata, and customer profiles via webhooks with caching and orphan cleanup, processed asynchronously with BullMQ. Multi-layered type safety ensures numeric Shopify IDs are converted to strings at service and repository layers before database queries (Neon serverless driver requirement). Order cancellations and fulfillment status downgrades (delivered → not delivered) trigger automatic ranking cleanup and coin recalculation via CoinRecalculationQueue/Worker.
- **Gamification System**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications.
- **Personalized Guidance System**: AI-driven, page-aware, and journey-aware system with an event-driven classification engine (BullMQ-based) for targeted messages with CTAs.
- **User Classification**: Tracks journey stages, engagement levels, and exploration breadth.
- **Unified Activity Tracking**: All user activities tracked, with dual-track search analytics.
- **Leaderboard Optimization**: 345,000x speedup via pre-aggregated rollup table (`user_engagement_scores`), incremental updates, Redis-backed distributed cache, and granular invalidation. Both `getLeaderboard()` and `getUserPosition()` queries use the rollup table for consistent sub-100ms performance (400x improvement for position queries).
- **Distributed Caching**: Comprehensive Redis-backed system with specialized cache classes (leaderboard, user classification, streaks, progress, achievements, user profiles, guidance, journey, purchase history, product metadata, ranking stats) and event-driven invalidation for sub-100ms response times. All caches use DistributedCache abstraction providing Redis-backed storage with automatic in-memory fallback.
- **Database Connection**: Multi-pool architecture using Neon PostgreSQL with TCP keepalive and automatic retry logic.
- **Redis Connection**: Singleton-based connection pooling for BullMQ workers and Upstash Redis with exponential backoff + jitter, event-driven lifecycle management, and automatic dependent connection reinitialization.
- **Connection Resilience**: Production-grade error handling preventing cascading failures (JERKY-RANK-UI-9). All BullMQ workers (WebhookWorker, ClassificationWorker, BulkImportWorker, EngagementBackfillWorker, CoinRecalculationWorker) automatically pause during Redis outages and resume when reconnected. Health monitoring endpoint (`/api/health/connections`) tracks Redis, PostgreSQL, and worker status with accurate 503/200 responses.
- **Feature Flags**: JSON-based configuration system.
- **Database Schema Management**: Drizzle ORM with automatic validation, retry logic, and safe deployment scripts.
- **Migration Runner**: WebSocket-backed Pool/Client for true multi-statement execution with transactional guarantees (BEGIN/COMMIT/ROLLBACK). Properly handles complex PostgreSQL syntax (DO blocks, functions, triggers). Fixed Nov 2025 to resolve silent failure issue with HTTP driver that only executed first statement.
- **Type Safety**: Multi-layer defense with String() conversions for Shopify IDs at service and repository layers (Neon serverless driver requirement for TEXT columns).

**Feature Specifications:**
- **Rank Page**: Elegant three-section page with hero section, introduction, and two-column drag-and-drop interface for ranking purchased products. Features persistent rankings, visual modal, duplicate prevention, optimistic UI, and responsive design.
- **Flavors Page**: Advanced sorting, filtering, client-side instant search, and server-side pagination.
- **Product Detail Page**: Comprehensive product information including images, brand, flavors, pricing, ranking statistics, and tags.
- **Flavor Profile Pages**: Dynamic pages for each flavor type.
- **Purchase History**: Automatic background synchronization of Shopify orders.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget, privacy-aware display, avatar support, and narrative-driven UserCard component.
- **Leaderboard**: Three-act storytelling structure ("The Champions", "Rising Contenders", "The Community") with distinct visual treatments and dynamic rank calculation.
- **User Profile**: Private dashboard with handle management, privacy controls, and professional profile picture upload. Public profile pages with privacy-aware display.
- **Gamification**: Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Coin Book Widget**: Collapsible achievement tracker on the Rank page with US quarter coin book styling.
- **Coin Book Page**: Typography-first three-act narrative page celebrating user achievement journey, detailing Flavor Coins, Engagement Coins, and Dynamic Master Collections.
- **Coin Type Configuration**: Database-driven system for managing five coin types via an Admin UI.
- **Admin Tools**: React-based dashboard for managing coins, users, products, orders, Sentry errors, data, flavor profile communities, user guidance analytics, and bulk import.
- **Bulk Import System**: Comprehensive event-driven (BullMQ-based) system for importing Shopify customers and purchase history with real-time monitoring via WebSockets.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.