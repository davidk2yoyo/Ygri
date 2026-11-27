import React, { useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { supabase } from "../supabaseClient";
import { planSplit, splitInvoice, lineValue } from "../lib/splitInvoice";

// Staff: move lines (or part of a line's quantity) from this proforma/invoice into a NEW one in the
// same project. The new document starts hidden from the client; its packing list is edited separately.
const inputCls = "px-2 py-1 border border-bgray-300 dark:border-darkblack-400 rounded-md text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary";
const money = (n, c) => `${c || ""} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

export default function SplitInvoiceModal({ quotationId, onClose, onDone }) {
  const [src, setSrc] = useState(null);
  const [items, setItems] = useState(null);
  const [optionsByItem, setOptionsByItem] = useState({});
  const [qty, setQty] = useState({});          // itemId -> string
  const [hasPacking, setHasPacking] = useState(false);
  const [payCount, setPayCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: q }, { data: rows }, { count: pl }, { count: pc }] = await Promise.all([
        supabase.from("quotations").select("*").eq("id", quotationId).single(),
        supabase.from("quotation_items").select("*, suppliers(name)").eq("quotation_id", quotationId).order("sort_order"),
        supabase.from("packing_lists").select("id", { count: "exact", head: true }).eq("quotation_id", quotationId),
        supabase.from("quotation_payments").select("id", { count: "exact", head: true }).eq("quotation_id", quotationId),
      ]);
      const ids = (rows || []).map(r => r.id);
      const { data: opts } = ids.length ? await supabase.from("quotation_item_options").select("*").in("quotation_item_id", ids) : { data: [] };
      const byItem = {};
      (opts || []).forEach(o => { (byItem[o.quotation_item_id] ||= []).push(o); });
      setSrc(q); setItems(rows || []); setOptionsByItem(byItem); setHasPacking((pl || 0) > 0); setPayCount(pc || 0);
    })();
  }, [quotationId]);

  const picks = useMemo(() => Object.fromEntries(Object.entries(qty).map(([k, v]) => [k, Math.floor(parseFloat(v) || 0)])), [qty]);

  const groups = useMemo(() => {
    const g = {};
    (items || []).forEach(it => {
      const key = it.supplier_id || "none";
      (g[key] ||= { key, name: it.suppliers?.name || "Sin proveedor", items: [] }).items.push(it);
    });
    return Object.values(g);
  }, [items]);

  const plan = useMemo(() => items && src ? planSplit({ items, optionsByItem, picks, commissionPct: src.commission_pct }) : null, [items, optionsByItem, picks, src]);
  const movingLines = Object.values(picks).filter(v => v > 0).length;

  const setFull = (it, on) => setQty(q => ({ ...q, [it.id]: on ? String(it.quantity) : "" }));
  const groupFull = (g) => g.items.every(it => picks[it.id] >= (parseInt(it.quantity) || 1));
  const toggleGroup = (g) => {
    const on = !groupFull(g);
    setQty(q => { const n = { ...q }; g.items.forEach(it => { n[it.id] = on ? String(it.quantity) : ""; }); return n; });
  };

  async function submit() {
    setBusy(true); setError("");
    try {
      const r = await splitInvoice(supabase, { sourceId: quotationId, picks });
      sileo.success({ title: `Creada ${r.created.quote_number}`, description: "Está oculta al cliente hasta que la publiques." });
      onDone?.(r);
    } catch (e) {
      setError(e.message || "No se pudo dividir.");
    } finally { setBusy(false); }
  }

  const label = src?.document_type === "proforma" ? "proforma" : "factura";
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-bgray-200 dark:border-darkblack-400">
          <div>
            <h3 className="font-bold text-darkblack-700 dark:text-white">Dividir {label} {src?.quote_number}</h3>
            <p className="text-xs text-bgray-500 mt-0.5">Elige qué pasa a una {label} nueva del mismo proyecto. Las órdenes de compra no cambian. La nueva queda oculta al cliente hasta que la publiques.</p>
          </div>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!items ? <p className="text-sm text-bgray-400 text-center py-8">Cargando…</p> : groups.map(g => (
            <div key={g.key} className="border border-bgray-200 dark:border-darkblack-400 rounded-xl overflow-hidden">
              <label className="flex items-center gap-2 px-3 py-2 bg-bgray-50 dark:bg-darkblack-500 text-sm font-semibold text-darkblack-700 dark:text-white cursor-pointer select-none">
                <input type="checkbox" checked={groupFull(g)} onChange={() => toggleGroup(g)} />
                {g.name} <span className="text-xs font-normal text-bgray-500">· todo el proveedor ({g.items.length} {g.items.length === 1 ? "línea" : "líneas"})</span>
              </label>
              <div className="divide-y divide-bgray-100 dark:divide-darkblack-400">
                {g.items.map(it => {
                  const have = parseInt(it.quantity) || 1;
                  const q = picks[it.id] || 0;
                  return (
                    <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                      <input type="checkbox" checked={q >= have} onChange={e => setFull(it, e.target.checked)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-darkblack-700 dark:text-white truncate">{it.description || "—"}</p>
                        <p className="text-xs text-bgray-500">{it.item_number || "sin ref."} · {money(lineValue(it, optionsByItem[it.id] || []) / have)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-bgray-500 whitespace-nowrap">
                        mover
                        <input type="number" min="0" max={have} value={qty[it.id] ?? ""} placeholder="0" onChange={e => setQty(s => ({ ...s, [it.id]: e.target.value }))}
                          onWheel={e => e.target.blur()} className={`${inputCls} w-24 text-right ${q > have ? "border-red-400" : ""}`} />
                        de {have.toLocaleString("en-US")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-bgray-200 dark:border-darkblack-400 space-y-2">
          {src?.show_to_client && (
            <p className="text-xs px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              Esta {label} ya está publicada para el cliente: verá que su total baja en cuanto la dividas, mientras la nueva sigue oculta. Publica ambas juntas.
            </p>
          )}
          {(hasPacking || payCount > 0) && (
            <p className="text-xs text-bgray-500">
              {hasPacking && "El packing list de esta factura no se modifica: ajústalo a mano. "}
              {payCount > 0 && "Los pagos se quedan en esta factura; muévelos con «Move» en Client Payments."}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {plan && !plan.error && (
            <p className="text-xs text-bgray-600 dark:text-bgray-300">
              Pasan <b>{movingLines}</b> {movingLines === 1 ? "línea" : "líneas"}: la nueva tendrá <b>{money(plan.movedTotal, src.currency)}</b> y esta quedará en <b>{money(plan.keptTotal, src.currency)}</b>.
            </p>
          )}
          {plan?.error && movingLines > 0 && <p className="text-xs text-red-600">{plan.error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-bgray-300 text-bgray-600 hover:bg-bgray-100">Cancelar</button>
            <button onClick={submit} disabled={busy || !plan || !!plan.error} className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white disabled:opacity-50">
              {busy ? "Dividiendo…" : `Crear ${label} nueva`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
