const HISTORY_LIMIT = 30; // bounds tokens/cost per turn — older context is still in the DB, just not resent every time

// Loads (or creates) the conversation this turn belongs to, and its recent
// message history in the {role, content} shape callOpenAI expects. Chat
// history now lives server-side so it survives a reload — the browser
// only ever needs to remember a conversation_id.
export async function loadOrCreateConversation(supabase, userId, conversationId, pageContext, firstMessage) {
  if (conversationId) {
    const { data } = await supabase.from("ai_conversations").select("id, title").eq("id", conversationId).maybeSingle();
    if (data) return data; // RLS already scopes this to the caller's own rows
  }
  const title = (firstMessage || "New conversation").slice(0, 80);
  const { data: created, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title, page_context: pageContext || {} })
    .select("id, title")
    .single();
  if (error) throw new Error(`Could not start a conversation: ${error.message}`);
  return created;
}

export async function loadHistory(supabase, conversationId) {
  const { data } = await supabase
    .from("ai_conversation_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  return (data || []).reverse();
}

export async function appendMessage(supabase, conversationId, userId, role, content, planId = null) {
  await supabase.from("ai_conversation_messages").insert({ conversation_id: conversationId, user_id: userId, role, content, plan_id: planId });
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}
