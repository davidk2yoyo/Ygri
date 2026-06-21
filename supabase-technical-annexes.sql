-- ============================================================
-- TECHNICAL ANNEXES
-- Run this in Supabase SQL Editor
-- ============================================================

-- Main annex record, one per quotation
CREATE TABLE IF NOT EXISTS technical_annexes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  annex_number text UNIQUE NOT NULL, -- e.g. AX-0001
  title text NOT NULL DEFAULT 'Technical Annex',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Blocks within an annex (ordered)
CREATE TABLE IF NOT EXISTS annex_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annex_id uuid REFERENCES technical_annexes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('item','text','specs','images','diagram')),
  content jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Auto-generate annex_number
CREATE OR REPLACE FUNCTION generate_annex_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(annex_number FROM 4) AS integer)), 0) + 1
  INTO next_num FROM technical_annexes;
  NEW.annex_number := 'AX-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_annex_number
  BEFORE INSERT ON technical_annexes
  FOR EACH ROW WHEN (NEW.annex_number = 'AX-0001' OR NEW.annex_number IS NULL)
  EXECUTE FUNCTION generate_annex_number();

-- RLS: authenticated users can manage annexes
ALTER TABLE technical_annexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE annex_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_annexes" ON technical_annexes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_blocks" ON annex_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read for the shareable link
CREATE POLICY "anon_read_annexes" ON technical_annexes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_blocks" ON annex_blocks FOR SELECT TO anon USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION touch_annex_updated()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER annex_updated
  BEFORE UPDATE ON technical_annexes
  FOR EACH ROW EXECUTE FUNCTION touch_annex_updated();

-- Storage bucket for annex images (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('annex-images', 'annex-images', true) ON CONFLICT DO NOTHING;
-- CREATE POLICY "anon_read_annex_images" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'annex-images');
-- CREATE POLICY "auth_upload_annex_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'annex-images');
-- CREATE POLICY "auth_delete_annex_images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'annex-images');
