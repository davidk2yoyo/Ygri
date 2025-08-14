import type { Node, Edge } from 'reactflow';

// Types for the layout system
export interface LayoutParams {
  radiusClient: number;        // Distance from center to client ring
  ringGap: number;            // Distance from client ring to first project ring
  projectGap: number;         // Distance between projects along the spoke
  arcSpread: number;          // Angular spread between sibling projects (radians)
  maxPerRing: number;         // Maximum projects per ring before starting new ring
  projectsOutside: boolean;   // Toggle for projects outside client ring
}

export interface ClientProjectMapping {
  [clientId: string]: string[];
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

// Polar coordinate helpers
export const polarToCartesian = (radius: number, angle: number, centerX: number = 0, centerY: number = 0) => ({
  x: centerX + radius * Math.cos(angle),
  y: centerY + radius * Math.sin(angle)
});

export const cartesianToPolar = (x: number, y: number, centerX: number = 0, centerY: number = 0) => {
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    radius: Math.sqrt(dx * dx + dy * dy),
    angle: Math.atan2(dy, dx)
  };
};

// Default layout parameters
export const DEFAULT_LAYOUT_PARAMS: LayoutParams = {
  radiusClient: 300,
  ringGap: 150,
  projectGap: 80,
  arcSpread: 0.15, // ~8.6 degrees
  maxPerRing: 4,
  projectsOutside: true
};

/**
 * Creates a radial spokes layout where clients form a ring around the center,
 * and projects extend outward along spokes from each client
 */
export function layoutRadialSpokes(
  companyNodeId: string,
  clientIds: string[],
  clientProjectMapping: ClientProjectMapping,
  params: Partial<LayoutParams> = {},
  existingNodes: Node[] = [],
  centerX: number = 0,
  centerY: number = 0
): LayoutResult {
  const config = { ...DEFAULT_LAYOUT_PARAMS, ...params };
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Find existing node data
  const getExistingNode = (id: string) => existingNodes.find(node => node.id === id);

  // Step 1: Place company node at center
  const companyNode = getExistingNode(companyNodeId);
  if (companyNode) {
    nodes.push({
      ...companyNode,
      position: { x: centerX, y: centerY }
    });
  }

  // Step 2: Place clients in a perfect circle around the company
  const clientAngleStep = (2 * Math.PI) / clientIds.length;
  const clientPositions: { [clientId: string]: { x: number; y: number; angle: number } } = {};

  clientIds.forEach((clientId, index) => {
    const angle = index * clientAngleStep;
    const position = polarToCartesian(config.radiusClient, angle, centerX, centerY);
    
    clientPositions[clientId] = { ...position, angle };
    
    const clientNode = getExistingNode(clientId);
    if (clientNode) {
      nodes.push({
        ...clientNode,
        position
      });
    }

    // Add edge from company to client
    edges.push({
      id: `${companyNodeId}-${clientId}`,
      source: companyNodeId,
      target: clientId,
      type: 'custom',
      style: {
        stroke: '#6B7280',
        strokeWidth: 1,
        opacity: 0.6
      }
    });
  });

  // Step 3: Place projects along spokes if projects are outside
  if (config.projectsOutside) {
    Object.entries(clientProjectMapping).forEach(([clientId, projectIds]) => {
      if (!projectIds?.length || !clientPositions[clientId]) return;

      const clientPos = clientPositions[clientId];
      const clientAngle = clientPos.angle;
      
      // Calculate project positions along the spoke
      const projectPositions = calculateProjectPositions(
        projectIds,
        clientPos,
        clientAngle,
        config
      );

      // Place project nodes
      projectPositions.forEach(({ projectId, position }) => {
        const projectNode = getExistingNode(projectId);
        if (projectNode) {
          nodes.push({
            ...projectNode,
            position
          });
        }

        // Add edge from client to project
        edges.push({
          id: `${clientId}-${projectId}`,
          source: clientId,
          target: projectId,
          type: 'custom',
          style: {
            stroke: '#3B82F6',
            strokeWidth: 1.5,
            opacity: 0.7
          }
        });
      });
    });
  } else {
    // Place projects inside the client ring (original behavior)
    Object.entries(clientProjectMapping).forEach(([clientId, projectIds]) => {
      if (!projectIds?.length || !clientPositions[clientId]) return;

      projectIds.forEach((projectId, index) => {
        const projectNode = getExistingNode(projectId);
        if (projectNode) {
          // Place projects in a smaller ring around the center
          const projectRadius = config.radiusClient * 0.6;
          const totalProjects = Object.values(clientProjectMapping).flat().length;
          const projectAngle = (index / totalProjects) * 2 * Math.PI;
          const position = polarToCartesian(projectRadius, projectAngle, centerX, centerY);
          
          nodes.push({
            ...projectNode,
            position
          });
        }

        // Add edge from client to project
        edges.push({
          id: `${clientId}-${projectId}`,
          source: clientId,
          target: projectId,
          type: 'custom',
          style: {
            stroke: '#3B82F6',
            strokeWidth: 1.5,
            opacity: 0.7
          }
        });
      });
    });
  }

  return { nodes, edges };
}

