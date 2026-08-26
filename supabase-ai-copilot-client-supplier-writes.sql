-- Ygri Copilot — enables create_client/update_client/create_supplier/
-- update_supplier. Same low-risk shape as create_task/create_project: raw
-- table CRUD, no RPC to defer to (confirmed in the original audit), so
-- these tools mirror exactly what ClientsPage.jsx/SuppliersPage.jsx already
-- do. Additive, safe to re-run.

INSERT INTO ai_tools (key, name, description, tool_type, enabled, allowed_roles)
SELECT * FROM (VALUES
  ('create_client', 'Create client', 'Propose creating a new client.', 'write', true, ARRAY['staff']::text[]),
  ('update_client', 'Update client', 'Propose updating an existing client''s fields.', 'write', true, ARRAY['staff']::text[]),
  ('create_supplier', 'Create supplier', 'Propose creating a new supplier.', 'write', true, ARRAY['staff']::text[]),
  ('update_supplier', 'Update supplier', 'Propose updating an existing supplier''s fields.', 'write', true, ARRAY['staff']::text[])
) AS v(key, name, description, tool_type, enabled, allowed_roles)
WHERE NOT EXISTS (SELECT 1 FROM ai_tools t WHERE t.key = v.key);

-- client_management's original seed said "not enabled as a write tool yet" —
-- that's no longer true, so it gets a new active version rather than being
-- left stale (immutable versioning: the old row stays for any past
-- ai_executions that reference it).
UPDATE ai_skills SET is_active = false WHERE key = 'client_management' AND is_active = true;

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'client_management', 'Client Management', 'clients',
$$Before proposing create_client, always call search_clients first to check for likely duplicates — company names can be similar without being the same entity (different country/branch), so a possible match is a prompt to confirm with the user, not an automatic block. Never invent contact details (email, phone) that weren't given. For update_client, only include fields that are actually changing. Always propose — never claim a client was created or updated before execution succeeds.$$,
  ARRAY['create_client', 'update_client', 'search_clients', 'get_client']::text[],
  true,
  COALESCE((SELECT MAX(version) FROM ai_skills WHERE key = 'client_management'), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'client_management' AND is_active = true);

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'supplier_management', 'Supplier Management', 'suppliers',
$$Before proposing create_supplier, always call search_suppliers first to check for likely duplicates. Never invent contact details that weren't given. For update_supplier, only include fields that are actually changing. Always propose — never claim a supplier was created or updated before execution succeeds.$$,
  ARRAY['create_supplier', 'update_supplier', 'search_suppliers', 'get_supplier']::text[], true, 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'supplier_management' AND is_active);
