import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { WARRANTY_PRESET, KIND_LABEL, ruleLabel } from "../../lib/warranty";
import { inputCls, labelCls } from "./WarrantyBits";

// Staff: the warranty times that apply to ONE client (brand / product keyword → months, hours, factory defects).
const blank = { brand: "", product_match: "", kind: "months", months: 12, report_hours: 48, requires_label: false, notes: "" };

export default function WarrantyRulesPanel({ client }) {
  const [rules, setRules] = useState(null);
  const [form, setForm] = useState(null); // rule being edited (id) or new
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("warranty_rules").select("*").eq("client_id", client.id).order("sort_order").order("created_at");
    if (e) { setError(e.message.includes("does not exist") ? "Apply the migration 2026-11-22_supabase-warranties.sql in Supabase first." : e.message); setRules([]); return; }
    setError(""); setRules(data || []);
  }, [client.id]);
  useEffect(() => { load(); }, [load]);

  async function loadPreset() {
    if (rules.length && !window.confirm(`${client.company_name} already has ${rules.length} rules. Add the CCSF table on top of them?`)) return;
    setBusy(true);
    const base = rules.length;
    const rows = WARRANTY_PRESET.map((r, i) => ({
      client_id: client.id, brand: r.brand || null, product_match: r.product_match || null, kind: r.kind, months: r.months ?? null,
      report_hours: r.report_hours ?? null, requires_label: !!r.requires_label, notes: r.notes || null, sort_order: base + i,
    }));
    const { error: e } = await supabase.from("warranty_rules").insert(rows);
    setBusy(false);
    if (e) setError(e.message); else load();
  }

  async function save() {
    setError("");
    const f = form;
    if (!f.brand?.trim() && !f.product_match?.trim() && f.id == null && !window.confirm("A rule with no brand and no product applies to EVERYTHING. Continue?")) return;
    const row = {
      client_id: client.id, brand: f.brand?.trim() || null, product_match: f.product_match?.trim() || null, kind: f.kind,
      months: f.kind === "months" ? Number(f.months) || 0 : null, report_hours: f.kind === "hours" ? Number(f.report_hours) || 0 : null,
      requires_label: !!f.requires_label, notes: f.notes?.trim() || null,
    };
    const { error: e } = f.id ? await supabase.from("warranty_rules").update(row).eq("id", f.id) : await supabase.from("warranty_rules").insert({ ...row, sort_order: rules.length });
    if (e) { setError(e.message); return; }
    setForm(null); load();
  }

  async function remove(r) {
    if (!window.confirm("Delete this rule?")) return;
    const { error: e } = await supabase.from("warranty_rules").delete().eq("id", r.id);
    if (e) setError(e.message); else load();
  }

  async function removeAll() {
    if (!window.confirm(`Delete ALL ${rules.length} warranty rules of ${client.company_name}?`)) return;
    const { error: e } = await supabase.from("warranty_rules").delete().eq("client_id", client.id);
    if (e) setError(e.message); else load();
  }

  const shown = (rules || []).filter(r => !q || `${r.brand || ""} ${r.product_match || ""} ${r.notes || ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="max-w-xl">
          <h3 className="text-base font-bold text-darkblack-700 dark:text-white">Warranty rules</h3>
          <p className="text-sm text-bgray-500 mt-0.5">Warranty time per brand or product keyword for {client.company_name}. The most specific rule wins (brand + product › product › brand › general). Used to tell whether a claim is still covered.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadPreset} disabled={busy || rules === null} className="px-3 py-2 text-sm font-medium rounded-lg border border-bgray-300 hover:bg-bgray-100 disabled:opacity-50">Load CCSF table</button>
          <button onClick={() => setForm({ ...blank })} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90">+ Add rule</button>
        </div>
      </div>
      {error && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}

      {form && (
        <div className="border border-bgray-200 rounded-xl p-4 space-y-3 bg-bgray-50/60">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={labelCls}>Brand</label><input className={inputCls} value={form.brand || ""} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Any brand" /></div>
            <div className="md:col-span-2"><label className={labelCls}>Product keywords</label><input className={inputCls} value={form.product_match || ""} onChange={e => setForm({ ...form, product_match: e.target.value })} placeholder="e.g. anillo, funda (comma separated)" /></div>
            <div><label className={labelCls}>Type</label>
              <select className={inputCls} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {form.kind === "months" && <div><label className={labelCls}>Months</label><input type="number" min="1" className={inputCls} value={form.months ?? ""} onChange={e => setForm({ ...form, months: e.target.value })} /></div>}
            {form.kind === "hours" && <div><label className={labelCls}>Report within (hours)</label><input type="number" min="1" className={inputCls} value={form.report_hours ?? ""} onChange={e => setForm({ ...form, report_hours: e.target.value })} /></div>}
            <div className="md:col-span-2"><label className={labelCls}>Notes</label><input className={inputCls} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm self-end pb-2"><input type="checkbox" checked={!!form.requires_label} onChange={e => setForm({ ...form, requires_label: e.target.checked })} />Label required</label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg">Save</button>
            <button onClick={() => setForm(null)} className="px-4 py-2 text-sm rounded-lg border border-bgray-200">Cancel</button>
          </div>
        </div>
      )}

      {rules === null ? <p className="text-sm text-bgray-400">Loading…</p> : rules.length === 0 ? (
        <div className="px-3 py-3 bg-bgray-50 border border-bgray-200 rounded-lg text-sm text-bgray-600">No rules yet. “Load CCSF table” fills the warranty times from the MAN-GRT-001 manual; you can then edit them.</div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input className={`${inputCls} max-w-xs`} placeholder="Search brand / product…" value={q} onChange={e => setQ(e.target.value)} />
            <span className="text-xs text-bgray-500">{shown.length} of {rules.length}</span>
            <button onClick={removeAll} className="ml-auto text-xs text-red-600 hover:underline">Delete all</button>
          </div>
          <div className="border border-bgray-200 rounded-xl divide-y divide-bgray-100">
            {shown.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-darkblack-700 dark:text-white truncate">{r.brand || "Any brand"}{r.product_match ? <span className="font-normal text-bgray-500"> · {r.product_match}</span> : null}</p>
                  {r.notes && <p className="text-xs text-bgray-500 truncate">{r.notes}</p>}
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">{ruleLabel(r)}{r.requires_label ? " · label" : ""}</span>
                <button onClick={() => setForm({ ...r })} className="text-xs px-2 py-1 rounded border border-bgray-200 hover:bg-bgray-100">Edit</button>
                <button onClick={() => remove(r)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200">🗑</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
