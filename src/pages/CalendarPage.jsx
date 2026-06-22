import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

// ─── Type config ──────────────────────────────────────────────────────────────
const MILESTONE_CONFIG = {
  production_ready:   { label: "Production Ready",  emoji: "🏭", tw: "orange"  },
  inspection:         { label: "Inspection",         emoji: "🔍", tw: "blue"    },
  shipping_departure: { label: "Departure",          emoji: "🚢", tw: "teal"    },
  estimated_arrival:  { label: "ETA / Arrival",      emoji: "📦", tw: "purple"  },
  payment_balance:    { label: "Balance Payment",    emoji: "💰", tw: "green"   },
  client_delivery:    { label: "Client Delivery",    emoji: "✅", tw: "emerald" },
  custom:             { label: "Custom",             emoji: "📌", tw: "slate"   },
};

const TW = {
  orange:  { bg: "bg-orange-100",  text: "text-orange-700",  dot: "bg-orange-400",  border: "border-orange-200"  },
  blue:    { bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-500",    border: "border-blue-200"    },
  teal:    { bg: "bg-teal-100",    text: "text-teal-700",    dot: "bg-teal-500",    border: "border-teal-200"    },
  purple:  { bg: "bg-purple-100",  text: "text-purple-700",  dot: "bg-purple-500",  border: "border-purple-200"  },
  green:   { bg: "bg-green-100",   text: "text-green-700",   dot: "bg-green-500",   border: "border-green-200"   },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" },
  slate:   { bg: "bg-slate-100",   text: "text-slate-600",   dot: "bg-slate-400",   border: "border-slate-200"   },
  indigo:  { bg: "bg-indigo-50",   text: "text-indigo-600",  dot: "bg-indigo-400",  border: "border-indigo-100"  },
  sky:     { bg: "bg-sky-50",      text: "text-sky-600",     dot: "bg-sky-400",     border: "border-sky-100"     },
  gray:    { bg: "bg-gray-50",     text: "text-gray-400",    dot: "bg-gray-300",    border: "border-gray-100"    },
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const days = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(year, month, 1 - first.getDay() + i));
  }
  return days;
}

function formatLongDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getEventColor(ev) {
  if (ev.source === "milestone") return TW[(MILESTONE_CONFIG[ev.type] || MILESTONE_CONFIG.custom).tw];
  if (ev.source === "stage_due")        return TW.indigo;
  if (ev.source === "inspection_visit") return TW.sky;
  return TW.gray;
}

function getEventEmoji(ev) {
  if (ev.source === "milestone") return (MILESTONE_CONFIG[ev.type] || MILESTONE_CONFIG.custom).emoji;
  if (ev.source === "stage_due")        return "📅";
  if (ev.source === "inspection_visit") return "🔎";
  return "✓";
}

function getEventLabel(ev) {
  if (ev.source === "milestone") return ev.label || (MILESTONE_CONFIG[ev.type] || MILESTONE_CONFIG.custom).label;
  if (ev.source === "stage_due")        return ev.stage_template?.name || "Stage due";
  if (ev.source === "inspection_visit") return ev.title || ev.report_number || "Inspection";
  return ev.title || "Task";
}

