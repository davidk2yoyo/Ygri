import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

/**
 * NetworkGraphView - Interactive network graph visualization
 * Level 1: Client nodes floating
 * Level 2: Click client → Projects expand around it
 * Level 3: Click project → Select to view workflow
 */
export default function NetworkGraphView({
  projects,
  onProjectSelect,
  activeProjectId,
  searchQuery = ""
}) {
  const { t } = useTranslation();
  const [selectedClient, setSelectedClient] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Zoom and Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Group projects by client
  const clientGroups = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    const groups = {};
    projects.forEach(project => {
      const clientName = project.client_name || "Unknown Client";
      if (!groups[clientName]) {
        groups[clientName] = {
          clientName,
          projects: [],
          totalProgress: 0,
          id: clientName.toLowerCase().replace(/\s+/g, '-')
        };
      }
      groups[clientName].projects.push(project);
      groups[clientName].totalProgress += parseFloat(project.progress_pct || 0);
    });

    return Object.values(groups).map(group => ({
      ...group,
      avgProgress: group.projects.length > 0
        ? group.totalProgress / group.projects.length
        : 0,
      healthColor: getHealthColor(group.totalProgress / group.projects.length),
      projectCount: group.projects.length
    }));
  }, [projects]);

  // Filter based on search query
  const filteredClientGroups = useMemo(() => {
    if (!searchQuery.trim()) return clientGroups;

    const query = searchQuery.toLowerCase();
    return clientGroups.map(group => ({
      ...group,
      projects: group.projects.filter(p =>
        p.client_name?.toLowerCase().includes(query) ||
        p.track_name?.toLowerCase().includes(query)
      )
    })).filter(group => group.projects.length > 0);
  }, [clientGroups, searchQuery]);

  // Calculate client node positions - spread across full width organically
  const clientNodes = useMemo(() => {
    const nodes = [];
    const count = filteredClientGroups.length;

    // Use a wider, more organic distribution pattern
    const patterns = [
      // Different layout patterns based on number of clients
      { cols: 2, rows: 1 }, // 1-2 clients
      { cols: 3, rows: 1 }, // 3 clients
      { cols: 4, rows: 1 }, // 4 clients
      { cols: 3, rows: 2 }, // 5-6 clients
      { cols: 4, rows: 2 }, // 7-8 clients
      { cols: 5, rows: 2 }, // 9-10 clients
      { cols: 4, rows: 3 }, // 11-12 clients
      { cols: 5, rows: 3 }, // 13-15 clients
    ];

    const patternIndex = Math.min(
      count <= 2 ? 0 :
      count === 3 ? 1 :
      count === 4 ? 2 :
      count <= 6 ? 3 :
      count <= 8 ? 4 :
      count <= 10 ? 5 :
      count <= 12 ? 6 : 7,
      patterns.length - 1
    );
    const { cols, rows } = patterns[patternIndex];

    // Use percentage-based positioning for true spread
    const marginX = 8; // percentage from left
    const marginY = 8; // percentage from top
    const usableWidth = 84; // 100 - marginX - marginX
    const usableHeight = 84; // 100 - marginY - marginY

    filteredClientGroups.forEach((group, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      // Calculate base position as percentage of container
      const baseX = marginX + (col * (usableWidth / cols)) + (usableWidth / (cols * 2));
      const baseY = marginY + (row * (usableHeight / rows)) + (usableHeight / (rows * 2));

      // Add organic variation using golden ratio and sine waves (in percentage)
      const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.4 radians
      const offsetX = Math.cos(index * goldenAngle) * 4 + Math.sin(index * 1.3) * 2;
      const offsetY = Math.sin(index * goldenAngle) * 4 + Math.cos(index * 1.7) * 2;

      nodes.push({
        ...group,
        x: `${baseX + offsetX}%`,
        y: `${baseY + offsetY}%`,
        size: 90 + Math.min(group.projectCount * 12, 70),
        // Different float patterns for each node
        floatDelay: index * 0.4,
        floatDuration: 3 + (index % 3) * 0.5,
        floatDistance: 10 + (index % 4) * 3
      });
    });

    return nodes;
  }, [filteredClientGroups]);

  // Calculate project node positions around selected client
  const projectNodes = useMemo(() => {
    if (!selectedClient) return [];

    const clientNode = clientNodes.find(n => n.id === selectedClient);
    if (!clientNode) return [];

    const nodes = [];
    const count = clientNode.projects.length;
    const orbitRadius = 15; // in percentage

    // Parse client position (remove % and convert to number)
    const clientX = parseFloat(clientNode.x);
    const clientY = parseFloat(clientNode.y);

    clientNode.projects.forEach((project, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2; // Start from top

      // Calculate offset in percentage
      const offsetX = Math.cos(angle) * orbitRadius;
      const offsetY = Math.sin(angle) * orbitRadius;

      const x = `${clientX + offsetX}%`;
      const y = `${clientY + offsetY}%`;

      nodes.push({
        ...project,
        x,
        y,
        size: 70,
        color: getProgressColor(project.progress_pct)
      });
    });

    return nodes;
  }, [selectedClient, clientNodes]);

  const handleClientClick = (clientId) => {
    if (selectedClient === clientId) {
      setSelectedClient(null);
    } else {
      setSelectedClient(clientId);
    }
  };

  const handleProjectClick = (projectId) => {
    onProjectSelect(projectId);
  };

  const handleBackgroundClick = (e) => {
    if (!isDragging) {
      setSelectedClient(null);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.target === e.currentTarget || e.target.tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-bgray-500">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-center">{t("noActiveProjects")}</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full min-h-[600px] bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-orange-50/20 dark:from-darkblack-600 dark:via-darkblack-700 dark:to-darkblack-600 rounded-lg overflow-hidden"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onClick={handleBackgroundClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
    >
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-white dark:bg-darkblack-600 rounded-lg shadow-lg p-2 border border-bgray-200 dark:border-darkblack-400">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded transition-colors"
          title="Zoom In"
        >
          <svg className="w-5 h-5 text-darkblack-700 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded transition-colors"
          title="Zoom Out"
        >
          <svg className="w-5 h-5 text-darkblack-700 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded transition-colors"
          title="Reset View"
        >
          <svg className="w-5 h-5 text-darkblack-700 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="text-center text-xs text-bgray-600 dark:text-bgray-300 py-1">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Zoomable and Pannable Container */}
      <div
        className="absolute inset-0 transition-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center'
        }}
      >
      {/* Animated Background Pattern with Moving Gradients */}
      <div className="absolute inset-0 opacity-30">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 50% 80%, rgba(249, 115, 22, 0.1) 0%, transparent 50%),
              radial-gradient(circle, #cbd5e1 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 100% 100%, 100% 100%, 30px 30px'
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%']
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        ></motion.div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: `${(i * 12) + 10}%`,
              top: `${Math.random() * 100}%`,
              background: `radial-gradient(circle, ${
                i % 3 === 0 ? 'rgba(59, 130, 246, 0.4)' :
                i % 3 === 1 ? 'rgba(139, 92, 246, 0.4)' :
                'rgba(249, 115, 22, 0.4)'
              }, transparent)`
            }}
            animate={{
              y: [-20, -100],
              opacity: [0, 0.6, 0],
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.8,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* SVG for connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
          </linearGradient>

          {/* Animated gradient for active connections */}
          <linearGradient id="activeLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8">
              <animate attributeName="stop-color" values="#22c55e;#3b82f6;#22c55e" dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4">
              <animate attributeName="stop-color" values="#3b82f6;#8b5cf6;#3b82f6" dur="3s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>

        {/* Connection lines */}
        <AnimatePresence>
          {selectedClient && projectNodes.map((project, index) => {
            const clientNode = clientNodes.find(n => n.id === selectedClient);
            if (!clientNode) return null;

            return (
              <motion.line
                key={`line-${project.track_id}`}
                x1={clientNode.x}
                y1={clientNode.y}
                x2={project.x}
                y2={project.y}
                stroke={activeProjectId === project.track_id ? "url(#activeLineGradient)" : "url(#lineGradient)"}
                strokeWidth={activeProjectId === project.track_id ? "3" : "2"}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.7 }}
                exit={{ pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                strokeDasharray={activeProjectId === project.track_id ? "5,5" : "none"}
              >
                {activeProjectId === project.track_id && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="10"
                    to="0"
                    dur="0.5s"
                    repeatCount="indefinite"
                  />
                )}
              </motion.line>
            );
          })}
        </AnimatePresence>
      </svg>

      {/* Client Nodes */}
      <AnimatePresence>
        {clientNodes.map((node, index) => (
          <motion.div
            key={node.id}
            className="absolute cursor-pointer"
            style={{
              left: node.x,
              top: node.y,
              width: node.size,
              height: node.size,
              x: '-50%',
              y: '-50%'
            }}
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{
              scale: selectedClient === node.id ? 1.15 : 1,
              opacity: 1,
              rotate: 0,
              y: [0, -node.floatDistance, 0],
              x: [0, Math.sin(index) * 5, 0], // Subtle horizontal drift
            }}
            exit={{ scale: 0, opacity: 0, rotate: 180 }}
            transition={{
              duration: 0.8,
              delay: node.floatDelay,
              y: {
                duration: node.floatDuration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: node.floatDelay
              },
              x: {
                duration: node.floatDuration * 1.3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: node.floatDelay + 0.5
              }
            }}
            whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}
            onClick={(e) => {
              e.stopPropagation();
              handleClientClick(node.id);
            }}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Node Circle with Enhanced Visuals */}
            <div
              className={`w-full h-full rounded-2xl flex flex-col items-center justify-center border-4 transition-all duration-300 ${
                selectedClient === node.id
                  ? 'border-blue-500 shadow-2xl shadow-blue-500/50'
                  : 'border-white/50 dark:border-darkblack-400 shadow-2xl hover:shadow-3xl'
              }`}
              style={{
                background: `linear-gradient(135deg, ${node.healthColor}, ${adjustColor(node.healthColor, -40)})`,
                boxShadow: selectedClient === node.id
                  ? `0 20px 60px rgba(59, 130, 246, 0.4), 0 0 40px ${node.healthColor}40`
                  : `0 10px 40px ${node.healthColor}30, 0 0 20px ${node.healthColor}20`
              }}
            >
              {/* Inner glow effect */}
              <div className="absolute inset-2 rounded-xl bg-white/10 backdrop-blur-sm"></div>

              {/* Content */}
              <div className="relative z-10">
                <div className="text-white font-bold text-2xl mb-1 drop-shadow-lg">{node.projectCount}</div>
                <div className="text-white text-xs font-semibold opacity-95 px-3 text-center leading-tight drop-shadow">
                  {node.clientName.length > 15 ? node.clientName.substring(0, 13) + '...' : node.clientName}
                </div>
              </div>

              {/* Shimmer effect on hover */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
                  backgroundSize: '200% 200%'
                }}
                animate={{
                  backgroundPosition: ['0% 0%', '200% 200%']
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            </div>

            {/* Pulse Animation */}
            {selectedClient === node.id && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-2xl border-4 border-blue-500"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-2xl border-4 border-purple-500"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                />
              </>
            )}

            {/* Detailed Tooltip */}
            <AnimatePresence>
              {hoveredNode === node.id && (
                <motion.div
                  className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-white dark:bg-darkblack-500 px-4 py-2 rounded-xl shadow-xl border-2 border-bgray-200 dark:border-darkblack-400 whitespace-nowrap z-50 min-w-[180px]"
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-sm font-bold text-darkblack-700 dark:text-white mb-1">
                    {node.clientName}
                  </div>
                  <div className="text-xs text-bgray-500 dark:text-bgray-400 space-y-1">
                    <div>📊 {node.projectCount} {node.projectCount === 1 ? 'project' : 'projects'}</div>
                    <div>📈 {Math.round(node.avgProgress)}% average progress</div>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                    Click to explore →
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Project Nodes */}
      <AnimatePresence>
        {selectedClient && projectNodes.map((project, index) => (
          <motion.div
            key={project.track_id}
            className="absolute cursor-pointer"
            style={{
              left: project.x,
              top: project.y,
              width: project.size,
              height: project.size,
              x: '-50%',
              y: '-50%'
            }}
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{
              scale: activeProjectId === project.track_id ? 1.15 : 1,
              opacity: 1,
              rotate: 0
            }}
            exit={{ scale: 0, opacity: 0, rotate: 180 }}
            transition={{
              duration: 0.5,
              delay: index * 0.08,
              type: "spring",
              stiffness: 200
            }}
            whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}
            onClick={(e) => {
              e.stopPropagation();
              handleProjectClick(project.track_id);
            }}
            onMouseEnter={() => setHoveredNode(project.track_id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Project Node */}
            <div
              className={`w-full h-full rounded-xl flex flex-col items-center justify-center shadow-lg border-3 transition-all duration-300 overflow-hidden ${
                activeProjectId === project.track_id
                  ? 'border-green-500 shadow-green-500/50 ring-4 ring-green-500/30'
                  : 'border-white dark:border-darkblack-400'
              }`}
              style={{
                background: `linear-gradient(135deg, ${project.color}, ${adjustColor(project.color, -20)})`
              }}
            >
              {/* Progress Background */}
              <div
                className="absolute inset-0 bg-white/20"
                style={{
                  clipPath: `polygon(0 ${100 - project.progress_pct}%, 100% ${100 - project.progress_pct}%, 100% 100%, 0 100%)`
                }}
              />

              <div className="relative z-10 text-center px-2">
                <div className="text-white font-bold text-xs mb-0.5 leading-tight line-clamp-2">
                  {project.track_name}
                </div>
                <div className="text-white text-lg font-bold">
                  {Math.round(project.progress_pct)}%
                </div>
              </div>
            </div>

            {/* Active Selection Ring */}
            {activeProjectId === project.track_id && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-xl border-3 border-green-500"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <motion.div
                  className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-darkblack-600 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </motion.div>
              </>
            )}

            {/* Project Tooltip */}
            <AnimatePresence>
              {hoveredNode === project.track_id && (
                <motion.div
                  className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-white dark:bg-darkblack-500 px-4 py-2 rounded-xl shadow-xl border-2 border-bgray-200 dark:border-darkblack-400 z-50 min-w-[200px]"
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-sm font-bold text-darkblack-700 dark:text-white mb-2">
                    {project.track_name}
                  </div>
                  <div className="text-xs text-bgray-500 dark:text-bgray-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-bgray-100 dark:bg-darkblack-400 rounded">
                        {project.workflow_kind}
                      </span>
                      <span className="font-bold" style={{ color: project.color }}>
                        {Math.round(project.progress_pct)}%
                      </span>
                    </div>
                    {project.next_due_date && (
                      <div>📅 Due: {project.next_due_date}</div>
                    )}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                    Click to view workflow →
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <motion.div
          className="bg-white/95 dark:bg-darkblack-500/95 backdrop-blur-sm px-5 py-3 rounded-xl shadow-xl border-2 border-bgray-200 dark:border-darkblack-400"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-xs text-bgray-600 dark:text-bgray-300 font-medium">
            {selectedClient
              ? '💡 Click a project to view its workflow, or click outside to go back'
              : '🖱️ Drag to pan • Scroll to zoom • Click bubbles to explore'}
          </p>
        </motion.div>
      </div>
      </div> {/* Close zoomable container */}
    </div>
  );
}

// Website theme colors
function getHealthColor(avgProgress) {
  if (avgProgress >= 75) return '#22c55e'; // Success green
  if (avgProgress >= 50) return '#3b82f6'; // Primary blue
  if (avgProgress >= 25) return '#f59e0b'; // Warning orange
  return '#8b5cf6'; // Purple
}

function getProgressColor(progress) {
  const p = parseFloat(progress);
  if (p >= 80) return '#22c55e'; // Green
  if (p >= 50) return '#3b82f6'; // Blue
  if (p >= 25) return '#f59e0b'; // Orange
  return '#ef4444'; // Red
}

function adjustColor(color, amount) {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
