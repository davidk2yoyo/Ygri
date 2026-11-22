-- ============================================================================
-- CLIENT PORTAL — roles & permissions per user, "who sees prices", document audience.
-- Run in the Supabase SQL Editor. Safe to re-run. Apply AFTER 2026-11-10 (quotation detail).
--
-- Why: a client company has several people (owner, buyers, warehouse staff). Until now every
-- portal user saw everything, including prices. Now each user has a role (a preset) plus
-- individual permissions, chosen by staff in the client's page.
--
-- Existing users are NOT affected: they become role 'admin' (everything allowed).
--
-- What the SERVER enforces (not just hidden in the UI):
--   * 'prices'  — quotations/proformas/invoices amounts, payments, pedido offers, the quotation
--                 Excel, the "Consultar Cotizaciones" AI, and documents marked audience='commercial'.
-- The other module permissions (envios, ordenes, pedidos, documentos, reportes, asistente,
-- cotizaciones_ia) hide the menu entry and the page in the portal; the data behind them
-- (shipments, production, reports) carries no prices.
-- ============================================================================

-- ── 1. Users: name, role, permissions, active ─────────────────────────────────
ALTER TABLE client_portal_users
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS role        text    NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS permissions jsonb   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active      boolean NOT NULL DEFAULT true;

-- ── 2. Documents: who inside the client company may open them ─────────────────
-- 'all'        = every portal user with access to Documentos
-- 'commercial' = only users allowed to see prices (invoices, proformas, price lists…)
ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_documents_audience_chk') THEN
    ALTER TABLE client_documents ADD CONSTRAINT client_documents_audience_chk CHECK (audience IN ('all','commercial'));
  END IF;
END $$;

-- Existing invoice/proforma-type documents are commercial by nature: hide them from users without prices
UPDATE client_documents SET audience = 'commercial' WHERE document_type = 'invoice' AND audience = 'all';

-- ── 3. Permission helpers ─────────────────────────────────────────────────────
-- The user behind a live session (NULL when the session is invalid/expired or the user is disabled)
CREATE OR REPLACE FUNCTION public.client_portal_user_of_session(p_session_id uuid)
RETURNS client_portal_users
LANGUAGE sql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
  SELECT u.* FROM client_portal_sessions s
  JOIN client_portal_users u ON u.id = s.client_portal_user_id
  WHERE s.id = p_session_id AND s.expires_at > now() AND u.active
$$;

