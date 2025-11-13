-- Migration: Add missing id column to products_metadata table
-- Created: 2025-11-13
-- Description: Fixes schema mismatch where production database is missing the id serial primary key
--              that is defined in Drizzle schema. This migration safely adds the column and preserves
--              all existing data by properly backfilling id values before setting constraints.
-- Issue: JERKY-RANK-UI-2T - Query failures due to missing id column in products_metadata

-- Step 1: Check if id column already exists (idempotent)
DO $$
DECLARE
  existing_pk_name TEXT;
  row_count INTEGER;
BEGIN
  -- Only proceed if id column doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products_metadata' 
    AND column_name = 'id'
  ) THEN
    
    RAISE NOTICE 'Adding id column to products_metadata table...';
    
    -- Get current row count for logging
    SELECT COUNT(*) INTO row_count FROM products_metadata;
    RAISE NOTICE 'Current table has % rows that will be backfilled', row_count;
    
    -- Step 2: Create the sequence for id column
    CREATE SEQUENCE IF NOT EXISTS products_metadata_id_seq;
    
    -- Step 3: Add id column as integer (nullable initially for backfill)
    ALTER TABLE products_metadata 
    ADD COLUMN id INTEGER;
    
    -- Step 4: Backfill existing rows with auto-incrementing values
    RAISE NOTICE 'Backfilling id values for existing rows...';
    UPDATE products_metadata 
    SET id = nextval('products_metadata_id_seq');
    
    -- Step 5: Set the sequence to continue from current max
    PERFORM setval('products_metadata_id_seq', 
                   COALESCE((SELECT MAX(id) FROM products_metadata), 0) + 1, 
                   false);
    
    -- Step 6: Set default for future inserts
    ALTER TABLE products_metadata 
    ALTER COLUMN id SET DEFAULT nextval('products_metadata_id_seq');
    
    -- Step 7: Make id NOT NULL (safe now that all rows have values)
    ALTER TABLE products_metadata 
    ALTER COLUMN id SET NOT NULL;
    
    -- Step 8: Drop existing primary key constraint if it exists
    SELECT constraint_name INTO existing_pk_name
    FROM information_schema.table_constraints 
    WHERE table_name = 'products_metadata' 
      AND constraint_type = 'PRIMARY KEY';
    
    IF existing_pk_name IS NOT NULL THEN
      RAISE NOTICE 'Dropping existing primary key constraint: %', existing_pk_name;
      EXECUTE format('ALTER TABLE products_metadata DROP CONSTRAINT %I', existing_pk_name);
    END IF;
    
    -- Step 9: Set id as the primary key
    RAISE NOTICE 'Setting id as primary key...';
    ALTER TABLE products_metadata 
    ADD PRIMARY KEY (id);
    
    -- Step 10: Ensure shopify_product_id has unique constraint
    -- Check if constraint exists via pg_constraint (more reliable than index names)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'products_metadata'::regclass
        AND contype = 'u' -- unique constraint
        AND conkey = ARRAY[(SELECT attnum FROM pg_attribute 
                           WHERE attrelid = 'products_metadata'::regclass 
                           AND attname = 'shopify_product_id')]
    ) THEN
      RAISE NOTICE 'Adding unique constraint to shopify_product_id...';
      ALTER TABLE products_metadata 
      ADD CONSTRAINT products_metadata_shopify_product_id_unique 
      UNIQUE (shopify_product_id);
    ELSE
      RAISE NOTICE 'shopify_product_id unique constraint already exists';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully: id column added and % rows backfilled', row_count;
  ELSE
    RAISE NOTICE 'Migration skipped: id column already exists in products_metadata';
  END IF;
END $$;

-- Verification: Confirm the schema matches expectations
DO $$
DECLARE
  id_exists BOOLEAN;
  id_is_pk BOOLEAN;
  shopify_id_unique BOOLEAN;
  row_count INTEGER;
BEGIN
  -- Check id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products_metadata' AND column_name = 'id'
  ) INTO id_exists;
  
  -- Check id is primary key
  SELECT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc 
      ON kcu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'products_metadata' 
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name = 'id'
  ) INTO id_is_pk;
  
  -- Check shopify_product_id is unique
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products_metadata'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%shopify_product_id%'
  ) INTO shopify_id_unique;
  
  -- Get row count
  SELECT COUNT(*) INTO row_count FROM products_metadata;
  
  -- Verify everything is correct
  IF NOT id_exists THEN
    RAISE EXCEPTION 'Verification failed: id column does not exist';
  END IF;
  
  IF NOT id_is_pk THEN
    RAISE EXCEPTION 'Verification failed: id is not the primary key';
  END IF;
  
  IF NOT shopify_id_unique THEN
    RAISE WARNING 'shopify_product_id unique constraint may be missing or named differently';
  END IF;
  
  RAISE NOTICE 'Verification successful: products_metadata schema is correct';
  RAISE NOTICE 'Total rows in products_metadata: %', row_count;
  RAISE NOTICE 'All rows have auto-generated id values';
END $$;
