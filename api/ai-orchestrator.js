import { authenticateRequest, sendError, HttpError } from "./_lib/ai/supabaseServer.js";
import { runOrchestratorTurn } from "./_lib/ai/orchestrate.js";

// One Copilot chat turn. Authenticates the caller, runs the READ tool loop,
// and either returns a final text answer or a proposed Action Plan — it
// never writes to the CRM itself (see api/ai-action-execute.js).
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  try {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");

    const { userId, supabase } = await authenticateRequest(req);

    const { message, pageContext, history } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      throw new HttpError(400, "Missing required field: message");
    }
    if (history && (!Array.isArray(history) || history.length > 20)) {
      throw new HttpError(400, "history must be an array of at most 20 messages");
    }

    const result = await runOrchestratorTurn({
      supabase,
      userId,
      pageContext: pageContext || {},
      userMessage: message.trim(),
      history: (history || []).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })),
    });

    res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
}
