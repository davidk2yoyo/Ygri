import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";

function StatCard({ label, value, icon, color, to }) {
  const content = (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition ${to ? "cursor-pointer" : ""}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-8 text-gray-400">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

const STATUS_COLOR = {
  in_transit: "bg-blue-100 text-blue-700",
  customs:    "bg-amber-100 text-amber-700",
  pending:    "bg-gray-100 text-gray-600",
  delivered:  "bg-green-100 text-green-700",
  exception:  "bg-red-100 text-red-700",
};
const STATUS_LABEL = {
  in_transit: "En tránsito", customs: "En aduana",
  pending: "Pendiente",     delivered: "Entregado", exception: "Excepción",
};
const STAGE_COLOR = {
  done:        "bg-green-500",
  in_progress: "bg-blue-500",
  blocked:     "bg-red-500",
  pending:     "bg-gray-300",
};

export default function DashboardPage() {
  const { session } = useClientPortal();
  const [summary, setSummary] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const sid = session.session_id;
      const [sumRes, shipRes, trackRes] = await Promise.all([
        supabase.rpc("client_portal_get_dashboard", { p_session_id: sid }),
        supabase.rpc("client_portal_get_shipments",  { p_session_id: sid }),
        supabase.rpc("client_portal_get_tracks",     { p_session_id: sid }),
      ]);
      if (sumRes.data?.length)  setSummary(sumRes.data[0]);
      if (shipRes.data)         setShipments(shipRes.data.slice(0, 3));
      if (trackRes.data)        setTracks(trackRes.data.slice(0, 2));
      setLoading(false);
    }
    load();
  }, [session.session_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {session.client_name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Aquí tienes un resumen de tus operaciones activas
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Envíos activos"
          value={summary?.active_shipments ?? 0}
          to="/clientes/envios"
          color="bg-blue-50"
          icon={
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <StatCard
          label="Cotizaciones"
          value={summary?.total_quotations ?? 0}
          to="/clientes/ordenes"
          color="bg-purple-50"
          icon={
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard
          label="Documentos"
          value={summary?.total_documents ?? 0}
          to="/clientes/documentos"
          color="bg-amber-50"
          icon={
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Reportes"
          value={summary?.total_reports ?? 0}
          to="/clientes/reportes"
          color="bg-green-50"
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent shipments */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Envíos recientes</h2>
            <Link to="/clientes/envios" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
          </div>
          {shipments.length === 0
            ? <EmptyState icon="🚢" text="Sin envíos registrados" />
            : (
              <div className="space-y-3">
                {shipments.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.reference || "Sin referencia"}</p>
                      <p className="text-xs text-gray-400 truncate">{s.track_name}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ml-3 flex-shrink-0 ${STATUS_COLOR[s.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Active tracks / stages */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Estado de tus proyectos</h2>
            <Link to="/clientes/carga" className="text-xs text-blue-600 hover:underline">Ver detalle →</Link>
          </div>
          {tracks.length === 0
            ? <EmptyState icon="📦" text="Sin proyectos visibles aún" />
            : (
              <div className="space-y-5">
                {tracks.map(track => {
                  const stages = Array.isArray(track.stages) ? track.stages : JSON.parse(track.stages || "[]");
                  const done = stages.filter(s => s.status === "done").length;
                  const pct = stages.length ? Math.round((done / stages.length) * 100) : 0;
                  return (
                    <div key={track.track_id}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900">{track.track_name}</p>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {stages.map(s => (
                          <div key={s.id} title={s.name}
                            className={`h-2 flex-1 min-w-[8px] rounded-full ${STAGE_COLOR[s.status] || "bg-gray-200"}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
