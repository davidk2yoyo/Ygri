-- ============================================================
-- INDEPENDENT DOCUMENTS: link Proforma/Invoice back to their source
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS source_quotation_id uuid REFERENCES quotations(id);

CREATE INDEX IF NOT EXISTS idx_quotations_source_quotation_id ON quotations(source_quotation_id);
