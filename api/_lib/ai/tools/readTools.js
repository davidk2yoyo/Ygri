import { buildProjectContext, getStageList, getTasks, getQuotations, getRecentMessages } from "../context/projectContext.js";
import { buildClientContext } from "../context/clientContext.js";
import { buildSupplierContext, searchSuppliersByText } from "../context/supplierContext.js";
import { getEmailThreads } from "../context/emailContext.js";

// Every READ tool: { key, description, parameters (JSON Schema), handler(args, ctx) }.
// ctx = { supabase (user-scoped client), userId, pageContext }. Handlers only
// ever read — see writeTools.js for the intercepted, proposal-only writes.

export const READ_TOOLS = [
  {
    key: "search_clients",
    description: "Search clients by company name.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Partial company name" } }, required: ["query"] },
    handler: async ({ query }, { supabase }) => {
      const { data } = await supabase.from("clients").select("id, company_name, country, city, contact_person").ilike("company_name", `%${query}%`).limit(10);
      return data || [];
    },
  },
  {
    key: "get_client",
    description: "Load a client's identity, active/recent projects, quotations, and recent email activity.",
    parameters: { type: "object", properties: { client_id: { type: "string" } }, required: ["client_id"] },
    handler: async ({ client_id }, { supabase }) => (await buildClientContext(supabase, client_id)) || { error: "Client not found" },
  },
  {
    key: "search_projects",
    description: "Search projects/tracks by name or client name.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    handler: async ({ query }, { supabase }) => {
      const { data } = await supabase.from("tracks").select("id, name, status, clients(company_name)").ilike("name", `%${query}%`).limit(10);
      return (data || []).map((t) => ({ id: t.id, name: t.name, status: t.status, client: t.clients?.company_name }));
    },
  },
  {
    key: "get_project",
    description: "Load full context for one project: identity, pipeline, tasks, milestones, quotation, inspection, shipment, recent conversation, and email status. Prefer this over several smaller tools when the user asks a general question about a project.",
    parameters: { type: "object", properties: { track_id: { type: "string" } }, required: ["track_id"] },
    handler: async ({ track_id }, { supabase }) => (await buildProjectContext(supabase, track_id)) || { error: "Project not found" },
  },
  {
    key: "get_project_status",
    description: "The deterministic Project Status Engine facts only (stage, days in stage, SLA, task counts, milestone/quotation/inspection/shipment summary) without conversation or email detail — cheaper than get_project when you already have those.",
    parameters: { type: "object", properties: { track_id: { type: "string" } }, required: ["track_id"] },
    handler: async ({ track_id }, { supabase }) => {
      const ctx = await buildProjectContext(supabase, track_id);
      if (!ctx) return { error: "Project not found" };
      const { recent_conversation, email_threads, ...status } = ctx;
      return status;
    },
  },
  {
    key: "get_project_activity",
    description: "Recent or older project conversation (comments, system events). Use `before` (an ISO timestamp) to page further back than what's already in context.",
    parameters: {
      type: "object",
      properties: { track_id: { type: "string" }, limit: { type: "number", description: "default 8, max 30" }, before: { type: "string", description: "ISO timestamp — only messages older than this" } },
      required: ["track_id"],
    },
    handler: async ({ track_id, limit, before }, { supabase }) => getRecentMessages(supabase, track_id, { limit: Math.min(limit || 8, 30), before }),
  },
  {
    key: "search_suppliers",
    description: "Search suppliers by name, or by a product/keyword they've supplied (e.g. 'safety glasses').",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    handler: async ({ query }, { supabase }) => searchSuppliersByText(supabase, query),
  },
  {
    key: "get_supplier",
    description: "Load a supplier's identity, products, price tiers, recent quotation items, purchase orders, and email activity.",
    parameters: { type: "object", properties: { supplier_id: { type: "string" } }, required: ["supplier_id"] },
    handler: async ({ supplier_id }, { supabase }) => (await buildSupplierContext(supabase, supplier_id)) || { error: "Supplier not found" },
  },
  {
    key: "get_tasks",
    description: "List tasks for a project, or all open tasks across projects if no track_id is given.",
    parameters: { type: "object", properties: { track_id: { type: "string" } } },
    handler: async ({ track_id }, { supabase }) => {
      if (track_id) return getTasks(supabase, track_id);
      const { data } = await supabase
        .from("stage_todos")
        .select("id, title, is_done, due_date, track_stage_id, track_stages(track_id, tracks(name))")
        .eq("is_done", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(30);
      return (data || []).map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, project: t.track_stages?.tracks?.name }));
    },
  },
  {
    key: "get_overdue_tasks",
    description: "List open tasks whose due date has passed, optionally scoped to one project.",
    parameters: { type: "object", properties: { track_id: { type: "string" } } },
    handler: async ({ track_id }, { supabase }) => {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from("stage_todos")
        .select("id, title, due_date, track_stage_id, track_stages(track_id, tracks(name))")
        .eq("is_done", false)
        .lt("due_date", today)
        .not("due_date", "is", null);
      const { data } = await query;
      const rows = (data || []).map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, project_id: t.track_stages?.track_id, project: t.track_stages?.tracks?.name }));
      return track_id ? rows.filter((r) => r.project_id === track_id) : rows;
    },
  },
  {
    key: "get_quotation",
    description: "Load a project's latest quotation (or all of them) with items.",
    parameters: { type: "object", properties: { track_id: { type: "string" }, quotation_id: { type: "string" } } },
    handler: async ({ track_id, quotation_id }, { supabase }) => {
      let id = quotation_id;
      if (!id && track_id) {
        const list = await getQuotations(supabase, track_id);
        id = list[0]?.id;
      }
      if (!id) return { error: "No quotation found" };
      const { data: quotation } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
      const { data: items } = await supabase.from("quotation_items").select("item_number, description, price, quantity, supplier_id, suppliers(name)").eq("quotation_id", id);
      return { quotation, items: items || [] };
    },
  },
  {
    key: "get_pipeline",
    description: "List a project's pipeline stages with status and due dates.",
    parameters: { type: "object", properties: { track_id: { type: "string" } }, required: ["track_id"] },
    handler: async ({ track_id }, { supabase }) => {
      const { stageTemplates, stages } = await getStageList(supabase, track_id);
      return stageTemplates.map((t) => {
        const s = stages.find((s) => s.stage_template_id === t.id);
        return { name: t.name, order_index: t.order_index, status: s?.status || "not_started", due_date: s?.due_date || null };
      });
    },
  },
  {
    key: "get_current_stage",
    description: "The single current stage of a project.",
    parameters: { type: "object", properties: { track_id: { type: "string" } }, required: ["track_id"] },
    handler: async ({ track_id }, { supabase }) => {
      const ctx = await buildProjectContext(supabase, track_id);
      return ctx?.pipeline?.current_stage || { error: "Project not found" };
    },
  },
  {
    key: "get_email_threads",
    description: "Structured email thread summaries for a project, client, or supplier. Use this before asking for raw email bodies.",
    parameters: { type: "object", properties: { track_id: { type: "string" }, client_id: { type: "string" }, supplier_id: { type: "string" } } },
    handler: async ({ track_id, client_id, supplier_id }, { supabase }) => getEmailThreads(supabase, { trackId: track_id, clientId: client_id, supplierId: supplier_id }),
  },
  {
    key: "get_shipments",
    description: "Shipment status/tracking for a project.",
    parameters: { type: "object", properties: { track_id: { type: "string" } }, required: ["track_id"] },
    handler: async ({ track_id }, { supabase }) => {
      const { data } = await supabase.from("shipments").select("tracking_number, carrier, status, status_detail, estimated_delivery, origin, destination").eq("track_id", track_id).order("created_at", { ascending: false });
      return data || [];
    },
  },
  {
    key: "get_inspection_reports",
    description: "Inspection report status/history for a project. Never treat pipeline stage as inspection status — use this tool instead.",
    parameters: { type: "object", properties: { track_id: { type: "string" } }, required: ["track_id"] },
    handler: async ({ track_id }, { supabase }) => {
      const { data } = await supabase.from("inspection_reports").select("report_number, status, visit_date, created_at").eq("track_id", track_id).order("created_at", { ascending: false });
      return data || [];
    },
  },
];
