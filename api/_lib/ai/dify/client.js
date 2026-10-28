// Backend-only Dify access for "Cotizaciones IA". Dify holds every document,
// chunk and embedding itself — Ygri never uploads, stores or indexes a file
// for this feature. This module only does two things: pull the best-matching
// chunks out of one client's dataset, and ask a single shared, Knowledge-
// Retrieval-free Dify Chat app to turn them into a Spanish answer.
const DIFY_BASE_URL = (process.env.DIFY_BASE_URL || "https://dify.heruba.guru").replace(/\/+$/, "");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`${name} is not configured on the server`);
    err.status = 500;
    throw err;
  }
  return v;
}

// Scoped entirely by datasetId — this function has no notion of "which
// client". The caller must have already verified, against Supabase, that
// datasetId belongs to the client the request is authorized for. That check
// is the actual isolation boundary; this is just the HTTP call.
export async function retrieveFromDataset({ datasetId, query, topK = 6 }) {
  const apiKey = requireEnv("DIFY_KNOWLEDGE_API_KEY");
  const res = await fetch(`${DIFY_BASE_URL}/v1/datasets/${encodeURIComponent(datasetId)}/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      retrieval_model: {
        search_method: "hybrid_search",
        reranking_enable: false,
        top_k: topK,
        score_threshold_enabled: false,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `Dify retrieve failed (${res.status})`);
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }
  const data = await res.json();
  return (data.records || []).map(r => ({
    content: r.segment?.content || "",
    documentName: r.segment?.document?.name || r.segment?.document_name || "Documento",
    score: typeof r.score === "number" ? r.score : null,
  }));
}

// One turn against the shared LLM-only Dify app (no Knowledge Retrieval node
// configured on it — the context comes from retrieveFromDataset above,
// already scoped to the right client). That app's prompt template must
// reference an input variable named "context".
export async function askDifyChat({ context, query, conversationId, user }) {
  const apiKey = requireEnv("DIFY_CHAT_API_KEY");
  const res = await fetch(`${DIFY_BASE_URL}/v1/chat-messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      inputs: { context },
      query,
      response_mode: "blocking",
      conversation_id: conversationId || undefined,
      user,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `Dify chat failed (${res.status})`);
    err.status = res.status >= 400 && res.status < 500 ? 502 : 500;
    throw err;
  }
  const data = await res.json();
  return { answer: data.answer || "", conversationId: data.conversation_id || null };
}
