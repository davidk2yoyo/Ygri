import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const CURRENCY_SYMBOL = { USD: "$", COP: "$", EUR: "€", CNY: "¥", HKD: "HK$" };

const formatMoney = (amount, currency) => {
  const sym = CURRENCY_SYMBOL[currency] || "";
  return `${sym}${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ItemsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ledger");

  // Ledger state
  const [lineItems, setLineItems] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [filterSupplierId, setFilterSupplierId] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [suppliers, setSuppliers] = useState([]);

  // Catalog state
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");

  const [previewImage, setPreviewImage] = useState(null);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    setLedgerError("");
    try {
      const { data, error } = await supabase
        .from("quotation_items")
        .select(`
          id, item_number, description, picture_url, quantity, price, supplier_price,
          quotations(id, quote_number, currency, document_type, track_id),
          suppliers(id, name)
        `)
        .order("id", { ascending: false });
      if (error) throw error;

      const trackIds = [...new Set((data || []).map(it => it.quotations?.track_id).filter(Boolean))];
      let tracksMap = {};
      if (trackIds.length > 0) {
        const { data: tracksData } = await supabase
          .from("v_tracks_overview")
          .select("track_name, client_name, track_id")
          .in("track_id", trackIds);
        tracksMap = Object.fromEntries((tracksData || []).map(t => [t.track_id, t]));
      }

      const suppliersMap = {};
      const enriched = (data || []).map(it => {
        const track = tracksMap[it.quotations?.track_id];
        if (it.suppliers?.id) suppliersMap[it.suppliers.id] = it.suppliers.name;
        return {
          ...it,
          client_name: track?.client_name || "—",
          track_name: track?.track_name || "—",
          supplier_name: it.suppliers?.name || "—",
          supplier_id: it.suppliers?.id || null,
          quote_number: it.quotations?.quote_number || "—",
          currency: it.quotations?.currency || "USD",
          track_id: it.quotations?.track_id || null,
        };
      });

      setLineItems(enriched);
      setSuppliers(Object.entries(suppliersMap).map(([id, name]) => ({ id, name })));
    } catch (e) {
      setLedgerError(e.message);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id, item_number, description, picture_url, default_price, quotation_items(id)")
        .order("item_number");
      if (error) throw error;
      setCatalogItems(data || []);
      setCatalogLoaded(true);
    } catch (e) {
      setCatalogError(e.message);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  useEffect(() => {
    if (activeTab === "catalog" && !catalogLoaded) loadCatalog();
  }, [activeTab, catalogLoaded, loadCatalog]);

  const filteredLedger = lineItems.filter(it => {
    if (filterSupplierId !== "all" && it.supplier_id !== filterSupplierId) return false;
    if (filterCurrency !== "all" && it.currency !== filterCurrency) return false;
    if (ledgerSearch) {
      const s = ledgerSearch.toLowerCase();
      if (
        !it.description?.toLowerCase().includes(s) &&
        !it.item_number?.toLowerCase().includes(s) &&
        !it.client_name?.toLowerCase().includes(s) &&
        !it.track_name?.toLowerCase().includes(s) &&
        !it.supplier_name?.toLowerCase().includes(s) &&
        !it.quote_number?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const filteredCatalog = catalogItems.filter(it => {
    if (!catalogSearch) return true;
    const s = catalogSearch.toLowerCase();
    return it.description?.toLowerCase().includes(s) || it.item_number?.toLowerCase().includes(s);
  });

  const getMargin = (clientPrice, supplierPrice) => {
    if (!supplierPrice || !clientPrice || clientPrice <= 0) return null;
    return ((clientPrice - supplierPrice) / clientPrice * 100).toFixed(1);
  };

  const marginColorClass = (pct) => {
    if (pct === null) return "";
    if (pct >= 20) return "text-green-600 dark:text-green-400";
    if (pct >= 10) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Items</h1>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">Line item ledger & product catalog</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-bgray-200 dark:border-darkblack-400 mb-6">
        {[
          { key: "ledger", label: "Line Items Ledger" },
          { key: "catalog", label: "Catalog" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-bgray-500 dark:text-bgray-400 hover:text-darkblack-700 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── LEDGER TAB ── */}
      {activeTab === "ledger" && (
        <>
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                placeholder="Search by item, client, supplier, quote #..."
                className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
              />
            </div>
            <select
              value={filterSupplierId}
              onChange={e => setFilterSupplierId(e.target.value)}
              className="px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            >
              <option value="all">All suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={filterCurrency}
              onChange={e => setFilterCurrency(e.target.value)}
              className="px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            >
              <option value="all">All currencies</option>
              {["USD", "COP", "EUR", "CNY", "HKD"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {ledgerError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{ledgerError}</div>
          )}

          <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-500">
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Item</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Supplier</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Client</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Project</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Quote #</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Qty</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Client Price</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Supplier Price</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Margin</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2 text-bgray-500">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                          <span className="text-sm">Loading items...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-bgray-400 text-sm">
                        {lineItems.length === 0 ? "No items yet." : "No results match your filters."}
                      </td>
                    </tr>
                  ) : filteredLedger.map(it => {
                    const mp = getMargin(it.price, it.supplier_price);
                    return (
                      <tr key={it.id} className="border-b border-bgray-100 dark:border-darkblack-400 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {it.picture_url ? (
                              <button
                                onClick={() => setPreviewImage(it.picture_url)}
                                className="relative w-9 h-9 rounded-lg overflow-hidden bg-bgray-100 dark:bg-darkblack-500 flex-shrink-0 group"
                              >
                                <img src={it.picture_url} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </div>
                              </button>
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-bgray-100 dark:bg-darkblack-500 flex-shrink-0 flex items-center justify-center">
                                <svg className="w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              </div>
                            )}
                            <div>
                              {it.item_number && (
                                <p className="text-xs font-mono text-bgray-500 dark:text-bgray-400">{it.item_number}</p>
                              )}
                              <p className="text-sm text-darkblack-700 dark:text-white line-clamp-1 max-w-[180px]">
                                {it.description || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-darkblack-700 dark:text-white">{it.supplier_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-darkblack-700 dark:text-white">{it.client_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-bgray-600 dark:text-bgray-300 line-clamp-1 max-w-[130px]">{it.track_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-darkblack-700 dark:text-white">{it.quote_number}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-bgray-600 dark:text-bgray-300">{it.quantity ?? 1}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-darkblack-700 dark:text-white">
                            {it.price ? `${it.currency} ${formatMoney(it.price, it.currency)}` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-amber-600 dark:text-amber-400">
                            {it.supplier_price ? formatMoney(it.supplier_price, it.currency) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {mp !== null ? (
                            <span className={`text-sm font-semibold ${marginColorClass(Number(mp))}`}>{mp}%</span>
                          ) : (
                            <span className="text-bgray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end">
                            {it.track_id && (
                              <button
                                onClick={() => navigate("/projects", { state: { activeTrackId: it.track_id, openQuotation: true } })}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                                title="Edit in project"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!ledgerLoading && filteredLedger.length > 0 && (
              <div className="px-5 py-3 border-t border-bgray-100 dark:border-darkblack-400 text-xs text-bgray-400 dark:text-bgray-500">
                Showing {filteredLedger.length} of {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CATALOG TAB ── */}
      {activeTab === "catalog" && (
        <>
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Search by item # or description..."
                className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
              />
            </div>
          </div>

          {catalogError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{catalogError}</div>
          )}

          <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-500">
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Item</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Default Price</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Times Quoted</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogLoading ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2 text-bgray-500">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                          <span className="text-sm">Loading catalog...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCatalog.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-bgray-400 text-sm">
                        {catalogItems.length === 0
                          ? "No catalog items yet. Items are added automatically when you save quotations."
                          : "No results match your search."}
                      </td>
                    </tr>
                  ) : filteredCatalog.map(it => (
                    <tr key={it.id} className="border-b border-bgray-100 dark:border-darkblack-400 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {it.picture_url ? (
                            <button
                              onClick={() => setPreviewImage(it.picture_url)}
                              className="relative w-9 h-9 rounded-lg overflow-hidden bg-bgray-100 dark:bg-darkblack-500 flex-shrink-0 group"
                            >
                              <img src={it.picture_url} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </div>
                            </button>
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-bgray-100 dark:bg-darkblack-500 flex-shrink-0 flex items-center justify-center">
                              <svg className="w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                          )}
                          <div>
                            {it.item_number && (
                              <p className="text-xs font-mono text-bgray-500 dark:text-bgray-400">{it.item_number}</p>
                            )}
                            <p className="text-sm text-darkblack-700 dark:text-white line-clamp-1 max-w-[400px]">
                              {it.description || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-bgray-600 dark:text-bgray-300">
                          {it.default_price
                            ? `$${Number(it.default_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                          {it.quotation_items?.length ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!catalogLoading && filteredCatalog.length > 0 && (
              <div className="px-5 py-3 border-t border-bgray-100 dark:border-darkblack-400 text-xs text-bgray-400 dark:text-bgray-500">
                {filteredCatalog.length} catalog item{filteredCatalog.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </>
      )}

      {/* Image lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
