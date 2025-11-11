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
      
      console.log(`📥 Shopify customer data received:`, {
        id: customerData.id,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        email: customerData.email
      });
      
      // Find user by Shopify customer ID first, then by email
      let user = null;
      
      const [userByShopifyId] = await this.db
        .select()
        .from(users)
        .where(eq(users.shopifyCustomerId, shopifyCustomerId))
        .limit(1);
      
      if (userByShopifyId) {
        user = userByShopifyId;
      } else if (customerData.email) {
        // Try to find by email in case user was created through different flow
        const [userByEmail] = await this.db
          .select()
          .from(users)
          .where(eq(users.email, customerData.email))
          .limit(1);
        
        if (userByEmail) {
          console.log(`✅ Found user by email ${customerData.email}, linking Shopify ID ${shopifyCustomerId}`);
          // Link the Shopify customer ID to this existing user
          await this.db
            .update(users)
            .set({ 
              shopifyCustomerId,
              updatedAt: new Date()
            })
            .where(eq(users.id, userByEmail.id));
          
          user = { ...userByEmail, shopifyCustomerId };
        }
      }
      
      if (!user) {
        console.log(`👤 Customer ${shopifyCustomerId} not found in database - creating new user`);
        
        // Parse Shopify created_at timestamp
        const shopifyCreatedAt = customerData.created_at ? new Date(customerData.created_at) : null;
        
        // Create new user record
        const email = customerData.email || `${shopifyCustomerId}@placeholder.jerky.com`;
        const firstName = customerData.first_name || null;
        const lastName = customerData.last_name || null;
        const displayName = firstName && lastName 
          ? `${firstName} ${lastName}`.trim()
          : firstName || email.split('@')[0];
        
        try {
          const [newUser] = await this.db
            .insert(users)
            .values({
              shopifyCustomerId,
              email,
              firstName,
              lastName,
              displayName,
              role: 'user',
              active: false, // Not active until they log in
              importStatus: 'pending',
              fullHistoryImported: false,
              shopifyCreatedAt,
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .returning({ id: users.id });
          
          console.log(`✅ Created new user ${newUser.id} for Shopify customer ${shopifyCustomerId}`);
          
          // Broadcast to admin room
          this.broadcastAdminUpdate({
            data: {
              topic: topic,
              type: 'customers',
              data: {
                id: customerData.id,
                email: email,
                first_name: firstName,
                last_name: lastName
              }
            },
            action: 'created',
            userId: newUser.id,
            shopifyCustomerId
          });
          
          return {
            success: true,
            action: 'created',
            userId: newUser.id,
            shopifyCustomerId,
            email
          };
        } catch (createError) {
          console.error(`❌ Failed to create user for Shopify customer ${shopifyCustomerId}:`, createError);
          
          // If it's a duplicate key error, try to find the user again (race condition)
          if (createError.code === '23505') { // PostgreSQL unique violation
            console.log(`🔄 Duplicate key detected, refetching user ${shopifyCustomerId}`);
            
            // Try by Shopify ID first
            let existingUser = await this.db
              .select()
              .from(users)
              .where(eq(users.shopifyCustomerId, shopifyCustomerId))
              .limit(1)
              .then(results => results[0]);
            
            // If not found by Shopify ID, try by email
            if (!existingUser && email && !email.includes('@placeholder.jerky.com')) {
              existingUser = await this.db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1)
                .then(results => results[0]);
              
              if (existingUser) {
                console.log(`✅ Found user by email, linking Shopify ID ${shopifyCustomerId}`);
                // Link the Shopify customer ID
                await this.db
                  .update(users)
                  .set({ 
                    shopifyCustomerId,
                    updatedAt: new Date()
                  })
                  .where(eq(users.id, existingUser.id));
                
                user = { ...existingUser, shopifyCustomerId };
              }
            }
            
            if (existingUser && !user) {
              console.log(`✅ Found existing user ${existingUser.id} after race condition`);
              user = existingUser;
            }
            
            if (!user) {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      }
      
      // If we created the user and returned early, we're done
      if (!user) {
        return;
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
        
        // Broadcast to admin room
        this.broadcastAdminUpdate({
          data: {
            topic: topic,
            type: 'customers',
            data: {
              id: customerData.id,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName
            }
          },
          action: 'no_changes',
          userId: user.id,
          shopifyCustomerId
        });
        
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
      
      // Broadcast to admin room
      this.broadcastAdminUpdate({
        data: {
          topic: topic,
          type: 'customers',
          data: {
            id: customerData.id,
            email: updateData.email,
            first_name: updateData.firstName,
            last_name: updateData.lastName
          }
        },
        action: 'updated',
        userId: user.id,
        shopifyCustomerId,
        changes: {
          firstName: updateData.firstName !== user.firstName,
          lastName: updateData.lastName !== user.lastName,
          email: updateData.email !== user.email,
          shopifyCreatedAt: shopifyCreatedAt && user.shopifyCreatedAt?.getTime() !== shopifyCreatedAt.getTime()
        }
      });

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
    if (!this.wsGateway || !this.wsGateway.io) {
      return;
    }

    try {
      const roomName = this.wsGateway.room(`user:${userId}`);
      const updatePayload = {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        displayName: updateData.displayName,
        email: updateData.email,
        shopifyCreatedAt: updateData.shopifyCreatedAt,
        timestamp: new Date().toISOString()
      };

      this.wsGateway.io.to(roomName).emit('profile:updated', updatePayload);
      console.log(`📢 Broadcasted profile update to room ${roomName}`);

    } catch (error) {
      console.error(`⚠️ Error broadcasting profile update for user ${userId}:`, error);
      // Don't throw - broadcast failure shouldn't fail the webhook
    }
  }

  /**
   * Broadcast customer webhook update to admin room
   * @param {Object} data - Webhook update data
   */
  broadcastAdminUpdate(data) {
    if (!this.wsGateway || !this.wsGateway.broadcastCustomerWebhookUpdate) {
      return;
    }

    try {
      this.wsGateway.broadcastCustomerWebhookUpdate(data);
    } catch (error) {
      console.error(`⚠️ Error broadcasting admin update:`, error);
      // Don't throw - broadcast failure shouldn't fail the webhook
    }
  }
}

module.exports = WebhookCustomerService;
