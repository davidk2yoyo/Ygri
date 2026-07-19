import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";

const STATUS_CONFIG = {
  draft:     { label: "Borrador",   color: "bg-gray-100 text-gray-600" },
  pending:   { label: "Pendiente",  color: "bg-amber-100 text-amber-700" },
  approved:  { label: "Aprobado",   color: "bg-green-100 text-green-700" },
  rejected:  { label: "Rechazado",  color: "bg-red-100 text-red-700" },
  completed: { label: "Completado", color: "bg-blue-100 text-blue-700" },
};

export default function MisReportesPage() {
  const { session } = useClientPortal();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("client_portal_get_reports", {
        p_session_id: session.session_id,
      });
      if (error) setError(error.message);
      else setReports(data || []);
      setLoading(false);
    }
    load();
  }, [session.session_id]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mis Reportes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Reportes de inspección de tus productos</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Sin reportes disponibles</p>
          <p className="text-sm text-gray-400 mt-1">Aquí verás los reportes de inspección de tus pedidos</p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map(r => {
            const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-gray-400">{r.report_number}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{r.title}</h3>
                    {r.supplier_name && (
                      <p className="text-sm text-gray-500 mt-0.5">Proveedor: {r.supplier_name}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Proyecto: {r.track_name}</p>
                  </div>

                  <div className="text-right flex-shrink-0 space-y-2">
                    {r.visit_date && (
                      <div>
                        <p className="text-xs text-gray-400">Fecha visita</p>
                        <p className="text-sm font-medium text-gray-700">
                          {new Date(r.visit_date).toLocaleDateString("es-CO", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                    {r.report_number && (
                      <a
                        href={`/r/${r.report_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver reporte
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
