import React, { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "../supabaseClient";
import StageDrawer from "../StageDrawer";

export default function ProjectsPage() {
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState("");
  const [selectedStageId, setSelectedStageId] = useState(null);

  // --- Data: tracks list (left panel) ---
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("v_tracks_overview")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows = (data ?? []).map((r) => ({
          ...r,
          progress_pct: typeof r.progress_pct === "string" ? parseFloat(r.progress_pct) : r.progress_pct,
        }));
        setOverview(rows);
        if (rows.length && !activeTrackId) setActiveTrackId(rows[0].track_id);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- Data: track detail ---
  const loadTrackDetail = async () => {
    if (!activeTrackId) return;
    const { data, error } = await supabase.rpc("get_track_detail", { p_track_id: activeTrackId });
    if (error) { setError(error.message); return; }
    setDetail(data);
  };

  useEffect(() => {
    if (activeTrackId) {
      loadTrackDetail();
    }
  }, [activeTrackId]);

  // --- Build nodes/edges for React Flow ---
  const { nodes, edges } = useMemo(() => {
    if (!detail) return { nodes: [], edges: [] };
    const baseY = 80, gapX = 230;
    const nodes = [];
    const edges = [];

    nodes.push({
      id: `track:${detail.track.id}`,
      position: { x: 20, y: baseY - 60 },
      data: { label: (
        <div className="px-4 py-2 rounded-2xl shadow-sm border bg-white">
          <div className="text-sm opacity-70">{detail.client?.company_name}</div>
          <div className="font-semibold">{detail.track.name}</div>
          <div className="text-xs mt-1">Status: {detail.track.status}</div>
        </div>
      ) },
      draggable: false,
      type: "input",
    });

    detail.stages.forEach((s, idx) => {
      const x = 220 + idx * gapX;
      const y = baseY + (s.status === "done" ? 60 : s.status === "blocked" ? -20 : 0);
      nodes.push({
        id: s.track_stage_id,
        position: { x, y },
        data: { label: (
          <button
            className={`px-4 py-3 rounded-2xl border shadow-sm text-left w-[200px] transition hover:shadow-md ${
              s.status === "done" ? "bg-green-50 border-green-200" :
              s.status === "in_progress" ? "bg-blue-50 border-blue-200" :
              s.status === "blocked" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
            onClick={() => setSelectedStageId(s.track_stage_id)}
          >
            <div className="font-semibold">{s.order_index}. {s.name}</div>
            <div className="text-xs mt-1">Status: {s.status.replaceAll("_"," ")}</div>
            <div className="text-xs">Due: {s.due_date ?? "—"}</div>
            <div className="text-[11px] mt-1 opacity-70">📎 {s.files_count} • ✅ {s.todos_count} • 💬 {s.comments_count}</div>
            <div className="mt-2 text-xs italic">Click to view details →</div>
          </button>
        ) },
      });

      const fromId = idx === 0 ? `track:${detail.track.id}` : detail.stages[idx - 1].track_stage_id;
      edges.push({ id: `${fromId}->${s.track_stage_id}`, source: fromId, target: s.track_stage_id });
    });

    return { nodes, edges };
  }, [detail, busy]);

  return (
    <div className="p-6 font-urbanist">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-darkblack-700 dark:text-white mb-2">Projects</h1>
          <p className="text-bgray-600 dark:text-bgray-300">Manage your client projects and track workflow progress</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-4 xl:col-span-3 space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">Active Projects</h2>
                <span className="text-xs text-bgray-500 dark:text-bgray-400 bg-bgray-100 dark:bg-darkblack-500 px-2 py-1 rounded">
                  {overview.length} total
                </span>
              </div>
              
              {error && (
                <div className="bg-error-50 text-error-300 text-sm p-3 rounded-lg mb-4 border border-error-200">
                  {error}
                </div>
              )}
              
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner h-6 w-6 mr-3"></div>
                  <span className="text-bgray-600 dark:text-bgray-300">Loading projects...</span>
                </div>
              )}
              
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                {!loading && overview.map((t) => (
                  <button
                    key={t.track_id}
                    onClick={() => setActiveTrackId(t.track_id)}
                    className={`w-full text-left p-4 rounded-lg border transition-all duration-200 hover:shadow-sm ${
                      activeTrackId === t.track_id 
                        ? "border-primary bg-success-50 dark:bg-darkblack-500 shadow-sm" 
                        : "border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 hover:border-primary"
                    }`}
                  >
                    <div className="text-xs text-bgray-500 dark:text-bgray-400 mb-1">{t.client_name}</div>
                    <div className="font-semibold text-darkblack-700 dark:text-white mb-2">{t.track_name}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-bgray-600 dark:text-bgray-300">
                        {t.workflow_kind}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded font-medium ${
                        Number(t.progress_pct) >= 80 ? "bg-success-100 text-success-400" :
                        Number(t.progress_pct) >= 50 ? "bg-warning-100 text-warning-300" :
                        "bg-bgray-200 text-bgray-600 dark:bg-darkblack-500 dark:text-bgray-300"
                      }`}>
                        {Number(t.progress_pct).toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-xs text-bgray-500 dark:text-bgray-400 mt-2">
                      Due: {t.next_due_date ?? "No due date"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="col-span-8 xl:col-span-9 space-y-6">
            {/* Workflow Canvas */}
            <div className="card">
              <div className="p-4 border-b border-bgray-200 dark:border-darkblack-400">
                <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">Workflow Canvas</h2>
                <p className="text-sm text-bgray-600 dark:text-bgray-300">Visual representation of project stages</p>
              </div>
              <div className="h-[520px] overflow-hidden">
                <ReactFlow nodes={nodes} edges={edges} fitView>
                  <MiniMap pannable zoomable />
                  <Controls />
                  <Background variant="dots" gap={16} size={1} />
                </ReactFlow>
              </div>
            </div>

            {/* Quick Actions */}
            {detail && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">Quick Actions</h3>
                  <div className="text-xs text-bgray-500 dark:text-bgray-400 bg-bgray-100 dark:bg-darkblack-500 px-3 py-1 rounded-full">
                    {detail.client?.company_name} • {detail.track.name}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Add a quick comment to the active stage..."
                    className="input-field flex-1"
                  />
                  <button
                    onClick={async () => {
                      const active = detail.stages.find((s) => s.status === "in_progress");
                      if (!active || !commentDraft.trim()) return;
                      try {
                        setBusy(true);
                        await supabase.rpc("add_stage_comment", { p_track_stage_id: active.track_stage_id, p_body: commentDraft });
                        const { data } = await supabase.rpc("get_track_detail", { p_track_id: detail.track.id });
                        setDetail(data);
                        setCommentDraft("");
                      } catch (e) { setError(e.message); } finally { setBusy(false); }
                    }}
                    className="btn-primary"
                    disabled={busy || !commentDraft.trim()}
                  >
                    {busy ? (
                      <div className="flex items-center">
                        <div className="spinner h-4 w-4 mr-2"></div>
                        Adding...
                      </div>
                    ) : (
                      "Add Comment"
                    )}
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Stage Drawer */}
        <StageDrawer 
          stageId={selectedStageId}
          onClose={() => setSelectedStageId(null)}
          onUpdate={() => {
            loadTrackDetail(); // Refresh track detail when stage is updated
          }}
        />
      </div>
    </div>
  );
}