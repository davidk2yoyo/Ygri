-- Client order lines can carry a photo: the portal update RPC now saves photo_url
-- (only URLs from our own public storage buckets are accepted).

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
        packaging = left(l->>'packaging', 200), notes = left(l->>'notes', 1000), sort_order = v_i,
        photo_url = CASE WHEN l->>'photo_url' ~ '^https://[^/]+/storage/v1/object/public/(client-portal-uploads|client-orders)/' THEN l->>'photo_url' ELSE NULL END
      WHERE id = v_id;
    ELSE
      INSERT INTO client_order_lines (order_id, sheet_name, supplier_name_raw, supplier_ref, name, color, qty, client_price,
                                      client_ref, brand, marking, packaging, notes, sort_order, photo_url)
      VALUES (v_o.id, left(l->>'sheet_name', 100), left(l->>'supplier', 200), left(l->>'supplier_ref', 200),
              left(l->>'name', 500), left(l->>'color', 100), NULLIF(l->>'qty','')::numeric,
              NULLIF(l->>'price','')::numeric, left(l->>'client_ref', 200), left(l->>'brand', 200),
              NULLIF(l->>'marking','')::boolean, left(l->>'packaging', 200), left(l->>'notes', 1000), v_i,
              CASE WHEN l->>'photo_url' ~ '^https://[^/]+/storage/v1/object/public/(client-portal-uploads|client-orders)/' THEN l->>'photo_url' ELSE NULL END)
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


REVOKE ALL ON FUNCTION public.client_portal_update_order(uuid,uuid,integer,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_update_order(uuid,uuid,integer,jsonb,jsonb,text) TO anon, authenticated;
