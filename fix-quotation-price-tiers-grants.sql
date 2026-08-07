-- Fix table-level GRANT permissions for price tier tables
-- RLS policies alone are not enough — Supabase/Postgres also requires
-- explicit table-level GRANTs to the authenticated role, otherwise every
-- query fails with "permission denied for table X" before RLS even runs.

GRANT SELECT, INSERT, UPDATE, DELETE ON quotation_item_price_tiers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_price_tiers TO authenticated;
