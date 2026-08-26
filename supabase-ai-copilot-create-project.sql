-- Ygri Copilot — enables create_project, now that create_track_rpc has
-- been extracted and confirmed simple (single INSERT, no track_stages
-- side effects — see supabase-core-workflow-rpcs.sql). Additive, safe to re-run.

INSERT INTO ai_tools (key, name, description, tool_type, enabled, allowed_roles)
SELECT 'create_project', 'Create project', 'Propose creating a new project for a client via create_track_rpc.', 'write', true, ARRAY['staff']::text[]
WHERE NOT EXISTS (SELECT 1 FROM ai_tools WHERE key = 'create_project');

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'project_management', 'Project Management', 'project',
$$When asked to create a project: resolve the client with search_clients or get_client first — never invent a client_id. The workflow must be exactly "Service" (7-day default SLA per stage, 4 stages) or "Product" (30-day default SLA, 8 stages); infer which from context (e.g. "importing goods" implies Product, a consulting/service engagement implies Service) but ask if genuinely ambiguous rather than guessing. Only set an owner if a specific team member was clearly named — it otherwise defaults sensibly to the requesting user, which is correct behavior, not a gap to fix. Always propose via create_project — never claim a project was created before execution succeeds.$$,
  ARRAY['create_project', 'search_clients', 'get_client']::text[], true, 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'project_management' AND is_active);
