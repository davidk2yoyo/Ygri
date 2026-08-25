import React, { useState, useEffect, useCallback } from "react";
import { sileo } from "sileo";
import { supabase } from "../supabaseClient";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "prompts", label: "Prompts" },
  { key: "skills", label: "Skills" },
  { key: "tools", label: "Tools" },
  { key: "executions", label: "Executions" },
  { key: "settings", label: "Settings" },
];

function Card({ children, className = "" }) {
  return <div className={`bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4 ${className}`}>{children}</div>;
}

function StatTile({ label, value }) {
  return (
    <Card>
      <p className="text-xs text-bgray-500 dark:text-bgray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-darkblack-700 dark:text-white">{value}</p>
    </Card>
  );
}

// ---------------------------------------------------------------- Overview
function OverviewTab() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("ai_executions").select("tools_called, proposed_actions, error, latency_ms, estimated_cost_usd").gte("created_at", startOfDay.toISOString());
      const rows = data || [];
      const toolCalls = rows.reduce((sum, r) => sum + (r.tools_called?.length || 0), 0);
      const writeProposals = rows.reduce((sum, r) => sum + (r.proposed_actions?.length || 0), 0);
      const failed = rows.filter((r) => r.error).length;
      const avgLatency = rows.length ? Math.round(rows.reduce((s, r) => s + (r.latency_ms || 0), 0) / rows.length) : 0;
      const cost = rows.reduce((s, r) => s + Number(r.estimated_cost_usd || 0), 0);
      setStats({ requests: rows.length, successful: rows.length - failed, failed, toolCalls, writeProposals, avgLatency, cost });
    })();
  }, []);

  if (!stats) return <p className="text-sm text-bgray-400">Loading…</p>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile label="Requests today" value={stats.requests} />
      <StatTile label="Successful" value={stats.successful} />
      <StatTile label="Failed" value={stats.failed} />
      <StatTile label="Tool calls" value={stats.toolCalls} />
      <StatTile label="Write proposals" value={stats.writeProposals} />
      <StatTile label="Avg latency" value={`${stats.avgLatency}ms`} />
      <StatTile label="Est. cost" value={`$${stats.cost.toFixed(4)}`} />
    </div>
  );
}

// ------------------------------------------------------------- Prompts/Skills (shared shape)
function VersionedEditor({ table, title, extraColumns }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // key
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from(table).select("*").order("key").order("version", { ascending: false });
    setRows(data || []);
  }, [table]);

  useEffect(() => { load(); }, [load]);

  const grouped = rows.reduce((acc, r) => {
    (acc[r.key] = acc[r.key] || []).push(r);
    return acc;
  }, {});

  const textField = table === "ai_prompts" ? "system_prompt" : "instructions";

  const startEdit = (row) => {
    setEditing(row.key);
    setDraftText(row[textField]);
  };

  const saveNewVersion = async (row) => {
    setSaving(true);
    try {
      // Immutable versioning: never overwrite a row an ai_execution might
      // reference — deactivate the old one, insert a new active version.
      const { error: deactivateErr } = await supabase.from(table).update({ is_active: false }).eq("id", row.id);
      if (deactivateErr) throw deactivateErr;
      const payload = { key: row.key, name: row.name, [textField]: draftText, version: row.version + 1, is_active: true };
      if (extraColumns) extraColumns.forEach((c) => { payload[c] = row[c]; });
      const { error: insertErr } = await supabase.from(table).insert(payload);
      if (insertErr) throw insertErr;
      sileo.success({ title: "New version saved" });
      setEditing(null);
      await load();
    } catch (e) {
      sileo.error({ title: "Could not save", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    await supabase.from(table).update({ is_active: !row.is_active }).eq("id", row.id);
    await load();
  };

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([key, versions]) => {
        const active = versions.find((v) => v.is_active) || versions[0];
        return (
          <Card key={key}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-darkblack-700 dark:text-white">{active.name}</p>
                <p className="text-xs text-bgray-400 font-mono">{key} · v{active.version}{active.is_active ? "" : " (inactive)"}</p>
              </div>
              <div className="flex gap-2">
                {editing !== key && (
                  <button onClick={() => startEdit(active)} className="text-xs font-medium text-primary hover:underline">Edit</button>
                )}
                <button onClick={() => toggleActive(active)} className="text-xs font-medium text-bgray-500 hover:text-darkblack-700 dark:hover:text-white">
                  {active.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
            {editing === key ? (
              <div className="space-y-2">
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-sm border border-bgray-200 dark:border-darkblack-400 rounded-lg bg-bgray-50 dark:bg-darkblack-500 text-darkblack-700 dark:text-white font-mono"
                />
                <div className="flex gap-2">
                  <button onClick={() => saveNewVersion(active)} disabled={saving} className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                    {saving ? "Saving…" : "Save as new version"}
                  </button>
                  <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs text-bgray-500">Cancel</button>
                </div>
              </div>
            ) : (
              <pre className="text-xs text-bgray-600 dark:text-bgray-300 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{active[textField]}</pre>
            )}
          </Card>
        );
      })}
      {!rows.length && <p className="text-sm text-bgray-400">No {title.toLowerCase()} yet — run supabase-ai-copilot.sql to seed the initial set.</p>}
    </div>
  );
}

