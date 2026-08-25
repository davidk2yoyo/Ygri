-- Ygri Copilot — AI Management + Action Plan foundation.
-- Additive only. Does not touch any existing table.

-- ============================================================
-- ai_prompts — versioned system prompts, editable without a redeploy.
-- Versions are immutable rows (never overwritten) so past ai_executions
-- rows always resolve to the exact prompt text that was actually used.
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  system_prompt text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Only one active version per key at a time.
CREATE UNIQUE INDEX IF NOT EXISTS ai_prompts_one_active_per_key
  ON ai_prompts(key) WHERE is_active;

-- ============================================================
-- ai_skills — editable reasoning instructions, injected alongside the
-- system prompt for whichever domains are relevant to a given turn.
-- Same immutable-versioning pattern as ai_prompts.
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  domain text,
  instructions text NOT NULL,
  applies_to_tools text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_skills_one_active_per_key
  ON ai_skills(key) WHERE is_active;

-- ============================================================
-- ai_tools — ADMIN-EDITABLE METADATA ONLY (enabled / description / roles).
-- tool_type is informational for the admin UI; it is NEVER read by the
-- orchestrator to decide READ vs WRITE — that classification is hardcoded
-- in api/_lib/ai/tools/registry.js and cannot be downgraded from the DB.
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  tool_type text NOT NULL CHECK (tool_type IN ('read', 'write')),
  enabled boolean NOT NULL DEFAULT true,
  allowed_roles text[] NOT NULL DEFAULT '{staff}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ai_action_plans — the canonical, server-authored proposal a user is
-- reviewing. The browser only ever sends back {plan_id, selected_action_ids}
-- — it never sends tool/arguments/target back to the server. This table is
-- what the confirm endpoint reloads and revalidates against.
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  page_context jsonb NOT NULL DEFAULT '{}',
  assistant_message text,
  actions jsonb NOT NULL,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'partially_approved', 'executing', 'completed', 'partially_completed', 'failed', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  executed_at timestamptz
);

-- ============================================================
-- ai_executions — one row per orchestrator turn (chat message in, answer
-- or plan out). If that turn produced a plan, this row is later updated
-- with approved/executed action ids once the user confirms.
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  plan_id uuid REFERENCES ai_action_plans(id),
  model text,
  prompt_key text,
  prompt_version integer,
  skills_used text[] DEFAULT '{}',
  context_providers_used text[] DEFAULT '{}',
  tools_called jsonb DEFAULT '[]',
  proposed_actions jsonb DEFAULT '[]',
  approved_action_ids uuid[] DEFAULT '{}',
  executed_action_ids uuid[] DEFAULT '{}',
  result text,
  tokens_input integer,
  tokens_output integer,
  estimated_cost_usd numeric,
  latency_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_executions ENABLE ROW LEVEL SECURITY;

-- Prompts/Skills/Tools are global CRM configuration, not user-owned data —
-- readable by any authenticated session (the orchestrator loads them while
-- running as the calling user), matching this app's existing RLS posture.
-- Editing is gated in the React app at the route level (AiManagementPage,
-- same pattern as the existing inspector-only Settings screens), not here.
DROP POLICY IF EXISTS "authenticated read/write ai_prompts" ON ai_prompts;
CREATE POLICY "authenticated read/write ai_prompts" ON ai_prompts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated read/write ai_skills" ON ai_skills;
CREATE POLICY "authenticated read/write ai_skills" ON ai_skills
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated read/write ai_tools" ON ai_tools;
CREATE POLICY "authenticated read/write ai_tools" ON ai_tools
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Action plans and executions carry a real auth.uid() check — unlike most
-- of this app's existing tables, ownership here is a genuine security
-- requirement (§70/§90 of the Copilot spec: only the requesting user may
-- confirm/execute their own plan), not just an app-layer convention.
-- SELECT is also open to any non-inspector staff member, so the AI
-- Management "Executions" inspector (§54) can show everyone's activity;
-- INSERT/UPDATE stays strictly self-only.
DROP POLICY IF EXISTS "select own or staff action plans" ON ai_action_plans;
CREATE POLICY "select own or staff action plans" ON ai_action_plans
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role <> 'inspector')
  );

