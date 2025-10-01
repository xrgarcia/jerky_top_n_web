# Jerky Top N Web Application

## Project Overview
A web application for ranking jerky products, inspired by jerky.com's design. This application allows users to view top-rated jerky products and create their own personal rankings through an interactive drag-and-drop interface.

## Features
- View top N jerky products (3, 5, or 8 items)
- Interactive ranking system with drag-and-drop functionality
- Community page to discover fellow jerky enthusiasts
- Search users by name or products they've ranked
- Clean, professional design inspired by jerky.com
- Responsive layout for desktop and mobile
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