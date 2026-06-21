-- Add language column to inspection_reports
ALTER TABLE inspection_reports
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'es'));
