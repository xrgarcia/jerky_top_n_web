# Rank a Product - Requirements Document

## Overview
The Rank Products feature allows authenticated users to create and manage personalized rankings of products they've purchased. This document captures all requirements extracted from the legacy implementation.

---

## Frontend Components

### 1. RankPage (Main Page Component)
**File:** `src/pages/RankPage.jsx`

#### State Management
- Track navigation state during pending saves (`isNavigating`, `navigationTarget`)
- Manage rankings list with automatic synchronization
- Track save status and messages
- Compute ranked product IDs from current rankings

#### Core Functionality
- **Load Rankings on Mount**: Fetch user's existing rankings when page loads
- **Navigation Blocking**: Prevent navigation when unsaved changes exist
  - Block browser navigation (back/forward)
  - Block route changes via React Router
  - Show modal overlay during save operations
- **Browser Unload Protection**: Warn users before closing tab with unsaved changes
- **Auto-save Integration**: Wait for pending saves before allowing navigation
- **Add Product to Rankings**: Add product to next available rank position
- **Navigate to Products Page**: Allow browsing full product catalog

#### UI Elements
- Breadcrumb navigation (Home > Rank Products)
- "Browse All Products" button
- Navigation guard modal with spinner and save status
- Three-panel layout:
  - Progress widget (top)
  - Rankings panel (left)
  - Search products panel (right)

---

### 2. RankingsPanel Component
**File:** `src/components/rank/RankingsPanel.jsx`

#### State Management
- Dynamic slot count (starts at 10, expands as needed)
- Drag state tracking (`draggedItem`, `dragOverSlot`)
- Auto-expand slots when nearing capacity (+5 slots when within 2 of limit)

#### Core Functionality
- **Drag and Drop Reordering**
  - Drag products from search panel into specific rank positions
  - Reorder existing rankings by dragging between slots
  - Push down existing items when inserting at occupied position
  - Validate against duplicate products in rankings
- **Remove Product**: Remove individual product and renumber remaining rankings
- **Clear All Rankings**: Confirmation dialog before clearing all (with API call)
- **Save Status Display**: Show real-time save indicators (saving/saved/error)
- **Progress Tracking**: Visual progress bar showing filled vs total slots

#### Slot Behavior
- Each slot displays rank number
- Filled slots show:
  - Product thumbnail image
  - Product title and vendor
  - Remove button (×)
  - Draggable handle
- Empty slots show placeholder text

#### Visual Feedback
- Highlight drag-over target slot
- Show save spinner during network operations
- Display save message (✓ Saved, Saving..., Error)

---

### 3. SearchProductsPanel Component
**File:** `src/components/rank/SearchProductsPanel.jsx`

#### Core Functionality
- **Product Search**: Real-time search with 300ms debounce
  - Search by name, animal type, flavor
  - Clear search to see all available products
- **Pagination**: Load more products on demand
  - Show "X of Y loaded" counter
  - "Load More Products" button
  - Disable button during loading
- **Drag to Rank**: Drag products from panel to ranking slots
- **Click to Rank**: Quick-add button on each product card

#### UI Elements
- Search input with icon
- Available count display
- Product grid with cards showing:
  - Product image
  - Product title
  - Vendor name
  - Metadata tags (animal, flavor)
  - "Rank This Product" button
- Loading states:
  - Initial load spinner
  - "Load More" spinner
- Empty states:
  - No search results
  - All products ranked

---

### 4. ProgressWidget Component
**File:** `src/components/rank/ProgressWidget.jsx`

#### State Management
- Collapsible state (stored in sessionStorage per page)
- Progress data fetching via React Query
- Auto-refresh every 60 seconds

#### Core Functionality
- **Display User Statistics**
  - Total products ranked (🎯)
  - Current ranking streak (🔥)
  - Most recent achievement icon
- **Next Milestone Tracking**
  - Show upcoming achievement
  - Display mysterious description hint
  - Progress bar with percentage
- **Achievement Grid**
  - Show all achievements (earned and locked)
  - Earned: Full name + tier emoji
  - Locked: Display as "???" with progress hints
  - Click to navigate to Coin Book detail page
