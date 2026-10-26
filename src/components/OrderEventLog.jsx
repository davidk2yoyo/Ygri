import React from "react";
import { describeChanges } from "../lib/orderDiff";

const KIND_LABEL = {
  submitted: "envió el pedido",
  lines_edited: "editó el pedido",
  status_changed: "cambió el estado",
  comment: "comentó",
  project_created: "creó el proyecto",
  quotation_created: "creó la cotización",
  quotation_sent: "envió la cotización",
  accepted: "aceptó la cotización",
  changes_requested: "pidió cambios",
  project_unlinked: "desvinculó el proyecto",
};

// Change log of an order. `viewer` ('client' | 'staff') decides who is "Tú".
export default function OrderEventLog({ events, viewer }) {
  if (!events?.length) return <p className="text-xs text-gray-400">Sin movimientos.</p>;
  return (
    <ol className="space-y-3">
      {events.map(e => {
        const mine = e.actor_type === viewer;
        const who = mine ? "Tú" : e.actor_type === "staff" ? "Interasia" : (e.actor_name || "El cliente");
        const lines = describeChanges(e.kind === "lines_edited" ? e.changes : null);
        return (
          <li key={e.id} className="flex gap-3">
            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${e.actor_type === "staff" ? "bg-blue-500" : "bg-purple-500"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-700">
                <span className="font-semibold">{who}</span> {KIND_LABEL[e.kind] || e.kind}
                {e.kind === "status_changed" && e.changes?.to ? <> a <span className="font-semibold">{e.changes.to}</span></> : null}
                <span className="text-gray-400"> · {new Date(e.created_at).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </p>
              {e.note && <p className="mt-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap">{e.note}</p>}
              {lines.length > 0 && (
                <ul className="mt-1 text-[11px] text-gray-500 space-y-0.5 list-disc pl-4">
                  {lines.slice(0, 12).map((t, i) => <li key={i}>{t}</li>)}
                  {lines.length > 12 && <li>… y {lines.length - 12} cambios más</li>}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Button + popup so the history doesn't take space from the order itself
export function OrderHistoryButton({ events, viewer, highlight = false, title = "Historial" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="relative px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
        {title} ({events?.length || 0})
        {highlight && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" />}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-darkblack-400">
              <p className="text-base font-semibold text-gray-900 dark:text-white">{title}</p>
              <button onClick={() => setOpen(false)} className="text-2xl leading-none text-gray-400 hover:text-gray-700">×</button>
            </div>
            <div className="p-5 overflow-y-auto"><OrderEventLog events={events} viewer={viewer} /></div>
          </div>
        </div>
      )}
    </>
  );
}
