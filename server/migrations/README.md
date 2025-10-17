# Database Migrations

This directory contains SQL migrations for database schema changes and optimizations that aren't handled by Drizzle's schema sync.

## Migration System

- **Tracking**: Migrations are tracked in the `_migrations` table
- **Format**: Files use numeric prefixes (e.g., `001_`, `002_`) to ensure execution order
- **Idempotent**: Each migration checks if it's already been executed before running

## Running Migrations

### Development
```bash
npm run db:migrate
```

### Production
Run the same command in your production environment, or use the Replit Database pane to execute the migration SQL directly.

## Creating New Migrations

1. Create a new `.sql` file with the next sequential number:
   ```
   server/migrations/002_your_migration_name.sql
   ```

2. Write your SQL with idempotent checks (use `IF NOT EXISTS`, `IF EXISTS`, etc.):
   ```sql
   -- Migration: Description
   -- Created: YYYY-MM-DD
   
   CREATE INDEX IF NOT EXISTS idx_name ON table_name(column_name);
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

## Existing Migrations

- **001_add_performance_indexes.sql**: Adds indexes on foreign keys and timestamps for leaderboard query optimization (reduces getUserPosition from 4s to <300ms)

## Migration vs Schema Push

- **`npm run db:push`**: Use for Drizzle schema changes (tables, columns defined in `shared/schema.js`)
- **`npm run db:migrate`**: Use for custom SQL (indexes, constraints, functions, views)

Both systems work together - schema push for structure, migrations for optimizations.
