-- ============================================================
-- CLIENT REQUESTS — one per project (track), captures the raw
-- WhatsApp/inquiry conversation + files/links + an AI-generated digest
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL UNIQUE,
  raw_text text,
  links jsonb NOT NULL DEFAULT '[]',
  product_summary text,
  quantity_summary text,
  key_requirements text,
  budget_terms text,
  open_questions text,
  summary_generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_request_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_request_id uuid NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_client_request_updated()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER client_request_updated
  BEFORE UPDATE ON client_requests
  FOR EACH ROW EXECUTE FUNCTION touch_client_request_updated();

-- RLS
ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_request_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_client_requests" ON client_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_client_request_files" ON client_request_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table-level GRANTs — required on this project, RLS alone is not enough
GRANT SELECT, INSERT, UPDATE, DELETE ON client_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_request_files TO authenticated;

CREATE INDEX IF NOT EXISTS idx_client_requests_track_id ON client_requests(track_id);
CREATE INDEX IF NOT EXISTS idx_client_request_files_request_id ON client_request_files(client_request_id);

-- Storage bucket for attached files
INSERT INTO storage.buckets (id, name, public) VALUES ('client-request-files', 'client-request-files', true) ON CONFLICT DO NOTHING;

CREATE POLICY "anon_read_client_request_files" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'client-request-files');
CREATE POLICY "auth_upload_client_request_files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-request-files');
CREATE POLICY "auth_delete_client_request_files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'client-request-files');
