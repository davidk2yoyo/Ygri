import { supabase } from "../../supabaseClient";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
}

async function postJson(url, body) {
  const headers = await authHeaders();
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// { message, plan } — plan is null unless the turn produced WRITE proposals.
export function sendCopilotMessage({ message, pageContext, history }) {
  return postJson("/api/ai-orchestrator", { message, pageContext, history });
}

// { plan_id, status, actions: [{action_id, label, status, result, error}] }
export function confirmActionPlan({ planId, selectedActionIds }) {
  return postJson("/api/ai-action-execute", { plan_id: planId, selected_action_ids: selectedActionIds });
}
