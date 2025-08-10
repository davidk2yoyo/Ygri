import { supabase } from "../supabaseClient";

// Status color mapping with safe fallbacks
export const STATUS_COLORS = {
  // Common project statuses
  active: "#3B82F6",      // blue-500
  completed: "#10B981",   // green-500
  on_hold: "#F59E0B",     // amber-500
  cancelled: "#EF4444",   // red-500
  planning: "#8B5CF6",    // purple-500
  in_progress: "#06B6D4", // cyan-500
  blocked: "#DC2626",     // red-600
  review: "#F97316",      // orange-500
  // Fallback for unknown statuses
  default: "#6B7280",     // gray-500
};

// Risk level colors
export const RISK_COLORS = {
  low: "#E5E7EB",    // gray-200
  medium: "#FCD34D", // yellow-300
  high: "#F87171",   // red-400
};

/**
 * Fetch all map data with optimized queries
 */
export async function fetchMapData() {
  try {
    console.log("Fetching map data...");
    
    // Batch all queries for optimal performance
    const [
      clientsResult,
      tracksResult,
      trackStagesResult,
      stageTemplatesResult,
      stageTodosResult,
      profilesResult
    ] = await Promise.all([
      // Fetch clients
      supabase
        .from("clients")
        .select("id, company_name, website, remark, contact_person, email, phone, owner_user_id, created_at"),
      
      // Fetch tracks (projects)
      supabase
        .from("tracks")
        .select("id, client_id, name, remarks, workflow_template_id, current_stage_template_id, status, owner_user_id, created_by, created_at"),
      
      // Fetch track stages
      supabase
        .from("track_stages")
        .select("id, track_id, stage_template_id, status, assignee_user_id, due_date, started_at, completed_at"),
      
      // Fetch stage templates
      supabase
        .from("stage_templates")
        .select("id, workflow_template_id, name, order_index, required, sla_days"),
      
      // Fetch stage todos
      supabase
        .from("stage_todos")
        .select("id, track_stage_id, title, is_done, due_date"),
      
      // Fetch user profiles
      supabase
        .from("profiles")
        .select("id, full_name")
    ]);

    // Check for errors
    if (clientsResult.error) throw clientsResult.error;
    if (tracksResult.error) throw tracksResult.error;
    if (trackStagesResult.error) throw trackStagesResult.error;
    if (stageTemplatesResult.error) throw stageTemplatesResult.error;
    if (stageTodosResult.error) throw stageTodosResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const data = {
      clients: clientsResult.data || [],
      tracks: tracksResult.data || [],
      trackStages: trackStagesResult.data || [],
      stageTemplates: stageTemplatesResult.data || [],
      stageTodos: stageTodosResult.data || [],
      profiles: profilesResult.data || []
    };

    console.log("Raw data loaded:", {
      clients: data.clients.length,
      tracks: data.tracks.length,
      trackStages: data.trackStages.length,
      stageTemplates: data.stageTemplates.length,
      stageTodos: data.stageTodos.length,
      profiles: data.profiles.length
    });

    return data;
  } catch (error) {
    console.error("Error fetching map data:", error);
    throw new Error(`Failed to load map data: ${error.message}`);
  }
}

/**
 * Process raw data into enriched format with derived fields
 */
