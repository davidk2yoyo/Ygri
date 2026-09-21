-- Ygri Copilot — enables update_project, create_shipment, and advance_stage.
--
-- advance_stage was deliberately left unbuilt until now because the Kanban
-- drag-and-drop path (ProjectsPage.jsx's handleMoveProject) diverged from
-- complete_stage_and_advance — it never updated tracks.current_stage_
-- template_id (the field the Copilot's own context reads as "what stage is
-- this project on"), so a human dragging a card afterward could leave the
-- AI's context stale. Fixed in the same change as this migration:
-- handleMoveProject now also sets current_stage_template_id (and
-- started_at/completed_at/due_date) exactly like the RPC does — see
-- src/pages/ProjectsPage.jsx. advance_stage itself just calls
-- complete_stage_and_advance, the same RPC StageDrawer.jsx's "Complete
-- Stage" button already uses.
--
-- update_project is scoped to name/remarks only — status is deliberately
-- excluded (cancelling/reactivating a project is a compound operation that
-- also rewrites the project name with a "[CANCELLED] " prefix; a generic
-- status edit here would desync that pairing) and owner has no manual edit
-- path anywhere in the app to reuse, so it isn't exposed either.
--
-- create_shipment is a plain insert into shipments, same shape
-- ProjectShipmentsSection.jsx's "New Shipment" modal uses (its background,
-- best-effort 17Track registration call is not replicated here).
--
-- Additive, safe to re-run.

INSERT INTO ai_tools (key, name, description, tool_type, enabled, allowed_roles)
SELECT * FROM (VALUES
  ('update_project', 'Update project', 'Propose renaming a project or editing its remarks.', 'write', true, ARRAY['staff']::text[]),
  ('create_shipment', 'Create shipment', 'Propose registering a new shipment for a project.', 'write', true, ARRAY['staff']::text[]),
  ('advance_stage', 'Advance stage', 'Propose advancing a project''s current stage to the next one.', 'write', true, ARRAY['staff']::text[])
) AS v(key, name, description, tool_type, enabled, allowed_roles)
WHERE NOT EXISTS (SELECT 1 FROM ai_tools t WHERE t.key = v.key);

-- project_management's original seed only covered create_project — new
-- version adds update_project and advance_stage guidance (immutable
-- versioning: the old row stays for any past ai_executions referencing it).
UPDATE ai_skills SET is_active = false WHERE key = 'project_management' AND is_active = true;

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'project_management', 'Project Management', 'project',
$$When asked to create a project: resolve the client with search_clients or get_client first — never invent a client_id. The workflow must be exactly "Service" (7-day default SLA per stage, 4 stages) or "Product" (30-day default SLA, 8 stages); infer which from context (e.g. "importing goods" implies Product, a consulting/service engagement implies Service) but ask if genuinely ambiguous rather than guessing. Only set an owner if a specific team member was clearly named — it otherwise defaults sensibly to the requesting user, which is correct behavior, not a gap to fix.

For update_project: only name and remarks can be changed here — there is no way to change a project's status or owner through this tool, and it will refuse to edit a cancelled project (it must be reactivated from the Projects board first). Don't suggest it can do more than that.

For advance_stage: this moves the project's CURRENT in-progress stage to the next one — it is not a way to jump to an arbitrary stage or skip ahead, and if the current stage is already the last one it completes the whole project instead of erroring. If the user asks to move a project to a stage that isn't the immediate next one, say this tool can't do that (it would need to be done from the Kanban board) rather than calling it repeatedly to fake a multi-stage jump.

Always propose — never claim a project was created, updated, or advanced before execution succeeds.$$,
  ARRAY['create_project', 'update_project', 'advance_stage', 'search_clients', 'get_client', 'get_project', 'get_project_status', 'get_pipeline', 'get_current_stage']::text[],
  true,
  COALESCE((SELECT MAX(version) FROM ai_skills WHERE key = 'project_management'), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'project_management' AND is_active = true);

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'shipment_management', 'Shipment Management', 'shipments',
$$Before proposing create_shipment, resolve the project with search_projects or get_project first — never invent a track_id, and never reuse a client id as track_id (search_clients returns client ids, not project ids — see get_client for a client's actual projects). A tracking number is required; carrier and status should be one of the values you're shown in the tool's own schema rather than invented free text, but leave any field you don't actually know empty instead of guessing a plausible-sounding value. Always propose — never claim a shipment was created before execution succeeds.$$,
  ARRAY['create_shipment', 'search_projects', 'get_project', 'get_shipments', 'search_clients', 'get_client']::text[], true, 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'shipment_management' AND is_active = true);
