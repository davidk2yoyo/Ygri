// Framework-free tests for the deterministic parts of Ygri Copilot — the
// repo has no test runner yet, and this phase doesn't need one to verify
// pure functions. Run with: node scripts/test-ai-core.mjs
import assert from "node:assert/strict";
import {
  computeStageFacts,
  computeTaskFacts,
  computeMilestoneFacts,
  computeInspectionFacts,
} from "../api/_lib/ai/context/projectStatusEngine.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok  - ${name}`);
    passed++;
  } catch (e) {
    console.error(`FAIL - ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
}

// ---- Project Status Engine ----------------------------------------------

test("computeStageFacts: finds current + next stage from order_index", () => {
  const track = { current_stage_template_id: "st-2" };
  const stageTemplates = [
    { id: "st-1", name: "Lead", order_index: 1, sla_days: null },
    { id: "st-2", name: "Quotation", order_index: 2, sla_days: 5 },
    { id: "st-3", name: "Samples Approval", order_index: 3, sla_days: null },
  ];
  const stages = [{ id: "ts-2", stage_template_id: "st-2", started_at: new Date(Date.now() - 3 * 86400000).toISOString() }];
  const facts = computeStageFacts({ track, stages, stageTemplates });
  assert.equal(facts.current_stage.name, "Quotation");
  assert.equal(facts.next_stage.name, "Samples Approval");
  assert.equal(facts.days_in_stage.value, 3);
  assert.equal(facts.stage_sla_status.value, "on_time"); // 3 of 5 days — not yet within 1 day of the SLA
});

test("computeStageFacts: within 1 day of SLA is at_risk, past it is overdue", () => {
  const stageTemplates = [{ id: "st-1", name: "Quotation", order_index: 1, sla_days: 5 }];
  const atRisk = computeStageFacts({
    track: { current_stage_template_id: "st-1" },
    stageTemplates,
    stages: [{ id: "ts-1", stage_template_id: "st-1", started_at: new Date(Date.now() - 4 * 86400000).toISOString() }],
  });
  assert.equal(atRisk.stage_sla_status.value, "at_risk");
  const overdue = computeStageFacts({
    track: { current_stage_template_id: "st-1" },
    stageTemplates,
    stages: [{ id: "ts-1", stage_template_id: "st-1", started_at: new Date(Date.now() - 6 * 86400000).toISOString() }],
  });
  assert.equal(overdue.stage_sla_status.value, "overdue");
});

test("computeStageFacts: last stage has no next_stage", () => {
  const track = { current_stage_template_id: "st-3" };
  const stageTemplates = [
    { id: "st-1", name: "Lead", order_index: 1 },
    { id: "st-3", name: "Delivered", order_index: 2 },
  ];
  const facts = computeStageFacts({ track, stages: [], stageTemplates });
  assert.equal(facts.next_stage, null);
});

test("computeStageFacts: missing started_at yields unavailable reliability, not a guess", () => {
  const track = { current_stage_template_id: "st-1" };
  const stageTemplates = [{ id: "st-1", name: "Lead", order_index: 1, sla_days: 5 }];
  const stages = [{ id: "ts-1", stage_template_id: "st-1", started_at: null }];
  const facts = computeStageFacts({ track, stages, stageTemplates });
  assert.equal(facts.days_in_stage.value, null);
  assert.equal(facts.days_in_stage.reliability, "unavailable");
});

test("computeTaskFacts: overdue = open AND past due date", () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const todos = [
    { title: "A", is_done: false, due_date: yesterday },
    { title: "B", is_done: false, due_date: tomorrow },
    { title: "C", is_done: true, due_date: yesterday }, // done — not overdue even though date passed
  ];
  const facts = computeTaskFacts(todos);
  assert.equal(facts.open_tasks.value, 2);
  assert.equal(facts.overdue_tasks.value, 1);
  assert.deepEqual(facts.overdue_task_titles, ["A"]);
});

test("computeMilestoneFacts: postponement count is exact, from history rows", () => {
  const milestones = [{ id: "m1", label: "Inspection", type: "inspection", date: "2099-01-01" }];
  const dateHistoryCounts = { m1: 3 };
  const facts = computeMilestoneFacts(milestones, dateHistoryCounts);
  assert.equal(facts.milestone_postponement_count.value, 3);
  assert.equal(facts.most_postponed_milestone.label, "Inspection");
  assert.equal(facts.most_postponed_milestone.count, 3);
});

test("computeInspectionFacts: NEVER inferred from stage — no report means 'no_report', not 'passed'", () => {
  const facts = computeInspectionFacts([]);
  assert.equal(facts.inspection_status.value, "no_report");
});

test("computeInspectionFacts: uses the most recent report's actual status", () => {
  const reports = [
    { status: "rejected", created_at: "2026-01-01T00:00:00Z" },
    { status: "approved", created_at: "2026-02-01T00:00:00Z" },
  ];
  const facts = computeInspectionFacts(reports);
  assert.equal(facts.inspection_status.value, "approved");
  assert.equal(facts.inspection_status.source, "inspection_reports");
});

console.log(`\n${passed} test(s) passed.`);
