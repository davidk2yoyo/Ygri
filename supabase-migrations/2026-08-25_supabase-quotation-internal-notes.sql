-- Internal-only notes field on quotations (never shown on the client-facing PDF)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_notes text;
