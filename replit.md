# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, inspired by jerky.com's design. This application allows users to view top-rated jerky products and create personal rankings through an interactive interface. The project aims to provide a comprehensive and engaging platform for jerky enthusiasts, featuring advanced product filtering, gamification, and real-time social interaction capabilities. The business vision is to create a leading platform for jerky enthusiasts, leveraging gamification and social features to drive engagement and establish a vibrant community around jerky tasting and ranking.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## System Architecture
The application features a modern web architecture designed for responsiveness, scalability, and real-time interaction.

### UI/UX Decisions
- **Design Inspiration**: Clean, professional aesthetic inspired by jerky.com, utilizing an earth tone color palette (parchment, sage green, wood brown, muted gold).
- **Responsiveness**: Fully responsive layout optimized for desktop, tablet, and mobile devices.
- **Hero Gamification Dashboard**: Transformed hero section into a live engagement dashboard with stats counters, social proof, user progress bar, and dual CTAs with real-time updates via WebSockets. Displays only on the homepage.
- **Minimal Page Headers**: Content pages use compact headers (~150-200px) with breadcrumbs, title, subtitle, and page-specific action buttons, providing a content-focused experience.
- **Unified Product Cards**: Consistent card styling across Products and Rank pages for visual consistency.
- **Home Page Dashboard**: Dynamic Bento Box layout with engaging micro-copy and interactive CTAs within widgets.
- **Interactive Ranking**: Dual ranking system supporting drag-and-drop for desktop and dropdown selection for mobile with visual cues, badges, and animated sorting icons.
- **Navigation**: Single Page Application (SPA) with hash routing, preserving state and supporting deep-linking. Features a dropdown menu under Community for quick access. All pages automatically refresh their data when navigated to, ensuring users always see current information without requiring manual page reloads.

### Technical Implementations
- **Frontend**: Built with Vanilla JavaScript, an event-driven architecture using `EventBus` for pub/sub, and `ServiceRegistry` for dependency injection.
- **Backend**: Implemented with Node.js and Express.js, following a repository pattern.
- **User Privacy**: `CommunityService` centralizes user data handling, truncating last names.
- **Real-time Communication**: Socket.IO facilitates real-time bidirectional communication.
- **Session Persistence**: Dual-layer authentication using httpOnly cookies and localStorage sessionId.
- **Product Management**: `ProductsService` combines external product data with metadata and ranking statistics, including advanced filtering.
- **Gamification Architecture**: Dual-manager pattern for achievement processing:
  - **EngagementManager**: Calculates and awards engagement-based achievements (searches, page views, streaks, logins) with tiered progression (bronze→silver→gold→platinum→diamond). Supports unique view tracking for products and profiles.
  - **CollectionManager**: Handles product-based achievements (static collections, dynamic collections, flavor coins) with tier progression.
  - **ProgressTracker**: Calculates comprehensive progress across all achievement types, finding the closest unearned achievement by percentage complete. Supports both collection format (`totalRanked/totalAvailable`) and engagement format (`current/required`) for unified progress tracking.
  - Event-driven system tracks achievements, user progress, streaks, and populates real-time leaderboards and activity feeds.
  - Proportional point system awards points dynamically for tiered achievements across both managers.
  - Toast notifications emitted via WebSocket for all achievement types with duplicate prevention.
- **Page View Tracking**: Asynchronous tracking for all pages with data stored in a dedicated `page_views` table, including `pageType` and `pageIdentifier` for detailed analytics.
- **Timestamp Handling**: All database timestamps converted to ISO 8601 UTC on the server, with client-side relative time calculation.
- **Top Rankers**: Calculated by an engagement score (achievements + page views + rankings + searches).
- **Most Debated Products**: Identifies products with the highest ranking variance using PostgreSQL STDDEV.
- **Streak Tracking**: Calendar-day-based streak calculation with multi-layer validation.
- **Performance Optimizations**: Extensive use of OOP design patterns, caching strategies, and query optimization.
- **Search**: Global unified search with type-ahead for products and community members, including client-side instant search.
- **Styling**: Custom CSS with earth tone color palette.
- **Database Connection Strategy**: Dual-connection architecture using Neon PostgreSQL, with pooled connections for most queries and dedicated primary-only connections for critical-path queries.

### Feature Specifications
- **Ranking**: View top N jerky products, persistent rankings, visual ranking modal with duplicate prevention and optimistic UI.
- **Products Page**: Advanced sorting, animal and flavor filtering, client-side instant search, and server-side pagination.
- **Rank Page Products**: Server-side filtering to exclude already-ranked products before pagination.
- **Community**: Discover users, search, view profiles with ranking statistics, and display top rankers widget.
- **Leaderboard**: Dedicated page showing top 50 rankers with engagement scores, badges, and user position highlighting.
- **User Profile**: Displays user information and ranking statistics.
- **Gamification**: Achievement tracking with four collection types:
  - **Engagement Collections**: User site engagement (searches, logins, ranking streaks, ranking activity, product views, profile views).
  - **Static Collections**: Pre-defined product lists.
  - **Dynamic Collections**: Protein-category-based with tier progression.
  - **Flavor Coins**: Single product achievements with optional tier progression.
  - User progress tracking, streak tracking, real-time leaderboards, activity feeds, and notifications.
- **Admin Tools**: Role-based access for managing achievements and monitoring live users with real-time updates, including custom icon upload functionality.

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM.
- **Error Tracking**: Sentry.io.
- **Real-time**: Socket.IO.
- **Email**: Custom SMTP service using nodemailer with Google Workspace.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for custom achievement icon uploads.