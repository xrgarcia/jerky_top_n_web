const { pgTable, serial, text, timestamp, integer, jsonb, unique, index, boolean } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

// User profiles from jerky.com customer accounts
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  shopifyCustomerId: text('shopify_customer_id').unique().notNull(),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  displayName: text('display_name'),
  role: text('role').default('user').notNull(), // 'user' or 'employee_admin'
  active: boolean('active').default(false).notNull(), // true if user has logged in at least once
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiry: timestamp('token_expiry'),
  fullHistoryImported: boolean('full_history_imported').default(false).notNull(), // Bulk import completion flag
  historyImportedAt: timestamp('history_imported_at'), // When bulk import completed
  lastOrderSyncedAt: timestamp('last_order_synced_at'), // Last time orders were synced
  importStatus: text('import_status').default('pending').notNull(), // 'pending', 'in_progress', 'completed', 'failed'
  profileImageUrl: text('profile_image_url'), // URL to profile image in object storage
  handle: text('handle'), // Unique username like "@smokybeef247" (stored without @)
  hideNamePrivacy: boolean('hide_name_privacy').default(false).notNull(), // Hide real name and show handle instead
  shopifyCreatedAt: timestamp('shopify_created_at'), // When customer account was created on jerky.com (Shopify)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  handleUnique: unique().on(table.handle),
}));

