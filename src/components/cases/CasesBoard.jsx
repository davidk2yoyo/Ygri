import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import CaseThread, { AttachPicker } from "./CaseThread";
import CaseLinkFields from "./CaseLinkFields";
import { CASE_KIND, CASE_STATUS, CHANNEL, APPROVAL, fmtDateTime, waitLabel } from "../../lib/cases";

// Staff: every conversation with clients (portal questions, technical queries, design approvals) plus the
// interactions staff log by hand (phone, WhatsApp, e-mail, meeting). With `clientId` it is that client's history.
const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";
const labelCls = "block text-[11px] font-semibold text-bgray-500 mb-1 uppercase tracking-wide";

async function staffName() {
  const { data } = await supabase.auth.getUser();
  const e = data?.user?.email || "Ygri";
  return data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || e.split("@")[0];
}

// A client's orders and ordered products, to link a conversation to
async function loadLinks(clientId) {
  const [t, o] = await Promise.all([
    supabase.from("tracks").select("id, name").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("client_orders").select("track_id, client_order_lines(name, client_ref)").eq("client_id", clientId),
  ]);
  const seen = new Set(), products = [];
  (o.data || []).forEach(ord => (ord.client_order_lines || []).forEach(l => {
    const key = `${(l.name || "").toLowerCase()}|${(l.client_ref || "").toLowerCase()}`;
    if (l.name && !seen.has(key)) { seen.add(key); products.push({ name: l.name, ref: l.client_ref, track_id: ord.track_id }); }
  }));
  return { orders: t.data || [], products };
}

function NewInteraction({ clientId, clients, onCancel, onCreated }) {
  const [cid, setCid] = useState(clientId || "");
  const [links, setLinks] = useState({ orders: [], products: [] });
  const [f, setF] = useState({ kind: "question", channel: "phone", subject: "", body: "", track_id: "", product_name: "", product_ref: "", visible: false, closed: true, attachments: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    setLinks({ orders: [], products: [] });
    if (cid) loadLinks(cid).then(setLinks);
  }, [cid]);

  async function create() {
    if (!cid) { setErr("Choose a client."); return; }
    if (!f.subject.trim()) { setErr("A subject is required."); return; }
    setBusy(true); setErr("");
    const name = await staffName();
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("client_cases").insert({
      client_id: cid, track_id: f.track_id || null, product_name: f.product_name?.trim() || null, product_ref: f.product_ref?.trim() || null, kind: f.kind, subject: f.subject.trim(), channel: f.channel,
      status: f.closed ? "closed" : (f.visible ? "answered" : "open"), visible_to_client: f.visible,
      created_by_type: "staff", created_by_name: name, last_author_type: "staff", last_message_at: now, closed_at: f.closed ? now : null,
    }).select("id").single();
    if (error) { setBusy(false); setErr(error.message); return; }
    if (f.body.trim() || f.attachments.length) {
      const { error: e2 } = await supabase.from("client_case_messages").insert({
        case_id: data.id, author_type: "staff", author_name: name, body: f.body.trim() || null, attachments: f.attachments, is_internal: !f.visible,
      });
      if (e2) { setBusy(false); setErr(e2.message); return; }
    }
    setBusy(false); onCreated(data.id);
  }

  return (
    <div className="border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4 space-y-3 bg-bgray-50/60 dark:bg-darkblack-500">
      <p className="text-sm font-bold text-darkblack-700 dark:text-white">Log an interaction with a client</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {!clientId && <div className="col-span-2"><label className={labelCls}>Client</label>
          <select className={inputCls} value={cid} onChange={e => setCid(e.target.value)}><option value="">Choose…</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>}
        <div><label className={labelCls}>Type</label>
          <select className={inputCls} value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{Object.entries(CASE_KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div><label className={labelCls}>Channel</label>
          <select className={inputCls} value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })}>{Object.entries(CHANNEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="col-span-2"><label className={labelCls}>Subject *</label><input className={inputCls} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /></div>
      </div>
      <CaseLinkFields value={f} onChange={v => setF({ ...f, ...v })} orders={links.orders} products={links.products} />
      <div><label className={labelCls}>What was said / agreed</label><textarea rows={3} className={inputCls} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></div>
      <AttachPicker value={f.attachments} onChange={a => setF({ ...f, attachments: a })} disabled={busy} />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.visible} onChange={e => setF({ ...f, visible: e.target.checked, closed: e.target.checked ? false : true })} />Show to the client in the portal</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.closed} onChange={e => setF({ ...f, closed: e.target.checked })} />Just a record (closed)</label>
      </div>
      {err && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{err}</div>}
      <div className="flex gap-2">
        <button onClick={create} disabled={busy} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-bgray-200">Cancel</button>
      </div>
    </div>
  );
}