- **Expand/Collapse Toggle**: Minimize to save screen space

#### Achievement Progress Hints
- `rank_count`: "Progress: X/Y"
- `streak_days`: "Current streak: X/Y days"
- `unique_brands`: "Brands explored: X/Y"
- `leaderboard_position`: "Rank higher to unlock..."
- `profile_views`: "Views: X/Y"
- `trendsetter`: "Rank trending products..."
- `rank_all_products`: "Products ranked: X/Y"

#### Display Logic
- Hide widget if user has 0 rankings AND 0 achievements
- Show tier emojis: 🥉 Bronze, 🥈 Silver, 🥇 Gold
- Support custom achievement icons (images or emoji)
- Display earned dates on hover

---

## Custom Hooks

### 5. useRankings Hook
**File:** `src/hooks/useRankings.js`

#### State Management
- Rankings array
- Save status (idle/saving/saved/error)
- Save message
- Last saved product IDs (Set for comparison)
- Pending debounce flag

#### Core Functionality
- **Load Rankings**: Fetch from `/api/rankings/products?rankingListId=default`
- **Update Rankings**: Trigger auto-save with 800ms debounce
- **Clear All Rankings**: DELETE request to clear endpoint
- **Auto-save System**:
  - Debounce changes (800ms delay)
  - Queue operations in persistent IndexedDB
  - Retry failed saves with exponential backoff (3 attempts max)
  - Snapshot pending changes during active network saves
  - Process snapshot after current save completes
- **Navigation Guards**:
  - Track pending saves (debounce + queue + snapshots)
  - Wait for all pending operations before navigation
  - Flush debounce timeout on demand

#### RankingSaveQueue Class
- **Persistent Queue Integration**: Uses IndexedDB-backed queue
- **Process Pending Operations**: Retry operations from previous session on init
- **Enqueue**: Add save operation to queue
- **Process Queue**: Execute operations sequentially
- **Execute Operation**: POST to `/api/rankings/products` with:
  - Idempotency key header
  - Rankings payload
  - Session authentication via cookie
- **Retry Logic**: Exponential backoff (2^n seconds, max 3 attempts)
- **Cache Invalidation**: Invalidate rankings, progress, achievements caches
- **Status Callbacks**: Update UI save status
- **Queue Drainage Detection**: Call callback when queue empties

---

### 6. useRankableProducts Hook
**File:** `src/hooks/useRankableProducts.js`

#### State Management
- Products list (paginated)
- Filtered products (after search)
- Search term with debounced updates
- Loading states (initial and load-more)
- Pagination state (current page, hasMore, total count)
- Available count

#### Core Functionality
- **Load Products**: GET `/api/products/rankable` with query params:
  - `query`: Search term
  - `page`: Current page number
  - `limit`: 20 products per page
  - `sort`: 'name-asc'
- **Search with Debounce**: 300ms delay before triggering new search
- **Pagination**: Load additional pages without resetting list
- **Reload Products**: Reset to page 1 with fresh data
- **Authentication Check**: Skip loading if not authenticated

#### Product Filtering (Server-side)
- Exclude already-ranked products (by ID)
- For non-employee users: Only show purchased products
- For employee users: Show all products

---

### 7. useProgress Hook
**File:** `src/hooks/useProgress.js`

#### Core Functionality
- **Fetch Progress Data**: GET `/api/gamification/progress`
- **Cache Strategy**: 30s stale time, 60s refetch interval
- **Helper: getNextMilestone**: Extract first upcoming milestone
- **Helper: getMysteriousDescription**: Return cryptic hint for achievement

#### Mysterious Descriptions Map
- first_rank: "Every legend begins with a single choice..."
- rank_10: "The path reveals itself to those who persist..."
- rank_25: "Power grows with dedication. Keep going..."
- rank_50: "You're halfway to something extraordinary..."
- complete_collection: "The ultimate completionist. Rank them all..."
- streak_3: "The flame ignites. Feed it daily..."
- streak_7: "Seven suns have witnessed your devotion..."
- streak_30: "The calendar bends to your will. Don't break..."
- And more...

