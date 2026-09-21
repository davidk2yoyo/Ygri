-- ============================================================
-- QUOTATION ITEM PRICE TIERS (per-quotation volume pricing)
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS quotation_item_price_tiers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_item_id uuid NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  min_qty integer NOT NULL DEFAULT 1,
  max_qty integer,
  price numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quotation_item_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_quotation_item_price_tiers" ON quotation_item_price_tiers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_quotation_item_price_tiers_item_id
  ON quotation_item_price_tiers(quotation_item_id);
