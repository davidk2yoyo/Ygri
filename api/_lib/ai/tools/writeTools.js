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

// Unlike assignee (nullable), a project's owner_user_id is NOT NULL in the
// schema — so this always resolves to *someone*, defaulting to whoever is
// having the conversation rather than leaving a gap create_track_rpc can't accept.
async function resolveOwner(supabase, ownerName, requestingUserId) {
  const requester = async () => {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", requestingUserId).maybeSingle();
    return data?.full_name || "you";
  };
  if (!ownerName?.trim()) return { id: requestingUserId, name: await requester(), warning: null };
  const { data } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${ownerName.trim()}%`);
  if (data?.length === 1) return { id: data[0].id, name: data[0].full_name, warning: null };
  if (!data?.length) return { id: requestingUserId, name: await requester(), warning: `No team member matching "${ownerName}" — defaulted owner to you.` };
  return { id: requestingUserId, name: await requester(), warning: `"${ownerName}" matches more than one team member — defaulted owner to you. Please reassign manually if needed.` };
}

// Only include fields the caller actually provided — used by update_client/
// update_supplier so an unset field never overwrites an existing value.
function patchFrom(args, fields) {
  const patch = {};
  for (const f of fields) {
    if (args[f] !== undefined && args[f] !== null) patch[f] = typeof args[f] === "string" ? args[f].trim() : args[f];
  }
  return patch;
}

// Duplicates aren't blocked — flagged as a warning so the model/user can
// still decide it's genuinely a different entity (Client/Supplier
// Management skills: "search for duplicates", not "refuse to create").
async function findLikelyDuplicates(supabase, table, nameColumn, name) {
  if (!name) return [];
  const { data } = await supabase.from(table).select(`id, ${nameColumn}`).ilike(nameColumn, `%${name}%`).limit(5);
  return data || [];
}

export const WRITE_TOOLS = [
  {
    key: "create_task",
    description: "Propose creating a task — on a project's current stage if track_id is given, or as a standalone internal task if omitted. Always a proposal — never executes directly.",
    parameters: {
      type: "object",
      properties: {
        track_id: { type: "string", description: "The project this task belongs to. Omit for a genuine internal/team task not tied to any project." },
        title: { type: "string" },
        due_date: { type: "string", description: "ISO date (YYYY-MM-DD), resolved from the user's relative date against the current date given in context" },
        assignee_name: { type: "string", description: "Only if a specific person was clearly named; omit if ambiguous or unspecified" },
      },
      required: ["title"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const warnings = [];
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) errors.push("Task title is required.");

      // track_id is optional — omitted means a genuine internal task, not
      // an omission to flag. Only resolve project context when one was given.
      let ctx = null;
      let trackStageId = null;
      if (args.track_id) {
        ctx = await buildProjectContext(supabase, args.track_id);
        if (!ctx) {
          // Common model mistake: reusing a client's id (from search_clients)
          // as if it were a project id. Diagnose it precisely instead of a
          // dead-end "not found" — this also lands in conversation history,
          // so the model can self-correct on its next turn.
          const { data: clientMatch } = await supabase.from("clients").select("company_name").eq("id", args.track_id).maybeSingle();
          errors.push(
            clientMatch
              ? `"${args.track_id}" is the client "${clientMatch.company_name}", not a project — call get_client with this id to see their actual projects, then use one of those ids as track_id.`
              : "Project not found or not accessible."
          );
        }
        trackStageId = ctx?.pipeline?.current_track_stage_id || null;
        if (ctx && !trackStageId) errors.push("This project has no current stage to attach the task to.");
      }

      if (args.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(args.due_date)) errors.push(`Invalid due date "${args.due_date}" — expected YYYY-MM-DD.`);

      let assigneeId = null;
      let assigneeName = null;
      if (args.assignee_name) {
        const resolved = await resolveAssignee(supabase, args.assignee_name);
        assigneeId = resolved.id;
        assigneeName = resolved.name;
        if (resolved.warning) warnings.push(resolved.warning);
      }

      const proposedState = { title, due_date: args.due_date || null, assignee: assigneeName };
      if (ctx) proposedState.project = ctx.project.name;

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        target: { entity: "stage_todos", track_id: args.track_id || null, track_stage_id: trackStageId },
        current_state: null,
        proposed_state: proposedState,
        label: `Create task: ${title || "(untitled)"}`,
        resolvedArgs: { track_id: args.track_id || null, track_stage_id: trackStageId, title, due_date: args.due_date || null, assignee_id: assigneeId, project_name: ctx?.project?.name || null },
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
    key: "create_project",
    description: "Propose creating a new project for a client. Always a proposal — never executes directly. Resolve client_id via search_clients/get_client first — never invent one.",
    parameters: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "The client this project is for — resolve via search_clients first" },
        name: { type: "string", description: "Project name" },
        remarks: { type: "string", description: "Optional notes about the project" },
        workflow: { type: "string", enum: ["Service", "Product"], description: "'Service' (7-day default SLA per stage, 4 stages) or 'Product' (30-day default SLA, 8 stages) — infer from context; ask the user if genuinely unclear" },
        owner_name: { type: "string", description: "Only if a specific team member was clearly named as owner; omit to default to the requesting user" },
      },
      required: ["client_id", "name", "workflow"],
    },
    async validate(args, { supabase, userId }) {
      const errors = [];
      const warnings = [];
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!name) errors.push("Project name is required.");
      if (!["Service", "Product"].includes(args.workflow)) errors.push(`Workflow must be "Service" or "Product", got "${args.workflow}".`);

      let clientName = null;
      if (!args.client_id) {
        errors.push("client_id is required — search for the client first.");
      } else {
        const { data: client } = await supabase.from("clients").select("company_name").eq("id", args.client_id).maybeSingle();
        if (!client) errors.push("Client not found or not accessible.");
        else clientName = client.company_name;
      }

      const owner = await resolveOwner(supabase, args.owner_name, userId);
      if (owner.warning) warnings.push(owner.warning);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        target: { entity: "tracks", client_id: args.client_id },
        current_state: null,
        proposed_state: { name, client: clientName, workflow: args.workflow, owner: owner.name, remarks: args.remarks || null },
        label: `Create project: ${name || "(untitled)"}`,
        resolvedArgs: { client_id: args.client_id, name, remarks: args.remarks || null, workflow: args.workflow, owner_id: owner.id },
      };
    },
    async execute(resolvedArgs, { supabase, userId }) {
      // The exact same RPC the "New Project" UI calls — no AI-specific
      // project semantics, matching create_task's precedent (Copilot §38/§59).
      const { data: trackId, error } = await supabase.rpc("create_track_rpc", {
        p_client_id: resolvedArgs.client_id,
        p_name: resolvedArgs.name,
        p_remarks: resolvedArgs.remarks,
        p_workflow: resolvedArgs.workflow,
        p_owner_id: resolvedArgs.owner_id,
      });
      if (error) throw new Error(error.message);

      if (trackId) {
        await createProjectActivityServer(supabase, trackId, "ai_project_created", { name: resolvedArgs.name, workflow: resolvedArgs.workflow }, { userId });
      }
      return { track_id: trackId, name: resolvedArgs.name };
    },
  },

  {
    key: "create_client",
    description: "Propose creating a new client. Always a proposal — never executes directly. Search for likely duplicates with search_clients first.",
    parameters: {
      type: "object",
      properties: {
        company_name: { type: "string" },
        contact_person: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        website: { type: "string" },
        address: { type: "string" },
        country: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        remark: { type: "string" },
      },
      required: ["company_name"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const warnings = [];
      const companyName = typeof args.company_name === "string" ? args.company_name.trim() : "";
      if (!companyName) errors.push("Company name is required.");

      const duplicates = await findLikelyDuplicates(supabase, "clients", "company_name", companyName);
      if (duplicates.length) warnings.push(`Possible existing match: ${duplicates.map((d) => d.company_name).join(", ")}. Confirm this is genuinely a new client.`);

      const patch = patchFrom(args, ["contact_person", "email", "phone", "website", "address", "country", "city", "state", "remark"]);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        target: { entity: "clients" },
        current_state: null,
        proposed_state: { company_name: companyName, ...patch },
        label: `Create client: ${companyName || "(untitled)"}`,
        resolvedArgs: { company_name: companyName, ...patch },
      };
    },
    async execute(resolvedArgs, { supabase }) {
      // Same raw insert ClientsPage.jsx's "New Client" modal does — this
      // table has no dedicated RPC to defer to.
      const { data, error } = await supabase.from("clients").insert(resolvedArgs).select("id, company_name").single();
      if (error) throw new Error(error.message);
      return { client_id: data.id, company_name: data.company_name };
    },
  },

  {
    key: "update_client",
    description: "Propose updating an existing client's fields. Always a proposal — never executes directly. Only include fields that should change.",
    parameters: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        company_name: { type: "string" },
        contact_person: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        website: { type: "string" },
        address: { type: "string" },
        country: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        remark: { type: "string" },
      },
      required: ["client_id"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const { data: client } = await supabase.from("clients").select("*").eq("id", args.client_id).maybeSingle();
      if (!client) errors.push("Client not found or not accessible.");

      const patch = patchFrom(args, ["company_name", "contact_person", "email", "phone", "website", "address", "country", "city", "state", "remark"]);
      if (!Object.keys(patch).length) errors.push("No fields to update were provided.");

      const currentState = {};
      const proposedState = {};
      for (const key of Object.keys(patch)) {
        currentState[key] = client?.[key] ?? null;
        proposedState[key] = patch[key];
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        target: { entity: "clients", client_id: args.client_id },
        current_state: currentState,
        proposed_state: proposedState,
        label: `Update client: ${client?.company_name || "(unknown)"}`,
        resolvedArgs: { client_id: args.client_id, patch },
      };
    },
    async execute(resolvedArgs, { supabase }) {
      const { data, error } = await supabase.from("clients").update(resolvedArgs.patch).eq("id", resolvedArgs.client_id).select("id, company_name").single();
      if (error) throw new Error(error.message);
      return { client_id: data.id, company_name: data.company_name };
    },
  },

  {
    key: "create_supplier",
    description: "Propose creating a new supplier. Always a proposal — never executes directly. Search for likely duplicates with search_suppliers first.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        sales_person: { type: "string" },
        email: { type: "string" },
        wechat_or_whatsapp: { type: "string" },
        website: { type: "string" },
        address: { type: "string" },
        country: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
      },
      required: ["name"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const warnings = [];
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!name) errors.push("Supplier name is required.");

      const duplicates = await findLikelyDuplicates(supabase, "suppliers", "name", name);
      if (duplicates.length) warnings.push(`Possible existing match: ${duplicates.map((d) => d.name).join(", ")}. Confirm this is genuinely a new supplier.`);

      const patch = patchFrom(args, ["sales_person", "email", "wechat_or_whatsapp", "website", "address", "country", "city", "state"]);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        target: { entity: "suppliers" },
        current_state: null,
        proposed_state: { name, ...patch },
        label: `Create supplier: ${name || "(untitled)"}`,
        resolvedArgs: { name, ...patch },
      };
    },
    async execute(resolvedArgs, { supabase }) {
      // Same raw insert SuppliersPage.jsx's "New Supplier" modal does.
      const { data, error } = await supabase.from("suppliers").insert(resolvedArgs).select("id, name").single();
      if (error) throw new Error(error.message);
      return { supplier_id: data.id, name: data.name };
    },
  },

  {
    key: "update_supplier",
    description: "Propose updating an existing supplier's fields. Always a proposal — never executes directly. Only include fields that should change.",
    parameters: {
      type: "object",
      properties: {
        supplier_id: { type: "string" },
        name: { type: "string" },
        sales_person: { type: "string" },
        email: { type: "string" },
        wechat_or_whatsapp: { type: "string" },
        website: { type: "string" },
        address: { type: "string" },
        country: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
      },
      required: ["supplier_id"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const { data: supplier } = await supabase.from("suppliers").select("*").eq("id", args.supplier_id).maybeSingle();
      if (!supplier) errors.push("Supplier not found or not accessible.");

      const patch = patchFrom(args, ["name", "sales_person", "email", "wechat_or_whatsapp", "website", "address", "country", "city", "state"]);
      if (!Object.keys(patch).length) errors.push("No fields to update were provided.");

      const currentState = {};
      const proposedState = {};
      for (const key of Object.keys(patch)) {
        currentState[key] = supplier?.[key] ?? null;
        proposedState[key] = patch[key];
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        target: { entity: "suppliers", supplier_id: args.supplier_id },
        current_state: currentState,
        proposed_state: proposedState,
        label: `Update supplier: ${supplier?.name || "(unknown)"}`,
        resolvedArgs: { supplier_id: args.supplier_id, patch },
      };
    },
    async execute(resolvedArgs, { supabase }) {
      const { data, error } = await supabase.from("suppliers").update(resolvedArgs.patch).eq("id", resolvedArgs.supplier_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { supplier_id: data.id, name: data.name };
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
