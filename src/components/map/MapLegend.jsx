import React from "react";

export default function MapLegend({ processedData }) {
  if (!processedData) return null;
  
  const { statusColors, company } = processedData;
  
  return (
    <div className="p-4 max-w-xs">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Legend</h4>
      
      {/* Project Status Colors */}
      <div className="mb-4">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Status</h5>
        <div className="space-y-1">
          {Object.entries(company.projectCounts || {}).map(([status, count]) => (
            <div key={status} className="flex items-center space-x-2 text-sm">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: statusColors[status] }}
              ></div>
              <span className="text-gray-700 dark:text-gray-300">
                {status.replace('_', ' ')}: {count}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Risk Levels */}
      <div>
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Client Risk</h5>
        <div className="space-y-1 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <span>Low: {company.riskCounts?.low || 0}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <span>Medium: {company.riskCounts?.medium || 0}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <span>High: {company.riskCounts?.high || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}