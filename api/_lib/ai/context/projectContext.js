import {
  computeStageFacts,
  computeTaskFacts,
  computeMilestoneFacts,
  computeQuotationFacts,
  computePaymentFacts,
  computeInspectionFacts,
  computeShipmentFacts,
  computeActivityFacts,
} from "./projectStatusEngine.js";

// Small, independently-reusable queries — shared between buildProjectContext
// (the automatic "core" context on every turn) and the READ tools that fetch
// more detail on demand. Same implementation, two call sites — not two
// parallel data-access systems (Copilot Blueprint §B).

export async function getStageList(supabase, trackId) {
  const { data: track } = await supabase.from("tracks").select("workflow_template_id").eq("id", trackId).maybeSingle();
  if (!track) return { stageTemplates: [], stages: [] };
  const [{ data: stageTemplates }, { data: stages }] = await Promise.all([
    supabase.from("stage_templates").select("id, name, order_index, sla_days, required").eq("workflow_template_id", track.workflow_template_id).order("order_index"),
    supabase.from("track_stages").select("id, stage_template_id, status, due_date, started_at, completed_at, assignee_user_id").eq("track_id", trackId),
  ]);
  return { stageTemplates: stageTemplates || [], stages: stages || [] };
}

export async function getRecentMessages(supabase, trackId, { limit = 8, before = null } = {}) {
  let query = supabase
    .from("project_messages")
    .select("id, message_type, body, metadata, user_id, created_at, profiles(full_name)")
    .eq("track_id", trackId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data } = await query;
  return (data || []).reverse();
}

export async function getTasks(supabase, trackId) {
  const { stages } = await getStageList(supabase, trackId);
  const stageIds = stages.map((s) => s.id);
  if (!stageIds.length) return [];
  const { data } = await supabase
    .from("stage_todos")
    .select("id, title, is_done, due_date, assignee_user_id, track_stage_id, profiles:assignee_user_id(full_name)")
    .in("track_stage_id", stageIds)
    .order("due_date", { ascending: true, nullsFirst: false });
  return data || [];
}

export async function getQuotations(supabase, trackId) {
  const { data } = await supabase
    .from("quotations")
    .select("id, quote_number, document_type, currency, total_amount, valid_until, purpose, created_at")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function getEmailThreadsForProject(supabase, trackId, clientId) {
  // project_id was added to email_threads after the fact and isn't reliably
  // backfilled on older threads — fall back to the project's client.
  const { data: byProject } = await supabase
    .from("email_threads")
    .select("id, subject, summary, sentiment, needs_response, priority, action_items, last_received_at, direction")
    .eq("project_id", trackId)
    .order("last_received_at", { ascending: false })
    .limit(10);
  if (byProject?.length) return byProject;
  if (!clientId) return [];
  const { data: byClient } = await supabase
    .from("email_threads")
    .select("id, subject, summary, sentiment, needs_response, priority, action_items, last_received_at, direction")
    .eq("client_id", clientId)
    .order("last_received_at", { ascending: false })
    .limit(10);
  return byClient || [];
}

export async function buildProjectContext(supabase, trackId) {
  const { data: track, error: trackErr } = await supabase
    .from("tracks")
    .select("id, name, remarks, status, client_id, owner_user_id, created_at, current_stage_template_id, workflow_template_id, clients(company_name), owner:owner_user_id(full_name)")
    .eq("id", trackId)
    .maybeSingle();
  if (trackErr || !track) return null;

  const [
    { stageTemplates, stages },
    todos,
    { data: milestones },
    quotations,
    { data: purchaseOrders },
    { data: inspectionReports },
    { data: shipments },
    messages,
    emailThreads,
    { data: clientRequest },
  ] = await Promise.all([
    getStageList(supabase, trackId),
    getTasks(supabase, trackId),
    supabase.from("project_milestones").select("id, type, label, date, reminder_days").eq("track_id", trackId),
    getQuotations(supabase, trackId),
    supabase.from("purchase_orders").select("id").eq("track_id", trackId),
    supabase.from("inspection_reports").select("id, report_number, status, created_at").eq("track_id", trackId),
    supabase.from("shipments").select("id, status, status_detail, estimated_delivery, tracking_number, created_at").eq("track_id", trackId),
    getRecentMessages(supabase, trackId, { limit: 8 }),
    getEmailThreadsForProject(supabase, trackId, track.client_id),
    supabase.from("client_requests").select("product_summary, quantity_summary, key_requirements, budget_terms, open_questions").eq("track_id", trackId).maybeSingle(),
  ]);

  const milestoneList = milestones || [];
  let dateHistoryCounts = {};
  if (milestoneList.length) {
    const { data: history } = await supabase
      .from("milestone_date_history")
      .select("milestone_id")
      .in("milestone_id", milestoneList.map((m) => m.id));
    dateHistoryCounts = (history || []).reduce((acc, h) => {
      acc[h.milestone_id] = (acc[h.milestone_id] || 0) + 1;
      return acc;
    }, {});
  }

  const stageFacts = computeStageFacts({ track, stages, stageTemplates });
  const taskFacts = computeTaskFacts(todos);
  const milestoneFacts = computeMilestoneFacts(milestoneList, dateHistoryCounts);
  const quotationFacts = computeQuotationFacts(quotations);
  const latestQuotationFull = quotations[0] || null;
  let payments = [];
  if (latestQuotationFull) {
    const { data } = await supabase.from("quotation_payments").select("amount").eq("quotation_id", latestQuotationFull.id);
    payments = data || [];
  }
  const paymentFacts = computePaymentFacts(latestQuotationFull, payments);
  const inspectionFacts = computeInspectionFacts(inspectionReports || []);
  const shipmentFacts = computeShipmentFacts(shipments || []);
  const activityFacts = computeActivityFacts(messages[messages.length - 1]?.created_at || null, emailThreads);

  return {
    project: {
      id: track.id,
      name: track.name,
      status: track.status,
      remarks: track.remarks,
      client: { id: track.client_id, name: track.clients?.company_name || null },
      owner: track.owner?.full_name || null,
      created_at: track.created_at,
    },
    pipeline: {
      ...stageFacts,
      stages: stages.map((s) => {
        const tmpl = stageTemplates.find((t) => t.id === s.stage_template_id);
        return { name: tmpl?.name, order_index: tmpl?.order_index, status: s.status, due_date: s.due_date };
      }),
    },
    tasks: taskFacts,
    milestones: milestoneFacts,
    quotation: { ...quotationFacts, ...paymentFacts },
    purchase_order_count: { value: (purchaseOrders || []).length, reliability: "medium" }, // purchase_orders.track_id has no FK constraint in this schema
    inspection: inspectionFacts,
    shipment: shipmentFacts,
    activity: activityFacts,
    request: clientRequest || null,
    recent_conversation: messages.map((m) => ({
      type: m.message_type,
      body: m.body,
      metadata: m.metadata,
      author: m.profiles?.full_name || null,
      created_at: m.created_at,
    })),
    email_threads: emailThreads.map((t) => ({
      subject: t.subject,
      summary: t.summary,
      sentiment: t.sentiment,
      needs_response: t.needs_response,
      priority: t.priority,
      action_items: t.action_items,
      last_received_at: t.last_received_at,
      direction: t.direction,
    })),
  };
}