// ─── Add Milestone Modal ───────────────────────────────────────────────────────
function AddMilestoneModal({ initialDate, projects, onClose, onSaved }) {
  const [form, setForm] = useState({
    track_id: "",
    type: "inspection",
    label: "",
    date: initialDate || toDateStr(new Date()),
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  const handleSave = async () => {
    if (!form.track_id) { setError("Please select a project"); return; }
    if (!form.date) { setError("Please select a date"); return; }
    setBusy(true);
    try {
      const { data, error: e } = await supabase
        .from("project_milestones")
        .insert({
          track_id: form.track_id,
          type: form.type,
          label: form.label.trim() || null,
          date: form.date,
          notes: form.notes.trim() || null,
        })
        .select("*, track:tracks(name, client:clients(name))")
        .single();
      if (e) throw e;
      onSaved(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-bgray-200 dark:border-darkblack-400 sticky top-0 bg-white dark:bg-darkblack-600 z-10">
          <h2 className="text-base font-bold text-darkblack-700 dark:text-white">Add Key Date</h2>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-200 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Project *</label>
            <select value={form.track_id} onChange={e => setForm(p => ({ ...p, track_id: e.target.value }))} className={inputCls}>
              <option value="">Select project…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.client?.name ? ` — ${p.client.name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">Milestone Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MILESTONE_CONFIG).map(([key, cfg]) => {
                const colors = TW[cfg.tw];
                const active = form.type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, type: key }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition text-left ${
                      active
                        ? `${colors.bg} ${colors.text} ${colors.border} font-semibold`
                        : "border-bgray-200 dark:border-darkblack-400 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500"
                    }`}
                  >
                    <span>{cfg.emoji}</span>
                    <span className="truncate text-xs">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {form.type === "custom" && (
            <div>
              <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Custom Label</label>
              <input type="text" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Port inspection" className={inputCls} />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Date *</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any additional context…" className={`${inputCls} resize-none`} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-bgray-200 dark:border-darkblack-400 sticky bottom-0 bg-white dark:bg-darkblack-600">
          <button onClick={onClose} className="px-4 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition">Cancel</button>
          <button onClick={handleSave} disabled={!form.track_id || !form.date || busy} className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
            {busy ? "Saving…" : "Add Date"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reschedule Modal ─────────────────────────────────────────────────────────
function RescheduleModal({ milestone, onClose, onSaved }) {
  const [newDate, setNewDate] = useState(milestone.date);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cfg = MILESTONE_CONFIG[milestone.type] || MILESTONE_CONFIG.custom;
  const colors = TW[cfg.tw];
  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  const handleSave = async () => {
    if (newDate === milestone.date) { setError("Date hasn't changed"); return; }
    if (!reason.trim()) { setError("Please enter a reason for the change"); return; }
    setBusy(true);
    setError("");
    try {
      const { error: e1 } = await supabase.from("milestone_date_history").insert({
        milestone_id: milestone.id,
        previous_date: milestone.date,
        new_date: newDate,
        reason: reason.trim(),
      });
      if (e1) throw e1;

      const { data, error: e2 } = await supabase
        .from("project_milestones")
        .update({ date: newDate, updated_at: new Date().toISOString() })
        .eq("id", milestone.id)
        .select("*, track:tracks(name, client:clients(name))")
        .single();
      if (e2) throw e2;
      onSaved(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-bgray-200 dark:border-darkblack-400">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3 ${colors.bg} ${colors.text}`}>
            {cfg.emoji} {milestone.label || cfg.label}
          </span>
          <h2 className="text-base font-bold text-darkblack-700 dark:text-white">Reschedule Date</h2>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5 truncate">{milestone.track?.name}</p>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-xs text-bgray-500 dark:text-bgray-400 mb-1">Current date</div>
              <div className="text-sm font-medium text-bgray-400 line-through">{formatShortDate(milestone.date)}</div>
            </div>
            <svg className="w-5 h-5 text-bgray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
            <div className="flex-1">
              <div className="text-xs text-bgray-500 dark:text-bgray-400 mb-1">New date</div>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Reason for change *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Factory delayed production by 2 weeks due to material shortage"
              className={`${inputCls} resize-none`}
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-bgray-200 dark:border-darkblack-400">
          <button onClick={onClose} className="px-4 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition">Cancel</button>
          <button onClick={handleSave} disabled={busy || !newDate} className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
            {busy ? "Saving…" : "Confirm Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Day Panel ────────────────────────────────────────────────────────────────
function DayPanel({ dateStr, events, onClose, onAdd, onReschedule, onDelete }) {
  const navigate = useNavigate();
  const [expandedHistory, setExpandedHistory] = useState({});
  const [historyMap, setHistoryMap] = useState({});

  const loadHistory = async (milestoneId) => {
    if (historyMap[milestoneId] !== undefined) {
      setExpandedHistory(p => ({ ...p, [milestoneId]: !p[milestoneId] }));
      return;
    }
    const { data } = await supabase
      .from("milestone_date_history")
      .select("*")
      .eq("milestone_id", milestoneId)
      .order("changed_at", { ascending: false });
    setHistoryMap(p => ({ ...p, [milestoneId]: data || [] }));
    setExpandedHistory(p => ({ ...p, [milestoneId]: true }));
  };

  const milestones  = events.filter(e => e.source === "milestone");
  const stages      = events.filter(e => e.source === "stage_due");
  const inspections = events.filter(e => e.source === "inspection_visit");
  const todos       = events.filter(e => e.source === "todo");

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-start justify-between p-4 border-b border-bgray-200 dark:border-darkblack-400">
        <div>
          <div className="text-xs text-bgray-500 dark:text-bgray-400 uppercase tracking-wider mb-0.5">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </div>
          <div className="text-sm font-bold text-darkblack-700 dark:text-white leading-snug">
            {formatLongDate(dateStr)}
          </div>
        </div>
        <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-200 transition mt-0.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {events.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-bgray-400 dark:text-bgray-500 mb-4">No events on this day</p>
            <button onClick={() => onAdd(dateStr)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
              + Add Key Date
            </button>
          </div>
        ) : (
          <>
            {/* Key date milestones */}
            {milestones.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-bgray-400 dark:text-bgray-500 uppercase tracking-wider mb-2">Key Dates</div>
                <div className="space-y-2">
                  {milestones.map(m => {
                    const cfg = MILESTONE_CONFIG[m.type] || MILESTONE_CONFIG.custom;
                    const colors = TW[cfg.tw];
                    const history = historyMap[m.id] || [];
                    const isExpanded = expandedHistory[m.id];
                    return (
                      <div key={m.id} className={`rounded-xl border p-3 ${colors.border} ${colors.bg}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-base leading-none mt-0.5 flex-shrink-0">{cfg.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold ${colors.text}`}>
                              {m.label || cfg.label}
                            </div>
                            <div className="text-xs text-bgray-600 dark:text-bgray-400 truncate font-medium">
                              {m.track?.name}
                            </div>
                            {m.track?.client?.name && (
                              <div className="text-xs text-bgray-400">{m.track.client.name}</div>
                            )}
                            {m.notes && (
                              <div className="text-xs text-bgray-500 mt-1 italic">{m.notes}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => onReschedule(m)}
                              title="Reschedule"
                              className="p-1.5 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition"
                            >
                              <svg className={`w-3.5 h-3.5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => onDelete(m)}
                              title="Delete"
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-bgray-400 hover:text-red-500 transition"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* History toggle */}
                        <button
                          onClick={() => loadHistory(m.id)}
                          className={`mt-2 text-xs flex items-center gap-1 opacity-60 hover:opacity-100 transition ${colors.text}`}
                        >
                          <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                          {isExpanded ? "Hide history" : "Date change history"}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 pl-3 border-l-2 border-current border-opacity-20 space-y-2.5">
                            {history.length === 0 ? (
                              <p className="text-xs text-bgray-400 italic">No date changes yet</p>
                            ) : history.map(h => (
                              <div key={h.id} className="text-xs">
                                <div className="flex items-center gap-1.5 text-bgray-600 dark:text-bgray-400">
                                  <span className="line-through text-bgray-400">{formatShortDate(h.previous_date)}</span>
                                  <span>→</span>
                                  <span className="font-semibold text-darkblack-700 dark:text-white">{formatShortDate(h.new_date)}</span>
                                </div>
                                {h.reason && (
                                  <p className="text-bgray-500 italic mt-0.5 leading-snug">"{h.reason}"</p>
                                )}
                                <p className="text-bgray-400 mt-0.5">
                                  {new Date(h.changed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stage deadlines */}
            {stages.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-bgray-400 dark:text-bgray-500 uppercase tracking-wider mb-2">Stage Deadlines</div>
                <div className="space-y-2">
                  {stages.map(s => (
                    <div key={s.id} className="flex items-center gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                      <span className="text-sm flex-shrink-0">📅</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300 truncate">
                          {s.stage_template?.name || "Stage"}
                        </div>
                        <div className="text-xs text-bgray-500 truncate">{s.track?.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inspections */}
            {inspections.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-bgray-400 dark:text-bgray-500 uppercase tracking-wider mb-2">Inspections</div>
                <div className="space-y-2">
                  {inspections.map(r => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/reports/${r.id}/edit`)}
                      className="flex items-center gap-2 p-2.5 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-100 dark:border-sky-800 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/40 transition"
                    >
                      <span className="text-sm flex-shrink-0">🔎</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-sky-700 dark:text-sky-300 truncate">
                          {r.title || r.report_number || "Inspection"}
                        </div>
                        <div className="text-xs text-bgray-500 truncate">{r.track?.name}</div>
                      </div>
                      <svg className="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Todos */}
            {todos.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-bgray-400 dark:text-bgray-500 uppercase tracking-wider mb-2">Tasks</div>
                <div className="space-y-1.5">
                  {todos.map(t => (
                    <div key={t.id} className="flex items-start gap-2.5 p-2.5 bg-gray-50 dark:bg-darkblack-500 rounded-xl border border-gray-100 dark:border-darkblack-400">
                      <div className="w-4 h-4 rounded border border-gray-300 dark:border-darkblack-300 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-darkblack-700 dark:text-white truncate">{t.title}</div>
                        <div className="text-xs text-bgray-400 truncate">{t.track_stage?.track?.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {events.length > 0 && (
        <div className="p-4 border-t border-bgray-200 dark:border-darkblack-400">
          <button
            onClick={() => onAdd(dateStr)}
            className="w-full px-4 py-2 border border-dashed border-bgray-300 dark:border-darkblack-400 rounded-xl text-sm text-bgray-500 dark:text-bgray-400 hover:border-primary hover:text-primary dark:hover:text-primary transition"
          >
            + Add Key Date
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Calendar Cell ────────────────────────────────────────────────────────────
function CalendarCell({ date, events, isCurrentMonth, isToday, isSelected, onClick }) {
  const MAX_VISIBLE = 3;
  const visible  = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - MAX_VISIBLE;

  return (
    <div
      onClick={onClick}
      className={`min-h-[90px] p-1.5 border-b border-r border-bgray-100 dark:border-darkblack-500 cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary/5 dark:bg-primary/10"
          : "hover:bg-bgray-50 dark:hover:bg-darkblack-500/40"
      }`}
    >
      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 transition-colors ${
        isToday
          ? "bg-primary text-white"
          : isSelected
          ? "bg-primary/20 text-primary"
          : isCurrentMonth
          ? "text-darkblack-700 dark:text-bgray-100"
          : "text-bgray-300 dark:text-darkblack-500"
      }`}>
        {date.getDate()}
      </div>
      <div className="space-y-0.5">
        {visible.map((ev, i) => {
          const colors = getEventColor(ev);
          return (
            <div
              key={i}
              className={`flex items-center gap-0.5 px-1.5 py-[2px] rounded text-[10px] font-medium leading-tight truncate ${colors.bg} ${colors.text}`}
            >
              <span className="flex-shrink-0 text-[9px]">{getEventEmoji(ev)}</span>
              <span className="truncate">{getEventLabel(ev)}</span>
            </div>
          );
        })}
        {overflow > 0 && (
          <div className="text-[10px] text-bgray-400 dark:text-bgray-500 pl-1">+{overflow} more</div>
        )}
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2 bg-bgray-50 dark:bg-darkblack-700 border-b border-bgray-100 dark:border-darkblack-500">
      {Object.entries(MILESTONE_CONFIG).map(([key, cfg]) => (
        <span key={key} className="flex items-center gap-1 text-[11px] text-bgray-500 dark:text-bgray-400">
          <span className={`w-2 h-2 rounded-full ${TW[cfg.tw].dot}`} />
          {cfg.label}
        </span>
      ))}
      <span className="flex items-center gap-1 text-[11px] text-bgray-500 dark:text-bgray-400">
        <span className="w-2 h-2 rounded-full bg-indigo-400" />Stage due
      </span>
      <span className="flex items-center gap-1 text-[11px] text-bgray-500 dark:text-bgray-400">
        <span className="w-2 h-2 rounded-full bg-sky-400" />Inspection
      </span>
    </div>
  );
}

// ─── Main CalendarPage ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date();
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [events, setEvents]       = useState({});
  const [projects, setProjects]   = useState([]);
  const [filterProject, setFilterProject] = useState("");
  const [filterType, setFilterType]       = useState("");
  const [showTodos, setShowTodos]         = useState(false);
  const [selectedDate, setSelectedDate]   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [addModal, setAddModal]           = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);

  const calDays   = getCalendarDays(year, month);
  const startDate = toDateStr(calDays[0]);
  const endDate   = toDateStr(calDays[41]);
  const todayStr  = toDateStr(today);

  useEffect(() => {
    supabase
      .from("tracks")
      .select("id, name, client:clients(name)")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => setProjects(data || []));
  }, []);

  useEffect(() => { loadEvents(); }, [year, month, filterProject, filterType, showTodos]);

  const loadEvents = async () => {
    setLoading(true);
    const map = {};
    const add = (dateStr, ev) => {
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(ev);
    };

    try {
      // 1. Project milestones
      let mq = supabase
        .from("project_milestones")
        .select("*, track:tracks(name, client:clients(name))")
        .gte("date", startDate)
        .lte("date", endDate);
      if (filterProject) mq = mq.eq("track_id", filterProject);
      if (filterType)    mq = mq.eq("type", filterType);
      const { data: milestones } = await mq;
      (milestones || []).forEach(m => add(m.date, { ...m, source: "milestone" }));

      // 2. Stage due dates
      let sq = supabase
        .from("track_stages")
        .select("id, due_date, status, track_id, stage_template:stage_templates(name), track:tracks(name)")
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .neq("status", "done")
        .not("due_date", "is", null);
      if (filterProject) sq = sq.eq("track_id", filterProject);
      const { data: stages } = await sq;
      (stages || []).forEach(s => add(s.due_date, { ...s, source: "stage_due" }));

      // 3. Inspection visits
      let iq = supabase
        .from("inspection_reports")
        .select("id, visit_date, report_number, title, status, track_id, track:tracks(name)")
        .gte("visit_date", startDate)
        .lte("visit_date", endDate)
        .not("visit_date", "is", null);
      if (filterProject) iq = iq.eq("track_id", filterProject);
      const { data: inspections } = await iq;
      (inspections || []).forEach(r => add(r.visit_date, { ...r, source: "inspection_visit" }));

      // 4. Todos (optional toggle)
      if (showTodos) {
        const { data: todos } = await supabase
          .from("stage_todos")
          .select("id, due_date, title, track_stage:track_stages(track_id, track:tracks(name))")
          .gte("due_date", startDate)
          .lte("due_date", endDate)
          .eq("is_done", false)
          .not("due_date", "is", null);
        (todos || []).forEach(t => {
          if (!filterProject || t.track_stage?.track_id === filterProject) {
            add(t.due_date, { ...t, source: "todo" });
          }
        });
      }

      setEvents(map);
    } catch (e) {
      console.error("Calendar load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const handleMilestoneSaved = (saved) => {
    setAddModal(null);
    loadEvents();
    setSelectedDate(saved.date);
  };

  const handleRescheduled = (updated) => {
    setRescheduleModal(null);
    loadEvents();
    setSelectedDate(updated.date);
  };

  const handleDelete = async (milestone) => {
    const label = milestone.label || MILESTONE_CONFIG[milestone.type]?.label || "this date";
    if (!window.confirm(`Delete "${label}"?`)) return;
    const { error } = await supabase.from("project_milestones").delete().eq("id", milestone.id);
    if (error) { alert(error.message); return; }
    loadEvents();
  };

  const selectedEvents = selectedDate ? (events[selectedDate] || []) : [];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-darkblack-600">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600">
        <h1 className="text-lg font-bold text-darkblack-700 dark:text-white mr-2">Calendar</h1>

        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-bgray-100 dark:hover:bg-darkblack-500 text-bgray-500 dark:text-bgray-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span className="text-sm font-semibold text-darkblack-700 dark:text-white w-36 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-bgray-100 dark:hover:bg-darkblack-500 text-bgray-500 dark:text-bgray-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
          <button onClick={goToday} className="px-2.5 py-1 text-xs bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 rounded-lg hover:bg-bgray-200 dark:hover:bg-darkblack-400 transition font-medium ml-1">
            Today
          </button>
        </div>

        <div className="flex-1" />

        {/* Filters */}
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="px-3 py-1.5 border border-bgray-200 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.client?.name ? ` — ${p.client.name}` : ""}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-bgray-200 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
        >
          <option value="">All Types</option>
          {Object.entries(MILESTONE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm text-bgray-600 dark:text-bgray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTodos}
            onChange={e => setShowTodos(e.target.checked)}
            className="w-4 h-4 rounded border-bgray-300 text-primary focus:ring-primary"
          />
          Tasks
        </label>

        <button
          onClick={() => setAddModal(todayStr)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Add Date
        </button>
      </div>

      {/* ── Legend ── */}
      <Legend />

      {/* ── Calendar + panel ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Calendar grid */}
        <div className="flex-1 flex flex-col overflow-auto min-w-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-700">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 bg-white dark:bg-darkblack-600" style={{ gridTemplateRows: "repeat(6, minmax(90px, 1fr))" }}>
              {calDays.map((d, i) => {
                const dateStr       = toDateStr(d);
                const dayEvents     = events[dateStr] || [];
                const isCurrentMonth = d.getMonth() === month;
                const isToday       = dateStr === todayStr;
                const isSelected    = dateStr === selectedDate;
                return (
                  <CalendarCell
                    key={i}
                    date={d}
                    events={dayEvents}
                    isCurrentMonth={isCurrentMonth}
                    isToday={isToday}
                    isSelected={isSelected}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Day detail panel */}
        {selectedDate && (
          <div className="w-72 flex-shrink-0 border-l border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 flex flex-col overflow-hidden">
            <DayPanel
              dateStr={selectedDate}
              events={selectedEvents}
              onClose={() => setSelectedDate(null)}
              onAdd={(date) => setAddModal(date)}
              onReschedule={(m) => setRescheduleModal(m)}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {addModal !== null && (
        <AddMilestoneModal
          initialDate={addModal}
          projects={projects}
          onClose={() => setAddModal(null)}
          onSaved={handleMilestoneSaved}
        />
      )}
      {rescheduleModal && (
        <RescheduleModal
          milestone={rescheduleModal}
          onClose={() => setRescheduleModal(null)}
          onSaved={handleRescheduled}
        />
      )}
    </div>
  );
}
