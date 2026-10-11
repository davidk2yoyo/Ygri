-- ============================================================
-- CLIENT PORTAL v2
--  1. Visibility: a project (track) must be published for the client to see
--     ANYTHING under it; quotations/shipments also get their own switch.
--     (Before this, shipments/quotations/reports/dashboard counters were
--     returned regardless of tracks.show_to_client.)
--  2. Shipments can be samples; tracking events are exposed.
--  3. Mis Ordenes = one RPC returning each published project with its
--     stages, quotations, shipments and documents.
--  4. First portal WRITE path: the client submits a purchase order (parsed
--     in the browser) as lines; staff review it in Client Orders.
-- Additive except the replaced portal read functions.
-- ============================================================

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS show_to_client boolean NOT NULL DEFAULT true;
ALTER TABLE shipments  ADD COLUMN IF NOT EXISTS show_to_client boolean NOT NULL DEFAULT true;
ALTER TABLE shipments  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'shipment';
ALTER TABLE shipments  DROP CONSTRAINT IF EXISTS shipments_kind_check;
ALTER TABLE shipments  ADD CONSTRAINT shipments_kind_check CHECK (kind IN ('shipment','sample'));

ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff';
ALTER TABLE client_orders DROP CONSTRAINT IF EXISTS client_orders_status_check;
ALTER TABLE client_orders ADD CONSTRAINT client_orders_status_check
  CHECK (status IN ('submitted','draft','confirmed','quoted','ordered','closed'));

-- ---------- gated reads ----------
DROP FUNCTION IF EXISTS public.client_portal_get_shipments(uuid);
CREATE OR REPLACE FUNCTION public.client_portal_get_shipments(p_session_id uuid)
RETURNS TABLE(id uuid, tracking_number text, carrier text, description text, status text,
              status_detail text, origin text, destination text, estimated_delivery date,
              track_id uuid, track_name text, kind text, tracking_events jsonb, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT s.id, s.tracking_number, s.carrier, s.description, s.status, s.status_detail,
         s.origin, s.destination, s.estimated_delivery, t.id, t.name::TEXT, s.kind,
         s.tracking_events, s.created_at
  FROM shipments s JOIN tracks t ON t.id = s.track_id
  WHERE t.client_id = v_client_id AND t.show_to_client = true AND s.show_to_client = true
  ORDER BY s.created_at DESC;
END; $$;

DROP FUNCTION IF EXISTS public.client_portal_get_quotations(uuid);
CREATE OR REPLACE FUNCTION public.client_portal_get_quotations(p_session_id uuid)
RETURNS TABLE(id uuid, quote_number text, type text, document_type text, currency text, incoterm text,
              delivery_time text, notes text, total_amount numeric, track_id uuid, track_name text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT q.id, q.quote_number, q.type, q.document_type, q.currency, q.incoterm, q.delivery_time, q.notes,
         q.total_amount, t.id, t.name::TEXT, q.created_at
  FROM quotations q JOIN tracks t ON t.id = q.track_id
  WHERE t.client_id = v_client_id AND t.show_to_client = true AND q.show_to_client = true
  ORDER BY q.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_reports(p_session_id uuid)
RETURNS TABLE(id uuid, report_number text, title text, status text, visit_date date, supplier_name text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT ir.id, ir.report_number, ir.title::TEXT, ir.status::TEXT, ir.visit_date, ir.supplier_name::TEXT, ir.created_at
  FROM inspection_reports ir JOIN tracks t ON t.id = ir.track_id
  WHERE t.client_id = v_client_id AND t.show_to_client = true
  ORDER BY ir.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_dashboard(p_session_id uuid)
RETURNS TABLE(active_shipments bigint, total_quotations bigint, total_documents bigint, active_tracks bigint,
              total_reports bigint, latest_shipment text, latest_doc_name text, latest_doc_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM shipments s JOIN tracks t ON t.id = s.track_id
      WHERE t.client_id = v_client_id AND t.show_to_client AND s.show_to_client AND s.status IN ('in_transit','customs','pending')),
    (SELECT COUNT(*) FROM quotations q JOIN tracks t ON t.id = q.track_id
      WHERE t.client_id = v_client_id AND t.show_to_client AND q.show_to_client),
    (SELECT COUNT(*) FROM client_documents WHERE client_id = v_client_id AND show_to_client = true),
    (SELECT COUNT(*) FROM tracks WHERE client_id = v_client_id AND show_to_client = true),
    (SELECT COUNT(*) FROM inspection_reports ir JOIN tracks t ON t.id = ir.track_id
      WHERE t.client_id = v_client_id AND t.show_to_client),
    (SELECT s.tracking_number FROM shipments s JOIN tracks t ON t.id = s.track_id
      WHERE t.client_id = v_client_id AND t.show_to_client AND s.show_to_client ORDER BY s.created_at DESC LIMIT 1),
    (SELECT d.name FROM client_documents d WHERE d.client_id = v_client_id AND d.show_to_client ORDER BY d.created_at DESC LIMIT 1),
    (SELECT d.document_type FROM client_documents d WHERE d.client_id = v_client_id AND d.show_to_client ORDER BY d.created_at DESC LIMIT 1);
END; $$;

-- ---------- Mis Ordenes: published projects with everything under them ----------
CREATE OR REPLACE FUNCTION public.client_portal_get_orders(p_session_id uuid)
RETURNS TABLE(track_id uuid, track_name text, status text, workflow_kind text, progress_pct numeric,
              created_at timestamptz, stages jsonb, quotations jsonb, shipments jsonb, documents jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT t.id, t.name::TEXT, t.status::TEXT, t.workflow_kind::TEXT,
    COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ts.status = 'done') / NULLIF(COUNT(*),0), 1)
              FROM track_stages ts WHERE ts.track_id = t.id), 0),
    t.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ts.id, 'name', st.name, 'status', ts.status,
                'order_index', ts.order_index, 'due_date', ts.due_date) ORDER BY ts.order_index)
              FROM track_stages ts LEFT JOIN stage_templates st ON st.id = ts.stage_template_id
              WHERE ts.track_id = t.id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'quote_number', q.quote_number, 'document_type', q.document_type,
                'type', q.type, 'currency', q.currency, 'total_amount', q.total_amount, 'incoterm', q.incoterm,
                'delivery_time', q.delivery_time, 'created_at', q.created_at) ORDER BY q.created_at DESC)
              FROM quotations q WHERE q.track_id = t.id AND q.show_to_client = true), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'tracking_number', s.tracking_number, 'carrier', s.carrier,
                'description', s.description, 'status', s.status, 'status_detail', s.status_detail, 'origin', s.origin,
                'destination', s.destination, 'estimated_delivery', s.estimated_delivery, 'kind', s.kind,
                'tracking_events', s.tracking_events) ORDER BY s.created_at DESC)
              FROM shipments s WHERE s.track_id = t.id AND s.show_to_client = true), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'document_type', d.document_type,
                'file_url', d.file_url, 'file_name', d.file_name, 'file_size', d.file_size, 'notes', d.notes,
                'reference_number', d.reference_number, 'shipment_id', d.shipment_id, 'created_at', d.created_at)
                ORDER BY d.created_at DESC)
              FROM client_documents d WHERE d.client_id = v_client_id AND d.show_to_client = true AND d.track_id = t.id), '[]'::jsonb)
  FROM tracks t
  WHERE t.client_id = v_client_id AND t.show_to_client = true
  ORDER BY t.created_at DESC;
