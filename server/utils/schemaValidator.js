/**
 * Schema Validation Utility
 * Validates that database schema matches Drizzle schema definitions
 * Used during startup to detect schema drift and prevent runtime errors
 */

const Sentry = require('@sentry/node');

/**
 * Get all columns for a table from the database
 * @param {Object} pool - Neon connection pool
 * @param {string} tableName - Name of the table
 * @returns {Promise<string[]>} - Array of column names
 */
async function getDatabaseColumns(pool, tableName) {
  try {
    const result = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
      [tableName]
    );
    
    return result.rows.map(row => row.column_name);
  } catch (error) {
    console.warn(`⚠️ Could not fetch columns for table ${tableName}:`, error.message);
    return [];
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
  const dbColumns = await getDatabaseColumns(pool, tableName);
  const schemaColumns = getSchemaColumns(tableSchema);
  
  // Find columns that are in schema but not in database
  const missingInDb = schemaColumns.filter(col => !dbColumns.includes(col));
  
  // Find columns that are in database but not in schema (might be legacy)
  const extraInDb = dbColumns.filter(col => !schemaColumns.includes(col));
  
  const isValid = missingInDb.length === 0 && extraInDb.length === 0;
  
  return {
    tableName,
    isValid,
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
    critical: [],
    warnings: []
  };
  
  for (const { name, schema: tableSchema } of criticalTables) {
    try {
      const validation = await validateTable(pool, name, tableSchema);
      results.tables[name] = validation;
      
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
      console.warn(`⚠️ Could not validate table ${name}:`, error.message);
      results.hasIssues = true;
      results.warnings.push(`Failed to validate table '${name}': ${error.message}`);
    }
  }
  
  if (!results.hasIssues) {
    console.log('✅ Database schema validation passed - all tables match Drizzle definitions');
  } else {
    console.warn('⚠️ Database schema validation found issues (see above)');
    console.warn('   Server will continue running, but some features may fail');
    console.warn('   Fix by running: npm run db:push');
    
    // Log to Sentry for monitoring
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
 * @param {Object} pool - Neon connection pool
 * @param {Object} schema - Drizzle schema object with all tables
 */
async function validateSchemaAsync(pool, schema) {
  try {
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
