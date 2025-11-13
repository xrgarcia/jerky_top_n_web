require('dotenv').config();
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  console.log('🔄 Starting database migrations...');

  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM _migrations ORDER BY executed_at'
    );
    const executedNames = new Set(executedMigrations.map(m => m.name));

    // Read migration files from migrations directory
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let executedCount = 0;

    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      
      if (executedNames.has(migrationName)) {
        console.log(`⏭️  Skipping already executed: ${migrationName}`);
        continue;
      }

      console.log(`▶️  Executing migration: ${migrationName}`);
      
      const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Execute the entire migration file in a transaction
      // This properly handles complex PostgreSQL syntax like DO $$ blocks, functions, etc.
      // WebSocket-backed Pool/Client supports multi-statement execution
      try {
        await client.query('BEGIN');
        
        // Execute the entire SQL file (supports multiple statements)
        await client.query(migrationSQL);
        
        // Record migration as executed
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [migrationName]);
        
        await client.query('COMMIT');
        
        console.log(`✅ Completed: ${migrationName}`);
        executedCount++;
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${migrationName} failed:`, migrationError.message);
        throw migrationError;
      }
    }

    if (executedCount === 0) {
      console.log('✨ All migrations up to date - nothing to run');
    } else {
      console.log(`\n✅ Successfully executed ${executedCount} migration(s)`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
