# Jerky Top N Web Application

## Overview
A web application for ranking jerky flavors, designed to be a comprehensive and engaging platform for jerky enthusiasts. The project aims to provide users with the ability to view top-rated flavors, create personal rankings, and interact within a community. Its core ambition is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced flavor filtering capabilities, with a business vision to capture a significant market share in the niche online food review and community space.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

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
- **Gamification**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications.
- **Page View Tracking**: Asynchronous tracking for analytics.
- **Timestamp Handling**: All database timestamps are ISO 8601 UTC; client-side relative time calculation.
- **Performance**: OOP design patterns, caching, query optimization.
- **Search**: Global unified search for products and community members.
- **Styling**: Custom CSS with an earth-tone palette and component-scoped class names to prevent global CSS conflicts.
- **Database Connection**: Dual-connection architecture using Neon PostgreSQL.
- **Feature Flags**: JSON-based configuration system for cross-environment compatibility.
- **Personalized Guidance System**: AI-driven, page-aware, and journey-aware system with an event-driven classification engine that analyzes user behavior to provide targeted messages with CTAs. Enhanced with achievement hooks.
- **Dual Activity Tracking**: `trackUserSearch()` helper writes to both `user_product_searches` (legacy analytics) and `user_activities` (gamification) tables for all search operations.
- **Engagement Tracking**: `EngagementManager` reads from a unified `user_activities` table for tracking searches, product views, and profile views for engagement coin awards.
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
- **Admin Tools**: React-based dashboard with EmployeeRoute protection and `employee_admin` role, including sections for managing coins, coin types, live users, products, customer order items, Sentry errors, managing data, and user guidance analytics.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io with comprehensive integration for backend and frontend, including session replay, React error boundaries, user context, and breadcrumbs.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icons.