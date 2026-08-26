-- Ygri Copilot — create_task no longer requires a project; a task can be
-- a genuine internal/team task with no track_id. Additive, safe to re-run.
-- (DB-side enabler: supabase-stage-todos-optional-stage.sql)

UPDATE ai_tools
SET description = 'Propose creating a task — on a project stage if a project is given, or as a standalone internal task if not.'
WHERE key = 'create_task';

-- task_management's original seed implied a project/stage is always
-- resolved — no longer true, so it gets a new active version rather than
-- being left stale (old row stays for any past ai_executions referencing it).
UPDATE ai_skills SET is_active = false WHERE key = 'task_management' AND is_active = true;

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'task_management', 'Task Management', 'tasks',
$$When asked to create a task: resolve the project/stage from page context when available, but track_id is optional — if the user clearly wants a general/team/internal task not tied to any client or project (e.g. "remind me to renew the domain", "add an internal task for the team meeting"), omit track_id entirely rather than forcing an unrelated project onto it. Resolve relative dates ("tomorrow", "Friday") against the current date you are given — never assume UTC blindly. Only set an assignee if the user named someone clearly resolvable from the people already visible in context; if ambiguous, leave it unassigned rather than guessing. Always propose via the create_task tool — never claim a task was created before execution succeeds.$$,
  ARRAY['create_task','update_task','get_tasks','get_overdue_tasks']::text[], true,
  COALESCE((SELECT MAX(version) FROM ai_skills WHERE key = 'task_management'), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'task_management' AND is_active = true);
