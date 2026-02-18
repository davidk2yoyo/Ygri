import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { useTranslation } from "react-i18next";

// ─── Helpers ────────────────────────────────────────────────────────────────

function isImageFile(filePath) {
  const ext = (filePath || "").split(".").pop().toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

function getFileIcon(filePath) {
  const ext = (filePath || "").split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["zip", "rar", "7z"].includes(ext)) return "📦";
  return "📎";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Status badge colours — same palette used across the app
const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-blue-100 text-blue-700",
  planning: "bg-violet-100 text-violet-700",
  on_hold: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
  review: "bg-cyan-100 text-cyan-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
};

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${color}`}>
      {(status || "—").replace("_", " ")}
    </span>
  );
}

// ─── Preview Modal (reuses same logic as StageDrawer) ───────────────────────

function PreviewModal({ file, onClose, onDownload }) {
  const url = useMemo(() => {
    if (!file) return null;
    const { data } = supabase.storage.from("crm-files").getPublicUrl(file.file_path);
    return data.publicUrl;
  }, [file]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="max-w-5xl w-full mx-4 bg-white dark:bg-darkblack-600 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bgray-200 dark:border-darkblack-400">
          <h3 className="font-semibold text-darkblack-700 dark:text-white truncate">
            {file.label || file.file_path.split("/").pop()}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onDownload(file)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded-lg text-bgray-500 dark:text-bgray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[70vh] overflow-auto flex items-center justify-center">
          {isImageFile(file.file_path) ? (
            <img src={url} alt={file.label || "Preview"} className="max-w-full h-auto rounded-lg" />
          ) : file.file_path.endsWith(".pdf") ? (
            <div className="text-center py-10">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-bgray-600 dark:text-bgray-300 mb-4">PDF Document</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open in new tab
              </a>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="text-6xl mb-4">{getFileIcon(file.file_path)}</div>
              <p className="text-bgray-600 dark:text-bgray-300">
                This file type cannot be previewed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File row ────────────────────────────────────────────────────────────────

function FileRow({ file, stageName, onPreview, onDownload }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-bgray-100 dark:border-darkblack-400 last:border-0 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition-colors group">
      {/* Icon */}
      <span className="text-xl flex-shrink-0">{getFileIcon(file.file_path)}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-darkblack-700 dark:text-white truncate">
          {file.label || file.file_path.split("/").pop()}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-bgray-500 dark:text-bgray-400">
            {stageName || "—"}
          </span>
          <span className="text-bgray-300 dark:text-bgray-600">•</span>
          <span className="text-xs text-bgray-500 dark:text-bgray-400">
            {file.uploaded_by_name || "Unknown"}
          </span>
          <span className="text-bgray-300 dark:text-bgray-600">•</span>
          <span className="text-xs text-bgray-500 dark:text-bgray-400">
            {formatDate(file.uploaded_at)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onPreview(file)}
          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg text-bgray-500 hover:text-blue-600 dark:text-bgray-300 dark:hover:text-blue-400 transition-colors"
          title="Preview"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0m6 0a3 3 0 11-6 0m-6.364 6.364a9 9 0 1112.728 0M10.5 7.5" />
          </svg>
        </button>
        <button
          onClick={() => onDownload(file)}
          className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg text-bgray-500 hover:text-emerald-600 dark:text-bgray-300 dark:hover:text-emerald-400 transition-colors"
          title="Download"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Project section (dentro de un cliente) ─────────────────────────────────

function ProjectSection({ project, onPreview, onDownload, onFileCountReported }) {
  const [expanded, setExpanded] = useState(true);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const reported = React.useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      try {
        setLoading(true);
        const { data: trackDetail, error: err1 } = await supabase.rpc("get_track_detail", {
          p_track_id: project.track_id,
        });
        if (err1) throw err1;

        const stages = trackDetail?.stages || [];
        const stagesWithFiles = stages.filter((s) => s.files_count > 0);

        const allFiles = [];
        for (const stage of stagesWithFiles) {
          if (cancelled) return;
          const { data: stageDetail, error: err2 } = await supabase.rpc("get_stage_detail", {
            p_track_stage_id: stage.track_stage_id,
          });
          if (err2) continue;
          (stageDetail?.files || []).forEach((f) => {
            allFiles.push({ ...f, _stageName: stage.name });
          });
        }

        if (!cancelled) {
          setFiles(allFiles);
          // Report file count up to parent (una sola vez)
          if (!reported.current) {
            reported.current = true;
            onFileCountReported?.(project.track_id, allFiles.length);
          }
        }
      } catch (e) {
        console.error("Error loading files for project:", e);
        if (!reported.current) {
          reported.current = true;
          onFileCountReported?.(project.track_id, 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFiles();
    return () => { cancelled = true; };
  }, [project.track_id]);

  // Si ya terminó de cargar y no tiene archivos, no renderizar nada
  if (!loading && files.length === 0) return null;

  return (
    <div className="border border-bgray-200 dark:border-darkblack-400 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-bgray-50 dark:bg-darkblack-500 hover:bg-bgray-100 dark:hover:bg-darkblack-400 transition-colors text-left"
      >
        <svg
          className={`w-4 h-4 text-bgray-400 dark:text-bgray-500 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-darkblack-700 dark:text-white truncate">
            {project.track_name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={project.track_status || project.status} />
          <span className="text-xs text-bgray-500 dark:text-bgray-400 bg-bgray-100 dark:bg-darkblack-400 px-2 py-0.5 rounded-full">
            {loading ? "…" : files.length} {files.length === 1 ? "file" : "files"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="bg-white dark:bg-darkblack-600">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                stageName={file._stageName}
                onPreview={onPreview}
                onDownload={onDownload}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Client card (vista principal) ──────────────────────────────────────────

function ClientCard({ client, projectCount, totalFiles, onClick, isSelected }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all duration-200 p-4
        ${isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-400/40"
          : "border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 hover:border-blue-300 hover:shadow-sm"
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Name */}
        <p className="font-semibold text-darkblack-700 dark:text-white truncate">
          {client.company_name}
        </p>
        {/* File count badge */}
        <span className="flex-shrink-0 text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full">
          {totalFiles} {totalFiles === 1 ? "file" : "files"}
        </span>
      </div>
      <p className="text-xs text-bgray-500 dark:text-bgray-400 mt-1">
        {projectCount} {projectCount === 1 ? "project" : "projects"} with files
      </p>
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const { t } = useTranslation();

  // ── raw data ──
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── navigation state ──
  const [selectedClientName, setSelectedClientName] = useState(null);

  // ── preview / search ──
  const [previewFile, setPreviewFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── file counts reported by each ProjectSection: { track_id → count } ──
  const [fileCounts, setFileCounts] = useState({});
  const handleFileCountReported = React.useCallback((trackId, count) => {
    setFileCounts((prev) => {
      if (prev[trackId] === count) return prev; // evitar re-render innecesario
      return { ...prev, [trackId]: count };
    });
  }, []);

  // ── load all projects ──
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("v_tracks_overview")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setProjects(data || []);
      } catch (e) {
        console.error("FilesPage load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Pre-load file counts for all projects (sin renderizar ProjectSection) ──
  // Así la lista de clientes puede filtrar correctamente desde el inicio
  useEffect(() => {
    if (projects.length === 0) return;
    let cancelled = false;

    async function preloadCounts() {
      for (const p of projects) {
        if (cancelled) return;
        if (fileCounts[p.track_id] !== undefined) continue; // ya cargado
        try {
          const { data: trackDetail } = await supabase.rpc("get_track_detail", {
            p_track_id: p.track_id,
          });
          const stages = trackDetail?.stages || [];
          const total = stages.reduce((sum, s) => sum + (s.files_count || 0), 0);
          if (!cancelled) {
            setFileCounts((prev) => ({ ...prev, [p.track_id]: total }));
          }
        } catch (e) {
          if (!cancelled) {
            setFileCounts((prev) => ({ ...prev, [p.track_id]: 0 }));
          }
        }
      }
    }

    preloadCounts();
    return () => { cancelled = true; };
  }, [projects]);

  // ── derived: group projects by client_name ──
  const clientsGrouped = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      const key = p.client_name || "Unknown";
      if (!map[key]) {
        map[key] = {
          id: key, // usar client_name como key
          company_name: key,
          projects: [],
        };
      }
      map[key].projects.push(p);
    });
    return Object.values(map);
  }, [projects]);

  // ── solo mostrar clientes que tienen al menos un proyecto con archivos ──
  // Una vez que todos los proyectos de un cliente han reportado sus conteos,
  // si la suma es 0 no se muestra ese cliente
  const clientsWithFiles = useMemo(() => {
    return clientsGrouped.filter((client) => {
      // Si algún proyecto aún no ha reportado, lo dejamos visible (aún cargando)
      const allReported = client.projects.every((p) => fileCounts[p.track_id] !== undefined);
      if (!allReported) return true; // keep while loading
      // Si todos reportaron, mostrar solo si tiene archivos
      const total = client.projects.reduce((sum, p) => sum + (fileCounts[p.track_id] || 0), 0);
      return total > 0;
    });
  }, [clientsGrouped, fileCounts]);

  // ── filter clients por search ──
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clientsWithFiles;
    const q = searchQuery.toLowerCase();
    return clientsWithFiles.filter(
      (c) =>
        c.company_name?.toLowerCase().includes(q) ||
        c.projects.some((p) => p.track_name?.toLowerCase().includes(q))
    );
  }, [clientsWithFiles, searchQuery]);

  // ── selected client ──
  const selectedClient = useMemo(
    () => filteredClients.find((c) => c.id === selectedClientName) || null,
    [filteredClients, selectedClientName]
  );

  // ── download handler (same as StageDrawer) ──
  const handleDownload = async (file) => {
    try {
      const { data, error } = await supabase.storage.from("crm-files").download(file.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.label || file.file_path.split("/").pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  // ── loading state ──
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-bgray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span>{t("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-darkblack-700 dark:text-white">{t("files")}</h1>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">{t("filesDescription")}</p>
        </div>

        {/* Search */}
        <div className="mb-5">
          <div className="relative max-w-md">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchFiles")}
              className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white placeholder-bgray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Layout: client list (left) + file detail (right) */}
        <div className="flex gap-6">
          {/* ── Client list ── */}
          <div className="w-80 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-bgray-600 dark:text-bgray-300 uppercase tracking-wide">
                {t("clients")}
              </h2>
              <span className="text-xs text-bgray-400 dark:text-bgray-500">
                {filteredClients.length}
              </span>
            </div>

            {filteredClients.length === 0 ? (
              <div className="rounded-xl border border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 p-8 text-center">
                <div className="text-3xl mb-2">📁</div>
                <p className="text-sm text-bgray-500 dark:text-bgray-400">
                  {t("noClientsWithFiles")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredClients.map((client) => {
                  const totalFiles = client.projects.reduce((sum, p) => sum + (fileCounts[p.track_id] || 0), 0);
                  const projectsWithFiles = client.projects.filter((p) => (fileCounts[p.track_id] || 0) > 0).length;
                  return (
                    <ClientCard
                      key={client.id}
                      client={client}
                      projectCount={projectsWithFiles || client.projects.length}
                      totalFiles={totalFiles}
                      isSelected={selectedClientName === client.id}
                      onClick={() => setSelectedClientName(client.id === selectedClientName ? null : client.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right panel: projects + files ── */}
          <div className="flex-1 min-w-0">
            {selectedClient ? (
              <>
                {/* Breadcrumb / header */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setSelectedClientName(null)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    ← {t("clients")}
                  </button>
                  <span className="text-bgray-300 dark:text-bgray-600">/</span>
                  <span className="text-sm font-semibold text-darkblack-700 dark:text-white">
                    {selectedClient.company_name}
                  </span>
                </div>

                {/* Project sections — solo los que tienen archivos */}
                <div className="space-y-3">
                  {selectedClient.projects.map((project) => (
                    <ProjectSection
                      key={project.track_id}
                      project={project}
                      onPreview={setPreviewFile}
                      onDownload={handleDownload}
                      onFileCountReported={handleFileCountReported}
                    />
                  ))}
                </div>
              </>
            ) : (
              /* Empty state when no client selected */
              <div className="rounded-xl border border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="text-5xl mb-4">📂</div>
                <h3 className="text-base font-semibold text-darkblack-700 dark:text-white mb-1">
                  {t("selectClientToView")}
                </h3>
                <p className="text-sm text-bgray-500 dark:text-bgray-400 max-w-sm">
                  {t("selectClientToViewDesc")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
