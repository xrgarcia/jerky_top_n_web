# Jerky Top N Web Application

## Project Overview
A web application for ranking jerky products, inspired by jerky.com's design. This application allows users to view top-rated jerky products and create their own personal rankings through an interactive drag-and-drop interface.

## Features
- View top N jerky products (3, 5, or 8 items)
- Dual ranking system: drag-and-drop OR dropdown selection (mobile-friendly)
- Community page to discover fellow jerky enthusiasts
- Search users by name or products they've ranked
- Profile page to view user information and ranking statistics
- Link to update profile on jerky.com
- Clean, professional design inspired by jerky.com
- Fully responsive layout optimized for desktop, tablet, and mobile
- Persistent rankings with database storage

## Architecture
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Backend**: Node.js with Express.js
- **Styling**: Custom CSS with jerky.com-inspired theme
- **Data**: In-memory sample jerky data (to be replaced with database in future phase)

## User Preferences
- Clean, professional design aesthetic
- Focus on user interaction and ranking functionality
- Responsive design for all devices

## Recent Changes
- 2025-10-10: **Sentry.io integration** - Added Sentry error monitoring and performance tracking for the Express.js application; automatically captures uncaught exceptions, unhandled promise rejections, and API errors
- 2025-10-10: **Hidden hero image on login page** - Removed the hero banner image from the login page to prevent users from needing to scroll down to access the login form; hero remains visible on all other pages
- 2025-10-10: **Visual ranking modal with product images** - Added product images to ranking modal for better visual context; modal header shows the product being ranked with its image; each position displays the current product's image and name; improved UX with visual product identification
- 2025-10-10: **Replace & Insert modal UI** - Replaced dropdown ranking with full-screen modal featuring two distinct actions: Replace (yellow button, swaps product without pushing) and Insert (green button, pushes items down); each position shows status badge and current product details
- 2025-10-05: **Full page refresh preservation** - Implemented dual routing strategy (hash + sessionStorage) to preserve current page on browser refresh; users can now refresh on any page (products, community, rank, profile) and stay on that page instead of being redirected to home
- 2025-10-05: **Fixed data loading on initial page access** - Added loadRankPageData() function to ensure rankings and products load when rank page is accessed directly via URL or browser navigation; all pages now load their data on first access
- 2025-10-02: **Natural page scrolling on mobile ranking page** - Eliminated nested scrollbars; entire page now scrolls naturally allowing users to see multiple product cards at once; Search Products header becomes sticky at top when scrolling; panels stack vertically with auto height on mobile devices
- 2025-10-02: **Mobile UX optimizations for ranking page** - Disabled drag-and-drop on mobile (uses dropdown only); made "Your Rankings" collapsible and collapsed by default; increased search products panel space to show multiple cards at once; viewport-aware resize handling ensures correct behavior across device orientations
- 2025-10-02: **Dropdown ranking system for mobile** - Added dropdown selector on product cards as mobile-friendly alternative to drag-and-drop; users can select any rank position from dropdown; both methods work together seamlessly with full feature parity
- 2025-10-02: **Mobile responsive fixes** - Fixed panel header height constraints using !important declarations; headers now properly expand to show all controls (title, buttons, search) on mobile devices
- 2025-10-01: **Routable login page replaces popup** - Converted popup login window to clean SPA page at #login with email-based magic link authentication; removed all popup dependencies
- 2025-10-01: **Production deployment fixes** - Added robust error handling and environment detection (APP_DOMAIN works in both dev/production); server starts gracefully even with missing credentials
- 2025-10-01: **Global unified search with type-ahead** - Redesigned search bar matches jerky.com styling; searches both products and community members in real-time with dropdown results that link to product/user pages
- 2025-10-01: **Product cards in user profiles now link to product details** - Clicking any product in a user's ranking list navigates to the full product detail page with statistics
- 2025-10-01: **User profile pages from community** - Clickable community members navigate to routable readonly profile pages (#user/{id}) showing first name & last initial with complete product rankings
- 2025-10-01: **Product detail pages converted to full routable pages** - Replaced modal with full-page layout, hash routing (#product/{id}), dedicated back button that always returns to products page, proper deep-linking support
- 2025-10-01: **Profile page implemented** - Displays user information, ranking statistics, and link to update profile on jerky.com; clickable user name in navigation
- 2025-10-01: **Community page launched** - Added people service with user discovery, search by name or ranked products, optimized with PostgreSQL trigram indexes
- 2025-09-30: **Product search analytics** - Added user_product_searches table tracking search term, result count, page name, and user ID
- 2025-09-30: **Prevented duplicate rankings** - Already-ranked products no longer appear in rank page search results
- 2025-09-30: **Removed dropdown from products search** - Search now filters grid directly without showing dropdown suggestions
- 2025-09-30: **Converted products page to SPA** - Eliminated white flash by integrating products into SPA with instant hash navigation (#products)
- 2025-09-30: Improved products page UX - removed dropdown, added infinite scroll with 30-product pagination
- 2025-09-30: Verified 30-minute cache system working correctly (cache-first with Shopify API fallback)
- 2025-09-30: Fixed ranking count bug in products page API endpoint (was using undefined storage.db, now imports db directly)
- 2025-09-30: Created products page with grid layout, search functionality, and ranking count badges
- 2025-09-30: Implemented intelligent multi-word search that matches products regardless of word order
- 2025-09-30: Fixed database persistence for clear all operations
- 2025-09-30: Replaced browser confirm dialogs with custom modal for clear all operations
- 2025-09-28: Initial project setup from empty GitHub repository
- 2025-09-28: Implemented jerky.com-inspired theme with blue/purple color scheme
- 2025-09-28: Added interactive ranking functionality with drag-and-drop
- 2025-09-28: Configured for Replit environment with proper host settings
- 2025-09-28: Set up deployment configuration for production

## Technical Setup
- Port: 5000 (frontend)
- Host: 0.0.0.0 (configured for Replit proxy)
- Cache disabled for development
- Workflow configured for automatic startup

## Future Phases
- Database integration for products table
- User authentication
- Advanced ranking algorithms
- Additional product categories