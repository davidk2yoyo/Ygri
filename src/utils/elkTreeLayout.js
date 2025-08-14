import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// ELK layout configuration for horizontal hierarchical tree layout
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.thoroughness': '3',
  'elk.spacing.componentComponent': '20'
};

/**
 * Create ELK-based tree layout with proper wiring
 */
export async function createELKTreeLayout(processedData, filters, collapsedClients, options = {}) {
  const { densityMode = "overview", zoomLevel = 1 } = options;
  const filteredData = applyFilters(processedData, filters);
  
  // Prepare ELK graph structure
  const elkGraph = {
    id: "root",
    layoutOptions: elkOptions,
    children: [],
    edges: []
  };

  // Company root node
  const companyNodeWidth = getNodeWidth("company", densityMode);
  const companyNodeHeight = getNodeHeight("company", densityMode);
  
  elkGraph.children.push({
    id: "company",
    width: companyNodeWidth,
    height: companyNodeHeight,
    layoutOptions: {
      'elk.layered.priority.direction': '100', // Higher priority to place first in layout
      'elk.portConstraints': 'FIXED_SIDE'
    }
  });

  // Client nodes in columns
  filteredData.clients.forEach((client, clientIndex) => {
    const clientId = `client-${client.id}`;
    const clientWidth = getNodeWidth("client", densityMode);
    const clientHeight = getNodeHeight("client", densityMode);
    
    elkGraph.children.push({
      id: clientId,
      width: clientWidth,
      height: clientHeight,
      layoutOptions: {
        'elk.portConstraints': 'FIXED_SIDE'
      }
    });

    // Root to client edge (always visible)
    elkGraph.edges.push({
      id: `company-${clientId}`,
      sources: ["company"],
      targets: [clientId]
    });

    // Project nodes (only if client expanded)
    if (!collapsedClients.has(clientId) && client.tracks.length > 0) {
      client.tracks.forEach((track, trackIndex) => {
        const projectId = `project-${track.id}`;
        const projectWidth = getNodeWidth("project", densityMode);
        const projectHeight = getNodeHeight("project", densityMode);
        
        elkGraph.children.push({
          id: projectId,
          width: projectWidth,
          height: projectHeight
        });

        // Client to project edge (visible when expanded)
        elkGraph.edges.push({
          id: `${clientId}-${projectId}`,
          sources: [clientId],
          targets: [projectId]
        });
      });
    }
  });

  // Run ELK layout
  const layoutedGraph = await elk.layout(elkGraph);
  
  // Convert ELK results to React Flow format
  const nodes = [];
  const edges = [];

  // Process nodes
  layoutedGraph.children.forEach(elkNode => {
    if (elkNode.id === "company") {
      nodes.push({
        id: "company",
        type: "company",
        position: { x: elkNode.x, y: elkNode.y },
        data: {
          ...filteredData.company,
          label: filteredData.company.name,
          densityMode,
          zoomLevel
        },
        draggable: false,
        style: { width: elkNode.width, height: elkNode.height }
      });
    } else if (elkNode.id.startsWith("client-")) {
      const clientId = elkNode.id.replace("client-", "");
      const client = filteredData.clients.find(c => c.id === clientId);
      
      if (client) {
        nodes.push({
          id: elkNode.id,
          type: "treeClient",
          position: { x: elkNode.x, y: elkNode.y },
          data: {
            ...client,
            label: client.company_name,
            collapsed: collapsedClients.has(elkNode.id),
            densityMode,
            zoomLevel,
            showLabels: zoomLevel > 0.4
          },
          draggable: true,
          style: { width: elkNode.width, height: elkNode.height }
        });
      }
    } else if (elkNode.id.startsWith("project-")) {
      const trackId = elkNode.id.replace("project-", "");
      const track = findTrackById(filteredData.clients, trackId);
      
      if (track) {
        nodes.push({
          id: elkNode.id,
          type: "treeProject",
          position: { x: elkNode.x, y: elkNode.y },
          data: {
            ...track,
            label: track.name,
            densityMode,
            zoomLevel,
            showLabels: zoomLevel > 0.6
          },
          draggable: true,
          style: { width: elkNode.width, height: elkNode.height }
        });
      }
    }
  });

  // Process edges with proper orthogonal routing
  layoutedGraph.edges.forEach(elkEdge => {
    const isRootToClient = elkEdge.sources[0] === "company";
    
    const edge = {
      id: elkEdge.id,
      source: elkEdge.sources[0],
      target: elkEdge.targets[0],
      type: 'orthogonal',
      animated: false,
      style: {
        strokeWidth: 1,
        opacity: isRootToClient ? 0.3 : 0, // Root→client always visible, client→project hidden initially
        stroke: '#6B7280'
      },
      data: {
        isRootToClient,
        elkRouting: elkEdge.sections || [],
        showEndDot: !isRootToClient
      },
      markerEnd: !isRootToClient ? {
        type: 'dot',
        width: 4,
        height: 4,
        strokeWidth: 0
      } : undefined
    };

    edges.push(edge);
  });

  // Apply collision detection and compaction
  const { compactedNodes } = applyCollisionCompaction(nodes, edges);
  
  return { 
    nodes: compactedNodes, 
    edges,
    elkGraph: layoutedGraph 
  };
}

