import React from "react";

const RISK_BORDER_COLORS = {
  low: "border-gray-200 dark:border-gray-600",
  medium: "border-yellow-400 dark:border-yellow-500 border-2",
  high: "border-red-400 dark:border-red-500 border-2 shadow-red-100 dark:shadow-red-900/20"
};

const STATUS_COLORS = {
  active: "bg-blue-500",
  completed: "bg-green-500", 
  on_hold: "bg-yellow-500",
  cancelled: "bg-red-500",
  planning: "bg-purple-500",
  in_progress: "bg-cyan-500",
  blocked: "bg-red-600",
  review: "bg-orange-500"
};

export default function ClientNode({ data }) {
  const { densityMode = "overview", showLabels = true, zoomLevel = 1 } = data;
  const riskBorderClass = RISK_BORDER_COLORS[data.risk] || RISK_BORDER_COLORS.low;
  
  // Get owner initials for avatar
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Calculate overall progress from all tracks
  const calculateOverallProgress = () => {
    if (!data.tracks?.length) return 0;
    const totalProgress = data.tracks.reduce((sum, track) => sum + (track.progress || 0), 0);
    return Math.round(totalProgress / data.tracks.length);
  };

  const overallProgress = calculateOverallProgress();
  const ownerInitials = getInitials(data.ownerName);
  
  // Overview mode - compact display
  if (densityMode === "overview") {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 min-w-[160px] max-w-[200px] ${riskBorderClass} hover:shadow-lg transition-all duration-200 transform hover:scale-105`}>
        {/* Header with name and avatar */}
        <div className="flex items-center justify-between mb-2">
          <h3 className={`font-semibold text-gray-900 dark:text-white truncate text-sm ${!showLabels && zoomLevel < 0.6 ? 'opacity-0' : ''}`}>
            {data.label}
          </h3>
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium flex-shrink-0 ml-2">
            {ownerInitials}
          </div>
        </div>
        
        {/* Status badges - condensed */}
        <div className="flex flex-wrap gap-1 mb-2">
          {Object.entries(data.projectCounts || {}).slice(0, 3).map(([status, count]) => (
            <div key={status} className={`w-2 h-2 rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`} 
                 title={`${status}: ${count}`} />
          ))}
          {Object.keys(data.projectCounts || {}).length > 3 && (
            <div className="text-xs text-gray-400">+{Object.keys(data.projectCounts).length - 3}</div>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-220" 
               style={{ width: `${overallProgress}%` }} />
        </div>
        
        {/* Compact info */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {data.tracks?.length || 0} projects
          {data.hiddenProjectCount > 0 && (
            <span className="ml-1 px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">
              +{data.hiddenProjectCount}
            </span>
          )}
          {data.totalOverdueTodos > 0 && (
            <span className="text-red-500 ml-1">• {data.totalOverdueTodos}</span>
          )}
        </div>
      </div>
    );
  }
  
  // Details mode - full information display
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 min-w-[240px] max-w-[280px] ${riskBorderClass} hover:shadow-xl transition-all duration-200`}>
      {/* Header with name and avatar */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
          {data.label}
        </h3>
        <div className="w-8 h-8 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">
          {ownerInitials}
        </div>
      </div>
      
      {/* Owner info */}
      <div className="text-xs text-gray-600 dark:text-gray-300 mb-3">
        Owner: {data.ownerName}
      </div>
      
      {/* Status badges with counts */}
      <div className="flex flex-wrap gap-1 mb-3">
        {Object.entries(data.projectCounts || {}).map(([status, count]) => (
          <span key={status} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            <div className={`w-2 h-2 rounded-full mr-1 ${STATUS_COLORS[status] || 'bg-gray-400'}`} />
            {status}: {count}
          </span>
        ))}
      </div>
      
      {/* Progress bar with percentage */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          <span>Overall Progress</span>
          <span>{overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all duration-220" 
               style={{ width: `${overallProgress}%` }} />
        </div>
      </div>
      
      {/* Project count and overdue todos */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {data.tracks?.length || 0} projects
        {data.hiddenProjectCount > 0 && (
          <span className="ml-2 px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
            +{data.hiddenProjectCount} more
          </span>
        )}
        {data.totalOverdueTodos > 0 && (
          <span className="text-red-500 ml-2 font-medium">
            • {data.totalOverdueTodos} overdue todos
          </span>
        )}
      </div>
      
      {/* Collapse indicator */}
      {data.collapsed && (
        <div className="mt-2 text-xs text-gray-400 italic border-t border-gray-200 dark:border-gray-600 pt-2">
          Double-click to expand projects
        </div>
      )}
    </div>
  );
}