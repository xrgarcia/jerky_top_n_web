const { primaryDb } = require('../db-primary');
const { users } = require('../../shared/schema');
const { eq } = require('drizzle-orm');
const Sentry = require('@sentry/node');

/**
 * WebhookCustomerService - Handles Shopify customers/update webhook events
 * 
 * Responsibilities:
 * - Update user profile data (firstName, lastName, email, shopifyCreatedAt)
 * - Trigger targeted cache invalidation
 * - Broadcast real-time updates to active user sessions
 */
class WebhookCustomerService {
  constructor(webSocketGateway = null, sharedCaches = {}) {
    this.db = primaryDb;
    this.wsGateway = webSocketGateway;
    this.leaderboardCache = sharedCaches.leaderboardCache;
  }

  /**
   * Process customers/update webhook
   * @param {Object} customerData - Shopify customer object
   * @param {string} topic - Webhook topic
   * @returns {Promise<Object>} Processing result
   */
  async processCustomerWebhook(customerData, topic) {
    const startTime = Date.now();
    
    try {
      const shopifyCustomerId = String(customerData.id);
      
      // Find user by Shopify customer ID
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.shopifyCustomerId, shopifyCustomerId))
        .limit(1);
      
      if (!user) {
        console.log(`⚠️ Customer ${shopifyCustomerId} not found in database - skipping update`);
        return {
          success: true,
          action: 'skipped',
          reason: 'user_not_found',
          shopifyCustomerId
        };
      }

      // Parse Shopify created_at timestamp
      const shopifyCreatedAt = customerData.created_at ? new Date(customerData.created_at) : null;

      // Prepare update data
      const updateData = {
        firstName: customerData.first_name || user.firstName,
        lastName: customerData.last_name || user.lastName,
        email: customerData.email || user.email,
        displayName: `${customerData.first_name || user.firstName} ${customerData.last_name || user.lastName}`.trim(),
        shopifyCreatedAt: shopifyCreatedAt || user.shopifyCreatedAt,
        updatedAt: new Date()
      };

      // Check if anything actually changed
      const hasChanges = 
        updateData.firstName !== user.firstName ||
        updateData.lastName !== user.lastName ||
        updateData.email !== user.email ||
        updateData.displayName !== user.displayName ||
        (shopifyCreatedAt && user.shopifyCreatedAt?.getTime() !== shopifyCreatedAt.getTime());

      if (!hasChanges) {
        console.log(`✅ Customer ${shopifyCustomerId} already up to date - no changes needed`);
        return {
          success: true,
          action: 'no_changes',
          userId: user.id
        };
      }

      // Update user in database
      await this.db
        .update(users)
        .set(updateData)
        .where(eq(users.id, user.id));

      const duration = Date.now() - startTime;
      console.log(`✅ Updated customer ${shopifyCustomerId} (user ${user.id}): ${updateData.firstName} ${updateData.lastName} in ${duration}ms`);

      // Targeted cache invalidation
      await this.invalidateUserCaches(user.id);

      // Broadcast real-time update to user's active sessions
      this.broadcastProfileUpdate(user.id, updateData);

      return {
        success: true,
        action: 'updated',
        userId: user.id,
        shopifyCustomerId,
        changes: {
          firstName: updateData.firstName !== user.firstName,
          lastName: updateData.lastName !== user.lastName,
          email: updateData.email !== user.email,
          shopifyCreatedAt: shopifyCreatedAt && user.shopifyCreatedAt?.getTime() !== shopifyCreatedAt.getTime()
        },
        durationMs: duration
      };

    } catch (error) {
      console.error('❌ Error processing customer webhook:', error);
      Sentry.captureException(error, {
        tags: { 
          service: 'webhook_customer',
          shopify_customer_id: customerData?.id
        },
        extra: { customerData }
      });
      
      throw error;
    }
  }

  /**
   * Invalidate caches for a specific user
   * Only invalidates caches where this user's data appears
   * @param {number} userId - User ID
   */
  async invalidateUserCaches(userId) {
    const invalidations = [];

    try {
      // Check if user is in leaderboard top 50
      if (this.leaderboardCache) {
        const leaderboardData = this.leaderboardCache.get('all_time', 50);
        
        if (leaderboardData) {
          const userInLeaderboard = leaderboardData.users?.some(u => u.userId === userId);
          
          if (userInLeaderboard) {
            this.leaderboardCache.invalidate();
            invalidations.push('leaderboard');
            console.log(`🗑️ Invalidated leaderboard cache (user ${userId} is in top 50)`);
          }
        }
      }

      // Note: Individual profile data is fetched fresh each time, no specific cache to invalidate
      // The community endpoint queries the database directly

      if (invalidations.length > 0) {
        console.log(`✅ Targeted cache invalidation complete for user ${userId}: [${invalidations.join(', ')}]`);
      } else {
        console.log(`✅ No cache invalidation needed for user ${userId}`);
      }

    } catch (error) {
      console.error(`⚠️ Error invalidating caches for user ${userId}:`, error);
      // Don't throw - cache invalidation failure shouldn't fail the webhook
    }
  }

  /**
   * Broadcast profile update to user's active WebSocket sessions
   * @param {number} userId - User ID
   * @param {Object} updateData - Updated profile data
   */
  broadcastProfileUpdate(userId, updateData) {
    if (!this.wsGateway) {
      return;
    }

    try {
      const room = `dev:user:${userId}`;
      const updatePayload = {
        type: 'profile_updated',
        data: {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          displayName: updateData.displayName,
          email: updateData.email,
          shopifyCreatedAt: updateData.shopifyCreatedAt
        }
      };

      this.wsGateway.broadcastToRoom(room, 'profile:update', updatePayload);
      console.log(`📢 Broadcasted profile update to room ${room}`);

    } catch (error) {
      console.error(`⚠️ Error broadcasting profile update for user ${userId}:`, error);
      // Don't throw - broadcast failure shouldn't fail the webhook
    }
  }
}

module.exports = WebhookCustomerService;
