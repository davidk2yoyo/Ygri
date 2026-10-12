-- ============================================================
-- CLIENT DOCUMENT FOLDERS
--  * Folders per client, max 2 levels, optionally tied to a project (track).
--  * Visibility follows the same model as the rest of the portal: the client sees a
--    document only if the document, its folder (and parent folder) and its project
--    are all shown.
--  * The client can upload into visible folders (or the root) and delete what they
--    uploaded themselves.
--  * Every action by either side is logged in client_document_events.
--  * In-app notifications via client_documents_seen (no email yet).
-- ============================================================

CREATE TABLE IF NOT EXISTS client_document_folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES client_document_folders(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  track_id uuid REFERENCES tracks(id) ON DELETE SET NULL,
  show_to_client boolean NOT NULL DEFAULT false,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cdf_client ON client_document_folders(client_id, parent_id);

CREATE OR REPLACE FUNCTION public.client_folder_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM client_document_folders p
                   WHERE p.id = NEW.parent_id AND p.client_id = NEW.client_id AND p.parent_id IS NULL) THEN
      RAISE EXCEPTION 'folders can only be nested one level, inside a folder of the same client';
    END IF;
    IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM client_document_folders c WHERE c.parent_id = NEW.id) THEN
      RAISE EXCEPTION 'a folder that has subfolders cannot become a subfolder';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_client_folder_guard ON client_document_folders;
CREATE TRIGGER trg_client_folder_guard BEFORE INSERT OR UPDATE ON client_document_folders
  FOR EACH ROW EXECUTE FUNCTION public.client_folder_guard();

ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES client_document_folders(id) ON DELETE SET NULL;
ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS uploaded_by_type text NOT NULL DEFAULT 'staff';
ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS uploaded_by_name text;
ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_uploaded_by_type_check;
ALTER TABLE client_documents ADD CONSTRAINT client_documents_uploaded_by_type_check CHECK (uploaded_by_type IN ('staff','client'));
CREATE INDEX IF NOT EXISTS idx_client_documents_folder ON client_documents(folder_id);

CREATE OR REPLACE FUNCTION public.client_document_folder_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM client_document_folders f WHERE f.id = NEW.folder_id AND f.client_id = NEW.client_id) THEN
    RAISE EXCEPTION 'the folder belongs to another client';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_client_document_folder_guard ON client_documents;
CREATE TRIGGER trg_client_document_folder_guard BEFORE INSERT OR UPDATE OF folder_id ON client_documents
  FOR EACH ROW EXECUTE FUNCTION public.client_document_folder_guard();

