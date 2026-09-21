-- ============================================================
-- Add supplier cost per price tier (internal only, mirrors item-level supplier cost)
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE quotation_item_price_tiers ADD COLUMN IF NOT EXISTS supplier_price numeric(12,2);
