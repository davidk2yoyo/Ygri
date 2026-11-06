import React, { useMemo, useState } from "react";

// Lets staff pick exactly which quotation items to bring into the packing
// list — all at once, one by one, or by whole supplier group — instead of
// "Import items from quote" always dumping every item in one shot.
export default function PackingListImportModal({ quotationItems, alreadyImportedIds, onConfirm, onClose }) {
  const importable = useMemo(() => quotationItems.filter(qi => !alreadyImportedIds.has(qi.id)), [quotationItems, alreadyImportedIds]);

  const groups = useMemo(() => {
    const bySupplier = new Map();
    importable.forEach(qi => {
      const key = qi.supplier_name || "Sin proveedor";
      if (!bySupplier.has(key)) bySupplier.set(key, []);
      bySupplier.get(key).push(qi);
    });
    return [...bySupplier.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [importable]);

  const [selected, setSelected] = useState(() => new Set(importable.map(qi => qi.id)));

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleGroup = (items, checked) => setSelected(prev => {
    const next = new Set(prev);
    items.forEach(qi => checked ? next.add(qi.id) : next.delete(qi.id));
    return next;
  });
  const toggleAll = (checked) => setSelected(checked ? new Set(importable.map(qi => qi.id)) : new Set());

  const allChecked = importable.length > 0 && selected.size === importable.length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Import items from quote</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose everything, pick items one by one, or bring in a whole supplier at once.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {importable.length === 0 ? (
            <p className="p-6 text-sm text-gray-400 text-center">All quotation items are already in this packing list.</p>
          ) : (
            <>
              <label className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-semibold text-gray-700">Select all ({importable.length})</span>
              </label>
              {groups.map(([supplierName, groupItems]) => {
                const groupChecked = groupItems.every(qi => selected.has(qi.id));
                return (
                  <div key={supplierName} className="border-b border-gray-100">
                    <label className="flex items-center gap-2 px-6 py-2 bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={groupChecked} onChange={e => toggleGroup(groupItems, e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{supplierName} · {groupItems.length}</span>
                    </label>
                    {groupItems.map(qi => (
                      <label key={qi.id} className="flex items-center gap-2 px-6 py-2 pl-10 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={selected.has(qi.id)} onChange={() => toggle(qi.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs text-gray-700 truncate">
                          {qi.item_number && <span className="font-mono text-gray-400 mr-1.5">{qi.item_number}</span>}
                          {qi.description}
                          {qi.color && <span className="text-gray-400"> · {qi.color}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            Import ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
