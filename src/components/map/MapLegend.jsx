import React from "react";
import { useTranslation } from "react-i18next";
import { RISK_COLORS } from "../../utils/mapUtils";

const RISK_ROWS = [
  { key: "low", color: RISK_COLORS.low },
  { key: "medium", color: RISK_COLORS.medium },
  { key: "high", color: RISK_COLORS.high },
];

export default function MapLegend({ processedData }) {
  const { t } = useTranslation();
  if (!processedData) return null;

  const { statusColors, company } = processedData;
  const statusEntries = Object.entries(company.projectCounts || {});
  const totalProjects = statusEntries.reduce((sum, [, count]) => sum + count, 0);
  const riskCounts = company.riskCounts || {};

  // Helper function to translate status
  const translateStatus = (status) => {
    const statusMap = {
      'completed': t('completed'),
      'active': t('active'),
      'cancelled': t('cancelled'),
      'in_progress': t('inProgress'),
      'not_started': t('notStarted'),
      'blocked': t('blocked'),
      'done': t('done')
    };
    return statusMap[status] || status.replace('_', ' ');
  };

  return (
    <div className="flex flex-col gap-5">
      {/* At-a-glance status distribution */}
      {totalProjects > 0 && (
        <div>
          <div className="flex h-2 rounded-full overflow-hidden bg-bgray-100 dark:bg-darkblack-500">
            {statusEntries.map(([status, count]) => (
              <span
                key={status}
                title={`${translateStatus(status)}: ${count}`}
                style={{ width: `${(count / totalProjects) * 100}%`, backgroundColor: statusColors[status] }}
              />
            ))}
          </div>
          <div className="mt-1.5 text-xs text-bgray-500 dark:text-bgray-400">
            <span className="font-semibold text-darkblack-700 dark:text-white">{totalProjects}</span> {t("projects")}
          </div>
        </div>
      )}

      {/* Project Status */}
      <div className="flex flex-col gap-2">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-bgray-500 dark:text-bgray-400">
          {t("projectStatus")}
        </h5>
        <div className="flex flex-col gap-1.5">
          {statusEntries.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-bgray-600 dark:text-bgray-300">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusColors[status] }}
                />
                {translateStatus(status)}
              </span>
              <span className="font-semibold text-darkblack-700 dark:text-white">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Client Risk */}
      <div className="flex flex-col gap-2">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-bgray-500 dark:text-bgray-400">
          {t("clientRisk")}
        </h5>
        <div className="flex flex-col gap-2 rounded-xl bg-bgray-50 dark:bg-darkblack-500 p-3">
          {RISK_ROWS.map(({ key, color }) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-bgray-600 dark:text-bgray-300">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {t(key)}
              </span>
              <span className="font-semibold text-darkblack-700 dark:text-white">{riskCounts[key] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
