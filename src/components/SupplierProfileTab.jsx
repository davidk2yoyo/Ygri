import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { AttachPicker, Attachments } from "./cases/CaseThread";
import { PROFILE_SECTIONS, SECTION_FIELDS, RATING_CRITERIA, overallRating, stars, sectionFilled } from "../lib/supplierProfile";

// Staff: a supplier's profile ("hoja de vida") and which sections each client may see.
const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";
const labelCls = "block text-[11px] font-semibold text-bgray-500 mb-1 uppercase tracking-wide";

function FieldInput({ f, data, setData }) {
  const v = data[f.key];
  const set = (val) => setData({ ...data, [f.key]: val });
  const wrap = (child, span) => <div className={span || (f.wide || f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : "")}><label className={labelCls}>{f.label}</label>{child}</div>;
  if (f.type === "stars") return (
    <>{RATING_CRITERIA.map(c => (
      <div key={c.key}><label className={labelCls}>{c.label}</label>
        <select className={inputCls} value={data[c.key] || ""} onChange={e => setData({ ...data, [c.key]: e.target.value ? Number(e.target.value) : "" })}>
          <option value="">—</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {"★".repeat(n)}</option>)}
        </select></div>
    ))}</>
  );
  if (f.type === "textarea") return wrap(<textarea rows={3} className={inputCls} value={v || ""} onChange={e => set(e.target.value)} />);
  if (f.type === "yesno") return wrap(<select className={inputCls} value={v || ""} onChange={e => set(e.target.value)}><option value="">—</option><option value="yes">Sí</option><option value="no">No</option></select>);
  if (f.type === "select") return wrap(<select className={inputCls} value={v || ""} onChange={e => set(e.target.value)}><option value="">—</option>{f.options.map(o => <option key={o} value={o}>{f.optionLabels?.[o] || o}</option>)}</select>);
  if (f.type === "checks") {
    const cur = Array.isArray(v) ? v : [];
    return wrap(
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {f.options.map(o => (
          <label key={o} className="flex items-center gap-1.5 text-sm text-darkblack-700 dark:text-white">
            <input type="checkbox" checked={cur.includes(o)} onChange={e => set(e.target.checked ? [...cur, o] : cur.filter(x => x !== o))} />{o}
          </label>
        ))}
      </div>, "sm:col-span-2 lg:col-span-3");
  }
  if (f.type === "table") {
    const rowsV = Array.isArray(v) ? v : [];
    const upd = (i, k, val) => set(rowsV.map((r, n) => n === i ? { ...r, [k]: val } : r));
    return wrap(
      <div className="space-y-1.5">
        {rowsV.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-bgray-500">{f.columns.map(c => <th key={c.key} className="px-1 py-1 font-semibold">{c.label}</th>)}<th /></tr></thead>
              <tbody>{rowsV.map((r, i) => (
                <tr key={i}>
                  {f.columns.map(c => <td key={c.key} className="px-1 py-0.5"><input type={c.type === "date" ? "date" : "text"} className={`${inputCls} !py-1`} value={r[c.key] || ""} onChange={e => upd(i, c.key, e.target.value)} /></td>)}
                  <td className="px-1"><button type="button" onClick={() => set(rowsV.filter((_, n) => n !== i))} className="text-red-500 hover:text-red-700" title="Remove row">✕</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <button type="button" onClick={() => set([...rowsV, {}])} className="text-xs font-medium text-primary hover:underline">+ Add row</button>
      </div>, "sm:col-span-2 lg:col-span-3");
  }
  return wrap(<input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} className={inputCls} value={v ?? ""} onChange={e => set(e.target.value)} />);
}

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

  const visible = !!row?.visible;
  async function setVisible(v) {
    setMsg("");
    const { error } = await supabase.from("supplier_profile_sections").upsert({
      supplier_id: supplierId, section: def.key, body: body.trim() || null, data, files, visible: v, updated_at: new Date().toISOString(),
    });
    if (error) setMsg(error.message); else onSaved();
  }

  const filled = sectionFilled(row);
  const overall = def.key === "calificacion" ? overallRating(data) : null;
  return (
    <div className={`border rounded-xl bg-white dark:bg-darkblack-600 overflow-hidden ${visible ? "border-green-300" : "border-bgray-200 dark:border-darkblack-400"}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bgray-50 dark:hover:bg-darkblack-500">
        <span className="text-lg">{def.icon}</span>
        <span className="flex-1 text-sm font-semibold text-darkblack-700 dark:text-white">{def.label}</span>
        {def.key === "calificacion" && overallRating(row?.data) != null && <span className="text-sm text-amber-500">{stars(overallRating(row?.data))}</span>}
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${filled ? "bg-green-100 text-green-700" : "bg-bgray-100 text-bgray-500"}`}>{filled ? "Filled" : "Empty"}</span>
        <span className="text-bgray-400">{open ? "▾" : "▸"}</span>
      </button>
      <label className="flex items-center gap-2 px-4 py-2 text-xs border-t border-bgray-100 dark:border-darkblack-400 cursor-pointer select-none bg-bgray-50/60 dark:bg-darkblack-500">
        <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />
        <span className={visible ? "font-semibold text-green-700" : "text-bgray-500"}>{visible ? "👁 Visible to this supplier's clients" : "Hidden from clients"}</span>
        {def.key === "lista_precios" && <span className="text-bgray-400">· only users who can see prices</span>}
      </label>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-bgray-100 dark:border-darkblack-400">
          <p className="text-xs text-bgray-500">{def.hint}</p>
          {(SECTION_FIELDS[def.key] || []).map(g => (
            <div key={g.title} className="rounded-lg border border-bgray-100 dark:border-darkblack-400 p-3">
              <p className="text-xs font-bold text-darkblack-700 dark:text-white mb-2">{g.title}</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.fields.map(f => <FieldInput key={f.key} f={f} data={data} setData={setData} />)}
              </div>
            </div>
          ))}
          {overall != null && <p className="text-sm text-amber-600">Overall: <b>{overall.toFixed(1)}</b> / 5 {stars(overall)}</p>}
          <div><label className={labelCls}>Additional notes (shown to the client)</label><textarea rows={4} className={inputCls} value={body} onChange={e => setBody(e.target.value)} /></div>
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
        <h4 className="text-sm font-bold text-darkblack-700 dark:text-white">Also show to a specific client (optional)</h4>
        <p className="text-xs text-bgray-500">For a client that has not ordered from this supplier yet (so it is not covered by the switches above), or to show it extra sections. “Lista de precios” is only shown to portal users who can see prices.</p>
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
  const [audience, setAudience] = useState(null);
  useEffect(() => {
    (async () => {
      const { data: ids, error: e } = await supabase.rpc("supplier_client_ids", { p_supplier_id: supplierId });
      if (e) { setAudience(null); return; }
      const list = [...new Set((ids || []).map(r => r.client_id))];
      if (!list.length) { setAudience([]); return; }
      const { data: cl } = await supabase.from("clients").select("company_name").in("id", list).order("company_name");
      setAudience((cl || []).map(c => c.company_name));
    })();
  }, [supplierId]);
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
          <p className="text-xs text-bgray-500">Fill in the data, then tick “Visible” on each section you want clients to see. Everything stays hidden until you tick it.</p>
          {audience && (
            <p className="text-xs mt-1.5 text-bgray-600 dark:text-bgray-300">
              Visible sections are shown to the clients that work with this supplier: {audience.length
                ? audience.map(n => <span key={n} className="inline-block ml-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{n}</span>)
                : <b>none yet (no order or purchase order with this supplier)</b>}
            </p>
          )}
        </div>
        {PROFILE_SECTIONS.map(d => <SectionEditor key={d.key} supplierId={supplierId} def={d} row={rows.find(r => r.section === d.key)} onSaved={load} />)}
      </div>
      {!error && <Sharing supplierId={supplierId} rows={rows} />}
    </div>
  );
}
