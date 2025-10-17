require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);

async function runMigrations() {
  console.log('🔄 Starting database migrations...');

  try {
    // Create migrations tracking table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Get list of executed migrations
    const executedMigrations = await sql`
      SELECT name FROM _migrations ORDER BY executed_at
    `;
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
      
      // Execute migration (Neon serverless doesn't support traditional transactions)
      // Split migration into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          await sql.unsafe(statement);
        }
      }
      
      // Record migration as executed
      await sql`
        INSERT INTO _migrations (name) VALUES (${migrationName})
      `;

      console.log(`✅ Completed: ${migrationName}`);
      executedCount++;
    }

    if (executedCount === 0) {
      console.log('✨ All migrations up to date - nothing to run');
    } else {
      console.log(`\n✅ Successfully executed ${executedCount} migration(s)`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
