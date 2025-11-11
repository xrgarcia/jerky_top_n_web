/**
 * Schema Validation Utility
 * Validates that database schema matches Drizzle schema definitions
 * Used during startup to detect schema drift and prevent runtime errors
 */

const Sentry = require('@sentry/node');

/**
 * Sleep utility for delaying execution
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is a network/DNS error (not a real schema issue)
 * @param {Error} error - Error object
 * @returns {boolean} - True if network/DNS error
 */
function isNetworkError(error) {
  const networkErrorCodes = [
    'ENOTFOUND',         // DNS lookup failed
    'EAI_AGAIN',         // DNS temporary failure
    'ECONNREFUSED',      // Connection refused
    'ECONNRESET',        // Connection reset
    'EPIPE',             // Broken pipe
    'ETIMEDOUT',         // Connection timeout
    'ESOCKETTIMEDOUT',   // Socket timeout
    'EHOSTUNREACH',      // Host unreachable
    'ENETUNREACH'        // Network unreachable
  ];
  
  return networkErrorCodes.some(code => 
    error.message?.includes(code) || error.code === code
  );
}

/**
 * Get all columns for a table from the database with retry on network errors
 * @param {Object} pool - Neon connection pool
 * @param {string} tableName - Name of the table
 * @param {number} retryCount - Current retry attempt (0-indexed)
 * @returns {Promise<{columns: string[], networkFailure: boolean}>} - Column names and network failure flag
 */
