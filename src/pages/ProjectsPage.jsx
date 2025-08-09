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
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-3 space-y-2">
            <div className="text-lg font-semibold mb-2">Projects</div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {loading && <div>Loading…</div>}
            {!loading && overview.map((t) => (
              <button
                key={t.track_id}
                onClick={() => setActiveTrackId(t.track_id)}
                className={`w-full text-left p-3 rounded-xl border bg-white hover:shadow-sm transition ${activeTrackId === t.track_id ? "border-blue-300" : "border-slate-200"}`}
              >
                <div className="text-sm opacity-70">{t.client_name}</div>
                <div className="font-semibold">{t.track_name}</div>
                <div className="text-xs mt-1">{t.workflow_kind} • {Number(t.progress_pct).toFixed(1)}%</div>
                <div className="text-xs">Next due: {t.next_due_date ?? "—"}</div>
              </button>
            ))}
          </aside>

          <main className="col-span-9">
            <div className="h-[520px] rounded-xl border bg-white overflow-hidden">
              <ReactFlow nodes={nodes} edges={edges} fitView>
                <MiniMap pannable zoomable />
                <Controls />
                <Background variant="dots" gap={16} size={1} />
              </ReactFlow>
            </div>

            {detail && (
              <div className="mt-4 p-3 rounded-xl border bg-white">
                <div className="text-sm font-semibold mb-2">Quick comment on active stage</div>
                <div className="flex gap-2">
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Write a short note…"
                    className="flex-1 px-3 py-2 rounded-lg border"
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
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                    disabled={busy || !commentDraft.trim()}
                  >Add comment</button>
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