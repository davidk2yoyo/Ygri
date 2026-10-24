-- A client can rename their own order's title (the "reference" shown as the
-- page heading in the portal). Unlike editing lines or deleting, this is just
-- a label, so it's allowed at any order status — not gated by CLIENT_EDITABLE
-- or the early-status check that "delete" uses.
CREATE OR REPLACE FUNCTION public.client_portal_rename_order(p_session_id uuid, p_order_id uuid, p_reference text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_o client_orders%ROWTYPE;
BEGIN
  SELECT c.client_id INTO v_client_id FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  SELECT * INTO v_o FROM client_orders WHERE id = p_order_id AND client_id = v_client_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  UPDATE client_orders SET reference = NULLIF(left(trim(p_reference), 200), ''), updated_at = now() WHERE id = v_o.id;
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_rename_order(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_rename_order(uuid,uuid,text) TO anon, authenticated;
