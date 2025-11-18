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
- **Error Monitoring:** Sentry instrumentation with intelligent filtering.
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

## Recent Updates

### Personalized Hero Identity System (November 18, 2025)
**Status:** Production-ready and architect-approved

**Problem:** Homepage hero section used hardcoded badges ("Taste Explorer" based on achievement count) and static medallion text ("Taste Tester" / "Since 2023"), disconnected from the existing personalized guidance system that already tracks journey classification and flavor communities.

**Solution:** Connected the hero section to the personalized guidance and profile APIs to display dynamic, meaningful user identity based on their actual journey stage, flavor community, and Shopify account creation date.

**Journey Badge Mapping:**
- Badge now reflects user's journey stage from personalized guidance system:
  - `new_user` → "TASTE EXPLORER"
  - `active_user` → "FLAVOR ENTHUSIAST"
  - `power_user` → "FLAVOR MASTER"
  - `dormant` → "RETURNING RANKER"
- Replaces hardcoded achievement-count logic (0-4 = Explorer, 5-9 = Enthusiast, 10+ = Expert)

**Medallion Display:**
- **Primary flavor community**: Shows icon + name from guidance system (e.g., "🌶️ Spicy Seekers", "🍖 BBQ Lovers")
- **Fallback**: "Taste Tester" when no community assigned yet
- **Member year**: Displays actual Shopify account creation year from `shopifyCreatedAt` field
- **Fallback**: Uses app `createdAt` if Shopify date unavailable, defaults to 2023 if neither exists

**Backend Changes (server/routes/profile.js):**
- Added `shopify_created_at` to `/api/profile` endpoint response
- Profile now returns Shopify account creation date for displaying member year

**Frontend Changes (src/pages/HomePage.jsx, src/hooks/):**
- Created `useUserGuidance` hook for fetching personalized guidance data (journey stage, flavor communities)
- Created `useProfile` hook for fetching user profile data (Shopify created date)
- Journey badge sources from `guidance.classification.journeyStage` with title mapping
- Medallion displays `guidance.stats.flavorCommunities[0]` (primary community)
- Member year extracted from `profile.shopify_created_at` or `profile.created_at`
- Both hooks use React Query with 5-minute cache, following existing patterns

**Outcome:** Homepage hero now reflects each user's personalized journey and flavor identity from the guidance system. Journey badges show meaningful progression stages, medallion displays actual flavor community affiliation (not generic text), and member year shows real account creation date. The hero section is now part of the integrated personalized guidance experience.

### Collection Progress Visualization (November 18, 2025)
**Status:** Production-ready and architect-approved

**Problem:** Homepage hero section initially showed arbitrary "level" progression (every 10 rankings = 1 level), then was updated to a 3-layer visualization that included "Owned" products, which felt sales-oriented rather than game-focused. Finally, the progress bar only showed ranked products, missing visual indication of rankable (purchasable) products.

**Solution:** Redesigned to show two-layer progress bar displaying both rankable and ranked products as percentages of the total catalog (164 products).

**Progress Bar Logic:**
- **Two visible layers relative to total catalog:**
  - Light amber layer: rankable products (what user can rank) as % of catalog
  - Gold gradient layer: ranked products (what user has ranked) as % of catalog
- Example: User owns 5 flavors, ranked 0 → progress bar shows ~3% light amber (5/164), 0% gold (0/164)
- Example: Employee owns 164 flavors (all), ranked 42 → progress bar shows 100% light amber (164/164), ~25.6% gold (42/164)
- Both layers clamped to 100% to handle data anomalies

**Backend Changes (server/routes/gamification.js):**
- Added `purchasedProductCount` to track rankable products (what user can currently rank)
- For **employees**: `purchasedProductCount` = total catalog (164) - unrestricted access via role/email detection
- For **regular users**: `purchasedProductCount` = purchased products only
- Renamed `totalRankableProducts` to `totalCatalog` for clarity
- Enriched `/api/gamification/progress` response with both new fields
- Requires database fetch to detect employee status: `user?.role === 'employee_admin' || user?.email?.endsWith('@jerky.com')`

