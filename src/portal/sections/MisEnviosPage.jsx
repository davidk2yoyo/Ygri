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

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function MisEnviosPage() {
  const { session } = useClientPortal();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("client_portal_get_shipments", {
        p_session_id: session.session_id,
      });
      if (error) setError(error.message);
      else setRows(data || []);
      setLoading(false);
    }
    load();
  }, [session.session_id]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mis Envíos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Seguimiento de tus envíos activos</p>
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
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm">No hay envíos registrados aún</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900 text-sm font-mono">
                      {row.tracking_number || "Sin tracking"}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Proyecto: {row.track_name}</p>
                  {row.description && (
                    <p className="text-xs text-gray-600 mb-1">{row.description}</p>
                  )}
                  {row.status_detail && (
                    <p className="text-xs text-gray-500 italic">{row.status_detail}</p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                    {row.carrier && (
                      <div><span className="text-gray-400">Carrier:</span> {row.carrier}</div>
                    )}
                    {row.origin && (
                      <div><span className="text-gray-400">Origen:</span> {row.origin}</div>
                    )}
                    {row.destination && (
                      <div><span className="text-gray-400">Destino:</span> {row.destination}</div>
                    )}
                    {row.estimated_delivery && (
                      <div>
                        <span className="text-gray-400">ETA:</span>{" "}
                        <span className="font-medium">
                          {new Date(row.estimated_delivery).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                  {new Date(row.created_at).toLocaleDateString("es-CO", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
