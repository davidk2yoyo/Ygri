import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";

// Grid-based catalog browser — a clearer alternative to the inline text
// dropdown for staff who don't know the exact ref and want to browse/filter
// by supplier instead. catalog_items has no supplier column of its own
// (an item can have been sourced from different suppliers across different
// quotations), so the supplier shown/filtered here is "most recently used
// with" that catalog item, backfilled from quotation_items — the same
// source QuotationForm's selectCatalogItem already pulls supplier info from
// when an item is picked.
export default function CatalogPickerModal({ open, onClose, catalogItems, suppliers, onSelect }) {
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierMap, setSupplierMap] = useState(null);
  const [loadingMap, setLoadingMap] = useState(false);

  useEffect(() => {
    if (!open || supplierMap !== null) return;
    setLoadingMap(true);
    supabase
      .from("quotation_items")
      .select("catalog_item_id, supplier_id, suppliers(name), created_at")
      .not("catalog_item_id", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(row => {
          if (!map[row.catalog_item_id]) {
            map[row.catalog_item_id] = { supplier_id: row.supplier_id, supplier_name: row.suppliers?.name || "" };
          }
        });
        setSupplierMap(map);
        setLoadingMap(false);
      });
  }, [open, supplierMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalogItems || []).filter(c => {
      if (supplierId && supplierMap?.[c.id]?.supplier_id !== supplierId) return false;
      if (!q) return true;
      return (c.item_number || "").toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q);
    });
  }, [catalogItems, search, supplierId, supplierMap]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 font-urbanist p-4">
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-xl w-full max-w-5xl h-[85vh] flex flex-col border border-bgray-200 dark:border-darkblack-400">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bgray-200 dark:border-darkblack-400">
          <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">Catálogo de productos</h3>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 dark:hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 px-6 py-3 border-b border-bgray-200 dark:border-darkblack-400">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por referencia o descripción..."
            className="flex-1 px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
          />
          <select
            value={supplierId}
            onChange={e => setSupplierId(e.target.value)}
            className="px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary sm:w-56"
          >
            <option value="">Todos los proveedores</option>
            {(suppliers || []).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingMap && supplierMap === null ? (
            <p className="text-sm text-bgray-400 text-center py-10">Cargando catálogo...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-bgray-400 text-center py-10">No se encontraron productos con esos filtros</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(c => {
                const supplierName = supplierMap?.[c.id]?.supplier_name;
                return (
                  <button
                    key={c.id}
                    onClick={() => { onSelect(c); onClose(); }}
                    className="text-left border border-bgray-200 dark:border-darkblack-400 rounded-xl overflow-hidden hover:border-primary hover:shadow-md transition bg-white dark:bg-darkblack-500 flex flex-col"
                  >
                    <div className="aspect-square bg-bgray-50 dark:bg-darkblack-400 flex items-center justify-center overflow-hidden">
                      {c.picture_url ? (
                        <img src={c.picture_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-8 h-8 text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="p-2 space-y-0.5">
                      {c.item_number && <div className="font-mono text-[11px] text-bgray-500 truncate">{c.item_number}</div>}
                      <div className="text-xs text-darkblack-700 dark:text-white line-clamp-2 leading-tight">{c.description}</div>
                      <div className="flex items-center justify-between pt-1">
                        {c.default_price && <span className="text-xs font-semibold text-primary">${c.default_price}</span>}
                        {supplierName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bgray-100 dark:bg-darkblack-400 text-bgray-500 dark:text-bgray-300 truncate ml-auto">
                            {supplierName}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
