import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";

const CURRENCY_SYMBOL = { USD: "$", COP: "$", EUR: "€" };

function StatusBadge({ type }) {
  const map = {
    product: { label: "Producto", color: "bg-blue-100 text-blue-700" },
    service: { label: "Servicio", color: "bg-purple-100 text-purple-700" },
  };
  const s = map[type] || { label: type, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

export default function MisOrdenesPage() {
  const { session } = useClientPortal();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("client_portal_get_quotations", {
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
        <h1 className="text-xl font-bold text-gray-900">Mis Órdenes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cotizaciones y proyectos activos</p>
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No hay órdenes registradas aún</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">
                      {row.quote_number || "Sin número"}
                    </span>
                    <StatusBadge type={row.type} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Proyecto: {row.track_name}</p>
                  {row.incoterm && (
                    <p className="text-xs text-gray-400 mt-0.5">Incoterm: {row.incoterm}</p>
                  )}
                  {row.delivery_time && (
                    <p className="text-xs text-gray-400">Tiempo de entrega: {row.delivery_time}</p>
                  )}
                  {row.notes && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{row.notes}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">
                    {CURRENCY_SYMBOL[row.currency] || ""}
                    {Number(row.total_amount || 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-400">{row.currency}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(row.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
