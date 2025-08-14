import React from "react";
import { useTranslation } from "react-i18next";

export default function MapControls({ 
  layoutMode, 
  onLayoutToggle,
  densityMode,
  onDensityToggle,
  filters,
  onFilterChange,
  onFocusMode,
  projectsOutside,
  onProjectsOutsideToggle,
  density,
  onDensityChange,
  maxProjectsPerRing,
  onMaxProjectsPerRingChange
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center space-x-3 flex-wrap">
      {/* Layout Toggle */}
      <button
        onClick={onLayoutToggle}
        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-all duration-200"
      >
        {layoutMode === "hierarchical" ? t("radial") : t("hierarchical")}
      </button>
      
      {/* Density Toggle */}
      <button
        onClick={onDensityToggle}
        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-all duration-200"
      >
        {densityMode === "overview" ? t("details") : t("overview")}
      </button>
      
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
      
      {/* Radial Layout Controls - only show when in radial mode */}
      {layoutMode === "radial" && (
        <>
          {/* Projects Outside Toggle */}
          <label className="flex items-center space-x-1 text-xs bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
            <input
              type="checkbox"
              checked={projectsOutside}
              onChange={(e) => onProjectsOutsideToggle?.(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
            />
            <span title={projectsOutside ? t("projectsOutsideSpokes") : t("projectsInsideRing")}>
              {t("projectsOutside")}
            </span>
          </label>
          
          {/* Density Slider */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
            <span className="text-xs">{t("density")}</span>
            <input
              type="range"
              min="100"
              max="300"
              value={density}
              onChange={(e) => onDensityChange?.(parseInt(e.target.value))}
              className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
            />
            <span className="text-xs text-gray-500 w-10">{density}</span>
          </div>
          
          {/* Max Projects Per Ring */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
            <span className="text-xs">{t("maxProjectsPerRing")}</span>
            <input
              type="range"
              min="2"
              max="8"
              value={maxProjectsPerRing}
              onChange={(e) => onMaxProjectsPerRingChange?.(parseInt(e.target.value))}
              className="w-12 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
            />
            <span className="text-xs text-gray-500 w-4">{maxProjectsPerRing}</span>
          </div>
        </>
      )}
    </div>
  );
}