import React, { useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

const PIPELINES = {
  Service: ["Lead or Inquiry", "Quotation", "Service delivery", "Payment"],
  Product: [
    "Lead or Inquiry", "Quotation", "Samples approval", "Deposit payment",
    "Production", "Goods inspection", "Balance payment", "Shipment",
  ],
};

const COLUMN_COLORS = {
  Service: [
    { bg: "bg-violet-50", border: "border-violet-200", header: "bg-violet-100", text: "text-violet-700" },
    { bg: "bg-blue-50", border: "border-blue-200", header: "bg-blue-100", text: "text-blue-700" },
    { bg: "bg-cyan-50", border: "border-cyan-200", header: "bg-cyan-100", text: "text-cyan-700" },
    { bg: "bg-emerald-50", border: "border-emerald-200", header: "bg-emerald-100", text: "text-emerald-700" },
  ],
  Product: [
    { bg: "bg-violet-50", border: "border-violet-200", header: "bg-violet-100", text: "text-violet-700" },
    { bg: "bg-blue-50", border: "border-blue-200", header: "bg-blue-100", text: "text-blue-700" },
    { bg: "bg-indigo-50", border: "border-indigo-200", header: "bg-indigo-100", text: "text-indigo-700" },
    { bg: "bg-cyan-50", border: "border-cyan-200", header: "bg-cyan-100", text: "text-cyan-700" },
    { bg: "bg-teal-50", border: "border-teal-200", header: "bg-teal-100", text: "text-teal-700" },
    { bg: "bg-emerald-50", border: "border-emerald-200", header: "bg-emerald-100", text: "text-emerald-700" },
    { bg: "bg-amber-50", border: "border-amber-200", header: "bg-amber-100", text: "text-amber-700" },
    { bg: "bg-orange-50", border: "border-orange-200", header: "bg-orange-100", text: "text-orange-700" },
  ],
};

function getProgressColor(pct) {
  if (pct >= 75) return { bg: "bg-emerald-500", text: "text-emerald-700" };
  if (pct >= 50) return { bg: "bg-blue-500", text: "text-blue-700" };
  if (pct >= 25) return { bg: "bg-amber-500", text: "text-amber-700" };
  return { bg: "bg-bgray-300", text: "text-bgray-500" };
}

function isOverdue(d) {
  return d ? new Date(d) < new Date() : false;
}

function KebabMenu({ onRename, onCancel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-0.5 rounded hover:bg-bgray-100 dark:hover:bg-darkblack-400 text-bgray-400 hover:text-bgray-600 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="13" r="1.2"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-5 z-50 w-36 bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-lg shadow-lg py-1 text-sm">
          <button
            onClick={() => { setOpen(false); onRename?.(); }}
            className="w-full text-left px-3 py-1.5 text-bgray-700 dark:text-bgray-200 hover:bg-bgray-50 dark:hover:bg-darkblack-500 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Rename
          </button>
          <button
            onClick={() => { setOpen(false); onCancel?.(); }}
            className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Cancel project
          </button>
        </div>
      )}
    </div>
  );
}

function StatPill({ count, label, color }) {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {count} {label}
    </span>
  );
}

