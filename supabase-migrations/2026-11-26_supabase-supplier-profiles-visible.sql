-- ============================================================================
-- SUPPLIER PROFILE — one switch per section: "visible to this supplier's clients". Safe to re-run.
-- Apply AFTER 2026-11-25.
--   * supplier_profile_sections.visible: when on, every client that works with the supplier
--     (has a purchase order or an order line with it) sees that section automatically.
--   * supplier_profile_shares stays as an extra: show sections to a specific client even if it
--     has not ordered from that supplier yet.
-- ============================================================================

ALTER TABLE supplier_profile_sections ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT false;

-- Clients that work with a supplier (through a project's purchase order or an imported order line)
CREATE OR REPLACE FUNCTION public.supplier_client_ids(p_supplier_id uuid)
RETURNS TABLE (client_id uuid)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT t.client_id FROM purchase_orders po JOIN tracks t ON t.id = po.track_id
   WHERE po.supplier_id = p_supplier_id AND t.client_id IS NOT NULL
  UNION
  SELECT o.client_id FROM client_order_lines l JOIN client_orders o ON o.id = l.order_id
   WHERE l.supplier_id = p_supplier_id
$$;
REVOKE ALL ON FUNCTION public.supplier_client_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_client_ids(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_portal_get_suppliers(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text; v_prices boolean;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;
  IF NOT client_portal_can(p_session_id, 'proveedores') THEN RETURN NULL; END IF;
  v_prices := client_portal_can(p_session_id, 'prices');

  RETURN COALESCE((SELECT jsonb_agg(x.j ORDER BY x.name) FROM (
    SELECT s.name, jsonb_build_object(
      'id', s.id, 'name', s.name, 'country', s.country, 'city', s.city,
      'sections', sec.sections) AS j
    FROM suppliers s
    LEFT JOIN supplier_profile_shares sh ON sh.supplier_id = s.id AND sh.client_id = v_client_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(jsonb_object_agg(p.section, jsonb_build_object(
               'body', p.body, 'data', p.data, 'files', p.files, 'updated_at', p.updated_at)), '{}'::jsonb) AS sections
      FROM supplier_profile_sections p
      WHERE p.supplier_id = s.id
        AND (v_prices OR p.section <> 'lista_precios')
        AND ( p.section = ANY (COALESCE(sh.sections, '{}'))
              OR (p.visible AND EXISTS (SELECT 1 FROM public.supplier_client_ids(s.id) k WHERE k.client_id = v_client_id)) )
    ) sec
    WHERE sec.sections <> '{}'::jsonb) x), '[]'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_get_suppliers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_suppliers(uuid) TO anon, authenticated;
