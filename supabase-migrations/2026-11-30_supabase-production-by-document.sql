-- ============================================================================
-- PRODUCTION BY DOCUMENT (after splitting a proforma/invoice). Safe to re-run. Apply AFTER 2026-11-28.
--  1. purchase_order_items.client_order_line_id: a firm link between a production item and the client's
--     order line (same id the proforma/invoice items carry), so a production item belongs to the right
--     document even when item numbers repeat (e.g. one reference in three colours) or lines were split.
--     Backfilled where the match is clear; the rest keeps matching by item number as before.
--  2. production_item_documents(track, only_visible): which proforma/invoice each production item is in
--     (and how many units there). Used by the staff Production tab and by the client portal.
--  3. client_portal_get_orders: now also returns, per quotation, its purpose and the document it was
--     split from; per production item, its documents; and "ready value" uses the firm link.
--     Based on the version in 2026-11-21 (keeps its 'prices' gate).
-- ============================================================================

-- (also created by 2026-11-28; repeated so this file stands on its own)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS split_from_id uuid REFERENCES quotations(id) ON DELETE SET NULL;

ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS client_order_line_id uuid REFERENCES client_order_lines(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_poi_client_order_line ON purchase_order_items(client_order_line_id) WHERE client_order_line_id IS NOT NULL;

-- Backfill, in three passes (each only touches items still without a link; anything unclear stays NULL
-- and keeps matching by item number, exactly as before):
-- 0) the old direct link, where it still exists
UPDATE purchase_order_items poi SET client_order_line_id = qi.client_order_line_id
FROM quotation_items qi
WHERE poi.client_order_line_id IS NULL AND poi.quotation_item_id = qi.id AND qi.client_order_line_id IS NOT NULL;

-- 1) the production item matches exactly ONE order line (same supplier, same item number)
UPDATE purchase_order_items poi SET client_order_line_id = m.line_id
FROM (
  SELECT poi2.id AS poi_id, (array_agg(DISTINCT qi.client_order_line_id))[1] AS line_id, COUNT(DISTINCT qi.client_order_line_id) AS n
  FROM purchase_order_items poi2
  JOIN purchase_orders po ON po.id = poi2.purchase_order_id
  JOIN quotations q ON q.track_id = po.track_id
  JOIN quotation_items qi ON qi.quotation_id = q.id AND qi.client_order_line_id IS NOT NULL
       AND qi.supplier_id = po.supplier_id AND lower(btrim(qi.item_number)) = lower(btrim(poi2.item_number))
  WHERE poi2.client_order_line_id IS NULL AND poi2.item_number IS NOT NULL AND btrim(poi2.item_number) <> ''
  GROUP BY poi2.id
) m
WHERE m.poi_id = poi.id AND m.n = 1;

-- 2) same reference repeated (e.g. one item in three colours): pair production items with order lines that
--    have the same supplier, item number and TOTAL quantity (summed over the project's proformas/invoices,
--    so a line already split between two documents still matches), only when both sides have the same count.
WITH po_rank AS (
  SELECT poi.id AS poi_id, po.track_id, po.supplier_id, lower(btrim(poi.item_number)) AS k, poi.quantity AS qty,
         row_number() OVER (PARTITION BY po.track_id, po.supplier_id, lower(btrim(poi.item_number)), poi.quantity ORDER BY poi.sort_order, poi.id) AS rn,
         count(*)     OVER (PARTITION BY po.track_id, po.supplier_id, lower(btrim(poi.item_number)), poi.quantity) AS cnt
  FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.purchase_order_id
  WHERE poi.client_order_line_id IS NULL AND poi.item_number IS NOT NULL AND btrim(poi.item_number) <> ''
), lines AS (
  SELECT q.track_id, qi.supplier_id, lower(btrim(qi.item_number)) AS k, qi.client_order_line_id AS line_id, SUM(qi.quantity) AS qty
  FROM quotations q JOIN quotation_items qi ON qi.quotation_id = q.id
  WHERE q.document_type IN ('proforma', 'invoice') AND qi.client_order_line_id IS NOT NULL AND qi.item_number IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM purchase_order_items x WHERE x.client_order_line_id = qi.client_order_line_id)
  GROUP BY q.track_id, qi.supplier_id, lower(btrim(qi.item_number)), qi.client_order_line_id
), line_rank AS (
  SELECT l.*, row_number() OVER (PARTITION BY track_id, supplier_id, k, qty ORDER BY line_id) AS rn,
         count(*) OVER (PARTITION BY track_id, supplier_id, k, qty) AS cnt
  FROM lines l
)
UPDATE purchase_order_items poi SET client_order_line_id = lr.line_id
FROM po_rank pr JOIN line_rank lr
  ON lr.track_id = pr.track_id AND lr.supplier_id = pr.supplier_id AND lr.k = pr.k AND lr.qty = pr.qty AND lr.rn = pr.rn AND lr.cnt = pr.cnt
