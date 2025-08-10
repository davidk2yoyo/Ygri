import React from 'react';

export default function OrthogonalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data = {},
  markerEnd
}) {
  // Create orthogonal path (right angles only)
  const createOrthogonalPath = () => {
    const midX = sourceX + (targetX - sourceX) * 0.5;
    
    // Simple L-shaped path for tree layout
    if (sourceX < targetX) {
      // Left to right flow
      return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
    } else {
      // Right to left flow  
      return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
    }
  };

  const path = createOrthogonalPath();
  const { isRootToClient = false, showEndDot = false } = data;

  // Calculate midpoint for any labels
  const labelX = sourceX + (targetX - sourceX) * 0.75;
  const labelY = sourceY + (targetY - sourceY) * 0.5;

  return (
    <g className="react-flow__edge orthogonal-edge">
      {/* Main path */}
      <path
        id={id}
        d={path}
        style={{
          ...style,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        }}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
      />
      
      {/* End dot for client→project edges */}
      {showEndDot && style.opacity > 0 && (
        <circle
          cx={targetX}
          cy={targetY}
          r={2}
          fill={style.stroke || '#6B7280'}
          stroke="none"
          className="react-flow__edge-dot"
        />
      )}
      
      {/* Invisible wider path for better hover detection */}
      <path
        d={path}
        style={{
          ...style,
          stroke: 'transparent',
          strokeWidth: Math.max(10, style.strokeWidth || 1),
          fill: 'none'
        }}
        className="react-flow__edge-interaction"
      />
    </g>
  );
}