---

## Utilities

### 8. PersistentQueue Class
**File:** `src/utils/PersistentQueue.js`

#### Core Functionality
- **IndexedDB Storage**: Survive page refreshes, network failures, browser crashes
- **Database Structure**:
  - Database: 'RankingQueue'
  - Store: 'pending_operations'
  - Key: operationId
  - Indexes: timestamp, status

#### Operations
- **init()**: Initialize IndexedDB connection, create schema on first run
- **enqueue(operation)**: Add operation with pending status
  - Auto-assign timestamp and retryCount
- **getPending()**: Retrieve all pending operations sorted by timestamp
- **markComplete(operationId)**: Delete operation from queue (alias: complete)
- **updateOperation(operationId, updates)**: Update retry count and metadata
- **markFailed(operationId, error)**: Mark as failed with error details
- **getPendingCount()**: Count pending operations
- **clearAll()**: Remove all operations from queue

#### Operation Schema
```javascript
{
  operationId: string,      // Unique identifier
  rankings: array,          // Full rankings payload
  idempotencyKey: string,   // For server-side deduplication
  timestamp: number,        // Enqueue time
  status: 'pending',        // Operation status
  retryCount: number,       // Attempt counter
  lastAttempt: number|null, // Last attempt timestamp
  lastError: string|null    // Error from last failure
}
```

---

## Server-Side APIs

### 9. Ranking Endpoints
**File:** `server.js`

#### POST /api/rankings/products (Bulk Save)
**Purpose**: Save all user rankings atomically

**Authentication**: Session cookie (httpOnly)

**Request Body**:
```javascript
{
  rankingListId: 'default',  // List identifier
  rankings: [
    {
      ranking: 1,
      productData: {
        id: '123456789',
        title: 'Product Name',
        vendor: 'Brand',
        image: 'https://...',
        // ... other product fields
      }
    }
  ]
}
```

**Validation**:
- Check for duplicate product IDs in payload
- Return 400 error with duplicate list if found

**Database Operation**:
- Call `storage.bulkUpsertProductRankings()`
- Atomic transaction: upsert new rankings + delete removed ones
- Differential delete: Only remove products NOT in payload

**Cache Invalidation**:
- Ranking stats cache
- Leaderboard position cache
- Home stats cache
- Leaderboard cache

**Async Gamification Processing** (non-blocking):
- Update daily ranking streak
- Broadcast streak updates via WebSocket
- Calculate user stats and position
- Award flavor coins for newly ranked products
- Check and award achievements
- Emit achievements via WebSocket
- Log errors to Sentry without failing request

**Response**:
```javascript
{ success: true, message: 'Saved X rankings' }
```

---

#### GET /api/rankings/products
**Purpose**: Retrieve user's current rankings

**Authentication**: Session cookie (httpOnly)

**Query Params**:
- `rankingListId`: default = 'default'

**Response**:
```javascript
{
  rankings: [
    {
      id: 1,
      userId: 123,
      shopifyProductId: '987654321',
      ranking: 1,
      productData: { /* full product object */ },
      createdAt: '2025-11-01T...',
      updatedAt: '2025-11-01T...',
      rankingListId: 'default'
    }
  ]
}
```

---

#### DELETE /api/rankings/products/clear
**Purpose**: Clear all rankings for user's list

**Authentication**: Session cookie (httpOnly)

**Query Params**:
- `rankingListId`: default = 'default'

**Database Operation**:
- Call `storage.clearUserProductRankings(userId, rankingListId)`

**Cache Invalidation**:
- Ranking stats cache

**Response**:
```javascript
{ success: true }
```

---

### 10. Products Endpoint
**File:** `server.js` (uses ProductsService)

#### GET /api/products/rankable
**Purpose**: Get products user can rank (filtered by purchase history)

**Authentication**: Session cookie (httpOnly)

**Query Params**:
- `query`: Search term (optional)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20)
- `sort`: Sort order (default: 'name-asc')

