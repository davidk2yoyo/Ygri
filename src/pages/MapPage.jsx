import React, { useState, useEffect, useMemo, useCallback } from "react";
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useReactFlow,
  Panel,
  ReactFlowProvider 
} from "reactflow";
import "reactflow/dist/style.css";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";

// Custom Node Components
import CompanyNode from "../components/map/CompanyNode";
import ClientNode from "../components/map/ClientNode";
import ProjectNode from "../components/map/ProjectNode";

// Custom Edge Components
import CustomEdge from "../components/map/CustomEdge";
import OrthogonalEdge from "../components/map/OrthogonalEdge";

// Tree-specific Node Components
import TreeClientNode from "../components/map/TreeClientNode";
import TreeProjectNode from "../components/map/TreeProjectNode";

// Map Components
import MapControls from "../components/map/MapControls";
import MapLegend from "../components/map/MapLegend";
import DetailsPanel from "../components/map/DetailsPanel";
import SavedViews from "../components/map/SavedViews";

// Utilities
import { 
  fetchMapData, 
  processMapData, 
  createTreeLayout, 
  createRadialLayout 
} from "../utils/mapUtils";
import { createELKTreeLayout } from "../utils/elkTreeLayout";

const nodeTypes = {
  company: CompanyNode,
  client: ClientNode,
  project: ProjectNode,
  treeClient: TreeClientNode,
  treeProject: TreeProjectNode,
};

const edgeTypes = {
  custom: CustomEdge,
  orthogonal: OrthogonalEdge,
};

export default function MapPage() {
  return (
    <ReactFlowProvider>
      <MapPageInner />
    </ReactFlowProvider>
  );
}

