import React, { useEffect, useMemo, useRef, useState } from "react";
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
    <div className="flex-shrink-0 w-24">
    <div className="relative group w-24 h-24">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-24 h-24 object-cover rounded-lg border border-gray-200" /></a>
      ) : (
        <button type="button" disabled={readOnly} onClick={() => ref.current?.click()}
          className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 flex flex-col items-center justify-center text-[11px] gap-0.5 disabled:hover:border-gray-300 disabled:hover:text-gray-400">
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
    {!readOnly && <p className="mt-1 text-[10px] text-gray-400 text-center leading-tight">Clic para subir<br />o pega con Ctrl+V</p>}
    </div>
  );
}

// Order lines, shared by the client portal and the staff view.
//  Table view; click a row to open its details (photo, colour, brand, packaging, notes…).
//  lines: orderDiff "editable line" shape · onChange(nextLines)
//  uploadPhoto(blob) -> public url (omit to hide photo upload)
//  exportMeta {title, client} shows the Excel/PDF buttons
export default function OrderLinesTable({ lines, onChange, readOnly = false, uploadPhoto, exportMeta }) {
  const [q, setQ] = useState("");
  const [busyPhoto, setBusyPhoto] = useState({});
  const [exporting, setExporting] = useState("");
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [hover, setHover] = useState(null);
  const thumbInput = useRef(null);
  const thumbKey = useRef(null);

  const patch = (key, p) => onChange(lines.map(l => (l._key === key ? { ...l, ...p } : l)));
  const remove = (key) => { onChange(lines.filter(l => l._key !== key)); setExpanded(null); };
  const add = () => { const n = emptyLine(lines[lines.length - 1]?.sheet_name || ""); onChange([...lines, n]); setExpanded(n._key); };
  const totals = useMemo(() => orderTotals(lines), [lines]);
  const canPhoto = !readOnly && !!uploadPhoto;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = lines.map((l, i) => [l, i]);
    if (!s) return all;
    return all.filter(([l]) => [l.name, l.supplier_ref, l.client_ref, l.supplier, l.color, l.brand, l.notes].some(v => String(v || "").toLowerCase().includes(s)));
  }, [lines, q]);

  const pickPhoto = async (key, file) => {
    setErr(""); setBusyPhoto(b => ({ ...b, [key]: true }));
    try { patch(key, { photo_url: await uploadPhoto(await shrink(file)) }); }
    catch (e) { setErr(e.message || "No pudimos subir la foto."); }
    finally { setBusyPhoto(b => ({ ...b, [key]: false })); }
  };

  // Ctrl+V: paste an image onto the row being hovered, else the open one
  const pasteRef = useRef();
  pasteRef.current = (e) => {
    const target = hover || expanded;
    if (!canPhoto || !target) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (!file) return;
    e.preventDefault();
    pickPhoto(target, file);
  };
  useEffect(() => {
    const h = (e) => pasteRef.current(e);
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, []);

  const doExport = async (kind) => {
    setExporting(kind); setErr("");
    try { await (kind === "xlsx" ? exportOrderExcel : exportOrderPdf)({ ...exportMeta, lines }); }
    catch (e) { setErr(e.message || "No pudimos exportar."); }
    finally { setExporting(""); }
  };

  const cellInput = "w-full px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none rounded-md text-sm bg-transparent";
  const stop = (e) => e.stopPropagation();

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

      <input ref={thumbInput} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f && thumbKey.current) pickPhoto(thumbKey.current, f); }} />

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 w-10 text-left">#</th>
              <th className="px-2 py-2 w-14 text-left">Foto</th>
              <th className="px-2 py-2 text-left min-w-[220px]">Producto</th>
              <th className="px-2 py-2 text-left w-28">Ref. prov.</th>
              <th className="px-2 py-2 text-left w-32">Proveedor</th>
              <th className="px-2 py-2 text-left w-40">Color</th>
              <th className="px-2 py-2 text-left w-24">Cant.</th>
              <th className="px-2 py-2 text-left w-28">Precio obj.</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {shown.map(([l, idx]) => {
              const p = lineProblems(l);
              const bad = p.id || p.qty;
              const open = expanded === l._key;
              const hex = colorToHex(l.color);
              return (
                <React.Fragment key={l._key}>
                  <tr onClick={() => setExpanded(open ? null : l._key)}
                    className={`border-t border-gray-100 cursor-pointer ${open ? "bg-blue-50/60" : bad ? "bg-red-50" : "hover:bg-gray-50"}`}>
                    <td className="px-3 py-1.5 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1.5" onMouseEnter={() => setHover(l._key)} onMouseLeave={() => setHover(null)}
                      onClick={e => { if (canPhoto && !l.photo_url) { stop(e); thumbKey.current = l._key; thumbInput.current?.click(); } }}>
                      {busyPhoto[l._key] ? <div className="w-10 h-10 rounded-md bg-gray-100 text-[9px] text-gray-400 flex items-center justify-center">…</div>
                        : l.photo_url ? <img src={l.photo_url} alt="" className="w-10 h-10 object-cover rounded-md border border-gray-200" />
                        : <div className={`w-10 h-10 rounded-md border border-dashed border-gray-300 text-gray-300 flex items-center justify-center ${canPhoto ? "hover:border-blue-400 hover:text-blue-500" : ""}`}>{canPhoto ? "+" : ""}</div>}
                    </td>
                    <td className="px-2 py-1.5" onClick={readOnly ? undefined : stop}>
                      {readOnly ? <span className="font-medium text-gray-900">{l.name || "—"}</span>
                        : <input value={l.name} onChange={e => patch(l._key, { name: e.target.value })} placeholder="Nombre del producto"
                            className={`${cellInput} font-medium text-gray-900 ${p.id ? "border-red-400" : ""}`} />}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs text-gray-600">{l.supplier_ref}</td>
                    <td className="px-2 py-1.5 text-gray-600 truncate max-w-[8rem]">{l.supplier}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2 text-gray-700">
                        {hex && <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ background: hex }} />}
                        <span className="truncate max-w-[7rem]">{l.color}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5" onClick={readOnly ? undefined : stop}>
                      {readOnly ? <span className="font-semibold">{Number(l.qty || 0).toLocaleString()}</span>
                        : <input type="number" min="0" value={l.qty} onChange={e => patch(l._key, { qty: e.target.value })} className={`${cellInput} ${p.qty ? "border-red-400" : ""}`} />}
                    </td>
                    <td className="px-2 py-1.5" onClick={readOnly ? undefined : stop}>
                      {readOnly ? <span>{l.price || "—"}</span>
                        : <input type="number" min="0" step="any" value={l.price} onChange={e => patch(l._key, { price: e.target.value })} className={cellInput} />}
                    </td>
                    <td className="px-2 text-gray-400 text-xs">{open ? "▲" : "▼"}</td>
                  </tr>

                  {open && (
                    <tr className="bg-blue-50/30 border-t border-blue-100">
                      <td colSpan={9} className="px-5 py-4">
                        <div className="flex gap-5">
                          <div onMouseEnter={() => setHover(l._key)} onMouseLeave={() => setHover(null)}>
                            <PhotoBox url={l.photo_url} readOnly={!canPhoto} busy={busyPhoto[l._key]}
                              onPick={f => pickPhoto(l._key, f)} onClear={() => patch(l._key, { photo_url: null })} />
                          </div>
                          <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-3">
                            <Field label="Ref. proveedor" className="col-span-1 md:col-span-3">
                              {readOnly ? <p className="text-sm font-mono">{l.supplier_ref || "—"}</p> : <input value={l.supplier_ref} onChange={e => patch(l._key, { supplier_ref: e.target.value })} className={inputCls} />}
                            </Field>
                            <Field label="Proveedor" className="col-span-1 md:col-span-3">
                              {readOnly ? <p className="text-sm">{l.supplier || "—"}</p> : <input value={l.supplier} onChange={e => patch(l._key, { supplier: e.target.value })} className={inputCls} />}
                            </Field>
                            <Field label="Color (texto, Pantone, hex o RGB)" className="col-span-2 md:col-span-6">
                              <ColorField value={l.color} readOnly={readOnly} onChange={v => patch(l._key, { color: v })} />
                            </Field>
                            <Field label="Ref. cliente" className="col-span-1 md:col-span-3">
                              {readOnly ? <p className="text-sm font-mono">{l.client_ref || "—"}</p> : <input value={l.client_ref} onChange={e => patch(l._key, { client_ref: e.target.value })} className={inputCls} />}
                            </Field>
                            <Field label="Marca" className="col-span-1 md:col-span-3">
                              {readOnly ? <p className="text-sm">{l.brand || "—"}</p> : <input value={l.brand} onChange={e => patch(l._key, { brand: e.target.value })} className={inputCls} />}
                            </Field>
                            <Field label="Marcación" className="col-span-1 md:col-span-2">
                              {readOnly ? <p className="text-sm">{l.marking === true ? "SI" : l.marking === false ? "NO" : "—"}</p>
                                : <select value={l.marking == null ? "" : l.marking ? "1" : "0"} onChange={e => patch(l._key, { marking: e.target.value === "" ? null : e.target.value === "1" })} className={inputCls}>
                                    <option value="">—</option><option value="1">SI</option><option value="0">NO</option>
                                  </select>}
                            </Field>
                            <Field label="Empaque" className="col-span-1 md:col-span-4">
                              {readOnly ? <p className="text-sm">{l.packaging || "—"}</p> : <input value={l.packaging} onChange={e => patch(l._key, { packaging: e.target.value })} className={inputCls} />}
                            </Field>
                            <Field label="Notas" className="col-span-2 md:col-span-12">
                              {readOnly ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{l.notes || "—"}</p>
                                : <textarea value={l.notes} rows={2} onChange={e => patch(l._key, { notes: e.target.value })} placeholder="Instrucciones, detalles, observaciones…" className={`${inputCls} resize-y`} />}
                            </Field>
                          </div>
                          {!readOnly && (
                            <button type="button" onClick={() => remove(l._key)} className="self-start text-xs text-red-500 hover:text-red-700 whitespace-nowrap">Quitar producto</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">{lines.length ? "Nada coincide con la búsqueda." : "Sin productos."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && <button type="button" onClick={add} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700">+ Agregar producto</button>}
    </div>
  );
}