**Server-side Filtering Logic**:
1. Get all products from Shopify (with caching)
2. Enrich with metadata (animal, flavor) and ranking stats
3. Get user's already-ranked product IDs
4. Filter out ranked products
5. **For non-employee users**: Filter to only purchased products
   - Sync Shopify orders on user login
   - Query purchase history from database
   - If empty purchase history: Show all (sync may be in progress)
6. **For employee users**: Show all unranked products
7. Apply search filter (name, animal, flavor)
8. Paginate results

**Response**:
```javascript
{
  products: [
    {
      productId: '123456789',
      title: 'Product Name',
      vendor: 'Brand',
      image: 'https://...',
      price: '29.99',
      metadata: {
        animal: 'beef',
        flavor: 'teriyaki'
      },
      rankingCount: 42,
      avgRank: 3.5,
      // ... other enriched fields
    }
  ],
  total: 150,
  hasMore: true
}
```

---

## Database Layer

### 11. Storage Methods
**File:** `server/storage.js`

#### saveProductRanking(params)
**Purpose**: Save/update single product ranking

**Params**:
- userId
- shopifyProductId
- productData (JSONB)
- ranking (integer)
- rankingListId

**SQL Operation**: UPSERT with ON CONFLICT DO UPDATE
- Unique constraint: (userId, shopifyProductId, rankingListId)
- Update: ranking, productData, updatedAt on conflict

**Error Handling**: Capture to Sentry with context

---

#### getUserProductRankings(userId, rankingListId)
**Purpose**: Fetch user's rankings ordered by rank

**Returns**: Array of ranking records

---

#### bulkUpsertProductRankings(params)
**Purpose**: Atomically save multiple rankings

**Params**:
- userId
- rankings: Array of { productId, productData, ranking }
- rankingListId

**Database Transaction**:
1. Upsert each ranking (ON CONFLICT DO UPDATE)
2. Differential delete: Remove rankings for products NOT in payload
3. Special case: Empty payload = delete all rankings
4. Retry wrapper for connection errors

**Atomicity**: All operations succeed or all fail (transaction rollback)

**Returns**: Array of saved ranking records

---

#### clearUserProductRankings(userId, rankingListId)
**Purpose**: Delete all rankings for user's list

**SQL Operation**: DELETE WHERE userId AND rankingListId

---

### 12. ProductRankingRepository
**File:** `server/repositories/ProductRankingRepository.js`

#### getRankedProductIdsByUser(userId, rankingListId)
**Purpose**: Get array of product IDs user has ranked

**Returns**: Array of shopifyProductId strings

**Usage**: Filter available products in useRankableProducts

---

## Business Logic

### 13. Purchase History Filtering
**Requirement**: Non-employee users can only rank products they've purchased

**Implementation Flow**:
1. User logs in via Shopify Customer Account
2. Webhook or sync process fetches user's orders
3. Orders stored in database with product IDs
4. `ProductsService.getRankableProductsForUser()` queries purchase history
5. Filter products to intersection of (unranked AND purchased)
6. Employees bypass filter (can rank any product)

**Edge Case**: Empty purchase history returns all products
- Assumption: Sync still in progress
- Prevents empty state during initial login

---

### 14. Gamification Integration

#### Streak Management
**Trigger**: Bulk ranking save
**Logic**: Update 'daily_rank' streak when user ranks products
**Broadcast**: WebSocket event `streak:updated` to user's room

#### Achievement System
**Checked After Ranking**:
- rank_count achievements (1, 10, 25, 50, etc.)
- complete_collection (rank all products)
- unique_brands (explore different brands)
- streak-based achievements
- leaderboard position achievements

**Flavor Coins**:
- Award coins for newly ranked products with metadata
- Check which products are new since last save
- Award coins via FlavorCoinManager

**WebSocket Emission**:
- Emit earned achievements to user
- Include achievement details for toast notifications

---

## Data Structures

### 15. Ranking Object
```javascript
{
  ranking: number,           // Position in list (1-based)
  productData: {
    productId: string,       // Shopify product ID
    title: string,
    vendor: string,
    image: string,
    price: string,
    metadata: {
      animal: string,
      flavor: string
    },
    // ... other product fields
  }
}
```

