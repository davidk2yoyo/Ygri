-- Lets a portal client's own session check whether "Cotizaciones IA" is
-- enabled for them, and (server-side only, via api/quotations-ai-chat-portal.js)
-- resolve which Dify dataset to query. Same session-verification shape as
-- every other client_portal_* RPC — anon can call this with any session_id,
-- but it only ever returns data for the client that session actually belongs to.
CREATE OR REPLACE FUNCTION public.client_portal_get_quotations_ai_status(p_session_id uuid)
RETURNS TABLE (enabled boolean, dify_dataset_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID;
BEGIN
  SELECT c.client_id INTO v_client_id FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT q.enabled, q.dify_dataset_id
  FROM client_quotations_ai q
  WHERE q.client_id = v_client_id;
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_get_quotations_ai_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_quotations_ai_status(uuid) TO anon, authenticated;
