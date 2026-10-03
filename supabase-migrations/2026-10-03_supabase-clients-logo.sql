-- ============================================================
-- CLIENT LOGO (private-label branding shown on documents)
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url text;

-- Storage bucket for the uploaded logo files, mirroring the quotation-images
-- bucket's own policies (public read, authenticated write).
INSERT INTO storage.buckets (id, name, public) VALUES ('client-logos', 'client-logos', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "allow_auth_upload_client_logos" ON storage.objects;
CREATE POLICY "allow_auth_upload_client_logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "allow_auth_update_client_logos" ON storage.objects;
CREATE POLICY "allow_auth_update_client_logos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "allow_auth_delete_client_logos" ON storage.objects;
CREATE POLICY "allow_auth_delete_client_logos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "allow_public_read_client_logos" ON storage.objects;
CREATE POLICY "allow_public_read_client_logos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'client-logos');
