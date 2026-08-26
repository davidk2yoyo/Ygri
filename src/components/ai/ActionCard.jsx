import React from "react";

const TOOL_TITLES = {
  create_task: "CREATE TASK",
  add_project_message: "ADD PROJECT COMMENT",
};

const FIELD_LABELS = {
  title: "Task",
  due_date: "Due",
  assignee: "Assignee",
  project: "Project",
  client: "Client",
  body: "Comment",
};

// Which editable field a given select/date control stands in for — so its
// plain-text proposed_state line (if any) is skipped in favor of the
// control, instead of showing both.
const EDITABLE_TO_FIELD = { track_id: "project", due_date: "due_date" };

const STATUS_BADGE = {
  proposed: null,
  executing: { text: "Executing…", cls: "text-primary" },
  completed: { text: "✓ Done", cls: "text-emerald-600 dark:text-emerald-400" },
  failed: { text: "✕ Failed", cls: "text-red-500" },
  stale: { text: "⚠ Changed since proposed", cls: "text-amber-600 dark:text-amber-400" },
  skipped: { text: "Skipped", cls: "text-bgray-400" },
};

export default function ActionCard({ action, disabled, onToggle, onAmend }) {
  const invalid = action.validation?.status === "invalid";
  const badge = STATUS_BADGE[action.status];
  const editable = action.editable || {};
  const skipPlainField = new Set(Object.keys(editable).map((k) => EDITABLE_TO_FIELD[k] || k));

  return (
    <div className={`border rounded-xl p-3 mb-2 transition ${invalid ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10" : "border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-500"}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold tracking-wide text-bgray-500 dark:text-bgray-400 uppercase">
          {TOOL_TITLES[action.tool] || action.tool}
        </span>
        {badge ? (
          <span className={`text-xs font-medium shrink-0 ${badge.cls}`}>{badge.text}</span>
        ) : (
          <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!action.selected}
              disabled={disabled || invalid}
              onChange={() => onToggle(action.action_id)}
              className="rounded border-bgray-300 dark:border-darkblack-300 text-primary focus:ring-primary"
            />
            <span className="text-xs text-bgray-500 dark:text-bgray-400">Selected</span>
          </label>
        )}
      </div>

      <div className="space-y-1">
        {Object.entries(action.proposed_state || {}).map(([key, value]) =>
          value == null || value === "" || skipPlainField.has(key) ? null : (
            <p key={key} className="text-sm text-darkblack-700 dark:text-white">
              <span className="text-bgray-400 dark:text-bgray-500">{FIELD_LABELS[key] || key}: </span>
              {String(value)}
            </p>
          )
        )}

        {editable.track_id && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-bgray-400 dark:text-bgray-500 shrink-0">Project: </span>
            <select
              value={editable.track_id.value ?? "__none__"}
              disabled={disabled}
              onChange={(e) => onAmend(action.action_id, "track_id", e.target.value === "__none__" ? null : e.target.value)}
              className="min-w-0 flex-1 text-sm bg-transparent border border-bgray-200 dark:border-darkblack-400 rounded-md px-1.5 py-0.5 text-darkblack-700 dark:text-white"
            >
              {editable.track_id.options.map((opt) => (
                <option key={opt.value ?? "__none__"} value={opt.value ?? "__none__"}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {editable.due_date && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-bgray-400 dark:text-bgray-500 shrink-0">Due: </span>
            <input
              type="date"
              value={editable.due_date.value || ""}
              disabled={disabled}
              onChange={(e) => onAmend(action.action_id, "due_date", e.target.value)}
              className="text-sm bg-transparent border border-bgray-200 dark:border-darkblack-400 rounded-md px-1.5 py-0.5 text-darkblack-700 dark:text-white"
            />
          </div>
        )}
      </div>

      {invalid && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{action.validation.errors?.join(" ")}</p>
      )}
      {!!action.warnings?.length && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">⚠ {action.warnings.join(" ")}</p>
      )}
      {action.status === "failed" && action.error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{action.error}</p>
      )}
    </div>
  );
}
