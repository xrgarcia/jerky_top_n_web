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
  connectionTimeoutMillis: 5000, // Timeout if connection takes >5s
});

// Add pool error handling to prevent uncaught exceptions
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  
  // Log to Sentry if available
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
    console.error('❌ Database client error:', {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    // Also log the full error as JSON to capture all properties
    console.error('Full client error details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  });
});

pool.on('remove', () => {
  console.log('🔌 Database client removed from pool', {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount
  });
});

const db = drizzle({ client: pool, schema });

console.log('💾 Database connection pool configured with pooler endpoint');

module.exports = { pool, db };