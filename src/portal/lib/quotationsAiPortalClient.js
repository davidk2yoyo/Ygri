// { answer, conversationId, citations: [{document, score}] } — pass the
// previous conversationId to keep follow-up questions in the same Dify
// conversation; omit it to start a new one.
export async function sendPortalQuotationsAiMessage({ sessionId, message, conversationId }) {
  const res = await fetch("/api/quotations-ai-chat-portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message, conversationId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
