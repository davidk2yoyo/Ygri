-- ============================================================
-- CLIENT PORTAL - Run this in Supabase SQL Editor
-- ============================================================

-- pgcrypto for password hashing (already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Client portal users (admin-managed, separate from Supabase Auth) ──────
CREATE TABLE IF NOT EXISTS client_portal_users (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpu_client_id ON client_portal_users(client_id);
CREATE INDEX IF NOT EXISTS idx_cpu_email     ON client_portal_users(email);

-- ── 2. Sessions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_portal_user_id UUID NOT NULL REFERENCES client_portal_users(id) ON DELETE CASCADE,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cps_user_id ON client_portal_sessions(client_portal_user_id);

-- ── 3. Client documents (uploaded by admin for the client to see) ─────────────
CREATE TABLE IF NOT EXISTS client_documents (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  document_type TEXT    NOT NULL CHECK (document_type IN ('invoice','bl','packing_list','certificate','other')),
  file_url      TEXT    NOT NULL,
  file_name     TEXT    NOT NULL,
  file_size     INTEGER,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cd_client_id ON client_documents(client_id);

-- ── 4. RLS: internal users only touch these tables (portal uses RPCs) ─────────
ALTER TABLE client_portal_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents       ENABLE ROW LEVEL SECURITY;

-- Internal authenticated users can manage client portal users and documents
CREATE POLICY "internal_manage_cpu" ON client_portal_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "internal_manage_cps" ON client_portal_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "internal_manage_cd" ON client_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Portal RPCs run as SECURITY DEFINER so they bypass RLS safely


-- ── 5. RPC: Admin creates or updates a client portal user ─────────────────────
CREATE OR REPLACE FUNCTION admin_upsert_client_portal_user(
  p_client_id UUID,
  p_email     TEXT,
  p_password  TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO client_portal_users (client_id, email, password_hash)
  VALUES (p_client_id, lower(trim(p_email)), crypt(p_password, gen_salt('bf')))
  ON CONFLICT (email) DO UPDATE SET
    client_id     = EXCLUDED.client_id,
    password_hash = crypt(p_password, gen_salt('bf')),
    updated_at    = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── 6. RPC: Admin removes portal access ──────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_remove_client_portal_user(p_client_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM client_portal_users WHERE client_id = p_client_id;
END;
$$;

-- ── 7. RPC: Client login ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION client_portal_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  session_id   UUID,
  client_id    UUID,
  client_name  TEXT,
  expires_at   TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql AS $$
DECLARE
  v_user   client_portal_users%ROWTYPE;
  v_client clients%ROWTYPE;
  v_sid    UUID;
BEGIN
  SELECT * INTO v_user
  FROM client_portal_users
  WHERE email = lower(trim(p_email));

  IF v_user.id IS NULL THEN RETURN; END IF;
  IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN RETURN; END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_user.client_id;

  INSERT INTO client_portal_sessions (client_portal_user_id)
  VALUES (v_user.id)
  RETURNING id INTO v_sid;

  RETURN QUERY
  SELECT v_sid, v_client.id, v_client.company_name::TEXT,
         (SELECT s.expires_at FROM client_portal_sessions s WHERE s.id = v_sid);
END;
$$;

-- ── 8. RPC: Verify session (returns client_id or nothing) ─────────────────────
CREATE OR REPLACE FUNCTION client_portal_verify_session(p_session_id UUID)
RETURNS TABLE (client_id UUID, client_name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_session client_portal_sessions%ROWTYPE;
  v_user    client_portal_users%ROWTYPE;
  v_client  clients%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM client_portal_sessions
  WHERE id = p_session_id AND expires_at > NOW();

  IF v_session.id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_user FROM client_portal_users WHERE id = v_session.client_portal_user_id;
  SELECT * INTO v_client FROM clients WHERE id = v_user.client_id;

  RETURN QUERY SELECT v_client.id, v_client.company_name::TEXT;
END;
$$;

-- ── 9. RPC: Get client quotations ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION client_portal_get_quotations(p_session_id UUID)
RETURNS TABLE (
  id           UUID,
  quote_number TEXT,
  type         TEXT,
  currency     TEXT,
  incoterm     TEXT,
  delivery_time TEXT,
  notes        TEXT,
  total_amount NUMERIC,
  track_name   TEXT,
  created_at   TIMESTAMPTZ
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
  SELECT q.id, q.quote_number, q.type, q.currency, q.incoterm,
         q.delivery_time, q.notes, q.total_amount,
         t.name::TEXT AS track_name, q.created_at
  FROM quotations q
  JOIN tracks t ON t.id = q.track_id
  WHERE t.client_id = v_client_id
  ORDER BY q.created_at DESC;
END;
$$;

-- ── 10. RPC: Get client shipments ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION client_portal_get_shipments(p_session_id UUID)
RETURNS TABLE (
  id                  UUID,
  reference           TEXT,
  status              TEXT,
  carrier             TEXT,
  tracking_number     TEXT,
  origin              TEXT,
  destination         TEXT,
  estimated_delivery  DATE,
  track_name          TEXT,
  created_at          TIMESTAMPTZ
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
  SELECT s.id, s.reference, s.status, s.carrier, s.tracking_number,
         s.origin, s.destination, s.estimated_delivery,
         t.name::TEXT AS track_name, s.created_at
  FROM shipments s
  JOIN tracks t ON t.id = s.track_id
  WHERE t.client_id = v_client_id
  ORDER BY s.created_at DESC;
END;
$$;

-- ── 11. RPC: Get client documents ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION client_portal_get_documents(p_session_id UUID)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  document_type TEXT,
  file_url      TEXT,
  file_name     TEXT,
  file_size     INTEGER,
  notes         TEXT,
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
  SELECT d.id, d.name, d.document_type, d.file_url, d.file_name,
         d.file_size, d.notes, d.created_at
  FROM client_documents d
  WHERE d.client_id = v_client_id
  ORDER BY d.created_at DESC;
END;
$$;

-- ── 12. RPC: Check if client has portal access ────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_client_portal_info(p_client_id UUID)
RETURNS TABLE (has_access BOOLEAN, email TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT (cpu.id IS NOT NULL), cpu.email
  FROM clients c
  LEFT JOIN client_portal_users cpu ON cpu.client_id = c.id
  WHERE c.id = p_client_id;
END;
$$;
