-- ============================================================================
-- WARRANTIES (Garantías) — claims a client raises about products they received.
-- Run in the Supabase SQL Editor. Safe to re-run. Apply AFTER 2026-11-21 (portal roles).
--
--   warranty_rules        per-client table of warranty times (brand / product keyword -> months,
--                         "factory defects only" or "report within N hours"). Edited by staff.
--   warranty_claims       one claim (reclamo) per order, raised by the client or by staff.
--   warranty_claim_items  the products in a claim: the same columns as the client's
--                         "Warranty Tracker" Excel + photos/videos + the supplier's question/answer.
--
-- The client reaches this only through the portal functions below (needs the 'garantias'
-- permission); staff use the tables directly (authenticated, like client_orders).
-- ============================================================================

CREATE TABLE IF NOT EXISTS warranty_rules (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand          text,                      -- NULL = any brand
  product_match  text,                      -- comma-separated keywords found in the product name; NULL = any product
  kind           text NOT NULL DEFAULT 'months' CHECK (kind IN ('months','defects','hours')),
  months         integer,                   -- kind = months
  report_hours   integer,                   -- kind = hours (client must report within N hours of receiving)
  requires_label boolean NOT NULL DEFAULT false,  -- e.g. lingerie: the garment label is mandatory
  notes          text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warranty_rules_client ON warranty_rules(client_id);

CREATE SEQUENCE IF NOT EXISTS warranty_claim_seq;

CREATE TABLE IF NOT EXISTS warranty_claims (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id            uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  track_id             uuid REFERENCES tracks(id) ON DELETE SET NULL,   -- the order (project) the goods came from
  claim_number         text NOT NULL DEFAULT ('GAR-' || lpad(nextval('warranty_claim_seq')::text, 4, '0')),
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sent_supplier','answered','resolved','rejected')),
  client_notes         text,
  staff_notes          text,
  supplier_review_date date,
  created_by_type      text NOT NULL DEFAULT 'client' CHECK (created_by_type IN ('client','staff')),
  created_by_name      text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_client ON warranty_claims(client_id);

CREATE TABLE IF NOT EXISTS warranty_claim_items (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id           uuid NOT NULL REFERENCES warranty_claims(id) ON DELETE CASCADE,
  sort_order         integer NOT NULL DEFAULT 0,
  product_name       text,
  brand              text,
  supplier_name      text,
  supplier_order_ref text,
  supplier_model     text,
  client_model       text,
  problem            text,
  qty                integer NOT NULL DEFAULT 1,
  received_at        date,                  -- when the client received the goods: the warranty clock starts here
  complaint_date     date NOT NULL DEFAULT current_date,   -- the day the claim was raised
  media              jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{url, kind: 'image'|'video'}]
  supplier_question  text,
  supplier_answer    text,
  resolution         text CHECK (resolution IS NULL OR resolution IN ('replace','credit','repair','rejected')),
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warranty_claim_items_claim ON warranty_claim_items(claim_id);

ALTER TABLE warranty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claim_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_warranty_rules" ON warranty_rules;
CREATE POLICY "auth_all_warranty_rules" ON warranty_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_warranty_claims" ON warranty_claims;
CREATE POLICY "auth_all_warranty_claims" ON warranty_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_warranty_claim_items" ON warranty_claim_items;
CREATE POLICY "auth_all_warranty_claim_items" ON warranty_claim_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Portal: the permission list now includes 'garantias' ─────────────────────
CREATE OR REPLACE FUNCTION public.client_portal_get_me(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
DECLARE v client_portal_users; k text; perms jsonb := '{}'::jsonb;
BEGIN
  v := public.client_portal_user_of_session(p_session_id);
  IF v.id IS NULL THEN RETURN NULL; END IF;
  FOREACH k IN ARRAY ARRAY['prices','envios','ordenes','pedidos','documentos','reportes','asistente','cotizaciones_ia','garantias'] LOOP
    perms := perms || jsonb_build_object(k, v.role = 'admin' OR COALESCE(v.permissions ->> k, 'false') = 'true');
  END LOOP;
  RETURN jsonb_build_object('user_id', v.id, 'name', v.name, 'email', v.email, 'role', v.role, 'permissions', perms);
END; $$;

-- ── Portal: read claims, rules and the orders the client can pick from ───────
CREATE OR REPLACE FUNCTION public.client_portal_get_warranties(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;
  IF NOT client_portal_can(p_session_id, 'garantias') THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'claims', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', w.id, 'claim_number', w.claim_number, 'status', w.status, 'track_id', w.track_id,
        'track_name', t.name, 'client_notes', w.client_notes, 'supplier_review_date', w.supplier_review_date,
        'created_by_type', w.created_by_type, 'created_by_name', w.created_by_name, 'created_at', w.created_at,
        'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', i.id, 'product_name', i.product_name, 'brand', i.brand, 'supplier_name', i.supplier_name,
            'supplier_order_ref', i.supplier_order_ref, 'supplier_model', i.supplier_model, 'client_model', i.client_model,
            'problem', i.problem, 'qty', i.qty, 'received_at', i.received_at, 'complaint_date', i.complaint_date,
            'media', i.media, 'supplier_answer', i.supplier_answer, 'resolution', i.resolution) ORDER BY i.sort_order, i.created_at), '[]'::jsonb)
          FROM warranty_claim_items i WHERE i.claim_id = w.id)
      ) ORDER BY w.created_at DESC)
      FROM warranty_claims w LEFT JOIN tracks t ON t.id = w.track_id
      WHERE w.client_id = v_client_id), '[]'::jsonb),
    'rules', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'brand', r.brand, 'product_match', r.product_match, 'kind', r.kind, 'months', r.months,
        'report_hours', r.report_hours, 'requires_label', r.requires_label, 'notes', r.notes, 'sort_order', r.sort_order)
        ORDER BY r.sort_order, r.created_at)
      FROM warranty_rules r WHERE r.client_id = v_client_id), '[]'::jsonb),
    'orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.created_at DESC)
      FROM tracks t WHERE t.client_id = v_client_id AND t.show_to_client = true), '[]'::jsonb)
  );
