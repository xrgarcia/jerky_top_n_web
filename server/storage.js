const { users, sessions, rankings, magicLinks, productRankings, userProductSearches } = require('../shared/schema.js');
const { db } = require('./db.js');
const { eq, lt } = require('drizzle-orm');
const crypto = require('crypto');
const Sentry = require('@sentry/node');

class DatabaseStorage {
  async getUser(shopifyCustomerId) {
    const [user] = await db.select().from(users).where(eq(users.shopifyCustomerId, shopifyCustomerId));
    return user || undefined;
  }

  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createOrUpdateUser(userData) {
    // Check if user exists
    const existingUser = await this.getUser(userData.shopifyCustomerId);
    
    if (existingUser) {
      // Update existing user
      const [updatedUser] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          displayName: userData.displayName,
          accessToken: userData.accessToken,
          refreshToken: userData.refreshToken,
          tokenExpiry: userData.accessToken ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null, // 24 hours
          updatedAt: new Date(),
        })
        .where(eq(users.shopifyCustomerId, userData.shopifyCustomerId))
        .returning();
      
      return updatedUser;
    } else {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          shopifyCustomerId: userData.shopifyCustomerId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          displayName: userData.displayName,
          accessToken: userData.accessToken,
          refreshToken: userData.refreshToken,
          tokenExpiry: userData.accessToken ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null, // 24 hours
        })
        .returning();
      
      return newUser;
    }
  }

  async saveRanking(userId, rankingData) {
    const [ranking] = await db
      .insert(rankings)
      .values({
        userId,
        rankingName: rankingData.rankingName,
        rankingData: rankingData.rankingData,
        isPublic: rankingData.isPublic ? 1 : 0,
      })
      .returning();
    
    return ranking;
  }

  async getUserRankings(userId) {
    return await db.select().from(rankings).where(eq(rankings.userId, userId));
  }

  // Session management methods
  async createSession(userData) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    
    const [session] = await db
      .insert(sessions)
      .values({
        id: sessionId,
        userId: userData.userId,
        shopifyCustomerId: userData.shopifyCustomerId,
        accessToken: userData.accessToken,
        refreshToken: userData.refreshToken,
        customerData: userData.customerData,
        expiresAt: expiresAt,
      })
      .returning();
    
    return session;
  }

  async getSession(sessionId) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (session.expiresAt <= new Date()) {
      // Delete expired session
      await this.deleteSession(sessionId);
      return null;
    }
    
    return session;
  }

  async deleteSession(sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async cleanupExpiredSessions() {
    const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    return result.rowCount || 0;
  }

  // Magic link token methods
  async createMagicLink({ token, email, shopifyCustomerId, customerData, expiresIn = 30 }) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresIn); // 30 minutes default

    const [magicLink] = await db.insert(magicLinks).values({
      token,
      email,
      shopifyCustomerId,
      customerData,
      expiresAt,
    }).returning();

    return magicLink;
  }

  async findMagicLink(token) {
    const [magicLink] = await db.select().from(magicLinks).where(eq(magicLinks.token, token));
    return magicLink;
  }

  async useMagicLink(token) {
    const [magicLink] = await db.update(magicLinks)
      .set({ used: 1 })
      .where(eq(magicLinks.token, token))
      .returning();
    return magicLink;
  }

  async cleanupExpiredMagicLinks() {
    const now = new Date();
    const result = await db.delete(magicLinks).where(lt(magicLinks.expiresAt, now));
    return result;
  }

  // Product rankings methods
  async saveProductRanking({ userId, shopifyProductId, productData, ranking, rankingListId }) {
    try {
      const [productRanking] = await db.insert(productRankings).values({
        userId,
        shopifyProductId,
        productData,
        ranking,
        rankingListId,
      }).returning();

      return productRanking;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'rankings' },
        extra: { userId, shopifyProductId, ranking, rankingListId }
      });
      throw error;
    }
  }

  async getUserProductRankings(userId, rankingListId) {
    try {
      const { and } = require('drizzle-orm');
      return await db.select().from(productRankings)
        .where(and(eq(productRankings.userId, userId), eq(productRankings.rankingListId, rankingListId)))
        .orderBy(productRankings.ranking);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'rankings' },
        extra: { userId, rankingListId }
      });
      throw error;
    }
  }

  async updateProductRanking(id, ranking) {
    try {
      const [updated] = await db.update(productRankings)
        .set({ ranking, updatedAt: new Date() })
        .where(eq(productRankings.id, id))
        .returning();
      return updated;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'rankings' },
        extra: { rankingId: id, newRanking: ranking }
      });
      throw error;
    }
  }

  async deleteProductRanking(id) {
    try {
      await db.delete(productRankings).where(eq(productRankings.id, id));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'rankings' },
        extra: { rankingId: id }
      });
      throw error;
    }
  }

  async clearUserProductRankings(userId, rankingListId) {
    try {
      const { and } = require('drizzle-orm');
      await db.delete(productRankings)
        .where(and(eq(productRankings.userId, userId), eq(productRankings.rankingListId, rankingListId)));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'rankings' },
        extra: { userId, rankingListId }
      });
      throw error;
    }
  }

  async logProductSearch(searchTerm, resultCount, userId = null, pageName) {
    try {
      await db.insert(userProductSearches).values({
        userId,
        searchTerm,
        resultCount,
        pageName,
      });
    } catch (error) {
      // Silently fail - don't interrupt the search experience
      console.error('Error logging product search:', error);
      Sentry.captureException(error, {
        tags: { service: 'products' },
        extra: { searchTerm, resultCount, userId, pageName }
      });
    }
  }
}

const storage = new DatabaseStorage();

module.exports = { storage };