/**
 * Calculate positions for projects along a client's spoke
 */
function calculateProjectPositions(
  projectIds: string[],
  clientPos: { x: number; y: number; angle: number },
  clientAngle: number,
  config: LayoutParams
): Array<{ projectId: string; position: { x: number; y: number } }> {
  const positions: Array<{ projectId: string; position: { x: number; y: number } }> = [];
  
  if (projectIds.length === 0) return positions;

  // Group projects into rings
  const rings: string[][] = [];
  for (let i = 0; i < projectIds.length; i += config.maxPerRing) {
    rings.push(projectIds.slice(i, i + config.maxPerRing));
  }

  rings.forEach((ringProjects, ringIndex) => {
    const ringRadius = config.radiusClient + config.ringGap + (ringIndex * config.projectGap);
    
    if (ringProjects.length === 1) {
      // Single project: place directly along the spoke
      const position = polarToCartesian(ringRadius, clientAngle, 0, 0);
      positions.push({
        projectId: ringProjects[0],
        position
      });
    } else {
      // Multiple projects: spread them in a small arc
      const totalSpread = Math.min(config.arcSpread, Math.PI / 3); // Cap at 60 degrees
      const angleStep = totalSpread / (ringProjects.length - 1);
      const startAngle = clientAngle - totalSpread / 2;
      
      ringProjects.forEach((projectId, index) => {
        const projectAngle = startAngle + (index * angleStep);
        const position = polarToCartesian(ringRadius, projectAngle, 0, 0);
        positions.push({
          projectId,
          position
        });
      });
    }
  });

  return positions;
}

/**
 * Check for node collisions and adjust positions if needed
 */
export function detectAndResolveCollisions(
  nodes: Node[],
  minDistance: number = 80
): Node[] {
  const adjustedNodes = [...nodes];
  
  for (let i = 0; i < adjustedNodes.length; i++) {
    for (let j = i + 1; j < adjustedNodes.length; j++) {
      const nodeA = adjustedNodes[i];
      const nodeB = adjustedNodes[j];
      
      // Never move the company node - it stays at center
      if (nodeA.id === 'company' || nodeB.id === 'company') {
        continue;
      }
      
      const dx = nodeA.position.x - nodeB.position.x;
      const dy = nodeA.position.y - nodeB.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance && distance > 0) {
        // Move nodes apart along the line connecting them
        const overlap = minDistance - distance;
        const moveDistance = overlap / 2;
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        nodeA.position.x += unitX * moveDistance;
        nodeA.position.y += unitY * moveDistance;
        nodeB.position.x -= unitX * moveDistance;
        nodeB.position.y -= unitY * moveDistance;
      }
    }
  }
  
  return adjustedNodes;
}

/**
 * Create curved edges that avoid node overlaps
 */
export function createCurvedEdges(
  nodes: Node[],
  edges: Edge[],
  curvature: number = 0.2
): Edge[] {
  return edges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return edge;
    
    // Calculate control point for curved edge
    const midX = (sourceNode.position.x + targetNode.position.x) / 2;
    const midY = (sourceNode.position.y + targetNode.position.y) / 2;
    
    // Offset perpendicular to the line
    const dx = targetNode.position.x - sourceNode.position.x;
    const dy = targetNode.position.y - sourceNode.position.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 0) {
      const perpX = -dy / length;
      const perpY = dx / length;
      const offset = curvature * length;
      
      return {
        ...edge,
        style: {
          ...edge.style,
          strokeDasharray: edge.source === 'company' ? undefined : '5,5'
        },
        data: {
          ...edge.data,
          controlPoint: {
            x: midX + perpX * offset,
            y: midY + perpY * offset
          }
        }
      };
    }
    
    return edge;
  });
}

/**
 * Utility function to convert layout parameters from UI slider values
 */
export function getLayoutParamsFromUI(
  density: number, // 0-100
  projectsOutside: boolean,
  maxProjectsPerRing: number // 2-8
): LayoutParams {
  // Convert density (0-100) to layout parameters
  const densityFactor = density / 100;
  
  return {
    radiusClient: 250 + (densityFactor * 150), // 250-400
    ringGap: 120 + (densityFactor * 80),       // 120-200
    projectGap: 60 + (densityFactor * 40),     // 60-100
    arcSpread: 0.1 + (densityFactor * 0.2),   // 0.1-0.3 radians
    maxPerRing: maxProjectsPerRing,
    projectsOutside
  };
}