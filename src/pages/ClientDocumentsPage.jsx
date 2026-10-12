import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sileo } from "sileo";
import { supabase } from "../supabaseClient";
import { CLIENT_DOCUMENT_TYPES as TYPES } from "../components/DocumentCard";

const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-1 focus:ring-primary";
const btn = "px-3 py-1.5 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-xs font-medium text-bgray-600 dark:text-bgray-300 hover:border-primary disabled:opacity-50";
const btnDanger = "px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50";

const KIND_LABEL = {
  uploaded: "subió", deleted: "borró", moved: "movió", edited: "editó", shown: "mostró al cliente", hidden: "ocultó al cliente",
  folder_created: "creó la carpeta", folder_renamed: "editó la carpeta", folder_deleted: "borró la carpeta",
  folder_shown: "mostró la carpeta", folder_hidden: "ocultó la carpeta",
};

const guessType = (name) => {
  const n = name.toLowerCase();
  if (/packing/.test(n)) return "packing_list";
  if (/proforma/.test(n)) return "proforma";
  if (/invoice|factura/.test(n)) return "invoice";
  if (/\bbl\b|bill.?of.?lading|b\/l/.test(n)) return "bl";
  if (/cert/.test(n)) return "certificate";
  if (/quot|cotiz/.test(n)) return "quotation";
  return "other";
};
const fmtSize = (b) => (!b ? "" : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-bgray-200 dark:border-darkblack-400">
          <h3 className="text-base font-bold text-darkblack-700 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none text-bgray-400 hover:text-bgray-700">×</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const Label = ({ children }) => <label className="block text-xs font-medium text-bgray-500 mb-1">{children}</label>;

function FolderModal({ folder, folders, tracks, onClose, onSave }) {
  const [form, setForm] = useState({
    name: folder?.name || "", parent_id: folder?.parent_id || "", track_id: folder?.track_id || "", show_to_client: folder?.show_to_client ?? false,
  });
  const hasChildren = folder && folders.some(f => f.parent_id === folder.id);
  const parents = folders.filter(f => !f.parent_id && f.id !== folder?.id);
  return (
    <Modal title={folder?.id ? "Edit folder" : "New folder"} onClose={onClose}>
      <div className="space-y-4">
        <div><Label>Name</Label><input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Invoices, Order 93…" /></div>
        <div>
          <Label>Inside</Label>
          <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })} disabled={hasChildren} className={inputCls}>
            <option value="">(top level)</option>
            {parents.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {hasChildren && <p className="text-xs text-bgray-400 mt-1">This folder has subfolders, so it stays at the top level.</p>}
        </div>
        <div>
          <Label>Project (optional)</Label>
          <select value={form.track_id} onChange={e => setForm({ ...form, track_id: e.target.value })} className={inputCls}>
            <option value="">No project</option>
            {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <p className="text-xs text-bgray-400 mt-1">Files uploaded to this folder are linked to that project.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-bgray-600">
          <input type="checkbox" checked={form.show_to_client} onChange={e => setForm({ ...form, show_to_client: e.target.checked })} />
          Show this folder to the client
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={btn}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.name.trim()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">Save</button>
        </div>
      </div>
    </Modal>
  );
}

