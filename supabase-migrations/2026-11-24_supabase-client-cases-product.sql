-- ============================================================================
-- CONSULTAS — product on a conversation + editable order/product/subject. Safe to re-run.
-- Apply AFTER 2026-11-23 (client cases).
--   * client_cases.product_name / product_ref: the product a question is about (picked from the
--     client's own order lines, or typed)
--   * client_portal_get_cases now also returns the client's products to pick from
--   * client_portal_create_case takes the product; client_portal_update_case edits order/product/subject
-- ============================================================================

ALTER TABLE client_cases ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE client_cases ADD COLUMN IF NOT EXISTS product_ref  text;

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
        'approval', k.approval, 'track_id', k.track_id, 'track_name', t.name,
        'product_name', k.product_name, 'product_ref', k.product_ref, 'created_at', k.created_at,
        'last_message_at', k.last_message_at, 'created_by_type', k.created_by_type, 'created_by_name', k.created_by_name,
        'unread', (k.last_author_type = 'staff' AND (k.client_seen_at IS NULL OR k.client_seen_at < k.last_message_at)),
        'messages', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', m.id, 'author_type', m.author_type, 'author_name', m.author_name, 'kind', m.kind,
            'body', m.body, 'attachments', m.attachments, 'created_at', m.created_at) ORDER BY m.created_at), '[]'::jsonb)
          FROM client_case_messages m WHERE m.case_id = k.id AND NOT m.is_internal)
      ) ORDER BY k.created_at DESC)
      FROM client_cases k LEFT JOIN tracks t ON t.id = k.track_id
      WHERE k.client_id = v_client_id AND k.visible_to_client), '[]'::jsonb),
    'orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.created_at DESC)
      FROM tracks t WHERE t.client_id = v_client_id AND t.show_to_client = true), '[]'::jsonb),
    -- products the client has ordered (no prices), to pick from
    'products', COALESCE((SELECT jsonb_agg(p) FROM (
        SELECT DISTINCT ON (lower(COALESCE(l.name,'')), lower(COALESCE(l.client_ref,'')))
               jsonb_build_object('name', l.name, 'ref', l.client_ref, 'track_id', t.id) AS p
        FROM client_order_lines l JOIN client_orders o ON o.id = l.order_id
        LEFT JOIN tracks t ON t.id = o.track_id AND t.show_to_client = true
        WHERE o.client_id = v_client_id AND NULLIF(trim(COALESCE(l.name,'')), '') IS NOT NULL
        ORDER BY lower(COALESCE(l.name,'')), lower(COALESCE(l.client_ref,'')) LIMIT 800) q), '[]'::jsonb));
END; $$;

-- new signature (adds the product): drop the old one so the name is not ambiguous
DROP FUNCTION IF EXISTS public.client_portal_create_case(uuid, text, text, text, uuid, jsonb);
CREATE OR REPLACE FUNCTION public.client_portal_create_case(
  p_session_id uuid, p_kind text, p_subject text, p_body text, p_track_id uuid, p_attachments jsonb,
  p_product_name text DEFAULT NULL, p_product_ref text DEFAULT NULL)
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

  INSERT INTO client_cases (client_id, track_id, kind, subject, channel, status, created_by_type, created_by_name, last_author_type,
                            product_name, product_ref)
  VALUES (v_client_id, p_track_id, p_kind, left(trim(p_subject), 200), 'portal', 'open', 'client', v_who, 'client',
          NULLIF(left(trim(COALESCE(p_product_name,'')), 300), ''), NULLIF(left(trim(COALESCE(p_product_ref,'')), 100), ''))
  RETURNING id INTO v_id;
  INSERT INTO client_case_messages (case_id, author_type, author_name, body, attachments)
  VALUES (v_id, 'client', v_who, left(trim(p_body), 8000), public.client_case_clean_attachments(p_attachments));
  RETURN v_id;
END; $$;

-- Change the subject / order / product of a conversation afterwards
CREATE OR REPLACE FUNCTION public.client_portal_update_case(
  p_session_id uuid, p_case_id uuid, p_subject text, p_track_id uuid, p_product_name text, p_product_ref text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF NOT client_portal_can(p_session_id, 'consultas') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF NULLIF(trim(COALESCE(p_subject,'')), '') IS NULL THEN RAISE EXCEPTION 'A subject is required'; END IF;
  IF p_track_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tracks WHERE id = p_track_id AND client_id = v_client_id AND show_to_client = true) THEN
    RAISE EXCEPTION 'Order not available';
  END IF;
  UPDATE client_cases SET subject = left(trim(p_subject), 200), track_id = p_track_id,
         product_name = NULLIF(left(trim(COALESCE(p_product_name,'')), 300), ''),
         product_ref = NULLIF(left(trim(COALESCE(p_product_ref,'')), 100), '')
   WHERE id = p_case_id AND client_id = v_client_id AND visible_to_client;
  IF NOT FOUND THEN RAISE EXCEPTION 'case not found'; END IF;
END; $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'client_portal_get_cases(uuid)','client_portal_create_case(uuid,text,text,text,uuid,jsonb,text,text)',
    'client_portal_update_case(uuid,uuid,text,uuid,text,text)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', f);
  END LOOP;
END $$;
