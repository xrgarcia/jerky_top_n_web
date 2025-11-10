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
- **Responsiveness**: Optimized for desktop, tablet, and mobile.
- **Navigation**: Single Page Application (SPA) with smooth transitions.
- **Unified Product Cards**: Consistent styling.
- **Loading States**: Skeleton screens and loading indicators.
- **Error Handling**: User-friendly error messages.
- **Admin Tools Styling**: Earth-tone styling with horizontal tab navigation.
- **Collection Progress Bar**: Tier-based colors, animated gradient, percentage display.
- **Toast Notifications**: Sequential queue-based display.
- **Tier Emoji System**: Centralized JSON-based emoji constants.

**Technical Implementations:**
- **Frontend**: React 19, React Router v7, TanStack Query, Zustand, Vite, Socket.IO Client.
- **Backend**: Node.js and Express.js, employing a repository pattern.
- **Data Layer**: Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration.
- **Real-time Communication**: Socket.IO for achievement notifications with multi-device support.
- **Session Security**: Production-grade authentication using httpOnly cookies, 90-day server-side sessions.
- **Rate Limiting**: Authentication endpoints are rate-limited using Redis.
- **Icon Rendering**: Unified utility (`src/utils/iconUtils.jsx`) for various icon types (emoji, URL, base64).
- **Code Splitting**: Route-based lazy loading using React.lazy() and Suspense, with manual vendor chunking.
- **Shopify Synchronization**: Automatic sync of products, metadata, and customer profiles via webhooks with caching and orphan cleanup.
- **Gamification**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications.
- **Personalized Guidance System**: AI-driven, page-aware, and journey-aware system with an event-driven classification engine (BullMQ-based) that analyzes user behavior to provide targeted messages with CTAs.
- **Flavor Profile Communities**: Micro-community system tracking user journey states and admin-configurable thresholds.
- **User Classification System**: Tracks journey stages, engagement levels, and exploration breadth.
- **Unified Activity Tracking**: All user activities tracked in `user_activities` table.
- **Leaderboard Performance Optimization**: Achieved 345,000x speedup through pre-aggregated `user_engagement_scores` rollup table, incremental score updates with race-condition-safe UPSERT, Redis-backed distributed cache, granular cache invalidation, and optimized queries with composite database indexes. Full cross-service integration ensures `CollectionManager` (dynamic/static collections, flavor coins) and `AchievementRepository` both increment engagement scores via `EngagementScoreService` following the same internal instantiation pattern.
- **Ranking Race Condition Fix**: Implemented sequence-based staleness detection.
- **Database Connection**: Dual-connection architecture using Neon PostgreSQL.
- **Feature Flags**: JSON-based configuration system.

**Feature Specifications:**
- **Ranking**: Persistent rankings with visual modal, duplicate prevention, optimistic UI.
- **Flavors Page**: Advanced sorting, filtering, client-side instant search, and server-side pagination.
- **Product Detail Page**: Comprehensive product information including images, brand, flavors, pricing, ranking statistics, and tags.
- **Flavor Profile Pages**: Dynamic pages for each flavor type.
- **Purchase History**: Automatic background synchronization of Shopify orders.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget, privacy-aware display, avatar support.
- **Leaderboard**: Top 50 rankers with engagement scores and badges.
- **User Profile**: Private dashboard with handle management, privacy controls, and professional profile picture upload system (cropping, compression, multi-layer validation, Replit Object Storage). Public profile pages with privacy-aware display.
- **Gamification**: Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Coin Book Widget**: Collapsible achievement tracker on the Rank page with US quarter coin book styling, tier-aware styling, hover effects, and tooltips.
- **Coin Type Configuration**: Database-driven system for managing five coin types via an Admin UI.
- **Admin Tools**: React-based dashboard with EmployeeRoute protection for managing coins, users, products, orders, Sentry errors, data, flavor profile communities, user guidance analytics, and bulk import.
- **Bulk Import System**: Comprehensive event-driven (BullMQ-based) system for importing Shopify customers and purchase history with real-time monitoring via WebSockets.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.