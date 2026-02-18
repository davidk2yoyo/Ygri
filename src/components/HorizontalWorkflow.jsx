import React from "react";
import { motion } from "framer-motion";

/**
 * HorizontalWorkflow — compact stepper that replaces the React Flow canvas.
 * Receives `detail` (from get_track_detail) and renders stages left → right
 * with connecting arrows. Each stage is clickable → opens StageDrawer.
 */

const STATUS_CONFIG = {
  done: {
    bg: "bg-emerald-500",
    border: "border-emerald-500",
    text: "text-emerald-700",
    light: "bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    icon: "✓",
    gradient: "from-emerald-400 to-emerald-600",
  },
  in_progress: {
    bg: "bg-blue-500",
    border: "border-blue-500",
    text: "text-blue-700",
    light: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    icon: "⚡",
    gradient: "from-blue-400 to-cyan-500",
  },
  blocked: {
    bg: "bg-red-500",
    border: "border-red-500",
    text: "text-red-700",
    light: "bg-red-50",
    badge: "bg-red-100 text-red-700",
    icon: "⚠",
    gradient: "from-red-400 to-orange-500",
  },
  not_started: {
    bg: "bg-slate-400",
    border: "border-slate-300",
    text: "text-slate-600",
    light: "bg-white",
    badge: "bg-slate-100 text-slate-600",
    icon: "○",
    gradient: "from-slate-300 to-slate-400",
  },
};

function getConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
}

// Connector arrow between stages
function Arrow({ fromStatus, toStatus }) {
  // Color the arrow based on the "from" stage: if done → green, otherwise gray
  const color = fromStatus === "done" ? "#10b981" : "#cbd5e1";
  return (
    <div className="flex items-center self-center flex-shrink-0 px-1">
      <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
        <line x1="0" y1="8" x2="22" y2="8" stroke={color} strokeWidth="2" strokeDasharray={fromStatus === "done" ? "none" : "4 3"} />
        <polygon points="22,4 28,8 22,12" fill={color} />
      </svg>
    </div>
  );
}

// Individual stage bubble
function StageBubble({ stage, index, isActive, onClick }) {
  const cfg = getConfig(stage.status);
  const isCurrentlyActive = stage.status === "in_progress";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      className="flex flex-col items-center flex-shrink-0"
      style={{ width: "140px" }}
    >
      {/* Bubble */}
      <button
        onClick={onClick}
        className={`relative w-full rounded-xl border-2 transition-all duration-200 cursor-pointer text-left
          ${cfg.light} ${cfg.border}
          ${isActive ? "ring-2 ring-blue-400/50 shadow-md" : "hover:shadow-sm hover:border-blue-300"}
        `}
      >
        {/* Animated pulse for in_progress */}
        {isCurrentlyActive && (
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-blue-400"
            animate={{ scale: [1, 1.06, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <div className="relative z-10 p-2.5">
          {/* Top row: order circle + icon */}
          <div className="flex items-center justify-between mb-1.5">
            <div className={`w-6 h-6 rounded-full ${cfg.bg} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
              {stage.status === "done" ? "✓" : stage.order_index}
            </div>
            <span className="text-sm">{cfg.icon}</span>
          </div>

          {/* Stage name */}
          <div className="font-semibold text-xs leading-tight text-darkblack-700 dark:text-white line-clamp-2 mb-1.5">
            {stage.name}
          </div>

          {/* Status badge */}
          <span className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.badge}`}>
            {stage.status.replace("_", " ")}
          </span>

          {/* Due date */}
          {stage.due_date && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-500">
              <span>📅</span>
              <span>{stage.due_date}</span>
            </div>
          )}

          {/* Mini stats */}
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
            <span>📎{stage.files_count || 0}</span>
            <span>✅{stage.todos_count || 0}</span>
            <span>💬{stage.comments_count || 0}</span>
          </div>
        </div>

        {/* Bottom progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-bgray-200 rounded-b-lg overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${cfg.gradient}`}
            initial={{ width: 0 }}
            animate={{ width: `${stage.progress_pct || 0}%` }}
            transition={{ duration: 0.8, delay: index * 0.1 }}
          />
        </div>
      </button>
    </motion.div>
  );
}

export default function HorizontalWorkflow({ detail, onStageClick }) {
  if (!detail?.stages?.length) return null;

  const { track, client, stages } = detail;

  return (
    <div className="flex flex-col h-full">
      {/* Project header pill */}
      <div className="flex items-center gap-3 px-4 py-3 mb-4">
        <div className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-md inline-flex items-center gap-3">
          <div>
            <div className="text-white/70 text-xs">{client?.company_name}</div>
            <div className="text-white font-bold text-sm">{track.name}</div>
          </div>
          <span className="text-white/60 text-xs border-l border-white/30 pl-3">
            {track.status || "Active"}
          </span>
        </div>
      </div>

      {/* Stages row — horizontal scroll if needed */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin px-4 pb-2">
        <div className="flex items-start gap-0 min-w-max">
          {stages.map((stage, idx) => (
            <React.Fragment key={stage.track_stage_id}>
              <StageBubble
                stage={stage}
                index={idx}
                onClick={() => onStageClick(stage.track_stage_id)}
              />
              {/* Arrow between stages */}
              {idx < stages.length - 1 && (
                <Arrow fromStatus={stage.status} toStatus={stages[idx + 1].status} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
