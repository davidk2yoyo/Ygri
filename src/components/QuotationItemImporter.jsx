import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Copies items (product, quantity, sell price, cost, supplier) from another
// quotation into the one currently being edited. Read-only against the
// source: it only ever SELECTs from quotation_items/quotation_item_price_tiers
// — the caller appends the returned items to its own local `items` state,
// and QuotationForm's save always inserts them fresh under the CURRENT
// quotation_id, so the source quotation is never touched (Ygri: items
// intentionally repeat across quotations — see "quotations can share items").
export default function QuotationItemImporter({ currentQuotationId, onImport, onClose }) {
  const [step, setStep] = useState("pick"); // pick | items
  const [search, setSearch] = useState("");
  const [quotations, setQuotations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [sourceItems, setSourceItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingList(true);
      let query = supabase
        .from("quotations")
        .select("id, quote_number, document_type, client_name, project_name, currency, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (currentQuotationId) query = query.neq("id", currentQuotationId);
      const { data } = await query;
      setQuotations(data || []);
      setLoadingList(false);
    })();
  }, [currentQuotationId]);

  const filtered = quotations
    .filter(q => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return q.quote_number?.toLowerCase().includes(s) || q.client_name?.toLowerCase().includes(s) || q.project_name?.toLowerCase().includes(s);
    })
    .slice(0, 30);

  const pickQuotation = async (q) => {
    setSelectedQuotation(q);
    setStep("items");
    setLoadingItems(true);
    setErrorMsg("");
    try {
      const { data: rows, error } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id).order("sort_order");
      if (error) throw error;

      const itemIds = (rows || []).map(r => r.id);
      const tiersByItem = {};
      if (itemIds.length) {
        const { data: tiers } = await supabase.from("quotation_item_price_tiers").select("*").in("quotation_item_id", itemIds).order("min_qty");
        (tiers || []).forEach(t => {
          if (!tiersByItem[t.quotation_item_id]) tiersByItem[t.quotation_item_id] = [];
          const isRange = t.max_qty != null && t.max_qty !== t.min_qty;
          tiersByItem[t.quotation_item_id].push({
            tempId: t.id,
            min_qty: t.min_qty,
            max_qty: isRange ? t.max_qty : "",
            price: t.price,
            supplier_price: t.supplier_price ?? "",
            notes: t.notes || "",
            isRange,
          });
        });
      }

      setSourceItems((rows || []).map(r => ({ ...r, checked: true, priceTiers: tiersByItem[r.id] || [] })));
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const toggle = (id) => setSourceItems(prev => prev.map(it => (it.id === id ? { ...it, checked: !it.checked } : it)));
  const allChecked = sourceItems.length > 0 && sourceItems.every(it => it.checked);
  const toggleAll = () => setSourceItems(prev => prev.map(it => ({ ...it, checked: !allChecked })));
  const checkedCount = sourceItems.filter(it => it.checked).length;

  const handleImport = () => {
    const picked = sourceItems
      .filter(it => it.checked)
      .map(it => ({
        tempId: Math.random().toString(36).slice(2),
        catalog_item_id: it.catalog_item_id ?? null,
        item_number: it.item_number || "",
        description: it.description || "",
        picture_url: it.picture_url || "",
        price: it.price ?? "",
        quantity: it.quantity ?? 1,
        moq: it.moq ?? "",
        supplier_id: it.supplier_id ?? null,
        supplier_price: it.supplier_price ?? "",
        supplier_currency: it.supplier_currency || "",
        supplier_exchange_rate: it.supplier_exchange_rate ?? "",
        priceTiers: (it.priceTiers || []).map(t => ({ ...t, tempId: Math.random().toString(36).slice(2) })),
        pictureFile: null,
        picturePreview: it.picture_url || "",
      }));
    onImport(picked, selectedQuotation);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-bgray-200 dark:border-darkblack-400">
          <div>
            <h3 className="font-bold text-darkblack-700 dark:text-white">
              {step === "pick" ? "Add items from another quotation" : `Items in ${selectedQuotation?.quote_number}`}
            </h3>
            <p className="text-xs text-bgray-400 mt-0.5">
              {step === "pick"
                ? "Copies product, quantity, sell price, cost and supplier — the other quotation is never changed."
                : "Choose which items to bring in."}
            </p>
          </div>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === "pick" && (
            <>
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by quote number, client, or project…"
                className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary mb-3"
              />
              {loadingList ? (
                <p className="text-sm text-bgray-400 text-center py-8">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-bgray-400 text-center py-8">No quotations found.</p>
              ) : (
                <div className="space-y-1">
                  {filtered.map(q => (
                    <button
                      key={q.id}
                      onClick={() => pickQuotation(q)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-bgray-200 dark:border-darkblack-400 hover:border-primary hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-darkblack-700 dark:text-white truncate">
                          {q.quote_number} <span className="text-xs font-normal text-bgray-400">({q.document_type})</span>
                        </p>
                        <p className="text-xs text-bgray-500 dark:text-bgray-400 truncate">{[q.client_name, q.project_name].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className="text-xs text-bgray-400 shrink-0 ml-2">{q.currency}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "items" && (
            <>
              {loadingItems ? (
                <p className="text-sm text-bgray-400 text-center py-8">Loading items…</p>
              ) : errorMsg ? (
                <p className="text-sm text-red-500 text-center py-8">{errorMsg}</p>
              ) : sourceItems.length === 0 ? (
                <p className="text-sm text-bgray-400 text-center py-8">This quotation has no items.</p>
              ) : (
                <>
                  <div className="flex justify-end mb-2">
                    <button onClick={toggleAll} className="text-xs text-primary font-semibold">
                      {allChecked ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sourceItems.map(it => (
                      <label key={it.id} className="flex items-start gap-3 px-3 py-2 border border-bgray-200 dark:border-darkblack-400 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={it.checked} onChange={() => toggle(it.id)} className="mt-0.5 rounded border-bgray-300 text-primary focus:ring-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-darkblack-700 dark:text-white truncate">
                            {it.item_number ? `${it.item_number} — ` : ""}{it.description || "(no description)"}
                          </p>
                          <p className="text-xs text-bgray-400">
                            Qty {it.quantity} · Sell {it.price} · Cost {it.supplier_price ?? "—"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-bgray-200 dark:border-darkblack-400">
          {step === "items" ? (
            <button onClick={() => setStep("pick")} className="text-sm text-bgray-500 hover:text-darkblack-700 dark:hover:text-white transition">← Back</button>
          ) : <span />}
          {step === "items" && !loadingItems && !errorMsg && sourceItems.length > 0 && (
            <button
              onClick={handleImport}
              disabled={checkedCount === 0}
              className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition"
            >
              Import {checkedCount} item{checkedCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
