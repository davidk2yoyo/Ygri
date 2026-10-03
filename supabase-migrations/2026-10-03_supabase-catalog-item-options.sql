-- ============================================================
-- CATALOG ITEM OPTIONS (packaging / box / color / logo) + per-quote
-- all-inclusive flag + the snapshot of what was actually chosen.
-- Run this in Supabase SQL Editor
-- ============================================================

-- The menu of choices offered per product
CREATE TABLE IF NOT EXISTS catalog_item_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_item_id uuid NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  option_type text NOT NULL CHECK (option_type IN ('packaging', 'box_type', 'color', 'logo', 'other')),
  label text NOT NULL,
  extra_price numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- A quote line can bundle all its chosen options into one price instead
-- of itemizing them — a per-quote decision, not a product property.
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS all_inclusive boolean NOT NULL DEFAULT false;

-- What was actually chosen on a quote line — snapshotted (type/label/price
-- copied, not just FK'd) so editing/deleting a catalog_item_options row
-- later never rewrites an already-issued quote's history. Mirrors the
-- same convention quotation_items itself already uses against catalog_items.
CREATE TABLE IF NOT EXISTS quotation_item_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_item_id uuid NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  catalog_item_option_id uuid REFERENCES catalog_item_options(id) ON DELETE SET NULL,
  option_type text NOT NULL,
  label text NOT NULL,
  extra_price numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE catalog_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_item_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_catalog_item_options" ON catalog_item_options
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_quotation_item_options" ON quotation_item_options
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS policies alone are NOT enough on this project — Supabase/Postgres also
-- requires explicit table-level GRANTs to `authenticated`, otherwise every
-- query fails with "permission denied for table X" before RLS even runs
-- (see 2026-08-07_fix-quotation-price-tiers-grants.sql for the same bug).
GRANT SELECT, INSERT, UPDATE, DELETE ON catalog_item_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON quotation_item_options TO authenticated;

CREATE INDEX IF NOT EXISTS idx_catalog_item_options_catalog_item_id
  ON catalog_item_options(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_quotation_item_options_quotation_item_id
  ON quotation_item_options(quotation_item_id);
CREATE INDEX IF NOT EXISTS idx_quotation_item_options_catalog_item_option_id
  ON quotation_item_options(catalog_item_option_id);