CREATE OR REPLACE FUNCTION public.client_portal_can(p_session_id uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
DECLARE v client_portal_users;
BEGIN
  v := public.client_portal_user_of_session(p_session_id);
  IF v.id IS NULL THEN RETURN false; END IF;
  IF v.role = 'admin' THEN RETURN true; END IF;
  RETURN COALESCE(v.permissions ->> p_key, 'false') = 'true';
END; $$;

-- Who am I + resolved permissions, for the portal UI
CREATE OR REPLACE FUNCTION public.client_portal_get_me(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
DECLARE v client_portal_users; k text; perms jsonb := '{}'::jsonb;
BEGIN
  v := public.client_portal_user_of_session(p_session_id);
  IF v.id IS NULL THEN RETURN NULL; END IF;
  FOREACH k IN ARRAY ARRAY['prices','envios','ordenes','pedidos','documentos','reportes','asistente','cotizaciones_ia'] LOOP
    perms := perms || jsonb_build_object(k, v.role = 'admin' OR COALESCE(v.permissions ->> k, 'false') = 'true');
  END LOOP;
  RETURN jsonb_build_object('user_id', v.id, 'name', v.name, 'email', v.email, 'role', v.role, 'permissions', perms);
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_user_of_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.client_portal_can(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_portal_get_me(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_can(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_portal_get_me(uuid) TO anon, authenticated;

-- ── 4. Login / session: disabled users cannot sign in and their sessions stop working ──
CREATE OR REPLACE FUNCTION client_portal_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (session_id UUID, client_id UUID, client_name TEXT, expires_at TIMESTAMPTZ)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
  v_user   client_portal_users%ROWTYPE;
  v_client clients%ROWTYPE;
  v_sid    UUID;
BEGIN
  SELECT * INTO v_user FROM client_portal_users WHERE email = lower(trim(p_email));
  IF v_user.id IS NULL OR NOT v_user.active THEN RETURN; END IF;
  IF v_user.password_hash != extensions.crypt(p_password, v_user.password_hash) THEN RETURN; END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_user.client_id;
  INSERT INTO client_portal_sessions (client_portal_user_id) VALUES (v_user.id) RETURNING id INTO v_sid;

  RETURN QUERY
  SELECT v_sid, v_client.id, v_client.company_name::TEXT,
         (SELECT s.expires_at FROM client_portal_sessions s WHERE s.id = v_sid);
END; $$;

CREATE OR REPLACE FUNCTION client_portal_verify_session(p_session_id UUID)
RETURNS TABLE (client_id UUID, client_name TEXT)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
  v_user   client_portal_users%ROWTYPE;
  v_client clients%ROWTYPE;
BEGIN
  v_user := public.client_portal_user_of_session(p_session_id);
  IF v_user.id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_client FROM clients WHERE id = v_user.client_id;
  IF v_client.id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT v_client.id, v_client.company_name::TEXT;
END; $$;

-- ── 5. Portal RPCs that carry prices or commercial documents (now permission-aware) ──
-- Each is the latest definition of that function, with the permission check added.

CREATE OR REPLACE FUNCTION public.client_portal_get_orders(p_session_id uuid)
RETURNS TABLE(track_id uuid, track_name text, status text, workflow_kind text, progress_pct numeric,
              created_at timestamptz, stages jsonb, quotations jsonb, shipments jsonb, documents jsonb,
              purchase_orders jsonb, packing_lists jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_prices boolean;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  v_prices := client_portal_can(p_session_id, 'prices');
  RETURN QUERY
  SELECT t.id, t.name::TEXT, t.status::TEXT, wt.name::TEXT,
    COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ts.status = 'done') / NULLIF(COUNT(*),0), 1)
              FROM track_stages ts WHERE ts.track_id = t.id), 0),
    t.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ts.id, 'name', st.name, 'status', ts.status,
                'order_index', st.order_index, 'due_date', ts.due_date) ORDER BY st.order_index)
              FROM track_stages ts LEFT JOIN stage_templates st ON st.id = ts.stage_template_id
              WHERE ts.track_id = t.id), '[]'::jsonb),
    CASE WHEN NOT v_prices THEN '[]'::jsonb ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'quote_number', q.quote_number, 'document_type', q.document_type,
                'type', q.type, 'currency', q.currency, 'total_amount', q.total_amount, 'incoterm', q.incoterm,
                'delivery_time', q.delivery_time, 'created_at', q.created_at, 'deposit_pct', q.deposit_pct,
                'paid_total', (SELECT COALESCE(SUM(qp.amount), 0) FROM quotation_payments qp WHERE qp.quotation_id = q.id),
                'ready_value', (SELECT COALESCE(SUM(qi.price * qi.quantity), 0)
                                 FROM quotation_items qi
                                 WHERE qi.quotation_id = q.id
                                   AND qi.item_number IS NOT NULL AND qi.item_number <> ''
                                   AND EXISTS (SELECT 1 FROM purchase_order_items poi
                                               JOIN purchase_orders po ON po.id = poi.purchase_order_id
                                               WHERE po.track_id = t.id
                                                 AND poi.item_number = qi.item_number
                                                 AND poi.ready_at IS NOT NULL)))
                ORDER BY q.created_at DESC)
              FROM quotations q WHERE q.track_id = t.id AND q.show_to_client = true), '[]'::jsonb) END,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'tracking_number', s.tracking_number, 'carrier', s.carrier,
                'description', s.description, 'status', s.status, 'status_detail', s.status_detail, 'origin', s.origin,
                'destination', s.destination, 'estimated_delivery', s.estimated_delivery, 'kind', s.kind,
                'tracking_events', s.tracking_events) ORDER BY s.created_at DESC)
              FROM shipments s WHERE s.track_id = t.id AND s.show_to_client = true), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'document_type', d.document_type,
                'file_url', d.file_url, 'file_name', d.file_name, 'file_size', d.file_size, 'notes', d.notes,
                'reference_number', d.reference_number, 'shipment_id', d.shipment_id, 'created_at', d.created_at)
                ORDER BY d.created_at DESC)
              FROM client_documents d WHERE d.client_id = v_client_id AND d.show_to_client = true AND d.track_id = t.id
                AND (v_prices OR d.audience = 'all')), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', po.id, 'po_number', po.po_number, 'supplier_name', sup.name,
                'status', po.status,
                'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', poi.id, 'item_number', poi.item_number, 'description', poi.description,
                            'picture_url', poi.picture_url, 'quantity', poi.quantity,
                            'ready_at', poi.ready_at, 'expected_ready_date', poi.expected_ready_date)
                            ORDER BY poi.sort_order), '[]'::jsonb)
                          FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id),
                'photos', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', pop.id, 'photo_url', pop.photo_url, 'caption', pop.caption)
                            ORDER BY pop.created_at), '[]'::jsonb)
                          FROM purchase_order_photos pop WHERE pop.purchase_order_id = po.id))
                ORDER BY po.created_at)
              FROM purchase_orders po LEFT JOIN suppliers sup ON sup.id = po.supplier_id
              WHERE po.track_id = t.id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', pl.id, 'pl_number', pl.pl_number, 'mode', pl.mode, 'notes', pl.notes, 'quote_number', q.quote_number,
                'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                            'id', pli.id, 'item_number', pli.item_number, 'description', pli.description, 'color', pli.color,
                            'carton_qty', pli.carton_qty, 'qty', pli.qty, 'length_cm', pli.length_cm, 'width_cm', pli.width_cm,
                            'height_cm', pli.height_cm, 'cbm', pli.cbm, 'nw', pli.nw, 'gw', pli.gw,
                            'supplier_name', COALESCE(sup2.name, pli.supplier_name_raw))
                            ORDER BY pli.sort_order), '[]'::jsonb)
                          FROM packing_list_items pli LEFT JOIN suppliers sup2 ON sup2.id = pli.supplier_id
                          WHERE pli.packing_list_id = pl.id),
                'supplier_totals', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                            'id', pst.id, 'supplier_name', pst.supplier_name,
                            'carton_qty', pst.carton_qty, 'cbm', pst.cbm, 'nw', pst.nw, 'gw', pst.gw)
                            ORDER BY pst.sort_order), '[]'::jsonb)
                          FROM packing_list_supplier_totals pst WHERE pst.packing_list_id = pl.id))
                ORDER BY pl.created_at)
              FROM packing_lists pl JOIN quotations q ON q.id = pl.quotation_id
              WHERE q.track_id = t.id AND pl.show_to_client = true), '[]'::jsonb)
  FROM tracks t
  LEFT JOIN workflow_templates wt ON wt.id = t.workflow_template_id
  WHERE t.client_id = v_client_id AND t.show_to_client = true
  ORDER BY t.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_order(p_session_id uuid, p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_o client_orders%ROWTYPE; v_result jsonb; v_prices boolean;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;
  v_prices := client_portal_can(p_session_id, 'prices');
  SELECT * INTO v_o FROM client_orders WHERE id = p_order_id AND client_id = v_client_id;
  IF v_o.id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'order', jsonb_build_object('id', v_o.id, 'reference', v_o.reference, 'status', v_o.status,
              'revision', v_o.revision, 'source_file_name', v_o.source_file_name, 'created_at', v_o.created_at,
              'quotation_id', v_o.quotation_id,
              'track_id', (SELECT t.id FROM tracks t WHERE t.id = v_o.track_id AND t.show_to_client = true)),
    'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'sheet_name', l.sheet_name, 'supplier', COALESCE(s.name, l.supplier_name_raw),
        'supplier_ref', l.supplier_ref, 'name', l.name, 'color', l.color, 'qty', l.qty, 'price', CASE WHEN v_prices THEN l.client_price END,
        'client_ref', l.client_ref, 'brand', l.brand, 'marking', l.marking, 'packaging', l.packaging,
        'notes', l.notes, 'photo_url', l.photo_url,
        'offer', CASE WHEN NOT v_prices OR qi.id IS NULL OR q.show_to_client IS NOT TRUE THEN NULL ELSE jsonb_build_object(
            'price', qi.price, 'quantity', qi.quantity, 'all_inclusive', qi.all_inclusive,
            'options', COALESCE((SELECT jsonb_agg(jsonb_build_object('type', o2.option_type, 'label', o2.label, 'extra_price', o2.extra_price) ORDER BY o2.sort_order)
                                 FROM quotation_item_options o2 WHERE o2.quotation_item_id = qi.id), '[]'::jsonb)) END
      ) ORDER BY l.sort_order)
      FROM client_order_lines l
      LEFT JOIN suppliers s ON s.id = l.supplier_id
      LEFT JOIN quotation_items qi ON qi.client_order_line_id = l.id AND qi.quotation_id = v_o.quotation_id
      LEFT JOIN quotations q ON q.id = qi.quotation_id
      WHERE l.order_id = v_o.id), '[]'::jsonb),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'actor_type', e.actor_type, 'actor_name', e.actor_name,
        'kind', e.kind, 'note', e.note, 'changes', e.changes, 'created_at', e.created_at) ORDER BY e.created_at DESC)
      FROM client_order_events e WHERE e.order_id = v_o.id), '[]'::jsonb),
    'quotation', CASE WHEN NOT v_prices THEN NULL ELSE (SELECT jsonb_build_object('id', q.id, 'quote_number', q.quote_number, 'currency', q.currency, 'total_amount', q.total_amount)
                  FROM quotations q JOIN tracks t ON t.id = q.track_id
                  WHERE q.id = v_o.quotation_id AND q.show_to_client = true AND t.show_to_client = true) END
  ) INTO v_result;

  UPDATE client_orders SET client_seen_at = now() WHERE id = v_o.id;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_quotations(p_session_id uuid)
