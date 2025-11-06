const { primaryDb } = require('../db-primary');
const { users } = require('../../shared/schema');
const { eq, or, isNull, sql, count } = require('drizzle-orm');
const ShopifyCustomersService = require('./ShopifyCustomersService');
const bulkImportQueue = require('./BulkImportQueue');
const Sentry = require('@sentry/node');

/**
 * BulkImportService - Orchestrates bulk import of all Shopify customers and their order history
 * 
 * Workflow:
 * 1. Fetch all customers from Shopify
 * 2. Create/update user records in database
 * 3. Enqueue import jobs for each user
 * 4. Workers process jobs asynchronously (sync orders, trigger classification)
 */
class BulkImportService {
  constructor() {
    this.shopifyCustomersService = new ShopifyCustomersService();
    this.importInProgress = false;
    this.currentImportStats = null;
  }

  /**
   * Check if Shopify API is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.shopifyCustomersService.isAvailable();
  }

  /**
   * Start bulk import of all Shopify customers
   * @param {Object} options - Import options
   * @param {boolean} options.reimportAll - Force reimport of all users (default: false)
   * @param {number} options.maxCustomers - Limit number of customers to import (testing)
   * @returns {Promise<Object>} Import result
   */
  async startBulkImport(options = {}) {
    const { reimportAll = false, maxCustomers = null } = options;

    if (this.importInProgress) {
      return {
        success: false,
        error: 'Import already in progress',
        currentStats: this.currentImportStats
      };
    }

    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Shopify API not configured'
      };
    }

    try {
      this.importInProgress = true;
      this.currentImportStats = {
        startedAt: new Date().toISOString(),
        phase: 'fetching_customers',
        customersFetched: 0,
        usersCreated: 0,
        usersUpdated: 0,
        jobsEnqueued: 0,
        errors: 0
      };

      console.log(`🚀 Starting bulk import (reimportAll: ${reimportAll}, maxCustomers: ${maxCustomers || 'unlimited'})`);

      // Step 1: Fetch all customers from Shopify
      console.log('📥 Fetching all customers from Shopify...');
      const fetchResult = await this.shopifyCustomersService.fetchAllCustomers({
        limit: 250,
        maxPages: maxCustomers ? Math.ceil(maxCustomers / 250) : 1000
      });

      let customers = fetchResult.customers;
      this.currentImportStats.customersFetched = customers.length;

      if (maxCustomers) {
        customers = customers.slice(0, maxCustomers);
      }

      console.log(`✅ Fetched ${customers.length} customers from Shopify`);

      // Step 2: Create/update user records in database
      this.currentImportStats.phase = 'creating_users';
      console.log('💾 Creating/updating user records...');

      const usersToImport = [];

      for (const customer of customers) {
        try {
          const result = await this.createOrUpdateUser(customer, reimportAll);
          
          if (result.created) {
            this.currentImportStats.usersCreated++;
          } else if (result.updated) {
            this.currentImportStats.usersUpdated++;
          }

          if (result.shouldImport) {
            usersToImport.push({
              userId: result.userId,
              shopifyCustomerId: customer.id.toString(),
              email: customer.email
            });
          }
        } catch (error) {
          console.error(`❌ Error creating/updating user for customer ${customer.id}:`, error);
          this.currentImportStats.errors++;
          
          Sentry.captureException(error, {
            tags: { service: 'bulk-import', phase: 'create_user' },
            extra: { customerId: customer.id, email: customer.email }
          });
        }
      }

      console.log(`✅ Created ${this.currentImportStats.usersCreated} users, updated ${this.currentImportStats.usersUpdated} users`);

      // Step 3: Enqueue import jobs
      this.currentImportStats.phase = 'enqueuing_jobs';
      console.log(`📋 Enqueuing ${usersToImport.length} import jobs...`);

      const enqueueResult = await bulkImportQueue.enqueueBulk(usersToImport);
      this.currentImportStats.jobsEnqueued = enqueueResult.enqueued;
      this.currentImportStats.errors += enqueueResult.failed;

      console.log(`✅ Enqueued ${enqueueResult.enqueued} import jobs`);

      // Step 4: Mark as complete
      this.currentImportStats.phase = 'completed';
      this.currentImportStats.completedAt = new Date().toISOString();

      const finalStats = {
        success: true,
        ...this.currentImportStats
      };

      this.importInProgress = false;
      return finalStats;

    } catch (error) {
      console.error('❌ Bulk import failed:', error);
      
      Sentry.captureException(error, {
        tags: { service: 'bulk-import' }
      });

      this.importInProgress = false;
      this.currentImportStats = null;

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create or update user record from Shopify customer
   * @param {Object} customer - Shopify customer object
   * @param {boolean} reimportAll - Force reimport even if already imported
   * @returns {Promise<Object>} { userId, created, updated, shouldImport }
   */
  async createOrUpdateUser(customer, reimportAll = false) {
    const shopifyCustomerId = customer.id.toString();
    const email = customer.email || `${shopifyCustomerId}@placeholder.jerky.com`;

    try {
      // Check if user exists
      const [existingUser] = await primaryDb
        .select()
        .from(users)
        .where(eq(users.shopifyCustomerId, shopifyCustomerId))
        .limit(1);

      if (existingUser) {
        // User exists - update if needed
        const needsUpdate = 
          email !== existingUser.email ||
          customer.first_name !== existingUser.firstName ||
          customer.last_name !== existingUser.lastName;

        if (needsUpdate) {
          await primaryDb
            .update(users)
            .set({
              email,
              firstName: customer.first_name,
              lastName: customer.last_name,
              updatedAt: new Date()
            })
            .where(eq(users.id, existingUser.id));
        }

        // Determine if should import
        const shouldImport = reimportAll || !existingUser.fullHistoryImported;

        // Reset import status if reimporting
        if (shouldImport && existingUser.fullHistoryImported) {
          await primaryDb
            .update(users)
            .set({
              importStatus: 'pending',
              updatedAt: new Date()
            })
            .where(eq(users.id, existingUser.id));
        }

        return {
          userId: existingUser.id,
          created: false,
          updated: needsUpdate,
          shouldImport
        };
      } else {
        // User doesn't exist - create new
        const [newUser] = await primaryDb
          .insert(users)
          .values({
            shopifyCustomerId,
            email,
            firstName: customer.first_name,
            lastName: customer.last_name,
            displayName: customer.first_name || email.split('@')[0],
            role: 'user',
            active: false,
            importStatus: 'pending',
            fullHistoryImported: false,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        return {
          userId: newUser.id,
          created: true,
          updated: false,
          shouldImport: true
        };
      }
    } catch (error) {
      console.error(`❌ Error in createOrUpdateUser for ${shopifyCustomerId}:`, error);
      throw error;
    }
  }

  /**
   * Get bulk import progress
   * @returns {Promise<Object>} Progress stats
   */
  async getProgress() {
    try {
      const queueStats = await bulkImportQueue.getStats();
      
      // Get user counts from database
      const [totalUsers] = await primaryDb
        .select({ count: count() })
        .from(users);

      const [importedUsers] = await primaryDb
        .select({ count: count() })
        .from(users)
        .where(eq(users.fullHistoryImported, true));

      const [pendingUsers] = await primaryDb
        .select({ count: count() })
        .from(users)
        .where(or(
          eq(users.importStatus, 'pending'),
          isNull(users.importStatus)
        ));

      const [inProgressUsers] = await primaryDb
        .select({ count: count() })
        .from(users)
        .where(eq(users.importStatus, 'in_progress'));

      const [failedUsers] = await primaryDb
        .select({ count: count() })
        .from(users)
        .where(eq(users.importStatus, 'failed'));

      return {
        importInProgress: this.importInProgress,
        currentImportStats: this.currentImportStats,
        queue: queueStats,
        users: {
          total: Number(totalUsers?.count || 0),
          imported: Number(importedUsers?.count || 0),
          pending: Number(pendingUsers?.count || 0),
          inProgress: Number(inProgressUsers?.count || 0),
          failed: Number(failedUsers?.count || 0)
        }
      };
    } catch (error) {
      console.error('❌ Error getting import progress:', error);
      return { error: error.message };
    }
  }

  /**
   * Get users who haven't had their history imported
   * @param {number} limit - Max number of users to return
   * @returns {Promise<Array>} Users without full history
   */
  async getUsersWithoutHistory(limit = 100) {
    try {
      const usersWithoutHistory = await primaryDb
        .select({
          id: users.id,
          email: users.email,
          shopifyCustomerId: users.shopifyCustomerId,
          importStatus: users.importStatus,
          createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.fullHistoryImported, false))
        .limit(limit);

      return usersWithoutHistory;
    } catch (error) {
      console.error('❌ Error getting users without history:', error);
      return [];
    }
  }
}

// Singleton instance
const bulkImportService = new BulkImportService();

module.exports = bulkImportService;