function DocModal({ doc, folders, tracks, shipments, quotations, onClose, onSave }) {
  const [f, setF] = useState({
    name: doc.name || "", document_type: doc.document_type || "other", reference_number: doc.reference_number || "", notes: doc.notes || "",
    folder_id: doc.folder_id || "", track_id: doc.track_id || "", shipment_id: doc.shipment_id || "", quotation_id: doc.quotation_id || "",
  });
  const ships = shipments.filter(s => !f.track_id || s.track_id === f.track_id);
  const quotes = quotations.filter(q => !f.track_id || q.track_id === f.track_id);
  const ordered = folders.filter(x => !x.parent_id).flatMap(p => [p, ...folders.filter(c => c.parent_id === p.id)]);
  return (
    <Modal title="Edit document" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Label>Name</Label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} /></div>
        <div><Label>Type</Label>
          <select value={f.document_type} onChange={e => setF({ ...f, document_type: e.target.value })} className={inputCls}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></div>
        <div><Label>Reference no.</Label><input value={f.reference_number} onChange={e => setF({ ...f, reference_number: e.target.value })} className={inputCls} /></div>
        <div><Label>Folder</Label>
          <select value={f.folder_id} onChange={e => setF({ ...f, folder_id: e.target.value })} className={inputCls}>
            <option value="">(no folder)</option>
            {ordered.map(x => <option key={x.id} value={x.id}>{x.parent_id ? "   ↳ " : ""}{x.name}</option>)}
          </select></div>
        <div><Label>Project</Label>
          <select value={f.track_id} onChange={e => setF({ ...f, track_id: e.target.value, shipment_id: "", quotation_id: "" })} className={inputCls}>
            <option value="">No project</option>
            {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        <div><Label>Shipment</Label>
          <select value={f.shipment_id} onChange={e => setF({ ...f, shipment_id: e.target.value })} className={inputCls}>
            <option value="">None</option>
            {ships.map(s => <option key={s.id} value={s.id}>{s.tracking_number}{s.description ? ` · ${s.description}` : ""}</option>)}
          </select></div>
        <div><Label>Quotation</Label>
          <select value={f.quotation_id} onChange={e => setF({ ...f, quotation_id: e.target.value })} className={inputCls}>
            <option value="">None</option>
            {quotes.map(q => <option key={q.id} value={q.id}>{q.quote_number}</option>)}
          </select></div>
        <div className="col-span-2"><Label>Notes (the client sees these)</Label><textarea rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={inputCls} /></div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className={btn}>Cancel</button>
        <button onClick={() => onSave(f)} disabled={!f.name.trim()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">Save</button>
      </div>
    </Modal>
  );
}

function ActivityModal({ events, onClose }) {
  return (
    <Modal title="Activity" onClose={onClose} wide>
      {events.length === 0 ? <p className="text-sm text-bgray-400">No activity yet.</p> : (
        <ol className="space-y-3">
          {events.map(e => (
            <li key={e.id} className="flex gap-3">
              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${e.actor_type === "client" ? "bg-purple-500" : "bg-blue-500"}`} />
              <div className="text-sm">
                <p className="text-darkblack-700 dark:text-white">
                  <span className="font-semibold">{e.actor_type === "client" ? `Client (${e.actor_name || "portal"})` : (e.actor_name || "Staff")}</span>{" "}
                  {KIND_LABEL[e.kind] || e.kind} <span className="font-medium">«{e.subject}»</span>
                  {e.details?.from !== undefined && e.details?.to !== undefined && <span className="text-bgray-500"> ({e.details.from || "—"} → {e.details.to || "—"})</span>}
                  <span className="text-bgray-400 text-xs"> · {new Date(e.created_at).toLocaleString()}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

export default function ClientDocumentsPage() {
  const [params, setParams] = useSearchParams();
  const clientId = params.get("client") || "";
  const [clients, setClients] = useState([]);
  const [folders, setFolders] = useState([]);
  const [docs, setDocs] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [events, setEvents] = useState([]);
  const [sel, setSel] = useState("all"); // all | root | folder id
  const [picked, setPicked] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [folderModal, setFolderModal] = useState(null); // {folder?, parent_id?}
  const [docModal, setDocModal] = useState(null);
  const [showActivity, setShowActivity] = useState(false);
  const fileRef = useRef(null);
  const actorRef = useRef("Staff");

  useEffect(() => {
    supabase.from("clients").select("id, company_name").order("company_name").then(({ data }) => setClients(data || []));
    supabase.auth.getUser().then(({ data }) => { actorRef.current = data?.user?.email || "Staff"; });
  }, []);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [f, d, t, e] = await Promise.all([
      supabase.from("client_document_folders").select("*").eq("client_id", clientId).order("name"),
      supabase.from("client_documents").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("tracks").select("id, name, show_to_client").eq("client_id", clientId).order("name"),
      supabase.from("client_document_events").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(200),
    ]);
    setFolders(f.data || []); setDocs(d.data || []); setTracks(t.data || []); setEvents(e.data || []);
    const ids = (t.data || []).map(x => x.id);
    if (ids.length) {
      const [s, q] = await Promise.all([
        supabase.from("shipments").select("id, track_id, tracking_number, description").in("track_id", ids),
        supabase.from("quotations").select("id, track_id, quote_number").in("track_id", ids),
      ]);
      setShipments(s.data || []); setQuotations(q.data || []);
    } else { setShipments([]); setQuotations([]); }
    setLoading(false);
    setPicked(new Set());
    // staff has now seen what the client uploaded
    supabase.from("client_documents_seen").upsert({ client_id: clientId, staff_seen_at: new Date().toISOString() }).then(() => {});
  }, [clientId]);
  useEffect(() => { setSel("all"); load(); }, [load]);

  const log = (rows) => supabase.from("client_document_events").insert(
    (Array.isArray(rows) ? rows : [rows]).map(r => ({ client_id: clientId, actor_type: "staff", actor_name: actorRef.current, ...r })));

  const folderById = useMemo(() => Object.fromEntries(folders.map(f => [f.id, f])), [folders]);
  const trackById = useMemo(() => Object.fromEntries(tracks.map(t => [t.id, t])), [tracks]);
  const top = folders.filter(f => !f.parent_id);
  const children = (id) => folders.filter(f => f.parent_id === id);
  const countIn = (id) => docs.filter(d => d.folder_id === id).length;
  const current = sel !== "all" && sel !== "root" ? folderById[sel] : null;

  // is the client really able to see this? (doc + folder chain + project must all be shown)
  const effective = (d) => {
    if (!d.show_to_client) return "hidden";
    const f = d.folder_id ? folderById[d.folder_id] : null;
    const chain = f ? [f, f.parent_id ? folderById[f.parent_id] : null].filter(Boolean) : [];
    if (chain.some(x => !x.show_to_client)) return "folder";
    const tracksToCheck = [d.track_id, ...chain.map(x => x.track_id)].filter(Boolean);
    if (tracksToCheck.some(id => trackById[id] && !trackById[id].show_to_client)) return "project";
    return "visible";
  };

  const shown = useMemo(() => docs.filter(d => sel === "all" ? true : sel === "root" ? !d.folder_id : d.folder_id === sel), [docs, sel]);

  // ---- folders
  const saveFolder = async (form) => {
    const payload = { name: form.name.trim(), parent_id: form.parent_id || null, track_id: form.track_id || null, show_to_client: form.show_to_client };
    try {
      if (folderModal.folder?.id) {
        const old = folderModal.folder;
        const { error } = await supabase.from("client_document_folders").update(payload).eq("id", old.id);
        if (error) throw error;
        const evs = [];
        if (old.show_to_client !== payload.show_to_client) evs.push({ folder_id: old.id, subject: payload.name, kind: payload.show_to_client ? "folder_shown" : "folder_hidden" });
        if (old.name !== payload.name || old.track_id !== payload.track_id || old.parent_id !== payload.parent_id) evs.push({ folder_id: old.id, subject: payload.name, kind: "folder_renamed", details: { from: old.name, to: payload.name } });
        if (evs.length) await log(evs);
      } else {
        const { data, error } = await supabase.from("client_document_folders").insert({ ...payload, client_id: clientId, created_by_name: actorRef.current }).select().single();
        if (error) throw error;
        await log({ folder_id: data.id, subject: payload.name, kind: "folder_created" });
        setSel(data.id);
      }
      setFolderModal(null); load();
    } catch (e) { sileo.error({ title: e.message }); }
  };

  const deleteFolder = async (f) => {
    const subs = children(f.id);
    if (!window.confirm(`Delete folder "${f.name}"${subs.length ? ` and its ${subs.length} subfolder(s)` : ""}?\n\nThe files inside are NOT deleted: they move to "No folder".`)) return;
    const { error } = await supabase.from("client_document_folders").delete().eq("id", f.id);
    if (error) { sileo.error({ title: error.message }); return; }
    await log({ subject: f.name, kind: "folder_deleted" });
    setSel("all"); load();
  };

  // ---- documents
  const uploadFiles = async (files) => {
    if (!files.length) return;
    setBusy(true);
    const folder = current;
    let ok = 0;
    for (const file of files) {
      try {
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("client-documents").upload(path, file);
        if (up.error) throw up.error;
        const url = supabase.storage.from("client-documents").getPublicUrl(path).data.publicUrl;
        const base = file.name.replace(/\.[^.]+$/, "");
        const { data, error } = await supabase.from("client_documents").insert({
          client_id: clientId, name: base, document_type: guessType(file.name), file_url: url, file_name: file.name, file_size: file.size,
          folder_id: folder?.id || null, track_id: folder?.track_id || null, show_to_client: folder?.show_to_client ?? false,
          uploaded_by_type: "staff", uploaded_by_name: actorRef.current,
        }).select().single();
        if (error) throw error;
        await log({ document_id: data.id, folder_id: folder?.id || null, subject: base, kind: "uploaded", details: { file_name: file.name } });
        ok++;
      } catch (e) { sileo.error({ title: `${file.name}: ${e.message}` }); }
    }
    setBusy(false);
    if (ok) sileo.success({ title: `${ok} file(s) uploaded`, description: folder?.show_to_client ? "Visible to the client (the folder is shown)" : "Hidden from the client until you show them" });
    load();
  };

  const toggleVisible = async (d) => {
    const next = !d.show_to_client;
    const { error } = await supabase.from("client_documents").update({ show_to_client: next }).eq("id", d.id);
    if (error) { sileo.error({ title: error.message }); return; }
    await log({ document_id: d.id, folder_id: d.folder_id, subject: d.name, kind: next ? "shown" : "hidden" });
    load();
  };

  const removeDocs = async (list) => {
    if (!window.confirm(`Delete ${list.length} document(s)? This cannot be undone.`)) return;
    const paths = list.map(d => d.file_url?.split("/client-documents/")[1]).filter(Boolean);
    const { error } = await supabase.from("client_documents").delete().in("id", list.map(d => d.id));
    if (error) { sileo.error({ title: error.message }); return; }
    if (paths.length) supabase.storage.from("client-documents").remove(paths).then(() => {});
    await log(list.map(d => ({ folder_id: d.folder_id, subject: d.name, kind: "deleted" })));
    load();
  };

  const saveDoc = async (f) => {
    const d = docModal;
    const patch = {
      name: f.name.trim(), document_type: f.document_type, reference_number: f.reference_number.trim() || null, notes: f.notes.trim() || null,
      folder_id: f.folder_id || null, track_id: f.track_id || null, shipment_id: f.shipment_id || null, quotation_id: f.quotation_id || null,
    };
    const { error } = await supabase.from("client_documents").update(patch).eq("id", d.id);
    if (error) { sileo.error({ title: error.message }); return; }
    const evs = [{ document_id: d.id, folder_id: patch.folder_id, subject: patch.name, kind: "edited" }];
    if ((d.folder_id || null) !== patch.folder_id) {
      evs.push({ document_id: d.id, folder_id: patch.folder_id, subject: patch.name, kind: "moved", details: { from: folderById[d.folder_id]?.name || "No folder", to: folderById[patch.folder_id]?.name || "No folder" } });
    }
    await log(evs);
    setDocModal(null); load();
  };

  const bulk = async (patch, kind, extra = {}) => {
    const list = docs.filter(d => picked.has(d.id));
    if (!list.length) return;
    setBusy(true);
    const { error } = await supabase.from("client_documents").update(patch).in("id", list.map(d => d.id));
    setBusy(false);
    if (error) { sileo.error({ title: error.message }); return; }
    await log(list.map(d => ({ document_id: d.id, folder_id: patch.folder_id ?? d.folder_id, subject: d.name, kind, ...(extra.details ? { details: extra.details } : {}) })));
    load();
  };

  const folderOptions = top.flatMap(p => [p, ...children(p.id)]);

  // ---- render
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Client Documents</h1>
          <p className="text-sm text-bgray-500 mt-0.5">Organize files in folders per client, link them to projects, and choose what the client sees.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={clientId} onChange={e => setParams(e.target.value ? { client: e.target.value } : {})} className={`${inputCls} min-w-[240px]`}>
            <option value="">Select a client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          {clientId && <button onClick={() => setShowActivity(true)} className={btn}>Activity ({events.length})</button>}
        </div>
      </div>

      {!clientId ? (
        <div className="text-center py-24 text-bgray-400 text-sm">Pick a client to see and organize their documents.</div>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
          {/* folder tree */}
          <aside className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-semibold uppercase text-bgray-500">Folders</p>
              <button onClick={() => setFolderModal({})} className="text-xs font-semibold text-primary">+ New</button>
            </div>
            {[["all", "All files", docs.length], ["root", "No folder", docs.filter(d => !d.folder_id).length]].map(([k, label, n]) => (
              <button key={k} onClick={() => setSel(k)} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm ${sel === k ? "bg-primary/10 text-primary font-semibold" : "text-bgray-600 hover:bg-bgray-50 dark:hover:bg-darkblack-500"}`}>
                <span>{label}</span><span className="text-xs text-bgray-400">{n}</span>
              </button>
            ))}
            <div className="mt-1">
              {top.map(f => (
                <div key={f.id}>
                  <FolderRow f={f} depth={0} active={sel === f.id} onClick={() => setSel(f.id)} n={countIn(f.id)} track={trackById[f.track_id]} />
                  {children(f.id).map(c => <FolderRow key={c.id} f={c} depth={1} active={sel === c.id} onClick={() => setSel(c.id)} n={countIn(c.id)} track={trackById[c.track_id]} />)}
                </div>
              ))}
              {top.length === 0 && <p className="text-xs text-bgray-400 px-2 py-3">No folders yet.</p>}
            </div>
          </aside>

          {/* files */}
          <section onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); uploadFiles([...e.dataTransfer.files]); }}
            className={`bg-white dark:bg-darkblack-600 border rounded-xl p-4 ${drag ? "border-primary ring-2 ring-primary/30" : "border-bgray-200 dark:border-darkblack-400"}`}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <p className="text-base font-bold text-darkblack-700 dark:text-white">{current ? (current.parent_id ? `${folderById[current.parent_id]?.name} › ` : "") + current.name : sel === "root" ? "No folder" : "All files"}</p>
                {current && (
                  <p className="text-xs text-bgray-500 mt-0.5">
                    {current.show_to_client ? "Shown to the client" : "Hidden from the client"}
                    {current.track_id && trackById[current.track_id] ? ` · linked to project ${trackById[current.track_id].name}` : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {current && (
                  <>
                    {!current.parent_id && <button onClick={() => setFolderModal({ parent_id: current.id })} className={btn}>+ Subfolder</button>}
                    <button onClick={() => setFolderModal({ folder: current })} className={btn}>Edit folder</button>
                    <button onClick={() => deleteFolder(current)} className={btnDanger}>Delete folder</button>
                  </>
                )}
                <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { uploadFiles([...e.target.files]); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold disabled:opacity-50">{busy ? "Uploading…" : "Upload files"}</button>
              </div>
            </div>

            {picked.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                <span className="text-xs font-semibold text-darkblack-700 dark:text-white">{picked.size} selected</span>
                <select defaultValue="" onChange={e => { const v = e.target.value; e.target.value = ""; if (v) bulk({ folder_id: v === "none" ? null : v }, "moved", { details: { from: "…", to: v === "none" ? "No folder" : folderById[v]?.name } }); }} className={`${btn} bg-transparent`}>
                  <option value="">Move to…</option><option value="none">No folder</option>
                  {folderOptions.map(f => <option key={f.id} value={f.id}>{f.parent_id ? "   ↳ " : ""}{f.name}</option>)}
                </select>
                <select defaultValue="" onChange={e => { const v = e.target.value; e.target.value = ""; if (v) bulk({ track_id: v === "none" ? null : v, shipment_id: null, quotation_id: null }, "edited"); }} className={`${btn} bg-transparent`}>
                  <option value="">Link to project…</option><option value="none">No project</option>
                  {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button onClick={() => bulk({ show_to_client: true }, "shown")} className={btn}>Show to client</button>
                <button onClick={() => bulk({ show_to_client: false }, "hidden")} className={btn}>Hide</button>
                <button onClick={() => removeDocs(docs.filter(d => picked.has(d.id)))} className={btnDanger}>Delete</button>
                <button onClick={() => setPicked(new Set())} className="text-xs text-bgray-500 ml-auto">Clear</button>
              </div>
            )}

            {loading ? <p className="text-sm text-bgray-500 py-8 text-center">Loading…</p> : shown.length === 0 ? (
              <div className="text-center py-16 text-bgray-400 text-sm border-2 border-dashed border-bgray-200 dark:border-darkblack-400 rounded-xl">
                Drag files here or use “Upload files”.{current && !current.show_to_client && <p className="text-xs mt-1">This folder is hidden: what you upload stays hidden until you show it.</p>}
              </div>
            ) : (
              <div className="divide-y divide-bgray-100 dark:divide-darkblack-500">
                {shown.map(d => {
                  const eff = effective(d);
                  const t = TYPES[d.document_type] || TYPES.other;
                  const sh = shipments.find(s => s.id === d.shipment_id);
                  return (
                    <div key={d.id} className="flex items-center gap-3 py-2.5">
                      <input type="checkbox" checked={picked.has(d.id)} onChange={() => setPicked(p => { const n = new Set(p); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })} />
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${t.color}`}>{t.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-darkblack-700 dark:text-white truncate">{d.name}
                          {d.uploaded_by_type === "client" && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">FROM CLIENT</span>}
                        </p>
                        <p className="text-xs text-bgray-500 truncate">
                          {[d.reference_number && `Ref ${d.reference_number}`, d.track_id && trackById[d.track_id]?.name, sh && `Shipment ${sh.tracking_number}`, fmtSize(d.file_size), fmtDate(d.created_at)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <button onClick={() => toggleVisible(d)} title="Show / hide for the client"
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${eff === "visible" ? "bg-green-100 text-green-700" : eff === "hidden" ? "bg-bgray-100 text-bgray-500" : "bg-amber-100 text-amber-700"}`}>
                        {eff === "visible" ? "Visible" : eff === "hidden" ? "Hidden" : eff === "folder" ? "Hidden by folder" : "Hidden by project"}
                      </button>
                      <a href={d.file_url} target="_blank" rel="noreferrer" className={btn}>Open</a>
                      <button onClick={() => setDocModal(d)} className={btn}>Edit</button>
                      <button onClick={() => removeDocs([d])} className={btnDanger} title="Delete">🗑</button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {folderModal && <FolderModal folder={folderModal.folder || (folderModal.parent_id ? { parent_id: folderModal.parent_id, show_to_client: false } : null)}
        folders={folders} tracks={tracks} onClose={() => setFolderModal(null)} onSave={(form) => saveFolder(form)} />}
      {docModal && <DocModal doc={docModal} folders={folders} tracks={tracks} shipments={shipments} quotations={quotations} onClose={() => setDocModal(null)} onSave={saveDoc} />}
      {showActivity && <ActivityModal events={events} onClose={() => setShowActivity(false)} />}
    </div>
  );
}

function FolderRow({ f, depth, active, onClick, n, track }) {
  return (
    <button onClick={onClick} style={{ paddingLeft: 8 + depth * 16 }}
      className={`w-full flex items-center justify-between gap-2 pr-2 py-1.5 rounded-lg text-sm ${active ? "bg-primary/10 text-primary font-semibold" : "text-bgray-600 hover:bg-bgray-50 dark:hover:bg-darkblack-500"}`}>
      <span className="flex items-center gap-1.5 min-w-0">
        <span>{depth ? "↳" : "📁"}</span>
        <span className="truncate">{f.name}</span>
        {track && <span className="text-[9px] font-bold px-1 rounded bg-blue-100 text-blue-700 flex-shrink-0" title={`Project: ${track.name}`}>PRJ</span>}
      </span>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`w-2 h-2 rounded-full ${f.show_to_client ? "bg-green-500" : "bg-bgray-300"}`} title={f.show_to_client ? "Shown to client" : "Hidden"} />
        <span className="text-xs text-bgray-400">{n}</span>
      </span>
    </button>
  );
}
