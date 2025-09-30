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

// Relations
const usersRelations = relations(users, ({ many }) => ({
  rankings: many(rankings),
  sessions: many(sessions),
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

module.exports = {
  users,
  sessions,
  rankings,
  magicLinks,
  productRankings,
  userProductSearches,
  usersRelations,
  sessionsRelations,
  rankingsRelations
};