import React, { memo } from "react";
import { Handle, Position } from "reactflow";

function ProductNode({ data }) {
  const { label, description, price, quantity, type, onClick } = data;

  const isService = type === 'service';
  const icon = isService ? "⚙️" : "📦";
  const bgColor = isService ? "bg-cyan-50 border-cyan-300" : "bg-purple-50 border-purple-300";

  return (
    <div
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow min-w-[160px] ${bgColor}`}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2" />

      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs truncate text-gray-800">
            {label || description}
          </div>
          {price && (
            <div className="text-xs text-gray-600 mt-0.5">
              ${parseFloat(price).toLocaleString()}
              {quantity && quantity > 1 && (
                <span className="ml-1">× {quantity}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );
}

export default memo(ProductNode);
