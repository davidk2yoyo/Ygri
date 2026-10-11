import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";

const STATUS_CONFIG = {
  pending:    { label: "Pendiente",   color: "bg-gray-100 text-gray-600",   dot: "bg-gray-400" },
  in_transit: { label: "En tránsito", color: "bg-blue-100 text-blue-700",   dot: "bg-blue-500" },
  customs:    { label: "En aduana",   color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  delivered:  { label: "Entregado",   color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  exception:  { label: "Excepción",   color: "bg-red-100 text-red-700",     dot: "bg-red-500" },
};

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

const fmtDate = (d, withTime = false) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
};

// tracking_events comes from the carrier API; accept the common field names
const normalizeEvents = (events) => {
  if (!Array.isArray(events)) return [];
  return events
    .map(e => ({
      time: e.time_iso || e.time_utc || e.time || e.date || e.timestamp || "",
      text: e.description || e.status || e.message || e.event || "",
      place: e.location || e.place || "",
    }))
    .filter(e => e.text)
    .sort((a, b) => String(b.time).localeCompare(String(a.time)));
};

export function ShipmentCard({ row }) {
  const [open, setOpen] = useState(false);
  const events = normalizeEvents(row.tracking_events);
  const isSample = row.kind === "sample";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 text-sm font-mono">{row.tracking_number || "Sin tracking"}</span>
            <StatusBadge status={row.status} />
            {isSample && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Muestra</span>}
          </div>
          {row.description && <p className="text-xs text-gray-600 mb-1">{row.description}</p>}
          {row.status_detail && <p className="text-xs text-gray-500 italic">{row.status_detail}</p>}
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
            {row.carrier && <div><span className="text-gray-400">Carrier:</span> {row.carrier}</div>}
            {row.origin && <div><span className="text-gray-400">Origen:</span> {row.origin}</div>}
            {row.destination && <div><span className="text-gray-400">Destino:</span> {row.destination}</div>}
            {row.estimated_delivery && <div><span className="text-gray-400">ETA:</span> <span className="font-medium">{fmtDate(row.estimated_delivery)}</span></div>}
          </div>
        </div>
        {events.length > 0 && (
          <button onClick={() => setOpen(o => !o)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
            {open ? "Ocultar seguimiento" : `Ver seguimiento (${events.length})`}
          </button>
        )}
      </div>
      {open && (
        <ol className="mt-4 border-l-2 border-gray-100 ml-1 space-y-3">
          {events.map((e, i) => (
            <li key={i} className="relative pl-4">
              <span className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${i === 0 ? "bg-blue-500" : "bg-gray-300"}`} />
              <p className="text-xs text-gray-800">{e.text}</p>
              <p className="text-[11px] text-gray-400">{[fmtDate(e.time, true), e.place].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function MisEnviosPage() {
  const { session } = useClientPortal();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("client_portal_get_shipments", { p_session_id: session.session_id });
      if (error) setError(error.message);
      else setRows(data || []);
      setLoading(false);
    }
    load();
  }, [session.session_id]);

  const filtered = filter === "all" ? rows : rows.filter(r => (r.kind || "shipment") === filter);
  const groups = Object.entries(filtered.reduce((acc, r) => { (acc[r.track_name || "—"] ||= []).push(r); return acc; }, {}));
  const count = (k) => rows.filter(r => (r.kind || "shipment") === k).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mis Envíos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Seguimiento de tus envíos y muestras, por orden</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {[["all", `Todos (${rows.length})`], ["shipment", `Envíos (${count("shipment")})`], ["sample", `Muestras (${count("sample")})`]].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${filter === k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="text-center py-20 text-gray-400"><p className="text-sm">No hay envíos registrados aún</p></div>
      )}

      {!loading && groups.map(([name, list]) => (
        <div key={name} className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Orden · {name}</h2>
          <div className="space-y-3">{list.map(row => <ShipmentCard key={row.id} row={row} />)}</div>
        </div>
      ))}
    </div>
  );
}