END; $$;

-- ── Portal: create (p_claim_id NULL) or edit an OPEN claim, replacing its lines ──
-- p_items: [{product_name, brand, supplier_name, supplier_order_ref, supplier_model, client_model,
--            problem, qty, received_at, complaint_date, media:[{url,kind}]}]
CREATE OR REPLACE FUNCTION public.client_portal_save_warranty_claim(
  p_session_id uuid, p_claim_id uuid, p_track_id uuid, p_notes text, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_client_id uuid; v_name text; v_id uuid; it jsonb; n int := 0; v_brand text; v_media jsonb; m jsonb;
  v_url_re text := '^https://[^/]+/storage/v1/object/public/client-portal-uploads/';
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF NOT client_portal_can(p_session_id, 'garantias') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one product';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN RAISE EXCEPTION 'Too many products in one claim'; END IF;
  IF p_track_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tracks WHERE id = p_track_id AND client_id = v_client_id AND show_to_client = true) THEN
    RAISE EXCEPTION 'Order not available';
  END IF;

  IF p_claim_id IS NULL THEN
    INSERT INTO warranty_claims (client_id, track_id, client_notes, created_by_type, created_by_name)
    VALUES (v_client_id, p_track_id, NULLIF(left(trim(COALESCE(p_notes,'')), 2000), ''), 'client', COALESCE(v_name, 'client'))
    RETURNING id INTO v_id;
  ELSE
    SELECT id INTO v_id FROM warranty_claims WHERE id = p_claim_id AND client_id = v_client_id AND status = 'open';
    IF v_id IS NULL THEN RAISE EXCEPTION 'This claim can no longer be edited'; END IF;
    UPDATE warranty_claims SET track_id = p_track_id, client_notes = NULLIF(left(trim(COALESCE(p_notes,'')), 2000), ''), updated_at = now()
     WHERE id = v_id;
    DELETE FROM warranty_claim_items WHERE claim_id = v_id;
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    n := n + 1;
    v_brand := NULLIF(trim(COALESCE(it->>'brand','')), '');
    -- brand not typed: take it from the client's own order lines (same client model)
    IF v_brand IS NULL AND NULLIF(trim(COALESCE(it->>'client_model','')), '') IS NOT NULL THEN
      SELECT l.brand INTO v_brand FROM client_order_lines l JOIN client_orders o ON o.id = l.order_id
       WHERE o.client_id = v_client_id AND lower(l.client_ref) = lower(trim(it->>'client_model')) AND NULLIF(l.brand,'') IS NOT NULL
       ORDER BY o.created_at DESC LIMIT 1;
    END IF;
    v_media := '[]'::jsonb;
    FOR m IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(it->'media') = 'array' THEN it->'media' ELSE '[]'::jsonb END) LOOP
      IF (m->>'url') ~ v_url_re AND jsonb_array_length(v_media) < 10 THEN
        v_media := v_media || jsonb_build_array(jsonb_build_object('url', m->>'url', 'kind', CASE WHEN m->>'kind' = 'video' THEN 'video' ELSE 'image' END));
      END IF;
    END LOOP;
    INSERT INTO warranty_claim_items (claim_id, sort_order, product_name, brand, supplier_name, supplier_order_ref, supplier_model,
                                      client_model, problem, qty, received_at, complaint_date, media)
    VALUES (v_id, n,
            NULLIF(left(trim(COALESCE(it->>'product_name','')), 300), ''), v_brand,
            NULLIF(left(trim(COALESCE(it->>'supplier_name','')), 200), ''),
            NULLIF(left(trim(COALESCE(it->>'supplier_order_ref','')), 100), ''),
            NULLIF(left(trim(COALESCE(it->>'supplier_model','')), 100), ''),
            NULLIF(left(trim(COALESCE(it->>'client_model','')), 100), ''),
            NULLIF(left(trim(COALESCE(it->>'problem','')), 2000), ''),
            GREATEST(1, COALESCE(NULLIF(it->>'qty','')::int, 1)),
            NULLIF(it->>'received_at','')::date,
            COALESCE(NULLIF(it->>'complaint_date','')::date, current_date),
            v_media);
  END LOOP;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_delete_warranty_claim(p_session_id uuid, p_claim_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF NOT client_portal_can(p_session_id, 'garantias') THEN RAISE EXCEPTION 'not allowed'; END IF;
  DELETE FROM warranty_claims WHERE id = p_claim_id AND client_id = v_client_id AND status = 'open';
END; $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'client_portal_get_me(uuid)','client_portal_get_warranties(uuid)',
    'client_portal_save_warranty_claim(uuid,uuid,uuid,text,jsonb)','client_portal_delete_warranty_claim(uuid,uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', f);
  END LOOP;
END $$;
