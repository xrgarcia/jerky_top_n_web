# Jerky Top N Web Application

## Overview
A web application for ranking jerky flavors, aiming to be a comprehensive and engaging platform for jerky enthusiasts. The project's vision is to become a leading platform in the jerky enthusiast community through gamification, social interaction, and advanced flavor filtering, capturing a significant market share in the niche online food review and community space.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## Design System Migration (2025)

### Overview
The application is undergoing a comprehensive visual transformation from a light, earth-tone community aesthetic to a dark, premium gaming-inspired identity system. This migration emphasizes progression, mastery, and status through XP systems, rank progression, and exclusive unlocks.

**Current Design (Earth Tone Theme):**
- Light beige background (#f5f3ed)
- Sage green (#7b8b52) and warm gold (#c4a962) accents
- System fonts (Apple system stack)
- Product/community-focused layout

**New Design (RANK Identity System):**
- Dark backgrounds (#0F0F0F Charcoal Black, #1A1A1A Depth Black)
- Premium accents (#FFD873 Rank Gold, #FF8A2B Molten Amber, #FF4D2E Ember Red)
- Custom typography: Manrope (headlines), Inter (body), IBM Plex Mono (stats)
- Gaming aesthetics: XP, progression, achievements, unlocks

### Design Specifications

**Color Palette:**
```css
/* Primary Backgrounds */
--rank-bg-charcoal: #0F0F0F;        /* Page backgrounds */
--rank-bg-card: #1A1A1A;            /* Card/module backgrounds */
--rank-bg-card-elevated: #2A2A2A;   /* Elevated cards, hover states */
--rank-line-steel: #3D3D3D;         /* Dividers, borders, separators */
--rank-bg-input: #2A2A2A;           /* Form inputs, search bars */

/* Text Colors */
--rank-text-white: #FFFFFF;         /* Pure white for headlines */
--rank-text-soft-white: #E5E5E5;    /* Soft white for subheadings */
--rank-text-warm-white: #F2F2F2;    /* Warm white for primary readability */
--rank-text-body: #CCCCCC;          /* Body text, paragraphs */
--rank-text-muted: #999999;         /* Muted secondary text */
--rank-text-label: #777777;         /* Low-emphasis labels, metadata */
--rank-text-soft-gray: #5C5C5C;     /* Disabled states, very low emphasis */

/* Accent Colors - Primary */
--rank-gold: #FFD873;               /* Coins, highlights, rarity signals */
--rank-amber: #FF8A2B;              /* XP fill, progression, warmth */
--rank-ember: #FF4D2E;              /* Heat, spice, danger cues */

/* Tier/Badge Colors (Achievement System) */
--rank-bronze: #CD7F32;             /* Bronze tier, entry achievements */
--rank-silver: #C0C0C0;             /* Silver tier, intermediate */
--rank-gold-metal: #FFD700;         /* Gold tier, advanced */
--rank-platinum: #E5E4E2;           /* Platinum tier, expert */
--rank-diamond: #B9F2FF;            /* Diamond tier, master */

/* Neutral Ramp (Extended) */
--rank-neutral-900: #0a0a0a;        /* Darkest backgrounds */
--rank-neutral-800: #1a1a1a;        /* Card backgrounds */
--rank-neutral-700: #2a2a2a;        /* Elevated cards */
--rank-neutral-600: #3d3d3d;        /* Borders, dividers */
--rank-neutral-500: #5c5c5c;        /* Disabled text */
--rank-neutral-400: #777777;        /* Label text */
--rank-neutral-300: #999999;        /* Muted text */
--rank-neutral-200: #cccccc;        /* Body text */
--rank-neutral-100: #e5e5e5;        /* Soft white */
--rank-neutral-50: #f2f2f2;         /* Warm white */

/* UI State Colors */
--rank-disabled-bg: #2a2a2a;        /* Disabled button backgrounds */
--rank-disabled-text: #5c5c5c;      /* Disabled text */
--rank-disabled-border: #3d3d3d;    /* Disabled borders */

/* Gradients */
--rank-gradient-amber: linear-gradient(135deg, #FF8A2B 0%, #FFD873 100%);
--rank-gradient-gold: linear-gradient(135deg, #FFD873 0%, #FFA500 100%);
--rank-gradient-dark: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 60%, #2d2d2d 100%);

/* Interactive States */
--rank-focus-ring: #FFD873;         /* Focus outline color */
--rank-error: #FF4D2E;              /* Error states, validation */
--rank-success: #4CAF50;            /* Success states, confirmations */
--rank-warning: #FFA500;            /* Warning states, alerts */
--rank-info: #2196F3;               /* Info states, tooltips */

/* Glow & Lighting Effects */
--rank-glow-amber: rgba(255, 138, 43, 0.4);     /* XP bar shimmer */
--rank-glow-gold: rgba(255, 216, 115, 0.3);     /* Badge/coin glow */
--rank-glow-podium: rgba(218, 165, 32, 0.2);    /* Leaderboard podium */

/* Opacity Overlays */
--rank-overlay-dark: rgba(0, 0, 0, 0.7);        /* Modal overlays */
--rank-overlay-card: rgba(255, 255, 255, 0.05); /* Card hover overlay */
--rank-overlay-glass: rgba(255, 255, 255, 0.15); /* Glassmorphism effect */

/* Shadow System */
--rank-shadow-card: 0 8px 32px rgba(0, 0, 0, 0.3);
--rank-shadow-elevated: 0 12px 48px rgba(0, 0, 0, 0.4);
--rank-shadow-glow: 0 4px 30px rgba(255, 216, 115, 0.3);
```

**Typography System:**
```css
/* Font Families */
--font-headline: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'IBM Plex Mono', 'Courier New', monospace;

/* Headline Scale - Manrope Bold/ExtraBold */
--font-h1-size: 3.5rem;          /* 56px */
--font-h1-weight: 800;           /* ExtraBold */
--font-h1-line-height: 1.2;
--font-h1-letter-spacing: -0.5px;

--font-h2-size: 2.75rem;         /* 44px */
--font-h2-weight: 700;           /* Bold */
--font-h2-line-height: 1.3;
--font-h2-letter-spacing: -0.5px;

--font-h3-size: 1.75rem;         /* 28px */
--font-h3-weight: 700;           /* Bold */
--font-h3-line-height: 1.4;
--font-h3-letter-spacing: -0.3px;

--font-h4-size: 1.25rem;         /* 20px */
--font-h4-weight: 700;           /* Bold */
--font-h4-line-height: 1.5;
--font-h4-letter-spacing: 0;

/* Body Text Scale - Inter Regular/Medium */
--font-body-size: 1rem;          /* 16px */
--font-body-weight: 400;         /* Regular */
--font-body-line-height: 1.6;

--font-body-medium-size: 1rem;   /* 16px */
--font-body-medium-weight: 500;  /* Medium */
--font-body-medium-line-height: 1.6;

--font-small-size: 0.875rem;     /* 14px */
--font-small-weight: 400;        /* Regular */
--font-small-line-height: 1.5;

/* Stats/Mono Text - IBM Plex Mono Medium */
--font-mono-size: 1rem;          /* 16px */
--font-mono-weight: 500;         /* Medium */
--font-mono-line-height: 1.4;

/* UI Labels - Inter Medium */
--font-label-size: 0.875rem;     /* 14px */
--font-label-weight: 500;        /* Medium */
--font-label-line-height: 1.4;
--font-label-letter-spacing: 0.3px;
--font-label-transform: uppercase;

--font-label-small-size: 0.75rem; /* 12px */
--font-label-small-weight: 500;   /* Medium */
--font-label-small-line-height: 1.3;

/* Responsive Breakpoints */
@media (max-width: 768px) {
  --font-h1-size: 2.5rem;        /* 40px on mobile */
  --font-h2-size: 2rem;          /* 32px on mobile */
  --font-h3-size: 1.5rem;        /* 24px on mobile */
  --font-h4-size: 1.125rem;      /* 18px on mobile */
  --font-label-size: 0.75rem;    /* 12px on mobile */
  --font-mono-size: 0.875rem;    /* 14px on mobile */
}
```

**Typography Usage Hierarchy:**
| Element | Font | Usage | Responsive |
|---------|------|-------|------------|
| H1 | Manrope ExtraBold 56px | Hero headlines, page titles | 40px mobile |
| H2 | Manrope Bold 44px | Section headings, major divisions | 32px mobile |
| H3 | Manrope Bold 28px | Subsection headings, card titles | 24px mobile |
| H4 | Manrope Bold 20px | Widget headers, small headings | 18px mobile |
| Body | Inter Regular 16px | Paragraphs, descriptions | 16px all |
| Body Medium | Inter Medium 16px | Emphasized body text | 16px all |
| Small | Inter Regular 14px | Secondary text, metadata | 14px all |
| Mono | IBM Plex Mono Medium 16px | Stats, XP, rank scores, numbers | 14px mobile |
| Label | Inter Medium 14px | UI labels, buttons, tabs | 12px mobile |
| Label Small | Inter Medium 12px | Tiny labels, badges | 12px all |

**Spacing System:**
```css
/* Spacing Scale - 8px base unit */
--space-xxs: 0.25rem;   /* 4px - tight inline spacing */
--space-xs: 0.5rem;     /* 8px - minimal spacing, compact UI */
--space-sm: 0.75rem;    /* 12px - small gaps */
--space-md: 1rem;       /* 16px - default spacing between elements */
--space-lg: 1.5rem;     /* 24px - section spacing */
--space-xl: 2.5rem;     /* 40px - major section breaks */
--space-xxl: 4rem;      /* 64px - page-level spacing */
--space-xxxl: 6rem;     /* 96px - hero/feature spacing */

/* Container Widths */
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1200px;
--container-max: 1400px;

/* Grid System */
--grid-columns: 12;
--grid-gap: var(--space-lg);

/* Usage Notes */
/* Card padding: var(--space-lg) to var(--space-xl) */
/* Button padding: var(--space-sm) var(--space-md) */
/* Section margin: var(--space-xxl) 0 */
/* Inline gaps: var(--space-xs) to var(--space-sm) */
```

**Layout Guidelines:**
- 12-column grid, 1200-1400px max width
- Wide horizontal spacing, generous breathing room
- Never cluttered; prioritizes clarity

**Card Styling:**
- Background: #1A1A1A (Depth Black)
- Border radius: 8-12px
- Shadow: Diffused, subtle, wide spread
- Inner glow for importance (XP, rank, identity moments)

**Design Assets:**
- Typography spec: `attached_assets/rank_typography_spec_1763487319667.pdf`
- Color guide: `attached_assets/rank_color_style_guide_1763487319668.pdf`
- Homepage mockup: `attached_assets/rank-homepage-final_1763487319668.pdf`
- Design rules table: `attached_assets/Pasted-Link-to-PDF-Category-Subcategory-Rule-Notes-Example-Typography-Typography-Headlines-Use-Manrope-Bo-1763487195964_1763487195965.txt`

### Implementation Strategy

**Core Principle:** Centralized theming using CSS custom properties. All theme changes occur in ONE place (`src/styles/theme.css`). Components reference variables, never hardcoded values.

**Phases 1-3 will NOT modify:**
- Component structure or HTML markup
- Layout/grid systems
- Component logic or state management
- Feature functionality

**Phases 1-3 will ONLY update:**
- Color values (via CSS variables)
- Font families (via CSS variables)
- Typography scales and hierarchy
- Shared component styles (buttons, cards)

### Phase 1: Foundation ✅ = Complete | ⏳ = In Progress | ⬜ = Pending

**Status: ⬜ Not Started**

1. ⬜ Install Google Fonts (Manrope, Inter, IBM Plex Mono) in `index.html`
2. ⬜ Create `src/styles/theme.css` with CSS custom properties for all colors
3. ⬜ Create CSS custom properties for typography (font families, weights, sizes)
4. ⬜ Update `src/styles/global.css` to import theme.css and use variables for base styles
5. ⬜ Set body background to `var(--rank-bg-charcoal)`

**Deliverable:** Centralized theme system with all design tokens defined. No visual changes yet (components still reference old styles).

### Phase 2: Global Layout Components

**Status: ⬜ Not Started**

6. ⬜ Update `src/components/layout/Nav.css` to use theme variables (dark background, new colors)
7. ⬜ Update `src/components/layout/Header.css` to use theme variables
8. ⬜ Update `src/components/layout/Footer.css` to use theme variables
9. ⬜ Create shared card/button/shadow utility classes in `global.css` (8-12px radius, new shadows)

**Deliverable:** Navigation, header, and footer use new dark theme. Shared utility classes ready for components.

### Phase 3: Typography Application

**Status: ⬜ Not Started**

10. ⬜ Apply Manrope Bold/ExtraBold to all H1, H2, H3, H4 elements globally
11. ⬜ Apply Inter Regular/Medium to body, p, and paragraph text globally
12. ⬜ Apply IBM Plex Mono Medium to all stat displays (.stat-value, .xp-display, .rank-score, etc.)
13. ⬜ Update all label/UI text to Inter Medium 12-14px with #777777 color
14. ⬜ Test typography hierarchy across all pages (verify font loading, fallbacks work)

**Deliverable:** Entire app uses new typography system. Fonts load correctly across all pages.

### Phase 4: Component Theme Migration

**Status: ⬜ Not Started**

**Phase 4a: Audit & Remediation**
15. ⬜ Audit all component CSS files for hardcoded colors (grep for #, rgb, rgba values)
16. ⬜ Audit all component JSX files for inline styles (grep for `style={{`)
17. ⬜ Document all instances of tactical/hardcoded styles (create migration checklist)
18. ⬜ Create CSS variable mapping guide (old colors → new theme variables)

**Phase 4b: Component Migration**
19. ⬜ Update `src/components/coinbook/CoinBookWidget.css` to use theme variables
20. ⬜ Update achievement card styles to use theme variables
21. ⬜ Update leaderboard display styles to use theme variables
22. ⬜ Update profile page styles to use theme variables
23. ⬜ Update product card styles to use theme variables
24. ⬜ Update all page CSS files (`HomePage.css`, `RankPage.css`, etc.) to use theme variables
25. ⬜ Update all remaining component CSS files to reference theme variables
26. ⬜ Refactor all inline styles to use CSS classes with theme variables
27. ⬜ Add microinteraction styles (hover glows, shimmer effects) using new color palette
28. ⬜ Verify no hardcoded colors remain (re-run grep audit, should return zero results)

**Deliverable:** All existing components use new dark theme via centralized variables. Zero hardcoded colors or inline styles. App is fully themed without changing structure.

### Phase 5: Homepage Redesign

**Status: ⬜ Not Started**

22. ⬜ Create `UserProfileHero` component (username, XP, rank status, tenure badge)
23. ⬜ Create `TopFlavorsShowcase` component (visual showcase of top 3 flavors)
24. ⬜ Create `ActionCardGrid` component (Rank Flavors, Coin Book, Community cards)
25. ⬜ Create `NextUnlock` component (progress bar with XP remaining)
26. ⬜ Create `FeaturedDrop` component (exclusive content highlight)
27. ⬜ Integrate new components into `HomePage.jsx` (replace/merge with existing dashboard)
28. ⬜ Add XP bar shimmer, glow pulse, hover shine microinteractions
29. ⬜ Test homepage on desktop, tablet, mobile (responsive design)
30. ⬜ Verify all data sources (heroStats, homeStats) integrate correctly

**Deliverable:** Homepage matches mockup design with gaming-inspired layout and interactions.

### Progress Tracking

- **Phase 1 (Foundation):** 0/5 tasks complete
- **Phase 2 (Global Layout):** 0/4 tasks complete
- **Phase 3 (Typography):** 0/5 tasks complete
- **Phase 4 (Component Migration):** 0/14 tasks complete
  - Phase 4a (Audit): 0/4 tasks complete
  - Phase 4b (Migration): 0/10 tasks complete
- **Phase 5 (Homepage Redesign):** 0/9 tasks complete

**Total Progress:** 0/37 tasks (0%)

**Last Updated:** January 17, 2025

### Design Principles

**From Design Spec:**
- **Glow sparingly:** Only for XP, rank, identity moments. Glow = prestige.
- **No ecommerce styling:** Avoid product tiles, marketing fluff, long descriptions.
- **Game vocabulary:** Rank, XP, Discover, Unlock, Top Flavors (not retail verbs).
- **Mature & premium:** Smooth easing curves, no excessive bounce or cartoon motion.
- **Status & mastery:** User feels progression, identity, belonging through design.

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
- **Error Monitoring**: Comprehensive Sentry instrumentation with intelligent filtering and automatic context enrichment. Smart error classification system (`server/config/sentryFilters.js`) filters benign infrastructure noise (Redis EPIPE during reconnections, Neon database connection recycling), preserves critical database/API/webhook failures at error level, and only downgrades explicitly recovered errors to info level. Context enrichment adds actionable tags (`user_impact`, `has_retry`, `has_recovery`, `is_infrastructure`, `is_business_logic`) to every error. Zero per-request database overhead - user identity (id/email/username/role) fetched lazily via beforeSend hook only when errors occur. Frontend filtering suppresses network noise and ResizeObserver loops. Helper utilities in `server/utils/sentryContext.js` enable consistent error reporting with context across the codebase.
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
- **Product Detail Page**: Modern Apple-inspired redesign with hero section showcasing product image and metadata, stat cards displaying user rank (if ranked), community average, and total rankings, ranking distribution chart visualizing community preferences, and conditional CTAs ("Rank It" for purchased/unranked, "Try It Again" for purchased/ranked, "Discover Your New Favorite" for unpurchased). Enhanced backend endpoint `/api/products/:id/detail` returns user context, purchase status, and ranking distribution without requiring Shopify credentials (uses cached data).
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