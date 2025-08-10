import React from "react";

export default function MapControls({ 
  layoutMode, 
  onLayoutToggle,
  densityMode,
  onDensityToggle,
  connectorMode,
  onConnectorModeChange,
  filters,
  onFilterChange,
  onFocusMode
}) {
  const connectorModes = [
    { value: "off", label: "Off", title: "Clean overview - no connectors" },
    { value: "minimal", label: "Min", title: "Root → client spokes only" },
    { value: "neighborhood", label: "Hood", title: "Show connections on hover/focus" },
    { value: "all", label: "All", title: "Show all connections when zoomed in" }
  ];

  return (
    <div className="flex items-center space-x-3">
      {/* Layout Toggle */}
      <button
        onClick={onLayoutToggle}
        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-all duration-200"
      >
        {layoutMode === "tree" ? "Radial" : "Tree"}
      </button>
      
      {/* Density Toggle */}
      <button
        onClick={onDensityToggle}
        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-all duration-200"
      >
        {densityMode === "overview" ? "Details" : "Overview"}
      </button>

      {/* Connector Mode Toggle */}
      <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
        {connectorModes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onConnectorModeChange(mode.value)}
            className={`px-2 py-0.5 rounded text-xs transition-all duration-200 ${
              connectorMode === mode.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={mode.title}
          >
            {mode.label}
          </button>
        ))}
      </div>
      
      {/* Compact Search */}
      <input
        type="text"
        placeholder="Search..."
        value={filters.search}
        onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
        className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent w-32"
      />
      
      {/* Active Only Toggle */}
      <label className="flex items-center space-x-1 text-xs">
        <input
          type="checkbox"
          checked={filters.activeOnly}
          onChange={(e) => onFilterChange({ ...filters, activeOnly: e.target.checked })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
        />
        <span>Active</span>
      </label>
      
      {/* Focus Mode Button */}
      <button
        onClick={() => onFocusMode()}
        className="px-2 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 transition-all duration-200"
        title="Focus Mode"
      >
        Focus
      </button>
    </div>
  );
}