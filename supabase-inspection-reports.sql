-- inspection_reports
CREATE TABLE IF NOT EXISTS inspection_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_number TEXT UNIQUE,
  title TEXT NOT NULL DEFAULT 'Inspection Report',
  inspector_name TEXT,
  visit_date DATE,
  supplier_name TEXT,
  supplier_address TEXT,
  client_name TEXT,
  project_ref TEXT,
  po_number TEXT,
  country TEXT,
  report_type TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','approved_with_observations','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto report number: IR-2026-001
CREATE SEQUENCE IF NOT EXISTS inspection_report_seq START 1;

CREATE OR REPLACE FUNCTION set_report_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.report_number IS NULL OR NEW.report_number = '' THEN
    NEW.report_number := 'IR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('inspection_report_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_number ON inspection_reports;
CREATE TRIGGER trg_report_number
  BEFORE INSERT ON inspection_reports
  FOR EACH ROW EXECUTE FUNCTION set_report_number();

-- report_blocks
CREATE TABLE IF NOT EXISTS report_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cover','text','gallery','checklist','table','defects','scoring','conclusion')),
  content JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_reports" ON inspection_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_report_blocks" ON report_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_reports" ON inspection_reports FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_report_blocks" ON report_blocks FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON inspection_reports TO authenticated;
GRANT ALL ON report_blocks TO authenticated;
GRANT SELECT ON inspection_reports TO anon;
GRANT SELECT ON report_blocks TO anon;
GRANT USAGE ON SEQUENCE inspection_report_seq TO authenticated;

-- Storage bucket for report images
INSERT INTO storage.buckets (id, name, public) VALUES ('report-images', 'report-images', true) ON CONFLICT DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "public_read_report_images" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'report-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_report_images" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'report-images') WITH CHECK (bucket_id = 'report-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
