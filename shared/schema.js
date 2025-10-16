const { pgTable, serial, text, timestamp, integer, jsonb } = require('drizzle-orm/pg-core');
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
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiry: timestamp('token_expiry'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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
});

// User product searches - tracks search queries for analytics
const userProductSearches = pgTable('user_product_searches', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id), // Nullable for anonymous searches
  searchTerm: text('search_term').notNull(),
  resultCount: integer('result_count').notNull(),
  pageName: text('page_name').notNull(), // 'product_rankings' or 'products'
  searchedAt: timestamp('searched_at').defaultNow(),
});

// Achievement definitions - types of badges users can earn
const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  code: text('code').unique().notNull(), // e.g., 'first_rank', 'streak_7', 'top_10'
  name: text('name').notNull(), // Display name
  description: text('description').notNull(),
  icon: text('icon').notNull(), // Emoji or icon identifier
  tier: text('tier').notNull(), // 'bronze', 'silver', 'gold', 'platinum'
  category: text('category').notNull(), // 'ranking', 'social', 'discovery', 'streak'
  requirement: jsonb('requirement').notNull(), // Criteria for earning (e.g., {type: 'count', value: 50})
  points: integer('points').default(0), // Points awarded for earning
  createdAt: timestamp('created_at').defaultNow(),
});

// User achievements - badges earned by users
const userAchievements = pgTable('user_achievements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  achievementId: integer('achievement_id').references(() => achievements.id).notNull(),
  earnedAt: timestamp('earned_at').defaultNow(),
  progress: jsonb('progress'), // Track progress toward achievement
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
  primaryFlavor: text('primary_flavor'), // e.g., 'sweet', 'spicy', 'savory', 'smoky'
  secondaryFlavors: text('secondary_flavors'), // JSON array of secondary flavor types
  flavorDisplay: text('flavor_display'), // e.g., 'Sweet & Spicy', 'Savory'
  flavorIcon: text('flavor_icon'), // Emoji icon for primary flavor
  title: text('title').notNull(), // Product title for reference
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Page views - tracks all page views for engagement metrics
const pageViews = pgTable('page_views', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id), // Nullable for anonymous views
  pageType: text('page_type').notNull(), // 'home', 'products', 'community', 'rank', 'profile', 'product_detail'
  pageIdentifier: text('page_identifier'), // Optional: product ID, user ID, etc.
  referrer: text('referrer'), // Where the user came from
  viewedAt: timestamp('viewed_at').defaultNow(),
});

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

module.exports = {
  users,
  sessions,
  rankings,
  magicLinks,
  productRankings,
  userProductSearches,
  achievements,
  userAchievements,
  streaks,
  activityLogs,
  productViews,
  productsMetadata,
  pageViews,
  usersRelations,
  sessionsRelations,
  rankingsRelations,
  achievementsRelations,
  userAchievementsRelations,
  streaksRelations,
  activityLogsRelations,
};