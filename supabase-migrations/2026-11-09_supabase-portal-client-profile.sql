-- The client's own company details (for documents the portal generates, e.g. the packing
-- list Excel). Only whitelisted fields are returned; missing columns just come back null.
CREATE OR REPLACE FUNCTION public.client_portal_get_profile(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_row jsonb;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;
  SELECT to_jsonb(c) INTO v_row FROM clients c WHERE c.id = v_client_id;
  IF v_row IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'company_name', v_row->'company_name', 'rut_nit', v_row->'rut_nit', 'contact_person', v_row->'contact_person',
    'address', v_row->'address', 'city', v_row->'city', 'state', v_row->'state', 'country', v_row->'country',
    'phone', v_row->'phone', 'email', v_row->'email', 'website', v_row->'website', 'logo_url', v_row->'logo_url');
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_get_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_profile(uuid) TO anon, authenticated;
