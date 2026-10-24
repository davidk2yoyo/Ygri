-- client_portal_get_my_items didn't return photo_url, so picking a suggestion
-- for an item the client has a photo of on file (from a past order) left the
-- photo box empty — the client would have had to re-upload a photo they
-- already sent us. Same dedup/ordering as before, just one more column.
CREATE OR REPLACE FUNCTION public.client_portal_get_my_items(p_session_id uuid)
RETURNS TABLE(name text, supplier_ref text, client_ref text, color text, brand text, supplier text, photo_url text, last_used timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID;
BEGIN
  SELECT c.client_id INTO v_client_id FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;

  RETURN QUERY
  SELECT dedup.name, dedup.supplier_ref, dedup.client_ref, dedup.color, dedup.brand, dedup.supplier, dedup.photo_url, dedup.last_used
  FROM (
    SELECT DISTINCT ON (lower(coalesce(l.name,'')), lower(coalesce(l.supplier_ref,'')), lower(coalesce(l.client_ref,'')))
      l.name, l.supplier_ref, l.client_ref, l.color, l.brand, l.supplier_name_raw AS supplier, l.photo_url, l.created_at AS last_used
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
