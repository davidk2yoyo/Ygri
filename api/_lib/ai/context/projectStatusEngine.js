// Deterministic facts about a project, computed from already-fetched rows —
// never from the LLM. Every fact carries a `reliability` tag: "high" facts
// come straight from a column with no interpretation; "medium" facts depend
// on data the app doesn't consistently populate yet (see Copilot Blueprint §C).
// Pure functions only — no DB access here, so these are easy to unit test.

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeStageFacts({ track, stages, stageTemplates }) {
  const currentTemplate = stageTemplates.find((t) => t.id === track.current_stage_template_id) || null;
  const currentTrackStage = stages.find((s) => s.stage_template_id === track.current_stage_template_id) || null;

  const sortedTemplates = [...stageTemplates].sort((a, b) => a.order_index - b.order_index);
  const currentIdx = currentTemplate ? sortedTemplates.findIndex((t) => t.id === currentTemplate.id) : -1;
  const nextTemplate = currentIdx >= 0 ? sortedTemplates[currentIdx + 1] || null : null;

  let daysInStage = null;
  let daysInStageReliability = "unavailable";
  if (currentTrackStage?.started_at) {
    daysInStage = Math.floor((Date.now() - new Date(currentTrackStage.started_at).getTime()) / DAY_MS);
    daysInStageReliability = "medium"; // relies on the transition RPC consistently setting started_at
  }

  const slaDays = currentTemplate?.sla_days ?? null;
  let slaStatus = "unknown";
  if (daysInStage != null && slaDays != null) {
    slaStatus = daysInStage > slaDays ? "overdue" : daysInStage >= slaDays - 1 ? "at_risk" : "on_time";
  }

  return {
    current_stage: currentTemplate ? { name: currentTemplate.name, order_index: currentTemplate.order_index, template_id: currentTemplate.id } : null,
    next_stage: nextTemplate ? { name: nextTemplate.name, order_index: nextTemplate.order_index, template_id: nextTemplate.id } : null,
    days_in_stage: { value: daysInStage, reliability: daysInStageReliability },
    stage_sla_days: { value: slaDays, reliability: slaDays != null ? "high" : "unavailable" },
    stage_sla_status: { value: slaStatus, reliability: slaStatus === "unknown" ? "unavailable" : "medium" },
    current_track_stage_id: currentTrackStage?.id || null,
  };
}

export function computeTaskFacts(todos) {
  const today = new Date().toISOString().slice(0, 10);
  const open = todos.filter((t) => !t.is_done);
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  return {
    open_tasks: { value: open.length, reliability: "high" },
    completed_tasks: { value: todos.length - open.length, reliability: "high" },
    overdue_tasks: { value: overdue.length, reliability: "high" },
    overdue_task_titles: overdue.slice(0, 5).map((t) => t.title),
  };
}

export function computeMilestoneFacts(milestones, dateHistoryCounts) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = milestones
    .filter((m) => m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalPostponements = Object.values(dateHistoryCounts).reduce((sum, n) => sum + n, 0);
  const mostPostponed = milestones
    .map((m) => ({ label: m.label || m.type, count: dateHistoryCounts[m.id] || 0 }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)[0] || null;

  return {
    next_milestone: upcoming[0] ? { label: upcoming[0].label || upcoming[0].type, date: upcoming[0].date } : null,
    upcoming_milestone_count: { value: upcoming.length, reliability: "high" },
    milestone_postponement_count: { value: totalPostponements, reliability: "high" },
    most_postponed_milestone: mostPostponed,
  };
}

export function computeQuotationFacts(quotations) {
  if (!quotations.length) return { latest_quotation: null, quotation_count: { value: 0, reliability: "high" } };
  const latest = [...quotations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  return {
    quotation_count: { value: quotations.length, reliability: "high" },
    latest_quotation: {
      quote_number: latest.quote_number,
      document_type: latest.document_type,
      currency: latest.currency,
      total_amount: latest.total_amount,
      valid_until: latest.valid_until,
      id: latest.id,
    },
  };
}

export function computePaymentFacts(latestQuotation, payments) {
  if (!latestQuotation) return { client_payments: null, client_balance: null };
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const total = Number(latestQuotation.total_amount || 0);
  return {
    client_payments: { value: paid, currency: latestQuotation.currency, reliability: "high" },
    client_balance: { value: Math.round((total - paid) * 100) / 100, currency: latestQuotation.currency, reliability: "high" },
  };
}

// Inspection status must NEVER be inferred from pipeline stage — it comes
// only from an actual inspection_reports row (Copilot Blueprint §13,
// non-negotiable rule enforced here rather than left to the prompt).
export function computeInspectionFacts(reports) {
  if (!reports.length) return { inspection_status: { value: "no_report", reliability: "high" } };
  const latest = [...reports].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  return {
    inspection_status: { value: latest.status, reliability: "high", source: "inspection_reports", report_number: latest.report_number },
  };
}

export function computeShipmentFacts(shipments) {
  if (!shipments.length) return { shipment_status: null };
  const latest = [...shipments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  return {
    shipment_status: {
      value: latest.status,
      status_detail: latest.status_detail,
      estimated_delivery: latest.estimated_delivery,
      tracking_number: latest.tracking_number,
      reliability: "medium", // shipments.status is free text, not a constrained enum
    },
  };
}

export function computeActivityFacts(lastMessageAt, emailThreads) {
  const needsResponse = emailThreads.filter((t) => t.needs_response);
  return {
    last_project_activity: lastMessageAt ? { value: lastMessageAt, reliability: "high" } : null,
    email_needs_response: {
      value: needsResponse.length > 0,
      count: needsResponse.length,
      reliability: emailThreads.length ? "medium" : "unavailable", // email_threads.project_id isn't reliably backfilled on old threads
    },
  };
}