CREATE TABLE IF NOT EXISTS client_document_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_id uuid REFERENCES client_documents(id) ON DELETE SET NULL,
  folder_id uuid REFERENCES client_document_folders(id) ON DELETE SET NULL,
  subject text,                       -- document or folder name at the time (survives deletion)
  actor_type text NOT NULL CHECK (actor_type IN ('client','staff')),
  actor_name text,
  kind text NOT NULL,                 -- uploaded, deleted, moved, renamed, edited, shown, hidden, folder_created, folder_renamed, folder_deleted, folder_shown, folder_hidden
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cde_client ON client_document_events(client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS client_documents_seen (
  client_id uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  client_seen_at timestamptz,
  staff_seen_at timestamptz
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['client_document_folders','client_document_events','client_documents_seen'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_all_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "auth_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
  END LOOP;
END $$;

-- staff: clients whose uploads staff has not looked at yet
CREATE OR REPLACE VIEW v_client_documents_unread WITH (security_invoker = true) AS
SELECT e.client_id, count(*)::int AS unread
FROM client_document_events e
LEFT JOIN client_documents_seen s ON s.client_id = e.client_id
WHERE e.actor_type = 'client' AND e.kind = 'uploaded' AND e.created_at > COALESCE(s.staff_seen_at, 'epoch'::timestamptz)
GROUP BY e.client_id;
GRANT SELECT ON v_client_documents_unread TO authenticated;

-- ---------------- portal side ----------------
-- internal helper (never callable from the API)
CREATE OR REPLACE FUNCTION public.portal_visible_folders(p_client uuid)
RETURNS TABLE(id uuid, parent_id uuid, name text, track_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT f.id, f.parent_id, f.name, f.track_id, f.created_at
  FROM client_document_folders f
  LEFT JOIN tracks t ON t.id = f.track_id
  LEFT JOIN client_document_folders p ON p.id = f.parent_id
  LEFT JOIN tracks pt ON pt.id = p.track_id
  WHERE f.client_id = p_client AND f.show_to_client
    AND (f.track_id IS NULL OR t.show_to_client)
    AND (f.parent_id IS NULL OR (p.show_to_client AND (p.track_id IS NULL OR pt.show_to_client)));
$$;
REVOKE ALL ON FUNCTION public.portal_visible_folders(uuid) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.client_portal_get_documents(uuid);
CREATE OR REPLACE FUNCTION public.client_portal_get_documents(p_session_id uuid)
RETURNS TABLE(id uuid, name text, document_type text, file_url text, file_name text,
              file_size integer, notes text, created_at timestamptz,
              shipment_id uuid, track_id uuid, reference_number text,
              folder_id uuid, uploaded_by_type text, uploaded_by_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT d.id, d.name, d.document_type, d.file_url, d.file_name, d.file_size, d.notes, d.created_at,
         d.shipment_id, d.track_id, d.reference_number, d.folder_id, d.uploaded_by_type, d.uploaded_by_name
  FROM client_documents d
  LEFT JOIN tracks t ON t.id = d.track_id
  WHERE d.client_id = v_client_id AND d.show_to_client = true
    AND (d.track_id IS NULL OR t.show_to_client = true)
    AND (d.folder_id IS NULL OR d.folder_id IN (SELECT f.id FROM portal_visible_folders(v_client_id) f))
  ORDER BY d.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_folders(p_session_id uuid)
RETURNS TABLE(id uuid, parent_id uuid, name text, track_id uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT f.id, f.parent_id, f.name, f.track_id, f.created_at FROM portal_visible_folders(v_client_id) f ORDER BY f.name;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_add_document(
  p_session_id uuid, p_folder_id uuid, p_name text, p_file_url text, p_file_name text, p_file_size integer, p_notes text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_id uuid; v_folder_name text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF NULLIF(trim(p_name), '') IS NULL THEN RAISE EXCEPTION 'name is required'; END IF;
  IF p_file_url !~ '^https://[^/]+/storage/v1/object/public/client-portal-uploads/' THEN RAISE EXCEPTION 'invalid file'; END IF;
  IF p_folder_id IS NOT NULL THEN
    SELECT f.name INTO v_folder_name FROM portal_visible_folders(v_client_id) f WHERE f.id = p_folder_id;
    IF v_folder_name IS NULL THEN RAISE EXCEPTION 'folder not available'; END IF;
  END IF;
  INSERT INTO client_documents (client_id, name, document_type, file_url, file_name, file_size, notes, folder_id,
                                show_to_client, uploaded_by_type, uploaded_by_name)
  VALUES (v_client_id, left(trim(p_name), 200), 'other', p_file_url, left(p_file_name, 300), p_file_size,
          NULLIF(left(trim(COALESCE(p_notes,'')), 1000), ''), p_folder_id, true, 'client', v_name)
  RETURNING id INTO v_id;
  INSERT INTO client_document_events (client_id, document_id, folder_id, subject, actor_type, actor_name, kind, details)
  VALUES (v_client_id, v_id, p_folder_id, left(trim(p_name), 200), 'client', v_name, 'uploaded',
          jsonb_build_object('file_name', p_file_name, 'folder', v_folder_name));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_delete_document(p_session_id uuid, p_document_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_d client_documents%ROWTYPE;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  SELECT * INTO v_d FROM client_documents WHERE id = p_document_id AND client_id = v_client_id;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;
  IF v_d.uploaded_by_type <> 'client' THEN RAISE EXCEPTION 'you can only delete documents you uploaded'; END IF;
  DELETE FROM client_documents WHERE id = v_d.id;
  INSERT INTO client_document_events (client_id, folder_id, subject, actor_type, actor_name, kind, details)
  VALUES (v_client_id, v_d.folder_id, v_d.name, 'client', v_name, 'deleted', jsonb_build_object('file_name', v_d.file_name));
END; $$;

-- what the client may see of the log: their own actions + our uploads/publications of documents they can see
CREATE OR REPLACE FUNCTION public.client_portal_get_document_events(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((SELECT jsonb_agg(x ORDER BY (x->>'created_at') DESC) FROM (
    SELECT jsonb_build_object('id', e.id, 'actor_type', e.actor_type, 'actor_name', e.actor_name, 'kind', e.kind,
                              'subject', e.subject, 'details', e.details, 'created_at', e.created_at) AS x
    FROM client_document_events e
    LEFT JOIN client_documents d ON d.id = e.document_id
    LEFT JOIN tracks t ON t.id = d.track_id
    WHERE e.client_id = v_client_id
      AND (e.actor_type = 'client'
           OR (e.kind IN ('uploaded','shown') AND d.id IS NOT NULL AND d.show_to_client = true
               AND (d.track_id IS NULL OR t.show_to_client = true)
               AND (d.folder_id IS NULL OR d.folder_id IN (SELECT f.id FROM portal_visible_folders(v_client_id) f))))
    ORDER BY e.created_at DESC LIMIT 100) q), '[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_documents_unread(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_seen timestamptz; v_n integer;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN 0; END IF;
  SELECT s.client_seen_at INTO v_seen FROM client_documents_seen s WHERE s.client_id = v_client_id;
  SELECT count(DISTINCT d.id) INTO v_n
  FROM client_document_events e
  JOIN client_documents d ON d.id = e.document_id
  LEFT JOIN tracks t ON t.id = d.track_id
  WHERE e.client_id = v_client_id AND e.actor_type = 'staff' AND e.kind IN ('uploaded','shown')
    AND e.created_at > COALESCE(v_seen, 'epoch'::timestamptz)
    AND d.show_to_client = true AND (d.track_id IS NULL OR t.show_to_client = true)
    AND (d.folder_id IS NULL OR d.folder_id IN (SELECT f.id FROM portal_visible_folders(v_client_id) f));
  RETURN v_n;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_mark_documents_seen(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  INSERT INTO client_documents_seen (client_id, client_seen_at) VALUES (v_client_id, now())
  ON CONFLICT (client_id) DO UPDATE SET client_seen_at = now();
END; $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'client_portal_get_documents(uuid)','client_portal_get_folders(uuid)',
    'client_portal_add_document(uuid,uuid,text,text,text,integer,text)','client_portal_delete_document(uuid,uuid)',
    'client_portal_get_document_events(uuid)','client_portal_documents_unread(uuid)','client_portal_mark_documents_seen(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', f);
  END LOOP;
END $$;
