import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import ClaimItemsEditor, { emptyItem } from "../components/warranty/ClaimItemsEditor";
import { VerdictBadge, inputCls, labelCls } from "../components/warranty/WarrantyBits";
import { CLAIM_STATUS, evaluateItem, fmtDay } from "../lib/warranty";
import { exportWarrantyTracker, parseWarrantyTracker } from "../lib/warrantyExcel";

// Staff: every warranty claim from every client — review, forward to the supplier, record its answer.
const STATUS_ORDER = ["open", "sent_supplier", "answered", "resolved", "rejected"];
const norm = (s) => (s || "").toString().toLowerCase().trim();

function ClaimEditor({ claim, rules, onClose, onSaved }) {
  const [status, setStatus] = useState(claim.status);
  const [staffNotes, setStaffNotes] = useState(claim.staff_notes || "");
  const [review, setReview] = useState(claim.supplier_review_date || "");
  const [items, setItems] = useState(() => (claim.warranty_claim_items || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    .map(i => emptyItem({ ...i, received_at: i.received_at || "", complaint_date: i.complaint_date || "", resolution: i.resolution || "" })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const answersRef = useRef(null);

  async function save(nextStatus) {
    setBusy(true); setMsg("");
    const st = nextStatus || status;
    const { error: e1 } = await supabase.from("warranty_claims").update({
      status: st, staff_notes: staffNotes || null, supplier_review_date: review || null, updated_at: new Date().toISOString(),
    }).eq("id", claim.id);
    if (e1) { setBusy(false); setMsg(e1.message); return; }
    const { error: e2 } = await supabase.from("warranty_claim_items").delete().eq("claim_id", claim.id);
    if (e2) { setBusy(false); setMsg(e2.message); return; }
    const rows = items.map((i, n) => ({
      claim_id: claim.id, sort_order: n + 1, product_name: i.product_name || null, brand: i.brand || null, supplier_name: i.supplier_name || null,
      supplier_order_ref: i.supplier_order_ref || null, supplier_model: i.supplier_model || null, client_model: i.client_model || null,
      problem: i.problem || null, qty: Math.max(1, parseInt(i.qty, 10) || 1), received_at: i.received_at || null,
      complaint_date: i.complaint_date || new Date().toISOString().slice(0, 10), media: i.media || [],
      supplier_question: i.supplier_question || null, supplier_answer: i.supplier_answer || null, resolution: i.resolution || null,
    }));
    const { error: e3 } = rows.length ? await supabase.from("warranty_claim_items").insert(rows) : { error: null };
    setBusy(false);
    if (e3) { setMsg(`${e3.message} — reload the claim: the lines may not have been saved.`); return; }
    setStatus(st); onSaved();
  }

  const exportXlsx = async () => {
    setBusy(true);
    try { await exportWarrantyTracker({ claims: [{ claim_number: claim.claim_number, items }], clientName: claim.clients?.company_name, fileName: `Warranty Tracker ${claim.claim_number}` }); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  // The supplier sends the Excel back with Questions/Answer filled in: match rows to our lines
  async function importAnswers(file) {
    setMsg("");
    try {
      const rows = await parseWarrantyTracker(file);
      let hit = 0;
      const next = items.map(it => {
        const row = rows.find(r =>
          (r.client_model && norm(r.client_model) === norm(it.client_model)) ||
          (r.supplier_model && norm(r.supplier_model) === norm(it.supplier_model) && norm(r.product_name) === norm(it.product_name)) ||
          (norm(r.product_name) && norm(r.product_name) === norm(it.product_name) && norm(r.problem) === norm(it.problem)));
        if (!row || (!row.supplier_answer && !row.supplier_question)) return it;
        hit++;
        return { ...it, supplier_question: row.supplier_question || it.supplier_question, supplier_answer: row.supplier_answer || it.supplier_answer };
      });
      setItems(next);
      setMsg(hit ? `Loaded the supplier's text into ${hit} line(s). Review and press Save.` : "No row in that Excel matched this claim's lines.");
    } catch (e) { setMsg(e.message || "Could not read that Excel."); }
  }

  return (
    <div className="border border-bgray-200 dark:border-darkblack-400 rounded-2xl p-4 space-y-4 bg-bgray-50/60 dark:bg-darkblack-500">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-base font-bold text-darkblack-700 dark:text-white">{claim.claim_number} · {claim.clients?.company_name}</p>
          <p className="text-xs text-bgray-500">{claim.tracks?.name || "No order"} · {fmtDay(claim.created_at)} · by {claim.created_by_name || claim.created_by_type}</p>
          {claim.client_notes && <p className="text-sm text-bgray-600 mt-1">“{claim.client_notes}”</p>}
        </div>
        <button onClick={onClose} className="text-sm text-bgray-500 hover:text-bgray-800">✕ Close</button>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div><label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{CLAIM_STATUS[s].label}</option>)}
          </select>
        </div>
        <div><label className={labelCls}>Supplier review date</label><input type="date" className={inputCls} value={review || ""} onChange={e => setReview(e.target.value)} /></div>
        <div><label className={labelCls}>Internal notes (not visible to the client)</label><input className={inputCls} value={staffNotes} onChange={e => setStaffNotes(e.target.value)} /></div>
      </div>

      <ClaimItemsEditor items={items} setItems={setItems} rules={rules} staff />

      {msg && <div className="px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-200">{msg}</div>}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => save()} disabled={busy} className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        <button onClick={exportXlsx} disabled={busy} className="px-4 py-2 text-sm font-medium rounded-lg border border-bgray-300 hover:bg-bgray-100 disabled:opacity-50">Download Excel for supplier</button>
        <input ref={answersRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={e => { if (e.target.files[0]) importAnswers(e.target.files[0]); e.target.value = ""; }} />
        <button onClick={() => answersRef.current?.click()} disabled={busy} className="px-4 py-2 text-sm font-medium rounded-lg border border-bgray-300 hover:bg-bgray-100 disabled:opacity-50">Load supplier's answers (Excel)</button>
        {status === "open" && <button onClick={() => save("sent_supplier")} disabled={busy} className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100">Save · mark sent to supplier</button>}
        <button onClick={async () => { if (!window.confirm(`Delete claim ${claim.claim_number}?`)) return; await supabase.from("warranty_claims").delete().eq("id", claim.id); onSaved(true); }}
          className="ml-auto px-3 py-2 text-xs rounded-lg bg-red-50 text-red-600 border border-red-200">Delete claim</button>
      </div>
    </div>
  );
}

function NewClaim({ clients, onCreated, onCancel }) {
  const [clientId, setClientId] = useState("");
  const [tracks, setTracks] = useState([]);
  const [trackId, setTrackId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    setTrackId(""); setTracks([]);
    if (clientId) supabase.from("tracks").select("id, name").eq("client_id", clientId).order("created_at", { ascending: false }).then(({ data }) => setTracks(data || []));
  }, [clientId]);
  async function create() {
    if (!clientId) { setErr("Choose a client."); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("warranty_claims").insert({
      client_id: clientId, track_id: trackId || null, created_by_type: "staff", created_by_name: u?.user?.email || "staff",
    }).select("id").single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onCreated(data.id);
  }
  return (
    <div className="border border-bgray-200 rounded-xl p-4 flex flex-wrap items-end gap-3 bg-bgray-50/60">
      <div className="min-w-[14rem]"><label className={labelCls}>Client</label>
        <select className={inputCls} value={clientId} onChange={e => setClientId(e.target.value)}>
          <option value="">Choose…</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select></div>
      <div className="min-w-[14rem]"><label className={labelCls}>Order</label>
        <select className={inputCls} value={trackId} onChange={e => setTrackId(e.target.value)}>
          <option value="">No specific order</option>{tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></div>
      <button onClick={create} disabled={busy} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">Create and add products</button>
      <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-bgray-200">Cancel</button>
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  );
}

export default function WarrantiesPage() {
  const [claims, setClaims] = useState(null);
  const [clients, setClients] = useState([]);
  const [rulesByClient, setRulesByClient] = useState({});
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [fStatus, setFStatus] = useState("active");
  const [fClient, setFClient] = useState("");

  const load = useCallback(async () => {
    const [c, cl, r] = await Promise.all([
      supabase.from("warranty_claims").select("*, clients(company_name), tracks(name), warranty_claim_items(*)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("warranty_rules").select("*").order("sort_order"),
    ]);
    if (c.error) { setError(c.error.message.includes("does not exist") ? "Apply the migration 2026-11-22_supabase-warranties.sql in Supabase first." : c.error.message); setClaims([]); return; }
    setError(""); setClaims(c.data || []); setClients(cl.data || []);
    const by = {}; (r.data || []).forEach(x => { (by[x.client_id] ||= []).push(x); });
    setRulesByClient(by);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (claims || []).filter(c =>
    (!fClient || c.client_id === fClient) &&
    (fStatus === "all" || (fStatus === "active" ? ["open", "sent_supplier", "answered"].includes(c.status) : c.status === fStatus))), [claims, fClient, fStatus]);

  const countOpen = (claims || []).filter(c => c.status === "open").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-darkblack-700 dark:text-white">Warranties</h1>
          <p className="text-sm text-bgray-500">Claims from your clients. {countOpen ? <b className="text-blue-600">{countOpen} new</b> : "Nothing new."} Warranty times are set per client in Clients › Warranties.</p>
        </div>
        {!adding && <button onClick={() => setAdding(true)} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg">+ New claim</button>}
      </div>

      {error && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}
      {adding && <NewClaim clients={clients} onCancel={() => setAdding(false)} onCreated={async (id) => { setAdding(false); await load(); setOpenId(id); }} />}

      <div className="flex flex-wrap gap-2">
        <select className={`${inputCls} max-w-[14rem]`} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="active">In progress</option><option value="all">All</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{CLAIM_STATUS[s].label}</option>)}
        </select>
        <select className={`${inputCls} max-w-[14rem]`} value={fClient} onChange={e => setFClient(e.target.value)}>
          <option value="">All clients</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      </div>

      {claims === null ? <p className="text-sm text-bgray-400">Loading…</p> : shown.length === 0 ? (
        <div className="text-center py-14 text-sm text-bgray-500 border border-dashed border-bgray-300 rounded-2xl">No claims here.</div>
      ) : (
        <div className="space-y-3">
          {shown.map(c => {
            const st = CLAIM_STATUS[c.status];
            const rules = rulesByClient[c.client_id] || [];
            const its = c.warranty_claim_items || [];
            const out = its.filter(i => evaluateItem(i, rules).state === "out").length;
            if (openId === c.id) return <ClaimEditor key={c.id} claim={c} rules={rules} onClose={() => setOpenId(null)} onSaved={(closed) => { if (closed) setOpenId(null); load(); }} />;
            return (
              <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full text-left flex items-center gap-3 px-4 py-3 border border-bgray-200 dark:border-darkblack-400 rounded-xl bg-white dark:bg-darkblack-600 hover:bg-bgray-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-darkblack-700 dark:text-white">{c.claim_number} · {c.clients?.company_name} <span className="font-normal text-bgray-500">· {c.tracks?.name || "No order"}</span></p>
                  <p className="text-xs text-bgray-500 truncate">{fmtDay(c.created_at)} · {its.length} line(s) · {its.slice(0, 3).map(i => i.product_name).filter(Boolean).join(", ")}{its.length > 3 ? "…" : ""}</p>
                </div>
                {out > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{out} out of warranty</span>}
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
