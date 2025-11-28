import React from "react";
import { Handle, Position } from "reactflow";
import { motion } from "framer-motion";

/**
 * Custom Node Components for React Flow
 * Modern, elegant, and visually appealing
 */

// Project Root Node - Pill-shaped with gradient
export function ProjectNode({ data }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      whileHover={{ scale: 1.05, y: -2 }}
      className="relative"
    >
      <div className="px-6 py-4 rounded-full shadow-xl border-2 border-white dark:border-darkblack-400 bg-gradient-to-r from-blue-500 to-purple-600 min-w-[200px]">
        <div className="text-white/80 text-xs font-medium">{data.clientName}</div>
        <div className="text-white font-bold text-lg">{data.projectName}</div>
        <div className="text-white/90 text-xs mt-1">📊 {data.status}</div>
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 opacity-30 blur-xl -z-10"></div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </motion.div>
  );
}

// Stage Node - Bubble with status indicator
export function StageNode({ data, selected }) {
  const statusConfig = {
    done: {
      gradient: "from-green-400 to-emerald-500",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-300 dark:border-green-700",
      textColor: "text-green-700 dark:text-green-300",
      icon: "✓",
      ring: "ring-green-500/50"
    },
    in_progress: {
      gradient: "from-blue-400 to-cyan-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-300 dark:border-blue-700",
      textColor: "text-blue-700 dark:text-blue-300",
      icon: "⚡",
      ring: "ring-blue-500/50"
    },
    blocked: {
      gradient: "from-red-400 to-orange-500",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-300 dark:border-red-700",
      textColor: "text-red-700 dark:text-red-300",
      icon: "⚠",
      ring: "ring-red-500/50"
    },
    pending: {
      gradient: "from-gray-300 to-gray-400",
      bgColor: "bg-gray-50 dark:bg-gray-900/20",
      borderColor: "border-gray-300 dark:border-gray-700",
      textColor: "text-gray-600 dark:text-gray-400",
      icon: "○",
      ring: "ring-gray-500/50"
    }
  };

  const config = statusConfig[data.status] || statusConfig.pending;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 15,
        delay: data.index * 0.1
      }}
      whileHover={{
        scale: 1.08,
        y: -5,
        transition: { type: "spring", stiffness: 400, damping: 10 }
      }}
      className="relative group"
    >
      {/* Selection Ring */}
      {selected && (
        <motion.div
          className={`absolute -inset-2 rounded-3xl ${config.ring} ring-4`}
          layoutId="selected-ring"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-white !border-2 !border-gray-300"
      />

      <motion.div
        className={`relative ${config.bgColor} ${config.borderColor} border-2 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 min-w-[220px] cursor-pointer overflow-hidden`}
        onClick={data.onClick}
        whileTap={{ scale: 0.95 }}
      >
        {/* Status Indicator Bar */}
        <div className={`h-1.5 bg-gradient-to-r ${config.gradient}`}></div>

        {/* Content */}
        <div className="p-4">
          {/* Header with Icon */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <motion.div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                {data.orderIndex}
              </motion.div>
              <div>
                <div className={`font-bold text-sm ${config.textColor}`}>
                  {data.name}
                </div>
              </div>
            </div>
            <motion.div
              className="text-2xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {config.icon}
            </motion.div>
          </div>

          {/* Status Badge */}
          <div className="mb-3">
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
              {data.status.replace("_", " ").toUpperCase()}
            </span>
          </div>

          {/* Due Date */}
          {data.dueDate && (
            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-3">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {data.dueDate}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1" title="Files">
              <span>📎</span>
              <span className="font-medium">{data.filesCount || 0}</span>
            </div>
            <div className="flex items-center gap-1" title="Todos">
              <span>✅</span>
              <span className="font-medium">{data.todosCount || 0}</span>
            </div>
            <div className="flex items-center gap-1" title="Comments">
              <span>💬</span>
              <span className="font-medium">{data.commentsCount || 0}</span>
            </div>
          </div>

          {/* Hover indicator */}
          <motion.div
            className="mt-3 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            initial={{ x: -10 }}
            whileHover={{ x: 0 }}
          >
            <span>Click to view details</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </motion.div>
        </div>

        {/* Progress bar at bottom */}
        {data.progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
            <motion.div
              className={`h-full bg-gradient-to-r ${config.gradient}`}
              initial={{ width: 0 }}
              animate={{ width: `${data.progress}%` }}
              transition={{ duration: 1, delay: 0.3 }}
            />
          </div>
        )}
      </motion.div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-white !border-2 !border-gray-300"
      />

      {/* Floating particles on hover */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-1 h-1 rounded-full bg-gradient-to-r ${config.gradient}`}
            style={{
              left: `${20 + i * 30}%`,
              top: '50%'
            }}
            animate={{
              y: [-10, -30],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.3
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Export node types for React Flow
export const nodeTypes = {
  projectNode: ProjectNode,
  stageNode: StageNode
};
