-- Migration: Add force_rankable column to products_metadata table
-- Created: 2025-11-14
-- Description: Adds a boolean column to allow admin override for product rankability during beta testing.
--              When force_rankable is true, the product is rankable for all users regardless of purchase history.
--              Default is false (null), meaning normal purchase-based filtering applies.
-- Purpose: Enable feature flag system for beta product testing

-- Add force_rankable column (idempotent - only adds if doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products_metadata' 
    AND column_name = 'force_rankable'
  ) THEN
    ALTER TABLE products_metadata 
    ADD COLUMN force_rankable BOOLEAN DEFAULT FALSE;
    
    RAISE NOTICE 'Added force_rankable column to products_metadata table';
  ELSE
    RAISE NOTICE 'force_rankable column already exists in products_metadata table';
  END IF;
END $$;

-- Create index for efficient filtering (idempotent)
CREATE INDEX IF NOT EXISTS idx_products_metadata_force_rankable 
ON products_metadata(force_rankable) 
WHERE force_rankable = TRUE;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 006 completed: force_rankable column added to products_metadata';
END $$;
