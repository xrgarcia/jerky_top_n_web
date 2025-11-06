const { primaryDb } = require('../db-primary');
const { users } = require('../../shared/schema');
const { eq, count } = require('drizzle-orm');
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
   * @param {number} options.targetUnprocessedUsers - Target number of unprocessed users to import (intelligent mode)
   * @param {number} options.maxCustomers - Limit total customers to fetch (deprecated, use targetUnprocessedUsers or batchSize)
   * @param {boolean} options.fullImport - Full import mode: create ALL missing customers from Shopify
   * @param {number} options.batchSize - In full import mode, limit to this many customers (1000, 5000, 10000, etc)
   * @returns {Promise<Object>} Import result
   */
  async startBulkImport(options = {}) {
    const { reimportAll = false, targetUnprocessedUsers = null, maxCustomers = null, fullImport = false, batchSize = null } = options;

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

      const mode = fullImport 
        ? `full import (batch: ${batchSize || 'unlimited'})` 
        : (targetUnprocessedUsers ? `target: ${targetUnprocessedUsers} unprocessed` : (maxCustomers ? `fetch: ${maxCustomers} customers` : 'incremental'));
      console.log(`🚀 Starting bulk import (reimportAll: ${reimportAll}, mode: ${mode})`);

      // Step 1 & 2: Intelligently fetch customers and identify unprocessed users
      const usersToImport = await this.fetchUnprocessedUsers({
        reimportAll,
        targetUnprocessedUsers,
        maxCustomers,
        fullImport,
        batchSize
      });

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
   * Intelligently fetch unprocessed users by paginating through Shopify customers
   * @param {Object} options - Fetch options
   * @param {boolean} options.reimportAll - Force reimport even if already imported
   * @param {number} options.targetUnprocessedUsers - Target number of unprocessed users to find
   * @param {number} options.maxCustomers - Maximum total customers to fetch (legacy)
   * @param {boolean} options.fullImport - Full import mode: create ALL customers and enqueue ALL jobs
   * @param {number} options.batchSize - In full import mode, limit to this many customers
   * @returns {Promise<Array>} Array of users to import
   */
  async fetchUnprocessedUsers(options = {}) {
    const { reimportAll = false, targetUnprocessedUsers = null, maxCustomers = null, fullImport = false, batchSize = null } = options;
    
    console.log(`🔧 Import mode: fullImport=${fullImport}, reimportAll=${reimportAll}, batchSize=${batchSize || 'unlimited'}`);
    
    const usersToImport = [];
    let totalCustomersFetched = 0;
    let nextPageUrl = null; // Use Link header pagination instead of since_id
    const pageSize = 250;
    
    // Determine fetch strategy
    const useIntelligentMode = targetUnprocessedUsers !== null && !fullImport;
    const useFullImportMode = fullImport;
    const customerLimit = fullImport ? batchSize : maxCustomers;
    const maxPages = customerLimit ? Math.ceil(customerLimit / pageSize) : 10000; // Increased safety limit
    
    const modeDesc = useFullImportMode 
      ? `full import (limit: ${customerLimit || 'unlimited'} customers)` 
      : (useIntelligentMode ? `intelligent: target ${targetUnprocessedUsers} unprocessed` : `legacy: max ${maxCustomers || 'unlimited'} customers`);
    
    console.log(`📥 Fetching customers from Shopify (${modeDesc})...`);
    
    this.currentImportStats.phase = 'fetching_customers';
    
    // Keep fetching batches until we reach our limit or run out
    let currentPage = 0;
    let hasMore = true;
    
    while (hasMore && currentPage < maxPages) {
      currentPage++;
      
      // Fetch one batch of customers using proper cursor pagination
      const batchResult = await this.shopifyCustomersService.fetchCustomerBatch({
        pageUrl: nextPageUrl,
        limit: pageSize
      });
      
      if (!batchResult.customers || batchResult.customers.length === 0) {
        console.log(`📭 No more customers to fetch (reached end at page ${currentPage})`);
        break;
      }
      
      const customers = batchResult.customers;
      
      console.log(`📄 Fetched page ${currentPage}: ${customers.length} customers`);
      
      // Process each customer on this page
      this.currentImportStats.phase = 'processing_customers';
      for (const customer of customers) {
        // Check if we've hit our customer limit
        if (customerLimit && totalCustomersFetched >= customerLimit) {
          console.log(`🛑 Reached customer limit (${customerLimit})`);
          hasMore = false;
          break;
        }
        
        totalCustomersFetched++;
        this.currentImportStats.customersFetched = totalCustomersFetched;
        
        try {
          const result = await this.createOrUpdateUser(customer, reimportAll, fullImport);
          
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
            
            // In intelligent mode (not full import), stop when we've found enough unprocessed users
            if (useIntelligentMode && usersToImport.length >= targetUnprocessedUsers) {
              console.log(`✅ Found ${usersToImport.length} unprocessed users (target: ${targetUnprocessedUsers}) after checking ${totalCustomersFetched} customers across ${currentPage} pages`);
              return usersToImport;
            }
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
      
      // Update cursor for next batch (use Link header URL)
      nextPageUrl = batchResult.nextPageUrl;
      hasMore = batchResult.hasMore;
      
      if (!hasMore) {
        console.log(`📭 No more pages available (processed ${currentPage} pages)`);
        break;
      }
      
      // Status update
      if (totalCustomersFetched % 1000 === 0) {
        console.log(`📊 Progress: ${totalCustomersFetched} customers processed, ${usersToImport.length} to import`);
      }
    }
    
    console.log(`✅ Fetched ${totalCustomersFetched} total customers across ${currentPage} pages, identified ${usersToImport.length} users to import (created: ${this.currentImportStats.usersCreated}, updated: ${this.currentImportStats.usersUpdated})`);
    return usersToImport;
  }

  /**
   * Create or update user record from Shopify customer
   * @param {Object} customer - Shopify customer object
   * @param {boolean} reimportAll - Force reimport even if already imported
   * @returns {Promise<Object>} { userId, created, updated, shouldImport }
   */
  async createOrUpdateUser(customer, reimportAll = false, fullImport = false) {
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
        // In Full Import Mode: enqueue ALL users
        // In Reimport Mode: enqueue ALL users
        // Otherwise: only enqueue users who haven't been fully imported yet
        const shouldImport = fullImport || reimportAll || !existingUser.fullHistoryImported;

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
   * Get Shopify stats vs database stats
   * @returns {Promise<Object>} Shopify and database statistics
   */
  async getShopifyStats() {
    try {
      // Get Shopify customer count
      const shopifyCustomerCount = await this.shopifyCustomersService.getCustomerCount();
      
      // Get database user counts
      const [totalUsers] = await primaryDb
        .select({ count: count() })
        .from(users);

      const [importedUsers] = await primaryDb
        .select({ count: count() })
        .from(users)
        .where(eq(users.fullHistoryImported, true));

      const dbTotal = Number(totalUsers?.count || 0);
      const dbImported = Number(importedUsers?.count || 0);
      const dbMissing = Math.max(0, shopifyCustomerCount - dbTotal);

      return {
        shopify: {
          totalCustomers: shopifyCustomerCount
        },
        database: {
          totalUsers: dbTotal,
          fullyImported: dbImported,
          pending: dbTotal - dbImported
        },
        gap: {
          missingUsers: dbMissing,
          percentageInDb: shopifyCustomerCount > 0 ? ((dbTotal / shopifyCustomerCount) * 100).toFixed(1) : 0
        }
      };
    } catch (error) {
      console.error('❌ Error getting Shopify stats:', error);
      Sentry.captureException(error, {
        tags: { service: 'bulk-import' }
      });
      return { error: error.message };
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
        .where(eq(users.importStatus, 'pending'));

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
