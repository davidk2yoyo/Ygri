-- ============================================================
-- CLIENT DOCUMENTS v3 — admin-uploaded documents tied to a
-- project/shipment, with per-document portal visibility.
-- Additive. client_documents had 0 rows when this was written.
-- ============================================================

ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES tracks(id) ON DELETE SET NULL;
ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL;
ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL;
ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS show_to_client boolean NOT NULL DEFAULT false;

ALTER TABLE client_documents DROP CONSTRAINT IF EXISTS client_documents_document_type_check;
ALTER TABLE client_documents ADD CONSTRAINT client_documents_document_type_check
  CHECK (document_type IN ('invoice','packing_list','bl','certificate','quotation','proforma','client_order','other'));

CREATE INDEX IF NOT EXISTS idx_client_documents_shipment_id ON client_documents(shipment_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_track_id ON client_documents(track_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_quotation_id ON client_documents(quotation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON client_documents TO authenticated;

-- Portal only sees documents staff explicitly marked visible; carries the
-- shipment link so the portal can group documents under each shipment.
DROP FUNCTION IF EXISTS public.client_portal_get_documents(uuid);
CREATE OR REPLACE FUNCTION public.client_portal_get_documents(p_session_id uuid)
RETURNS TABLE(id uuid, name text, document_type text, file_url text, file_name text,
              file_size integer, notes text, created_at timestamptz,
              shipment_id uuid, track_id uuid, reference_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_client_id UUID;
  v_name      TEXT;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name
  FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT d.id, d.name, d.document_type, d.file_url, d.file_name,
         d.file_size, d.notes, d.created_at,
         d.shipment_id, d.track_id, d.reference_number
  FROM client_documents d
  WHERE d.client_id = v_client_id AND d.show_to_client = true
  ORDER BY d.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.client_portal_get_documents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_documents(uuid) TO anon, authenticated;