### 16. Product Object (Enriched)
```javascript
{
  id: string,                    // Shopify product ID
  productId: string,             // Alias for consistency
  title: string,
  handle: string,
  vendor: string,
  productType: string,
  tags: string[],
  bodyHtml: string,
  image: string,
  price: string,
  compareAtPrice: string,
  
  // Metadata
  animalType: string,
  animalDisplay: string,
  animalIcon: string,
  primaryFlavor: string,
  secondaryFlavors: string[],
  flavorDisplay: string,
  flavorIcon: string,
  
  // Ranking Stats
  rankingCount: number,          // How many users ranked this
  uniqueRankers: number,
  avgRank: number,
  bestRank: number,
  worstRank: number,
  lastRankedAt: date
}
```

### 17. Progress Data
```javascript
{
  totalRankings: number,
  currentStreak: number,
  achievements: [
    {
      code: string,
      name: string,
      description: string,
      icon: string,              // Emoji or image URL
      tier: 'bronze'|'silver'|'gold',
      earned: boolean,
      earnedDate: date,
      requirement: {
        type: string,
        value: number
      },
      progress: {
        current: number,
        required: number
      }
    }
  ],
  recentAchievements: [],        // Recently earned
  nextMilestones: [
    {
      code: string,
      name: string,
      progress: number            // Percentage (0-100)
    }
  ]
}
```

---

## UI/UX Requirements

### 18. Interaction Patterns

#### Drag and Drop
- **Source**: Product cards in search panel
- **Target**: Ranking slots (empty or filled)
- **Visual Feedback**: Highlight target slot on drag over
- **Behavior**: 
  - Drop on empty slot: Insert at that position
  - Drop on filled slot: Push existing items down
  - Reorder existing: Drag between slots, renumber affected items

#### Auto-save UX
- **Trigger**: Any ranking change (add, remove, reorder)
- **Debounce**: 800ms delay before network request
- **Visual Indicator**: Show "Saving..." spinner in header
- **Success**: Show "✓ Saved" for 2 seconds
- **Error**: Show "❌ Save failed" and retry automatically
- **Persistence**: Queue operations in IndexedDB for retry

#### Navigation Protection
- **Trigger**: User attempts to leave page with pending saves
- **Browser**: Show beforeunload confirmation dialog
- **React Router**: Block navigation and show modal
- **Modal Content**: "Saving your rankings..." with spinner
- **Auto-proceed**: Navigate after save completes

---

### 19. Loading States

#### Initial Page Load
- Show loading spinner in search panel
- Rankings panel shows empty slots
- Progress widget hidden until data loads

#### Pagination
- Show "Loading..." text in "Load More" button
- Disable button during load
- Append new products to grid

#### Save Operations
- Show spinner next to save status
- Dim/disable UI during critical operations (optional)

---

### 20. Error States

#### Failed Ranking Load
- Log to console
- Show empty rankings panel
- Allow user to start ranking fresh

#### Failed Save
- Show error message in rankings header
- Retry automatically (up to 3 times)
- Keep operation in IndexedDB queue
- Retry on next page load if still failed

#### No Products Available
- Show empty state in search panel
- Message: "All products have been ranked!" (if no search term)
- Message: "No products match your search" (if searching)

---

### 21. Responsive Behavior

#### Layout
- Three-panel layout on desktop
- Progress widget at top (collapsible)
- Rankings panel on left
- Search panel on right

#### Mobile Considerations (Current)
- Drag and drop works on touch devices
- May need touch-specific event handlers
- Consider stacking panels vertically

---

## Performance Optimizations

### 22. Caching Strategies

#### Client-side (React Query)
- Rankings: 5 minute stale time
- Progress: 30 second stale time, 60 second refetch
- Products: On-demand, no auto-refetch

#### Server-side Caches
- Ranking stats: 30 minute cache
- Product metadata: 30 minute cache
- Shopify products: Cache with invalidation
- Leaderboard: Cache with invalidation

#### Cache Invalidation
- Clear on ranking save
- Clear on achievement award
- Clear on admin actions

---

### 23. Network Optimization

