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
- **Unified Product Cards**: Consistent styling.
- **Loading States**: Skeleton screens and loading indicators.
- **Error Handling**: User-friendly error messages.
- **Admin Tools Styling**: Earth-tone styling with horizontal tab navigation.
- **Collection Progress Bar**: Tier-based colors, animated gradient, percentage display.
- **Toast Notifications**: Sequential queue-based display.
- **Tier Emoji System**: Centralized JSON-based emoji constants.
- **Flavor Community Badges**: Visual identity system displaying user's primary flavor profile (Sweet, Savory, Spicy, Exotic, Teriyaki, Peppered, Original, Smoky, BBQ, Hot) with unique colors, gradients, emojis, and community states (Enthusiast, Explorer, Taster, Seeker, Curious) on community cards for "jerky tribe" discovery.
- **Journey Film Reel Feature**: Apple-style storytelling for public profile pages, celebrating users' flavor discovery journey from first purchase to present with horizontal scrolling film strip, product images, and narrative moments. Header card as first frame, proper achievement icon rendering using `renderAchievementIcon` utility, and product images for purchase milestones. Celebratory purchase headlines with flavor + animal callouts: "FIRST BITE - [flavor] [animal]" (first purchase), "FLAVOR DROP - [flavor] [animal]" (middle purchases), "LATEST HAUL - [flavor] [animal]" (most recent), with graceful fallback for legacy products.
- **Journey → Achievements Transition**: Storytelling-driven section transition with generous vertical breathing room (120px bottom padding on Journey, 100px top margin on Achievements) creating a "chapter break" effect that separates nostalgic memoir from trophy showcase. Staggered sequential reveal animation for Achievements: heading (0.5s) → intro text (0.7s) → Coin Book widget (0.9s), with intentional pacing that feels like "opening a trophy case after closing a memoir."

**Technical Implementations:**
- **Frontend**: React 19, React Router v7, TanStack Query, Zustand, Vite, Socket.IO Client.
- **Backend**: Node.js and Express.js, employing a repository pattern.
- **Data Layer**: Centralized API client with httpOnly cookie-based session management, React Query hooks, and WebSocket integration.
- **Real-time Communication**: Socket.IO for achievement notifications with multi-device support.
- **Session Security**: Production-grade authentication using httpOnly cookies, 90-day server-side sessions.
- **Rate Limiting**: Authentication endpoints are rate-limited using Redis.
- **Icon Rendering**: Unified utility (`src/utils/iconUtils.jsx`) for various icon types (emoji, URL, base64).
- **Code Splitting**: Route-based lazy loading using React.lazy() and Suspense, with manual vendor chunking.
- **Scroll Animations**: React state-driven IntersectionObserver pattern for section visibility animations. CSS classes (`section-visible`) are managed declaratively through React state (`useState` with Set) rather than imperative DOM manipulation (`classList.add`), ensuring animations persist through React Query refetches and client-side navigation. Each observed section updates state via callback, and manual viewport checks handle already-visible sections on mount. Applied to: PublicProfilePage (journey/achievements/rankings sections) and CommunityPage (journey/pulse/discover sections).
- **Shopify Synchronization**: Automatic sync of products, metadata, and customer profiles via webhooks with caching and orphan cleanup. Async BullMQ-based webhook processing and auto-user creation from Shopify customer webhooks.
- **Gamification**: Dual-manager pattern (`EngagementManager` and `CollectionManager`) with an event-driven system for achievements, streaks, leaderboards, and notifications.
- **Personalized Guidance System**: AI-driven, page-aware, and journey-aware system with an event-driven classification engine (BullMQ-based) that analyzes user behavior to provide targeted messages with CTAs.
- **Flavor Profile Communities**: Micro-community system tracking user journey states and admin-configurable thresholds.
- **User Classification System**: Tracks journey stages, engagement levels, and exploration breadth.
- **Unified Activity Tracking**: All user activities tracked in `user_activities` table, with dual-track search analytics for authenticated and anonymous searches.
- **Leaderboard Performance Optimization**: Achieved 345,000x speedup through pre-aggregated `user_engagement_scores` rollup table, incremental score updates, Redis-backed distributed cache, granular cache invalidation, and optimized queries.
- **Ranking Race Condition Fix**: Implemented sequence-based staleness detection.
- **Distributed Caching Architecture**: Comprehensive Redis-backed caching system for multi-instance scalability achieving sub-100ms response times with 95% query reduction, using seven specialized cache classes with event-driven invalidation.
- **Database Connection**: Multi-pool architecture using Neon PostgreSQL with dedicated pools for webhooks and general use, TCP keepalive, and automatic retry logic.
- **Redis Connection**: Singleton-based connection pooling with hardened configuration for BullMQ workers and Upstash Redis.
- **Feature Flags**: JSON-based configuration system.
- **Database Schema Management**: Drizzle ORM for schema management with automatic validation on server startup, retry logic, and safe deployment scripts (`npm run start:safe`, `npm run deploy:safe`).

