-- "Cotizaciones IA": per-client mapping to a Dify Knowledge Base dataset.
-- Dify owns document storage, vectorization and retrieval entirely — this
-- table only records which dataset a client is mapped to and whether the
-- module is switched on for them. No Dify credentials live here; those stay
-- server-side as Vercel env vars (DIFY_BASE_URL, DIFY_KNOWLEDGE_API_KEY,
-- DIFY_CHAT_API_KEY) and are never sent to the browser.
CREATE TABLE IF NOT EXISTS client_quotations_ai (
  client_id uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  dify_dataset_id text,
  dify_dataset_name text,
  enabled_by uuid REFERENCES profiles(id),
  enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_quotations_ai ENABLE ROW LEVEL SECURITY;

-- Same baseline as every other staff-facing table in this app (e.g. clients
-- itself): any authenticated staff user has full access, RLS just keeps anon
-- out entirely. No per-row ownership needed here.
DROP POLICY IF EXISTS "staff full access" ON client_quotations_ai;
CREATE POLICY "staff full access" ON client_quotations_ai
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
