-- Link inspection reports to a project/track
ALTER TABLE inspection_reports
  ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES tracks(track_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inspection_reports_track_id_idx ON inspection_reports(track_id);

-- Add language column to inspection_reports
ALTER TABLE inspection_reports
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'es'));

-- Add 'image', 'diagram', and 'video' block types
ALTER TABLE report_blocks DROP CONSTRAINT IF EXISTS report_blocks_type_check;
ALTER TABLE report_blocks ADD CONSTRAINT report_blocks_type_check
  CHECK (type IN ('cover','text','gallery','image','checklist','table','defects','scoring','conclusion','diagram','video'));
