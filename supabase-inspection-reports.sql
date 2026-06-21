-- Add language column to inspection_reports
ALTER TABLE inspection_reports
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'es'));

-- Add 'image' and 'diagram' block types
ALTER TABLE report_blocks DROP CONSTRAINT IF EXISTS report_blocks_type_check;
ALTER TABLE report_blocks ADD CONSTRAINT report_blocks_type_check
  CHECK (type IN ('cover','text','gallery','image','checklist','table','defects','scoring','conclusion','diagram'));
