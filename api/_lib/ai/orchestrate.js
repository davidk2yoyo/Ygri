import { callOpenAI, AI_CONFIG } from "./openai.js";
import { loadActivePrompt } from "./prompts.js";
import { loadRelevantSkills, renderSkillsBlock } from "./skills.js";
import { READ_TOOLS } from "./tools/readTools.js";
import { WRITE_TOOLS } from "./tools/writeTools.js";
import { buildActionPlan, planForClient } from "./actionPlan.js";
import { loadOrCreateConversation, loadHistory, appendMessage } from "./conversations.js";

// Hardcoded default until an organization-level timezone setting exists —
// this business operates out of Colombia (see Copilot Blueprint / audit
// evidence: interasia.com.co domain, the client portal's Colombian duty
// calculator). Relative dates ("tomorrow") resolve against this, never UTC.
const ORG_TIMEZONE = "America/Bogota";

const READ_BY_KEY = Object.fromEntries(READ_TOOLS.map((t) => [t.key, t]));
const ALL_TOOL_DEFS = [...READ_TOOLS.map((t) => ({ ...t, type: "read" })), ...WRITE_TOOLS.map((t) => ({ ...t, type: "write" }))];

async function getEnabledToolKeys(supabase) {
  const { data } = await supabase.from("ai_tools").select("key, enabled");
  if (!data?.length) return null; // no metadata yet — default to "all enabled" rather than breaking Copilot
  const disabled = new Set(data.filter((t) => !t.enabled).map((t) => t.key));
  return (key) => !disabled.has(key);
}

function toOpenAiTool(def) {
  return { type: "function", function: { name: def.key, description: def.description, parameters: def.parameters } };
}

function todayInOrgTimezone() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ORG_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function runOrchestratorTurn({ supabase, userId, pageContext, userMessage, conversationId }) {
  const started = Date.now();
  const conversation = await loadOrCreateConversation(supabase, userId, conversationId, pageContext, userMessage);
  const history = await loadHistory(supabase, conversation.id);
  await appendMessage(supabase, conversation.id, userId, "user", userMessage);

  const prompt = await loadActivePrompt(supabase);
  const isEnabled = await getEnabledToolKeys(supabase);
  const activeToolDefs = ALL_TOOL_DEFS.filter((t) => !isEnabled || isEnabled(t.key));
  const skills = await loadRelevantSkills(supabase, activeToolDefs.map((t) => t.key));

  const systemContent =
    prompt.system_prompt +
    renderSkillsBlock(skills) +
    `\n\n---\nCurrent date (organization timezone, ${ORG_TIMEZONE}): ${todayInOrgTimezone()}` +
    (pageContext?.page ? `\nCurrent page: ${pageContext.page}${pageContext.track_id ? ` (track_id: ${pageContext.track_id})` : ""}${pageContext.stage_id ? ` (stage_id: ${pageContext.stage_id})` : ""}${pageContext.quotation_id ? ` (quotation_id: ${pageContext.quotation_id})` : ""}` : "\nNo specific page is open right now.");

  const messages = [{ role: "system", content: systemContent }, ...history, { role: "user", content: userMessage }];
  const openAiTools = activeToolDefs.map(toOpenAiTool);

  const toolsCalled = [];
  const contextProvidersUsed = new Set();
  let tokensInput = 0;
  let tokensOutput = 0;
  let latencyMs = 0;
  let finalText = null;
  let writeCalls = null;
  let assistantMessageForPlan = null;

  for (let iteration = 0; iteration < AI_CONFIG.maxToolIterations; iteration++) {
    const { message, usage, latencyMs: iterLatency } = await callOpenAI({ messages, tools: openAiTools });
    tokensInput += usage.prompt_tokens || 0;
    tokensOutput += usage.completion_tokens || 0;
    latencyMs += iterLatency;

    const toolCalls = message.tool_calls || [];
    if (!toolCalls.length) {
      finalText = message.content || "";
      break;
    }

    const parsed = toolCalls.map((tc) => ({
      id: tc.id,
      tool: tc.function.name,
      arguments: safeParseArgs(tc.function.arguments),
    }));

    const pendingWrites = parsed.filter((c) => WRITE_TOOLS.some((w) => w.key === c.tool));
    if (pendingWrites.length) {
      // Architectural interception (§30): a WRITE tool call is NEVER
      // dispatched here. It only ever becomes a proposal.
      writeCalls = pendingWrites.map((c) => ({ tool: c.tool, arguments: c.arguments }));
      assistantMessageForPlan = message.content || null;
      toolsCalled.push(...pendingWrites.map((c) => ({ tool: c.tool, arguments: c.arguments, type: "write" })));
      break;
    }

    // All requested calls are READ — execute now and loop back so the
    // model can reason over the results (§75).
    messages.push(message);
    for (const call of parsed) {
      const def = READ_BY_KEY[call.tool];
      let resultPayload;
      if (!def) {
        resultPayload = { error: `Unknown tool: ${call.tool}` };
      } else {
        try {
          resultPayload = await def.handler(call.arguments, { supabase, userId, pageContext });
          contextProvidersUsed.add(call.tool);
        } catch (e) {
          resultPayload = { error: e.message };
        }
      }
      toolsCalled.push({ tool: call.tool, arguments: call.arguments, type: "read" });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(resultPayload).slice(0, 8000) });
    }
  }

  if (finalText === null && writeCalls === null) {
    finalText = "I gathered some information but couldn't finish reasoning about it in time — try asking a more specific question.";
  }

  let plan = null;
  if (writeCalls?.length) {
    const rawPlan = await buildActionPlan({ supabase, userId, pageContext, writeCalls, modelMessage: assistantMessageForPlan });
    plan = planForClient(rawPlan);
  }

  const assistantContent = plan ? plan.assistant_message : finalText;
  await appendMessage(supabase, conversation.id, userId, "assistant", assistantContent, plan?.plan_id || null);

  await supabase.from("ai_executions").insert({
    user_id: userId,
    plan_id: plan?.plan_id || null,
    model: AI_CONFIG.model,
    prompt_key: prompt.key,
    prompt_version: prompt.version,
    skills_used: skills.map((s) => s.key),
    context_providers_used: [...contextProvidersUsed],
    tools_called: toolsCalled,
    proposed_actions: plan?.actions || [],
    result: plan ? `Proposed ${plan.actions.length} action(s)` : finalText,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    latency_ms: Date.now() - started,
  });

  return { message: assistantContent, plan, conversation_id: conversation.id, conversation_title: conversation.title };
}

function safeParseArgs(raw) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
