import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";

const STAGE_STYLE = {
  done:        { dot: "bg-green-500 border-green-500", text: "text-green-700", badge: "bg-green-100 text-green-700", label: "Completado" },
  in_progress: { dot: "bg-blue-500 border-blue-500",  text: "text-blue-700",  badge: "bg-blue-100 text-blue-700",  label: "En proceso" },
  blocked:     { dot: "bg-red-500 border-red-500",    text: "text-red-700",   badge: "bg-red-100 text-red-700",   label: "Bloqueado"  },
  pending:     { dot: "bg-white border-gray-300",     text: "text-gray-500",  badge: "bg-gray-100 text-gray-500", label: "Pendiente"  },
};

const TRACK_STATUS_BADGE = {
  active:    "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  on_hold:   "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

function StageLine({ stage, isLast }) {
  const style = STAGE_STYLE[stage.status] || STAGE_STYLE.pending;
  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-gray-100" />
      )}

      {/* Dot */}
      <div className="flex-shrink-0 mt-1">
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 relative
          ${stage.status === "done" ? "bg-green-500 border-green-500" :
            stage.status === "in_progress" ? "bg-blue-500 border-blue-500" :
            stage.status === "blocked" ? "bg-red-500 border-red-500" :
            "bg-white border-gray-300"}`}>
          {stage.status === "done" && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {stage.status === "in_progress" && (
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          )}
          {stage.status === "blocked" && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {stage.status === "pending" && (
            <span className="text-xs text-gray-400 font-medium">{stage.order_index}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold ${
            stage.status === "done" ? "text-green-700" :
            stage.status === "in_progress" ? "text-blue-700" :
            stage.status === "blocked" ? "text-red-700" :
            "text-gray-500"
          }`}>
            {stage.name}
          </p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${style.badge}`}>
            {style.label}
          </span>
        </div>
        {stage.due_date && (
          <p className="text-xs text-gray-400 mt-0.5">
            Fecha estimada: {new Date(stage.due_date).toLocaleDateString("es-CO", {
              day: "2-digit", month: "long", year: "numeric",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function EstadoCargaPage() {
  const { session } = useClientPortal();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("client_portal_get_tracks", {
        p_session_id: session.session_id,
      });
      if (error) setError(error.message);
      else {
        const rows = (data || []).map(r => ({
          ...r,
          stages: typeof r.stages === "string" ? JSON.parse(r.stages) : (r.stages || []),
        }));
        setTracks(rows);
        // Auto-expand the first active track
        const first = rows.find(r => r.status === "active") || rows[0];
        if (first) setExpanded({ [first.track_id]: true });
      }
      setLoading(false);
    }
    load();
  }, [session.session_id]);

  const toggle = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Estado de tu Carga</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Seguimiento en tiempo real de tus proyectos e importaciones
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {!loading && !error && tracks.length === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Sin proyectos visibles aún</p>
          <p className="text-sm text-gray-400 mt-1">Tu asesor habilitará el seguimiento cuando esté disponible</p>
        </div>
      )}

      <div className="space-y-4">
        {tracks.map(track => {
          const stages = track.stages || [];
          const done = stages.filter(s => s.status === "done").length;
          const total = stages.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const isOpen = !!expanded[track.track_id];
          const currentStage = stages.find(s => s.status === "in_progress") || stages.find(s => s.status === "blocked");

          return (
            <div key={track.track_id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Track header */}
              <button
                onClick={() => toggle(track.track_id)}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{track.track_name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TRACK_STATUS_BADGE[track.status] || "bg-gray-100 text-gray-600"}`}>
                      {track.workflow_kind}
                    </span>
                  </div>
                  {currentStage && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      En proceso: <span className="font-medium">{currentStage.name}</span>
                    </p>
                  )}
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="hidden sm:block">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 font-medium w-8 text-right">{pct}%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 text-right">{done}/{total} etapas</p>
                  </div>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Stages timeline */}
              {isOpen && (
                <div className="px-5 pt-2 pb-4 border-t border-gray-100">
                  {stages.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Sin etapas registradas</p>
                  ) : (
                    <div className="mt-4">
                      {stages.map((stage, i) => (
                        <StageLine key={stage.id} stage={stage} isLast={i === stages.length - 1} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
