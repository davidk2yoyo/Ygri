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

// Builds a project-scoped tool's editable project dropdown — every one of
// this client's own projects. `allowNone` adds an explicit "no project"
// option, only meaningful for tools where track_id is genuinely optional
// (create_task's internal-task case) — every other project-scoped tool
// requires a real project, so offering "none" there would just be another
// way to submit an invalid action.
async function resolveClientProjects(supabase, clientId, { allowNone = false } = {}) {
  const { data } = await supabase.from("tracks").select("id, name, status").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20);
  const options = (data || []).map((t) => ({ value: t.id, label: t.status === "active" ? t.name : `${t.name} (${t.status})` }));
  return allowNone ? [{ value: null, label: "No project (internal task)" }, ...options] : options;
}

// Resolves a project-scoped tool's track_id into full project context,
// defensively handling the single most common model mistake — reusing a
// client's own id (from search_clients) as if it were a project id — and
// builds the `editable.track_id` dropdown so the Action Card lets the user
// pick the right project (or fix a wrong one) directly, instead of a dead
// end. Shared by every write tool that targets a project: create_task,
// add_project_message, update_project, create_shipment, advance_stage.
//
// `existingClientId` is normalizedArgs.client_id carried forward from a
// prior validate() pass (see amendAction in actionPlan.js) — it keeps the
// dropdown scoped to the right client even after track_id is cleared, for
// tools where that's possible (currently only create_task).
async function resolveProjectField(supabase, trackId, { allowNone = false, existingClientId = null } = {}) {
  const errors = [];
  let ctx = null;
  let clientId = existingClientId || null;
  let clientName = null;

  if (trackId) {
    ctx = await buildProjectContext(supabase, trackId);
    if (!ctx) {
      const { data: clientMatch } = await supabase.from("clients").select("id, company_name").eq("id", trackId).maybeSingle();
      if (clientMatch) {
        clientId = clientMatch.id;
        clientName = clientMatch.company_name;
        errors.push(
          `"${trackId}" is the client "${clientMatch.company_name}", not a project — pick one of their projects below${allowNone ? ', or leave it as "No project"' : ""}.`
        );
      } else {
        errors.push("Project not found or not accessible.");
      }
    } else {
      clientId = ctx.project.client.id;
      clientName = ctx.project.client.name;
    }
  } else if (clientId) {
    const { data: client } = await supabase.from("clients").select("company_name").eq("id", clientId).maybeSingle();
    clientName = client?.company_name || null;
  } else if (!allowNone) {
    errors.push("A project is required.");
  }

  const editable = clientId
    ? { track_id: { type: "select", value: ctx ? trackId : null, options: await resolveClientProjects(supabase, clientId, { allowNone }) } }
    : null;

  return { ctx, clientId, clientName, errors, editable };
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
        due_date: { type: "string", description: "ISO date (YYYY-MM-DD), resolved from the user's relative date against the current date given in context. Omit entirely if the user didn't mention any date — never invent one; the user can set it directly on the confirmation card." },
        assignee_name: { type: "string", description: "Only if a specific person was clearly named; omit if ambiguous or unspecified" },
      },
      required: ["title"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const warnings = [];
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) errors.push("Task title is required.");

      // track_id is optional here (allowNone) — omitted means a genuine
      // internal task, not an omission to flag.
      const { ctx, clientId, clientName, errors: projectErrors, editable: editableTrackId } =
        await resolveProjectField(supabase, args.track_id, { allowNone: true, existingClientId: args.client_id });
      errors.push(...projectErrors);

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

      const proposedState = { title, assignee: assigneeName };
      if (clientName) proposedState.client = clientName;
      if (ctx) proposedState.project = ctx.project.name;

      // Always editable, regardless of validity — the whole point is that
      // the user can fix an unresolved/wrong project or a missing date
      // directly on the card instead of going back to the chat (§ user
      // feedback: the model silently picked a project and never asked
      // about a due date at all).
      const editable = { due_date: { type: "date", value: args.due_date || null }, ...editableTrackId };

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        target: { entity: "stage_todos", track_id: args.track_id || null, track_stage_id: trackStageId },
        current_state: null,
        proposed_state: proposedState,
        editable,
        normalizedArgs: clientId ? { ...args, client_id: clientId } : args,
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

      const { ctx, clientId, clientName, errors: projectErrors, editable } =
        await resolveProjectField(supabase, args.track_id, { existingClientId: args.client_id });
      errors.push(...projectErrors);

      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        target: { entity: "project_messages", track_id: args.track_id },
        current_state: null,
        proposed_state: { client: clientName, body, project: ctx?.project?.name },
        editable,
        normalizedArgs: clientId ? { ...args, client_id: clientId } : args,
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

  {
    key: "update_project",
    description: "Propose renaming a project or editing its internal remarks. Always a proposal — never executes directly. Does NOT change project status — cancelling/reactivating a project is a separate, deliberate action done from the Projects board, not exposed here.",
    parameters: {
      type: "object",
      properties: {
        track_id: { type: "string" },
        name: { type: "string", description: "New project name" },
        remarks: { type: "string", description: "Internal notes/remarks for the project — send an empty string to clear it" },
      },
      required: ["track_id"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const { ctx, clientId, clientName, errors: projectErrors, editable } =
        await resolveProjectField(supabase, args.track_id, { existingClientId: args.client_id });
      errors.push(...projectErrors);

      // Cancelled projects encode that via a coupled status + "[CANCELLED] "
      // name prefix (see ProjectsPage.jsx's cancelProject/reactivateProject) —
      // editing name/remarks here without touching that pairing could leave
      // the three places that detect "cancelled" disagreeing with each other.
      if (ctx && ctx.project.status === "cancelled") errors.push("This project is cancelled — reactivate it from the Projects board before editing it.");

      const patch = {};
      if (typeof args.name === "string" && args.name.trim()) patch.name = args.name.trim();
      if (args.remarks !== undefined) patch.remarks = (args.remarks || "").trim() || null;
      if (ctx && !Object.keys(patch).length) errors.push("No fields to update were provided.");

      const currentState = {};
      const proposedState = {};
      if (clientName) proposedState.client = clientName;
      for (const key of Object.keys(patch)) {
        currentState[key] = ctx?.project?.[key] ?? null;
        proposedState[key] = patch[key];
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        target: { entity: "tracks", track_id: args.track_id },
        current_state: currentState,
        proposed_state: proposedState,
        editable,
        normalizedArgs: clientId ? { ...args, client_id: clientId } : args,
        label: `Update project: ${ctx?.project?.name || "(unknown)"}`,
        resolvedArgs: { track_id: args.track_id, patch },
      };
    },
    async execute(resolvedArgs, { supabase }) {
      const { data, error } = await supabase.from("tracks").update(resolvedArgs.patch).eq("id", resolvedArgs.track_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { track_id: data.id, name: data.name };
    },
  },

  {
    key: "create_shipment",
    description: "Propose registering a new shipment for a project. Always a proposal — never executes directly. carrier and status are free text but should be one of the values shown to you; leave fields you don't know empty rather than guessing.",
    parameters: {
      type: "object",
      properties: {
        track_id: { type: "string" },
        tracking_number: { type: "string" },
        carrier: { type: "string", description: "e.g. DHL Express, FedEx, UPS, SF Express, Maersk, COSCO, Other — default 'DHL Express' if genuinely unknown" },
        description: { type: "string", description: "What's in this shipment" },
        status: { type: "string", enum: ["pending", "in_transit", "customs", "delivered", "exception"], description: "Default 'pending' for a new shipment unless told otherwise" },
        status_detail: { type: "string" },
        origin: { type: "string" },
        destination: { type: "string" },
        estimated_delivery: { type: "string", description: "ISO date (YYYY-MM-DD)" },
      },
      required: ["track_id", "tracking_number"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const { ctx, clientId, clientName, errors: projectErrors, editable } =
        await resolveProjectField(supabase, args.track_id, { existingClientId: args.client_id });
      errors.push(...projectErrors);

      const trackingNumber = typeof args.tracking_number === "string" ? args.tracking_number.trim() : "";
      if (!trackingNumber) errors.push("Tracking number is required.");

      if (args.estimated_delivery && !/^\d{4}-\d{2}-\d{2}$/.test(args.estimated_delivery)) {
        errors.push(`Invalid estimated delivery date "${args.estimated_delivery}" — expected YYYY-MM-DD.`);
      }

      // Same defaults BLANK_FORM uses in ProjectShipmentsSection.jsx, so an
      // AI-created shipment starts out identical to a manually-created one.
      const resolved = {
        track_id: args.track_id || null,
        tracking_number: trackingNumber,
        carrier: (args.carrier || "").trim() || "DHL Express",
        description: (args.description || "").trim(),
        status: args.status || "pending",
        status_detail: (args.status_detail || "").trim(),
        origin: (args.origin || "").trim(),
        destination: (args.destination || "").trim(),
        estimated_delivery: args.estimated_delivery || null,
      };

      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        target: { entity: "shipments", track_id: args.track_id },
        current_state: null,
        proposed_state: {
          client: clientName,
          project: ctx?.project?.name,
          tracking_number: resolved.tracking_number,
          carrier: resolved.carrier,
          status: resolved.status,
          origin: resolved.origin || null,
          destination: resolved.destination || null,
          estimated_delivery: resolved.estimated_delivery,
        },
        editable,
        normalizedArgs: clientId ? { ...args, client_id: clientId } : args,
        label: `Create shipment: ${trackingNumber || "(no tracking number)"}`,
        resolvedArgs: resolved,
      };
    },
    async execute(resolvedArgs, { supabase, userId }) {
      // Same raw insert ProjectShipmentsSection.jsx's "New Shipment" modal
      // does. Not replicated here: that modal also fires a best-effort,
      // errors-swallowed 17Track registration call — a background nicety,
      // not core to creating the shipment record itself.
      const { data, error } = await supabase.from("shipments").insert(resolvedArgs).select("id, tracking_number").single();
      if (error) throw new Error(error.message);

      await createProjectActivityServer(supabase, resolvedArgs.track_id, "ai_shipment_created", { tracking_number: data.tracking_number, carrier: resolvedArgs.carrier }, { userId });
      return { shipment_id: data.id, tracking_number: data.tracking_number };
    },
  },

  {
    key: "advance_stage",
    description: "Propose advancing a project's current in-progress stage to the next one in its pipeline — the same operation as the 'Complete Stage' button. If the current stage is the last one, this marks the whole project completed instead. Always a proposal — never executes directly.",
    parameters: {
      type: "object",
      properties: {
        track_id: { type: "string", description: "The project whose current stage should be advanced." },
      },
      required: ["track_id"],
    },
    async validate(args, { supabase }) {
      const errors = [];
      const { ctx, clientId, clientName, errors: projectErrors, editable } =
        await resolveProjectField(supabase, args.track_id, { existingClientId: args.client_id });
      errors.push(...projectErrors);

      const currentStage = ctx?.pipeline?.current_stage;
      const nextStage = ctx?.pipeline?.next_stage;
      const trackStageId = ctx?.pipeline?.current_track_stage_id;
      if (ctx && (!trackStageId || !currentStage)) errors.push("This project has no current in-progress stage to advance.");

      const proposedState = { client: clientName };
      if (ctx) {
        proposedState.project = ctx.project.name;
        proposedState.from_stage = currentStage?.name || null;
        proposedState.to_stage = nextStage ? nextStage.name : "Completed (this was the last stage)";
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
        target: { entity: "track_stages", track_id: args.track_id, track_stage_id: trackStageId || null },
        current_state: ctx ? { stage: currentStage?.name || null } : null,
        proposed_state: proposedState,
        editable,
        normalizedArgs: clientId ? { ...args, client_id: clientId } : args,
        label: ctx ? `Advance stage: ${currentStage?.name || "?"} → ${nextStage ? nextStage.name : "Completed"}` : "Advance stage",
        resolvedArgs: { track_stage_id: trackStageId || null, track_id: args.track_id, stage_name: currentStage?.name || null },
      };
    },
    async execute(resolvedArgs, { supabase, userId }) {
      // The exact same RPC StageDrawer.jsx's "Complete Stage" button calls
      // (handleCompleteStage) — no AI-specific stage-transition semantics.
      const { data, error } = await supabase.rpc("complete_stage_and_advance", { p_track_stage_id: resolvedArgs.track_stage_id });
      if (error) throw new Error(error.message);

      if (resolvedArgs.track_id && resolvedArgs.stage_name) {
        await createProjectActivityServer(supabase, resolvedArgs.track_id, "ai_stage_advanced", { stage: resolvedArgs.stage_name }, { trackStageId: resolvedArgs.track_stage_id, userId });
      }

      const row = Array.isArray(data) ? data[0] : data;
      return { track_status: row?.track_status || null };
    },
  },
];

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
