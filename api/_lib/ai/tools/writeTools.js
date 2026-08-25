import { buildProjectContext } from "../context/projectContext.js";
import { createProjectActivityServer } from "../projectActivityServer.js";

// WRITE tools are never dispatched directly by the orchestrator — see
// api/_lib/ai/actionPlan.js. Each tool exposes:
//   parameters — JSON Schema the model sees
//   validate(args, ctx)  — run at proposal time AND again at confirmation
//                           time ("revalidation"). Never trusts the model's
//                           claims about current DB state; always re-queries.
//   execute(resolvedArgs, ctx) — runs ONLY after user confirmation + a
//                           passing revalidation, via the canonical
//                           operation the manual UI already uses.
// Adding a new WRITE tool = adding one entry here, per docs/ai-copilot.md.

async function resolveAssignee(supabase, assigneeName) {
  if (!assigneeName?.trim()) return { id: null, name: null, warning: null };
  const { data } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${assigneeName.trim()}%`);
  if (data?.length === 1) return { id: data[0].id, name: data[0].full_name, warning: null };
  if (!data?.length) return { id: null, name: null, warning: `No team member matching "${assigneeName}" — left unassigned.` };
  return { id: null, name: null, warning: `"${assigneeName}" matches more than one team member — left unassigned. Please assign manually.` };
}

export const WRITE_TOOLS = [
  {
    key: "create_task",
    description: "Propose creating a task on a project's current (or a specified) stage. Always a proposal — never executes directly.",
    parameters: {
      type: "object",
      properties: {
        track_id: { type: "string", description: "The project this task belongs to" },
        title: { type: "string" },
        due_date: { type: "string", description: "ISO date (YYYY-MM-DD), resolved from the user's relative date against the current date given in context" },
        assignee_name: { type: "string", description: "Only if a specific person was clearly named; omit if ambiguous or unspecified" },
      },
      required: ["track_id", "title"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const warnings = [];
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) errors.push("Task title is required.");

      const ctx = await buildProjectContext(supabase, args.track_id);
      if (!ctx) errors.push("Project not found or not accessible.");

      const trackStageId = ctx?.pipeline?.current_track_stage_id || null;
      if (ctx && !trackStageId) errors.push("This project has no current stage to attach the task to.");

      if (args.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(args.due_date)) errors.push(`Invalid due date "${args.due_date}" — expected YYYY-MM-DD.`);

      let assigneeId = null;
      let assigneeName = null;
      if (args.assignee_name) {
        const resolved = await resolveAssignee(supabase, args.assignee_name);
        assigneeId = resolved.id;
        assigneeName = resolved.name;
        if (resolved.warning) warnings.push(resolved.warning);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        target: { entity: "stage_todos", track_id: args.track_id, track_stage_id: trackStageId },
        current_state: null,
        proposed_state: { title, due_date: args.due_date || null, assignee: assigneeName, project: ctx?.project?.name },
        label: `Create task: ${title || "(untitled)"}`,
        resolvedArgs: { track_id: args.track_id, track_stage_id: trackStageId, title, due_date: args.due_date || null, assignee_id: assigneeId, project_name: ctx?.project?.name },
      };
    },
    async execute(resolvedArgs, { supabase, userId }) {
      // The exact same RPC StageDrawer.jsx and TasksPage.jsx call for a
      // manually-created task — no AI-specific task semantics (Copilot §38).
      const { error } = await supabase.rpc("add_stage_todo", {
        p_track_stage_id: resolvedArgs.track_stage_id,
        p_title: resolvedArgs.title,
        p_due: resolvedArgs.due_date,
        p_assignee: resolvedArgs.assignee_id,
        p_user: userId,
      });
      if (error) throw new Error(error.message);

      // stage_todos isn't itself visible in a project's conversation feed,
      // so unlike add_project_message this DOES get a system_event — the
      // only trace this task's creation leaves in the operational timeline.
      const trackId = resolvedArgs.track_id || null;
      if (trackId) {
        await createProjectActivityServer(supabase, trackId, "ai_task_created", { title: resolvedArgs.title, due_date: resolvedArgs.due_date }, { trackStageId: resolvedArgs.track_stage_id, userId });
      }
      return { title: resolvedArgs.title, due_date: resolvedArgs.due_date };
    },
  },

  {
    key: "add_project_message",
    description: "Propose adding a comment to a project's conversation. Always a proposal — never executes directly.",
    parameters: {
      type: "object",
      properties: {
        track_id: { type: "string" },
        body: { type: "string", description: "Plain text comment body" },
      },
      required: ["track_id", "body"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const body = typeof args.body === "string" ? args.body.trim() : "";
      if (!body) errors.push("Comment body cannot be empty.");
      const ctx = await buildProjectContext(supabase, args.track_id);
      if (!ctx) errors.push("Project not found or not accessible.");

      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        target: { entity: "project_messages", track_id: args.track_id },
        current_state: null,
        proposed_state: { body, project: ctx?.project?.name },
        label: "Add project comment",
        resolvedArgs: { track_id: args.track_id, body, project_name: ctx?.project?.name },
      };
    },
    async execute(resolvedArgs, { supabase, userId, executionId }) {
      // Behaves like a normal human comment (§39) — same insert shape
      // ConversationTab.jsx uses, attributed to the approving user. The
      // comment itself IS the operational-history record here, so unlike
      // create_task there's no separate system_event — one would just be
      // a duplicate line directly under the comment it describes.
      const { data, error } = await supabase
        .from("project_messages")
        .insert({
          track_id: resolvedArgs.track_id,
          user_id: userId,
          message_type: "message",
          body: `<p>${escapeHtml(resolvedArgs.body)}</p>`,
          metadata: { source: "ai", execution_id: executionId, approved_by: userId },
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { message_id: data.id };
    },
  },
];

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
