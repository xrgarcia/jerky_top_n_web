-- Migration: Add shopify_created_at column to users table
-- Created: 2025-11-10
-- Purpose: Capture true jerky.com community membership date from Shopify

ALTER TABLE users ADD COLUMN IF NOT EXISTS shopify_created_at TIMESTAMP;
