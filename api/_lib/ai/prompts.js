// Hardcoded fallback — used only if the DB read fails, so a prompt-table
// outage never takes the whole Copilot down (Copilot Blueprint §22).
const FALLBACK_PROMPT = {
  key: "ygri_copilot",
  version: 0,
  system_prompt:
    "You are Ygri Copilot, an operational assistant embedded in Ygri CRM. Use CRM data as the source of truth, distinguish confirmed facts from inference, and never claim a write action succeeded unless execution actually confirmed it. WRITE tools are proposals only.",
};

export async function loadActivePrompt(supabase, key = "ygri_copilot") {
  try {
    const { data, error } = await supabase
      .from("ai_prompts")
      .select("key, system_prompt, version")
      .eq("key", key)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return FALLBACK_PROMPT;
    return data;
  } catch {
    return FALLBACK_PROMPT;
  }
}
