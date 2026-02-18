import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

const PIPELINES = {
  Service: [
    "Lead or Inquiry",
    "Quotation",
    "Service delivery",
    "Payment",
  ],
  Product: [
    "Lead or Inquiry",
    "Quotation",
    "Samples approval",
    "Deposit payment",
    "Production",
    "Goods inspection",
    "Balance payment",
    "Shipment",
  ],
};

// Column colors: subtle gradient tones per stage index
const COLUMN_COLORS = {
  Service: [
    { bg: "bg-violet-50", border: "border-violet-200", header: "bg-violet-100", text: "text-violet-700", accent: "#7c3aed" },
    { bg: "bg-blue-50", border: "border-blue-200", header: "bg-blue-100", text: "text-blue-700", accent: "#2563eb" },
    { bg: "bg-cyan-50", border: "border-cyan-200", header: "bg-cyan-100", text: "text-cyan-700", accent: "#0891b2" },
    { bg: "bg-emerald-50", border: "border-emerald-200", header: "bg-emerald-100", text: "text-emerald-700", accent: "#059669" },
  ],
  Product: [
    { bg: "bg-violet-50", border: "border-violet-200", header: "bg-violet-100", text: "text-violet-700", accent: "#7c3aed" },
    { bg: "bg-blue-50", border: "border-blue-200", header: "bg-blue-100", text: "text-blue-700", accent: "#2563eb" },
    { bg: "bg-indigo-50", border: "border-indigo-200", header: "bg-indigo-100", text: "text-indigo-700", accent: "#4f46e5" },
    { bg: "bg-cyan-50", border: "border-cyan-200", header: "bg-cyan-100", text: "text-cyan-700", accent: "#0891b2" },
    { bg: "bg-teal-50", border: "border-teal-200", header: "bg-teal-100", text: "text-teal-700", accent: "#0d9488" },
    { bg: "bg-emerald-50", border: "border-emerald-200", header: "bg-emerald-100", text: "text-emerald-700", accent: "#059669" },
    { bg: "bg-amber-50", border: "border-amber-200", header: "bg-amber-100", text: "text-amber-700", accent: "#d97706" },
    { bg: "bg-orange-50", border: "border-orange-200", header: "bg-orange-100", text: "text-orange-700", accent: "#ea580c" },
  ],
};

function getProgressColor(pct) {
  if (pct >= 75) return { bg: "bg-emerald-500", text: "text-emerald-700", light: "bg-emerald-100" };
  if (pct >= 50) return { bg: "bg-blue-500", text: "text-blue-700", light: "bg-blue-100" };
  if (pct >= 25) return { bg: "bg-amber-500", text: "text-amber-700", light: "bg-amber-100" };
  return { bg: "bg-bgray-300", text: "text-bgray-600", light: "bg-bgray-100" };
}

function isOverdue(nextDueDate) {
  if (!nextDueDate) return false;
  return new Date(nextDueDate) < new Date();
}