function MapPageInner() {
  const { t } = useTranslation();
  // State Management
  const [rawData, setRawData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // View State
  const [layoutMode, setLayoutMode] = useState("radial"); // hierarchical | radial
  const [densityMode, setDensityMode] = useState("overview"); // overview | details
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [collapsedClients, setCollapsedClients] = useState(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [clickedNodeId, setClickedNodeId] = useState(null);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Radial Layout Parameters
  const [projectsOutside, setProjectsOutside] = useState(true);
  const [density, setDensity] = useState(200); // 0-300 (increased range)
  const [maxProjectsPerRing, setMaxProjectsPerRing] = useState(4); // 2-8

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    owner: "",
    activeOnly: false,
  });

  // Saved Views
  const [savedViews, setSavedViews] = useState([]);
  const [currentViewName, setCurrentViewName] = useState("");

  // ReactFlow hooks
  const reactFlow = useReactFlow();

  // Data fetching
  const loadMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      
      const data = await fetchMapData();
      const processed = processMapData(data);
      
      setRawData(data);
      setProcessedData(processed);
    } catch (err) {
      setError(err.message);
      console.error("Map data loading error:", err);
    } finally {
      setLoading(false);
    }
  }, []);


  // Generate visualization
  const generateVisualization = useCallback(async () => {
    if (!processedData) return;

    let newNodes, newEdges;
    
    if (layoutMode === "hierarchical") {
      // Use ELK for professional hierarchical layout
      const result = await createELKTreeLayout(processedData, filters, collapsedClients, { densityMode, zoomLevel });
      newNodes = result.nodes;
      newEdges = result.edges;
    } else {
      // Use existing radial layout with new parameters
      const result = createRadialLayout(processedData, filters, collapsedClients, { 
        densityMode, 
        zoomLevel,
        projectsOutside,
        density,
        maxProjectsPerRing
      });
      newNodes = result.nodes;
      newEdges = result.edges;
    }

    // Simplified edge visibility - static visibility to prevent hover issues
    const getEdgeVisibility = (edge, hoveredId, clickedId, focusedId, zoomLevel, isHierarchicalMode = false) => {
      const isRootToClient = edge.source === "company";
      
      // Fixed opacity - no hover effects to prevent disappearing nodes
      let baseOpacity = 0.4;
      let thickness = 1;
      
      if (isHierarchicalMode) {
        baseOpacity = isRootToClient ? 0.3 : 0.4;
        thickness = 1;
      } else {
        baseOpacity = isRootToClient ? 0.3 : 0.5;
        thickness = isRootToClient ? 1 : 1.5;
      }
      
      return {
        visible: true,
        opacity: baseOpacity, // Fixed opacity, no hover changes
        strokeWidth: thickness // Fixed thickness, no hover changes
      };
    };

    // Simplified edge color - static color to prevent hover issues
    const getEdgeColor = (edge, hoveredId, clickedId, focusedId) => {
      // Always return the same color - no hover effects
      return "#6B7280";
    };

    // Check if node is related to focused node
    const isNodeRelated = (nodeId, focusedId) => {
      if (!focusedId || !newEdges.length) return false;
      return newEdges.some(edge => 
        (edge.source === nodeId && edge.target === focusedId) ||
        (edge.source === focusedId && edge.target === nodeId)
      );
    };

    // Focus effect - dim unrelated nodes when one is clicked
    const processedNodes = newNodes.map(node => {
      let nodeOpacity = 1;
      
      // If a node is focused, dim others except the focused one and its connections
      if (focusedNodeId && focusedNodeId !== node.id) {
        // Check if this node is connected to the focused node
        const isConnected = isNodeRelated(node.id, focusedNodeId);
        nodeOpacity = isConnected ? 1 : 0.3; // Dim unrelated nodes
      }
      
      return {
        ...node,
        style: {
          ...node.style,
          opacity: nodeOpacity,
          transition: "opacity 300ms ease-out" // Smooth transition for focus effect
        }
      };
    });

    // Edge processing with focus highlighting
    const processedEdges = newEdges.map(edge => {
      const visibility = getEdgeVisibility(edge, null, clickedNodeId, focusedNodeId, zoomLevel, layoutMode === "hierarchical");
      
      let edgeOpacity = visibility.opacity;
      let strokeWidth = visibility.strokeWidth;
      
      // Highlight edges connected to focused node
      if (focusedNodeId) {
        if (edge.source === focusedNodeId || edge.target === focusedNodeId) {
          // Connected to focused node - highlight
          edgeOpacity = 0.8;
          strokeWidth = 2;
        } else {
          // Not connected to focused node - dim
          edgeOpacity = 0.2;
          strokeWidth = 1;
        }
      }
      
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: edgeOpacity,
          strokeWidth: strokeWidth,
          stroke: getEdgeColor(edge, null, clickedNodeId, focusedNodeId),
          transition: "all 300ms ease-out", // Smooth transition for focus effect
          zIndex: 1,
        },
        data: {
          ...edge.data,
          zoomLevel,
          showLabel: false,
        },
        markerEnd: edge.source !== "company" ? {
          type: "dot",
          width: 4,
          height: 4,
          strokeWidth: 0
        } : undefined
      };
    });

    setNodes(processedNodes);
    setEdges(processedEdges);
    
    // Auto-fit view only on initial load or layout mode change
    if (nodes.length === 0) {
      setTimeout(() => {
        reactFlow.fitView({ 
          padding: 0.15, 
          duration: 300 
        });
      }, 100);
    }
  }, [processedData, layoutMode, filters, collapsedClients, densityMode, zoomLevel, focusedNodeId, clickedNodeId, projectsOutside, density, maxProjectsPerRing, reactFlow]);

  // Effects
  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  useEffect(() => {
    generateVisualization().catch(console.error);
  }, [generateVisualization]);

  // Load saved views from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("mapSavedViews");
    if (saved) {
      setSavedViews(JSON.parse(saved));
    }

    // Check URL params for view
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get("view");
    if (viewId) {
      loadSavedView(viewId);
    }
  }, []);

  // Event Handlers
  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setDetailsPanelOpen(true);
    setFocusedNodeId(node.id);
    setClickedNodeId(node.id);
    
    // Auto zoom-to-fit neighborhood for clients
    if (node.type === "client") {
      const relatedNodes = [node];
      // Add connected projects
      const projectNodes = nodes.filter(n => 
        n.type === "project" && 
        edges.some(e => e.source === node.id && e.target === n.id)
      );
      relatedNodes.push(...projectNodes);
      
      setTimeout(() => {
        reactFlow.fitView({
          nodes: relatedNodes,
          padding: 0.2,
          duration: 220
        });
      }, 100);
    }
    
    // Highlight path to node
    const path = getPathToNode(node.id, processedData);
    highlightPath(path);
  }, [processedData, nodes, edges, reactFlow]);

  const handleNodeMouseEnter = useCallback((event, node) => {
    // Completely disabled hover tracking to prevent disappearing nodes
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    // Completely disabled hover tracking to prevent disappearing nodes
  }, []);

  const handleNodeDoubleClick = useCallback((event, node) => {
    if (node.type === "client") {
      setCollapsedClients(prev => {
        const newSet = new Set(prev);
        if (newSet.has(node.id)) {
          newSet.delete(node.id);
        } else {
          newSet.add(node.id);
        }
        return newSet;
      });
    }
  }, []);

  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    // Show context menu with focus/collapse options
    showContextMenu(event, node);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setDetailsPanelOpen(false);
    setFocusedNodeId(null);
    setClickedNodeId(null);
    clearHighlights();
  }, []);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
    // Removed auto-fit on filter changes to prevent canvas reset issues
  }, []);

  const handleLayoutToggle = useCallback(() => {
    const newMode = layoutMode === "hierarchical" ? "radial" : "hierarchical";
    setLayoutMode(newMode);
    
    // Fit view after layout change with a delay to allow for layout calculation
    setTimeout(() => {
      reactFlow.fitView({ 
        padding: newMode === "hierarchical" ? 0.1 : 0.15, 
        duration: 500 
      });
    }, 400);
  }, [layoutMode, reactFlow]);

  const handleDensityToggle = useCallback(() => {
    setDensityMode(prev => prev === "overview" ? "details" : "overview");
  }, []);

  const handleZoomChange = useCallback((viewport) => {
    setZoomLevel(viewport.zoom);
    // Removed auto-switch density to prevent interference with user control
  }, []);

  const handleFocusMode = useCallback((nodeId) => {
    setFocusedNodeId(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      reactFlow.fitView({ 
        nodes: [node],
        padding: 0.3,
        duration: 220
      });
    }
  }, [nodes, reactFlow]);


  const handleSaveView = useCallback((viewName) => {
    const viewData = {
      id: Date.now().toString(),
      name: viewName,
      layoutMode,
      filters,
      collapsedClients: Array.from(collapsedClients),
      viewport: reactFlow.getViewport(),
      created: new Date().toISOString(),
    };

    const newSavedViews = [...savedViews, viewData];
    setSavedViews(newSavedViews);
    localStorage.setItem("mapSavedViews", JSON.stringify(newSavedViews));
    setCurrentViewName(viewName);
  }, [layoutMode, filters, collapsedClients, savedViews, reactFlow]);

  const loadSavedView = useCallback((viewId) => {
    const view = savedViews.find(v => v.id === viewId);
    if (!view) return;

    setLayoutMode(view.layoutMode);
    setFilters(view.filters);
    setCollapsedClients(new Set(view.collapsedClients));
    setCurrentViewName(view.name);
    
    // Set viewport after a brief delay to ensure layout is ready
    setTimeout(() => {
      reactFlow.setViewport(view.viewport);
    }, 100);
  }, [savedViews, reactFlow]);

  const handleExportPNG = useCallback(async () => {
    try {
      // Use ReactFlow's built-in export functionality
      const dataUrl = await reactFlow.getViewport();
      // Implementation details for PNG export would go here
      console.log("Export PNG functionality to be implemented");
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [reactFlow]);

  const handleFocusNode = useCallback((nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      reactFlow.fitView({ 
        nodes: [node],
        padding: 0.3,
        duration: 800
      });
    }
  }, [nodes, reactFlow]);

  // Helper functions
  const getPathToNode = (nodeId, data) => {
    // Implementation for getting path from company to specific node
    return [];
  };

  const highlightPath = (path) => {
    // Implementation for highlighting path
  };

  const clearHighlights = () => {
    // Implementation for clearing highlights
  };

  const showContextMenu = (event, node) => {
    // Implementation for context menu
  };


  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "f" && selectedNode) {
        handleFocusNode(selectedNode.id);
      } else if (event.key === "Escape") {
        setSelectedNode(null);
        setDetailsPanelOpen(false);
        clearHighlights();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, handleFocusNode]);

  // Render loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center space-x-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600 dark:text-gray-300">{t("loadingCompanyMap")}</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ {t("errorLoadingMap")}</div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={loadMapData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center space-x-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600 dark:text-gray-300">{t("loadingCompanyMap")}</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ {t("errorLoadingMap")}</div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={loadMapData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative bg-gray-50 dark:bg-gray-900 font-urbanist">
      {/* Main ReactFlow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onPaneClick={handlePaneClick}
        onMoveEnd={(event, viewport) => handleZoomChange(viewport)}
        fitView
        attributionPosition="bottom-left"
        className="bg-gray-50 dark:bg-gray-900"
      >
        {/* Background */}
        <Background 
          variant="dots" 
          gap={20} 
          size={1} 
          className="opacity-30"
        />
        
        {/* Controls */}
        <Controls 
          position="top-left"
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
        />
        
        {/* Mini Map */}
        <MiniMap 
          position="bottom-right"
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
          nodeColor="#3B82F6"
          maskColor="rgba(0, 0, 0, 0.1)"
        />

        {/* Top Controls Panel - Slimmed */}
        <Panel position="top-center" className="flex items-center bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-md p-2 border border-gray-200 dark:border-gray-700">
          <MapControls
            layoutMode={layoutMode}
            densityMode={densityMode}
            filters={filters}
            onLayoutToggle={handleLayoutToggle}
            onDensityToggle={handleDensityToggle}
            onFilterChange={handleFilterChange}
            onFocusMode={handleFocusMode}
            projectsOutside={projectsOutside}
            onProjectsOutsideToggle={setProjectsOutside}
            density={density}
            onDensityChange={setDensity}
            maxProjectsPerRing={maxProjectsPerRing}
            onMaxProjectsPerRingChange={setMaxProjectsPerRing}
          />
        </Panel>

        {/* Legend Toggle Button */}
        <Panel position="top-right" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setLegendCollapsed(!legendCollapsed)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
            title={legendCollapsed ? t("showLegend") : t("hideLegend")}
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${legendCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </Panel>

        {/* Saved Views Panel - Moved lower */}
        <Panel position="bottom-right" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <SavedViews
            savedViews={savedViews}
            currentViewName={currentViewName}
            onSaveView={handleSaveView}
            onLoadView={loadSavedView}
            onDeleteView={(viewId) => {
              const newViews = savedViews.filter(v => v.id !== viewId);
              setSavedViews(newViews);
              localStorage.setItem("mapSavedViews", JSON.stringify(newViews));
            }}
          />
        </Panel>
      </ReactFlow>

      {/* Legend Rail */}
      <div className={`absolute top-0 right-0 h-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-l border-gray-200 dark:border-gray-700 transition-transform duration-220 ease-out ${
        legendCollapsed ? 'translate-x-full' : 'translate-x-0'
      } w-64 z-10 shadow-lg`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t("legend")}</h3>
            <button
              onClick={() => setLegendCollapsed(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <MapLegend processedData={processedData} />
        </div>
      </div>

      {/* Details Panel */}
      <DetailsPanel
        isOpen={detailsPanelOpen}
        selectedNode={selectedNode}
        processedData={processedData}
        onClose={() => {
          setDetailsPanelOpen(false);
          setSelectedNode(null);
          setFocusedNodeId(null);
          clearHighlights();
        }}
        onFocusNode={handleFocusMode}
      />
    </div>
  );
}