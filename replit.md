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