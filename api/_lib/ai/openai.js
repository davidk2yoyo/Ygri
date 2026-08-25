// Centralized OpenAI access for the Copilot — one place to change model/
// provider config (per Copilot Blueprint §28), following the same plain
// fetch() pattern already used by api/ai-scan.js rather than adding an SDK
// dependency for a single endpoint.
export const AI_CONFIG = {
  provider: "openai",
  model: "gpt-4o-mini",
  maxToolIterations: 5, // hard cap on READ tool-call round-trips per turn — see api/_lib/ai/orchestrate.js
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function callOpenAI({ messages, tools }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("OpenAI API key not configured on server");
    err.status = 500;
    throw err;
  }

  const started = Date.now();
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
      temperature: 0.3,
    }),
  });

  const latencyMs = Date.now() - started;

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const err = new Error(errBody.error?.message || `OpenAI error ${response.status}`);
    err.status = response.status >= 400 && response.status < 500 ? 502 : 500;
    throw err;
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) {
    const err = new Error("OpenAI returned no message");
    err.status = 502;
    throw err;
  }

  return {
    message,
    usage: data.usage || {},
    latencyMs,
  };
}
