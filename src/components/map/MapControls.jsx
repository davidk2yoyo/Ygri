import React from "react";
import { useTranslation } from "react-i18next";

const segBase =
  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150";
const segActive = "bg-primary text-white shadow-sm";
const segInactive = "text-bgray-500 dark:text-bgray-400 hover:text-darkblack-700 dark:hover:text-white";

function BuildingIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01" />
    </svg>
  );
}

function SupplierIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 21V9l6-4 6 4v12M15 21V13l6-3v11" />
    </svg>
  );
}

function HierarchyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function RadialIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v2.5M12 17.5V20M20 12h-2.5M6.5 12H4M17 7l-1.8 1.8M8.8 15.2 7 17M17 17l-1.8-1.8M8.8 8.8 7 7" />
    </svg>
  );
}

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FocusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

export default function MapControls({
  layoutMode,
  onLayoutToggle,
  viewMode,
  onViewModeToggle,
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
    <div className="flex items-center gap-2 flex-wrap">
      {/* View Mode Toggle (Client/Supplier) */}
      {layoutMode === "hierarchical" && onViewModeToggle && (
        <div className="flex items-center gap-0.5 bg-bgray-100 dark:bg-darkblack-500 rounded-lg p-0.5">
          <button
            onClick={() => viewMode !== "client" && onViewModeToggle()}
            className={`${segBase} ${viewMode === "client" ? segActive : segInactive}`}
          >
            <BuildingIcon className="w-3.5 h-3.5" />
            Clients
          </button>
          <button
            onClick={() => viewMode !== "supplier" && onViewModeToggle()}
            className={`${segBase} ${viewMode === "supplier" ? segActive : segInactive}`}
          >
            <SupplierIcon className="w-3.5 h-3.5" />
            Suppliers
          </button>
        </div>
      )}

      {layoutMode === "hierarchical" && onViewModeToggle && (
        <div className="w-px h-5 bg-bgray-200 dark:bg-darkblack-400" />
      )}

      {/* Layout Toggle (Hierarchical/Radial) */}
      <div className="flex items-center gap-0.5 bg-bgray-100 dark:bg-darkblack-500 rounded-lg p-0.5">
        <button
          onClick={() => layoutMode !== "hierarchical" && onLayoutToggle()}
          className={`${segBase} ${layoutMode === "hierarchical" ? segActive : segInactive}`}
        >
          <HierarchyIcon className="w-3.5 h-3.5" />
          {t("hierarchical")}
        </button>
        <button
          onClick={() => layoutMode !== "radial" && onLayoutToggle()}
          className={`${segBase} ${layoutMode === "radial" ? segActive : segInactive}`}
        >
          <RadialIcon className="w-3.5 h-3.5" />
          {t("radial")}
        </button>
      </div>

      {/* Show these controls only in radial mode */}
      {layoutMode === "radial" && (
        <>
          <div className="w-px h-5 bg-bgray-200 dark:bg-darkblack-400" />

          {/* Density Toggle */}
          <button
            onClick={onDensityToggle}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-200 dark:hover:bg-darkblack-400 transition-all duration-150"
          >
            {densityMode === "overview" ? t("details") : t("overview")}
          </button>

          {/* Compact Search */}
          <div className="flex items-center gap-1.5 bg-bgray-100 dark:bg-darkblack-500 rounded-lg px-2.5 py-1.5">
            <SearchIcon className="w-3.5 h-3.5 text-bgray-400 dark:text-bgray-500 flex-shrink-0" />
            <input
              type="text"
              placeholder={t("search")}
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="bg-transparent border-none outline-none text-xs w-24 text-darkblack-700 dark:text-white placeholder:text-bgray-400 dark:placeholder:text-bgray-500 p-0 focus:ring-0"
            />
          </div>

          {/* Active Only Toggle */}
          <label
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 ${
              filters.activeOnly
                ? "bg-primary/10 text-primary border border-primary"
                : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 border border-transparent"
            }`}
          >
            <input
              type="checkbox"
              checked={filters.activeOnly}
              onChange={(e) => onFilterChange({ ...filters, activeOnly: e.target.checked })}
              className="rounded border-bgray-300 text-primary focus:ring-primary w-3 h-3"
            />
            <span>{t("active")}</span>
          </label>

          {/* Focus Mode Button */}
          <button
            onClick={() => onFocusMode()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-200 dark:hover:bg-darkblack-400 transition-all duration-150"
            title={t("focusMode")}
          >
            <FocusIcon className="w-3.5 h-3.5" />
            {t("focus")}
          </button>

          {/* Projects Outside Toggle */}
          <label
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 ${
              projectsOutside
                ? "bg-primary/10 text-primary border border-primary"
                : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 border border-transparent"
            }`}
          >
            <input
              type="checkbox"
              checked={projectsOutside}
              onChange={(e) => onProjectsOutsideToggle?.(e.target.checked)}
              className="rounded border-bgray-300 text-primary focus:ring-primary w-3 h-3"
            />
            <span title={projectsOutside ? t("projectsOutsideSpokes") : t("projectsInsideRing")}>
              {t("projectsOutside")}
            </span>
          </label>

          {/* Density Slider */}
          <div className="flex items-center gap-2 bg-bgray-100 dark:bg-darkblack-500 rounded-lg px-2.5 py-1.5">
            <span className="text-xs font-semibold text-bgray-500 dark:text-bgray-400 whitespace-nowrap">{t("density")}</span>
            <input
              type="range"
              min="100"
              max="300"
              value={density}
              onChange={(e) => onDensityChange?.(parseInt(e.target.value))}
              className="w-16 h-1.5 accent-primary bg-bgray-300 dark:bg-darkblack-400 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-bgray-500 dark:text-bgray-400 w-8">{density}</span>
          </div>

          {/* Max Projects Per Ring */}
          <div className="flex items-center gap-2 bg-bgray-100 dark:bg-darkblack-500 rounded-lg px-2.5 py-1.5">
            <span className="text-xs font-semibold text-bgray-500 dark:text-bgray-400 whitespace-nowrap">{t("maxProjectsPerRing")}</span>
            <input
              type="range"
              min="2"
              max="8"
              value={maxProjectsPerRing}
              onChange={(e) => onMaxProjectsPerRingChange?.(parseInt(e.target.value))}
              className="w-12 h-1.5 accent-primary bg-bgray-300 dark:bg-darkblack-400 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-bgray-500 dark:text-bgray-400 w-4">{maxProjectsPerRing}</span>
          </div>
        </>
      )}
    </div>
  );
}
