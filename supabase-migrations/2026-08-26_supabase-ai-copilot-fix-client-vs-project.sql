-- Ygri Copilot — fix a real failure observed in testing: the model called
-- search_clients, then reused the returned CLIENT id as track_id for
-- create_task, which always fails validation ("Project not found") — and
-- since the failure reason never made it back into the model's own
-- conversation history (fixed separately in api/_lib/ai/actionPlan.js),
-- it repeated the identical mistake on the next turn. Additive, safe to re-run.

UPDATE ai_skills SET is_active = false WHERE key = 'task_management' AND is_active = true;

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'task_management', 'Task Management', 'tasks',
$$When asked to create a task: resolve the project/stage from page context when available, but track_id is optional — if the user clearly wants a general/team/internal task not tied to any client or project, omit track_id entirely rather than forcing an unrelated project onto it.

If the user names a CLIENT (not a project) for a task: search_clients returns each client's own id — that is a client id, never a project id, and cannot be used as track_id. Call get_client with that id to see the client's actual projects (each with its own id), and use one of THOSE ids as track_id. If the client has more than one active project, ask the user which one instead of guessing. If get_client shows no projects for that client, say so plainly and ask whether to create the task as internal instead, rather than inventing or reusing an unrelated id.

Resolve relative dates ("tomorrow", "Friday") against the current date you are given — never assume UTC blindly. Only set an assignee if the user named someone clearly resolvable from the people already visible in context; if ambiguous, leave it unassigned rather than guessing. Always propose via the create_task tool — never claim a task was created before execution succeeds.$$,
  ARRAY['create_task','update_task','get_tasks','get_overdue_tasks','search_clients','get_client']::text[], true,
  COALESCE((SELECT MAX(version) FROM ai_skills WHERE key = 'task_management'), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'task_management' AND is_active = true);