// Individual project card inside a pipeline column
function ProjectCard({ project, isActive, onClick }) {
  const progress = Number(project.progress_pct) || 0;
  const progressColor = getProgressColor(progress);
  const overdue = isOverdue(project.next_due_date);

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
        ${isActive
          ? "bg-white border-blue-500 shadow-md ring-2 ring-blue-400/40"
          : "bg-white border-bgray-200 hover:border-blue-300 hover:shadow-sm"
        }
      `}
    >
      {/* Overdue ribbon */}
      {overdue && (
        <div className="absolute top-0 right-0 w-0 h-0 overflow-hidden">
          <div className="absolute -top-1 -right-1 w-16 h-16 bg-red-100 rotate-45 origin-top-right"></div>
          <span className="absolute top-1.5 right-1 text-[9px] font-bold text-red-600 rotate-45 whitespace-nowrap" style={{ transform: "rotate(45deg)", top: "2px", right: "-2px" }}>
            LATE
          </span>
        </div>
      )}

      <div className="p-3">
        {/* Project name */}
        <div className="font-semibold text-darkblack-700 dark:text-white text-sm leading-tight mb-1 pr-4 line-clamp-2">
          {project.track_name}
        </div>

        {/* Client */}
        <div className="text-xs text-bgray-500 dark:text-bgray-400 mb-2.5 truncate">
          {project.client_name}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-bgray-100 dark:bg-darkblack-500 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor.bg}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Footer: progress % + due date */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${progressColor.text}`}>
            {progress}%
          </span>
          {project.next_due_date && (
            <span className={`text-xs ${overdue ? "text-red-600 font-semibold" : "text-bgray-400 dark:text-bgray-500"}`}>
              {overdue ? "⚠ " : ""}
              {new Date(project.next_due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Single pipeline column
function PipelineColumn({ stageName, color, projects, activeProjectId, onProjectSelect }) {
  return (
    <div className="flex-shrink-0 w-56 flex flex-col">
      {/* Column header */}
      <div className={`${color.header} border-b ${color.border} rounded-t-xl px-3 py-2.5 sticky top-0 z-10`}>
        <div className={`font-semibold text-sm ${color.text}`}>{stageName}</div>
        <div className="text-xs text-bgray-500 mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Cards */}
      <div className={`${color.bg} border-l border-r border-b ${color.border} rounded-b-xl p-2 flex-1 min-h-[180px] overflow-y-auto scrollbar-thin space-y-2`}>
        <AnimatePresence>
          {projects.map((project) => (
            <ProjectCard
              key={project.track_id}
              project={project}
              isActive={activeProjectId === project.track_id}
              onClick={() => onProjectSelect(project.track_id)}
            />
          ))}
        </AnimatePresence>

        {projects.length === 0 && (
          <div className="text-center py-6 text-bgray-400 text-xs">
            No projects
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelineView({ projects, onProjectSelect, activeProjectId, searchQuery = "" }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("Product");

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.track_name?.toLowerCase().includes(q) ||
        p.client_name?.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  // Split by workflow_kind
  const byKind = useMemo(() => {
    const service = filtered.filter((p) => p.workflow_kind === "Service");
    const product = filtered.filter((p) => p.workflow_kind === "Product");
    return { Service: service, Product: product };
  }, [filtered]);

  // Group current tab's projects into columns by current_stage_name
  // Completed projects (current_stage_name === null && progress 100) go to a "Completed" column
  const columns = useMemo(() => {
    const stages = PIPELINES[activeTab];
    const colors = COLUMN_COLORS[activeTab];
    const projectsForTab = byKind[activeTab];

    const result = stages.map((stage, idx) => ({
      stageName: stage,
      color: colors[idx],
      projects: projectsForTab.filter((p) => p.current_stage_name === stage),
    }));

    // Add "Completed" column at the end
    const completed = projectsForTab.filter(
      (p) => p.current_stage_name === null && Number(p.progress_pct) >= 100
    );
    if (completed.length > 0) {
      result.push({
        stageName: "Completed",
        color: { bg: "bg-emerald-50", border: "border-emerald-300", header: "bg-emerald-100", text: "text-emerald-800", accent: "#16a34a" },
        projects: completed,
      });
    }

    return result;
  }, [activeTab, byKind]);

  const tabs = [
    { key: "Product", label: t("product") || "Product", icon: "📦", count: byKind.Product.length },
    { key: "Service", label: t("service") || "Service", icon: "⚙️", count: byKind.Service.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
              ${activeTab === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-200 dark:hover:bg-darkblack-400"
              }
            `}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? "bg-white/25" : "bg-bgray-200 dark:bg-darkblack-400"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Pipeline columns — horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin pb-2 px-1">
        <div className="flex gap-3 min-w-max h-full">
          {columns.map((col) => (
            <PipelineColumn
              key={col.stageName}
              stageName={col.stageName}
              color={col.color}
              projects={col.projects}
              activeProjectId={activeProjectId}
              onProjectSelect={onProjectSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
