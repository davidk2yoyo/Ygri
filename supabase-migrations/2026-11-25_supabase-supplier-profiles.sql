-- ============================================================================
-- SUPPLIER PROFILE ("hoja de vida" del proveedor) — shown to the clients staff choose.
-- Run in the Supabase SQL Editor. Safe to re-run. Apply AFTER 2026-11-24.
--
--   supplier_profile_sections  one row per supplier + section: free text, files, small data
--   supplier_profile_shares    which sections of which supplier each CLIENT may see
--
-- Sections: proveedor, cumplimiento, empaques, etiquetado, garantias, produccion, calificacion,
--           factura (invoices / no invoices), lista_precios.
-- 'lista_precios' is only served to portal users who may see prices ('prices' permission).
-- Staff use the tables directly (authenticated); clients only reach them through the function below.
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_profile_sections (
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  section     text NOT NULL CHECK (section IN ('proveedor','cumplimiento','empaques','etiquetado','garantias','produccion','calificacion','factura','lista_precios')),
  body        text,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- calificacion: {quality, delivery, communication, compliance} 1-5; factura: {invoicing: 'factura'|'no_factura'|'ambos'}
  files       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{url, name, kind: 'image'|'video'|'file'}]
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, section)
);

CREATE TABLE IF NOT EXISTS supplier_profile_shares (
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sections    text[] NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_supplier_profile_shares_client ON supplier_profile_shares(client_id);

ALTER TABLE supplier_profile_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_profile_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_supplier_profile_sections" ON supplier_profile_sections;
CREATE POLICY "auth_all_supplier_profile_sections" ON supplier_profile_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_supplier_profile_shares" ON supplier_profile_shares;
CREATE POLICY "auth_all_supplier_profile_shares" ON supplier_profile_shares FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Portal: permission list now includes 'proveedores' ───────────────────────
CREATE OR REPLACE FUNCTION public.client_portal_get_me(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
DECLARE v client_portal_users; k text; perms jsonb := '{}'::jsonb;
BEGIN
  v := public.client_portal_user_of_session(p_session_id);
  IF v.id IS NULL THEN RETURN NULL; END IF;
  FOREACH k IN ARRAY ARRAY['prices','envios','ordenes','pedidos','documentos','reportes','asistente','cotizaciones_ia','garantias','consultas','proveedores'] LOOP
    perms := perms || jsonb_build_object(k, v.role = 'admin' OR COALESCE(v.permissions ->> k, 'false') = 'true');
  END LOOP;
  RETURN jsonb_build_object('user_id', v.id, 'name', v.name, 'email', v.email, 'role', v.role, 'permissions', perms);
END; $$;

-- ── Portal: the suppliers (and only the sections) shared with this client ────
CREATE OR REPLACE FUNCTION public.client_portal_get_suppliers(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id uuid; v_name text; v_prices boolean;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;
  IF NOT client_portal_can(p_session_id, 'proveedores') THEN RETURN NULL; END IF;
  v_prices := client_portal_can(p_session_id, 'prices');

  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'country', s.country, 'city', s.city,
      'sections', (SELECT COALESCE(jsonb_object_agg(p.section, jsonb_build_object(
                     'body', p.body, 'data', p.data, 'files', p.files, 'updated_at', p.updated_at)), '{}'::jsonb)
                   FROM supplier_profile_sections p
                   WHERE p.supplier_id = s.id AND p.section = ANY (sh.sections)
                     AND (v_prices OR p.section <> 'lista_precios'))
    ) ORDER BY s.name)
    FROM supplier_profile_shares sh JOIN suppliers s ON s.id = sh.supplier_id
    WHERE sh.client_id = v_client_id AND cardinality(sh.sections) > 0), '[]'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_get_me(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_portal_get_suppliers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_me(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_portal_get_suppliers(uuid) TO anon, authenticated;
