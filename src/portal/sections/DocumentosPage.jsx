import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";

const TYPE_CONFIG = {
  invoice:      { label: "Factura",        icon: "🧾", color: "bg-blue-50 text-blue-700" },
  bl:           { label: "BL",             icon: "🚢", color: "bg-indigo-50 text-indigo-700" },
  packing_list: { label: "Packing List",   icon: "📦", color: "bg-amber-50 text-amber-700" },
  certificate:  { label: "Certificado",    icon: "📋", color: "bg-green-50 text-green-700" },
  proforma:     { label: "Proforma",       icon: "🧾", color: "bg-cyan-50 text-cyan-700" },
  quotation:    { label: "Cotización",     icon: "📋", color: "bg-green-50 text-green-700" },
  client_order: { label: "Pedido",         icon: "🛒", color: "bg-purple-50 text-purple-700" },
  other:        { label: "Otro",           icon: "📄", color: "bg-gray-50 text-gray-600" },
};

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOC_TYPES = Object.keys(TYPE_CONFIG);

const EVENT_LABEL = { uploaded: "subió", shown: "publicó", deleted: "borró" };

function DocCard({ doc, onDelete }) {
  const cfg = TYPE_CONFIG[doc.document_type] || TYPE_CONFIG.other;
  const mine = doc.uploaded_by_type === "client";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${cfg.color}`}>{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{doc.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
            {mine && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">Subido por ti</span>}
            {doc.file_size && <span className="text-xs text-gray-400">{formatSize(doc.file_size)}</span>}
          </div>
          {doc.reference_number && <p className="text-xs text-gray-500 mt-0.5">Ref: {doc.reference_number}</p>}
          {doc.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.notes}</p>}
          <p className="text-xs text-gray-400 mt-1">{new Date(doc.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="Descargar"
            className="flex-shrink-0 w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-blue-600 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </a>
          {mine && onDelete && (
            <button onClick={() => onDelete(doc)} title="Borrar (lo subiste tú)"
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-600 transition">🗑</button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityModal({ events, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <p className="text-base font-semibold text-gray-900">Actividad</p>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-700">×</button>
        </div>
        <div className="p-5 overflow-y-auto">
          {events.length === 0 ? <p className="text-sm text-gray-400">Sin movimientos.</p> : (
            <ol className="space-y-3">
              {events.map(e => (
                <li key={e.id} className="flex gap-3">
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${e.actor_type === "staff" ? "bg-blue-500" : "bg-purple-500"}`} />
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">{e.actor_type === "staff" ? "Interasia" : "Tú"}</span> {EVENT_LABEL[e.kind] || e.kind} <span className="font-medium">«{e.subject}»</span>
                    <span className="text-gray-400"> · {new Date(e.created_at).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocumentosPage() {
  const { session } = useClientPortal();
  const sid = session.session_id;
  const [rows, setRows] = useState([]);
  const [folders, setFolders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("folders"); // folders | orders
  const [folder, setFolder] = useState(null);   // null = raíz
  const [uploading, setUploading] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const [d, f, ships, ords, ev] = await Promise.all([
      supabase.rpc("client_portal_get_documents", { p_session_id: sid }),
      supabase.rpc("client_portal_get_folders", { p_session_id: sid }),
      supabase.rpc("client_portal_get_shipments", { p_session_id: sid }),
      supabase.rpc("client_portal_get_orders", { p_session_id: sid }),
      supabase.rpc("client_portal_get_document_events", { p_session_id: sid }),
    ]);
    if (d.error) setError(d.error.message); else setRows(d.data || []);
    setFolders(f.data || []); setShipments(ships.data || []); setOrders(ords.data || []); setEvents(ev.data || []);
    setLoading(false);
    supabase.rpc("client_portal_mark_documents_seen", { p_session_id: sid }).then(() => {});
  }, [sid]);
  useEffect(() => { load(); }, [load]);

  const upload = async (files) => {
    if (!files.length) return;
    setUploading(true); setError("");
    try {
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `${crypto.randomUUID()}/documento.${ext}`;
        const up = await supabase.storage.from("client-portal-uploads").upload(path, file);
        if (up.error) throw up.error;
        const url = supabase.storage.from("client-portal-uploads").getPublicUrl(path).data.publicUrl;
        const { error: e } = await supabase.rpc("client_portal_add_document", {
          p_session_id: sid, p_folder_id: folder, p_name: file.name.replace(/\.[^.]+$/, ""), p_file_url: url,
          p_file_name: file.name, p_file_size: file.size, p_notes: null,
        });
        if (e) throw e;
      }
      await load();
    } catch (e) { setError(e.message || "No pudimos subir el archivo."); }
    finally { setUploading(false); }
  };

  const del = async (doc) => {
    if (!window.confirm(`¿Borrar «${doc.name}»? No se puede deshacer.`)) return;
    const { error: e } = await supabase.rpc("client_portal_delete_document", { p_session_id: sid, p_document_id: doc.id });
    if (e) setError(e.message); else load();
  };

  const filtered = filter === "all" ? rows : rows.filter(r => r.document_type === filter);

  // ---- vista por orden (proyecto → envío)
  const shipmentTitle = (sh) => `${sh.kind === "sample" ? "Muestra" : "Envío"} ${sh.tracking_number}${sh.description ? ` · ${sh.description}` : ""}`;
  const groups = [];
  orders.forEach(o => {
    const inOrder = filtered.filter(d => d.track_id === o.track_id);
    if (!inOrder.length) return;
    const orderShipments = shipments.filter(sh => sh.track_id === o.track_id);
    orderShipments.forEach(sh => {
      const docs = inOrder.filter(d => d.shipment_id === sh.id);
      if (docs.length) groups.push({ key: `${o.track_id}-${sh.id}`, title: `${o.track_name} › ${shipmentTitle(sh)}`, docs });
    });
    const rest = inOrder.filter(d => !orderShipments.some(sh => sh.id === d.shipment_id));
    if (rest.length) groups.push({ key: `${o.track_id}-rest`, title: o.track_name, docs: rest });
  });
  const general = filtered.filter(d => !orders.some(o => o.track_id === d.track_id));
  if (general.length) groups.push({ key: "general", title: "General", docs: general });

  // ---- vista por carpetas
  const cur = folders.find(f => f.id === folder);
  const parent = cur?.parent_id ? folders.find(f => f.id === cur.parent_id) : null;
  const subfolders = folders.filter(f => (f.parent_id || null) === folder);
  const inFolder = filtered.filter(d => (d.folder_id || null) === folder);
  const countIn = (id) => rows.filter(d => d.folder_id === id || folders.some(c => c.id === d.folder_id && c.parent_id === id)).length;

  const chip = (active) => `px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Facturas, BL, packing lists y certificados de tu importación</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowActivity(true)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Actividad ({events.length})</button>
          {view === "folders" && (
            <>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { upload([...e.target.files]); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {uploading ? "Subiendo…" : "Subir documento"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setView("folders")} className={chip(view === "folders")}>📁 Carpetas</button>
        <button onClick={() => setView("orders")} className={chip(view === "orders")}>📦 Por orden</button>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setFilter("all")} className={chip(filter === "all")}>Todos ({rows.length})</button>
        {DOC_TYPES.map(type => {
          const count = rows.filter(r => r.document_type === type).length;
          if (!count) return null;
          const cfg = TYPE_CONFIG[type];
          return <button key={type} onClick={() => setFilter(type)} className={chip(filter === type)}>{cfg.icon} {cfg.label} ({count})</button>;
        })}
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      {!loading && view === "folders" && (
        <>
          <nav className="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
            <button onClick={() => setFolder(null)} className={folder ? "text-blue-600 hover:underline" : "font-semibold text-gray-900"}>Documentos</button>
            {parent && <><span className="text-gray-300">›</span><button onClick={() => setFolder(parent.id)} className="text-blue-600 hover:underline">{parent.name}</button></>}
            {cur && <><span className="text-gray-300">›</span><span className="font-semibold text-gray-900">{cur.name}</span></>}
          </nav>

          {subfolders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {subfolders.map(f => (
                <button key={f.id} onClick={() => setFolder(f.id)} className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-400 transition">
                  <p className="text-2xl mb-1">📁</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">{countIn(f.id)} documentos</p>
                </button>
              ))}
            </div>
          )}

          {inFolder.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{inFolder.map(d => <DocCard key={d.id} doc={d} onDelete={del} />)}</div>
          ) : subfolders.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">{rows.length === 0 && !folder ? "No hay documentos disponibles aún" : "Esta carpeta está vacía"}</p>
              <p className="text-xs mt-1">Puedes subir tus propios archivos con «Subir documento»</p>
            </div>
          )}
        </>
      )}

      {!loading && view === "orders" && (
        <>
          {groups.map(group => (
            <div key={group.key} className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.title}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{group.docs.map(d => <DocCard key={d.id} doc={d} onDelete={del} />)}</div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No hay documentos {rows.length ? "de este tipo" : "disponibles aún"}</div>}
        </>
      )}

      {showActivity && <ActivityModal events={events} onClose={() => setShowActivity(false)} />}
    </div>
  );
}