DROP POLICY IF EXISTS "insert own action plans" ON ai_action_plans;
CREATE POLICY "insert own action plans" ON ai_action_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own action plans" ON ai_action_plans;
CREATE POLICY "update own action plans" ON ai_action_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select own or staff executions" ON ai_executions;
CREATE POLICY "select own or staff executions" ON ai_executions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role <> 'inspector')
  );

DROP POLICY IF EXISTS "insert own executions" ON ai_executions;
CREATE POLICY "insert own executions" ON ai_executions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own executions" ON ai_executions;
CREATE POLICY "update own executions" ON ai_executions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- GRANTs — required on this project; RLS alone is not enough
-- (this exact gap has silently broken several earlier features).
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_prompts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_tools TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_action_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_executions TO authenticated;

-- ============================================================
-- Seed: initial prompt, skills, tool metadata.
-- Safe to re-run — guarded by NOT EXISTS on the active row per key.
-- ============================================================
INSERT INTO ai_prompts (key, name, system_prompt, version, is_active)
SELECT 'ygri_copilot', 'Ygri Copilot — main system prompt',
$$You are Ygri Copilot, an operational assistant embedded in Ygri CRM.

Use CRM data as the source of truth. Distinguish confirmed facts from inference — if something is not present in the context or a tool result, say it is unknown rather than guessing.

Never claim that a CRM action succeeded until the execution engine confirms it. READ tools may be used to gather information automatically. WRITE tools are proposals only — you never change CRM state directly. When the user asks for something that requires a write (creating a task, adding a comment, etc.), call the corresponding write tool once with your best-resolved arguments; the system will turn it into a proposal the user must explicitly confirm before anything is saved. Never tell the user that you created, updated, completed, sent, moved, or deleted something unless execution has actually succeeded and been reported back to you.

Use the current page context when resolving phrases such as "this project", "this client", or "this quotation". When information is ambiguous (e.g. an unclear assignee), retrieve more context rather than guessing, and say what's unclear.

Prefer structured CRM facts (stage, dates, counts, totals) over assumptions. Keep operational answers concise and actionable — this is a working tool for a busy import/export team, not a general-purpose chatbot.$$,
  1, true
WHERE NOT EXISTS (SELECT 1 FROM ai_prompts WHERE key = 'ygri_copilot' AND is_active);

INSERT INTO ai_skills (key, name, domain, instructions, applies_to_tools, is_active, version)
SELECT * FROM (VALUES
  ('project_intelligence', 'Project Intelligence', 'project',
$$Prefer the deterministic facts already computed in the project context (stage, days in stage, task counts, quotation totals, etc.) over anything you might infer yourself. Separate confirmed facts from inference explicitly in your answer. Identify overdue work, missing information, and upcoming deadlines using those facts. Reference recent communication (conversation and email) when relevant. When a project needs attention, explain concretely why. Suggest reasonable next actions, but never claim an operation was performed unless execution actually succeeded.$$,
   ARRAY['get_project_status','get_project_activity']::text[], true, 1),
  ('pipeline_management', 'Pipeline Management', 'project',
$$To reason about pipeline stage: load the project's current stage from data, never assume it. The next valid stage is determined by stage order within the project's workflow, not guessed. Note any open required tasks/files before suggesting an advance. You may explain what a stage transition would involve, but you must never directly propose changing tracks.current_stage_template_id — stage advancement is not an available tool yet in this system. If asked to advance a project, explain that this capability is not enabled yet.$$,
   ARRAY['get_pipeline','get_current_stage']::text[], true, 1),
  ('task_management', 'Task Management', 'tasks',
$$When asked to create a task: resolve the project/stage from page context when available. Resolve relative dates ("tomorrow", "Friday") against the current date you are given — never assume UTC blindly. Only set an assignee if the user named someone clearly resolvable from the people already visible in context; if ambiguous, leave it unassigned rather than guessing. Always propose via the create_task tool — never claim a task was created before execution succeeds.$$,
   ARRAY['create_task','update_task','get_tasks','get_overdue_tasks']::text[], true, 1),
  ('client_management', 'Client Management', 'clients',
$$Client creation is not enabled as a write tool yet. If asked to create a client, use search_clients first to check for likely duplicates and explain what you find; state clearly that creating a new client isn't available in this version yet.$$,
   ARRAY['search_clients','get_client']::text[], true, 1),
  ('quotation_management', 'Quotation Management', 'quotations',
$$Quotation actions are read-only in this version. Use get_quotation to answer questions about totals, validity, and items. Never invent prices, quantities, or terms that are not present in the data. If asked to draft or modify a quotation, explain that this capability isn't enabled yet.$$,
   ARRAY['get_quotation']::text[], true, 1),
  ('email_intelligence', 'Email Intelligence', 'email',
$$Reason from the structured fields on email threads (summary, sentiment, action_items, needs_response, priority) before ever suggesting a raw email body be loaded. Most questions about "are we waiting on a reply" or "what did they ask for" are answerable from those fields alone.$$,
   ARRAY['get_email_threads']::text[], true, 1)
) AS v(key, name, domain, instructions, applies_to_tools, is_active, version)
WHERE NOT EXISTS (SELECT 1 FROM ai_skills s WHERE s.key = v.key AND s.is_active);