#### Debouncing
- Search input: 300ms
- Auto-save: 800ms
- Prevents excessive API calls

#### Pagination
- Load 20 products at a time
- Infinite scroll pattern
- Lazy load images

#### Batch Operations
- Save all rankings in single POST
- Atomic transaction on server
- Reduces round trips

---

### 24. Data Integrity

#### Duplicate Prevention
- Client: Check before adding to rankings array
- Server: Validate no duplicate product IDs in payload
- Database: Unique constraint on (userId, productId, listId)

#### Idempotency
- Client: Generate idempotency key per save
- Server: Accept X-Idempotency-Key header
- Database: UPSERT operations (ON CONFLICT DO UPDATE)

#### Transaction Safety
- Wrap bulk operations in database transaction
- All-or-nothing save (no partial updates)
- Retry on connection errors

---

## Security Requirements

### 25. Authentication & Authorization

#### Session Management
- HttpOnly session cookie
- Server validates session on every request
- No session ID in request body (cookie only)

#### User Isolation
- All queries filtered by userId from session
- Cannot view/modify other users' rankings
- Employee role check for admin operations

#### Input Validation
- Validate rankingListId format
- Validate product IDs exist
- Validate ranking numbers are positive integers
- Sanitize search queries

---

### 26. Error Handling

#### Client-side
- Catch and log errors to console
- Show user-friendly error messages
- Retry failed operations automatically
- Preserve user data in IndexedDB

#### Server-side
- Try-catch all async operations
- Log errors to Sentry with context
- Return appropriate HTTP status codes
- Don't expose internal errors to client

---

## Testing Requirements

### 27. Unit Tests (Recommended)

#### Components
- RankingsPanel: Drag and drop logic
- SearchProductsPanel: Search and pagination
- ProgressWidget: Display logic and calculations

#### Hooks
- useRankings: Save queue, debounce, snapshots
- useRankableProducts: Filtering and pagination
- useProgress: Data transformation

#### Utilities
- PersistentQueue: IndexedDB operations
- All CRUD operations

---

### 28. Integration Tests (Recommended)

#### User Flows
- Add product to ranking
- Reorder rankings via drag and drop
- Remove product from ranking
- Clear all rankings
- Search and paginate products
- Navigate away with pending saves

#### API Endpoints
- Bulk save with various payloads
- Get rankings
- Clear rankings
- Get rankable products with filters

---

### 29. Edge Cases to Test

#### Data Scenarios
- Empty rankings list
- All products ranked
- Duplicate product ranking attempt
- Network failure during save
- Browser crash during save
- Multiple rapid ranking changes

#### User Scenarios
- New user (no rankings yet)
- Employee user (unrestricted access)
- User with partial purchase history
- User navigating during save

---

## Configuration

### 30. Constants

#### Pagination
- Page size: 20 products
- Sort order: 'name-asc'

#### Timing
- Search debounce: 300ms
- Auto-save debounce: 800ms
- Save success message: 2000ms display
- Progress refetch: 60000ms interval

#### Retry Policy
- Max retries: 3
- Backoff: Exponential (2^n seconds)

#### Defaults
- Initial slot count: 10
- Slot expansion: +5 slots
- Expansion trigger: Within 2 slots of capacity
- Default ranking list: 'default'

---

## Dependencies

### 31. Frontend Libraries
- React (hooks, components)
- React Router (navigation, blocking)
- @tanstack/react-query (data fetching, caching)
- IndexedDB (PersistentQueue storage)

### 32. Backend Libraries
- Express.js (routing)
- Drizzle ORM (database queries)
- PostgreSQL (data storage)
- @sentry/node (error tracking)
- Socket.io (WebSocket for real-time updates)

### 33. External Services
- Shopify API (product data, customer orders)
- Redis (optional: distributed caching)

---

## Future Enhancements (Not in Current Implementation)

### Potential Features
- Multiple ranking lists per user
- Shared/public ranking lists
- Ranking templates
- Comparison view (my rankings vs others)
- Ranking analytics and insights
- Export rankings to PDF/CSV
- Undo/redo ranking changes
- Ranking notes/comments
- Mobile-optimized touch gestures
