import React, { memo } from "react";
import { Handle, Position } from "reactflow";

function QuotationNode({ data }) {
  const { label, quote_number, type, currency, total_amount, status, onClick } = data;

  const typeColors = {
    product: "bg-purple-100 border-purple-400 text-purple-800",
    service: "bg-cyan-100 border-cyan-400 text-cyan-800"
  };

  const statusIcons = {
    draft: "📝",
    sent: "📤",
    approved: "✅",
    rejected: "❌"
  };

  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 rounded-lg border-2 shadow-md cursor-pointer hover:shadow-lg transition-shadow min-w-[200px] ${
        typeColors[type] || "bg-yellow-100 border-yellow-400 text-yellow-800"
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{quote_number || label}</div>
          <div className="text-xs opacity-75 uppercase mt-0.5">
            {type} • {currency}
          </div>
          {total_amount && (
            <div className="text-xs font-medium mt-1">
              {currency} {parseFloat(total_amount).toLocaleString()}
            </div>
          )}
        </div>
        {status && (
          <span className="text-lg" title={status}>
            {statusIcons[status] || "📄"}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(QuotationNode);
