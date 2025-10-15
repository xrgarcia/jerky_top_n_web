# Jerky Top N Web Application

## Overview
A web application for ranking jerky products, inspired by jerky.com's design. This application allows users to view top-rated jerky products and create their own personal rankings through an interactive drag-and-drop or dropdown interface. The project aims to provide a comprehensive and engaging platform for jerky enthusiasts, featuring advanced product filtering, gamification, and real-time social interaction capabilities.

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## System Architecture
The application features a modern web architecture designed for responsiveness, scalability, and real-time interaction.

### UI/UX Decisions
- **Design Inspiration**: Clean, professional design aesthetic inspired by jerky.com, utilizing a blue/purple color scheme.
- **Responsiveness**: Fully responsive layout optimized for desktop, tablet, and mobile devices.
- **Interactive Ranking**: Dual ranking system supporting drag-and-drop for desktop and dropdown selection for mobile.
- **Visual Cues**: Product images in ranking modals, visual badges for flavor profiles and average rankings, and animated sorting icons.
- **Navigation**: SPA with hash routing, preserving state on page refresh, and deep-linking support for products and user profiles.

### Technical Implementations
- **Frontend**: Built with Vanilla JavaScript and an event-driven architecture utilizing an `EventBus` for pub/sub communication and `ServiceRegistry` for dependency injection. Key domain services include Gamification, Social Proof, Activity Feed, Progress Tracking, and Leaderboard, supported by reusable UI components for notifications and widgets.
- **Backend**: Implemented with Node.js and Express.js, following a repository pattern for data access. Domain services like `AchievementManager`, `LeaderboardManager`, `ProgressTracker`, `StreakManager`, and `CommunityService` handle core business logic.
- **User Privacy**: Centralized `CommunityService` handles all user data formatting with last name truncation (e.g., "John D." instead of "John Doe") for privacy across all features including top rankers, community pages, leaderboards, and search results.
- **Real-time Communication**: Powered by Socket.IO for real-time bidirectional communication, enabling live updates for achievements, streaks, and notifications.
- **Product Management**: A centralized `ProductsService` combines product data from external sources with metadata and ranking statistics. Advanced filtering includes animal categories (15 unique types with icons and counts) and flavor profiles (8 distinct types with visual badges and searchability).
- **Gamification**: An event-driven system tracks 18 achievements (including dynamic "Complete Collection" for ranking all available products), user progress with dynamic milestone tracking based on actual achievement definitions, streaks, and populates real-time leaderboards and activity feeds. The milestone system automatically adapts to product catalog changes. Streak tracking runs asynchronously during ranking saves to credit users for consecutive daily ranking activity without slowing down API responses.
- **Streak Tracking**: Calendar-day-based streak calculation (UTC normalized) ensures consistent streak detection across timezones. Daily ranking streaks update automatically when users rank products, with real-time WebSocket notifications for streak continuations and breaks.
- **Search**: Global unified search with type-ahead functionality, searching both products and community members. Client-side instant search for products with multi-word support.
- **Styling**: Custom CSS for a consistent look and feel.

### Feature Specifications
- **Ranking**: View top N jerky products (3, 5, or 8), persistent rankings with database storage, and a visual ranking modal with product images.
- **Products Page**: Advanced sorting (Name, Recently Ranked, Avg Ranking, Total Rankings), animal and flavor filtering, and client-side instant search.
- **Community**: Discover users, search by name or ranked products, and view user profiles with ranking statistics.
- **User Profile**: Displays user information, ranking statistics, and links to update external profiles.
- **Gamification**: Achievement tracking, user progress monitoring, streak tracking, real-time leaderboards, live activity feeds, and real-time notifications.
- **Admin Tools**: Role-based access for @jerky.com employees with dedicated Tools section featuring:
  - **Manage Achievements**: View all achievements with tier, category, requirements, points, and earning statistics in a sortable table
  - **Live Users**: Real-time monitoring of active users on the site, showing current page, connection time, and activity. Features WebSocket-based live updates with employee-only access and privacy-preserving data sanitization (last name truncation, email redaction for non-employees)

## External Dependencies
- **Database**: PostgreSQL with Drizzle ORM for all data persistence.
- **Error Tracking**: Sentry.io for error monitoring and performance tracking, integrated into services with detailed context.
- **Real-time**: Socket.IO for WebSocket communication.