-- ============================================================
-- Allow anonymous (public quotation link) read access to price tiers
-- Excludes supplier_price implicitly — the client app only selects
-- min_qty, max_qty, price, notes on the public page (never supplier_price)
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE POLICY "anon_read_quotation_item_price_tiers"
  ON quotation_item_price_tiers FOR SELECT TO anon USING (true);

GRANT SELECT ON quotation_item_price_tiers TO anon;