// Customer sessions for persistent login state
const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // Session ID
  userId: integer('user_id').references(() => users.id).notNull(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  customerData: jsonb('customer_data').notNull(), // Shopify customer profile
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

// User rankings for jerky products
const rankings = pgTable('rankings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  rankingName: text('ranking_name').notNull(),
  rankingData: jsonb('ranking_data').notNull(), // Array of ranked products
  isPublic: integer('is_public').default(0), // 0 = private, 1 = public
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Magic link tokens for secure email authentication
const magicLinks = pgTable('magic_links', {
  id: serial('id').primaryKey(),
  token: text('token').unique().notNull(),
  email: text('email').notNull(),
  shopifyCustomerId: text('shopify_customer_id'),
  customerData: jsonb('customer_data'), // Shopify customer profile
  used: integer('used').default(0), // 0 = unused, 1 = used
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

// Product rankings table - tracks individual product rankings by customers
const productRankings = pgTable('product_rankings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  shopifyProductId: text('shopify_product_id').notNull(), // Shopify product ID
  productData: jsonb('product_data').notNull(), // Full Shopify product info
  ranking: integer('ranking').notNull(), // 1 = highest rank
  rankingListId: text('ranking_list_id').notNull(), // Groups rankings into lists
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Unique constraint: each user can only rank a product once per ranking list
  uniqueUserProductList: unique().on(table.userId, table.shopifyProductId, table.rankingListId),
}));

// Achievement definitions - types of badges users can earn
const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  code: text('code').unique().notNull(), // e.g., 'first_rank', 'beef_master', 'bbq_lovers'
  name: text('name').notNull(), // Display name
  description: text('description').notNull(),
  icon: text('icon').notNull(), // Emoji or image URL
  iconType: text('icon_type').default('emoji'), // 'emoji' or 'image'
  tier: text('tier'), // For legacy achievements: 'bronze', 'silver', 'gold', 'platinum' (nullable for new dynamic collections)
  collectionType: text('collection_type').notNull(), // 'engagement_collection', 'dynamic_collection', 'static_collection', 'hidden_collection', 'flavor_coin', 'legacy' (legacy: 'custom_product_list')
  category: text('category'), // 'ranking', 'social', 'discovery', 'streak' (for legacy achievements)
  proteinCategory: text('protein_category'), // LEGACY: For backward compatibility (stores first category)
  proteinCategories: jsonb('protein_categories'), // For multi-category collections: ['cattle', 'poultry', ...] (nullable for legacy)
  isHidden: integer('is_hidden').default(0), // 0 = visible, 1 = hidden until unlocked
  prerequisiteAchievementId: integer('prerequisite_achievement_id').references(() => achievements.id), // Required achievement that must be earned first
  requirement: jsonb('requirement').notNull(), // Criteria for earning (e.g., {type: 'complete_flavor_set', flavors: ['sweet', 'spicy']})
  tierThresholds: jsonb('tier_thresholds'), // For dynamic collections: {bronze: 40, silver: 60, gold: 75, platinum: 90, diamond: 100}
  hasTiers: integer('has_tiers').default(0), // 0 = no tiers (single achievement), 1 = has tiers (bronze/silver/gold/etc)
  points: integer('points').default(0), // Points awarded for earning
  isActive: integer('is_active').default(1), // 0 = inactive, 1 = active (for admin control)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Coin type configuration - defines branding and content for each coin type
const coinTypeConfig = pgTable('coin_type_config', {
  collectionType: text('collection_type').primaryKey(), // 'engagement_collection', 'static_collection', 'dynamic_collection', 'flavor_coin', 'legacy'
  displayName: text('display_name').notNull(), // e.g., 'Engagement Coins'
  tagline: text('tagline').notNull(), // e.g., 'Earned through active participation'
  description: text('description').notNull(), // Full description of this coin type
  icon: text('icon').notNull(), // Emoji icon for this coin type
  color: text('color').notNull(), // Hex color for branding (e.g., '#c4a962')
  howToEarn: text('how_to_earn').notNull(), // Instructions on earning these coins
  metadata: jsonb('metadata'), // Additional flexible data
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User achievements - badges earned by users
const userAchievements = pgTable('user_achievements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  achievementId: integer('achievement_id').references(() => achievements.id).notNull(),
  currentTier: text('current_tier'), // For dynamic collections: 'bronze', 'silver', 'gold', 'platinum', 'diamond'
  percentageComplete: integer('percentage_complete').default(0), // For dynamic collections: 0-100
  pointsAwarded: integer('points_awarded').default(0), // Actual points earned (proportional for tiered achievements)
  earnedAt: timestamp('earned_at').defaultNow(),
  progress: jsonb('progress'), // Track detailed progress toward achievement
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User streaks - tracks consecutive activity
const streaks = pgTable('streaks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  streakType: text('streak_type').notNull(), // VALID VALUES: 'daily_rank', 'daily_login' (see shared/constants.js)
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  lastActivityDate: timestamp('last_activity_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Activity logs - community activity feed
const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  activityType: text('activity_type').notNull(), // 'rank_product', 'earn_badge', 'join', 'milestone'
  activityData: jsonb('activity_data').notNull(), // Details about the activity
  isPublic: integer('is_public').default(1), // 0 = private, 1 = public
  createdAt: timestamp('created_at').defaultNow(),
});

// Product views - tracks product page views for trending calculation
const productViews = pgTable('product_views', {
  id: serial('id').primaryKey(),
  shopifyProductId: text('shopify_product_id').notNull(),
  userId: integer('user_id').references(() => users.id), // Nullable for anonymous views
  viewedAt: timestamp('viewed_at').defaultNow(),
});

// Products metadata - stores extracted metadata from Shopify products
const productsMetadata = pgTable('products_metadata', {
  id: serial('id').primaryKey(),
  shopifyProductId: text('shopify_product_id').unique().notNull(),
  animalType: text('animal_type'), // e.g., 'fish', 'cattle', 'poultry', 'game', 'exotic'
  animalDisplay: text('animal_display'), // e.g., 'Beef', 'Chicken', 'Salmon'
  animalIcon: text('animal_icon'), // Emoji icon
  vendor: text('vendor'), // Brand/vendor name (e.g., 'Jerky.com', 'Wild Bill's')
  primaryFlavor: text('primary_flavor'), // e.g., 'sweet', 'spicy', 'savory', 'smoky'
  secondaryFlavors: text('secondary_flavors'), // JSON array of secondary flavor types
  flavorDisplay: text('flavor_display'), // e.g., 'Sweet & Spicy', 'Savory'
  flavorIcon: text('flavor_icon'), // Emoji icon for primary flavor
  title: text('title').notNull(), // Product title for reference
  forceRankable: boolean('force_rankable').default(false), // Admin override - makes product rankable for all users during beta
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Ranking operations - idempotency tracking for ranking saves
const rankingOperations = pgTable('ranking_operations', {
  id: serial('id').primaryKey(),
  operationId: text('operation_id').unique().notNull(), // Client-generated UUID
  userId: integer('user_id').references(() => users.id).notNull(),
  shopifyProductId: text('shopify_product_id').notNull(),
  rankingListId: text('ranking_list_id').notNull(),
  ranking: integer('ranking').notNull(),
  status: text('status').default('completed').notNull(), // 'completed', 'failed'
  createdAt: timestamp('created_at').defaultNow(),
});

// Customer order items - tracks individual line items purchased by customers from Shopify
const customerOrderItems = pgTable('customer_order_items', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull(), // Shopify order number
  orderDate: timestamp('order_date').notNull(), // When the order was placed
  shopifyProductId: text('shopify_product_id').notNull(), // Product ID from Shopify
  sku: text('sku'), // Product SKU (nullable as some products may not have SKU)
  quantity: integer('quantity').default(1).notNull(), // Quantity purchased
  fulfillmentStatus: text('fulfillment_status'), // Shopify fulfillment status (e.g., 'fulfilled', 'partial', 'unfulfilled', 'restocked', 'delivered')
  userId: integer('user_id').references(() => users.id).notNull(),
  customerEmail: text('customer_email').notNull(), // Backup reference to customer
  lineItemData: jsonb('line_item_data'), // Full Shopify line item for audit/debug
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Unique constraint: each order can only have one entry per product/sku
  uniqueOrderProduct: unique().on(table.orderNumber, table.shopifyProductId, table.sku),
  // Indexes for efficient purchase lookups
  userIdIdx: index('idx_customer_order_items_user_id').on(table.userId),
  userProductIdx: index('idx_customer_order_items_user_product').on(table.userId, table.shopifyProductId),
  userDateIdx: index('idx_customer_order_items_user_date').on(table.userId, table.orderDate),
  // Admin query optimization indexes
  orderDateIdx: index('idx_customer_order_items_order_date').on(table.orderDate),
  fulfillmentStatusIdx: index('idx_customer_order_items_fulfillment_status').on(table.fulfillmentStatus),
  orderDateStatusIdx: index('idx_customer_order_items_date_status').on(table.orderDate, table.fulfillmentStatus),
}));

// Relations
const usersRelations = relations(users, ({ many }) => ({
  rankings: many(rankings),
  sessions: many(sessions),
  achievements: many(userAchievements),
  streaks: many(streaks),
  activityLogs: many(activityLogs),
}));

const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

const rankingsRelations = relations(rankings, ({ one }) => ({
  user: one(users, {
    fields: [rankings.userId],
    references: [users.id],
  }),
}));

const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

const streaksRelations = relations(streaks, ({ one }) => ({
  user: one(users, {
    fields: [streaks.userId],
    references: [users.id],
  }),
}));

const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

// System configuration table - stores application-level settings
const systemConfig = pgTable('system_config', {
  id: serial('id').primaryKey(),
  key: text('key').unique().notNull(), // Configuration key (e.g., 'cache_stale_hours')
  value: text('value').notNull(), // Configuration value (stored as string)
  description: text('description'), // Human-readable description
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: text('updated_by'), // Email of admin who last updated
});

// User activities - comprehensive tracking for engagement analysis
const userActivities = pgTable('user_activities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  activityType: text('activity_type').notNull(), // 'search', 'product_view', 'profile_view', 'ranking_saved', 'coin_earned', 'login', 'purchase'
  activityData: jsonb('activity_data'), // Additional context (e.g., search term, product ID, profile ID)
  metadata: jsonb('metadata'), // Extra tracking data (e.g., referrer, device, location)
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // Indexes for efficient activity queries
  userIdIdx: index('idx_user_activities_user_id').on(table.userId),
  userTypeIdx: index('idx_user_activities_user_type').on(table.userId, table.activityType),
  createdAtIdx: index('idx_user_activities_created_at').on(table.createdAt),
}));

// Anonymous searches - tracks search behavior without user authentication for analytics
const anonymousSearches = pgTable('anonymous_searches', {
  id: serial('id').primaryKey(),
  searchTerm: text('search_term').notNull(),
  resultCount: integer('result_count').notNull(),
  context: text('context').notNull(), // 'products', 'rank_page', 'global_search', 'product_rankings'
  sessionHash: text('session_hash'), // Anonymized session identifier (nullable for privacy)
  metadata: jsonb('metadata'), // Additional analytics data (e.g., user agent, referrer)
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // Indexes for analytics queries
  contextIdx: index('idx_anonymous_searches_context').on(table.context),
  createdAtIdx: index('idx_anonymous_searches_created_at').on(table.createdAt),
  contextTimeIdx: index('idx_anonymous_searches_context_time').on(table.context, table.createdAt),
}));

// User engagement scores - pre-aggregated rollup table for leaderboard performance
const userEngagementScores = pgTable('user_engagement_scores', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).unique().notNull(),
  achievementsCount: integer('achievements_count').default(0).notNull(),
  pageViewsCount: integer('page_views_count').default(0).notNull(),
  rankingsCount: integer('rankings_count').default(0).notNull(),
  searchesCount: integer('searches_count').default(0).notNull(),
  uniqueProductsCount: integer('unique_products_count').default(0).notNull(),
  engagementScore: integer('engagement_score').default(0).notNull(),
  achievementsCountWeek: integer('achievements_count_week').default(0).notNull(),
  pageViewsCountWeek: integer('page_views_count_week').default(0).notNull(),
  rankingsCountWeek: integer('rankings_count_week').default(0).notNull(),
  searchesCountWeek: integer('searches_count_week').default(0).notNull(),
  engagementScoreWeek: integer('engagement_score_week').default(0).notNull(),
  achievementsCountMonth: integer('achievements_count_month').default(0).notNull(),
  pageViewsCountMonth: integer('page_views_count_month').default(0).notNull(),
  rankingsCountMonth: integer('rankings_count_month').default(0).notNull(),
  searchesCountMonth: integer('searches_count_month').default(0).notNull(),
  engagementScoreMonth: integer('engagement_score_month').default(0).notNull(),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // Primary index on userId for fast lookups
  userIdIdx: index('idx_user_engagement_scores_user_id').on(table.userId),
  // Index on engagement_score for leaderboard sorting (all_time)
  engagementScoreIdx: index('idx_user_engagement_scores_engagement').on(table.engagementScore),
  // Index on weekly score for weekly leaderboard
  engagementScoreWeekIdx: index('idx_user_engagement_scores_week').on(table.engagementScoreWeek),
  // Index on monthly score for monthly leaderboard
  engagementScoreMonthIdx: index('idx_user_engagement_scores_month').on(table.engagementScoreMonth),
}));

