# Jerky Top N Web Application

## Overview
A web application for ranking jerky flavors, aiming to be a comprehensive and engaging platform for jerky enthusiasts. The project's vision is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced flavor filtering, capturing a significant market share in the niche online food review and community space.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## System Architecture
The application utilizes a modern web architecture for responsiveness, scalability, and real-time interaction, built upon a recent migration to React. The system is undergoing a comprehensive visual transformation to a dark, premium gaming-inspired identity system emphasizing progression, mastery, and status.

**UI/UX Decisions:**
- **Design System:** Transitioning from an earth-tone aesthetic to a "RANK Identity System" with dark backgrounds (`#0F0F0F`, `#1A1A1A`), premium accents (`#FFD873`, `#FF8A2B`, `#FF4D2E`), and custom typography (Manrope, Inter, IBM Plex Mono).
- **Gamification Visuals:** Features collection progress bars with tier-based colors, animated gradients, XP systems, rank progression, and exclusive unlocks. Includes tier emoji system, narrative-driven Journey Film Reel, and community badges.
- **Narrative Transitions:** Storytelling-driven section transitions with specific padding, margin, and staggered reveal animations (e.g., Homepage dark-to-light gradient, Journey to Achievements).
- **Component Styling:** Consistent styling for product cards, loading states, error handling, and admin tools. Card styling includes dark backgrounds, rounded borders, subtle shadows, and inner glows for important elements.
- **Microinteractions:** Includes hover glows, shimmer effects, and glow pulses for interactive elements.
- **Toast Notifications:** Sequential queue-based display for user feedback.

**Technical Implementations:**
- **Frontend:** React 19, React Router v7, TanStack Query, Zustand, Vite, Socket.IO Client. Employs route-based lazy loading, manual vendor chunking, and state-driven IntersectionObserver for performance.
- **Backend:** Node.js and Express.js, employing a repository pattern.
- **Data Layer:** Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration.
- **Real-time Communication:** Socket.IO for achievement notifications with multi-device support.
- **Security:** Production-grade authentication using httpOnly cookies (90-day server-side sessions) and Redis-backed rate limiting for authentication endpoints.
- **Error Monitoring:** Comprehensive Sentry instrumentation with intelligent filtering and context enrichment for actionable error reporting.
- **Database Interaction:** Drizzle ORM for schema management, retry logic, and safe deployments. Multi-pool architecture using Neon PostgreSQL with TCP keepalive and automatic retry logic. Migration runner for multi-statement execution with transactional guarantees.
- **Caching:** Comprehensive Redis-backed distributed caching system with specialized cache classes and event-driven invalidation.
- **Background Jobs:** BullMQ for asynchronous processing (Shopify sync, classification, coin recalculation, bulk import) with connection resilience and health monitoring.
- **Shopify Integration:** Automatic product, metadata, and customer profile synchronization via webhooks with caching and orphan cleanup.
- **Gamification System:** Dual-manager pattern (`EngagementManager`, `CollectionManager`) with an event-driven system for achievements, streaks, and leaderboards.
- **Personalized Guidance:** AI-driven, page-aware, and journey-aware system with an event-driven classification engine for targeted messages.
- **Leaderboard Optimization:** Pre-aggregated rollup table, incremental updates, and Redis-backed caching for sub-100ms response times.
- **Feature Flags:** JSON-based configuration system.
- **Type Safety:** Multi-layered type safety, including String conversions for Shopify IDs to meet Neon serverless driver requirements.

