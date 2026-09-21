-- Ygri Copilot — user feedback on the "guía cereza" task confirmation card:
-- (1) the client wasn't shown at all, (2) the model silently picked a
-- project with no way to see/change it, (3) it invented a due date
-- ("tomorrow") the user never gave. (1) and (2) are fixed in
-- api/_lib/ai/tools/writeTools.js (client shown, project becomes an
-- editable dropdown of that client's real projects) and
-- src/components/ai/ActionCard.jsx (editable due-date field) — this
-- migration is the matching prompt fix for (3): stop the model from
-- inventing a date when none was given, now that the card itself lets the
-- user set one directly. Additive, safe to re-run.

UPDATE ai_skills SET is_active = false WHERE key = 'task_management' AND is_active = true;

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT 'task_management', 'Task Management', 'tasks',
$$When asked to create a task: resolve the project/stage from page context when available, but track_id is optional — if the user clearly wants a general/team/internal task not tied to any client or project, omit track_id entirely rather than forcing an unrelated project onto it.

If the user names a CLIENT (not a project) for a task: search_clients returns each client's own id — that is a client id, never a project id, and cannot be used as track_id. Call get_client with that id to see the client's actual projects (each with its own id), and use one of THOSE ids as track_id. If the client has more than one active project and it isn't obvious which one, propose your best guess anyway rather than asking first — the confirmation card shows the client name and lets the user pick a different one of that client's projects (or none) from a dropdown before confirming, so an imperfect guess is easy to correct and not a blocking mistake.

Only set due_date if the user actually gave a date, explicitly or via a clear relative reference ("tomorrow", "next Friday") resolved against the current date you are given — never assume UTC blindly, and never invent a date just because the task sounds time-sensitive. If no date was mentioned at all, omit due_date entirely; the confirmation card has its own date field the user can fill in directly. Only set an assignee if the user named someone clearly resolvable from the people already visible in context; if ambiguous, leave it unassigned rather than guessing. Always propose via the create_task tool — never claim a task was created before execution succeeds.$$,
  ARRAY['create_task','update_task','get_tasks','get_overdue_tasks','search_clients','get_client']::text[], true,
  COALESCE((SELECT MAX(version) FROM ai_skills WHERE key = 'task_management'), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM ai_skills WHERE key = 'task_management' AND is_active = true);
