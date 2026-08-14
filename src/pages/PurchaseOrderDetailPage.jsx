import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { sileo } from "sileo";
import PurchaseOrderPaymentsSection from "../components/PurchaseOrderPaymentsSection";
import PurchaseOrderPDF from "../components/PurchaseOrderPDF";

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [po, setPo] = useState(null);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [quotation, setQuotation] = useState(null);
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPDF, setShowPDF] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: poData } = await supabase.from("purchase_orders").select("*").eq("id", id).single();
      if (!poData) { setLoading(false); return; }
      setPo(poData);

      const [{ data: itemsData }, { data: paymentsData }, { data: supplierData }] = await Promise.all([
        supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id).order("sort_order"),
        supabase.from("purchase_order_payments").select("*").eq("purchase_order_id", id).order("payment_date"),
        poData.supplier_id ? supabase.from("suppliers").select("*").eq("id", poData.supplier_id).single() : Promise.resolve({ data: null }),
      ]);
      setItems((itemsData || []).map(it => ({ ...it, _localId: it.id })));
      setPayments(paymentsData || []);
      setSupplier(supplierData);

      if (poData.quotation_id) {
        const { data: quotData } = await supabase.from("quotations").select("id, quote_number, document_type").eq("id", poData.quotation_id).single();
        setQuotation(quotData);
      }
      if (poData.track_id) {
        const { data: trackData } = await supabase.from("v_tracks_overview").select("track_name, client_name").eq("track_id", poData.track_id).single();
        setTrack(trackData);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateItem = (localId, field, value) =>
    setItems(prev => prev.map(it => it._localId === localId ? { ...it, [field]: value } : it));

  const removeItem = (localId) => setItems(prev => prev.filter(it => it._localId !== localId));

  const total = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 1), 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: poErr } = await supabase.from("purchase_orders").update({ notes: po.notes, status: po.status }).eq("id", po.id);
      if (poErr) throw poErr;

      for (const it of items) {
        const { error } = await supabase.from("purchase_order_items").update({
          quantity: parseInt(it.quantity) || 1,
          price: parseFloat(it.price) || 0,
        }).eq("id", it.id);
        if (error) throw error;
      }
      sileo.success({ title: "Purchase order saved" });
      await loadData();
    } catch (e) {
      sileo.error({ title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary";

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (!po) return (
    <div className="p-6 text-center text-bgray-400">Purchase order not found.</div>
  );

  if (showPDF) {
    return (
      <PurchaseOrderPDF
        purchaseOrder={po}
        items={items}
        supplierName={supplier?.name}
        projectName={track?.track_name}
        quoteNumber={quotation?.quote_number}
        payments={payments}
        onClose={() => setShowPDF(false)}
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/purchase-orders")} className="text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-200 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-darkblack-700 dark:text-white">{po.po_number}</h1>
            <p className="text-sm text-bgray-500 dark:text-bgray-400">
              🏭 {supplier?.name || "—"}
              {track && <> · {track.track_name} ({track.client_name})</>}
              {quotation && <> · from {quotation.quote_number}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPDF(true)} className="px-4 py-2 bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 text-darkblack-700 dark:text-white rounded-lg text-sm font-medium hover:border-primary hover:text-primary transition">
            📄 Preview PDF
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Status + Currency */}
      <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl p-5 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Status</label>
          <select value={po.status} onChange={e => setPo(p => ({ ...p, status: e.target.value }))} className={inputCls}>
            <option value="draft">Draft</option>
            <option value="placed">Placed with supplier</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Currency</label>
          <input value={po.currency} disabled className={`${inputCls} opacity-60`} />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-bgray-50 dark:bg-darkblack-500 border-b border-bgray-200 dark:border-darkblack-400">
          <h3 className="font-bold text-darkblack-700 dark:text-white text-sm">Items</h3>
        </div>
        <div className="divide-y divide-bgray-100 dark:divide-darkblack-500">
          {items.map(it => (
            <div key={it._localId} className="flex items-center gap-3 px-5 py-3">
              {it.picture_url && <img src={it.picture_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                {it.item_number && <span className="font-mono text-xs text-bgray-500 mr-2">{it.item_number}</span>}
                <span className="text-sm text-darkblack-700 dark:text-white">{it.description}</span>
              </div>
              <div className="w-20 shrink-0">
                <input type="number" min="1" value={it.quantity} onChange={e => updateItem(it._localId, "quantity", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
              </div>
              <div className="w-28 shrink-0">
                <input type="number" min="0" step="0.01" value={it.price} onChange={e => updateItem(it._localId, "price", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-right`} />
              </div>
              <div className="w-28 text-right shrink-0 text-sm font-semibold text-darkblack-700 dark:text-white">
                {po.currency} {((parseFloat(it.price) || 0) * (parseInt(it.quantity) || 1)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <button onClick={() => removeItem(it._localId)} className="text-bgray-300 hover:text-red-500 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end px-5 py-3 bg-bgray-50 dark:bg-darkblack-500 border-t border-bgray-200 dark:border-darkblack-400">
          <span className="text-sm font-bold text-darkblack-700 dark:text-white">Total: {po.currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Payments */}
      <PurchaseOrderPaymentsSection
        purchaseOrderId={po.id}
        currency={po.currency}
        total={total}
        payments={payments}
        setPayments={setPayments}
      />

      {/* Notes */}
      <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl p-5">
        <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2">Notes</label>
        <textarea
          rows={3}
          value={po.notes || ""}
          onChange={e => setPo(p => ({ ...p, notes: e.target.value }))}
          placeholder="Delivery time, negotiation terms, remarks..."
          className={`${inputCls} resize-y`}
        />
      </div>
    </div>
  );
}