// User classifications - analyzed user journey state for personalized guidance
const userClassifications = pgTable('user_classifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).unique().notNull(),
  journeyStage: text('journey_stage').notNull(), // 'new_user', 'exploring', 'engaged', 'power_user', 'dormant'
  engagementLevel: text('engagement_level').notNull(), // 'none', 'low', 'medium', 'high', 'very_high'
  explorationBreadth: text('exploration_breadth').notNull(), // 'narrow', 'moderate', 'diverse'
  focusAreas: jsonb('focus_areas'), // Array of dominant interests (e.g., ['spicy', 'beef', 'exotic'])
  classificationData: jsonb('classification_data').notNull(), // Detailed metrics used for classification
  lastCalculated: timestamp('last_calculated').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_user_classifications_user_id').on(table.userId),
}));

// Classification configuration - rules and thresholds for user analysis
const classificationConfig = pgTable('classification_config', {
  id: serial('id').primaryKey(),
  configKey: text('config_key').unique().notNull(), // e.g., 'journey_stage_thresholds', 'engagement_rules'
  configValue: jsonb('config_value').notNull(), // JSON object with rules/thresholds
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: text('updated_by'), // Email of admin who last updated
});

// User flavor profile communities - tracks user journey through flavor profile micro-communities
const userFlavorProfileCommunities = pgTable('user_flavor_profile_communities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  flavorProfile: text('flavor_profile').notNull(), // e.g., 'sweet', 'spicy', 'savory', 'smoky', 'bbq', 'hot', 'teriyaki'
  communityState: text('community_state').notNull(), // 'curious', 'seeker', 'taster', 'enthusiast', 'explorer'
  productsPurchased: integer('products_purchased').default(0), // Total products purchased with this flavor profile
  productsDelivered: integer('products_delivered').default(0), // Total products delivered with this flavor profile
  productsRanked: integer('products_ranked').default(0), // Total products ranked with this flavor profile
  avgRankPosition: integer('avg_rank_position'), // Average ranking position (1 = top rank, higher = lower rank)
  highestRankPosition: integer('highest_rank_position'), // Best (lowest number) ranking position
  lowestRankPosition: integer('lowest_rank_position'), // Worst (highest number) ranking position
  lastActivityAt: timestamp('last_activity_at').defaultNow(), // Last search, purchase, or ranking for this flavor profile
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Unique constraint: one record per user per flavor profile
  uniqueUserFlavor: unique().on(table.userId, table.flavorProfile),
  // Indexes for efficient queries
  userIdIdx: index('idx_user_flavor_profile_communities_user_id').on(table.userId),
  flavorProfileIdx: index('idx_user_flavor_profile_communities_flavor').on(table.flavorProfile),
  communityStateIdx: index('idx_user_flavor_profile_communities_state').on(table.communityState),
  userFlavorStateIdx: index('idx_user_flavor_profile_communities_user_flavor_state').on(table.userId, table.flavorProfile, table.communityState),
}));

