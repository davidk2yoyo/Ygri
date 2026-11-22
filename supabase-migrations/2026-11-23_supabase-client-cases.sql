-- ============================================================================
-- CUSTOMER ATTENTION (Atención al cliente) — consultas técnicas, fichas técnicas, aprobación de
-- diseños, preguntas y comentarios. One conversation ("case") per topic, kept in the client's history.
-- Run in the Supabase SQL Editor. Safe to re-run. Apply AFTER 2026-11-22 (warranties).
--
--   client_cases           a conversation: kind, subject, order, who opened it, channel, status
--   client_case_messages   each message (client or staff), attachments, internal notes (staff-only)
--
-- Status: 'open' = waiting for us, 'answered' = waiting for the client, 'closed'.
-- Design approvals: staff ask for approval (approval='pending'); the client approves or asks for changes.
-- Staff can also LOG an interaction that happened elsewhere (phone, WhatsApp, e-mail, meeting);
-- those are internal unless visible_to_client is set.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS client_case_seq;

CREATE TABLE IF NOT EXISTS client_cases (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  track_id          uuid REFERENCES tracks(id) ON DELETE SET NULL,
  case_number       text NOT NULL DEFAULT ('CON-' || lpad(nextval('client_case_seq')::text, 4, '0')),
  kind              text NOT NULL DEFAULT 'question' CHECK (kind IN ('technical','datasheet','design','question','comment')),
  subject           text NOT NULL,
  channel           text NOT NULL DEFAULT 'portal' CHECK (channel IN ('portal','phone','whatsapp','email','meeting')),
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  approval          text CHECK (approval IS NULL OR approval IN ('pending','approved','changes')),
  visible_to_client boolean NOT NULL DEFAULT true,
  created_by_type   text NOT NULL DEFAULT 'client' CHECK (created_by_type IN ('client','staff')),
  created_by_name   text,
  last_author_type  text,
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  first_reply_at    timestamptz,             -- first staff answer: how long the client waited
  client_seen_at    timestamptz,
  closed_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_cases_client ON client_cases(client_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_cases_status ON client_cases(status);

CREATE TABLE IF NOT EXISTS client_case_messages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id      uuid NOT NULL REFERENCES client_cases(id) ON DELETE CASCADE,
  author_type  text NOT NULL CHECK (author_type IN ('client','staff')),
  author_name  text,
  kind         text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','approval_request','approved','changes_requested')),
  body         text,
  attachments  jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{url, name, kind: 'image'|'video'|'file'}]
  is_internal  boolean NOT NULL DEFAULT false,       -- staff-only note, never sent to the portal
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_case_messages_case ON client_case_messages(case_id, created_at);

ALTER TABLE client_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_case_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_client_cases" ON client_cases;
CREATE POLICY "auth_all_client_cases" ON client_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_client_case_messages" ON client_case_messages;
CREATE POLICY "auth_all_client_case_messages" ON client_case_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Portal: permission list now includes 'consultas' ─────────────────────────
CREATE OR REPLACE FUNCTION public.client_portal_get_me(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
DECLARE v client_portal_users; k text; perms jsonb := '{}'::jsonb;
BEGIN
  v := public.client_portal_user_of_session(p_session_id);
  IF v.id IS NULL THEN RETURN NULL; END IF;
  FOREACH k IN ARRAY ARRAY['prices','envios','ordenes','pedidos','documentos','reportes','asistente','cotizaciones_ia','garantias','consultas'] LOOP
    perms := perms || jsonb_build_object(k, v.role = 'admin' OR COALESCE(v.permissions ->> k, 'false') = 'true');
  END LOOP;
  RETURN jsonb_build_object('user_id', v.id, 'name', v.name, 'email', v.email, 'role', v.role, 'permissions', perms);
END; $$;

-- Attachment list from the portal: only files in the portal's own bucket, max 10, cleaned fields
CREATE OR REPLACE FUNCTION public.client_case_clean_attachments(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE a jsonb; out jsonb := '[]'::jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN RETURN out; END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(p) LOOP
    IF (a->>'url') ~ '^https://[^/]+/storage/v1/object/public/client-portal-uploads/' AND jsonb_array_length(out) < 10 THEN
      out := out || jsonb_build_array(jsonb_build_object(
        'url', a->>'url', 'name', left(COALESCE(a->>'name', 'archivo'), 200),
        'kind', CASE WHEN a->>'kind' IN ('image','video') THEN a->>'kind' ELSE 'file' END));
    END IF;
  END LOOP;
  RETURN out;
END; $$;
REVOKE ALL ON FUNCTION public.client_case_clean_attachments(jsonb) FROM PUBLIC, anon, authenticated;

-- ── Portal: read my cases (internal notes and staff-only logs never leave the server) ──
CREATE OR REPLACE FUNCTION public.client_portal_get_cases(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;
  IF NOT client_portal_can(p_session_id, 'consultas') THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'cases', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', k.id, 'case_number', k.case_number, 'kind', k.kind, 'subject', k.subject, 'status', k.status,
        'approval', k.approval, 'track_id', k.track_id, 'track_name', t.name, 'created_at', k.created_at,
        'last_message_at', k.last_message_at, 'created_by_type', k.created_by_type, 'created_by_name', k.created_by_name,
        'unread', (k.last_author_type = 'staff' AND (k.client_seen_at IS NULL OR k.client_seen_at < k.last_message_at)),
        'messages', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', m.id, 'author_type', m.author_type, 'author_name', m.author_name, 'kind', m.kind,
            'body', m.body, 'attachments', m.attachments, 'created_at', m.created_at) ORDER BY m.created_at), '[]'::jsonb)
          FROM client_case_messages m WHERE m.case_id = k.id AND NOT m.is_internal)
      ) ORDER BY k.last_message_at DESC)
      FROM client_cases k LEFT JOIN tracks t ON t.id = k.track_id
      WHERE k.client_id = v_client_id AND k.visible_to_client), '[]'::jsonb),
    'orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.created_at DESC)
      FROM tracks t WHERE t.client_id = v_client_id AND t.show_to_client = true), '[]'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_create_case(
  p_session_id uuid, p_kind text, p_subject text, p_body text, p_track_id uuid, p_attachments jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text; v_id uuid; v_who text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF NOT client_portal_can(p_session_id, 'consultas') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF p_kind NOT IN ('technical','datasheet','design','question','comment') THEN RAISE EXCEPTION 'unknown kind'; END IF;
  IF NULLIF(trim(COALESCE(p_subject,'')), '') IS NULL THEN RAISE EXCEPTION 'A subject is required'; END IF;
  IF NULLIF(trim(COALESCE(p_body,'')), '') IS NULL THEN RAISE EXCEPTION 'Write your message'; END IF;
  IF p_track_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tracks WHERE id = p_track_id AND client_id = v_client_id AND show_to_client = true) THEN
    RAISE EXCEPTION 'Order not available';
  END IF;
  v_who := COALESCE((public.client_portal_user_of_session(p_session_id)).name, v_name, 'client');

  INSERT INTO client_cases (client_id, track_id, kind, subject, channel, status, created_by_type, created_by_name, last_author_type)
  VALUES (v_client_id, p_track_id, p_kind, left(trim(p_subject), 200), 'portal', 'open', 'client', v_who, 'client')
  RETURNING id INTO v_id;
  INSERT INTO client_case_messages (case_id, author_type, author_name, body, attachments)
  VALUES (v_id, 'client', v_who, left(trim(p_body), 8000), public.client_case_clean_attachments(p_attachments));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_reply_case(p_session_id uuid, p_case_id uuid, p_body text, p_attachments jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text; v_who text; v_att jsonb;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF NOT client_portal_can(p_session_id, 'consultas') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM client_cases WHERE id = p_case_id AND client_id = v_client_id AND visible_to_client) THEN RAISE EXCEPTION 'case not found'; END IF;
  v_att := public.client_case_clean_attachments(p_attachments);
  IF NULLIF(trim(COALESCE(p_body,'')), '') IS NULL AND jsonb_array_length(v_att) = 0 THEN RAISE EXCEPTION 'Write your message'; END IF;
  v_who := COALESCE((public.client_portal_user_of_session(p_session_id)).name, v_name, 'client');
  INSERT INTO client_case_messages (case_id, author_type, author_name, body, attachments)
  VALUES (p_case_id, 'client', v_who, NULLIF(left(trim(COALESCE(p_body,'')), 8000), ''), v_att);
  UPDATE client_cases SET status = 'open', closed_at = NULL, last_author_type = 'client', last_message_at = now(), client_seen_at = now()
   WHERE id = p_case_id;
