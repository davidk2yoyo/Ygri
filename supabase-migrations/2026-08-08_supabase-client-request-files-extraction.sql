-- ============================================================
-- Cache OCR'd/extracted text per attached file, so the digest can
-- read images and PDFs the client sends (supplier datasheets, etc.)
-- without re-running extraction on every "Regenerate Summary"
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE client_request_files ADD COLUMN IF NOT EXISTS extracted_text text;
ALTER TABLE client_request_files ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pending'
  CHECK (extraction_status IN ('pending', 'processing', 'done', 'error', 'skipped'));