/**
 * Get node width based on type and density mode
 */
function getNodeWidth(nodeType, densityMode) {
  const widths = {
    company: densityMode === "overview" ? 120 : 180,
    client: densityMode === "overview" ? 140 : densityMode === "details" ? 220 : 180,
    project: densityMode === "overview" ? 100 : densityMode === "details" ? 160 : 120
  };
  return widths[nodeType] || 120;
}

/**
 * Get node height based on type and density mode
 */
function getNodeHeight(nodeType, densityMode) {
  const heights = {
    company: densityMode === "overview" ? 60 : 80,
    client: densityMode === "overview" ? 80 : densityMode === "details" ? 120 : 100,
    project: densityMode === "overview" ? 50 : densityMode === "details" ? 80 : 60
  };
  return heights[nodeType] || 60;
}

/**
 * Find track by ID across all clients
 */
function findTrackById(clients, trackId) {
  for (const client of clients) {
    const track = client.tracks.find(t => t.id === trackId);
    if (track) {
      return { ...track, clientName: client.company_name };
    }
  }
  return null;
}

/**
 * Apply collision detection and compaction pass
 */
function applyCollisionCompaction(nodes, edges, maxIterations = 3) {
  let compactedNodes = [...nodes];
  const minGap = 12;
  
  // Group nodes by approximate layers (x position)
  const layers = {};
  compactedNodes.forEach(node => {
    const layerX = Math.round(node.position.x / 100) * 100; // Round to nearest 100
    if (!layers[layerX]) layers[layerX] = [];
    layers[layerX].push(node);
  });

  // Sort each layer by Y position and apply collision detection
  Object.keys(layers).forEach(layerKey => {
    const layerNodes = layers[layerKey].sort((a, b) => a.position.y - b.position.y);
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let hadCollisions = false;
      
      for (let i = 1; i < layerNodes.length; i++) {
        const currentNode = layerNodes[i];
        const prevNode = layerNodes[i - 1];
        
        const currentTop = currentNode.position.y;
        const prevBottom = prevNode.position.y + prevNode.style.height;
        
        if (currentTop < prevBottom + minGap) {
          // Collision detected, nudge current node down
          currentNode.position.y = prevBottom + minGap;
          hadCollisions = true;
        }
      }
      
      if (!hadCollisions) break; // No more collisions, stop iterating
    }
  });

  return { compactedNodes };
}

/**
 * Apply filters to processed data (same as mapUtils)
 */
function applyFilters(processedData, filters) {
  let filteredClients = [...processedData.clients];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredClients = filteredClients.filter(client => 
      client.company_name.toLowerCase().includes(searchLower) ||
      client.tracks.some(track => track.name.toLowerCase().includes(searchLower))
    );
  }

  if (filters.status) {
    filteredClients = filteredClients.map(client => ({
      ...client,
      tracks: client.tracks.filter(track => track.status === filters.status)
    })).filter(client => client.tracks.length > 0);
  }

  if (filters.owner) {
    filteredClients = filteredClients.map(client => ({
      ...client,
      tracks: client.tracks.filter(track => track.owner_user_id === filters.owner)
    })).filter(client => client.tracks.length > 0);
  }

  if (filters.activeOnly) {
    const terminalStatuses = ["completed", "cancelled", "archived"];
    filteredClients = filteredClients.map(client => ({
      ...client,
      tracks: client.tracks.filter(track => !terminalStatuses.includes(track.status))
    })).filter(client => client.tracks.length > 0);
  }

  return {
    ...processedData,
    clients: filteredClients
  };
}