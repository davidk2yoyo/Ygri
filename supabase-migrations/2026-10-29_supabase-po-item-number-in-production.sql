-- client_portal_get_orders' purchase_orders.items left out item_number (only
-- description/picture/quantity/ready_at/expected_ready_date), so the client
-- portal's "Producción" tab could never show it even though the staff side
-- (purchase_order_items.item_number) always had it. Only the jsonb content
-- changes here, not the RETURNS TABLE column list, so no DROP FUNCTION needed
-- this time (see 2026-10-26_supabase-po-production-readiness.sql for when it is).
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
                'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', poi.id, 'item_number', poi.item_number, 'description', poi.description,
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
