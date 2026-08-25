import { authenticateRequest, sendError, HttpError } from "./_lib/ai/supabaseServer.js";
import { executeActionPlan } from "./_lib/ai/executor.js";

// Confirms and executes a previously-proposed Action Plan. The browser only
// ever sends {plan_id, selected_action_ids} — the server reloads the
// canonical plan and re-derives everything else (§69).
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");

    const { userId, supabase } = await authenticateRequest(req);

    const { plan_id, selected_action_ids } = req.body || {};
    if (!plan_id || typeof plan_id !== "string") throw new HttpError(400, "Missing required field: plan_id");
    if (!Array.isArray(selected_action_ids)) throw new HttpError(400, "selected_action_ids must be an array");

    const result = await executeActionPlan({ supabase, userId, planId: plan_id, selectedActionIds: selected_action_ids });
    res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
}
