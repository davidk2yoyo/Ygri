import React, { useEffect, useState } from "react";
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

export default function DocumentosPage() {
  const { session } = useClientPortal();
  const [rows, setRows] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data, error }, { data: ships }, { data: ords }] = await Promise.all([
        supabase.rpc("client_portal_get_documents", { p_session_id: session.session_id }),
        supabase.rpc("client_portal_get_shipments", { p_session_id: session.session_id }),
        supabase.rpc("client_portal_get_orders", { p_session_id: session.session_id }),
      ]);
      setOrders(ords || []);
      if (error) setError(error.message);
      else setRows(data || []);
      setShipments(ships || []);
      setLoading(false);
    }
    load();
  }, [session.session_id]);

  const filtered = filter === "all" ? rows : rows.filter(r => r.document_type === filter);

  // group: order (project) -> shipment; documents without a project go under "General"
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Facturas, BL, packing lists y certificados de tu importación</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            filter === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          Todos ({rows.length})
        </button>
        {DOC_TYPES.map(type => {
          const count = rows.filter(r => r.document_type === type).length;
          if (count === 0) return null;
          const cfg = TYPE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filter === type ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {cfg.icon} {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No hay documentos disponibles aún</p>
          <p className="text-xs mt-1">Tu asesor los irá publicando a medida que avance el proceso</p>
        </div>
      )}

      {!loading && filtered.length > 0 && groups.map(group => (
        <div key={group.key} className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {group.docs.map(doc => {
            const cfg = TYPE_CONFIG[doc.document_type] || TYPE_CONFIG.other;
            return (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {doc.file_size && (
                        <span className="text-xs text-gray-400">{formatSize(doc.file_size)}</span>
                      )}
                    </div>
                    {doc.reference_number && <p className="text-xs text-gray-500 mt-0.5">Ref: {doc.reference_number}</p>}
                    {doc.notes && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(doc.created_at).toLocaleDateString("es-CO", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-blue-600 transition"
                    title="Descargar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      ))}

      {!loading && filtered.length === 0 && rows.length > 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No hay documentos de este tipo
        </div>
      )}
    </div>
  );
}