// ------------------------------------------------------------------- Tools
function ToolsTab() {
  const [tools, setTools] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("ai_tools").select("*").order("tool_type").order("key");
    setTools(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (tool) => {
    await supabase.from("ai_tools").update({ enabled: !tool.enabled }).eq("id", tool.id);
    await load();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-bgray-400 uppercase border-b border-bgray-200 dark:border-darkblack-400">
            <th className="py-2 pr-4">Tool</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4">Enabled</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((t) => (
            <tr key={t.id} className="border-b border-bgray-100 dark:border-darkblack-500">
              <td className="py-2 pr-4 font-mono text-xs text-darkblack-700 dark:text-white">{t.key}</td>
              <td className="py-2 pr-4">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.tool_type === "write" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                  {t.tool_type.toUpperCase()}
                </span>
              </td>
              <td className="py-2 pr-4 text-bgray-500 dark:text-bgray-400">{t.description}</td>
              <td className="py-2 pr-4">
                <button
                  onClick={() => toggle(t)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${t.enabled ? "bg-primary" : "bg-bgray-300 dark:bg-darkblack-400"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${t.enabled ? "translate-x-4" : ""}`} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-bgray-400 mt-3">READ/WRITE type is fixed in code and cannot be changed here — this table only controls whether a tool is offered to the model at all.</p>
    </div>
  );
}

// -------------------------------------------------------------- Executions
function ExecutionsTab() {
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ai_executions")
        .select("*, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      setRows(data || []);
    })();
  }, []);

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.id}>
          <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="w-full text-left flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-darkblack-700 dark:text-white truncate">{r.result || "—"}</p>
              <p className="text-xs text-bgray-400">{r.profiles?.full_name || "Unknown"} · {new Date(r.created_at).toLocaleString()} · {r.model}</p>
            </div>
            {r.error && <span className="text-xs text-red-500 shrink-0">error</span>}
          </button>
          {expanded === r.id && (
            <div className="mt-3 pt-3 border-t border-bgray-100 dark:border-darkblack-500 text-xs space-y-1.5 text-bgray-600 dark:text-bgray-300">
              <p><b>Prompt:</b> {r.prompt_key} v{r.prompt_version}</p>
              <p><b>Skills used:</b> {(r.skills_used || []).join(", ") || "none"}</p>
              <p><b>Context providers:</b> {(r.context_providers_used || []).join(", ") || "none"}</p>
              <p><b>Tools called:</b> {(r.tools_called || []).map((t) => t.tool).join(", ") || "none"}</p>
              <p><b>Tokens:</b> {r.tokens_input || 0} in / {r.tokens_output || 0} out · <b>Latency:</b> {r.latency_ms}ms</p>
              {r.plan_id && <p><b>Plan:</b> <span className="font-mono">{r.plan_id}</span> — {(r.executed_action_ids || []).length}/{(r.approved_action_ids || []).length} executed</p>}
              {r.error && <p className="text-red-500"><b>Error:</b> {r.error}</p>}
            </div>
          )}
        </Card>
      ))}
      {!rows.length && <p className="text-sm text-bgray-400">No executions yet.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Settings
function SettingsTab() {
  return (
    <Card>
      <p className="text-sm text-darkblack-700 dark:text-white mb-1">Provider: <span className="font-mono">openai</span></p>
      <p className="text-sm text-darkblack-700 dark:text-white mb-1">Model: <span className="font-mono">gpt-4o-mini</span></p>
      <p className="text-xs text-bgray-400 mt-3">
        Model/provider are centralized in <span className="font-mono">api/_lib/ai/openai.js</span> for this phase rather than a settings table —
        there's exactly one model in use, so a table would be pure overhead. Worth promoting to an editable setting once there's a real reason to switch.
      </p>
    </Card>
  );
}

export default function AiManagementPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [role, setRole] = useState(undefined); // undefined = loading

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRole(null); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      setRole(data?.role || "staff");
    })();
  }, []);

  if (role === undefined) return null;
  if (role === "inspector") {
    return (
      <div className="p-6">
        <p className="text-sm text-bgray-500">AI Management isn't available for inspector accounts.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-darkblack-700 dark:text-white mb-1">AI Management</h1>
      <p className="text-sm text-bgray-500 dark:text-bgray-400 mb-5">Ygri Copilot's prompts, skills, tools, and execution history.</p>

      <div className="flex gap-1 border-b border-bgray-200 dark:border-darkblack-400 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-bgray-500 dark:text-bgray-400 hover:text-darkblack-700 dark:hover:text-white"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "prompts" && <VersionedEditor table="ai_prompts" title="Prompts" />}
      {activeTab === "skills" && <VersionedEditor table="ai_skills" title="Skills" extraColumns={["domain", "applies_to_tools"]} />}
      {activeTab === "tools" && <ToolsTab />}
      {activeTab === "executions" && <ExecutionsTab />}
      {activeTab === "settings" && <SettingsTab />}
    </div>
  );
}
