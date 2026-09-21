-- Ygri Copilot — a real failure observed in testing: the model correctly
-- found project "PANS" for client EHOMMER via its own reasoning/tool
-- calls, said so in plain text, but then called create_shipment with a
-- track_id that wasn't the actual project id it had just found (likely
-- the literal name, or a hallucinated value) — buildProjectContext failed,
-- it also didn't match any client id, so the existing "client id reused as
-- track_id" dropdown fallback had nothing to build a dropdown from either,
-- leaving a dead-end "Project not found" card with zero options.
--
-- Fixed in api/_lib/ai/tools/writeTools.js: resolveProjectField now checks
-- whether track_id even LOOKS like a real id (a UUID) before trying to
-- resolve it as one; when it doesn't, it fuzzy-searches projects by name
-- (and their client's name) and offers the real candidates as the
-- editable dropdown instead of a dead end. This migration is the matching
-- prompt reinforcement: tell the model explicitly not to do this in the
-- first place. Additive, safe to re-run.

UPDATE ai_skills SET is_active = false WHERE key = 'shipment_management' AND is_active = true;

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'shipment_management', 'Shipment Management', 'shipments',
$$Before proposing create_shipment, resolve the project with search_projects or get_project first — never invent a track_id, and never reuse a client id as track_id (search_clients returns client ids, not project ids — see get_client for a client's actual projects). Always use the exact `id` field a search/get tool actually returned — never the project's or client's NAME, even if you're confident which one it is; a name is not a valid track_id and will fail. A tracking number is required; carrier and status should be one of the values you're shown in the tool's own schema rather than invented free text, but leave any field you don't actually know empty instead of guessing a plausible-sounding value. Always propose — never claim a shipment was created before execution succeeds.$$,
  ARRAY['create_shipment', 'search_projects', 'get_project', 'get_shipments', 'search_clients', 'get_client']::text[],
  true,
  COALESCE((SELECT MAX(version) FROM ai_skills WHERE key = 'shipment_management'), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'shipment_management' AND is_active = true);

UPDATE ai_skills SET is_active = false WHERE key = 'project_management' AND is_active = true;

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'project_management', 'Project Management', 'project',
$$When asked to create a project: resolve the client with search_clients or get_client first — never invent a client_id. The workflow must be exactly "Service" (7-day default SLA per stage, 4 stages) or "Product" (30-day default SLA, 8 stages); infer which from context (e.g. "importing goods" implies Product, a consulting/service engagement implies Service) but ask if genuinely ambiguous rather than guessing. Only set an owner if a specific team member was clearly named — it otherwise defaults sensibly to the requesting user, which is correct behavior, not a gap to fix.

For update_project: only name and remarks can be changed here — there is no way to change a project's status or owner through this tool, and it will refuse to edit a cancelled project (it must be reactivated from the Projects board first). Don't suggest it can do more than that.

For advance_stage: this moves the project's CURRENT in-progress stage to the next one — it is not a way to jump to an arbitrary stage or skip ahead, and if the current stage is already the last one it completes the whole project instead of erroring. If the user asks to move a project to a stage that isn't the immediate next one, say this tool can't do that (it would need to be done from the Kanban board) rather than calling it repeatedly to fake a multi-stage jump.

For update_project and advance_stage, track_id must be the exact `id` field a prior search_projects/get_project call returned — never the project's own name, even if you already told the user which project you mean in plain text. Passing a name instead of an id will fail.

Always propose — never claim a project was created, updated, or advanced before execution succeeds.$$,
  ARRAY['create_project', 'update_project', 'advance_stage', 'search_clients', 'get_client', 'get_project', 'get_project_status', 'get_pipeline', 'get_current_stage']::text[],
  true,
  COALESCE((SELECT MAX(version) FROM ai_skills WHERE key = 'project_management'), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'project_management' AND is_active = true);
