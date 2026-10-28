import { supabase } from "../../supabaseClient";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
}

// { answer, conversationId, citations: [{document, score}] } — pass the
// previous conversationId to keep follow-up questions in the same Dify
// conversation; omit it to start a new one.
export async function sendQuotationsAiMessage({ clientId, message, conversationId }) {
  const headers = await authHeaders();
  const res = await fetch("/api/quotations-ai-chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ clientId, message, conversationId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