**Feature Specifications:**
- **Ranking**: Persistent rankings with visual modal, duplicate prevention, optimistic UI.
- **Flavors Page**: Advanced sorting, filtering, client-side instant search, and server-side pagination.
- **Product Detail Page**: Comprehensive product information including images, brand, flavors, pricing, ranking statistics, and tags.
- **Flavor Profile Pages**: Dynamic pages for each flavor type.
- **Purchase History**: Automatic background synchronization of Shopify orders.
- **Community**: User discovery, search, profiles with ranking stats, top rankers widget, privacy-aware display, avatar support. Narrative-driven UserCard component with journey-stage tier colors, smart progress bars, and flavor community badges.
- **Leaderboard**: Top 50 rankers with engagement scores and badges.
- **User Profile**: Private dashboard with handle management, privacy controls, and professional profile picture upload system. Public profile pages with privacy-aware display.
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

## Coding Patterns & Best Practices

### IntersectionObserver + React: State-Driven Approach

**Problem:** Using imperative DOM manipulation (`classList.add`) to add CSS classes for scroll animations breaks when React re-renders, causing sections to become invisible during client-side navigation or React Query refetches.

**Solution:** Use React state to manage visibility classes declaratively.

#### ❌ WRONG - Imperative DOM Manipulation
```javascript
// DON'T DO THIS - React re-renders wipe out manually added classes
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('section-visible'); // ❌ Breaks on re-render
      }
    });
  });
  observer.observe(ref.current);
}, []);
```

#### ✅ CORRECT - React State-Driven
```javascript
// DO THIS - React manages className declaratively
const [visibleSections, setVisibleSections] = useState(new Set());

useEffect(() => {
  const markSectionVisible = (name) => {
    setVisibleSections(prev => new Set([...prev, name]));
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (entry.target === journeyRef.current) {
          markSectionVisible('journey'); // ✅ Updates React state
        }
      }
    });
  });

  // Manual check for already-visible sections
  const isElementVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.top < windowHeight && rect.bottom > 0;
  };

  if (journeyRef.current) {
    if (isElementVisible(journeyRef.current)) {
      markSectionVisible('journey');
    }
    observer.observe(journeyRef.current);
  }

  return () => observer.disconnect();
}, []);

// Render with state-driven className
<section 
  className={`section-journey ${visibleSections.has('journey') ? 'section-visible' : ''}`}
  ref={journeyRef}
>
```

#### Key Principles
1. **Never mix imperative DOM manipulation with React** - Let React control the DOM declaratively
2. **Manual viewport checks are required** - IntersectionObserver callbacks don't fire for elements already in viewport when first observed
3. **Reset visibility state on navigation** - Use separate useEffect with `[userId]` dependency (for profile pages) to reset state only when changing profiles, not on data refetches
4. **State persists through re-renders** - React Query refetches won't clear visibility state when managed properly

#### Applied To
- `PublicProfilePage.jsx` - Journey, Achievements, Rankings sections
- `CommunityPage.jsx` - Journey, Pulse, Discover sections

**When adding new scroll animations:** Always use this state-driven pattern instead of imperative classList manipulation.