function ProjectCard({ project, isActive, onClick, compact, onRename, onCancel }) {
  const progress = Number(project.progress_pct) || 0;
  const progressColor = getProgressColor(progress);
  const overdue = isOverdue(project.next_due_date);

  if (compact) {
    return (
      <motion.div
        layout
        layoutId={`card-${project.track_id}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        onClick={onClick}
        className={`relative cursor-pointer rounded-lg border transition-all duration-150 group
          ${isActive ? "bg-white border-blue-500 shadow-sm ring-1 ring-blue-400/40" : "bg-white border-bgray-200 hover:border-blue-300 hover:shadow-sm"}`}
      >
        <div className="px-2.5 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-darkblack-700 dark:text-white text-xs leading-tight truncate">{project.track_name}</div>
            <div className="text-[10px] text-bgray-400 truncate">{project.client_name}</div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {overdue && <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 py-0.5 rounded">LATE</span>}
            <span className={`text-[10px] font-semibold ${progressColor.text}`}>{progress}%</span>
            <KebabMenu onRename={onRename} onCancel={onCancel} />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      layoutId={`card-${project.track_id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, type: "spring", stiffness: 260, damping: 20 }}
      onClick={onClick}
      className={`relative cursor-pointer rounded-xl border transition-all duration-200 group
        ${isActive ? "bg-white border-blue-500 shadow-md ring-2 ring-blue-400/40" : "bg-white border-bgray-200 hover:border-blue-300 hover:shadow-sm"}`}
    >
      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <div className="font-semibold text-darkblack-700 dark:text-white text-sm leading-tight line-clamp-2 flex-1">
            {project.track_name}
          </div>
          <KebabMenu onRename={onRename} onCancel={onCancel} />
        </div>

        {/* Client */}
        <div className="text-xs text-bgray-500 dark:text-bgray-400 mb-2.5 truncate">
          {project.client_name}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-bgray-100 dark:bg-darkblack-500 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all duration-500 ${progressColor.bg}`} style={{ width: `${progress}%` }} />
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold ${progressColor.text}`}>{progress}%</span>
          {project.next_due_date && (
            <span className={`text-xs ${overdue ? "text-red-600 font-semibold" : "text-bgray-400"}`}>
              {overdue && <span className="mr-0.5">!</span>}
              {new Date(project.next_due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>

        {/* Stat pills */}
        {(project.task_count > 0 || project.quotation_count > 0 || project.shipment_count > 0) && (
          <div className="flex flex-wrap gap-1 pt-1.5 border-t border-bgray-100">
            <StatPill count={project.task_count} label="tasks" color="bg-amber-50 text-amber-700" />
            <StatPill count={project.quotation_count} label="quotes" color="bg-blue-50 text-blue-700" />
            <StatPill count={project.shipment_count} label="ships" color="bg-teal-50 text-teal-700" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PipelineColumn({ stageName, color, projects, activeProjectId, onProjectSelect, compact, onRename, onCancel }) {
  const colWidth = compact ? "w-44" : "w-56";
  return (
    <div className={`flex-shrink-0 ${colWidth} flex flex-col`}>
      <div className={`${color.header} border-b ${color.border} rounded-t-xl px-3 py-2 sticky top-0 z-10`}>
        <div className={`font-semibold text-xs ${color.text}`}>{stageName}</div>
        <div className="text-[10px] text-bgray-500 mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</div>
      </div>
      <div className={`${color.bg} border-l border-r border-b ${color.border} rounded-b-xl p-2 flex-1 min-h-[160px] overflow-y-auto scrollbar-thin space-y-1.5`}>
        <AnimatePresence>
          {projects.map((project) => (
            <ProjectCard
              key={project.track_id}
              project={project}
              isActive={activeProjectId === project.track_id}
              onClick={() => onProjectSelect(project.track_id)}
              compact={compact}
              onRename={() => onRename?.(project)}
              onCancel={() => onCancel?.(project)}
            />
          ))}
        </AnimatePresence>
        {projects.length === 0 && (
          <div className="text-center py-5 text-bgray-400 text-xs">No projects</div>
        )}
      </div>
    </div>
  );
}

export default function PipelineView({ projects, onProjectSelect, activeProjectId, searchQuery = "", compact = false, onRename, onCancel }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("Product");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p => p.track_name?.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const byKind = useMemo(() => ({
    Service: filtered.filter(p => p.workflow_kind === "Service"),
    Product: filtered.filter(p => p.workflow_kind === "Product"),
  }), [filtered]);

  const columns = useMemo(() => {
    const stages = PIPELINES[activeTab];
    const colors = COLUMN_COLORS[activeTab];
    const projectsForTab = byKind[activeTab];
    const result = stages.map((stage, idx) => ({
      stageName: stage,
      color: colors[idx],
      projects: projectsForTab.filter(p => p.current_stage_name === stage),
    }));
    const completed = projectsForTab.filter(p => p.current_stage_name === null && Number(p.progress_pct) >= 100);
    if (completed.length > 0) {
      result.push({
        stageName: "Completed",
        color: { bg: "bg-emerald-50", border: "border-emerald-300", header: "bg-emerald-100", text: "text-emerald-800" },
        projects: completed,
      });
    }
    return result;
  }, [activeTab, byKind]);

  const tabs = [
    { key: "Product", label: "Product", count: byKind.Product.length },
    { key: "Service", label: "Service", count: byKind.Service.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
              ${activeTab === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-200"}`}
          >
            <span>{tab.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-white/25" : "bg-bgray-200 dark:bg-darkblack-400"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Pipeline columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin pb-2 px-1">
        <div className="flex gap-2.5 min-w-max h-full">
          {columns.map((col) => (
            <PipelineColumn
              key={col.stageName}
              stageName={col.stageName}
              color={col.color}
              projects={col.projects}
              activeProjectId={activeProjectId}
              onProjectSelect={onProjectSelect}
              compact={compact}
              onRename={onRename}
              onCancel={onCancel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
