import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { AttachPicker, Attachments } from "./cases/CaseThread";
import { PROFILE_SECTIONS, RATING_CRITERIA, INVOICING, overallRating, stars, sectionFilled } from "../lib/supplierProfile";

// Staff: a supplier's profile ("hoja de vida") and which sections each client may see.
const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";
const labelCls = "block text-[11px] font-semibold text-bgray-500 mb-1 uppercase tracking-wide";

function SectionEditor({ supplierId, def, row, onSaved }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(row?.body || "");
  const [data, setData] = useState(row?.data || {});
  const [files, setFiles] = useState(row?.files || []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setBody(row?.body || ""); setData(row?.data || {}); setFiles(row?.files || []); }, [row]);

  async function save() {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("supplier_profile_sections").upsert({
      supplier_id: supplierId, section: def.key, body: body.trim() || null, data, files, updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg("Saved"); onSaved();
  }

  const filled = sectionFilled(row);
  const overall = def.key === "calificacion" ? overallRating(data) : null;
  return (
    <div className="border border-bgray-200 dark:border-darkblack-400 rounded-xl bg-white dark:bg-darkblack-600 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bgray-50 dark:hover:bg-darkblack-500">
        <span className="text-lg">{def.icon}</span>
        <span className="flex-1 text-sm font-semibold text-darkblack-700 dark:text-white">{def.label}</span>
        {def.key === "calificacion" && overallRating(row?.data) != null && <span className="text-sm text-amber-500">{stars(overallRating(row?.data))}</span>}
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${filled ? "bg-green-100 text-green-700" : "bg-bgray-100 text-bgray-500"}`}>{filled ? "Filled" : "Empty"}</span>
        <span className="text-bgray-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-bgray-100 dark:border-darkblack-400">
          <p className="text-xs text-bgray-500">{def.hint}</p>
          {def.key === "calificacion" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {RATING_CRITERIA.map(c => (
                <div key={c.key}><label className={labelCls}>{c.label}</label>
                  <select className={inputCls} value={data[c.key] || ""} onChange={e => setData({ ...data, [c.key]: e.target.value ? Number(e.target.value) : "" })}>
                    <option value="">—</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {"★".repeat(n)}</option>)}
                  </select></div>
              ))}
              {overall != null && <p className="col-span-2 md:col-span-4 text-sm text-amber-600">Overall: <b>{overall.toFixed(1)}</b> / 5 {stars(overall)}</p>}
            </div>
          )}
          {def.key === "factura" && (
            <div className="max-w-sm"><label className={labelCls}>Invoicing</label>
              <select className={inputCls} value={data.invoicing || ""} onChange={e => setData({ ...data, invoicing: e.target.value })}>
                <option value="">Not specified</option>{Object.entries(INVOICING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          )}
          <div><label className={labelCls}>Details</label><textarea rows={5} className={inputCls} value={body} onChange={e => setBody(e.target.value)} /></div>
          <div>
            <label className={labelCls}>Files (certificates, photos, price lists…)</label>
            <Attachments items={files} />
            <div className="mt-2"><AttachPicker value={[]} onChange={added => setFiles([...files, ...added].slice(0, 30))} disabled={busy} /></div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((f, i) => <button key={i} onClick={() => setFiles(files.filter((_, k) => k !== i))} className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Remove “{(f.name || "file").slice(0, 24)}”</button>)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">{busy ? "Saving…" : "Save section"}</button>
            {msg && <span className={`text-sm ${msg === "Saved" ? "text-green-700" : "text-red-600"}`}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Sharing({ supplierId, rows }) {
  const [shares, setShares] = useState(null);
  const [clients, setClients] = useState([]);
  const [add, setAdd] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.from("supplier_profile_shares").select("client_id, sections, clients(company_name)").eq("supplier_id", supplierId),
      supabase.from("clients").select("id, company_name").order("company_name"),
    ]);
    if (s.error) { setErr(s.error.message); setShares([]); return; }
    setShares(s.data || []); setClients(c.data || []);
  }, [supplierId]);
  useEffect(() => { load(); }, [load]);

  async function setSections(clientId, sections) {
    setErr("");
    const { error } = await supabase.from("supplier_profile_shares").upsert({ supplier_id: supplierId, client_id: clientId, sections, updated_at: new Date().toISOString() });
    if (error) setErr(error.message); else load();
  }
  async function removeClient(clientId) {
    await supabase.from("supplier_profile_shares").delete().eq("supplier_id", supplierId).eq("client_id", clientId); load();
  }

  if (shares === null) return <p className="text-sm text-bgray-400">Loading…</p>;
  const free = clients.filter(c => !shares.some(s => s.client_id === c.id));
  const filledKeys = new Set(rows.filter(sectionFilled).map(r => r.section));

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold text-darkblack-700 dark:text-white">Visible to clients</h4>
        <p className="text-xs text-bgray-500">Choose which sections each client sees in their portal (Proveedores). A client sees nothing until you tick a section. “Lista de precios” is only shown to portal users who can see prices.</p>
      </div>
      {err && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{err}</div>}
      {shares.map(s => (
        <div key={s.client_id} className="border border-bgray-200 dark:border-darkblack-400 rounded-xl p-3 bg-white dark:bg-darkblack-600">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-darkblack-700 dark:text-white">{s.clients?.company_name}</p>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setSections(s.client_id, PROFILE_SECTIONS.map(x => x.key))} className="text-primary hover:underline">All</button>
              <button onClick={() => setSections(s.client_id, [])} className="text-bgray-500 hover:underline">None</button>
              <button onClick={() => window.confirm("Stop sharing this supplier with this client?") && removeClient(s.client_id)} className="text-red-600 hover:underline">Remove</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {PROFILE_SECTIONS.map(d => (
              <label key={d.key} className="flex items-center gap-1.5 text-sm text-darkblack-700 dark:text-white">
                <input type="checkbox" checked={s.sections.includes(d.key)}
                  onChange={e => setSections(s.client_id, e.target.checked ? [...s.sections, d.key] : s.sections.filter(k => k !== d.key))} />
                {d.icon} {d.label}{!filledKeys.has(d.key) && <span className="text-[10px] text-bgray-400">(empty)</span>}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2 items-center">
        <select className={`${inputCls} max-w-xs`} value={add} onChange={e => setAdd(e.target.value)}>
          <option value="">Share with a client…</option>{free.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <button disabled={!add} onClick={async () => { await setSections(add, ["proveedor"]); setAdd(""); }} className="px-3 py-2 text-sm font-medium rounded-lg border border-bgray-300 hover:bg-bgray-100 disabled:opacity-50">Add</button>
      </div>
    </div>
  );
}

export default function SupplierProfileTab({ supplierId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("supplier_profile_sections").select("*").eq("supplier_id", supplierId);
    if (e) { setError(e.message.includes("does not exist") ? "Apply the migration 2026-11-25_supabase-supplier-profiles.sql in Supabase first." : e.message); setRows([]); return; }
    setError(""); setRows(data || []);
  }, [supplierId]);
  useEffect(() => { load(); }, [load]);

  if (rows === null) return <div className="p-6 text-sm text-bgray-400">Loading…</div>;
  return (
    <div className="p-6 space-y-6">
      {error && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}
      <div className="space-y-2.5">
        <div>
          <h4 className="text-sm font-bold text-darkblack-700 dark:text-white">Supplier profile (hoja de vida)</h4>
          <p className="text-xs text-bgray-500">Fill in what you want to be able to show. Nothing is visible to a client until you share it below.</p>
        </div>
        {PROFILE_SECTIONS.map(d => <SectionEditor key={d.key} supplierId={supplierId} def={d} row={rows.find(r => r.section === d.key)} onSaved={load} />)}
      </div>
      {!error && <Sharing supplierId={supplierId} rows={rows} />}
    </div>
  );
}