END; $$;

-- ---------- Client submits a purchase order ----------
CREATE OR REPLACE FUNCTION public.client_portal_submit_order(
  p_session_id uuid, p_reference text, p_file_name text, p_file_url text, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_client_id UUID; v_name TEXT; v_order UUID; v_n INTEGER; v_i INTEGER := 0; l jsonb;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'lines must be an array'; END IF;
  v_n := jsonb_array_length(p_lines);
  IF v_n = 0 THEN RAISE EXCEPTION 'the order has no lines'; END IF;
  IF v_n > 1000 THEN RAISE EXCEPTION 'too many lines (max 1000)'; END IF;

  INSERT INTO client_orders (client_id, reference, source_file_name, source_file_url, status, source)
  VALUES (v_client_id, NULLIF(left(trim(p_reference), 200), ''), left(p_file_name, 300), left(p_file_url, 1000), 'submitted', 'portal')
  RETURNING id INTO v_order;

  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO client_order_lines (order_id, sheet_name, sheet_row, supplier_name_raw, supplier_ref, name, color,
                                    qty, client_price, client_ref, brand, marking, packaging, notes, sort_order)
    VALUES (v_order, left(l->>'sheet_name', 100), NULLIF(l->>'sheet_row','')::int,
            left(l->>'supplier', 200), left(l->>'supplier_ref', 200), left(l->>'name', 500), left(l->>'color', 100),
            NULLIF(l->>'qty','')::numeric, NULLIF(l->>'price','')::numeric, left(l->>'client_ref', 200),
            left(l->>'brand', 200), NULLIF(l->>'marking','')::boolean, left(l->>'packaging', 200),
            left(l->>'notes', 1000), v_i);
    v_i := v_i + 1;
  END LOOP;
  RETURN v_order;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_client_orders(p_session_id uuid)
RETURNS TABLE(id uuid, reference text, status text, source text, line_count bigint, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT o.id, o.reference, o.status, o.source,
         (SELECT COUNT(*) FROM client_order_lines l WHERE l.order_id = o.id), o.created_at
  FROM client_orders o WHERE o.client_id = v_client_id ORDER BY o.created_at DESC;
END; $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'client_portal_get_shipments(uuid)','client_portal_get_quotations(uuid)','client_portal_get_reports(uuid)',
    'client_portal_get_dashboard(uuid)','client_portal_get_orders(uuid)',
    'client_portal_submit_order(uuid,text,text,text,jsonb)','client_portal_get_client_orders(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', f);
  END LOOP;
END $$;

-- Insert-only drop box for the client's original Excel (the portal is not a Supabase Auth user).
INSERT INTO storage.buckets (id, name, public) VALUES ('client-portal-uploads', 'client-portal-uploads', true)
  ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "portal_uploads_insert" ON storage.objects;
CREATE POLICY "portal_uploads_insert" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'client-portal-uploads');