RETURNS TABLE(id uuid, quote_number text, type text, document_type text, currency text, incoterm text,
              delivery_time text, notes text, total_amount numeric, track_id uuid, track_name text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  IF NOT client_portal_can(p_session_id, 'prices') THEN RETURN; END IF;
  RETURN QUERY
  SELECT q.id, q.quote_number, q.type, q.document_type, q.currency, q.incoterm, q.delivery_time, q.notes,
         q.total_amount, t.id, t.name::TEXT, q.created_at
  FROM quotations q JOIN tracks t ON t.id = q.track_id
  WHERE t.client_id = v_client_id AND t.show_to_client = true AND q.show_to_client = true
  ORDER BY q.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_quotation_detail(p_session_id uuid, p_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_q quotations%ROWTYPE; v_qj jsonb; v_items jsonb; v_pay jsonb;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;
  IF NOT client_portal_can(p_session_id, 'prices') THEN RETURN NULL; END IF;

  SELECT q.* INTO v_q FROM quotations q JOIN tracks t ON t.id = q.track_id
   WHERE q.id = p_quotation_id AND q.show_to_client = true AND t.show_to_client = true AND t.client_id = v_client_id;
  IF v_q.id IS NULL THEN RETURN NULL; END IF;
  v_qj := to_jsonb(v_q);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', qi.id, 'item_number', qi.item_number, 'client_ref', to_jsonb(qi)->'client_ref',
      'description', qi.description, 'picture_url', qi.picture_url, 'quantity', qi.quantity, 'price', qi.price,
      'moq', to_jsonb(qi)->'moq', 'all_inclusive', to_jsonb(qi)->'all_inclusive',
      'selectedOptions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('option_type', o.option_type, 'label', o.label, 'extra_price', o.extra_price)
                            ORDER BY o.sort_order), '[]'::jsonb) FROM quotation_item_options o WHERE o.quotation_item_id = qi.id),
      'priceTiers', (SELECT COALESCE(jsonb_agg(jsonb_build_object('min_qty', t.min_qty, 'max_qty', t.max_qty, 'price', t.price, 'notes', t.notes)
                            ORDER BY t.min_qty), '[]'::jsonb) FROM quotation_item_price_tiers t WHERE t.quotation_item_id = qi.id)
    ) ORDER BY qi.sort_order, qi.created_at), '[]'::jsonb)
    INTO v_items FROM quotation_items qi WHERE qi.quotation_id = v_q.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'payment_date', p.payment_date, 'amount', p.amount,
           'currency', p.currency, 'method', to_jsonb(p)->'method') ORDER BY p.payment_date), '[]'::jsonb)
    INTO v_pay FROM quotation_payments p WHERE p.quotation_id = v_q.id;

  RETURN jsonb_build_object(
    'quotation', jsonb_build_object(
      'id', v_q.id, 'quote_number', v_qj->'quote_number', 'document_type', v_qj->'document_type', 'type', v_qj->'type',
      'currency', v_qj->'currency', 'incoterm', v_qj->'incoterm', 'incoterm_location', v_qj->'incoterm_location',
      'delivery_time', v_qj->'delivery_time', 'valid_until', v_qj->'valid_until', 'notes', v_qj->'notes',
      'negotiation_term', v_qj->'negotiation_term', 'commission_pct', v_qj->'commission_pct',
      'show_commission', v_qj->'show_commission', 'deposit_pct', v_qj->'deposit_pct',
      'project_name', v_qj->'project_name', 'created_at', v_qj->'created_at', 'track_id', v_qj->'track_id'),
    'items', v_items,
    'payments', v_pay);
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_quotations_ai_status(p_session_id uuid)
RETURNS TABLE (enabled boolean, dify_dataset_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID;
BEGIN
  SELECT c.client_id INTO v_client_id FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  IF NOT (client_portal_can(p_session_id, 'prices') AND client_portal_can(p_session_id, 'cotizaciones_ia')) THEN RETURN; END IF;

  RETURN QUERY
  SELECT q.enabled, q.dify_dataset_id
  FROM client_quotations_ai q
  WHERE q.client_id = v_client_id;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_documents(p_session_id uuid)
RETURNS TABLE(id uuid, name text, document_type text, file_url text, file_name text,
              file_size integer, notes text, created_at timestamptz,
              shipment_id uuid, track_id uuid, reference_number text,
              folder_id uuid, uploaded_by_type text, uploaded_by_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_prices boolean;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  v_prices := client_portal_can(p_session_id, 'prices');
  RETURN QUERY
  SELECT d.id, d.name, d.document_type, d.file_url, d.file_name, d.file_size, d.notes, d.created_at,
         d.shipment_id, d.track_id, d.reference_number, d.folder_id, d.uploaded_by_type, d.uploaded_by_name
  FROM client_documents d
  LEFT JOIN tracks t ON t.id = d.track_id
  WHERE d.client_id = v_client_id AND d.show_to_client = true AND (v_prices OR d.audience = 'all')
    AND (d.track_id IS NULL OR t.show_to_client = true)
    AND (d.folder_id IS NULL OR d.folder_id IN (SELECT f.id FROM portal_visible_folders(v_client_id) f))
  ORDER BY d.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_get_document_events(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_prices boolean;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_prices := client_portal_can(p_session_id, 'prices');
  RETURN COALESCE((SELECT jsonb_agg(x ORDER BY (x->>'created_at') DESC) FROM (
    SELECT jsonb_build_object('id', e.id, 'actor_type', e.actor_type, 'actor_name', e.actor_name, 'kind', e.kind,
                              'subject', e.subject, 'details', e.details, 'created_at', e.created_at) AS x
    FROM client_document_events e
    LEFT JOIN client_documents d ON d.id = e.document_id
    LEFT JOIN tracks t ON t.id = d.track_id
    WHERE e.client_id = v_client_id
      AND (e.actor_type = 'client'
           OR (e.kind IN ('uploaded','shown') AND d.id IS NOT NULL AND d.show_to_client = true AND (v_prices OR d.audience = 'all')
               AND (d.track_id IS NULL OR t.show_to_client = true)
               AND (d.folder_id IS NULL OR d.folder_id IN (SELECT f.id FROM portal_visible_folders(v_client_id) f))))
    ORDER BY e.created_at DESC LIMIT 100) q), '[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_documents_unread(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_seen timestamptz; v_n integer; v_prices boolean;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN 0; END IF;
  v_prices := client_portal_can(p_session_id, 'prices');
  SELECT s.client_seen_at INTO v_seen FROM client_documents_seen s WHERE s.client_id = v_client_id;
  SELECT count(DISTINCT d.id) INTO v_n
  FROM client_document_events e
  JOIN client_documents d ON d.id = e.document_id
  LEFT JOIN tracks t ON t.id = d.track_id
  WHERE e.client_id = v_client_id AND e.actor_type = 'staff' AND e.kind IN ('uploaded','shown')
    AND e.created_at > COALESCE(v_seen, 'epoch'::timestamptz)
    AND d.show_to_client = true AND (v_prices OR d.audience = 'all') AND (d.track_id IS NULL OR t.show_to_client = true)
    AND (d.folder_id IS NULL OR d.folder_id IN (SELECT f.id FROM portal_visible_folders(v_client_id) f));
  RETURN v_n;
END; $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'client_portal_get_orders(uuid)','client_portal_get_order(uuid,uuid)','client_portal_get_quotations(uuid)',
    'client_portal_get_quotation_detail(uuid,uuid)','client_portal_get_quotations_ai_status(uuid)',
    'client_portal_get_documents(uuid)','client_portal_get_document_events(uuid)','client_portal_documents_unread(uuid)',
    'client_portal_login(text,text)','client_portal_verify_session(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', f);
  END LOOP;
END $$;

-- ── 6. Staff-side user management (only signed-in staff; never callable by the public) ──
CREATE OR REPLACE FUNCTION public.admin_list_client_portal_users(p_client_id uuid)
RETURNS TABLE (id uuid, email text, name text, role text, permissions jsonb, active boolean,
               created_at timestamptz, last_login timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT u.id, u.email, u.name, u.role, u.permissions, u.active, u.created_at,
         (SELECT max(s.created_at) FROM client_portal_sessions s WHERE s.client_portal_user_id = u.id)
  FROM client_portal_users u WHERE u.client_id = p_client_id ORDER BY u.created_at;
END; $$;

-- Create (p_user_id NULL) or edit a portal user. Password is required on create and optional on edit
-- (changing it signs the user out everywhere).
CREATE OR REPLACE FUNCTION public.admin_save_client_portal_user(
  p_client_id uuid, p_user_id uuid, p_email text, p_password text, p_name text,
  p_role text, p_permissions jsonb, p_active boolean)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_email text := lower(trim(COALESCE(p_email, '')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF v_email = '' OR position('@' in v_email) = 0 THEN RAISE EXCEPTION 'A valid email is required'; END IF;
  IF p_role NOT IN ('admin','comercial','bodega','disenos','finanzas','custom') THEN RAISE EXCEPTION 'Unknown role %', p_role; END IF;

  IF p_user_id IS NULL THEN
    IF p_password IS NULL OR length(p_password) < 8 THEN RAISE EXCEPTION 'Password must be at least 8 characters'; END IF;
    IF EXISTS (SELECT 1 FROM client_portal_users WHERE email = v_email) THEN
      RAISE EXCEPTION 'That email is already used by another portal user';
    END IF;
    INSERT INTO client_portal_users (client_id, email, password_hash, name, role, permissions, active)
    VALUES (p_client_id, v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
            NULLIF(trim(COALESCE(p_name, '')), ''), p_role, COALESCE(p_permissions, '{}'::jsonb), COALESCE(p_active, true))
    RETURNING id INTO v_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM client_portal_users WHERE id = p_user_id AND client_id = p_client_id) THEN
      RAISE EXCEPTION 'User not found for this client';
    END IF;
    IF EXISTS (SELECT 1 FROM client_portal_users WHERE email = v_email AND id <> p_user_id) THEN
      RAISE EXCEPTION 'That email is already used by another portal user';
    END IF;
    IF p_password IS NOT NULL AND p_password <> '' AND length(p_password) < 8 THEN RAISE EXCEPTION 'Password must be at least 8 characters'; END IF;
    UPDATE client_portal_users SET
      email = v_email, name = NULLIF(trim(COALESCE(p_name, '')), ''), role = p_role,
      permissions = COALESCE(p_permissions, '{}'::jsonb), active = COALESCE(p_active, true),
      password_hash = CASE WHEN p_password IS NOT NULL AND p_password <> ''
                           THEN extensions.crypt(p_password, extensions.gen_salt('bf')) ELSE password_hash END,
      updated_at = now()
    WHERE id = p_user_id;
    v_id := p_user_id;
    IF p_password IS NOT NULL AND p_password <> '' THEN
      DELETE FROM client_portal_sessions WHERE client_portal_user_id = p_user_id;
    END IF;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_client_portal_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM client_portal_users WHERE id = p_user_id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_list_client_portal_users(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_client_portal_user(uuid, uuid, text, text, text, text, jsonb, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_client_portal_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_client_portal_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_client_portal_user(uuid, uuid, text, text, text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_client_portal_user(uuid) TO authenticated;

-- The three original staff functions were callable by anyone holding the public anon key
-- (they never had a REVOKE): that would let a stranger mint or wipe a client login. Staff only now.
REVOKE ALL ON FUNCTION public.admin_upsert_client_portal_user(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_client_portal_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_client_portal_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_client_portal_user(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_client_portal_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_client_portal_info(uuid) TO authenticated;
