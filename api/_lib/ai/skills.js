// A Skill is an editable instruction fragment, not a separate agent or a
// separate model call (Copilot Blueprint §E). Select the ones relevant to
// whichever tools are being offered this turn and inject their text
// alongside the base system prompt.
export async function loadRelevantSkills(supabase, toolKeys) {
  try {
    const { data, error } = await supabase
      .from("ai_skills")
      .select("key, name, instructions, applies_to_tools, version")
      .eq("is_active", true);
    if (error || !data) return [];
    return data.filter(
      (s) => !s.applies_to_tools?.length || s.applies_to_tools.some((t) => toolKeys.includes(t))
    );
  } catch {
    return [];
  }
}

export function renderSkillsBlock(skills) {
  if (!skills.length) return "";
  return (
    "\n\n---\nOperational guidance for the domains relevant to this conversation:\n\n" +
    skills.map((s) => `## ${s.name}\n${s.instructions}`).join("\n\n")
  );
}
