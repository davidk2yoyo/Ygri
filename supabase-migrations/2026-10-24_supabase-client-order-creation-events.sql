-- Neither client-facing order-creation RPC ever logged a "submitted" event into
-- client_order_events — so a brand-new order showed "Sin movimientos." in its
-- own Historial until the first edit/comment/status-change happened, with no
-- record of when it was created or by whom. This has been true of
-- client_portal_submit_order (Excel upload, since 2026-10-12) all along;
-- client_portal_create_order (manual entry, 2026-10-23) just inherited the same
-- gap. Re-creates both, unchanged otherwise, with one INSERT INTO
-- client_order_events added after the order row is created.

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

  INSERT INTO client_order_events (order_id, actor_type, actor_name, kind)
  VALUES (v_order, 'client', v_name, 'submitted');

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

REVOKE ALL ON FUNCTION public.client_portal_submit_order(uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_submit_order(uuid,text,text,text,jsonb) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.client_portal_create_order(p_session_id uuid, p_reference text, p_lines jsonb)
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

  INSERT INTO client_orders (client_id, reference, status, source)
  VALUES (v_client_id, NULLIF(left(trim(p_reference), 200), ''), 'submitted', 'portal_manual')
  RETURNING id INTO v_order;

  INSERT INTO client_order_events (order_id, actor_type, actor_name, kind)
  VALUES (v_order, 'client', v_name, 'submitted');

  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO client_order_lines (order_id, sheet_name, sheet_row, supplier_name_raw, supplier_ref, name, color,
                                    qty, client_price, client_ref, brand, marking, packaging, notes, photo_url, sort_order)
    VALUES (v_order, left(l->>'sheet_name', 100), NULLIF(l->>'sheet_row','')::int,
            left(l->>'supplier', 200), left(l->>'supplier_ref', 200), left(l->>'name', 500), left(l->>'color', 100),
            NULLIF(l->>'qty','')::numeric, NULLIF(l->>'price','')::numeric, left(l->>'client_ref', 200),
            left(l->>'brand', 200), NULLIF(l->>'marking','')::boolean, left(l->>'packaging', 200),
            left(l->>'notes', 1000), left(l->>'photo_url', 1000), v_i);
    v_i := v_i + 1;
  END LOOP;
  RETURN v_order;
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_create_order(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_create_order(uuid,text,jsonb) TO anon, authenticated;
