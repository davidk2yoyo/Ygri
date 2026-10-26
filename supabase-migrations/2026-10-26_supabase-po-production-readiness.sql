-- Per-item production readiness on a purchase order, so staff can check off
-- which products a supplier has finished (vs. still pending/estimated), and
-- the client portal can show it — read-only — grouped by supplier. Nothing in
-- the schema tracked this before (confirmed: no ready/status/eta column
-- existed anywhere on purchase_order_items, quotation_items or shipments).
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS ready_at timestamptz;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS expected_ready_date date;

-- client_portal_get_orders (2026-10-12_supabase-portal-v2.sql, fixed in
-- 2026-10-12_supabase-portal-orders-fix.sql) already returns one row per
-- track with stages/quotations/shipments/documents — adds purchase_orders,
-- one entry per supplier PO on that track, each with its items and their
-- readiness. No show_to_client gate on purchase_orders (there isn't one on
-- the table, same as stages/progress_pct already shown unconditionally).
-- Adding a column to a RETURNS TABLE signature is a return-type change, which
-- Postgres won't let CREATE OR REPLACE do in place — drop it first.
DROP FUNCTION IF EXISTS public.client_portal_get_orders(uuid);
CREATE OR REPLACE FUNCTION public.client_portal_get_orders(p_session_id uuid)
RETURNS TABLE(track_id uuid, track_name text, status text, workflow_kind text, progress_pct numeric,
              created_at timestamptz, stages jsonb, quotations jsonb, shipments jsonb, documents jsonb,
              purchase_orders jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT t.id, t.name::TEXT, t.status::TEXT, wt.name::TEXT,
    COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ts.status = 'done') / NULLIF(COUNT(*),0), 1)
              FROM track_stages ts WHERE ts.track_id = t.id), 0),
    t.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ts.id, 'name', st.name, 'status', ts.status,
                'order_index', st.order_index, 'due_date', ts.due_date) ORDER BY st.order_index)
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
              FROM client_documents d WHERE d.client_id = v_client_id AND d.show_to_client = true AND d.track_id = t.id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', po.id, 'po_number', po.po_number, 'supplier_name', sup.name,
                'status', po.status,
                'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', poi.id, 'description', poi.description,
                            'picture_url', poi.picture_url, 'quantity', poi.quantity,
                            'ready_at', poi.ready_at, 'expected_ready_date', poi.expected_ready_date)
                            ORDER BY poi.sort_order), '[]'::jsonb)
                          FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id))
                ORDER BY po.created_at)
              FROM purchase_orders po LEFT JOIN suppliers sup ON sup.id = po.supplier_id
              WHERE po.track_id = t.id), '[]'::jsonb)
  FROM tracks t
  LEFT JOIN workflow_templates wt ON wt.id = t.workflow_template_id
  WHERE t.client_id = v_client_id AND t.show_to_client = true
  ORDER BY t.created_at DESC;
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_get_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_orders(uuid) TO anon, authenticated;


-- Also surfaces track_id on client_portal_get_order's "order" object (it didn't
-- before) so a pedido that's been converted into a project can link the client
-- straight to it in Mis Órdenes — only once staff has actually published that
-- project to the client (tracks.show_to_client = true), same gate the
-- 'quotation' field below already uses.
CREATE OR REPLACE FUNCTION public.client_portal_get_order(p_session_id uuid, p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_o client_orders%ROWTYPE; v_result jsonb;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_o FROM client_orders WHERE id = p_order_id AND client_id = v_client_id;
  IF v_o.id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'order', jsonb_build_object('id', v_o.id, 'reference', v_o.reference, 'status', v_o.status,
              'revision', v_o.revision, 'source_file_name', v_o.source_file_name, 'created_at', v_o.created_at,
              'quotation_id', v_o.quotation_id,
              'track_id', (SELECT t.id FROM tracks t WHERE t.id = v_o.track_id AND t.show_to_client = true)),
    'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'sheet_name', l.sheet_name, 'supplier', COALESCE(s.name, l.supplier_name_raw),
        'supplier_ref', l.supplier_ref, 'name', l.name, 'color', l.color, 'qty', l.qty, 'price', l.client_price,
        'client_ref', l.client_ref, 'brand', l.brand, 'marking', l.marking, 'packaging', l.packaging,
        'notes', l.notes, 'photo_url', l.photo_url,
        'offer', CASE WHEN qi.id IS NULL OR q.show_to_client IS NOT TRUE THEN NULL ELSE jsonb_build_object(
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
    'quotation', (SELECT jsonb_build_object('id', q.id, 'quote_number', q.quote_number, 'currency', q.currency, 'total_amount', q.total_amount)
                  FROM quotations q JOIN tracks t ON t.id = q.track_id
                  WHERE q.id = v_o.quotation_id AND q.show_to_client = true AND t.show_to_client = true)
  ) INTO v_result;

  UPDATE client_orders SET client_seen_at = now() WHERE id = v_o.id;
  RETURN v_result;
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_get_order(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_order(uuid,uuid) TO anon, authenticated;
