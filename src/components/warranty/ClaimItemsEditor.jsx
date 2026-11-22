import React, { useRef, useState } from "react";
import { parseWarrantyTracker, imageToFile } from "../../lib/warrantyExcel";
import { uploadPortalMedia } from "../../portal/lib/uploadPortalMedia";
import { RESOLUTION_LABEL } from "../../lib/warranty";
import { MediaThumbs, MediaPicker, VerdictBadge, inputCls, labelCls } from "./WarrantyBits";

export const emptyItem = (extra = {}) => ({
  product_name: "", brand: "", supplier_name: "", supplier_order_ref: "", supplier_model: "", client_model: "",
  problem: "", qty: 1, received_at: "", complaint_date: "", media: [], supplier_question: "", supplier_answer: "", resolution: "", ...extra,
});

// The lines of a claim: same fields as the client's "Warranty Tracker" Excel, plus photos/videos.
// `staff` also shows the supplier's question/answer and the resolution.
export default function ClaimItemsEditor({ items, setItems, rules, staff = false, defaultReceived = "" }) {
  const fileRef = useRef(null);
  const [importing, setImporting] = useState("");
  const [err, setErr] = useState("");

  const set = (i, patch) => setItems(items.map((it, k) => k === i ? { ...it, ...patch } : it));
  const remove = (i) => setItems(items.filter((_, k) => k !== i));

  async function importExcel(file) {
    setErr(""); setImporting("Leyendo el Excel…");
    try {
      const rows = await parseWarrantyTracker(file);
      if (!rows.length) { setErr("No encontré filas en ese Excel. ¿Es el Warranty Tracker?"); return; }
      const out = [];
      for (let n = 0; n < rows.length; n++) {
        const r = rows[n];
        setImporting(`Subiendo fotos… (${n + 1}/${rows.length})`);
        const media = [];
        for (let k = 0; k < r.images.length; k++) {
          try { media.push(await uploadPortalMedia(imageToFile(r.images[k], k))); } catch { /* skip a bad image */ }
        }
        out.push(emptyItem({ ...r, received_at: defaultReceived || "", media, images: undefined, _row: undefined, sheet: undefined }));
      }
      setItems([...items.filter(it => it.product_name || it.problem), ...out]);
    } catch (e) { setErr(e.message || "No pudimos leer el Excel."); }
    finally { setImporting(""); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" onClick={() => setItems([...items, emptyItem({ received_at: defaultReceived || "" })])}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700">+ Agregar producto</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={e => { if (e.target.files[0]) importExcel(e.target.files[0]); e.target.value = ""; }} />
        <button type="button" disabled={!!importing} onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {importing || "Importar Warranty Tracker (Excel)"}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>

      {items.length === 0 && <p className="text-sm text-gray-500">Agrega los productos con problemas, o importa tu Excel de seguimiento de garantías.</p>}

      {items.map((it, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-3 bg-white dark:bg-darkblack-600 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
              <div className="col-span-2"><label className={labelCls}>Producto *</label><input className={inputCls} value={it.product_name || ""} onChange={e => set(i, { product_name: e.target.value })} /></div>
              <div><label className={labelCls}>Marca</label><input className={inputCls} value={it.brand || ""} onChange={e => set(i, { brand: e.target.value })} placeholder="Opcional" /></div>
              <div><label className={labelCls}>Cantidad</label><input type="number" min="1" className={inputCls} value={it.qty} onChange={e => set(i, { qty: e.target.value })} /></div>
              <div><label className={labelCls}>Proveedor</label><input className={inputCls} value={it.supplier_name || ""} onChange={e => set(i, { supplier_name: e.target.value })} /></div>
              <div><label className={labelCls}>Orden del proveedor</label><input className={inputCls} value={it.supplier_order_ref || ""} onChange={e => set(i, { supplier_order_ref: e.target.value })} /></div>
              <div><label className={labelCls}>Ref. proveedor</label><input className={inputCls} value={it.supplier_model || ""} onChange={e => set(i, { supplier_model: e.target.value })} /></div>
              <div><label className={labelCls}>Ref. cliente</label><input className={inputCls} value={it.client_model || ""} onChange={e => set(i, { client_model: e.target.value })} /></div>
              <div className="col-span-2 md:col-span-3"><label className={labelCls}>Problema *</label><input className={inputCls} value={it.problem || ""} onChange={e => set(i, { problem: e.target.value })} placeholder="Qué falla y cómo se nota" /></div>
              <div><label className={labelCls}>Recibido el</label><input type="date" className={inputCls} value={(it.received_at || "").slice(0, 10)} onChange={e => set(i, { received_at: e.target.value })} /></div>
              {staff && <div><label className={labelCls}>Fecha del reclamo</label><input type="date" className={inputCls} value={(it.complaint_date || "").slice(0, 10)} onChange={e => set(i, { complaint_date: e.target.value })} /></div>}
            </div>
            <button type="button" onClick={() => remove(i)} title="Quitar producto" className="text-gray-400 hover:text-red-600 text-lg px-1">✕</button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <MediaThumbs media={it.media} onRemove={k => set(i, { media: it.media.filter((_, j) => j !== k) })} />
            <MediaPicker onAdd={added => set(i, { media: [...it.media, ...added].slice(0, 10) })} />
          </div>

          {staff && (
            <div className="grid md:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
              <div><label className={labelCls}>Pregunta al proveedor</label><textarea rows={2} className={inputCls} value={it.supplier_question || ""} onChange={e => set(i, { supplier_question: e.target.value })} /></div>
              <div><label className={labelCls}>Respuesta del proveedor</label><textarea rows={2} className={inputCls} value={it.supplier_answer || ""} onChange={e => set(i, { supplier_answer: e.target.value })} /></div>
              <div><label className={labelCls}>Resolución</label>
                <select className={inputCls} value={it.resolution || ""} onChange={e => set(i, { resolution: e.target.value })}>
                  <option value="">Pendiente</option>
                  {Object.entries(RESOLUTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
          )}

          <VerdictBadge item={{ ...it, complaint_date: it.complaint_date || undefined }} rules={rules} withNote />
        </div>
      ))}
    </div>
  );
}
