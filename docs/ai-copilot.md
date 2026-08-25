# Ygri Copilot — developer guide

Architecture reference for `api/_lib/ai/**`, `api/ai-orchestrator.js`, `api/ai-action-execute.js`, and `src/components/ai/**`. Read this before adding a new tool.

## The one invariant

> The model may understand, read, and propose. It may NOT change CRM state without explicit human approval — and the server enforces this, not the prompt.

Concretely: `api/_lib/ai/orchestrate.js` never calls a WRITE tool's `execute()`. When the model requests a WRITE tool, the orchestrator intercepts it, builds an `ai_action_plans` row, and stops. Only `api/ai-action-execute.js` — a separate endpoint, called only after the user clicks Confirm — ever calls `execute()`, and only after reloading the plan from the database and revalidating it.

## Request flow

```
Browser (src/lib/ai/copilotClient.js)
  → POST /api/ai-orchestrator  { message, pageContext, history }
      authenticateRequest()          — verifies the Supabase JWT, builds a
                                        user-scoped client (never service_role)
      runOrchestratorTurn()
        loadActivePrompt() + loadRelevantSkills()
        loop (max 5 iterations):
          callOpenAI() with all enabled tool schemas
          if only READ tool_calls  → execute them, feed results back, loop
          if any WRITE tool_calls  → STOP, do not execute
        if a WRITE was requested   → buildActionPlan() → persist → return {message, plan}
        else                        → return {message}
        always insert one ai_executions row

  → POST /api/ai-action-execute  { plan_id, selected_action_ids }
      authenticateRequest()
      executeActionPlan()
        reload the canonical plan by id — never trust anything from the browser
        check plan.user_id === caller (403 otherwise)
        check TTL (15 min) — expired plans cannot execute
        for each selected action: re-run validate() against CURRENT data
          (a changed stage/quotation/etc. marks that action "stale", not silently adapted)
        execute() only the ones that revalidate clean, via the same
          RPC/insert the manual UI already uses
        update ai_action_plans + the linked ai_executions row
```

## Context Engine

`api/_lib/ai/context/*.js`. `buildProjectContext(supabase, trackId)` is the automatic "core" context loaded on every turn — compact, all deterministic facts, no raw dumps. Deeper detail (full conversation history, quotation items, email bodies) is **not** a separate context depth — it's the same query functions (`getRecentMessages`, `getQuotations`, etc.) reused directly by the READ tools in `tools/readTools.js`. One implementation, two call sites — don't duplicate this.

`projectStatusEngine.js` holds the pure, unit-tested fact calculations (see `scripts/test-ai-core.mjs`). Every fact carries a `reliability` tag (`high`/`medium`/`unavailable`) — never hide that a fact is shaky.

**Inspection status is never inferred from pipeline stage.** `computeInspectionFacts()` reads only `inspection_reports.status`. Don't change this.

## Skills

`ai_skills` rows, loaded and injected into the system prompt alongside the base `ai_prompts` text (`skills.js`). A Skill is instruction text, not code — it never executes anything itself. Selection is by `applies_to_tools` intersecting the tool set offered that turn.

## Adding a READ tool

Add one entry to `READ_TOOLS` in `api/_lib/ai/tools/readTools.js`:

```js
{
  key: "my_tool",
  description: "...", // the model reads this to decide when to call it
  parameters: { type: "object", properties: { ... }, required: [...] }, // JSON Schema
  handler: async (args, { supabase, userId, pageContext }) => { /* return plain data */ },
}
```

Then add a matching row to the `ai_tools` seed in `supabase-ai-copilot.sql` (or insert one via the AI Management → Tools tab) with `tool_type: 'read'`. The DB row only controls enabled/disabled — the `type` in code is authoritative and can't be downgraded from the database (see `orchestrate.js`'s `getEnabledToolKeys`, which only ever filters, never reclassifies).

## Adding a WRITE tool

Add one entry to `WRITE_TOOLS` in `api/_lib/ai/tools/writeTools.js` with **three** parts:

1. `parameters` — what the model can specify.
2. `validate(args, ctx)` — queries the database fresh (never trusts model claims), returns `{ valid, errors, warnings, target, current_state, proposed_state, label, resolvedArgs }`. This runs at proposal time *and* again at confirmation time — write it idempotently, with no side effects.
3. `execute(resolvedArgs, ctx)` — the actual write, called only by the executor after a clean revalidation. **Reuse the exact RPC/insert the manual UI already calls** — an AI-created task must be indistinguishable from a human-created one. Don't invent parallel semantics.

Then seed its `ai_tools` row with `tool_type: 'write'`, and decide whether it needs its own Skill (`ai_skills`) governing how the model should reason about proposing it.

**Do not** wrap `create_track_rpc` or `complete_stage_and_advance` yet — both are flagged in the Copilot Blueprint as needing prerequisite work (extracting the opaque RPC / unifying the two pipeline-advance code paths) before they're safe to expose.

## Why the browser can't just send the plan back

`api/_lib/ai/actionPlan.js` builds and persists the full plan server-side; `planForClient()` strips it down to what the UI needs to render. The browser only ever echoes back `{plan_id, selected_action_ids}` — never `tool`, `arguments`, `target`, or `proposed_state`. `executor.js` reloads the canonical row and ignores anything the browser might have sent beyond the plan id and selection. This is deliberate: a compromised or buggy browser client cannot alter what actually executes.

## Idempotency

Each action carries a UUID `action_id`. `executor.js` checks `action.status === "completed"` before re-executing — a double-confirm (double click, retry, replay) is a no-op that returns the original result, not a duplicate write.

## Environment variables

No *new* ones — the orchestrator reuses what's already in Vercel/`.env`:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — same ones the browser uses; read server-side via `process.env` (Vite's `VITE_` prefix restriction only applies to the browser bundle, not Node).
- `OPENAI_API_KEY` — already used by `api/ai-scan.js`.

The orchestrator never uses `SUPABASE_SERVICE_ROLE_KEY`. If you're tempted to add a service-role call anywhere in `api/_lib/ai/**`, stop — that breaks the "acts as the authenticated user" guarantee this whole design depends on.

## Inspecting what the Copilot did

`/ai-management` → **Executions** tab. Each row is one orchestrator turn: model, prompt/skill versions used, which tools were called, tokens, latency, and — if it produced a plan — how many of its actions were approved vs. actually executed. `/ai-management` → **Overview** has same-day aggregate counts.

## What this phase deliberately does not do

See the Copilot Blueprint and the implementation report for the full list — in short: no `create_project`, `advance_stage`, quotation writes, shipment/PO writes, proactive/background agents, or multi-agent orchestration. Two WRITE tools only: `create_task`, `add_project_message`.
