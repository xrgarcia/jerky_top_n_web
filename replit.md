# Jerky Top N Web Application

## Overview
A web application for ranking jerky flavors, aiming to be a comprehensive and engaging platform for jerky enthusiasts. The project's vision is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced flavor filtering, capturing a significant market share in the niche online food review and community space.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## System Architecture
The application utilizes a modern web architecture for responsiveness, scalability, and real-time interaction, built upon React. The system is undergoing a comprehensive visual transformation to a dark, premium gaming-inspired identity system emphasizing progression, mastery, and status.

**UI/UX Decisions:**
- **Design System:** "RANK Identity System" with dark backgrounds, premium accents (gold, amber, ember), and custom typography (Manrope, Inter, IBM Plex Mono).
- **Gamification Visuals:** Features collection progress bars, tier-based colors, animated gradients, XP systems, rank progression, exclusive unlocks, tier emoji system, narrative-driven Journey Film Reel, and community badges.
- **Narrative Transitions:** Storytelling-driven section transitions with specific padding, margin, and staggered reveal animations.
- **Component Styling:** Consistent styling for product cards, loading states, error handling, admin tools, including hover glows, shimmer effects, and glow pulses.
- **Toast Notifications:** Sequential queue-based display for user feedback.

**Technical Implementations:**
- **Frontend:** React 19, React Router v7, TanStack Query, Zustand, Vite, Socket.IO Client, with route-based lazy loading and manual vendor chunking.
- **Backend:** Node.js and Express.js, employing a repository pattern.
- **Data Layer:** Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration.
- **Real-time Communication:** Socket.IO for achievement notifications.
- **Security:** Production-grade authentication using httpOnly cookies and Redis-backed rate limiting.
- **Database Interaction:** Drizzle ORM for schema management, retry logic, and safe deployments with Neon PostgreSQL multi-pool architecture.
- **Caching:** Redis-backed distributed caching system with event-driven invalidation.
- **Background Jobs:** BullMQ for asynchronous processing (Shopify sync, classification, coin recalculation, bulk import).
- **Shopify Integration:** Automatic product, metadata, and customer profile synchronization via webhooks.
- **Gamification System:** Dual-manager pattern (`EngagementManager`, `CollectionManager`) with an event-driven system for achievements, streaks, and leaderboards.
- **Personalized Guidance:** AI-driven, page-aware, and journey-aware system with an event-driven classification engine.
- **Leaderboard Optimization:** Pre-aggregated rollup table, incremental updates, and Redis-backed caching.
- **Feature Flags:** JSON-based configuration.
- **Type Safety:** Multi-layered type safety, including String conversions for Shopify IDs.

**Feature Specifications:**
- **Rank Page:** Drag-and-drop interface for ranking purchased products with persistent rankings and optimistic UI.
- **Flavors Page:** Advanced sorting, filtering, client-side instant search, and server-side pagination.
- **Product Detail Page:** Redesigned with product image, metadata, user rank, community average, ranking distribution chart, and conditional CTAs.
- **Flavor Profile Pages:** Dynamic pages for each flavor type.
- **Purchase History:** Automatic background synchronization of Shopify orders.
- **Community:** User discovery, profiles with ranking stats, top rankers widget, and privacy-aware displays.
- **Leaderboard:** Three-act storytelling structure with distinct visual treatments.
- **User Profile:** Private dashboard with handle management and privacy controls; public profile pages.
- **Gamification:** Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Coin Book Widget/Page:** Collapsible achievement tracker with US quarter coin book styling.
- **Admin Tools:** React-based dashboard for managing coins, users, products, orders, Sentry errors, data, and bulk import.
- **Bulk Import System:** Event-driven system for importing Shopify data with real-time monitoring.

## External Dependencies
- **Database:** PostgreSQL.
- **Error Tracking:** Sentry.io.
- **Real-time:** Socket.IO.
- **Email:** Custom SMTP service using nodemailer.
- **Object Storage:** Replit Object Storage (Google Cloud Storage).
## Recent Changes

### Player Card Unified Data Source (November 19, 2025)
**Status:** Production-ready

**Problem:** Homepage player card displayed three pieces of data from different API endpoints - journey stage and flavor community from guidance API, but member year from profile API (which was failing and returning undefined).

**Solution:** Consolidated all player card data into the guidance API as the single source of truth.

**Backend Changes (server/routes/gamification.js):**
- Added `shopify_created_at` field to `/api/gamification/user-guidance` response
- Fetches user data (shopify_created_at, created_at) from users table
- Returns `shopify_created_at` in both cache hit and cache miss code paths
- Falls back to `created_at` if shopify_created_at is null

**Frontend Changes (src/pages/HomePage.jsx):**
- Changed member year calculation to use `guidance?.shopify_created_at` instead of `profile?.shopify_created_at`
- Removed dependency on profile API for player card data

**Data Flow:**
1. Frontend requests `/api/gamification/user-guidance?page=general`
2. Backend returns complete player card data:
   - `classification.journeyStage` → Journey stage badge (e.g., "TASTE EXPLORER")
   - `dominantCommunity.name` + `dominantCommunity.icon` → Flavor community medallion (e.g., "🌎 EXOTIC ENTHUSIAST")
   - `dominantCommunity.description` → Flavor journey text (e.g., "You're on the Exotic flavor journey!")
   - `shopify_created_at` → Member year (e.g., "Since 2017")

**UI Elements:**
- Journey stage badge appears next to username
- Flavor journey description appears below username (when available)
- Flavor community medallion shows icon + name with member year
- All elements gracefully degrade when data is unavailable

**Outcome:** Player card displays all four personalized elements from a single unified API call, eliminating the failing profile API dependency. The flavor journey description provides narrative context for the user's flavor community membership.

### Flavor Index Renaming (November 19, 2025)
**Status:** Production-ready

**Problem:** The main catalog page was labeled "FLAVORS" in navigation, but this created ambiguity with individual flavor profile pages (e.g., "/flavors/sweet", "/flavors/spicy"). Clear disambiguation was needed.

**Solution:** Renamed "FLAVORS" to "Flavor Index" throughout the application to clarify that it's the main browsable catalog of all flavors.

**Changes:**
- **Navigation:** Updated Nav.jsx and MobileNavDrawer.jsx to display "Flavor Index" instead of "Flavors"
- **Files Renamed:**
  - `src/pages/ProductsPage.jsx` → `src/pages/FlavorIndexPage.jsx`
  - `src/pages/ProductsPage.css` → `src/pages/FlavorIndexPage.css`
- **Component Updates:** Updated component name from `ProductsPage` to `FlavorIndexPage`
- **Routes:** Updated AppLayout.jsx imports and routes (kept `/flavors` and `/products` URLs for backward compatibility)

**Terminology:**
- **"Flavor Index"** = Main catalog page listing all available flavors at `/flavors`
- **"Flavor Profile Pages"** = Individual flavor type pages at `/flavors/{flavor-name}` (e.g., sweet, spicy)
- **"Product Detail Pages"** = Individual product pages at `/flavors/{product-id}`

**Outcome:** Clear, unambiguous naming convention that distinguishes the main catalog from individual flavor pages, improving communication and reducing confusion during development and planning.