END; $$;

-- The client's answer to a design approval request
CREATE OR REPLACE FUNCTION public.client_portal_decide_case(p_session_id uuid, p_case_id uuid, p_decision text, p_note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text; v_who text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF NOT client_portal_can(p_session_id, 'consultas') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF p_decision NOT IN ('approved','changes') THEN RAISE EXCEPTION 'unknown decision'; END IF;
  IF p_decision = 'changes' AND NULLIF(trim(COALESCE(p_note,'')), '') IS NULL THEN RAISE EXCEPTION 'Tell us what to change'; END IF;
  IF NOT EXISTS (SELECT 1 FROM client_cases WHERE id = p_case_id AND client_id = v_client_id AND visible_to_client AND approval = 'pending') THEN
    RAISE EXCEPTION 'Nothing to approve here';
  END IF;
  v_who := COALESCE((public.client_portal_user_of_session(p_session_id)).name, v_name, 'client');
  INSERT INTO client_case_messages (case_id, author_type, author_name, kind, body)
  VALUES (p_case_id, 'client', v_who, CASE WHEN p_decision = 'approved' THEN 'approved' ELSE 'changes_requested' END,
          NULLIF(left(trim(COALESCE(p_note,'')), 8000), ''));
  UPDATE client_cases SET approval = p_decision, status = 'open', closed_at = NULL, last_author_type = 'client', last_message_at = now(), client_seen_at = now()
   WHERE id = p_case_id;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_mark_case_seen(p_session_id uuid, p_case_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  UPDATE client_cases SET client_seen_at = now() WHERE id = p_case_id AND client_id = v_client_id;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_cases_unread(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text; v_n integer;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL OR NOT client_portal_can(p_session_id, 'consultas') THEN RETURN 0; END IF;
  SELECT count(*) INTO v_n FROM client_cases k
   WHERE k.client_id = v_client_id AND k.visible_to_client AND k.last_author_type = 'staff'
     AND (k.client_seen_at IS NULL OR k.client_seen_at < k.last_message_at);
  RETURN v_n;
END; $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'client_portal_get_me(uuid)','client_portal_get_cases(uuid)','client_portal_create_case(uuid,text,text,text,uuid,jsonb)',
    'client_portal_reply_case(uuid,uuid,text,jsonb)','client_portal_decide_case(uuid,uuid,text,text)',
    'client_portal_mark_case_seen(uuid,uuid)','client_portal_cases_unread(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', f);
  END LOOP;
END $$;
