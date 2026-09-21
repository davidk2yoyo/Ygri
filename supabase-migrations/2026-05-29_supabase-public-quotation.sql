-- ============================================================
-- PUBLIC QUOTATION ACCESS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add client_name and project_name directly on quotations
--    so the public page is self-contained (no auth join needed)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS project_name text;

-- 2. Backfill existing records from v_tracks_overview (best-effort)
UPDATE quotations q
SET
  client_name = t.client_name,
  project_name = t.track_name
FROM v_tracks_overview t
WHERE q.track_id = t.track_id
  AND (q.client_name IS NULL OR q.project_name IS NULL);

-- 3. Allow anonymous users to SELECT quotations and their items
CREATE POLICY "anon_read_quotations"
  ON quotations FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_quotation_items"
  ON quotation_items FOR SELECT TO anon USING (true);

-- 4. Grant SELECT on the tracks view so the public page can
--    fall back to fetching names for older records
GRANT SELECT ON v_tracks_overview TO anon;
