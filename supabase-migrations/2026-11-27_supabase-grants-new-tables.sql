-- Table privileges for the tables created in 2026-11-22 … 2026-11-26.
-- This project does not grant table privileges by default, and RLS only filters rows: without
-- GRANT the staff app gets "permission denied for table ...". Idempotent, safe to run any time.
-- Clients (portal) never touch these tables directly — they go through SECURITY DEFINER RPCs.

GRANT SELECT, INSERT, UPDATE, DELETE ON warranty_rules          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON warranty_claims         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON warranty_claim_items    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_cases            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_case_messages    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_profile_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_profile_shares   TO authenticated;

-- Staff inserts rely on the DEFAULT nextval(...) of GAR-xxxx / CON-xxxx numbers.
GRANT USAGE, SELECT ON SEQUENCE warranty_claim_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE client_case_seq    TO authenticated;