**Frontend Changes (src/pages/HomePage.jsx, src/pages/HomePage.css):**
- Removed arbitrary level/XP calculations
- Changed progress calculations to show both layers relative to catalog:
  - `rankablePercent = (purchasedProductCount / totalCatalog) * 100`
  - `rankedPercent = (uniqueProducts / totalCatalog) * 100`
- Simplified stats display: "Ranked | Catalog" (removed "Owned" to avoid sales-y feel)
- Two-layer progress bar: light amber base (rankable space) with gold gradient overlay (ranked progress)
- CSS uses absolute positioning with z-index to layer ranked on top of rankable
- Added Math.min clamping to prevent progress exceeding 100%

**Outcome:** Users see their ranking journey in context of the full catalog. The light amber layer shows collection potential (what they can rank), while the gold layer shows ranking progress (what they've ranked). This makes the ranking journey visible and meaningful, not sales-focused.

### Navigation Responsiveness Enhancement (November 18, 2025)
**Status:** Production-ready and architect-approved

**Problem:** Navigation bar was getting cut off at medium viewport sizes (tablets and smaller laptops), causing search bar and user controls to overflow off-screen.

**Solution:** Implemented cascading responsive breakpoint system:
- **>1000px:** Full desktop layout with all navigation links visible
- **768px-999px:** Hamburger menu displayed, search bar min-width 220px (stable for tablets)
- **480px-767px:** Hamburger menu, search bar max-width 160px with flex-shrink (mobile)
- **<480px:** Hamburger menu, search bar max-width 120px with flex-shrink (small mobile)

**Key Changes:**
- Main breakpoint changed from 767px to 999px to show hamburger menu earlier
- Properly reset min-width to 0 and enabled flex-shrink at mobile breakpoints to prevent horizontal overflow
- Removed redundant tablet-specific media query (768px-1024px)
- Ensured search bar and user controls (profile, logout) remain accessible across all screen sizes

**Outcome:** Navigation links never overflow at medium viewports, all controls remain visible and accessible without horizontal scrolling on any device.

### Flavor Community Medallion Bug Fix (November 18, 2025)
**Status:** Production-ready and architect-approved

**Problem:** Homepage hero medallion was always showing "TASTE TESTER" fallback instead of displaying user's actual flavor community. PersonalizedGuidanceService was accessing non-existent `tier` field instead of correct `state` field from classification data. Additionally, medallion text was cramped due to missing padding and tight spacing.

**Solution:** Fixed field name mismatch in dominantCommunity extraction and improved medallion CSS for better readability.

**Backend Changes (server/services/PersonalizedGuidanceService.js):**
- Fixed `_extractDominantFlavorCommunity` to access `current.state` instead of `current.tier` (matches classification data format)
- Added lowercase flavor emoji mappings for all flavor types: sweet, spicy, savory, teriyaki, bbq, exotic, peppery
- Added capitalization logic for flavor profile display names
- Tier priority system correctly extracts highest-tier community: enthusiast (6) > explorer (5) > moderate (4) > taster (3) > seeker (2) > curious (1)
- Returns formatted dominantCommunity object: `{name: "Sweet Enthusiast", icon: "🍯", flavorProfile: "sweet", tier: "enthusiast"}`

**Frontend Changes (src/pages/HomePage.css):**
- Added 20px padding and `box-sizing: border-box` to `.hero-medallion` for breathing room
- Increased gap from 4px to 10px in `.medallion-content` for better text spacing
- Added `line-height: 1.4` to both `.medallion-label` and `.medallion-year` for comfortable reading
- Made `.medallion-label` a flex column with 4px gap to properly stack emoji and text
- Added `text-align: center` to `.medallion-content` for centered display

**Year Display Logic (already correct):**
- Homepage uses `shopify_created_at` from profile API as primary source
- Falls back to `created_at` if Shopify date unavailable
- Only defaults to 2023 if both fields are missing
- Profile API correctly returns `shopify_created_at` field from database

**Outcome:** Medallion now correctly displays user's dominant flavor community ("🍯 SWEET ENTHUSIAST" instead of "TASTE TESTER") with improved spacing and readability. Member year displays actual Shopify account creation year (e.g., "Since 2017") instead of hardcoded fallback. The personalized hero section is now fully integrated with the guidance system's flavor community classification.