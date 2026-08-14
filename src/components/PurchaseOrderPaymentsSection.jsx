import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { sileo } from "sileo";

const CURRENCIES = ["USD", "COP", "EUR", "CNY", "HKD"];

export default function PurchaseOrderPaymentsSection({ purchaseOrderId, currency, total, payments, setPayments }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [form, setForm] = useState({
    amount: "", currency, payment_date: new Date().toISOString().slice(0, 10), method: "", reference: "", notes: "",
  });

  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const balanceDue = total - totalPaid;

  const resetForm = () => {
    setForm({ amount: "", currency, payment_date: new Date().toISOString().slice(0, 10), method: "", reference: "", notes: "" });
    setReceiptFile(null);
    setShowForm(false);
  };

  const handleAddPayment = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      sileo.warning({ title: "Enter a valid payment amount" });
      return;
    }
    setSaving(true);
    try {
      let receiptUrl = "";
      let receiptFileName = "";
      if (receiptFile) {
        const path = `${purchaseOrderId}/${Date.now()}-${receiptFile.name}`;
        const { error: upErr } = await supabase.storage.from("payment-receipts").upload(path, receiptFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("payment-receipts").getPublicUrl(path);
        receiptUrl = publicUrl;
        receiptFileName = receiptFile.name;
      }
      const { data, error } = await supabase.from("purchase_order_payments").insert({
        purchase_order_id: purchaseOrderId,
        amount: parseFloat(form.amount),
        currency: form.currency,
        payment_date: form.payment_date,
        method: form.method || null,
        reference: form.reference || null,
        notes: form.notes || null,
        receipt_url: receiptUrl || null,
        receipt_file_name: receiptFileName || null,
      }).select().single();
      if (error) throw error;
      setPayments(prev => [...prev, data].sort((a, b) => (a.payment_date || "").localeCompare(b.payment_date || "")));
      sileo.success({ title: "Payment registered" });
      resetForm();
    } catch (e) {
      sileo.error({ title: "Could not register payment", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm("Delete this payment record?")) return;
    try {
      const { error } = await supabase.from("purchase_order_payments").delete().eq("id", id);
      if (error) throw error;
      setPayments(prev => prev.filter(p => p.id !== id));
      sileo.success({ title: "Payment removed" });
    } catch (e) {
      sileo.error({ title: "Delete failed", description: e.message });
    }
  };

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  return (
    <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-darkblack-700 dark:text-white flex items-center gap-2">🏭 Supplier Payments</h3>
        <button onClick={() => setShowForm(v => !v)} className="text-sm text-primary hover:underline font-medium">
          {showForm ? "Cancel" : "+ Register Payment"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bgray-50 dark:bg-darkblack-500 rounded-lg p-3 text-center">
          <p className="text-[10px] text-bgray-400 uppercase tracking-wide">Total</p>
          <p className="font-bold text-darkblack-700 dark:text-white">{currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 text-center">
          <p className="text-[10px] text-blue-600 uppercase tracking-wide">Paid to Supplier</p>
          <p className="font-bold text-blue-700 dark:text-blue-400">{currency} {totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${balanceDue > 0.004 ? "bg-amber-50 dark:bg-amber-900/10" : "bg-green-50 dark:bg-green-900/10"}`}>
          <p className={`text-[10px] uppercase tracking-wide ${balanceDue > 0.004 ? "text-amber-600" : "text-green-600"}`}>Balance Owed</p>
          <p className={`font-bold ${balanceDue > 0.004 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}>
            {currency} {Math.max(balanceDue, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {showForm && (
        <div className="bg-bgray-50 dark:bg-darkblack-500 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-bgray-500 mb-1">Amount</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} onWheel={e => e.target.blur()} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-bgray-500 mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={inputCls}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-bgray-500 mb-1">Date</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-bgray-500 mb-1">Method</label>
              <input type="text" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} placeholder="Wire transfer, cash..." className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-bgray-500 mb-1">Reference</label>
              <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Transaction #, bank, notes..." className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-bgray-500 mb-1">Receipt / Proof of Payment</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-bgray-500 dark:text-bgray-400 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-bgray-100 dark:file:bg-darkblack-400 file:text-xs file:text-darkblack-700 dark:file:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleAddPayment} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </div>
      )}

      {payments.length > 0 ? (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-bgray-50 dark:bg-darkblack-500 rounded-lg text-sm">
              <div className="min-w-0">
                <span className="font-semibold text-darkblack-700 dark:text-white">
                  {p.currency} {parseFloat(p.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-bgray-400 mx-1.5">·</span>
                <span className="text-bgray-500 dark:text-bgray-400">{p.payment_date}</span>
                {p.method && <span className="text-bgray-400"> · {p.method}</span>}
                {p.reference && <span className="text-bgray-400"> · {p.reference}</span>}
                {p.receipt_url && (
                  <a href={p.receipt_url} target="_blank" rel="noreferrer" className="ml-2 text-primary hover:underline text-xs">📎 Receipt</a>
                )}
              </div>
              <button onClick={() => handleDeletePayment(p.id)} className="text-bgray-400 hover:text-red-500 shrink-0 ml-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      ) : !showForm && (
        <p className="text-sm text-bgray-400 text-center py-2">No payments registered yet.</p>
      )}
    </div>
  );
}
