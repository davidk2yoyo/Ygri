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
    gradient: "from-emerald-400 to-emerald-600",
  },
  in_progress: {
    bg: "bg-blue-500",
    border: "border-blue-500",
    text: "text-blue-700",
    light: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    gradient: "from-blue-400 to-cyan-500",
  },
  blocked: {
    bg: "bg-red-500",
    border: "border-red-500",
    text: "text-red-700",
    light: "bg-red-50",
    badge: "bg-red-100 text-red-700",
    gradient: "from-red-400 to-orange-500",
  },
  not_started: {
    bg: "bg-slate-400",
    border: "border-slate-300",
    text: "text-slate-600",
    light: "bg-white",
    badge: "bg-slate-100 text-slate-600",
    gradient: "from-slate-300 to-slate-400",
  },
};

function getConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
}

// Small monochrome icon set — replaces emoji glyphs everywhere in this component
const Icon = {
  check: (cls) => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
  ),
  play: (cls) => (
    <svg className={cls} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
  ),
  alert: (cls) => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a1.5 1.5 0 001.3 2.25h17.76a1.5 1.5 0 001.3-2.25L13.71 3.86a1.5 1.5 0 00-2.42 0z" /></svg>
  ),
  calendar: (cls) => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  ),
  paperclip: (cls) => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
  ),
  checkSquare: (cls) => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3 3L22 4M3 12a9 9 0 1018 0 9 9 0 00-18 0z" /></svg>
  ),
  chat: (cls) => (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
  ),
};

function statusIcon(status, cls) {
  if (status === "done") return Icon.check(cls);
  if (status === "in_progress") return Icon.play(cls);
  if (status === "blocked") return Icon.alert(cls);
  return null;
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
          {/* Top row: order circle + status icon */}
          <div className="flex items-center justify-between mb-1.5">
            <div className={`w-6 h-6 rounded-full ${cfg.bg} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
              {stage.status === "done" ? Icon.check("w-3.5 h-3.5") : stage.order_index}
            </div>
            {statusIcon(stage.status, `w-3.5 h-3.5 ${cfg.text}`)}
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
              {Icon.calendar("w-3 h-3")}
              <span>{stage.due_date}</span>
            </div>
          )}

          {/* Mini stats */}
          <div className="flex items-center gap-2.5 mt-1.5 text-[10px] text-slate-500">
            <span className="flex items-center gap-0.5">{Icon.paperclip("w-3 h-3")}{stage.files_count || 0}</span>
            <span className="flex items-center gap-0.5">{Icon.checkSquare("w-3 h-3")}{stage.todos_count || 0}</span>
            <span className="flex items-center gap-0.5">{Icon.chat("w-3 h-3")}{stage.comments_count || 0}</span>
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

  const { stages } = detail;

  return (
    <div className="flex flex-col h-full">
      {/* Stages row — horizontal scroll if needed */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin px-4 py-3">
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
