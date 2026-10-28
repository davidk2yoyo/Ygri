-- Fix table-level GRANT permissions for client_quotations_ai.
-- RLS policies alone are not enough — Supabase/Postgres also requires
-- explicit table-level GRANTs to the authenticated role, otherwise every
-- query fails with "permission denied for table X" before RLS even runs.
-- (Same gotcha as 2026-08-07_fix-quotation-price-tiers-grants.sql.)

GRANT SELECT, INSERT, UPDATE, DELETE ON client_quotations_ai TO authenticated;
