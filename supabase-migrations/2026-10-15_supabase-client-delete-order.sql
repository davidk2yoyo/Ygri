-- A client can delete an order they uploaded by mistake, but only while it has not
-- been picked up: no project/quotation yet and still in an early status.
-- Lines and history go with it (ON DELETE CASCADE).
CREATE OR REPLACE FUNCTION public.client_portal_delete_order(p_session_id uuid, p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_o client_orders%ROWTYPE;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  SELECT * INTO v_o FROM client_orders WHERE id = p_order_id AND client_id = v_client_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_o.track_id IS NOT NULL OR v_o.quotation_id IS NOT NULL OR v_o.status NOT IN ('submitted','in_review','draft') THEN
    RAISE EXCEPTION 'this order is already being processed and can no longer be deleted — write us a comment instead';
  END IF;
  DELETE FROM client_orders WHERE id = v_o.id;
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_delete_order(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_delete_order(uuid,uuid) TO anon, authenticated;