WHERE pr.poi_id = poi.id AND poi.client_order_line_id IS NULL;

CREATE OR REPLACE FUNCTION public.production_item_documents(p_track_id uuid, p_only_visible boolean DEFAULT false)
RETURNS TABLE (po_item_id uuid, quotation_id uuid, quote_number text, document_type text, qty numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT poi.id, q.id, q.quote_number, q.document_type, SUM(qi.quantity)::numeric
  FROM purchase_orders po
  JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
  JOIN quotations q ON q.track_id = po.track_id AND q.document_type IN ('proforma', 'invoice') AND (NOT p_only_visible OR q.show_to_client)
  JOIN quotation_items qi ON qi.quotation_id = q.id
   AND ( (poi.client_order_line_id IS NOT NULL AND qi.client_order_line_id = poi.client_order_line_id)
      OR (poi.client_order_line_id IS NULL AND poi.item_number IS NOT NULL AND btrim(poi.item_number) <> ''
          AND lower(btrim(qi.item_number)) = lower(btrim(poi.item_number))
          AND (qi.supplier_id IS NULL OR qi.supplier_id = po.supplier_id)) )
  WHERE po.track_id = p_track_id
  GROUP BY poi.id, q.id, q.quote_number, q.document_type
$$;
REVOKE ALL ON FUNCTION public.production_item_documents(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.production_item_documents(uuid, boolean) TO authenticated;

-- Portal orders: must be dropped first only if the return type changes; it does not here.
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
                'purpose', q.purpose,
                'split_from', (SELECT p.quote_number FROM quotations p WHERE p.id = q.split_from_id AND p.show_to_client = true),
                'paid_total', (SELECT COALESCE(SUM(qp.amount), 0) FROM quotation_payments qp WHERE qp.quotation_id = q.id),
                'ready_value', (SELECT COALESCE(SUM(qi.price * qi.quantity), 0)
                                 FROM quotation_items qi
                                 WHERE qi.quotation_id = q.id
                                   AND EXISTS (SELECT 1 FROM purchase_order_items poi
                                               JOIN purchase_orders po ON po.id = poi.purchase_order_id
                                               WHERE po.track_id = t.id
                                                 AND poi.ready_at IS NOT NULL
                                                 AND ( (poi.client_order_line_id IS NOT NULL AND poi.client_order_line_id = qi.client_order_line_id)
                                                    OR (poi.client_order_line_id IS NULL AND qi.item_number IS NOT NULL AND qi.item_number <> ''
                                                        AND poi.item_number = qi.item_number) ))))
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
                            'ready_at', poi.ready_at, 'expected_ready_date', poi.expected_ready_date,
                            'docs', COALESCE((SELECT jsonb_agg(jsonb_build_object('quote_number', d.quote_number, 'document_type', d.document_type, 'qty', d.qty)
                                                ORDER BY d.quote_number)
                                              FROM public.production_item_documents(t.id, true) d WHERE d.po_item_id = poi.id), '[]'::jsonb))
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

REVOKE ALL ON FUNCTION public.client_portal_get_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_orders(uuid) TO anon, authenticated;
