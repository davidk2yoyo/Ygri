-- Lets a client start an order by typing it in by hand in the portal, instead of
-- only being able to upload an Excel file. Mirrors client_portal_submit_order
-- (2026-10-12_supabase-portal-v2.sql) but with no file args — source_file_name/
-- source_file_url stay NULL and source is 'portal_manual' so staff views can tell
-- the two paths apart later if needed.
CREATE OR REPLACE FUNCTION public.client_portal_create_order(p_session_id uuid, p_reference text, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_client_id UUID; v_order UUID; v_n INTEGER; v_i INTEGER := 0; l jsonb;
BEGIN
  SELECT c.client_id INTO v_client_id FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'lines must be an array'; END IF;
  v_n := jsonb_array_length(p_lines);
  IF v_n = 0 THEN RAISE EXCEPTION 'the order has no lines'; END IF;
  IF v_n > 1000 THEN RAISE EXCEPTION 'too many lines (max 1000)'; END IF;

  INSERT INTO client_orders (client_id, reference, status, source)
  VALUES (v_client_id, NULLIF(left(trim(p_reference), 200), ''), 'submitted', 'portal_manual')
  RETURNING id INTO v_order;

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


-- Suggests items this client has ordered before (across all their past orders,
-- any status), so a manual order — or adding a line to an existing one — can
-- autofill the product name / item numbers / color / brand instead of retyping
-- them. Deduped by (name, supplier_ref, client_ref); the most recent row for
-- each wins for the display fields (color/brand/supplier can drift over time).
CREATE OR REPLACE FUNCTION public.client_portal_get_my_items(p_session_id uuid)
RETURNS TABLE(name text, supplier_ref text, client_ref text, color text, brand text, supplier text, last_used timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID;
BEGIN
  SELECT c.client_id INTO v_client_id FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;

  RETURN QUERY
  SELECT dedup.name, dedup.supplier_ref, dedup.client_ref, dedup.color, dedup.brand, dedup.supplier, dedup.last_used
  FROM (
    SELECT DISTINCT ON (lower(coalesce(l.name,'')), lower(coalesce(l.supplier_ref,'')), lower(coalesce(l.client_ref,'')))
      l.name, l.supplier_ref, l.client_ref, l.color, l.brand, l.supplier_name_raw AS supplier, l.created_at AS last_used
    FROM client_order_lines l
    JOIN client_orders o ON o.id = l.order_id
    WHERE o.client_id = v_client_id
      AND (l.name IS NOT NULL OR l.supplier_ref IS NOT NULL OR l.client_ref IS NOT NULL)
    ORDER BY lower(coalesce(l.name,'')), lower(coalesce(l.supplier_ref,'')), lower(coalesce(l.client_ref,'')), l.created_at DESC
  ) dedup
  ORDER BY dedup.last_used DESC
  LIMIT 500;
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_get_my_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_my_items(uuid) TO anon, authenticated;
