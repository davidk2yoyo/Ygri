import { randomUUID } from "crypto";
import { WRITE_TOOLS } from "./tools/writeTools.js";
import { HttpError } from "./supabaseServer.js";

export const ACTION_PLAN_TTL_MS = 15 * 60 * 1000;

const writeToolByKey = Object.fromEntries(WRITE_TOOLS.map((t) => [t.key, t]));

// Shared shape-builder between a fresh proposal (buildActionPlan) and an
// in-place edit (amendAction) — both ultimately just run a tool's
// validate() and record the result the same way.
function actionFromValidation(call, result) {
  return {
    tool: call.tool,
    type: "write",
    label: result.label,
    target: result.target,
    // A tool's validate() may return normalizedArgs to carry forward
    // something it resolved (e.g. create_task remembering which client a
    // task is scoped to even after the user clears the project dropdown)
    // — stored as this action's base arguments for the next amend/confirm.
    arguments: result.normalizedArgs || call.arguments,
    resolved_arguments: result.resolvedArgs,
    current_state: result.current_state,
    proposed_state: result.proposed_state,
    validation: { status: result.valid ? "valid" : "invalid", errors: result.errors || [] },
    warnings: result.warnings || [],
    // Fields the tool itself says are safe to change from the Action Card
    // before confirming (e.g. which project a task attaches to, its due
    // date) — see amendAction below. Never derived from the browser.
    editable: result.editable || null,
    selected: result.valid,
    status: "proposed",
  };
}

// Turns raw {tool, arguments} tool calls the model requested into the
// canonical, server-validated Action Plan. The model NEVER gets to assert
// current_state/validation itself — every field here comes from actually
// querying the database (Copilot Blueprint §G).
//
// modelMessage is whatever text content the model included alongside its
// tool call, if any — the final assistant_message is composed from that
// PLUS a clear statement of any validation failures, computed after
// building `actions`. This matters beyond the current turn: assistant_message
// is what gets saved into conversation history (see conversations.js), so
// if a proposed action was invalid, the model needs to actually see why on
// its next turn — otherwise it has no way to self-correct and will retry
// the identical mistake (observed in testing: the model reused a client's
// id as track_id twice in a row because the failure reason never made it
// back into its own context).
export async function buildActionPlan({ supabase, userId, pageContext, writeCalls, modelMessage }) {
  const actions = [];
  let sequence = 1;

  for (const call of writeCalls) {
    const tool = writeToolByKey[call.tool];
    if (!tool) {
      actions.push({
        action_id: randomUUID(),
        sequence: sequence++,
        tool: call.tool,
        type: "write",
        label: call.tool,
        target: null,
        arguments: call.arguments,
        current_state: null,
        proposed_state: null,
        depends_on: [],
        validation: { status: "invalid", errors: [`Unknown or disabled tool: ${call.tool}`] },
        warnings: [],
        editable: null,
        selected: false,
        status: "proposed",
      });
      continue;
    }

    let result;
    try {
      result = await tool.validate(call.arguments, { supabase, userId, pageContext });
    } catch (e) {
      result = { valid: false, errors: [e.message], warnings: [], target: null, current_state: null, proposed_state: null, label: call.tool, resolvedArgs: null };
    }

    actions.push({ action_id: randomUUID(), sequence: sequence++, depends_on: [], ...actionFromValidation(call, result) });
  }

  const expiresAt = new Date(Date.now() + ACTION_PLAN_TTL_MS).toISOString();
  const { data: plan, error } = await supabase
    .from("ai_action_plans")
    .insert({
      user_id: userId,
      page_context: pageContext || {},
      assistant_message: composeAssistantMessage(modelMessage, actions),
      actions,
      status: "proposed",
      expires_at: expiresAt,
    })
    .select("id, created_at, expires_at, page_context, assistant_message, actions, status")
    .single();

  if (error) throw new Error(`Could not persist action plan: ${error.message}`);
  return plan;
}

