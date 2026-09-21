-- ============================================================
-- CLIENT PORTAL v2 - Stage visibility + Reports + Dashboard
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Add show_to_client to tracks ──────────────────────────────────────────
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS show_to_client BOOLEAN DEFAULT false;

-- ── 2. RPC: Toggle track visibility for client portal ─────────────────────────
CREATE OR REPLACE FUNCTION admin_toggle_track_client_visibility(
  p_track_id UUID,
  p_visible  BOOLEAN
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tracks SET show_to_client = p_visible WHERE id = p_track_id;
END;
$$;

-- ── 3. RPC: Get client tracks with stages (only visible ones) ─────────────────
CREATE OR REPLACE FUNCTION client_portal_get_tracks(p_session_id UUID)
RETURNS TABLE (
  track_id    UUID,
  track_name  TEXT,
  status      TEXT,
  workflow_kind TEXT,
  progress_pct  NUMERIC,
  stages      JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_client_id UUID;
  v_name      TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name
  FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name::TEXT,
    t.status::TEXT,
    t.workflow_kind::TEXT,
    COALESCE(
      ROUND(
        100.0 * COUNT(ts.id) FILTER (WHERE ts.status = 'done') /
        NULLIF(COUNT(ts.id), 0)
      , 1), 0
    ),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ts.id,
          'name', st.name,
          'status', ts.status,
          'order_index', ts.order_index,
          'due_date', ts.due_date
        ) ORDER BY ts.order_index
      ) FILTER (WHERE ts.id IS NOT NULL),
      '[]'::jsonb
    )
  FROM tracks t
  LEFT JOIN track_stages ts ON ts.track_id = t.id
  LEFT JOIN stage_templates st ON st.id = ts.stage_template_id
  WHERE t.client_id = v_client_id
    AND t.show_to_client = true
  GROUP BY t.id, t.name, t.status, t.workflow_kind
  ORDER BY t.created_at DESC;
END;
$$;

-- ── 4. RPC: Get client inspection reports ─────────────────────────────────────
CREATE OR REPLACE FUNCTION client_portal_get_reports(p_session_id UUID)
RETURNS TABLE (
  id            UUID,
  report_number TEXT,
  title         TEXT,
  status        TEXT,
  visit_date    DATE,
  supplier_name TEXT,
  created_at    TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_client_id UUID;
  v_name      TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name
  FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT ir.id, ir.report_number, ir.title::TEXT, ir.status::TEXT,
         ir.visit_date, ir.supplier_name::TEXT, ir.created_at
  FROM inspection_reports ir
  WHERE ir.client_id = v_client_id
  ORDER BY ir.created_at DESC;
END;
$$;

-- ── 5. RPC: Dashboard summary ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION client_portal_get_dashboard(p_session_id UUID)
RETURNS TABLE (
  active_shipments   BIGINT,
  total_quotations   BIGINT,
  total_documents    BIGINT,
  active_tracks      BIGINT,
  total_reports      BIGINT,
  latest_shipment    TEXT,
  latest_doc_name    TEXT,
  latest_doc_type    TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_client_id UUID;
  v_name      TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name
  FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM shipments s JOIN tracks t ON t.id = s.track_id
     WHERE t.client_id = v_client_id AND s.status IN ('in_transit','customs','pending')),
    (SELECT COUNT(*) FROM quotations q JOIN tracks t ON t.id = q.track_id
     WHERE t.client_id = v_client_id),
    (SELECT COUNT(*) FROM client_documents WHERE client_id = v_client_id),
    (SELECT COUNT(*) FROM tracks WHERE client_id = v_client_id AND show_to_client = true),
    (SELECT COUNT(*) FROM inspection_reports ir JOIN tracks t ON t.id = ir.track_id
     WHERE t.client_id = v_client_id),
    (SELECT s.reference FROM shipments s JOIN tracks t ON t.id = s.track_id
     WHERE t.client_id = v_client_id ORDER BY s.created_at DESC LIMIT 1),
    (SELECT d.name FROM client_documents d WHERE d.client_id = v_client_id ORDER BY d.created_at DESC LIMIT 1),
    (SELECT d.document_type FROM client_documents d WHERE d.client_id = v_client_id ORDER BY d.created_at DESC LIMIT 1);
END;
$$;
