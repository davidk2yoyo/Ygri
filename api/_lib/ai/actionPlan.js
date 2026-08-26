import { randomUUID } from "crypto";
import { WRITE_TOOLS } from "./tools/writeTools.js";

export const ACTION_PLAN_TTL_MS = 15 * 60 * 1000;

const writeToolByKey = Object.fromEntries(WRITE_TOOLS.map((t) => [t.key, t]));

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

    actions.push({
      action_id: randomUUID(),
      sequence: sequence++,
      tool: call.tool,
      type: "write",
      label: result.label,
      target: result.target,
      arguments: call.arguments,
      resolved_arguments: result.resolvedArgs,
      current_state: result.current_state,
      proposed_state: result.proposed_state,
      depends_on: [],
      validation: { status: result.valid ? "valid" : "invalid", errors: result.errors || [] },
      warnings: result.warnings || [],
      selected: result.valid,
      status: "proposed",
    });
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
// render the card and send back {plan_id, selected_action_ids}.
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
      selected: a.selected,
      status: a.status,
    })),
  };
}