async function getDatabaseColumns(pool, tableName, retryCount = 0) {
  const MAX_RETRIES = 2;
  const RETRY_DELAYS = [1000, 3000]; // 1s, then 3s
  
  try {
    const result = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
      [tableName]
    );
    
    return { 
      columns: result.rows.map(row => row.column_name),
      networkFailure: false
    };
  } catch (error) {
    // Network/DNS errors should be retried
    if (isNetworkError(error) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount];
      console.info(`ℹ️  Network issue fetching columns for table ${tableName}, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return getDatabaseColumns(pool, tableName, retryCount + 1);
    }
    
    // After all retries or non-network error
    if (isNetworkError(error)) {
      console.info(`ℹ️  Could not fetch columns for table ${tableName} due to network issue: ${error.message}`);
      console.info(`   → Schema validation skipped for this table (server will continue normally)`);
      return { columns: [], networkFailure: true };
    } else {
      // Real database error (not network)
      console.warn(`⚠️ Database error fetching columns for table ${tableName}:`, error.message);
      return { columns: [], networkFailure: false };
    }
  }
}

/**
 * Get expected columns from Drizzle schema
 * @param {Object} tableSchema - Drizzle table schema object
 * @returns {string[]} - Array of database column names from schema
 */
function getSchemaColumns(tableSchema) {
  // Filter for objects that have columnType property (actual column definitions)
  // This distinguishes columns from relations, indexes, and other metadata
  // The .name property contains the actual database column name (snake_case)
  const columns = Object.values(tableSchema).filter(
    col => col && typeof col === 'object' && 'name' in col && 'columnType' in col
  );
  return columns.map(col => col.name);
}

/**
 * Validate a single table's schema
 * @param {Object} pool - Neon connection pool
 * @param {string} tableName - Name of the table
 * @param {Object} tableSchema - Drizzle table schema
 * @returns {Promise<Object>} - Validation result
 */
async function validateTable(pool, tableName, tableSchema) {
  const { columns: dbColumns, networkFailure } = await getDatabaseColumns(pool, tableName);
  const schemaColumns = getSchemaColumns(tableSchema);
  
  // If network failure, mark as inconclusive
  if (networkFailure) {
    return {
      tableName,
      isValid: true, // Don't report as invalid - just inconclusive
      networkFailure: true,
      missingInDb: [],
      extraInDb: [],
      dbColumns,
      schemaColumns
    };
  }
  
  // Find columns that are in schema but not in database
  const missingInDb = schemaColumns.filter(col => !dbColumns.includes(col));
  
  // Find columns that are in database but not in schema (might be legacy)
  const extraInDb = dbColumns.filter(col => !schemaColumns.includes(col));
  
  const isValid = missingInDb.length === 0 && extraInDb.length === 0;
  
  return {
    tableName,
    isValid,
    networkFailure: false,
    missingInDb,
    extraInDb,
    dbColumns,
    schemaColumns
  };
}

/**
 * Validate all critical tables
 * @param {Object} pool - Neon connection pool
 * @param {Object} schema - Drizzle schema object with all tables
 * @returns {Promise<Object>} - Validation results for all tables
 */
async function validateSchema(pool, schema) {
  console.log('🔍 Validating database schema against Drizzle definitions...');
  
  // List of critical tables to validate
  // Only validate tables that are actively used and might cause errors if mismatched
  const criticalTables = [
    { name: 'users', schema: schema.users },
    { name: 'product_rankings', schema: schema.productRankings },
    { name: 'customer_order_items', schema: schema.customerOrderItems },
    { name: 'achievements', schema: schema.achievements }
  ];
  
  const results = {
    timestamp: new Date().toISOString(),
    tables: {},
    hasIssues: false,
    networkIssues: false,
    critical: [],
    warnings: []
  };
  
  for (const { name, schema: tableSchema } of criticalTables) {
    try {
      const validation = await validateTable(pool, name, tableSchema);
      results.tables[name] = validation;
      
      // Track network failures separately
      if (validation.networkFailure) {
        results.networkIssues = true;
        continue; // Skip this table, don't count as schema issue
      }
      
      if (!validation.isValid) {
        results.hasIssues = true;
        
        if (validation.missingInDb.length > 0) {
          const issue = `Table '${name}' is missing columns in database: ${validation.missingInDb.join(', ')}`;
          results.critical.push(issue);
          console.warn(`⚠️ SCHEMA MISMATCH: ${issue}`);
          console.warn(`   → Run 'npm run db:push' to sync the schema`);
        }
        
        if (validation.extraInDb.length > 0) {
          const warning = `Table '${name}' has extra columns in database: ${validation.extraInDb.join(', ')}`;
          results.warnings.push(warning);
          console.warn(`ℹ️ Schema note: ${warning}`);
        }
      }
    } catch (error) {
      // Check if this is a network error
      if (isNetworkError(error)) {
        results.networkIssues = true;
        console.info(`ℹ️  Network issue during validation of table ${name}, skipping...`);
      } else {
        console.warn(`⚠️ Could not validate table ${name}:`, error.message);
        results.hasIssues = true;
        results.warnings.push(`Failed to validate table '${name}': ${error.message}`);
      }
    }
  }
  
  // Determine final status
  if (!results.hasIssues && !results.networkIssues) {
    console.log('✅ Database schema validation passed - all tables match Drizzle definitions');
  } else if (results.networkIssues && !results.hasIssues) {
    // Only network issues - not a schema problem
    console.info('ℹ️  Schema validation incomplete due to network issues during cold start');
    console.info('   → Server will continue normally, validation will retry on next deployment');
    
    // Add Sentry breadcrumb for observability (info level, not warning)
    Sentry.addBreadcrumb({
      category: 'schema_validation',
      message: 'Schema validation skipped due to network issues during cold start',
      level: 'info',
      data: {
        timestamp: results.timestamp,
        networkIssues: true
      }
    });
  } else if (results.hasIssues) {
    // Real schema issues
    console.warn('⚠️ Database schema validation found issues (see above)');
    console.warn('   Server will continue running, but some features may fail');
    console.warn('   Fix by running: npm run db:push');
    
    // Only send to Sentry if there are REAL schema mismatches (not just network issues)
    if (results.critical.length > 0) {
      Sentry.captureMessage('Database schema validation failed', {
        level: 'warning',
        tags: {
          service: 'schema_validation',
          validation_status: 'failed'
        },
        extra: {
          criticalIssues: results.critical,
          warnings: results.warnings,
          timestamp: results.timestamp
        }
      });
    }
  }
  
  return results;
}

/**
 * Run schema validation (async, non-blocking)
 * Safe to call during server startup
 * Includes configurable delay to allow networking/DNS to stabilize during cold starts
 * @param {Object} pool - Neon connection pool
 * @param {Object} schema - Drizzle schema object with all tables
 */
async function validateSchemaAsync(pool, schema) {
  try {
    // Configurable startup delay to allow DNS/networking to stabilize
    // Especially important for cold starts in serverless/container environments
    const delayMs = parseInt(process.env.SCHEMA_VALIDATION_STARTUP_DELAY_MS || '3000', 10);
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    // Skip delay in local development/testing to maintain fast feedback loops
    if (!isDevelopment && delayMs > 0) {
      console.info(`ℹ️  Waiting ${delayMs}ms for networking to stabilize before schema validation...`);
      await sleep(delayMs);
    }
    
    await validateSchema(pool, schema);
  } catch (error) {
    console.error('❌ Schema validation failed with error:', error.message);
    
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        service: 'schema_validation',
        operation: 'validation'
      }
    });
  }
}

module.exports = {
  validateSchema,
  validateSchemaAsync,
  validateTable,
  getDatabaseColumns,
  getSchemaColumns
};