export function processMapData(rawData) {
  const { clients, tracks, trackStages, stageTemplates, stageTodos, profiles } = rawData;

  console.log("Processing map data...");

  // Create lookup maps for efficient joins
  const profilesMap = new Map(profiles.map(p => [p.id, p]));
  const stageTemplatesMap = new Map(stageTemplates.map(st => [st.id, st]));
  const trackStagesMap = new Map();
  const stageTodosMap = new Map();

  // Group track stages by track_id
  trackStages.forEach(stage => {
    if (!trackStagesMap.has(stage.track_id)) {
      trackStagesMap.set(stage.track_id, []);
    }
    trackStagesMap.get(stage.track_id).push(stage);
  });

  // Group todos by track_stage_id
  stageTodos.forEach(todo => {
    if (!stageTodosMap.has(todo.track_stage_id)) {
      stageTodosMap.set(todo.track_stage_id, []);
    }
    stageTodosMap.get(todo.track_stage_id).push(todo);
  });

  // Process clients with enrichment
  const processedClients = clients.map(client => {
    const clientTracks = tracks.filter(track => track.client_id === client.id);
    
    // Calculate client-level risk
    let risk = "low";
    let hasOverdueProject = false;
    let hasSoonDueProject = false;
    let totalOverdueTodos = 0;

    clientTracks.forEach(track => {
      const processedTrack = processTrack(track, trackStagesMap, stageTemplatesMap, stageTodosMap, profilesMap);
      
      if (processedTrack.overdue) {
        hasOverdueProject = true;
      }
      
      if (processedTrack.nextDue) {
        const daysUntilDue = Math.ceil((new Date(processedTrack.nextDue) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 3) {
          hasSoonDueProject = true;
        }
      }
      
      totalOverdueTodos += processedTrack.overdueTodos;
    });

    // Determine risk level
    if (hasOverdueProject || totalOverdueTodos > 5) {
      risk = "high";
    } else if (hasSoonDueProject || totalOverdueTodos > 0) {
      risk = "medium";
    }

    return {
      ...client,
      ownerName: profilesMap.get(client.owner_user_id)?.full_name || "Unknown",
      tracks: clientTracks.map(track => 
        processTrack(track, trackStagesMap, stageTemplatesMap, stageTodosMap, profilesMap)
      ),
      risk,
      projectCounts: getProjectStatusCounts(clientTracks),
      totalOverdueTodos
    };
  });

  // Process standalone tracks (orphaned projects)
  const clientIds = new Set(clients.map(c => c.id));
  const orphanedTracks = tracks.filter(track => !clientIds.has(track.client_id));

  const processedData = {
    company: {
      id: "company",
      name: "Your Company", // Could be configurable
      totalClients: processedClients.length,
      totalProjects: tracks.length,
      projectCounts: getProjectStatusCounts(tracks),
      riskCounts: {
        high: processedClients.filter(c => c.risk === "high").length,
        medium: processedClients.filter(c => c.risk === "medium").length,
        low: processedClients.filter(c => c.risk === "low").length,
      }
    },
    clients: processedClients,
    orphanedTracks: orphanedTracks.map(track => 
      processTrack(track, trackStagesMap, stageTemplatesMap, stageTodosMap, profilesMap)
    ),
    allProfiles: profiles,
    statusColors: generateStatusColors(tracks)
  };

  console.log("Processed data:", {
    clients: processedData.clients.length,
    totalProjects: processedData.company.totalProjects,
    riskDistribution: processedData.company.riskCounts
  });

  return processedData;
}

/**
 * Process individual track with derived fields
 */
function processTrack(track, trackStagesMap, stageTemplatesMap, stageTodosMap, profilesMap) {
  const stages = trackStagesMap.get(track.id) || [];
  
  // Enrich stages with template info and todos
  const enrichedStages = stages.map(stage => {
    const template = stageTemplatesMap.get(stage.stage_template_id);
    const todos = stageTodosMap.get(stage.id) || [];
    
    return {
      ...stage,
      templateName: template?.name || "Unknown Stage",
      orderIndex: template?.order_index || 0,
      required: template?.required || false,
      slaDays: template?.sla_days || null,
      assigneeName: profilesMap.get(stage.assignee_user_id)?.full_name || null,
      todos: todos.map(todo => ({
        ...todo,
        isOverdue: todo.due_date && new Date(todo.due_date) < new Date() && !todo.is_done
      }))
    };
  }).sort((a, b) => a.orderIndex - b.orderIndex);

  // Calculate progress
  const requiredStages = enrichedStages.filter(stage => stage.required);
  const completedRequiredStages = requiredStages.filter(stage => stage.status === "completed");
  const progress = requiredStages.length > 0 
    ? (completedRequiredStages.length / requiredStages.length) * 100 
    : 0;

  // Find next due date
  const incompleteRequiredStages = requiredStages.filter(stage => stage.status !== "completed");
  const dueDates = incompleteRequiredStages
    .filter(stage => stage.due_date)
    .map(stage => new Date(stage.due_date))
    .sort((a, b) => a - b);
  const nextDue = dueDates.length > 0 ? dueDates[0].toISOString().split('T')[0] : null;

  // Check for overdue stages
  const today = new Date();
  const overdue = incompleteRequiredStages.some(stage => 
    stage.due_date && new Date(stage.due_date) < today
  );

  // Count overdue todos
  const overdueTodos = enrichedStages.reduce((count, stage) => 
    count + stage.todos.filter(todo => todo.isOverdue).length, 0
  );

  return {
    ...track,
    ownerName: profilesMap.get(track.owner_user_id)?.full_name || "Unknown",
    creatorName: profilesMap.get(track.created_by)?.full_name || "Unknown",
    stages: enrichedStages,
    progress: Math.round(progress),
    nextDue,
    overdue,
    overdueTodos,
    stageCount: enrichedStages.length,
    completedStages: completedRequiredStages.length,
    totalRequiredStages: requiredStages.length
  };
}

/**
 * Generate status colors for all unique statuses found in tracks
 */
function generateStatusColors(tracks) {
  const uniqueStatuses = [...new Set(tracks.map(track => track.status))];
  const colors = { ...STATUS_COLORS };
  
  // Assign colors to unknown statuses
  const unassignedStatuses = uniqueStatuses.filter(status => !colors[status]);
  const fallbackColors = [
    "#8B5CF6", "#F59E0B", "#06B6D4", "#F97316", 
    "#84CC16", "#EC4899", "#14B8A6", "#A855F7"
  ];
  
  unassignedStatuses.forEach((status, index) => {
    colors[status] = fallbackColors[index % fallbackColors.length] || STATUS_COLORS.default;
  });
  
  return colors;
}

/**
 * Get project counts by status
 */
function getProjectStatusCounts(tracks) {
  const counts = {};
  tracks.forEach(track => {
    counts[track.status] = (counts[track.status] || 0) + 1;
  });
  return counts;
}

/**
 * Create tree layout positioning
 */
export function createTreeLayout(processedData, filters, collapsedClients, options = {}) {
  const nodes = [];
  const edges = [];
  const { densityMode = "overview", zoomLevel = 1 } = options;
  
  const filteredData = applyFilters(processedData, filters);
  
  // Company root node
  nodes.push({
    id: "company",
    type: "company",
    position: { x: 0, y: 0 },
    data: { 
      ...filteredData.company,
      label: filteredData.company.name,
      densityMode,
      zoomLevel
    },
    draggable: false,
  });

  // Position clients in tree structure with reduced spacing
  const clientSpacing = densityMode === "details" ? 280 : 240; // Reduced spacing
  const projectSpacing = densityMode === "details" ? 180 : 150; // Reduced spacing
  let currentY = 180;

  filteredData.clients.forEach((client, clientIndex) => {
    const clientId = `client-${client.id}`;
    const clientX = -400 + (clientIndex % 3) * 400;
    
    // Client node with enhanced data
    nodes.push({
      id: clientId,
      type: "client",
      position: { x: clientX, y: currentY },
      data: { 
        ...client,
        label: client.company_name,
        collapsed: collapsedClients.has(clientId),
        densityMode,
        zoomLevel,
        showLabels: zoomLevel > 0.6
      },
      draggable: true,
    });

    // Edge from company to client - hidden by default
    edges.push({
      id: `company-${clientId}`,
      source: "company",
      target: clientId,
      type: "smoothstep",
      animated: false,
      style: { opacity: 0 }, // Hidden by default
      className: "transition-opacity duration-220",
    });

    // Project nodes (if client not collapsed)
    if (!collapsedClients.has(clientId)) {
      client.tracks.forEach((track, trackIndex) => {
        const projectId = `project-${track.id}`;
        const projectX = clientX + (trackIndex - (client.tracks.length - 1) / 2) * projectSpacing;
        const projectY = currentY + (densityMode === "details" ? 140 : 120);

        nodes.push({
          id: projectId,
          type: "project",
          position: { x: projectX, y: projectY },
          data: { 
            ...track,
            label: track.name,
            clientName: client.company_name,
            densityMode,
            zoomLevel,
            showLabels: zoomLevel > 0.8
          },
          draggable: true,
        });

        // Edge from client to project - hidden by default
        edges.push({
          id: `${clientId}-${projectId}`,
          source: clientId,
          target: projectId,
          type: "smoothstep",
          animated: track.overdue,
          style: { opacity: 0 }, // Hidden by default
          className: "transition-opacity duration-220",
        });
      });
    }

    currentY += clientSpacing;
  });

  return { nodes, edges };
}

/**
 * Create radial layout positioning
 */
export function createRadialLayout(processedData, filters, collapsedClients, options = {}) {
  const nodes = [];
  const edges = [];
  const { densityMode = "overview", zoomLevel = 1 } = options;
  
  const filteredData = applyFilters(processedData, filters);
  
  // Company center node - always at origin for true radial layout
  nodes.push({
    id: "company",
    type: "company",
    position: { x: 0, y: 0 },
    data: { 
      ...filteredData.company,
      label: filteredData.company.name,
      densityMode,
      zoomLevel
    },
    draggable: false,
  });

  // Ring 1: Position clients in perfect circle around company
  const clientRadius = densityMode === "details" ? 350 : 280; // Reduced spacing
  const clientCount = filteredData.clients.length;
  const angleStep = (2 * Math.PI) / Math.max(clientCount, 1);
  
  // Add collision padding for better spacing
  const minNodeDistance = densityMode === "details" ? 120 : 100;
  const adjustedRadius = Math.max(clientRadius, (clientCount * minNodeDistance) / (2 * Math.PI));
  
  filteredData.clients.forEach((client, clientIndex) => {
    const clientId = `client-${client.id}`;
    const angle = angleStep * clientIndex;
    const clientX = Math.cos(angle) * adjustedRadius;
    const clientY = Math.sin(angle) * adjustedRadius;
    
    // Client node with enhanced data
    nodes.push({
      id: clientId,
      type: "client",
      position: { x: clientX, y: clientY },
      data: { 
        ...client,
        label: client.company_name,
        collapsed: collapsedClients.has(clientId),
        densityMode,
        zoomLevel,
        showLabels: zoomLevel > 0.6
      },
      draggable: true,
    });

    // Edge from company to client - hidden by default
    edges.push({
      id: `company-${clientId}`,
      source: "company",
      target: clientId,
      type: "straight",
      animated: false,
      style: { opacity: 0 }, // Hidden by default
      className: "transition-opacity duration-220",
      data: {
        showLabel: true,
        labelText: client.tracks.length.toString(),
        isRootToClient: true
      }
    });

    // Ring 2+: Projects only shown when client is expanded
    if (!collapsedClients.has(clientId) && client.tracks.length > 0) {
      const projectRadius = densityMode === "details" ? 180 : 140; // Reduced spacing
      const maxVisibleProjects = densityMode === "details" ? 12 : 8; // Cap visible projects
      const totalProjects = client.tracks.length;
      const visibleTracks = client.tracks.slice(0, maxVisibleProjects);
      const hasMoreProjects = totalProjects > maxVisibleProjects;
      
      // Update client data to show +N more badge
      const clientNodeIndex = nodes.findIndex(n => n.id === clientId);
      if (clientNodeIndex !== -1 && hasMoreProjects) {
        nodes[clientNodeIndex].data = {
          ...nodes[clientNodeIndex].data,
          hiddenProjectCount: totalProjects - maxVisibleProjects
        };
      }
      
      // Arrange projects in arc around client for single project, circle for multiple  
      const projectCount = visibleTracks.length;
      
      if (projectCount === 1) {
        const track = visibleTracks[0];
        const projectId = `project-${track.id}`;
        const projectX = clientX + Math.cos(angle + Math.PI) * projectRadius;
        const projectY = clientY + Math.sin(angle + Math.PI) * projectRadius;

        nodes.push({
          id: projectId,
          type: "project",
          position: { x: projectX, y: projectY },
          data: { 
            ...track,
            label: track.name,
            clientName: client.company_name,
            densityMode,
            zoomLevel,
            showLabels: zoomLevel > 0.8
          },
          draggable: true,
        });
      } else {
        // Multiple projects in arc with collision avoidance
        const projectAngleSpan = Math.PI * 0.8; // 144 degrees
        let projectAngleStep = projectAngleSpan / Math.max(projectCount - 1, 1);
        
        // Add slight angle nudges for collision avoidance when clients are close
        const angleNudge = Math.sin(clientIndex * 0.7) * 0.1; // ±4-6 degrees
        const startAngle = angle - projectAngleSpan / 2 + angleNudge;
        
        visibleTracks.forEach((track, trackIndex) => {
          const projectId = `project-${track.id}`;
          const projectAngle = startAngle + (projectAngleStep * trackIndex);
          const projectX = clientX + Math.cos(projectAngle) * projectRadius;
          const projectY = clientY + Math.sin(projectAngle) * projectRadius;

          nodes.push({
            id: projectId,
            type: "project",
            position: { x: projectX, y: projectY },
            data: { 
              ...track,
              label: track.name,
              clientName: client.company_name,
              densityMode,
              zoomLevel,
              showLabels: zoomLevel > 0.8
            },
            draggable: true,
          });
        });
      }

      // Edges from client to projects with smart Bézier curves (only for visible projects)
      visibleTracks.forEach((track, trackIndex) => {
        const projectId = `project-${track.id}`;
        const projectNode = nodes.find(n => n.id === projectId);
        const clientNode = nodes.find(n => n.id === clientId);
        
        if (projectNode && clientNode) {
          // Calculate control points for smooth fan-out arcs
          const dx = projectNode.position.x - clientNode.position.x;
          const dy = projectNode.position.y - clientNode.position.y;
          
          // Create control point that curves outward from the client
          const midX = clientNode.position.x + dx * 0.3;
          const midY = clientNode.position.y + dy * 0.3;
          
          // Add slight curvature perpendicular to the connection
          const perpX = -dy * 0.1;
          const perpY = dx * 0.1;
          
          edges.push({
            id: `${clientId}-${projectId}`,
            source: clientId,
            target: projectId,
            type: "custom", // Use custom edge for better control
            animated: track.overdue,
            style: { 
              opacity: 0, // Hidden by default
            },
            className: "transition-all duration-220",
            data: {
              projectStatus: track.status,
              isOverdue: track.overdue,
              clientAngle: angle,
              projectIndex: trackIndex,
              totalProjects: client.tracks.length,
              showLabel: false, // Labels only for root→client edges
              isClientToProject: true
            }
          });
        }
      });
    }
  });

  return { nodes, edges };
}

/**
 * Apply filters to processed data
 */
function applyFilters(processedData, filters) {
  let filteredClients = [...processedData.clients];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredClients = filteredClients.filter(client => 
      client.company_name.toLowerCase().includes(searchLower) ||
      client.tracks.some(track => track.name.toLowerCase().includes(searchLower))
    );
  }

  // Status filter
  if (filters.status) {
    filteredClients = filteredClients.map(client => ({
      ...client,
      tracks: client.tracks.filter(track => track.status === filters.status)
    })).filter(client => client.tracks.length > 0);
  }

  // Owner filter
  if (filters.owner) {
    filteredClients = filteredClients.map(client => ({
      ...client,
      tracks: client.tracks.filter(track => track.owner_user_id === filters.owner)
    })).filter(client => client.tracks.length > 0);
  }

  // Active only filter
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