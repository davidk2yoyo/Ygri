import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { sileo } from "sileo";
import { movePayment } from "../lib/paymentMove";

const CURRENCIES = ["USD", "COP", "EUR", "CNY", "HKD"];

export default function QuotationPaymentsSection({ quotationId, trackId, currency, grandTotal, payments, setPayments }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [editing, setEditing] = useState(null);   // { id, amount, payment_date, method, reference, notes }
  const [moving, setMoving] = useState(null);     // { payment, targetId, amount }
  const [siblings, setSiblings] = useState(null); // other proformas/invoices of the project
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({
    amount: "", currency, payment_date: new Date().toISOString().slice(0, 10), method: "", reference: "", notes: "",
  });

  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const balanceDue = grandTotal - totalPaid;

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
        const path = `${quotationId}/${Date.now()}-${receiptFile.name}`;
        const { error: upErr } = await supabase.storage.from("payment-receipts").upload(path, receiptFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("payment-receipts").getPublicUrl(path);
        receiptUrl = publicUrl;
        receiptFileName = receiptFile.name;
      }
      const { data, error } = await supabase.from("quotation_payments").insert({
        quotation_id: quotationId,
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
      const { error } = await supabase.from("quotation_payments").delete().eq("id", id);
      if (error) throw error;
      setPayments(prev => prev.filter(p => p.id !== id));
      sileo.success({ title: "Payment removed" });
    } catch (e) {
      sileo.error({ title: "Delete failed", description: e.message });
    }
  };

  const handleSaveEdit = async () => {
    const amt = parseFloat(editing.amount);
    if (!(amt > 0)) { sileo.warning({ title: "Enter a valid payment amount" }); return; }
    setBusyId(editing.id);
    try {
      const { data, error } = await supabase.from("quotation_payments").update({
        amount: amt, payment_date: editing.payment_date, method: editing.method || null,
        reference: editing.reference || null, notes: editing.notes || null,
      }).eq("id", editing.id).select().single();
      if (error) throw error;
      setPayments(prev => prev.map(p => p.id === data.id ? data : p).sort((a, b) => (a.payment_date || "").localeCompare(b.payment_date || "")));
      setEditing(null);
      sileo.success({ title: "Payment updated" });
    } catch (e) {
      sileo.error({ title: "Could not update payment", description: e.message });
    } finally { setBusyId(null); }
  };

  const openMove = async (p) => {
    setEditing(null);
    setMoving({ payment: p, targetId: "", amount: String(p.amount) });
    if (siblings === null && trackId) {
      const { data } = await supabase.from("quotations").select("id, quote_number, document_type, currency, total_amount")
        .eq("track_id", trackId).in("document_type", ["proforma", "invoice"]).neq("id", quotationId).order("created_at");
      setSiblings(data || []);
    }
  };

  const handleMove = async () => {
    setBusyId(moving.payment.id);
    try {
      const { remaining } = await movePayment(supabase, { payment: moving.payment, targetId: moving.targetId, amount: moving.amount });
      setPayments(prev => remaining ? prev.map(p => p.id === remaining.id ? remaining : p) : prev.filter(p => p.id !== moving.payment.id));
      setMoving(null);
      sileo.success({ title: "Payment moved" });
    } catch (e) {
      sileo.error({ title: "Could not move payment", description: e.message });
    } finally { setBusyId(null); }
  };

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  return (
    <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-darkblack-700 dark:text-white flex items-center gap-2">💳 Client Payments</h3>
        <button onClick={() => setShowForm(v => !v)} className="text-sm text-primary hover:underline font-medium">
          {showForm ? "Cancel" : "+ Register Payment"}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bgray-50 dark:bg-darkblack-500 rounded-lg p-3 text-center">
          <p className="text-[10px] text-bgray-400 uppercase tracking-wide">Total</p>
          <p className="font-bold text-darkblack-700 dark:text-white">{currency} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 text-center">
          <p className="text-[10px] text-green-600 uppercase tracking-wide">Paid</p>
          <p className="font-bold text-green-700 dark:text-green-400">{currency} {totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${balanceDue > 0.004 ? "bg-amber-50 dark:bg-amber-900/10" : "bg-green-50 dark:bg-green-900/10"}`}>
          <p className={`text-[10px] uppercase tracking-wide ${balanceDue > 0.004 ? "text-amber-600" : "text-green-600"}`}>Balance Due</p>
          <p className={`font-bold ${balanceDue > 0.004 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}>
            {currency} {Math.max(balanceDue, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Add payment form */}
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

      {/* Payment list */}
      {payments.length > 0 ? (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="px-3 py-2 bg-bgray-50 dark:bg-darkblack-500 rounded-lg text-sm">
              <div className="flex items-center justify-between">
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
                <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                  <button onClick={() => { setMoving(null); setEditing({ id: p.id, amount: String(p.amount), payment_date: p.payment_date || "", method: p.method || "", reference: p.reference || "", notes: p.notes || "" }); }} className="text-primary hover:underline">Edit</button>
                  <button onClick={() => openMove(p)} className="text-primary hover:underline">Move</button>
                  <button onClick={() => handleDeletePayment(p.id)} className="text-bgray-400 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              {editing?.id === p.id && (
                <div className="mt-2 pt-2 border-t border-bgray-200 dark:border-darkblack-400 space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input type="number" min="0" step="0.01" value={editing.amount} onChange={e => setEditing(x => ({ ...x, amount: e.target.value }))} onWheel={e => e.target.blur()} className={inputCls} placeholder="Amount" />
                    <input type="date" value={editing.payment_date} onChange={e => setEditing(x => ({ ...x, payment_date: e.target.value }))} className={inputCls} />
                    <input type="text" value={editing.method} onChange={e => setEditing(x => ({ ...x, method: e.target.value }))} className={inputCls} placeholder="Method" />
                    <input type="text" value={editing.reference} onChange={e => setEditing(x => ({ ...x, reference: e.target.value }))} className={inputCls} placeholder="Reference" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs rounded-lg border border-bgray-300 text-bgray-600">Cancel</button>
                    <button onClick={handleSaveEdit} disabled={busyId === p.id} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white disabled:opacity-50">Save</button>
                  </div>
                </div>
              )}
              {moving?.payment.id === p.id && (() => {
                const targets = (siblings || []).filter(q => (q.currency || "USD") === p.currency);
                return (
                  <div className="mt-2 pt-2 border-t border-bgray-200 dark:border-darkblack-400 space-y-2">
                    {siblings === null ? <p className="text-xs text-bgray-400">Loading…</p>
                      : targets.length === 0 ? <p className="text-xs text-bgray-500">No other proforma/invoice in {p.currency} in this project. Use “Split” to create one.</p>
                      : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-xs text-bgray-500 mb-1">Move to</label>
                            <select value={moving.targetId} onChange={e => setMoving(m => ({ ...m, targetId: e.target.value }))} className={inputCls}>
                              <option value="">Choose invoice…</option>
                              {targets.map(q => <option key={q.id} value={q.id}>{q.quote_number} · {q.document_type} · {q.currency} {Number(q.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-bgray-500 mb-1">Amount to move (max {p.amount})</label>
                            <input type="number" min="0" step="0.01" max={p.amount} value={moving.amount} onChange={e => setMoving(m => ({ ...m, amount: e.target.value }))} onWheel={e => e.target.blur()} className={inputCls} />
                          </div>
                        </div>
                      )}
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setMoving(null)} className="px-3 py-1.5 text-xs rounded-lg border border-bgray-300 text-bgray-600">Cancel</button>
                      <button onClick={handleMove} disabled={busyId === p.id || !moving.targetId} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white disabled:opacity-50">Move</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      ) : !showForm && (
        <p className="text-sm text-bgray-400 text-center py-2">No payments registered yet.</p>
      )}
    </div>
  );
}
