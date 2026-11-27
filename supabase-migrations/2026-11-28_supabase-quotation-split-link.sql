-- Split invoice: a proforma/invoice divided in two keeps a back-link to the original, so staff can
-- see "Split from 2026-12". Safe to re-run. Nothing else changes; the client portal does not read it.
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS split_from_id uuid REFERENCES quotations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_split_from_id ON quotations(split_from_id);
