import React from "react";

const RISK_BORDER_COLORS = {
  low: "border-gray-200 dark:border-gray-600",
  medium: "border-yellow-400 dark:border-yellow-500 border-2",
  high: "border-red-400 dark:border-red-500 border-2 shadow-red-100 dark:shadow-red-900/20"
};

export default function TreeClientNode({ data }) {
  const { densityMode = "overview", showLabels = true, zoomLevel = 1 } = data;
  const riskBorderClass = data.risk === "low" ? "" : RISK_BORDER_COLORS[data.risk] || "";
  
  // Get owner initials for avatar
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const ownerInitials = getInitials(data.ownerName);
  const projectCount = data.tracks?.length || 0;
  const truncatedName = data.label?.length > 20 ? `${data.label.substring(0, 20)}...` : data.label;
  
  // Pills mode - ultra compact for zoomed out
  if (densityMode === "overview" && zoomLevel < 0.6) {
    return (
      <div 
        className={`bg-white dark:bg-gray-800 rounded-full shadow-sm px-3 py-1 min-w-[80px] max-w-[120px] ${riskBorderClass} hover:shadow-md transition-all duration-200`}
        title={`${data.label} - ${data.ownerName} - ${projectCount} projects`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium truncate text-gray-900 dark:text-gray-100 mr-1">
            {data.label?.substring(0, 8)}
          </span>
          <div className="w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
            {ownerInitials[0]}
          </div>
        </div>
      </div>
    );
  }
  
  // Cards mode - normal zoom level
  if (densityMode === "overview" || (densityMode === "details" && zoomLevel < 1.2)) {
    return (
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 w-[140px] ${riskBorderClass} hover:shadow-lg transition-all duration-200`}
        title={data.label !== truncatedName ? data.label : undefined}
      >
        {/* Header with name and avatar */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate pr-1">
            {truncatedName}
          </h3>
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium flex-shrink-0">
            {ownerInitials}
          </div>
        </div>
        
        {/* Project count with expansion indicator */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{projectCount} project{projectCount !== 1 ? 's' : ''}</span>
          {!data.collapsed && projectCount > 0 && (
            <span className="text-blue-500">expanded</span>
          )}
          {data.collapsed && projectCount > 0 && (
            <span className="text-gray-400">collapsed</span>
          )}
        </div>
        
        {/* Risk indicator bar */}
        {data.risk !== "low" && (
          <div className={`mt-1 h-1 rounded-full ${
            data.risk === "high" ? "bg-red-400" : "bg-yellow-400"
          }`} />
        )}
        
        {/* Hidden project count badge */}
        {data.hiddenProjectCount > 0 && (
          <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
            +{data.hiddenProjectCount} more
          </div>
        )}
      </div>
    );
  }
  
  // Full details mode - close zoom
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-[220px] ${riskBorderClass} hover:shadow-xl transition-all duration-200`}>
      {/* Header with name and avatar */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {data.label}
        </h3>
        <div className="w-8 h-8 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">
          {ownerInitials}
        </div>
      </div>
      
      {/* Owner info */}
      <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
        Owner: {data.ownerName}
      </div>
      
      {/* Status badges with counts */}
      {data.projectCounts && Object.keys(data.projectCounts).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {Object.entries(data.projectCounts).slice(0, 3).map(([status, count]) => (
            <span key={status} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs">
              {status}: {count}
            </span>
          ))}
        </div>
      )}
      
      {/* Project count and expansion state */}
      <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        {projectCount} project{projectCount !== 1 ? 's' : ''}
        {!data.collapsed && projectCount > 0 && (
          <span className="text-blue-600 ml-2 font-medium">• Expanded</span>
        )}
      </div>
      
      {/* Risk and overdue indicators */}
      {(data.totalOverdueTodos > 0 || data.risk !== "low") && (
        <div className="text-xs space-y-1 pt-2 border-t border-gray-200 dark:border-gray-600">
          {data.totalOverdueTodos > 0 && (
            <div className="text-red-500 font-medium">
              {data.totalOverdueTodos} overdue todos
            </div>
          )}
          {data.risk !== "low" && (
            <div className={`font-medium ${data.risk === "high" ? "text-red-600" : "text-yellow-600"}`}>
              {data.risk.charAt(0).toUpperCase() + data.risk.slice(1)} risk
            </div>
          )}
        </div>
      )}
      
      {/* Hidden project count */}
      {data.hiddenProjectCount > 0 && (
        <div className="mt-2 px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
          +{data.hiddenProjectCount} more projects
        </div>
      )}
      
      {/* Collapse indicator */}
      {data.collapsed && projectCount > 0 && (
        <div className="mt-2 text-xs text-gray-400 italic">
          Double-click to expand projects
        </div>
      )}
    </div>
  );
}