import React, { memo } from "react";
import { Handle, Position } from "reactflow";

function SupplierNode({ data }) {
  const { label, name, email, sales_person, productCount, onClick } = data;

  return (
    <div
      onClick={onClick}
      className="px-4 py-3 rounded-lg border-2 border-orange-400 bg-orange-50 shadow-md cursor-pointer hover:shadow-lg transition-shadow min-w-[200px]"
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-start gap-2">
        <span className="text-2xl flex-shrink-0">🏭</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-orange-900 truncate">
            {name || label}
          </div>
          {sales_person && (
            <div className="text-xs text-orange-700 mt-0.5 truncate">
              👤 {sales_person}
            </div>
          )}
          {email && (
            <div className="text-xs text-orange-600 mt-0.5 truncate">
              {email}
            </div>
          )}
          {productCount !== undefined && (
            <div className="text-xs text-orange-700 mt-1 font-medium">
              {productCount} product{productCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(SupplierNode);
