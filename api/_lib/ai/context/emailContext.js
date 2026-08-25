// Structured-fields-first — use summary/sentiment/action_items/needs_response
// before ever touching a raw email_messages body (Copilot Blueprint §16).
const THREAD_FIELDS = "id, subject, summary, sentiment, key_topics, action_items, needs_response, priority, direction, last_received_at, from_name, from_email";

export async function getEmailThreads(supabase, { trackId, clientId, supplierId, limit = 10 } = {}) {
  let query = supabase.from("email_threads").select(THREAD_FIELDS).order("last_received_at", { ascending: false }).limit(limit);
  if (trackId) query = query.eq("project_id", trackId);
  else if (clientId) query = query.eq("client_id", clientId);
  else if (supplierId) query = query.eq("supplier_id", supplierId);
  else return [];
  const { data } = await query;
  return data || [];
}

// Deep/on-demand only — raw message bodies for one thread.
export async function getThreadMessages(supabase, threadId, limit = 20) {
  const { data } = await supabase
    .from("email_messages")
    .select("from_name, from_email, subject, body_text, is_from_me, received_at")
    .eq("thread_id", threadId)
    .order("received_at", { ascending: false })
    .limit(limit);
  return data || [];
}
