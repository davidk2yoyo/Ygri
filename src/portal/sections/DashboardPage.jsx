import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";
import QuickComment from "../components/QuickComment";
import { STAGE_NAME_ES } from "../lib/stageNames";

const TONES = {
  blue:   { bg: "bg-blue-50",   text: "text-blue-600",   ring: "group-hover:ring-blue-200" },
  purple: { bg: "bg-violet-50", text: "text-violet-600", ring: "group-hover:ring-violet-200" },
  amber:  { bg: "bg-amber-50",  text: "text-amber-600",  ring: "group-hover:ring-amber-200" },
  green:  { bg: "bg-emerald-50", text: "text-emerald-600", ring: "group-hover:ring-emerald-200" },
};

function StatCard({ label, value, icon, tone = "blue", to }) {
  const t = TONES[tone];
  const content = (
    <div className={`group relative bg-white rounded-2xl border border-slate-100 shadow-sm p-5 transition-all ring-1 ring-transparent hover:shadow-md hover:-translate-y-0.5 ${t.ring}`}>
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${t.bg} ${t.text}`}>{icon}</div>
        {to && (
          <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-900 mt-4">{value ?? "—"}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  );
  return to ? <Link to={to} className="block">{content}</Link> : content;
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">{icon}</div>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

const ICON = {
  box: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  clip: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  doc: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  chart: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" /></svg>,
  upload: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  chat: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
};

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
  const { session, can } = useClientPortal();
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

  const today = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-6 sm:p-8 shadow-lg shadow-blue-900/10">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-24 -bottom-20 w-56 h-56 rounded-full bg-indigo-400/20 blur-2xl" />
        <div className="relative">
          <p className="text-xs font-medium text-blue-100/80 first-letter:uppercase">{today}</p>
          <h1 className="!text-white !text-2xl sm:!text-3xl mt-1">{greet}, {session.client_name}</h1>
          <p className="text-sm text-blue-100/90 mt-1.5 max-w-xl">Aquí tienes un resumen de tus operaciones activas.</p>
          <div className="flex flex-wrap gap-2.5 mt-5">
            {can("pedidos") && (
              <Link to="/clientes/pedidos" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-blue-700 text-sm font-semibold shadow-sm hover:bg-blue-50 transition">
                {ICON.upload} Subir pedido
              </Link>
            )}
            {can("consultas") && (
              <Link to="/clientes/consultas" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 text-white text-sm font-semibold ring-1 ring-white/25 hover:bg-white/25 transition">
                {ICON.chat} Hacer una consulta
              </Link>
            )}
          </div>
        </div>
      </div>

      {can("consultas") && <QuickComment />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {can("envios") && <StatCard label="Envíos activos" value={summary?.active_shipments ?? 0} to="/clientes/envios" tone="blue" icon={ICON.box} />}
        {can("prices") && <StatCard label="Cotizaciones" value={summary?.total_quotations ?? 0} to="/clientes/ordenes" tone="purple" icon={ICON.clip} />}
        {can("documentos") && <StatCard label="Documentos" value={summary?.total_documents ?? 0} to="/clientes/documentos" tone="amber" icon={ICON.doc} />}
        {can("reportes") && <StatCard label="Reportes" value={summary?.total_reports ?? 0} to="/clientes/reportes" tone="green" icon={ICON.chart} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {can("envios") && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Envíos recientes</h2>
            <Link to="/clientes/envios" className="text-xs font-medium text-blue-600 hover:text-blue-700">Ver todos →</Link>
          </div>
          {shipments.length === 0
            ? <EmptyState icon={ICON.box} text="Sin envíos registrados" />
            : (
              <div className="divide-y divide-slate-100">
                {shipments.map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center flex-shrink-0">{ICON.box}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{s.reference || s.tracking_number || "Sin referencia"}</p>
                      <p className="text-xs text-slate-400 truncate">{s.track_name}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_COLOR[s.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
        )}

        {can("ordenes") && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Estado de tus proyectos</h2>
            <Link to="/clientes/ordenes" className="text-xs font-medium text-blue-600 hover:text-blue-700">Ver detalle →</Link>
          </div>
          {tracks.length === 0
            ? <EmptyState icon={ICON.clip} text="Sin proyectos visibles aún" />
            : (
              <div className="space-y-5 pt-1">
                {tracks.map(track => {
                  const stages = Array.isArray(track.stages) ? track.stages : JSON.parse(track.stages || "[]");
                  const done = stages.filter(s => s.status === "done").length;
                  const pct = stages.length ? Math.round((done / stages.length) * 100) : 0;
                  const current = stages.find(s => s.status === "in_progress");
                  return (
                    <Link key={track.track_id} to="/clientes/ordenes" className="block group">
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 transition">{track.track_name}</p>
                        <span className="text-sm font-bold text-slate-700">{pct}%</span>
                      </div>
                      <div className="flex gap-1">
                        {stages.map(s => (
                          <div key={s.id} title={s.name}
                            className={`h-2 flex-1 min-w-[8px] rounded-full ${STAGE_COLOR[s.status] || "bg-gray-200"} ${s.status === "in_progress" ? "animate-pulse" : ""}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">{current ? `En curso: ${STAGE_NAME_ES[current.name] || current.name}` : `${done} de ${stages.length} etapas completadas`}</p>
                    </Link>
                  );
                })}
              </div>
            )}
        </div>
        )}
      </div>
    </div>
  );
}
