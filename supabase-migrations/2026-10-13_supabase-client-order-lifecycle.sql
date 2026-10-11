-- ============================================================
-- CLIENT ORDER LIFECYCLE
--  * Both client and staff can edit an order; every change is logged
--    (client_order_events) and the other side is notified (seen-at columns).
--  * Optimistic concurrency: client_orders.revision, edits send the base
--    revision and are refused if it moved meanwhile.
--  * Order -> project -> quotation: quotation_items.client_ref carries the
--    client's own reference onto quotations.
--  * Portal RPCs: get one order (with log + what we offer), update lines,
--    comment, accept / request changes, mark seen.
-- Additive except client_portal_get_client_orders (return type changes).
-- ============================================================

ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS client_seen_at timestamptz DEFAULT now();
ALTER TABLE client_orders ADD COLUMN IF NOT EXISTS staff_seen_at timestamptz;
ALTER TABLE client_orders DROP CONSTRAINT IF EXISTS client_orders_status_check;
ALTER TABLE client_orders ADD CONSTRAINT client_orders_status_check
  CHECK (status IN ('submitted','in_review','draft','quoted','changes_requested','confirmed','ordered','closed'));

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS client_ref text;
-- QuotationForm deletes + re-inserts items on every save, so the link back to the
-- order line lives on the item itself (the form carries it through).
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS client_order_line_id uuid REFERENCES client_order_lines(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotation_items_order_line ON quotation_items(client_order_line_id) WHERE client_order_line_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS client_order_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES client_orders(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('client','staff')),
  actor_name text,
  kind text NOT NULL,
  note text,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_order_events_order ON client_order_events(order_id, created_at DESC);
ALTER TABLE client_order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_client_order_events" ON client_order_events;
CREATE POLICY "auth_all_client_order_events" ON client_order_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON client_order_events TO authenticated;

-- Existing orders: give them a first log entry so the history is never empty
INSERT INTO client_order_events (order_id, actor_type, actor_name, kind, note, created_at)
SELECT o.id, CASE WHEN o.source = 'portal' THEN 'client' ELSE 'staff' END, NULL, 'submitted', NULL, o.created_at
FROM client_orders o
WHERE NOT EXISTS (SELECT 1 FROM client_order_events e WHERE e.order_id = o.id);

-- Orders where the client acted after staff last looked (staff "unread")
CREATE OR REPLACE VIEW v_client_orders_unread WITH (security_invoker = true) AS
SELECT o.id AS order_id
FROM client_orders o
WHERE EXISTS (
  SELECT 1 FROM client_order_events e
  WHERE e.order_id = o.id AND e.actor_type = 'client'
    AND e.created_at > COALESCE(o.staff_seen_at, 'epoch'::timestamptz)
);
GRANT SELECT ON v_client_orders_unread TO authenticated;

-- ---------------- portal RPCs ----------------
DROP FUNCTION IF EXISTS public.client_portal_get_client_orders(uuid);
CREATE OR REPLACE FUNCTION public.client_portal_get_client_orders(p_session_id uuid)
RETURNS TABLE(id uuid, reference text, status text, source text, line_count bigint, created_at timestamptz,
              revision integer, unread boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT o.id, o.reference, o.status, o.source,
         (SELECT COUNT(*) FROM client_order_lines l WHERE l.order_id = o.id), o.created_at, o.revision,
         EXISTS (SELECT 1 FROM client_order_events e WHERE e.order_id = o.id AND e.actor_type = 'staff'
                 AND e.created_at > COALESCE(o.client_seen_at, 'epoch'::timestamptz))
  FROM client_orders o WHERE o.client_id = v_client_id ORDER BY o.created_at DESC;
END; $$;

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
              'quotation_id', v_o.quotation_id),
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

CREATE OR REPLACE FUNCTION public.client_portal_update_order(
  p_session_id uuid, p_order_id uuid, p_base_revision integer, p_lines jsonb, p_changes jsonb, p_note text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_client_id UUID; v_name TEXT; v_o client_orders%ROWTYPE; l jsonb; v_i INTEGER := 0; v_keep uuid[] := '{}'; v_id uuid;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  SELECT * INTO v_o FROM client_orders WHERE id = p_order_id AND client_id = v_client_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_o.status NOT IN ('submitted','in_review','draft','quoted','changes_requested') THEN
    RAISE EXCEPTION 'this order is confirmed and can no longer be edited by the client';
  END IF;
  IF v_o.revision <> p_base_revision THEN RAISE EXCEPTION 'conflict: order was modified (revision % now)', v_o.revision; END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN RAISE EXCEPTION 'the order needs at least one line'; END IF;
  IF jsonb_array_length(p_lines) > 1000 THEN RAISE EXCEPTION 'too many lines (max 1000)'; END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_id := NULLIF(l->>'id','')::uuid;
    IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM client_order_lines WHERE id = v_id AND order_id = v_o.id) THEN
      UPDATE client_order_lines SET
        supplier_name_raw = left(l->>'supplier', 200), supplier_ref = left(l->>'supplier_ref', 200),
        name = left(l->>'name', 500), color = left(l->>'color', 100), qty = NULLIF(l->>'qty','')::numeric,
        client_price = NULLIF(l->>'price','')::numeric, client_ref = left(l->>'client_ref', 200),
        brand = left(l->>'brand', 200), marking = NULLIF(l->>'marking','')::boolean,
        packaging = left(l->>'packaging', 200), notes = left(l->>'notes', 1000), sort_order = v_i
      WHERE id = v_id;
    ELSE
      INSERT INTO client_order_lines (order_id, sheet_name, supplier_name_raw, supplier_ref, name, color, qty, client_price,
                                      client_ref, brand, marking, packaging, notes, sort_order)
      VALUES (v_o.id, left(l->>'sheet_name', 100), left(l->>'supplier', 200), left(l->>'supplier_ref', 200),
              left(l->>'name', 500), left(l->>'color', 100), NULLIF(l->>'qty','')::numeric,
              NULLIF(l->>'price','')::numeric, left(l->>'client_ref', 200), left(l->>'brand', 200),
              NULLIF(l->>'marking','')::boolean, left(l->>'packaging', 200), left(l->>'notes', 1000), v_i)
      RETURNING id INTO v_id;
    END IF;
    v_keep := v_keep || v_id;
    v_i := v_i + 1;
  END LOOP;
  DELETE FROM client_order_lines WHERE order_id = v_o.id AND NOT (id = ANY (v_keep));

  UPDATE client_orders SET revision = revision + 1, updated_at = now(), client_seen_at = now() WHERE id = v_o.id;
  INSERT INTO client_order_events (order_id, actor_type, actor_name, kind, note, changes)
  VALUES (v_o.id, 'client', v_name, 'lines_edited', NULLIF(left(trim(p_note), 1000), ''), p_changes);
  RETURN v_o.revision + 1;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_add_comment(p_session_id uuid, p_order_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF NULLIF(trim(p_note), '') IS NULL THEN RAISE EXCEPTION 'empty comment'; END IF;
  IF NOT EXISTS (SELECT 1 FROM client_orders WHERE id = p_order_id AND client_id = v_client_id) THEN RAISE EXCEPTION 'order not found'; END IF;
  INSERT INTO client_order_events (order_id, actor_type, actor_name, kind, note)
  VALUES (p_order_id, 'client', v_name, 'comment', left(trim(p_note), 1000));
  UPDATE client_orders SET client_seen_at = now() WHERE id = p_order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.client_portal_respond_order(p_session_id uuid, p_order_id uuid, p_action text, p_note text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_o client_orders%ROWTYPE; v_new text; v_kind text;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  SELECT * INTO v_o FROM client_orders WHERE id = p_order_id AND client_id = v_client_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_o.status <> 'quoted' THEN RAISE EXCEPTION 'there is no quotation to respond to'; END IF;
  IF p_action = 'accept' THEN v_new := 'confirmed'; v_kind := 'accepted';
  ELSIF p_action = 'request_changes' THEN v_new := 'changes_requested'; v_kind := 'changes_requested';
  ELSE RAISE EXCEPTION 'unknown action'; END IF;
  UPDATE client_orders SET status = v_new, updated_at = now(), client_seen_at = now() WHERE id = v_o.id;
  INSERT INTO client_order_events (order_id, actor_type, actor_name, kind, note, changes)
  VALUES (v_o.id, 'client', v_name, v_kind, NULLIF(left(trim(p_note), 1000), ''), jsonb_build_object('from', v_o.status, 'to', v_new));
  RETURN v_new;
END; $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'client_portal_get_client_orders(uuid)','client_portal_get_order(uuid,uuid)',
    'client_portal_update_order(uuid,uuid,integer,jsonb,jsonb,text)',
    'client_portal_add_comment(uuid,uuid,text)','client_portal_respond_order(uuid,uuid,text,text)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', f);
  END LOOP;
END $$;
