import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { sileo } from "sileo";

export default function PurchaseOrderNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedQuotationId = searchParams.get("quotationId");

  const [step, setStep] = useState(preselectedQuotationId ? "items" : "project");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [tracks, setTracks] = useState([]);
  const [trackSearch, setTrackSearch] = useState("");
  const [selectedTrack, setSelectedTrack] = useState(null);

  const [quotations, setQuotations] = useState([]);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  const [items, setItems] = useState([]); // quotation_items with supplier info
  const [suppliers, setSuppliers] = useState({});
  const [checked, setChecked] = useState({}); // { [itemId]: boolean }

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (preselectedQuotationId) {
        const { data: quot } = await supabase.from("quotations").select("*").eq("id", preselectedQuotationId).single();
        if (quot) {
          setSelectedQuotation(quot);
          const { data: track } = await supabase.from("v_tracks_overview").select("track_id, track_name, client_name").eq("track_id", quot.track_id).single();
          setSelectedTrack(track || { track_id: quot.track_id, track_name: quot.project_name, client_name: quot.client_name });
          await loadItems(quot.id);
        }
      } else {
        const { data } = await supabase.from("v_tracks_overview").select("track_id, track_name, client_name").order("track_name");
        setTracks(data || []);
      }
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadQuotationsForTrack = async (trackId) => {
    setLoading(true);
    const { data } = await supabase
      .from("quotations")
      .select("*")
      .eq("track_id", trackId)
      .order("created_at", { ascending: false });
    setQuotations(data || []);
    setLoading(false);
  };

  const loadItems = useCallback(async (quotationId) => {
    const { data: qItems } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("sort_order");
    const withSupplier = (qItems || []).filter(it => it.supplier_id);
    setItems(withSupplier);

    const supplierIds = [...new Set(withSupplier.map(it => it.supplier_id))];
    if (supplierIds.length > 0) {
      const { data: supData } = await supabase.from("suppliers").select("id, name").in("id", supplierIds);
      setSuppliers(Object.fromEntries((supData || []).map(s => [s.id, s])));
    }
    setChecked({});
  }, []);

  const pickTrack = async (track) => {
    setSelectedTrack(track);
    setStep("document");
    await loadQuotationsForTrack(track.track_id);
  };

  const pickQuotation = async (quot) => {
    setSelectedQuotation(quot);
    setStep("items");
    setLoading(true);
    await loadItems(quot.id);
    setLoading(false);
  };

  const toggleItem = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleGroup = (supplierId, groupItems) => {
    const allChecked = groupItems.every(it => checked[it.id]);
    setChecked(prev => {
      const next = { ...prev };
      groupItems.forEach(it => { next[it.id] = !allChecked; });
      return next;
    });
  };

  const itemsBySupplier = items.reduce((acc, it) => {
    if (!acc[it.supplier_id]) acc[it.supplier_id] = [];
    acc[it.supplier_id].push(it);
    return acc;
  }, {});

  const selectedCount = Object.values(checked).filter(Boolean).length;

  const handleCreate = async () => {
    const selectedIds = Object.keys(checked).filter(id => checked[id]);
    if (selectedIds.length === 0) {
      sileo.warning({ title: "Select at least one item" });
      return;
    }
    setCreating(true);
    try {
      const selectedBySupplier = {};
      items.forEach(it => {
        if (checked[it.id]) {
          if (!selectedBySupplier[it.supplier_id]) selectedBySupplier[it.supplier_id] = [];
          selectedBySupplier[it.supplier_id].push(it);
        }
      });

      const createdPOs = [];
      for (const [supplierId, groupItems] of Object.entries(selectedBySupplier)) {
        const poCurrency = groupItems[0]?.supplier_currency || selectedQuotation.currency || "USD";
        const { data: po, error: poErr } = await supabase.from("purchase_orders").insert({
          track_id: selectedTrack.track_id,
          quotation_id: selectedQuotation.id,
          supplier_id: supplierId,
          currency: poCurrency,
        }).select().single();
        if (poErr) throw poErr;

        const poItems = groupItems.map((it, idx) => ({
          purchase_order_id: po.id,
          quotation_item_id: it.id,
          item_number: it.item_number,
          description: it.description,
          picture_url: it.picture_url,
          quantity: it.quantity,
          price: parseFloat(it.supplier_price) || 0,
          sort_order: idx,
        }));
        const { error: itemsErr } = await supabase.from("purchase_order_items").insert(poItems);
        if (itemsErr) throw itemsErr;

        createdPOs.push(po);
      }

      sileo.success({ title: `${createdPOs.length} purchase order${createdPOs.length !== 1 ? "s" : ""} created` });
      if (createdPOs.length === 1) {
        navigate(`/purchase-orders/${createdPOs[0].id}`);
      } else {
        navigate("/purchase-orders");
      }
    } catch (e) {
      sileo.error({ title: "Could not create purchase order", description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const filteredTracks = tracks.filter(t =>
    !trackSearch || t.track_name?.toLowerCase().includes(trackSearch.toLowerCase()) || t.client_name?.toLowerCase().includes(trackSearch.toLowerCase())
  );

  const docLabel = (q) => q.document_type === "invoice" ? "Invoice" : q.document_type === "proforma" ? "Proforma" : "Quote";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/purchase-orders")} className="text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-200 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-darkblack-700 dark:text-white">New Purchase Order</h1>
          <p className="text-sm text-bgray-500 dark:text-bgray-400">Pick a project and a document, then choose which items to actually order</p>
        </div>
      </div>

      {/* Step breadcrumb */}
      {!preselectedQuotationId && (
        <div className="flex items-center gap-2 mb-6 text-sm">
          <span className={step === "project" ? "font-semibold text-primary" : "text-bgray-400"}>1. Project</span>
          <span className="text-bgray-300">→</span>
          <span className={step === "document" ? "font-semibold text-primary" : "text-bgray-400"}>2. Document</span>
          <span className="text-bgray-300">→</span>
          <span className={step === "items" ? "font-semibold text-primary" : "text-bgray-400"}>3. Items</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Step 1: Project picker */}
      {!loading && step === "project" && (
        <div className="space-y-3">
          <input
            type="text"
            value={trackSearch}
            onChange={e => setTrackSearch(e.target.value)}
            placeholder="Search project or client..."
            className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
          />
          <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl divide-y divide-bgray-100 dark:divide-darkblack-500 max-h-[500px] overflow-y-auto">
            {filteredTracks.map(t => (
              <button
                key={t.track_id}
                onClick={() => pickTrack(t)}
                className="w-full text-left px-4 py-3 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-darkblack-700 dark:text-white text-sm">{t.track_name}</p>
                  <p className="text-xs text-bgray-500 dark:text-bgray-400">{t.client_name}</p>
                </div>
                <svg className="w-4 h-4 text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
            {filteredTracks.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-bgray-400">No projects found.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Document picker */}
      {!loading && step === "document" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-bgray-500 dark:text-bgray-400">
              Project: <strong className="text-darkblack-700 dark:text-white">{selectedTrack?.track_name}</strong>
            </p>
            <button onClick={() => setStep("project")} className="text-xs text-primary hover:underline">Change project</button>
          </div>
          <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl divide-y divide-bgray-100 dark:divide-darkblack-500">
            {quotations.map(q => (
              <button
                key={q.id}
                onClick={() => pickQuotation(q)}
                className="w-full text-left px-4 py-3 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${q.document_type === "invoice" ? "bg-emerald-500" : q.document_type === "proforma" ? "bg-blue-500" : "bg-amber-400"}`} />
                  <span className="font-semibold text-darkblack-700 dark:text-white text-sm">{docLabel(q)} {q.quote_number}</span>
                  {q.purpose && <span className="text-xs text-bgray-400">· {q.purpose}</span>}
                </div>
                <span className="text-sm text-bgray-500 dark:text-bgray-400">{q.currency} {Number(q.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </button>
            ))}
            {quotations.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-bgray-400">No quotations for this project yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Item selection by supplier */}
      {!loading && step === "items" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-bgray-500 dark:text-bgray-400">
              {docLabel(selectedQuotation)} <strong className="text-darkblack-700 dark:text-white">{selectedQuotation?.quote_number}</strong>
              {selectedTrack && <> · {selectedTrack.track_name}</>}
            </p>
            {!preselectedQuotationId && (
              <button onClick={() => setStep("document")} className="text-xs text-primary hover:underline">Change document</button>
            )}
          </div>

          {Object.keys(itemsBySupplier).length === 0 && (
            <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl px-4 py-10 text-center text-sm text-bgray-400">
              This document has no items with a supplier assigned.
            </div>
          )}

          {Object.entries(itemsBySupplier).map(([supplierId, groupItems]) => {
            const allChecked = groupItems.every(it => checked[it.id]);
            const someChecked = groupItems.some(it => checked[it.id]);
            return (
              <div key={supplierId} className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-bgray-50 dark:bg-darkblack-500 border-b border-bgray-200 dark:border-darkblack-400">
                  <span className="font-semibold text-darkblack-700 dark:text-white text-sm">🏭 {suppliers[supplierId]?.name || "Unknown supplier"}</span>
                  <button onClick={() => toggleGroup(supplierId, groupItems)} className="text-xs text-primary hover:underline font-medium">
                    {allChecked ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="divide-y divide-bgray-100 dark:divide-darkblack-500">
                  {groupItems.map(it => (
                    <label key={it.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition">
                      <input
                        type="checkbox"
                        checked={!!checked[it.id]}
                        onChange={() => toggleItem(it.id)}
                        className="w-4 h-4 rounded accent-primary shrink-0"
                      />
                      {it.picture_url && <img src={it.picture_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                      <div className="flex-1 min-w-0">
                        {it.item_number && <span className="font-mono text-xs text-bgray-500 mr-2">{it.item_number}</span>}
                        <span className="text-sm text-darkblack-700 dark:text-white truncate">{it.description}</span>
                      </div>
                      <span className="text-xs text-bgray-400 shrink-0">Qty {it.quantity}</span>
                      {it.supplier_price && (
                        <span className="text-sm font-semibold text-amber-600 shrink-0">
                          {it.supplier_currency || selectedQuotation.currency} {parseFloat(it.supplier_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {Object.keys(itemsBySupplier).length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-bgray-500 dark:text-bgray-400">{selectedCount} item{selectedCount !== 1 ? "s" : ""} selected</p>
              <button
                onClick={handleCreate}
                disabled={creating || selectedCount === 0}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition"
              >
                {creating ? "Creating..." : "Create Purchase Order(s)"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
