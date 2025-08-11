import React from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  
  const connectorModes = [
    { value: "off", label: t("off"), title: t("cleanOverview") },
    { value: "minimal", label: t("minimal"), title: t("rootClientSpokes") },
    { value: "neighborhood", label: t("neighborhood"), title: t("showConnectionsHover") },
    { value: "all", label: t("all"), title: t("showAllConnections") }
  ];

  return (
    <div className="flex items-center space-x-3">
      {/* Layout Toggle */}
      <button
        onClick={onLayoutToggle}
        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-all duration-200"
      >
        {layoutMode === "tree" ? t("radial") : t("tree")}
      </button>
      
      {/* Density Toggle */}
      <button
        onClick={onDensityToggle}
        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-all duration-200"
      >
        {densityMode === "overview" ? t("details") : t("overview")}
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
        placeholder={t("search")}
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
        <span>{t("active")}</span>
      </label>
      
      {/* Focus Mode Button */}
      <button
        onClick={() => onFocusMode()}
        className="px-2 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 transition-all duration-200"
        title={t("focusMode")}
      >
        {t("focus")}
      </button>
    </div>
  );
}