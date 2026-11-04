-- Packing lists: a "by supplier" summary mode alongside the existing
-- item-by-item ("detailed") mode, and a dedicated show_to_client flag so
-- staff can publish a specific packing list to the client portal without
-- exposing every one automatically.
ALTER TABLE packing_lists ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'detailed';
ALTER TABLE packing_lists ADD COLUMN IF NOT EXISTS show_to_client boolean NOT NULL DEFAULT false;
ALTER TABLE packing_lists DROP CONSTRAINT IF EXISTS packing_lists_mode_check;
ALTER TABLE packing_lists ADD CONSTRAINT packing_lists_mode_check CHECK (mode IN ('detailed', 'by_supplier'));

-- Per-item supplier, so items can be grouped in "by supplier" mode. Wasn't
-- captured before — "Import items from quote" never even fetched it, even
-- though quotation_items.supplier_id has always been there.
ALTER TABLE packing_list_items ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id);
ALTER TABLE packing_list_items ADD COLUMN IF NOT EXISTS supplier_name_raw text;

-- One totals row per supplier group in "by supplier" mode — typed by staff
-- directly (cartons/CBM/weights for the whole consolidated shipment), not
-- computed from the individual items, since real packing rarely tracks
-- box-by-box once many small SKUs are consolidated together into cartons.
CREATE TABLE IF NOT EXISTS packing_list_supplier_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_list_id uuid NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id),
  supplier_name text,
  carton_qty integer,
  cbm numeric(12,4),
  nw numeric(12,2),
  gw numeric(12,2),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Expression index so at most one "no supplier" bucket is allowed too
-- (plain UNIQUE(packing_list_id, supplier_id) wouldn't enforce that, since
-- NULL <> NULL in a uniqueness check).
CREATE UNIQUE INDEX IF NOT EXISTS packing_list_supplier_totals_unique
  ON packing_list_supplier_totals (packing_list_id, COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE packing_list_supplier_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff full access" ON packing_list_supplier_totals;
CREATE POLICY "staff full access" ON packing_list_supplier_totals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- RLS alone isn't enough — table-level GRANT needed too (see
-- 2026-10-28_supabase-client-quotations-ai-grants.sql for the same gotcha).
GRANT SELECT, INSERT, UPDATE, DELETE ON packing_list_supplier_totals TO authenticated;

-- Adds packing_lists to client_portal_get_orders (one entry per quotation
-- with a published packing list) — changes the RETURNS TABLE column list,
-- so DROP FUNCTION is required first (see
-- 2026-10-26_supabase-po-production-readiness.sql for the same gotcha).
DROP FUNCTION IF EXISTS public.client_portal_get_orders(uuid);
CREATE OR REPLACE FUNCTION public.client_portal_get_orders(p_session_id uuid)
RETURNS TABLE(track_id uuid, track_name text, status text, workflow_kind text, progress_pct numeric,
              created_at timestamptz, stages jsonb, quotations jsonb, shipments jsonb, documents jsonb,
              purchase_orders jsonb, packing_lists jsonb)
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
                            'id', pli.id, 'item_number', pli.item_number, 'description', pli.description,
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

REVOKE ALL ON FUNCTION public.client_portal_get_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_orders(uuid) TO anon, authenticated;
