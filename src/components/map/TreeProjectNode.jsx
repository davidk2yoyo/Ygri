import React from "react";

const STATUS_COLORS = {
  active: "bg-blue-500",
  completed: "bg-green-500", 
  on_hold: "bg-yellow-500",
  cancelled: "bg-red-500",
  planning: "bg-purple-500",
  in_progress: "bg-cyan-500",
  blocked: "bg-red-600",
  review: "bg-orange-500",
  default: "bg-gray-500"
};

export default function TreeProjectNode({ data }) {
  const { densityMode = "overview", showLabels = true, zoomLevel = 1 } = data;
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.default;
  const truncatedName = data.label?.length > 15 ? `${data.label.substring(0, 15)}...` : data.label;
  
  // Pills mode - minimal chips for zoomed out
  if (densityMode === "overview" && zoomLevel < 0.8) {
    return (
      <div 
        className={`${statusColor} text-white rounded-full shadow-sm px-2 py-1 text-xs min-w-[60px] max-w-[100px] hover:shadow-md transition-all duration-200`}
        title={`${data.label} - ${data.status} - ${data.progress || 0}% complete${data.nextDue ? ` - Due: ${data.nextDue}` : ''}`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium truncate">
            {data.label?.substring(0, 6)}
          </span>
          {data.overdue && (
            <span className="text-xs">!</span>
          )}
        </div>
      </div>
    );
  }
  
  // Chip mode - compact project cards
  if (densityMode === "overview" || (densityMode === "details" && zoomLevel < 1.2)) {
    return (
      <div 
        className={`${statusColor} text-white rounded-lg shadow-md p-2 w-[120px] hover:shadow-lg transition-all duration-200`}
        title={data.label !== truncatedName ? data.label : undefined}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-medium text-xs truncate pr-1">
            {truncatedName}
          </h4>
          {data.overdue && (
            <span className="text-xs bg-red-600 px-1 py-0.5 rounded text-xs font-bold">!</span>
          )}
        </div>
        
        {/* Compact progress bar */}
        <div className="w-full bg-white/20 rounded-full h-1 mb-1">
          <div 
            className="bg-white h-1 rounded-full transition-all duration-220" 
            style={{ width: `${data.progress || 0}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-xs opacity-90">
          <span>{data.progress || 0}%</span>
          {data.overdueTodos > 0 && (
            <span className="text-red-200">•{data.overdueTodos}</span>
          )}
        </div>
      </div>
    );
  }
  
  // Full row mode - detailed project information
  return (
    <div className={`${statusColor} text-white rounded-lg shadow-lg p-3 w-[160px] hover:shadow-xl transition-all duration-200`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm">
          {data.label}
        </h4>
        {data.overdue && (
          <span className="text-xs bg-red-600 px-1 py-0.5 rounded font-bold">
            OVERDUE
          </span>
        )}
      </div>
      
      <div className="text-xs opacity-90 mb-2">
        Client: {data.clientName}
      </div>
      
      <div className="text-xs opacity-90 mb-2">
        Status: {data.status.replace('_', ' ')}
      </div>
      
      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between items-center text-xs mb-1">
          <span>Progress</span>
          <span>{data.progress || 0}%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-1.5">
          <div 
            className="bg-white h-1.5 rounded-full transition-all duration-220" 
            style={{ width: `${data.progress || 0}%` }}
          />
        </div>
      </div>
      
      <div className="text-xs opacity-75 space-y-0.5">
        {data.nextDue && (
          <div>Due: {data.nextDue}</div>
        )}
        {data.overdueTodos > 0 && (
          <div className="text-red-200 font-medium">
            {data.overdueTodos} overdue todos
          </div>
        )}
        <div>
          {data.completedStages || 0}/{data.totalRequiredStages || 0} stages
        </div>
      </div>
    </div>
  );
}