INSERT INTO ai_tools (key, name, description, tool_type, enabled, allowed_roles)
SELECT * FROM (VALUES
  ('search_clients', 'Search clients', 'Search clients by name.', 'read', true, ARRAY['staff']::text[]),
  ('get_client', 'Get client', 'Load one client and its aggregate activity.', 'read', true, ARRAY['staff']::text[]),
  ('search_projects', 'Search projects', 'Search projects/tracks by name or client.', 'read', true, ARRAY['staff']::text[]),
  ('get_project', 'Get project', 'Load project identity, pipeline, and status facts.', 'read', true, ARRAY['staff']::text[]),
  ('get_project_status', 'Get project status', 'Deterministic Project Status Engine facts for one project.', 'read', true, ARRAY['staff']::text[]),
  ('get_project_activity', 'Get project activity', 'Recent or paginated conversation for a project.', 'read', true, ARRAY['staff']::text[]),
  ('search_suppliers', 'Search suppliers', 'Search suppliers by name.', 'read', true, ARRAY['staff']::text[]),
  ('get_supplier', 'Get supplier', 'Load one supplier and related activity.', 'read', true, ARRAY['staff']::text[]),
  ('get_tasks', 'Get tasks', 'List tasks, optionally filtered by project.', 'read', true, ARRAY['staff']::text[]),
  ('get_overdue_tasks', 'Get overdue tasks', 'List tasks past their due date and not done.', 'read', true, ARRAY['staff']::text[]),
  ('get_quotation', 'Get quotation', 'Load a project''s latest or a specific quotation.', 'read', true, ARRAY['staff']::text[]),
  ('get_pipeline', 'Get pipeline', 'List a project''s stages and their status.', 'read', true, ARRAY['staff']::text[]),
  ('get_current_stage', 'Get current stage', 'The single current stage of a project.', 'read', true, ARRAY['staff']::text[]),
  ('get_email_threads', 'Get email threads', 'Structured email thread summaries for a client/supplier/project.', 'read', true, ARRAY['staff']::text[]),
  ('get_shipments', 'Get shipments', 'Shipment status for a project.', 'read', true, ARRAY['staff']::text[]),
  ('get_inspection_reports', 'Get inspection reports', 'Inspection report status for a project.', 'read', true, ARRAY['staff']::text[]),
  ('create_task', 'Create task', 'Propose creating a task on a project stage.', 'write', true, ARRAY['staff']::text[]),
  ('add_project_message', 'Add project comment', 'Propose adding a comment to a project''s conversation.', 'write', true, ARRAY['staff']::text[])
) AS v(key, name, description, tool_type, enabled, allowed_roles)
WHERE NOT EXISTS (SELECT 1 FROM ai_tools t WHERE t.key = v.key);
