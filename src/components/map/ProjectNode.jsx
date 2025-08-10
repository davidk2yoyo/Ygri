import React from "react";

const STATUS_COLORS = {
  active: "bg-blue-500",
  completed: "bg-green-500", 
  on_hold: "bg-yellow-500",
  cancelled: "bg-red-500",
  planning: "bg-purple-500",
  in_progress: "bg-cyan-500",
  blocked: "bg-red-600",
  default: "bg-gray-500"
};

export default function ProjectNode({ data }) {
  const { densityMode = "overview", showLabels = true, zoomLevel = 1 } = data;
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.default;
  
  // Overview mode - compact display
  if (densityMode === "overview") {
    return (
      <div 
        className={`${statusColor} text-white rounded-lg shadow-md p-2 min-w-[120px] max-w-[140px] hover:shadow-lg transition-all duration-200 transform hover:scale-105`}
        title={`${data.label} - ${data.status} - ${data.progress || 0}% complete${data.nextDue ? ` - Due: ${data.nextDue}` : ''}`}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className={`font-medium text-xs truncate pr-1 ${!showLabels && zoomLevel < 0.8 ? 'opacity-0' : ''}`}>
            {data.label}
          </h4>
          {data.overdue && (
            <span className="text-xs bg-red-600 px-1 py-0.5 rounded text-xs">!</span>
          )}
        </div>
        
        {/* Compact progress bar */}
        <div className="w-full bg-white/20 rounded-full h-1">
          <div 
            className="bg-white h-1 rounded-full transition-all duration-220" 
            style={{ width: `${data.progress || 0}%` }}
          ></div>
        </div>
        
        <div className="text-xs opacity-75 mt-1">
          {data.progress || 0}%
          {data.overdueTodos > 0 && (
            <span className="text-red-200 ml-1">• {data.overdueTodos}</span>
          )}
        </div>
      </div>
    );
  }
  
  // Details mode - full information display
  return (
    <div className={`${statusColor} text-white rounded-lg shadow-lg p-3 min-w-[180px] max-w-[200px] hover:shadow-xl transition-all duration-200`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm truncate pr-2">
          {data.label}
        </h4>
        {data.overdue && (
          <span className="text-xs bg-red-600 px-1 py-0.5 rounded">
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
          ></div>
        </div>
      </div>
      
      <div className="text-xs opacity-75 space-y-0.5">
        {data.nextDue && (
          <div>Due: {data.nextDue}</div>
        )}
        {data.overdueTodos > 0 && (
          <div className="text-red-200">
            {data.overdueTodos} overdue todos
          </div>
        )}
        <div>
          {data.completedStages}/{data.totalRequiredStages} stages
        </div>
      </div>
    </div>
  );
}