**Feature Specifications:**
- **Rank Page:** Three-section page with drag-and-drop interface for ranking purchased products, persistent rankings, and optimistic UI.
- **Flavors Page:** Advanced sorting, filtering, client-side instant search, and server-side pagination.
- **Product Detail Page:** Apple-inspired redesign with product image, metadata, user rank, community average, ranking distribution chart, and conditional CTAs.
- **Flavor Profile Pages:** Dynamic pages for each flavor type.
- **Purchase History:** Automatic background synchronization of Shopify orders.
- **Community:** User discovery, profiles with ranking stats, top rankers widget, and privacy-aware displays.
- **Leaderboard:** Three-act storytelling structure with distinct visual treatments and dynamic rank calculation.
- **User Profile:** Private dashboard with handle management and privacy controls; public profile pages.
- **Gamification:** Tracks engagement, collections, and flavor coin achievements with progress, streaks, and notifications.
- **Coin Book Widget/Page:** Collapsible achievement tracker with US quarter coin book styling, detailing various coin types.
- **Admin Tools:** React-based dashboard for managing coins, users, products, orders, Sentry errors, data, and bulk import.
- **Bulk Import System:** Event-driven system for importing Shopify data with real-time monitoring.

## External Dependencies
- **Database:** PostgreSQL.
- **Error Tracking:** Sentry.io.
- **Real-time:** Socket.IO.
- **Email:** Custom SMTP service using nodemailer.
- **Object Storage:** Replit Object Storage (Google Cloud Storage).

## Design System Migration (2025)

### Overview
Comprehensive transformation from earth-tone aesthetic to dark, premium gaming-inspired "RANK Identity System" emphasizing progression, mastery, and status.

### Architecture Principles
- **Centralized Theming:** All colors, typography, and design tokens defined once in `src/styles/theme.css` using CSS custom properties as single source of truth
- **No Duplication:** Zero inline styles, no tactical color/font hardcoding - all components consume CSS variables
- **Responsive by Default:** All typography tokens include mobile breakpoints for optimal cross-device experience
- **Phase-Based Migration:** Incremental updates to maintain functionality while transforming the visual identity

### Migration Phases

