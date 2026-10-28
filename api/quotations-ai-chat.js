import { authenticateRequest, sendError, HttpError } from "./_lib/ai/supabaseServer.js";
import { retrieveFromDataset, askDifyChat } from "./_lib/ai/dify/client.js";

// One turn of the "Cotizaciones IA" chat for a given client. The isolation
// boundary lives here, not inside Dify: the client's dataset_id is looked up
// through the caller's own RLS-scoped Supabase client, and only that one
// dataset is ever queried. The shared Dify Chat app has no Knowledge
// Retrieval node of its own, so there is nothing in Dify itself that could
// leak another client's documents into an answer.
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");

    const { userId, supabase } = await authenticateRequest(req);
    const { clientId, message, conversationId } = req.body || {};
    if (!clientId) throw new HttpError(400, "Missing required field: clientId");
    if (!message || typeof message !== "string" || !message.trim()) {
      throw new HttpError(400, "Missing required field: message");
    }

    const { data: setting, error } = await supabase
      .from("client_quotations_ai")
      .select("enabled, dify_dataset_id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (!setting?.enabled || !setting?.dify_dataset_id) {
      throw new HttpError(403, "Cotizaciones IA is not enabled for this client");
    }

    const records = await retrieveFromDataset({ datasetId: setting.dify_dataset_id, query: message.trim() });
    const context = records.length
      ? records.map((r, i) => `[${i + 1}] (${r.documentName})\n${r.content}`).join("\n\n")
      : "No se encontró información relevante en los documentos de este cliente.";

    const { answer, conversationId: nextConversationId } = await askDifyChat({
      context,
      query: message.trim(),
      conversationId: conversationId || null,
      user: `staff-${userId}`,
    });

    const citations = [...new Map(records.map(r => [r.documentName, r])).values()]
      .map(r => ({ document: r.documentName, score: r.score }));

    res.status(200).json({ answer, conversationId: nextConversationId, citations });
  } catch (err) {
    sendError(res, err);
  }
}