function composeAssistantMessage(modelMessage, actions) {
  const valid = actions.filter((a) => a.validation.status === "valid");
  const invalid = actions.filter((a) => a.validation.status === "invalid");

  const parts = [];
  if (modelMessage) {
    parts.push(modelMessage);
  } else if (valid.length) {
    parts.push(`I can do the following: ${valid.map((a) => a.label).join(", ")}. Please review and confirm.`);
  }
  if (invalid.length) {
    parts.push(invalid.map((a) => `I couldn't prepare "${a.label}" — ${a.validation.errors.join(" ")}`).join(" "));
  }

  return parts.filter(Boolean).join("\n\n") || "I couldn't prepare any of the requested actions.";
}

// Strips internal fields before an action plan goes to the browser — the
// frontend never needs resolved_arguments (DB ids, etc.), only enough to
// render the card and send back {plan_id, selected_action_ids}. `editable`
// IS sent — it's already just the {value, options: [{value, label}]} a
// picker needs, nothing more sensitive than proposed_state itself.
export function planForClient(plan) {
  return {
    plan_id: plan.id,
    created_at: plan.created_at,
    expires_at: plan.expires_at,
    assistant_message: plan.assistant_message,
    status: plan.status,
    actions: plan.actions.map((a) => ({
      action_id: a.action_id,
      sequence: a.sequence,
      tool: a.tool,
      label: a.label,
      proposed_state: a.proposed_state,
      warnings: a.warnings,
      validation: a.validation,
      editable: a.editable,
      selected: a.selected,
      status: a.status,
    })),
  };
}

// Lets the user change one of a still-proposed action's `editable` fields
// (e.g. which project a task attaches to, its due date) before confirming
// — without ever trusting the browser's arguments directly. The browser
// sends {plan_id, action_id, overrides: {field: value}}; the server merges
// only fields the action itself already whitelisted via `editable` into a
// copy of the ORIGINAL model-proposed arguments, then re-runs the tool's
// own validate() on that merge — same trusted gate buildActionPlan and the
// confirm-time revalidation in executor.js both use. Nothing is persisted
// or executed based on a value the server hasn't independently validated.
export async function amendAction({ supabase, userId, planId, actionId, overrides }) {
  const { data: plan, error: loadErr } = await supabase.from("ai_action_plans").select("*").eq("id", planId).maybeSingle();
  if (loadErr || !plan) throw new HttpError(404, "Action plan not found");
  if (plan.user_id !== userId) throw new HttpError(403, "Only the user who requested this plan may edit it");
  if (plan.status !== "proposed") throw new HttpError(409, "This plan can no longer be edited.");
  if (new Date(plan.expires_at).getTime() < Date.now()) {
    await supabase.from("ai_action_plans").update({ status: "expired" }).eq("id", plan.id);
    throw new HttpError(410, "This plan expired — please ask again.");
  }

  const actions = [...plan.actions];
  const idx = actions.findIndex((a) => a.action_id === actionId);
  if (idx === -1) throw new HttpError(404, "Action not found in this plan");

  const tool = writeToolByKey[actions[idx].tool];
  if (!tool) throw new HttpError(400, "Unknown tool for this action");

  const editableKeys = new Set(Object.keys(actions[idx].editable || {}));
  const mergedArgs = { ...actions[idx].arguments };
  for (const [field, value] of Object.entries(overrides || {})) {
    if (!editableKeys.has(field)) throw new HttpError(400, `Field "${field}" is not editable on this action.`);
    if (value === "" || value === undefined || value === null) delete mergedArgs[field];
    else mergedArgs[field] = value;
  }

  let result;
  try {
    result = await tool.validate(mergedArgs, { supabase, userId, pageContext: plan.page_context });
  } catch (e) {
    result = { valid: false, errors: [e.message], warnings: [], target: null, current_state: null, proposed_state: null, label: actions[idx].label, resolvedArgs: null };
  }

  actions[idx] = { ...actions[idx], ...actionFromValidation({ tool: actions[idx].tool, arguments: mergedArgs }, result) };

  const { data: updated, error } = await supabase
    .from("ai_action_plans")
    .update({ actions })
    .eq("id", plan.id)
    .select("id, created_at, expires_at, page_context, assistant_message, actions, status")
    .single();
  if (error) throw new Error(`Could not update action plan: ${error.message}`);
  return updated;
}