function CaseCard({ c, onChanged, showClient }) {
  const [open, setOpen] = useState(false);
  const k = CASE_KIND[c.kind];
  const st = CASE_STATUS[c.status];
  const msgs = (c.client_case_messages || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const wait = waitLabel(c.created_at, c.first_reply_at);
  const [edit, setEdit] = useState(null);
  const [links, setLinks] = useState({ orders: [], products: [] });
  const startEdit = async () => {
    setEdit({ subject: c.subject, track_id: c.track_id || "", product_name: c.product_name || "", product_ref: c.product_ref || "" });
    setLinks(await loadLinks(c.client_id));
  };
  const saveEdit = async () => {
    if (!edit.subject.trim()) return;
    await patch({ subject: edit.subject.trim(), track_id: edit.track_id || null, product_name: edit.product_name?.trim() || null, product_ref: edit.product_ref?.trim() || null });
    setEdit(null);
  };

  const patch = async (p) => { const { error } = await supabase.from("client_cases").update(p).eq("id", c.id); if (error) alert(error.message); else onChanged(); };

  async function send({ body, attachments, internal, askApproval }) {
    const name = await staffName();
    const now = new Date().toISOString();
    const { error } = await supabase.from("client_case_messages").insert({
      case_id: c.id, author_type: "staff", author_name: name, body: body || null, attachments, is_internal: internal,
      kind: askApproval && !internal ? "approval_request" : "text",
    });
    if (error) throw error;
    if (!internal) {
      const up = { status: "answered", last_author_type: "staff", last_message_at: now, closed_at: null };
      if (!c.first_reply_at && c.created_by_type === "client") up.first_reply_at = now;
      if (askApproval) up.approval = "pending";
      const { error: e2 } = await supabase.from("client_cases").update(up).eq("id", c.id);
      if (e2) throw e2;
    }
    onChanged();
  }

  return (
    <div className={`border rounded-xl bg-white dark:bg-darkblack-600 overflow-hidden ${c.status === "open" ? "border-red-300" : "border-bgray-200 dark:border-darkblack-400"}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bgray-50 dark:hover:bg-darkblack-500">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${k.cls}`}>{k.icon} {k.label}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-darkblack-700 dark:text-white truncate">{c.subject}</p>
          <p className="text-xs text-bgray-500 truncate">
            {c.case_number}{showClient ? ` · ${c.clients?.company_name}` : ""} · {CHANNEL[c.channel]} · {c.created_by_type === "staff" ? `logged by ${c.created_by_name}` : `asked by ${c.created_by_name}`} on {fmtDateTime(c.created_at)}
            {!c.visible_to_client && " · internal"}
          </p>
          {(c.tracks?.name || c.product_name) && (
            <p className="text-xs text-bgray-500 truncate">{[c.tracks?.name && `Order: ${c.tracks.name}`, c.product_name && `Product: ${c.product_name}${c.product_ref ? ` (${c.product_ref})` : ""}`].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {c.approval && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${APPROVAL[c.approval].cls}`}>{APPROVAL[c.approval].label}</span>}
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.short}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-bgray-100 dark:border-darkblack-400 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-bgray-500">
            {wait && <span>First reply after <b>{wait}</b></span>}
            {c.closed_at && <span>· closed {fmtDateTime(c.closed_at)}</span>}
            <span className="ml-auto flex gap-2">
              {c.status !== "closed"
                ? <button onClick={() => patch({ status: "closed", closed_at: new Date().toISOString() })} className="px-2.5 py-1 rounded-lg border border-bgray-300 hover:bg-bgray-100">Close</button>
                : <button onClick={() => patch({ status: "open", closed_at: null })} className="px-2.5 py-1 rounded-lg border border-bgray-300 hover:bg-bgray-100">Reopen</button>}
              {c.approval && <button onClick={() => patch({ approval: null })} className="px-2.5 py-1 rounded-lg border border-bgray-300 hover:bg-bgray-100">Clear approval</button>}
              <button onClick={() => patch({ visible_to_client: !c.visible_to_client })} className="px-2.5 py-1 rounded-lg border border-bgray-300 hover:bg-bgray-100">{c.visible_to_client ? "Hide from client" : "Show to client"}</button>
              <button onClick={async () => { if (window.confirm(`Delete ${c.case_number} and its messages?`)) { await supabase.from("client_cases").delete().eq("id", c.id); onChanged(); } }} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200">Delete</button>
            </span>
          </div>
          {edit ? (
            <div className="border border-bgray-200 rounded-xl p-3 bg-bgray-50/60 space-y-3">
              <div><label className={labelCls}>Subject</label><input className={inputCls} value={edit.subject} onChange={e => setEdit({ ...edit, subject: e.target.value })} /></div>
              <CaseLinkFields value={edit} onChange={v => setEdit({ ...edit, ...v })} orders={links.orders} products={links.products} />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg">Save</button>
                <button onClick={() => setEdit(null)} className="px-3 py-1.5 text-sm rounded-lg border border-bgray-300">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={startEdit} className="text-xs font-medium text-primary hover:underline">✏️ Edit subject, order or product</button>
          )}
          <CaseThread staff messages={msgs} approval={c.approval} closed={c.status === "closed"} onSend={send} />
        </div>
      )}
    </div>
  );
}

export default function CasesBoard({ clientId = null }) {
  const [cases, setCases] = useState(null);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [fStatus, setFStatus] = useState("active");
  const [fKind, setFKind] = useState("");
  const [fClient, setFClient] = useState("");

  const load = useCallback(async () => {
    let q = supabase.from("client_cases").select("*, clients(company_name), tracks(name), client_case_messages(*)").order("last_message_at", { ascending: false }).limit(300);
    if (clientId) q = q.eq("client_id", clientId);
    const [c, cl] = await Promise.all([q, clientId ? { data: [] } : supabase.from("clients").select("id, company_name").order("company_name")]);
    if (c.error) { setError(c.error.message.includes("does not exist") ? "Apply the migration 2026-11-23_supabase-client-cases.sql in Supabase first." : c.error.message); setCases([]); return; }
    setError(""); setCases(c.data || []); setClients(cl.data || []);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (cases || []).filter(c =>
    (!fKind || c.kind === fKind) && (!fClient || c.client_id === fClient) &&
    (fStatus === "all" || (fStatus === "active" ? c.status !== "closed" : c.status === fStatus))), [cases, fKind, fClient, fStatus]);
  const waiting = (cases || []).filter(c => c.status === "open").length;

  return (
    <div className={clientId ? "p-6 space-y-4" : "space-y-4"}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {clientId && <h3 className="text-base font-bold text-darkblack-700 dark:text-white">Consultas y preguntas del cliente</h3>}
          <p className="text-sm text-bgray-500">{waiting ? <b className="text-red-600">{waiting} waiting for our reply</b> : "Nothing waiting for a reply."} Every question, comment and interaction stays in the client's history, with date and author.</p>
        </div>
        {!adding && <button onClick={() => setAdding(true)} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg">+ Log interaction</button>}
      </div>
      {error && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}
      {adding && <NewInteraction clientId={clientId} clients={clients} onCancel={() => setAdding(false)} onCreated={() => { setAdding(false); load(); }} />}

      <div className="flex flex-wrap gap-2">
        <select className={`${inputCls} max-w-[13rem]`} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="active">Open</option><option value="all">All</option>
          {Object.entries(CASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.short}</option>)}
        </select>
        <select className={`${inputCls} max-w-[13rem]`} value={fKind} onChange={e => setFKind(e.target.value)}>
          <option value="">All types</option>{Object.entries(CASE_KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {!clientId && <select className={`${inputCls} max-w-[13rem]`} value={fClient} onChange={e => setFClient(e.target.value)}>
          <option value="">All clients</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>}
      </div>

      {cases === null ? <p className="text-sm text-bgray-400">Loading…</p> : shown.length === 0 ? (
        <div className="text-center py-12 text-sm text-bgray-500 border border-dashed border-bgray-300 rounded-2xl">No conversations here.</div>
      ) : (
        <div className="space-y-2.5">{shown.map(c => <CaseCard key={c.id} c={c} showClient={!clientId} onChanged={load} />)}</div>
      )}
    </div>
  );
}
