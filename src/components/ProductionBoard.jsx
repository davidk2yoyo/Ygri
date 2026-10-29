import React, { useState } from "react";

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "";

// Shared by the staff project view (editable) and the client portal (read-only) —
// same visual language on both sides of a single feature instead of two
// independent implementations drifting apart.
export function ProductionRing({ pct, size = 44 }) {
  const color = pct >= 100 ? "#10b981" : pct > 0 ? "#3b82f6" : "#d1d5db";
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="3.5" strokeDasharray={`${pct * 0.942} 94.2`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-white">{Math.round(pct)}%</span>
    </div>
  );
}

// One card per supplier purchase order: progress ring + checklist of items.
// readOnly (client portal) just displays ready/pending + estimated date.
// Editable (staff) adds a ready checkbox, an estimated-date picker, and a
// notes field per item — notes are staff-only, never sent to the client RPC,
// so there's no need to guard their display here; readOnly callers simply
// never receive them.
export function SupplierProductionCard({ po, readOnly = true, onItemChange, openHref }) {
  const [open, setOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const items = po.items || [];
  const readyCount = items.filter(i => i.ready_at).length;
  const pct = items.length ? (100 * readyCount / items.length) : 0;
  const pendingItems = items.filter(i => !i.ready_at);
  const pendingDates = [...new Set(pendingItems.map(i => i.expected_ready_date).filter(Boolean))].sort();
  const dateLabel = pendingDates.length === 1 ? `Entrega est. ${fmtDate(pendingDates[0])}`
    : pendingDates.length > 1 ? `Entrega est. ${fmtDate(pendingDates[0])} – ${fmtDate(pendingDates[pendingDates.length - 1])}`
    : null;

  // Suppliers often give one date for the whole PO rather than per item, and
  // marking 20+ items ready one by one once a shipment actually arrives is
  // tedious — these act on every item still pending at once.
  const markAllReady = () => {
    const now = new Date().toISOString();
    pendingItems.forEach(it => onItemChange(it, { ready_at: now }));
  };
  const applyDateToAll = () => {
    if (!bulkDate) return;
    pendingItems.forEach(it => onItemChange(it, { expected_ready_date: bulkDate }));
    setBulkDate("");
  };

  return (
    <div className="border border-gray-200 dark:border-darkblack-400 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-darkblack-500 transition">
        <ProductionRing pct={pct} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{po.supplier_name || "Supplier"}</p>
          <p className="text-xs text-gray-500 dark:text-bgray-400 truncate">
            {readyCount}/{items.length} listos · {po.po_number}{dateLabel && <> · {dateLabel}</>}
          </p>
        </div>
        {!readOnly && pendingItems.length > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={markAllReady} className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 rounded-md whitespace-nowrap">Marcar todo listo</button>
            <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
              className="w-[120px] px-1.5 py-1 border border-gray-200 dark:border-darkblack-400 rounded-md text-[11px] bg-white dark:bg-darkblack-600 text-gray-700 dark:text-white" />
            <button onClick={applyDateToAll} disabled={!bulkDate} className="px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md disabled:opacity-40 whitespace-nowrap">Aplicar a todos</button>
          </div>
        )}
        {openHref && (
          <a href={openHref} onClick={e => e.stopPropagation()} className="text-xs font-medium text-primary hover:underline flex-shrink-0">Ver orden completa →</a>
        )}
        <span className="text-gray-300 text-xs flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="border-t border-gray-100 dark:border-darkblack-500 divide-y divide-gray-50 dark:divide-darkblack-500">
          {items.map(it => (
            <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
              {it.picture_url
                ? <img src={it.picture_url} alt="" className="w-9 h-9 object-contain rounded border border-gray-200 bg-white flex-shrink-0" />
                : <span className="w-9 h-9 rounded border border-dashed border-gray-200 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-700 dark:text-bgray-200 truncate">
                  {it.item_number && <span className="font-mono text-xs text-gray-400 mr-1.5">{it.item_number}</span>}
                  {it.description || "—"}
                </p>
                {!readOnly && (
                  <input value={it.notes || ""} onChange={e => onItemChange(it, { notes: e.target.value })} placeholder="Comentario (solo para tu equipo)…"
                    className="mt-1 w-full text-xs px-1.5 py-0.5 border border-transparent hover:border-gray-200 dark:hover:border-darkblack-400 focus:border-primary rounded bg-transparent text-gray-600 dark:text-bgray-300" />
                )}
              </div>
              {readOnly ? (
                it.ready_at
                  ? <span className="flex items-center gap-1 text-xs font-semibold text-green-600 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
                      Listo
                    </span>
                  : <span className="text-xs text-gray-400 flex-shrink-0">{it.expected_ready_date ? `Est. ${fmtDate(it.expected_ready_date)}` : "Pendiente"}</span>
              ) : (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <label className="flex items-center cursor-pointer" title="Listo">
                    <input type="checkbox" checked={!!it.ready_at} onChange={e => onItemChange(it, { ready_at: e.target.checked ? new Date().toISOString() : null })}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary" />
                  </label>
                  {!it.ready_at && (
                    <input type="date" value={it.expected_ready_date || ""} onChange={e => onItemChange(it, { expected_ready_date: e.target.value || null })}
                      className="w-28 px-1 py-0.5 border border-gray-200 dark:border-darkblack-400 rounded text-[11px] bg-white dark:bg-darkblack-600 text-gray-700 dark:text-white" />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