#### Phase 1: Foundation (COMPLETE ✅)
**Status:** Architect-reviewed and approved - November 18, 2025
**Deliverables:**
- ✅ Google Fonts integration (Manrope, Inter, IBM Plex Mono) in `index.html`
- ✅ Centralized `theme.css` with 90+ color tokens (backgrounds, accents, tiers, button states, link colors, card states, borders, loading, toasts, inputs, glows, overlays, shadows, gradients)
- ✅ Centralized `theme.css` with 70+ typography tokens (hero, headlines, body, stats, labels, eyebrow, section subtitles, button text, caption)
- ✅ Complete responsive coverage for ALL typography variants (mobile breakpoints)
- ✅ Updated `global.css` to consume theme variables for base styles
- ✅ Body background set to dark charcoal (#0F0F0F)
**Outcome:** Robust, production-ready design token system as single source of truth

#### Phase 2: Navigation & Core Layout (COMPLETE ✅)
**Status:** Architect-reviewed and approved - November 18, 2025
**Goal:** Apply RANK theme to nav, header, footer while preserving structure
**Approach:** Colors + fonts only - no layout changes
**Components:** Nav.css, Header.css, Footer.css
**Outcome:** All navigation components now use correct theme.css variables for dark, premium gaming aesthetic

#### Phase 3: Feature Pages (COMPLETE ✅)
**Status:** Architect-reviewed and approved - November 18, 2025
**Goal:** Transform all page-level CSS files to use RANK theme tokens
**Approach:** Theme application without structural changes - colors and fonts only
**Components:** 17 page-level CSS files updated with 100% theme token coverage
**Files Updated:**
- Main pages: HomePage.css, RankPage.css, ProductsPage.css, ProductDetailPage.css
- Community pages: CommunityPage.css, LeaderboardPage.css, ProfilePage.css, PublicProfilePage.css
- Detail pages: FlavorProfilePage.css, CoinBookPage.css, CoinProfilePage.css, UserProfilePage.css
- Admin pages: AdminPages.css, ToolsLayout.css, QueueMonitorPage.css, CoinTypesPageAdmin.css, BulkImportPage.css
**Outcome:** All page-level styles now use centralized theme tokens exclusively with NO hardcoded colors (rgba, hex, or rgb values eliminated). Dark, premium gaming aesthetic applied consistently across all feature pages while preserving existing layout structure and functionality.

#### Phase 4: Shared Components (PENDING)
**Goal:** Update cards, buttons, forms, modals, loading states
**Approach:** Consume theme tokens, maintain existing patterns
**Components:** All component CSS files

#### Phase 5: Homepage Redesign (PENDING)
**Goal:** Implement complete gaming-inspired homepage with new layout
**Scope:** User profile hero, Top 3 Flavors, action cards, Next Unlock widget, Featured Drop
**Approach:** Full redesign with new structure, narrative transitions, and gamification visuals

### Design Token Inventory

**Color Palette (90+ tokens):**
- Backgrounds: charcoal (#0F0F0F), obsidian (#1A1A1A), slate (#2A2A2A), smoke (#3D3D3D), ash (#5c5c5c)
- Text: primary (#E5E5E5), secondary (#C0C0C0), tertiary (#A3A3A3), muted (#777777), subtle (#555555), disabled (#3D3D3D), inverted (#0F0F0F)
- Accents: gold (#FFD873), amber (#FF8A2B), ember (#FF4D2E)
- Tier badges: bronze (#CD7F32), silver (#C0C0C0), gold (#FFD700), platinum (#E5E4E2), diamond (#B9F2FF)
- Neutral ramp: 50-900 grayscale spectrum
- Button states: primary/secondary/danger with hover/active variants
- Link colors: default/hover/visited/active
- Card states: hover/selected with borders
- Border colors: default/hover/focus/error/success
- Loading states: skeleton backgrounds and shimmer effects
- Toast backgrounds: success/error/warning/info with transparency
- Input states: background/border variants
- Glow effects: amber/gold/ember with opacity
- Opacity overlays: hover/loading/disabled
- Shadow system: subtle/medium/strong

**Typography Scale (70+ tokens):**
- Hero display: 72px/48px (desktop/mobile), ExtraBold, -1px tracking
- Headlines: H1 (48px/40px), H2 (36px/32px), H3 (28px/24px), H4 (20px/18px), H5 (16px/14px)
- Body text: Default (16px/15px), Medium (18px), Small (14px/13px)
- Monospace: 16px/14px, IBM Plex Mono for stats/data
- Labels: Default (14px/12px), Small (12px/11px) with 0.3px tracking, UPPERCASE
- Eyebrow: 14px/12px, SemiBold, 1.5px tracking, UPPERCASE
- Section subtitle: 18px/16px, Regular, 1.6 line height
- Stat variants: Large (32px/24px), Medium (24px/20px), Small (16px/14px)
- Button: 14px/13px, SemiBold, 0.5px tracking, UPPERCASE
- Caption: 12px/11px, Regular

**Gradients:**
- Ember: 135deg, #FF4D2E → #FF8A2B
- Amber: 135deg, #FF8A2B → #FFD873
- Gold: 135deg, #FFD873 → #FFA500
- Dark: 180deg, #0a0a0a → #1a1a1a → #2d2d2d

### File Structure
```
src/styles/
├── theme.css          # Single source of truth - 90+ colors, 70+ typography tokens
├── global.css         # Base styles consuming theme variables
└── [component].css    # Component styles (consume theme tokens only)
```

### Next Session Goals
**Phase 4 Tasks:**
1. Identify all shared component CSS files (cards, buttons, forms, modals, loading states, etc.)
2. Apply RANK theme tokens to each component systematically
3. Ensure consistent theming across reusable components
4. Architect review before proceeding to Phase 5

**Key Principles for Phase 4:**
- Change colors/fonts ONLY - preserve existing component structure
- All changes must reference theme.css variables (no hardcoded values)
- Focus on shared/reusable component styles
- Maintain component functionality and reusability while applying dark theme