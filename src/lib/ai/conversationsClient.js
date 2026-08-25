import { supabase } from "../../supabaseClient";

export async function listConversations(limit = 50) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at, created_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function deleteConversation(conversationId) {
  const { error } = await supabase.from("ai_conversations").delete().eq("id", conversationId);
  if (error) throw new Error(error.message);
}

// Mirrors api/_lib/ai/actionPlan.js's planForClient() shape, client-side —
// used to redisplay an Action Card for a plan that was proposed earlier in
// a conversation someone re-opens (RLS already scopes this to their own).
async function loadPlanForClient(planId) {
  const { data: plan } = await supabase.from("ai_action_plans").select("id, created_at, expires_at, assistant_message, actions, status").eq("id", planId).maybeSingle();
  if (!plan) return null;
  return {
    plan_id: plan.id,
    created_at: plan.created_at,
    expires_at: plan.expires_at,
    assistant_message: plan.assistant_message,
    status: plan.status,
    actions: (plan.actions || []).map((a) => ({
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

// Returns messages in the {role, content, plan?} shape YgriCopilot/CopilotPage render.
export async function loadConversationMessages(conversationId) {
  const { data, error } = await supabase
    .from("ai_conversation_messages")
    .select("role, content, plan_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const messages = [];
  for (const row of data || []) {
    const message = { role: row.role, content: row.content };
    if (row.plan_id) message.plan = await loadPlanForClient(row.plan_id);
    messages.push(message);
  }
  return messages;
}