// User guidance cache - pre-calculated personalized guidance messages
const userGuidanceCache = pgTable('user_guidance_cache', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  pageContext: text('page_context').notNull(), // 'rank', 'products', 'community', 'coinbook', 'general'
  guidanceData: jsonb('guidance_data').notNull(), // Complete guidance object { title, message, type, icon, classification, stats }
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Unique constraint: one cached guidance per user per page context
  uniqueUserPage: unique().on(table.userId, table.pageContext),
  // Index for efficient user lookups
  userIdIdx: index('idx_user_guidance_cache_user_id').on(table.userId),
  // Index for cache freshness queries
  calculatedAtIdx: index('idx_user_guidance_cache_calculated_at').on(table.calculatedAt),
}));

// Relations for new tables
const userActivitiesRelations = relations(userActivities, ({ one }) => ({
  user: one(users, {
    fields: [userActivities.userId],
    references: [users.id],
  }),
}));

const userEngagementScoresRelations = relations(userEngagementScores, ({ one }) => ({
  user: one(users, {
    fields: [userEngagementScores.userId],
    references: [users.id],
  }),
}));

const userClassificationsRelations = relations(userClassifications, ({ one }) => ({
  user: one(users, {
    fields: [userClassifications.userId],
    references: [users.id],
  }),
}));

const userFlavorProfileCommunitiesRelations = relations(userFlavorProfileCommunities, ({ one }) => ({
  user: one(users, {
    fields: [userFlavorProfileCommunities.userId],
    references: [users.id],
  }),
}));

const userGuidanceCacheRelations = relations(userGuidanceCache, ({ one }) => ({
  user: one(users, {
    fields: [userGuidanceCache.userId],
    references: [users.id],
  }),
}));

module.exports = {
  users,
  sessions,
  rankings,
  magicLinks,
  productRankings,
  achievements,
  coinTypeConfig,
  userAchievements,
  streaks,
  activityLogs,
  productViews,
  productsMetadata,
  rankingOperations,
  customerOrderItems,
  systemConfig,
  userActivities,
  anonymousSearches,
  userEngagementScores,
  userClassifications,
  classificationConfig,
  userFlavorProfileCommunities,
  userGuidanceCache,
  usersRelations,
  sessionsRelations,
  rankingsRelations,
  achievementsRelations,
  userAchievementsRelations,
  streaksRelations,
  activityLogsRelations,
  userActivitiesRelations,
  userEngagementScoresRelations,
  userClassificationsRelations,
  userFlavorProfileCommunitiesRelations,
  userGuidanceCacheRelations,
};