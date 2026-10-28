import { createClient } from "@supabase/supabase-js";
import { retrieveFromDataset, askDifyChat } from "./_lib/ai/dify/client.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Portal version of api/quotations-ai-chat.js. The client portal has no real
// Supabase Auth session (see client_portal_sessions / client_portal_verify_session)
// so the only credential here is the portal session_id the browser already
// holds — same trust model as every other client_portal_* RPC call the
// portal makes directly. The isolation boundary is still entirely server
// side: client_portal_get_quotations_ai_status resolves the client from the
// session itself, so a session can never be used to read another client's
// dataset_id, let alone another client's documents.
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { res.status(500).json({ error: "Supabase environment variables are not configured on the server" }); return; }

    const { sessionId, message, conversationId } = req.body || {};
    if (!sessionId) { res.status(400).json({ error: "Missing required field: sessionId" }); return; }
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Missing required field: message" }); return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: rows, error } = await supabase.rpc("client_portal_get_quotations_ai_status", { p_session_id: sessionId });
    if (error) { res.status(500).json({ error: error.message }); return; }
    const setting = rows?.[0];
    if (!setting?.enabled || !setting?.dify_dataset_id) {
      res.status(403).json({ error: "Cotizaciones IA no está habilitado para tu cuenta." });
      return;
    }

    const records = await retrieveFromDataset({ datasetId: setting.dify_dataset_id, query: message.trim() });
    const context = records.length
      ? records.map((r, i) => `[${i + 1}] (${r.documentName})\n${r.content}`).join("\n\n")
      : "No se encontró información relevante en los documentos de este cliente.";

    const { answer, conversationId: nextConversationId } = await askDifyChat({
      context,
      query: message.trim(),
      conversationId: conversationId || null,
      user: `portal-${sessionId}`,
    });

    const citations = [...new Map(records.map(r => [r.documentName, r])).values()]
      .map(r => ({ document: r.documentName, score: r.score }));

    res.status(200).json({ answer, conversationId: nextConversationId, citations });
  } catch (err) {
    console.error("[quotations-ai-chat-portal]", err);
    res.status(err.status || 500).json({ error: err.message || "Internal error" });
  }
}
