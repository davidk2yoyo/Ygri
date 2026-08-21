import { supabase } from "../supabaseClient";

// Centralized way to post a system event into a project's conversation feed.
// Every CRM action that should show up as an activity line (stage changes,
// quotation updates, todo completions, etc.) goes through this one function
// instead of inserting into project_messages directly from scattered places.
export async function createProjectActivity(trackId, eventType, metadata = {}, opts = {}) {
  if (!trackId || !eventType) return;
  try {
    await supabase.from("project_messages").insert({
      track_id: trackId,
      track_stage_id: opts.trackStageId || null,
      quotation_id: opts.quotationId || null,
      user_id: opts.userId || null,
      message_type: "system_event",
      metadata: { event: eventType, ...metadata },
    });
  } catch {
    // System events are best-effort — never block the underlying CRM action
  }
}
