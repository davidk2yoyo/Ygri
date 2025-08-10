import React from "react";
import { getBezierPath } from "reactflow";

export default function CustomEdge({
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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { showLabel, labelText, zoomLevel = 1 } = data;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {showLabel && labelText && zoomLevel > 1.5 && (
        <foreignObject
          width={24}
          height={16}
          x={labelX - 12}
          y={labelY - 8}
          className="react-flow__edge-label"
        >
          <div className="flex items-center justify-center w-full h-full">
            <span className="px-1.5 py-0.5 bg-gray-800 text-white text-xs rounded-full font-medium shadow-sm opacity-90">
              {labelText}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
}