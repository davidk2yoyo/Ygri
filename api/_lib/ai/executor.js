import { WRITE_TOOLS } from "./tools/writeTools.js";
import { HttpError } from "./supabaseServer.js";

const writeToolByKey = Object.fromEntries(WRITE_TOOLS.map((t) => [t.key, t]));

// The only path that may actually write to the CRM. Reloads the canonical,
// server-authored plan by id — the browser only ever sends
// {plan_id, selected_action_ids}, never tool/arguments/target (§69).
export async function executeActionPlan({ supabase, userId, planId, selectedActionIds }) {
  const { data: plan, error: loadErr } = await supabase.from("ai_action_plans").select("*").eq("id", planId).maybeSingle();
  if (loadErr || !plan) throw new HttpError(404, "Action plan not found");

  // RLS's SELECT policy is intentionally broader (staff can view any plan
  // for the Executions inspector) — ownership for CONFIRMING is still
  // enforced explicitly here, not left to RLS alone (§70).
  if (plan.user_id !== userId) throw new HttpError(403, "Only the user who requested this plan may confirm it");

  // Truly terminal states only — "completed"/"failed"/"partially_completed"
  // stay retryable (per-action idempotency below no-ops anything already
  // done, and a failed/stale action can legitimately succeed on retry).
  if (["expired", "cancelled"].includes(plan.status)) {
    return { plan_id: plan.id, status: plan.status, actions: plan.actions.map(toResultShape), note: "This plan is no longer active." };
  }

  if (new Date(plan.expires_at).getTime() < Date.now()) {
    await supabase.from("ai_action_plans").update({ status: "expired" }).eq("id", plan.id);
    return { plan_id: plan.id, status: "expired", actions: plan.actions.map(toResultShape), note: "This plan expired — please ask again." };
  }

  if (!selectedActionIds.length) {
    return { plan_id: plan.id, status: plan.status, actions: plan.actions.map(toResultShape), note: "No actions were selected." };
  }

  await supabase.from("ai_action_plans").update({ status: "executing" }).eq("id", plan.id);

  const actions = [...plan.actions];
  const skippedDueToDependency = new Set();

  for (const action of actions.sort((a, b) => a.sequence - b.sequence)) {
    const wasSelected = selectedActionIds.includes(action.action_id);

    // Idempotency: a prior confirm already ran this action successfully —
    // never re-execute it, just report the existing result (§36).
    if (action.status === "completed") continue;

    if (!wasSelected) {
      action.status = "skipped";
      continue;
    }
    if (action.depends_on?.some((depId) => skippedDueToDependency.has(depId))) {
      action.status = "skipped";
      action.warnings = [...(action.warnings || []), "Skipped because a dependency was not completed."];
      skippedDueToDependency.add(action.action_id);
      continue;
    }

    const tool = writeToolByKey[action.tool];
    if (!tool) {
      action.status = "failed";
      action.error = "Unknown tool at execution time.";
      skippedDueToDependency.add(action.action_id);
      continue;
    }

    // Revalidate against CURRENT state — never assume nothing changed
    // since proposal (§34). The original model-provided arguments (not the
    // stale resolved_arguments) are re-resolved fresh.
    let revalidated;
    try {
      revalidated = await tool.validate(action.arguments, { supabase, userId, pageContext: plan.page_context });
    } catch (e) {
      revalidated = { valid: false, errors: [e.message] };
    }
    if (!revalidated.valid) {
      action.status = "stale";
      action.error = "This changed since it was proposed: " + (revalidated.errors || []).join(" ");
      skippedDueToDependency.add(action.action_id);
      continue;
    }

    try {
      action.status = "executing";
      const result = await tool.execute(revalidated.resolvedArgs, { supabase, userId, executionId: plan.id });
      action.status = "completed";
      action.result = result;
    } catch (e) {
      action.status = "failed";
      action.error = e.message;
      skippedDueToDependency.add(action.action_id);
    }
  }

  const executedCount = actions.filter((a) => a.status === "completed").length;
  const attemptedCount = actions.filter((a) => selectedActionIds.includes(a.action_id)).length;
  const finalStatus =
    executedCount === 0 && attemptedCount > 0 ? "failed" : executedCount < attemptedCount ? "partially_completed" : "completed";

  await supabase
    .from("ai_action_plans")
    .update({ status: finalStatus, actions, executed_at: new Date().toISOString() })
    .eq("id", plan.id);

  await supabase
    .from("ai_executions")
    .update({
      approved_action_ids: selectedActionIds,
      executed_action_ids: actions.filter((a) => a.status === "completed").map((a) => a.action_id),
      result: `${executedCount}/${attemptedCount} action(s) executed`,
    })
    .eq("plan_id", plan.id);

  return { plan_id: plan.id, status: finalStatus, actions: actions.map(toResultShape) };
}

function toResultShape(a) {
  return { action_id: a.action_id, label: a.label, status: a.status, result: a.result || null, error: a.error || null };
}
