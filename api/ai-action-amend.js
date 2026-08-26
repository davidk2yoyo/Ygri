import { authenticateRequest, sendError, HttpError } from "./_lib/ai/supabaseServer.js";
import { amendAction, planForClient } from "./_lib/ai/actionPlan.js";

// Lets the user change an editable field (e.g. which project a task
// attaches to, or its due date) on a still-proposed action before
// confirming. The browser sends {plan_id, action_id, overrides} — but the
// server never trusts those values directly: it merges only fields the
// action itself already whitelisted via `editable` into the original
// model-proposed arguments, then re-runs the tool's own validate() before
// persisting anything (see amendAction in _lib/ai/actionPlan.js). Nothing
// here executes — confirm (ai-action-execute.js) still revalidates again.
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");

    const { userId, supabase } = await authenticateRequest(req);

    const { plan_id, action_id, overrides } = req.body || {};
    if (!plan_id || typeof plan_id !== "string") throw new HttpError(400, "Missing required field: plan_id");
    if (!action_id || typeof action_id !== "string") throw new HttpError(400, "Missing required field: action_id");
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new HttpError(400, "overrides must be an object");

    const plan = await amendAction({ supabase, userId, planId: plan_id, actionId: action_id, overrides });
    res.status(200).json(planForClient(plan));
  } catch (err) {
    sendError(res, err);
  }
}
