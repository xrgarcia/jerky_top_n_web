const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require("ws");
const schema = require("../shared/schema.js");

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Convert DATABASE_URL to use Neon's connection pooler for better concurrency handling
// Works for all Neon regions by inserting '-pooler' after the hostname
function convertToPoolerURL(url) {
  if (url.includes('-pooler.')) {
    return url; // Already using pooler
  }
  
  // Match pattern: <credentials>@<hostname>.<rest-of-domain>
  // Convert to: <credentials>@<hostname>-pooler.<rest-of-domain>
  // Handles both formats:
  //   - ep-young-morning-afbl282n.us-west-2.aws.neon.tech
  //   - ep-young-morning-afbl282n.c-2.us-west-2.aws.neon.tech
  const match = url.match(/(.*?@)([^.]+)(\..*)/);
  if (match) {
    const converted = `${match[1]}${match[2]}-pooler${match[3]}`;
    console.log(`✅ Converted to pooler URL: ${match[2]}-pooler${match[3].split('/')[0]}`);
    return converted;
  }
  
  // Fallback: return original if pattern doesn't match
  console.warn('⚠️ Could not convert to pooler URL, using original connection string');
  return url;
}

const connectionString = convertToPoolerURL(process.env.DATABASE_URL);

// Configure pool for high concurrency (1K-5K users)
const pool = new Pool({ 
  connectionString,
  max: 20, // Maximum 20 concurrent connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout if connection takes >10s
  keepAlive: true, // Enable TCP keepalive to prevent idle disconnects
  keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s
});

// Add pool error handling to prevent uncaught exceptions
pool.on('error', (err) => {
  // Handle expected network errors gracefully
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    console.warn('⚠️ Database connection issue (will retry):', {
      code: err.code,
      message: err.message,
      timestamp: new Date().toISOString()
    });
    // Don't log to Sentry for expected network hiccups
    return;
  }
  
  // Log unexpected errors with full details
  console.error('❌ Unexpected database pool error:', {
    message: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });
  
  // Log to Sentry if available (only for unexpected errors)
  if (typeof Sentry !== 'undefined' && Sentry.captureException) {
    Sentry.captureException(err, {
      tags: { service: 'database_pool' },
      contexts: {
        database: {
          pool_size: pool.totalCount,
          idle_count: pool.idleCount,
          waiting_count: pool.waitingCount
        }
      }
    });
  }
});

// Add connection monitoring
pool.on('connect', (client) => {
  console.log('🔌 Database client connected to pool', {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount
  });
  
  // Add error handler to individual clients
  client.on('error', (err) => {
    // Handle expected network errors gracefully
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.warn('⚠️ Database client connection issue (will reconnect):', {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Log unexpected errors
    console.error('❌ Database client error:', {
      message: err.message,
      code: err.code,
      name: err.name,
      timestamp: new Date().toISOString()
    });
  });
});

pool.on('remove', () => {
  console.log('🔌 Database client removed from pool', {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount
  });
});

/**
 * Retry wrapper for database queries to handle transient network errors
 * Automatically retries ECONNRESET, ETIMEDOUT, and ECONNREFUSED with exponential backoff
 * 
 * @param {Function} queryFn - Async function that performs the database query
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise} Result of the query
 */
async function queryWithRetry(queryFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (err) {
      const isRetryable = err.code === 'ECONNRESET' || 
                          err.code === 'ETIMEDOUT' || 
                          err.code === 'ECONNREFUSED';
      
      if (isRetryable && attempt < maxRetries) {
        const delayMs = 100 * Math.pow(2, attempt - 1); // Exponential backoff: 100ms, 200ms, 400ms
        console.warn(`⚠️ Database query failed (${err.code}), retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Non-retryable error or max retries exceeded
      throw err;
    }
  }
}

// Wrap pool.query with automatic retry logic
const originalPoolQuery = pool.query.bind(pool);
pool.query = async function(...args) {
  return await queryWithRetry(() => originalPoolQuery(...args));
};

const db = drizzle({ client: pool, schema });

console.log('💾 Database connection pool configured with pooler endpoint (with auto-retry)');

/**
 * Create a dedicated database pool for webhook workers
 * This prevents webhook processing from exhausting the shared connection pool
 * Used for: WebhookOrderService, WebhookProductService, WebhookCustomerService
 */
function createWebhookPool() {
  const webhookPool = new Pool({ 
    connectionString,
    max: 5, // Dedicated 5 connections for webhook processing
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true, // Enable TCP keepalive
    keepAliveInitialDelayMillis: 10000,
  });

  // Add pool error handling
  webhookPool.on('error', (err) => {
    // Handle expected network errors gracefully
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.warn('⚠️ Webhook pool connection issue (will retry):', {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    console.error('❌ Webhook pool error:', {
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
  });

  webhookPool.on('connect', () => {
    console.log('🔌 Webhook pool client connected', {
      totalConnections: webhookPool.totalCount,
      idleConnections: webhookPool.idleCount,
      waitingRequests: webhookPool.waitingCount
    });
  });

  webhookPool.on('remove', () => {
    console.log('🔌 Webhook pool client removed', {
      totalConnections: webhookPool.totalCount,
      idleConnections: webhookPool.idleCount
    });
  });

  // Wrap webhook pool query with automatic retry logic
  const originalWebhookQuery = webhookPool.query.bind(webhookPool);
  webhookPool.query = async function(...args) {
    return await queryWithRetry(() => originalWebhookQuery(...args));
  };

  const webhookDb = drizzle({ client: webhookPool, schema });
  
  console.log('💾 Dedicated webhook pool created (5 connections, with auto-retry)');
  
  return { webhookPool, webhookDb };
}

/**
 * Create a dedicated database pool for BullMQ background workers
 * This prevents worker jobs from exhausting the shared connection pool
 * Used for: ClassificationWorker, BulkImportWorker, EngagementBackfillWorker
 */
function createWorkerPool() {
  const workerPool = new Pool({ 
    connectionString,
    max: 10, // Dedicated 10 connections for BullMQ workers (concurrency: 5 × 2 for overhead)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true, // Enable TCP keepalive
    keepAliveInitialDelayMillis: 10000,
  });

  // Add pool error handling
  workerPool.on('error', (err) => {
    // Handle expected network errors gracefully
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.warn('⚠️ Worker pool connection issue (will retry):', {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    console.error('❌ Worker pool error:', {
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
  });

  workerPool.on('connect', () => {
    console.log('🔌 Worker pool client connected', {
      totalConnections: workerPool.totalCount,
      idleConnections: workerPool.idleCount,
      waitingRequests: workerPool.waitingCount
    });
  });

  workerPool.on('remove', () => {
    console.log('🔌 Worker pool client removed', {
      totalConnections: workerPool.totalCount,
      idleConnections: workerPool.idleCount
    });
  });

  // Wrap worker pool query with automatic retry logic
  const originalWorkerQuery = workerPool.query.bind(workerPool);
  workerPool.query = async function(...args) {
    return await queryWithRetry(() => originalWorkerQuery(...args));
  };

  const workerDb = drizzle({ client: workerPool, schema });
  
  console.log('💾 Dedicated worker pool created (10 connections, with auto-retry)');
  
  return { workerPool, workerDb };
}

module.exports = { pool, db, createWebhookPool, createWorkerPool, queryWithRetry };