import React, { useState } from "react";
import ActionCard from "./ActionCard";
import { confirmActionPlan } from "../../lib/ai/copilotClient";

export default function ActionPlanPanel({ plan, onDone }) {
  const [actions, setActions] = useState(plan.actions);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");

  const toggle = (actionId) => {
    setActions((prev) => prev.map((a) => (a.action_id === actionId ? { ...a, selected: !a.selected } : a)));
  };

  const selectedCount = actions.filter((a) => a.selected && a.validation?.status !== "invalid").length;

  const handleConfirm = async () => {
    setBusy(true);
    setError("");
    try {
      const selectedIds = actions.filter((a) => a.selected && a.validation?.status !== "invalid").map((a) => a.action_id);
      setActions((prev) => prev.map((a) => (selectedIds.includes(a.action_id) ? { ...a, status: "executing" } : a)));
      const result = await confirmActionPlan({ planId: plan.plan_id, selectedActionIds: selectedIds });
      const byId = Object.fromEntries(result.actions.map((a) => [a.action_id, a]));
      setActions((prev) => prev.map((a) => (byId[a.action_id] ? { ...a, ...byId[a.action_id] } : a)));
      setFinished(true);
      onDone?.(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    setActions((prev) => prev.map((a) => ({ ...a, status: "skipped" })));
    setFinished(true);
    onDone?.({ cancelled: true });
  };

  return (
    <div className="mt-2 mb-1">
      {actions.map((action) => (
        <ActionCard key={action.action_id} action={action} disabled={busy || finished} onToggle={toggle} />
      ))}

      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}

      {!finished && (
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleCancel}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium text-bgray-500 dark:text-bgray-400 hover:text-darkblack-700 dark:hover:text-white transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || selectedCount === 0}
            className="flex-1 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition disabled:opacity-40"
          >
            {busy ? "Working…" : `Confirm ${selectedCount} action${selectedCount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
