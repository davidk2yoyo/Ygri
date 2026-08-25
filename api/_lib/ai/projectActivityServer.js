// Server-side twin of src/lib/projectActivity.js — same behavior, but takes
// a request-scoped Supabase client instead of importing the browser client
// (which reads import.meta.env, unavailable in a Vercel serverless function).
export async function createProjectActivityServer(supabase, trackId, eventType, metadata = {}, opts = {}) {
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
    // Best-effort — never block the underlying write on this.
  }
}
