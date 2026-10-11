import React, { useMemo, useRef, useState } from "react";
import { emptyLine, lineProblems } from "../lib/orderDiff";
import { colorToHex, withHex } from "../lib/colorUtil";
import { exportOrderExcel, exportOrderPdf, orderTotals } from "../lib/orderExport";

const inputCls = "w-full px-2.5 py-1.5 border border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none rounded-lg text-sm bg-white text-gray-900";

// shrink big phone photos before upload (max 900px, JPEG)
async function shrink(file, max = 900) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(res, "image/jpeg", 0.82));
}

function Field({ label, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function ColorField({ value, onChange, readOnly }) {
  const hex = colorToHex(value);
  const swatch = (
    <span className="relative flex-shrink-0 w-8 h-8">
      <span className={`block w-8 h-8 rounded-full border ${hex ? "border-gray-300" : "border-dashed border-gray-300 bg-white"}`} style={hex ? { background: hex } : undefined}>
        {!hex && <span className="flex items-center justify-center w-full h-full text-gray-300 text-base leading-none">+</span>}
      </span>
      {!readOnly && (
        <input type="color" value={hex || "#cccccc"} onChange={e => onChange(withHex(value, e.target.value))}
          title="Elegir color (escribe a la derecha un Pantone, RGB o nombre)" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      )}
    </span>
  );
  return (
    <div className="flex items-center gap-2">
      {swatch}
      {readOnly ? <span className="text-sm text-gray-800">{value}</span>
        : <input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder="Rosado, PANTONE 186 C, #C8102E…" className={inputCls} />}
    </div>
  );
}

function PhotoBox({ url, onPick, onClear, busy, readOnly }) {
  const ref = useRef(null);
  return (
    <div className="relative group flex-shrink-0 w-20 h-20">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" /></a>
      ) : (
        <button type="button" disabled={readOnly} onClick={() => ref.current?.click()}
          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 flex flex-col items-center justify-center text-[11px] gap-0.5 disabled:hover:border-gray-300 disabled:hover:text-gray-400">
          {busy ? "Subiendo…" : readOnly ? "Sin foto" : <><span className="text-xl leading-none">+</span>Foto</>}
        </button>
      )}
      {!readOnly && url && (
        <div className="absolute inset-x-0 bottom-0 hidden group-hover:flex rounded-b-lg overflow-hidden text-[10px] font-medium text-white">
          <button type="button" onClick={() => ref.current?.click()} className="flex-1 bg-black/60 hover:bg-black/80 py-1">{busy ? "…" : "Cambiar"}</button>
          <button type="button" onClick={onClear} className="px-2 bg-red-600/80 hover:bg-red-600 py-1">×</button>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
    </div>
  );
}

// Order lines, shared by the client portal and the staff view.
//  lines: orderDiff "editable line" shape · onChange(nextLines)
//  uploadPhoto(blob) -> public url (omit to hide photo upload)
//  exportMeta {title, client} shows the Excel/PDF buttons
export default function OrderLinesTable({ lines, onChange, readOnly = false, uploadPhoto, exportMeta }) {
  const [q, setQ] = useState("");
  const [busyPhoto, setBusyPhoto] = useState({});
  const [exporting, setExporting] = useState("");
  const [err, setErr] = useState("");

  const patch = (key, p) => onChange(lines.map(l => (l._key === key ? { ...l, ...p } : l)));
  const remove = (key) => onChange(lines.filter(l => l._key !== key));
  const add = () => onChange([...lines, emptyLine(lines[lines.length - 1]?.sheet_name || "")]);
  const totals = useMemo(() => orderTotals(lines), [lines]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return lines.map((l, i) => [l, i]);
    return lines.map((l, i) => [l, i]).filter(([l]) =>
      [l.name, l.supplier_ref, l.client_ref, l.supplier, l.color, l.brand, l.notes].some(v => String(v || "").toLowerCase().includes(s)));
  }, [lines, q]);

  const pickPhoto = async (key, file) => {
    setErr(""); setBusyPhoto(b => ({ ...b, [key]: true }));
    try { patch(key, { photo_url: await uploadPhoto(await shrink(file)) }); }
    catch (e) { setErr(e.message || "No pudimos subir la foto."); }
    finally { setBusyPhoto(b => ({ ...b, [key]: false })); }
  };

  const doExport = async (kind) => {
    setExporting(kind); setErr("");
    try { await (kind === "xlsx" ? exportOrderExcel : exportOrderPdf)({ ...exportMeta, lines }); }
    catch (e) { setErr(e.message || "No pudimos exportar."); }
    finally { setExporting(""); }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-sm text-gray-600">
          <span><b className="text-gray-900">{totals.count}</b> productos</span>
          <span><b className="text-gray-900">{totals.units.toLocaleString()}</b> unidades</span>
          {totals.priced > 0 && <span>Total objetivo <b className="text-gray-900">{totals.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>}
        </div>
        <div className="flex items-center gap-2">
          {lines.length > 8 && <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className="w-40 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm" />}
          {exportMeta && (
            <>
              <button type="button" onClick={() => doExport("xlsx")} disabled={!!exporting || !lines.length} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">{exporting === "xlsx" ? "Generando…" : "Excel"}</button>
              <button type="button" onClick={() => doExport("pdf")} disabled={!!exporting || !lines.length} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">{exporting === "pdf" ? "Generando…" : "PDF"}</button>
            </>
          )}
        </div>
      </div>
      {err && <p className="mb-2 text-xs text-red-600">{err}</p>}

      <div className="space-y-3">
        {shown.map(([l, idx]) => {
          const p = lineProblems(l);
          const bad = p.id || p.qty;
          return (
            <div key={l._key} className={`rounded-xl border p-4 flex gap-4 ${bad ? "border-red-300 bg-red-50/40" : "border-gray-200 bg-white"}`}>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-400">#{idx + 1}</span>
                <PhotoBox url={l.photo_url} readOnly={readOnly || !uploadPhoto} busy={busyPhoto[l._key]}
                  onPick={f => pickPhoto(l._key, f)} onClear={() => patch(l._key, { photo_url: null })} />
              </div>

              <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-3">
                <Field label="Nombre del producto *" className="col-span-2 md:col-span-5">
                  {readOnly ? <p className="text-sm font-medium text-gray-900">{l.name || "—"}</p>
                    : <input value={l.name} onChange={e => patch(l._key, { name: e.target.value })} className={`${inputCls} ${p.id ? "border-red-400" : ""}`} />}
                </Field>
                <Field label="Ref. proveedor" className="col-span-1 md:col-span-2">
                  {readOnly ? <p className="text-sm font-mono">{l.supplier_ref || "—"}</p> : <input value={l.supplier_ref} onChange={e => patch(l._key, { supplier_ref: e.target.value })} className={inputCls} />}
                </Field>
                <Field label="Proveedor" className="col-span-1 md:col-span-2">
                  {readOnly ? <p className="text-sm">{l.supplier || "—"}</p> : <input value={l.supplier} onChange={e => patch(l._key, { supplier: e.target.value })} className={inputCls} />}
                </Field>
                <Field label="Cantidad *" className="col-span-1 md:col-span-1">
                  {readOnly ? <p className="text-sm font-semibold">{Number(l.qty || 0).toLocaleString()}</p>
                    : <input type="number" min="0" value={l.qty} onChange={e => patch(l._key, { qty: e.target.value })} className={`${inputCls} ${p.qty ? "border-red-400" : ""}`} />}
                </Field>
                <Field label="Precio obj." className="col-span-1 md:col-span-2">
                  {readOnly ? <p className="text-sm">{l.price || "—"}</p> : <input type="number" min="0" step="any" value={l.price} onChange={e => patch(l._key, { price: e.target.value })} className={inputCls} />}
                </Field>

                <Field label="Color (texto, Pantone, hex o RGB)" className="col-span-2 md:col-span-5">
                  <ColorField value={l.color} readOnly={readOnly} onChange={v => patch(l._key, { color: v })} />
                </Field>
                <Field label="Ref. cliente" className="col-span-1 md:col-span-2">
                  {readOnly ? <p className="text-sm font-mono">{l.client_ref || "—"}</p> : <input value={l.client_ref} onChange={e => patch(l._key, { client_ref: e.target.value })} className={inputCls} />}
                </Field>
                <Field label="Marca" className="col-span-1 md:col-span-2">
                  {readOnly ? <p className="text-sm">{l.brand || "—"}</p> : <input value={l.brand} onChange={e => patch(l._key, { brand: e.target.value })} className={inputCls} />}
                </Field>
                <Field label="Marcación" className="col-span-1 md:col-span-1">
                  {readOnly ? <p className="text-sm">{l.marking === true ? "SI" : l.marking === false ? "NO" : "—"}</p>
                    : <select value={l.marking == null ? "" : l.marking ? "1" : "0"} onChange={e => patch(l._key, { marking: e.target.value === "" ? null : e.target.value === "1" })} className={inputCls}>
                        <option value="">—</option><option value="1">SI</option><option value="0">NO</option>
                      </select>}
                </Field>
                <Field label="Empaque" className="col-span-1 md:col-span-2">
                  {readOnly ? <p className="text-sm">{l.packaging || "—"}</p> : <input value={l.packaging} onChange={e => patch(l._key, { packaging: e.target.value })} className={inputCls} />}
                </Field>

                <Field label="Notas" className="col-span-2 md:col-span-12">
                  {readOnly ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{l.notes || "—"}</p>
                    : <textarea value={l.notes} rows={1} onChange={e => patch(l._key, { notes: e.target.value })} placeholder="Instrucciones, detalles, observaciones…" className={`${inputCls} resize-y`} />}
                </Field>
              </div>

              {!readOnly && (
                <button type="button" onClick={() => remove(l._key)} title="Quitar producto" className="self-start text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-center text-sm text-gray-400 py-8">{lines.length ? "Nada coincide con la búsqueda." : "Sin productos."}</p>}
      </div>

      {!readOnly && <button type="button" onClick={add} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700">+ Agregar producto</button>}
    </div>
  );
}
