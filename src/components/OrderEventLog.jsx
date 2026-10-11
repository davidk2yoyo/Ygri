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
