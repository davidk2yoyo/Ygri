import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { SupplierProductionCard } from "./ProductionBoard";

// "Production" tab of a project: one card per supplier purchase order, with a
// ready checklist staff can edit directly (no need to open each PO). This is
// the entry point the quotation-toolbar icon button was too easy to miss.
export default function ProjectProductionSection({ trackId }) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [quotationId, setQuotationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [{ data: pos, error: poErr }, { data: quotes }] = await Promise.all([
        supabase.from("purchase_orders")
          .select("id, po_number, status, supplier_id, suppliers(name), purchase_order_items(id, description, picture_url, ready_at, expected_ready_date, notes)")
          .eq("track_id", trackId).order("created_at"),
        supabase.from("quotations").select("id").eq("track_id", trackId).order("created_at", { ascending: false }).limit(1),
      ]);
      if (poErr) throw poErr;
      setPurchaseOrders((pos || []).map(po => ({
        id: po.id, po_number: po.po_number, status: po.status,
        supplier_name: po.suppliers?.name, items: po.purchase_order_items || [],
      })));
      setQuotationId(quotes?.[0]?.id || null);
    } catch (e) {
      setError(e.message || "Couldn't load production data.");
    } finally {
      setLoading(false);
    }
  }, [trackId]);
  useEffect(() => { load(); }, [load]);

  const patchItem = async (item, patch) => {
    // optimistic — the checklist shouldn't flicker while the request is in flight
    setPurchaseOrders(prev => prev.map(po => ({
      ...po, items: po.items.map(it => it.id === item.id ? { ...it, ...patch } : it),
    })));
    const { error: e } = await supabase.from("purchase_order_items").update(patch).eq("id", item.id);
    if (e) { setError(e.message); load(); }
  };

  const newPoHref = quotationId ? `/purchase-orders/new?quotationId=${quotationId}` : "/purchase-orders/new";

  if (loading) return <div className="p-6 text-sm text-bgray-500">Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">Production</h3>
          <p className="text-xs text-bgray-500 dark:text-bgray-400 mt-0.5">One card per supplier purchase order — check items off as they become ready.</p>
        </div>
        <a href={newPoHref} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">+ New purchase order</a>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      {purchaseOrders.length === 0 ? (
        <p className="text-sm text-bgray-400">No purchase orders yet for this project.</p>
      ) : (
        <div className="space-y-3">
          {purchaseOrders.map(po => (
            <SupplierProductionCard key={po.id} po={po} readOnly={false}
              onItemChange={patchItem} openHref={`/purchase-orders/${po.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
