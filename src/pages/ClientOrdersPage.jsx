import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sileo } from "sileo";
import { supabase } from "../supabaseClient";
import { parseClientOrderWorkbook } from "../lib/clientOrderParser";
import OrderLinesTable from "../components/OrderLinesTable";
import { OrderHistoryButton } from "../components/OrderEventLog";
import { createProjectAndQuotation, sendQuotationToClient } from "../lib/orderToQuotation";
import { diffLines, hasChanges, describeChanges, lineFromDb, lineToDb, lineProblems } from "../lib/orderDiff";
import { matchSupplierByName } from "../lib/suppliers";

const STATUS_STYLE = {
  submitted: "bg-purple-100 text-purple-700",
  in_review: "bg-amber-100 text-amber-700",
  draft: "bg-gray-100 text-gray-600",
  changes_requested: "bg-red-100 text-red-700",
  confirmed: "bg-blue-100 text-blue-700",
  quoted: "bg-amber-100 text-amber-700",
  ordered: "bg-green-100 text-green-700",
  closed: "bg-bgray-200 text-bgray-600",
};

const inputCls = "px-2 py-1 border border-bgray-300 dark:border-darkblack-400 rounded text-xs bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-1 focus:ring-primary";

const matchSupplier = (suppliers, ...names) => {
  const wanted = names.map(n => (n || "").trim().toLowerCase()).filter(Boolean);
  for (const w of wanted) {
    const exact = suppliers.find(s => s.name.trim().toLowerCase() === w);
    if (exact) return exact;
  }
  for (const w of wanted) {
    const part = suppliers.find(s => s.name.toLowerCase().includes(w) || w.includes(s.name.toLowerCase()));
    if (part) return part;
  }
  return null;
};

function ImportWizard({ clients, suppliers, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [clientId, setClientId] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null); // { sheets, readImage }
  const [sheets, setSheets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openSheet, setOpenSheet] = useState(null);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setParsing(true);
    setError("");
    try {
      const result = await parseClientOrderWorkbook(await f.arrayBuffer());
      const prepared = [];
      for (const s of result.sheets) {
        const lines = [];
        for (const l of s.lines) {
          let preview = null;
          if (l.image) {
            const blob = await result.readImage(l.image.path);
            if (blob) preview = URL.createObjectURL(blob);
          }
          lines.push({ ...l, preview, _id: Math.random().toString(36).slice(2) });
        }
        const sup = matchSupplier(suppliers, s.name, lines[0]?.supplier);
        prepared.push({
          ...s,
          lines,
          include: s.kind === "supplier",
          supplier_id: sup?.id || "",
        });
      }
      setParsed(result);
      setSheets(prepared);
      setOpenSheet(prepared.find(p => p.include)?.name || null);
      if (!reference) setReference(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(`Could not read the file: ${e.message}`);
    } finally {
      setParsing(false);
    }
  };

  const patchSheet = (name, patch) => setSheets(prev => prev.map(s => s.name === name ? { ...s, ...patch } : s));
  const patchLine = (sheetName, id, patch) =>
    setSheets(prev => prev.map(s => s.name !== sheetName ? s : { ...s, lines: s.lines.map(l => l._id === id ? { ...l, ...patch } : l) }));
  const removeLine = (sheetName, id) =>
    setSheets(prev => prev.map(s => s.name !== sheetName ? s : { ...s, lines: s.lines.filter(l => l._id !== id) }));

  const included = sheets.filter(s => s.include);
  const totalLines = included.reduce((n, s) => n + s.lines.length, 0);

  const handleSave = async () => {
    if (!clientId) { setError("Pick the client this order belongs to."); return; }
    if (!totalLines) { setError("Nothing to import — include at least one sheet with lines."); return; }
    setSaving(true);
    setError("");
    try {
      const stamp = Date.now();
      const ext = file.name.split(".").pop();
      const srcPath = `${clientId}/${stamp}-order.${ext}`;
      const up = await supabase.storage.from("client-orders").upload(srcPath, file);
      if (up.error) throw up.error;
      const srcUrl = supabase.storage.from("client-orders").getPublicUrl(srcPath).data.publicUrl;

      const { data: order, error: oErr } = await supabase
        .from("client_orders")
        .insert({ client_id: clientId, reference: reference.trim() || null, source_file_url: srcUrl, source_file_name: file.name })
        .select().single();
      if (oErr) throw oErr;

      // photos first (one upload per line that has one), then a single bulk insert of lines
      const rows = [];
      let order_i = 0;
      for (const s of included) {
        for (const l of s.lines) {
          let photoUrl = null;
          if (l.image) {
            const blob = await parsed.readImage(l.image.path);
            if (blob) {
              const p = `${order.id}/${s.name}-${l.row}.${l.image.ext}`.replace(/\s+/g, "_");
              const { error: pErr } = await supabase.storage.from("client-orders").upload(p, blob, { upsert: true, contentType: blob.type || undefined });
              if (!pErr) photoUrl = supabase.storage.from("client-orders").getPublicUrl(p).data.publicUrl;
            }
          }
          rows.push({
            order_id: order.id,
            sheet_name: s.name,
            sheet_row: l.row,
            supplier_id: s.supplier_id || null,
            supplier_name_raw: l.supplier || s.name,
            supplier_ref: l.supplier_ref || null,
            name: l.name || null,
            color: l.color || null,
            qty: l.qty,
            client_price: l.price,
            client_ref: l.client_ref || null,
            brand: l.brand || null,
            marking: l.marking,
            packaging: l.packaging || null,
            notes: l.notes || null,
            photo_url: photoUrl,
            sort_order: order_i++,
          });
        }
      }
      for (let i = 0; i < rows.length; i += 100) {
        const { error: lErr } = await supabase.from("client_order_lines").insert(rows.slice(i, i + 100));
        if (lErr) throw lErr;
      }

      await supabase.from("client_order_events").insert({ order_id: order.id, actor_type: "staff", actor_name: "Imported by staff", kind: "submitted" });

      // keep the original file with the client's documents (hidden from the portal by default)
      await supabase.from("client_documents").insert({
        client_id: clientId, name: `Client order — ${reference || file.name}`, document_type: "client_order",
        file_url: srcUrl, file_name: file.name, file_size: file.size, show_to_client: false,
      });

      sileo.success({ title: "Order imported", description: `${rows.length} lines from ${included.length} sheets` });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-bgray-200 dark:border-darkblack-400">
          <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">Import client order (Excel)</h2>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-bgray-600 mb-1 uppercase tracking-wide">Client *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${inputCls} w-full py-2 text-sm`}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-bgray-600 mb-1 uppercase tracking-wide">Reference</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. Pedido julio 2026" className={`${inputCls} w-full py-2 text-sm`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-bgray-600 mb-1 uppercase tracking-wide">Excel file *</label>
              <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} className="w-full px-3 py-2 border border-dashed border-bgray-300 rounded-lg text-sm text-bgray-600 hover:border-primary hover:text-primary transition">
                {file ? file.name : "Choose .xlsx…"}
              </button>
            </div>
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-bgray-500 py-6 justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /> Reading sheets and photos…
            </div>
          )}

          {sheets.length > 0 && (
            <>
              <p className="text-sm text-bgray-600">
                <b>{included.length}</b> of {sheets.length} sheets selected · <b>{totalLines}</b> lines. Sheets that don't look like a supplier order (e.g. your own PROFORMA, empty or unrecognized layouts) start unchecked.
              </p>
              <div className="space-y-2">
                {sheets.map(s => (
                  <div key={s.name} className={`border rounded-xl ${s.include ? "border-primary/40" : "border-bgray-200 opacity-70"}`}>
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <input type="checkbox" checked={s.include} disabled={!s.lines.length} onChange={e => patchSheet(s.name, { include: e.target.checked })} />
                      <button onClick={() => setOpenSheet(openSheet === s.name ? null : s.name)} className="flex-1 text-left">
                        <span className="font-semibold text-sm text-darkblack-700 dark:text-white">{s.name}</span>
                        <span className="ml-2 text-xs text-bgray-500">
                          {s.kind === "supplier" ? `${s.lines.length} lines · ${s.imageCount} photos`
                            : s.kind === "proforma" ? `Proforma / invoice sheet — ${s.lines.length} lines (reference only)`
                            : s.kind === "unknown" ? "Layout not recognized — needs a manual column mapping"
                            : "Empty"}
                        </span>
                      </button>
                      {s.include && (
                        <select value={s.supplier_id} onChange={e => patchSheet(s.name, { supplier_id: e.target.value })} className={`${inputCls} w-56`}>
                          <option value="">Supplier: not matched</option>
                          {suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                        </select>
                      )}
                    </div>
                    {openSheet === s.name && s.lines.length > 0 && (
                      <div className="overflow-x-auto border-t border-bgray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-bgray-50 text-bgray-500 uppercase">
                              {["", "Supplier ref", "Name", "Color", "Qty", "Client ref", "Brand", "Mark", "Packaging", "Notes", ""].map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {s.lines.map(l => (
                              <tr key={l._id} className="border-t border-bgray-100">
                                <td className="px-2 py-1">{l.preview ? <img src={l.preview} alt="" className="w-9 h-9 object-cover rounded" /> : <div className="w-9 h-9 rounded bg-bgray-100" />}</td>
                                <td className="px-2 py-1"><input value={l.supplier_ref} onChange={e => patchLine(s.name, l._id, { supplier_ref: e.target.value })} className={`${inputCls} w-28 font-mono`} /></td>
                                <td className="px-2 py-1"><input value={l.name} onChange={e => patchLine(s.name, l._id, { name: e.target.value })} className={`${inputCls} w-56`} /></td>
                                <td className="px-2 py-1"><input value={l.color} onChange={e => patchLine(s.name, l._id, { color: e.target.value })} className={`${inputCls} w-24`} /></td>
                                <td className="px-2 py-1"><input type="number" value={l.qty ?? ""} onChange={e => patchLine(s.name, l._id, { qty: e.target.value === "" ? null : parseFloat(e.target.value) })} className={`${inputCls} w-20`} /></td>
                                <td className="px-2 py-1"><input value={l.client_ref} onChange={e => patchLine(s.name, l._id, { client_ref: e.target.value })} className={`${inputCls} w-24 font-mono`} /></td>
                                <td className="px-2 py-1"><input value={l.brand} onChange={e => patchLine(s.name, l._id, { brand: e.target.value })} className={`${inputCls} w-28`} /></td>
                                <td className="px-2 py-1">
                                  <select value={l.marking === true ? "yes" : l.marking === false ? "no" : ""} onChange={e => patchLine(s.name, l._id, { marking: e.target.value === "" ? null : e.target.value === "yes" })} className={`${inputCls} w-14`}>
                                    <option value="">—</option><option value="yes">SI</option><option value="no">NO</option>
                                  </select>
                                </td>
                                <td className="px-2 py-1"><input value={l.packaging} onChange={e => patchLine(s.name, l._id, { packaging: e.target.value })} className={`${inputCls} w-40`} /></td>
                                <td className="px-2 py-1"><input value={l.notes} onChange={e => patchLine(s.name, l._id, { notes: e.target.value })} className={`${inputCls} w-40`} /></td>
                                <td className="px-2 py-1"><button onClick={() => removeLine(s.name, l._id)} className="text-bgray-300 hover:text-red-500">×</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-bgray-200 dark:border-darkblack-400">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 border border-bgray-300 rounded-lg text-sm text-bgray-600 hover:bg-bgray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !totalLines || !clientId} className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Importing…" : `Import ${totalLines} lines`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shown before a project/quotation is created from an order whose lines have
// supplier names the client typed by hand — nothing gets matched or created
// silently; staff confirms (or fixes) each one here first.
function SupplierMatchModal({ names, suppliers, onCancel, onConfirm }) {
  const [rows, setRows] = useState(() => names.map(name => {
    const match = matchSupplierByName(name, suppliers);
    return {
      name, mode: match ? "existing" : "new", supplierId: match?.id || "",
      newInfo: { address: "", email: "", sales_person: "", wechat_or_whatsapp: "" },
    };
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const patchRow = (i, p) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...p } : r));
  const patchNewInfo = (i, p) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, newInfo: { ...r.newInfo, ...p } } : r));

  const confirm = async () => {
    setSaving(true); setError("");
    try {
      const map = {};
      for (const r of rows) {
        if (r.mode === "existing") {
          if (!r.supplierId) throw new Error(`Pick a supplier for "${r.name}", or switch it to New supplier.`);
          map[r.name] = r.supplierId;
        } else {
          const { data, error: e } = await supabase.from("suppliers").insert({
            name: r.name, address: r.newInfo.address || null, email: r.newInfo.email || null,
            sales_person: r.newInfo.sales_person || null, wechat_or_whatsapp: r.newInfo.wechat_or_whatsapp || null,
          }).select().single();
          if (e) throw e;
          map[r.name] = data.id;
        }
      }
      onConfirm(map);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={saving ? undefined : onCancel}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-bgray-200 dark:border-darkblack-400">
          <div>
            <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">Confirm suppliers</h2>
            <p className="text-xs text-bgray-500 mt-0.5">The client typed these supplier names by hand — confirm which real supplier each one is before the project is created.</p>
          </div>
          <button onClick={onCancel} disabled={saving} className="text-bgray-400 hover:text-bgray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
          {rows.map((r, i) => (
            <div key={r.name} className="border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <p className="text-sm font-semibold text-darkblack-700 dark:text-white">"{r.name}"</p>
                <div className="flex items-center gap-0.5 bg-bgray-100 dark:bg-darkblack-500 rounded-lg p-0.5">
                  <button onClick={() => patchRow(i, { mode: "existing" })} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${r.mode === "existing" ? "bg-primary text-white" : "text-bgray-500"}`}>Existing supplier</button>
                  <button onClick={() => patchRow(i, { mode: "new" })} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${r.mode === "new" ? "bg-primary text-white" : "text-bgray-500"}`}>New supplier</button>
                </div>
              </div>
              {r.mode === "existing" ? (
                <select value={r.supplierId} onChange={e => patchRow(i, { supplierId: e.target.value })} className={`${inputCls} w-full py-2 text-sm`}>
                  <option value="">Select a supplier…</option>
                  {suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Address" value={r.newInfo.address} onChange={e => patchNewInfo(i, { address: e.target.value })} className={`${inputCls} py-2 text-sm`} />
                  <input placeholder="Email" value={r.newInfo.email} onChange={e => patchNewInfo(i, { email: e.target.value })} className={`${inputCls} py-2 text-sm`} />
                  <input placeholder="Contact person" value={r.newInfo.sales_person} onChange={e => patchNewInfo(i, { sales_person: e.target.value })} className={`${inputCls} py-2 text-sm`} />
                  <input placeholder="WeChat / WhatsApp" value={r.newInfo.wechat_or_whatsapp} onChange={e => patchNewInfo(i, { wechat_or_whatsapp: e.target.value })} className={`${inputCls} py-2 text-sm`} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-bgray-200 dark:border-darkblack-400">
          <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-bgray-600 hover:text-bgray-800">Cancel</button>
          <button onClick={confirm} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? "Creating…" : "Confirm & create project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-upload an Excel (same template/parser as importing a new order) purely to backfill the
// "price" field on lines the order already has — matched by supplier ref, nothing else is
// touched. Returns a {lineId: price} map; the caller merges it into local line state and the
// existing Save button persists + logs it like any other edit, instead of this modal writing
// to the DB directly.
const FIELD_UPDATE_META = {
  price: { noun: "prices", columnHeader: "New price", instructions: "Matches by supplier ref — only the price field changes." },
  qty: { noun: "quantities", columnHeader: "New qty", instructions: "Matches by supplier ref — only the quantity field changes, e.g. after a packing-list recount." },
};

// Shared by "Update prices…" and "Update quantities…" — same file, same matching rules,
// just a different column of the parsed row and of the order line.
function UpdateFieldModal({ field, lines, onApply, onClose }) {
  const meta = FIELD_UPDATE_META[field];
  const fileRef = useRef(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState(null);
  const [unmatched, setUnmatched] = useState([]);
  const [ambiguous, setAmbiguous] = useState([]); // [{ ref, rows: [fileRow], lines: [orderLine] }]
  const [manualMap, setManualMap] = useState({}); // `${groupIdx}:${rowIdx}` -> lineId | ""

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true); setError(""); setMatches(null); setUnmatched([]); setAmbiguous([]); setManualMap({});
    try {
      const { sheets } = await parseClientOrderWorkbook(await file.arrayBuffer());
      const parsed = sheets.filter(s => s.kind === "supplier").flatMap(s => s.lines);

      const norm = (v) => (v || "").trim().toLowerCase();

      // Same ref can repeat in the file for different color variants at different
      // values (confirmed in real orders), so a bare ref match isn't safe when more
      // than one order line shares that ref — color has to disambiguate, or we skip it.
      const byRefColor = new Map();
      const byRefOnly = new Map();
      lines.forEach(l => {
        const ref = norm(l.supplier_ref);
        if (!ref) return;
        const rcKey = `${ref}|${norm(l.color)}`;
        if (!byRefColor.has(rcKey)) byRefColor.set(rcKey, []);
        byRefColor.get(rcKey).push(l);
        if (!byRefOnly.has(ref)) byRefOnly.set(ref, []);
        byRefOnly.get(ref).push(l);
      });

      const parsedByRef = new Map();
      const miss = [];
      parsed.forEach(p => {
        if (p[field] == null) return; // nothing to update for this row
        const ref = norm(p.supplier_ref);
        if (!ref) { miss.push(p); return; }
        if (!parsedByRef.has(ref)) parsedByRef.set(ref, []);
        parsedByRef.get(ref).push(p);
      });

      const matchRows = [];
      const ambig = [];
      for (const [ref, rows] of parsedByRef) {
        const refLines = byRefOnly.get(ref);
        if (!refLines?.length) { rows.forEach(r => miss.push(r)); continue; }

        const assigned = new Set();
        const unresolvedRows = [];
        for (const p of rows) {
          const colorMatches = (byRefColor.get(`${ref}|${norm(p.color)}`) || []).filter(l => !assigned.has(l.id));
          if (colorMatches.length) {
            matchRows.push({ supplier_ref: p.supplier_ref, color: p.color, value: p[field], lines: colorMatches });
            colorMatches.forEach(l => assigned.add(l.id));
          } else {
            unresolvedRows.push(p);
          }
        }

        const remainingLines = refLines.filter(l => !assigned.has(l.id));
        if (!remainingLines.length || !unresolvedRows.length) continue;

        if (remainingLines.length === 1 && unresolvedRows.length === 1) {
          const p = unresolvedRows[0];
          matchRows.push({ supplier_ref: p.supplier_ref, color: p.color, value: p[field], lines: remainingLines });
          continue;
        }

        const distinctValues = new Set(unresolvedRows.map(r => r[field]));
        if (distinctValues.size === 1) {
          // several rows/lines left, but they'd all land on the same value anyway — no real ambiguity
          matchRows.push({ supplier_ref: ref, color: null, value: [...distinctValues][0], lines: remainingLines });
          continue;
        }

        // genuinely ambiguous: different values, and nothing to tell rows and lines apart — let staff map it
        ambig.push({ ref, rows: unresolvedRows, lines: remainingLines });
      }

      setMatches(matchRows);
      setUnmatched(miss);
      setAmbiguous(ambig);
    } catch (e) {
      setError(e.message || "Couldn't read the file.");
    } finally {
      setParsing(false);
    }
  };

  const manualResolved = Object.values(manualMap).filter(v => v).length;
  const totalLines = (matches?.reduce((n, m) => n + m.lines.length, 0) || 0) + manualResolved;

  const apply = () => {
    const valueById = {};
    matches.forEach(m => m.lines.forEach(l => { valueById[l.id] = m.value; }));
    ambiguous.forEach((g, gi) => g.rows.forEach((r, ri) => {
      const lineId = manualMap[`${gi}:${ri}`];
      if (lineId) valueById[lineId] = r[field];
    }));
    onApply(valueById);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-bgray-200 dark:border-darkblack-400">
          <div>
            <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">Update {meta.noun} from Excel</h2>
            <p className="text-xs text-bgray-500 mt-0.5">{meta.instructions} Nothing is saved until you review and click Save on the order.</p>
          </div>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

          <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} className="w-full px-4 py-6 border-2 border-dashed border-bgray-300 rounded-xl text-sm text-bgray-500 hover:border-primary hover:text-primary transition">
            {parsing ? "Reading…" : "Choose .xlsx…"}
          </button>

          {matches && (
            <>
              <p className="text-sm text-bgray-600">
                <b>{totalLines}</b> line(s) in this order, from <b>{matches.length}</b> matched row(s) in the file, will get a new {field === "price" ? "price" : "quantity"}.
                {unmatched.length > 0 && <> <b>{unmatched.length}</b> row(s) in the file had no match in this order.</>}
                {ambiguous.length > 0 && <> <b>{manualResolved}</b>/<b>{ambiguous.reduce((n, g) => n + g.rows.length, 0)}</b> ambiguous row(s) mapped — see below.</>}
              </p>
              {matches.length > 0 && (
                <div className="border border-bgray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-bgray-50 text-bgray-500 sticky top-0"><tr>
                      <th className="px-2 py-1.5 text-left font-semibold">Ref</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Color</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Matched line(s)</th>
                      <th className="px-2 py-1.5 text-right font-semibold">{meta.columnHeader}</th>
                    </tr></thead>
                    <tbody>
                      {matches.map((m, i) => (
                        <tr key={i} className="border-t border-bgray-100">
                          <td className="px-2 py-1 font-mono">{m.supplier_ref}</td>
                          <td className="px-2 py-1 text-bgray-500">{m.color || "—"}</td>
                          <td className="px-2 py-1">{m.lines.map(l => l.name || l.supplier_ref).join(", ")}</td>
                          <td className="px-2 py-1 text-right font-semibold">{m.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ambiguous.length > 0 && (
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50">
                    <p className="text-xs font-semibold text-amber-700">Same ref, multiple lines in this order, different values — pick which line each row is for:</p>
                  </div>
                  <div className="divide-y divide-amber-100 max-h-72 overflow-y-auto">
                    {ambiguous.map((g, gi) => {
                      const usedElsewhere = new Set(g.rows.map((_, ri) => manualMap[`${gi}:${ri}`]).filter(Boolean));
                      return g.rows.map((r, ri) => {
                        const key = `${gi}:${ri}`;
                        const picked = manualMap[key] || "";
                        return (
                          <div key={key} className="flex items-center gap-2 px-3 py-2 text-xs">
                            <span className="font-mono w-20 shrink-0">{r.supplier_ref}</span>
                            <span className="w-16 shrink-0 text-bgray-500 truncate">{r.color || "—"}</span>
                            <span className="flex-1 text-bgray-600 truncate">{r.name}</span>
                            <span className="w-14 shrink-0 text-right font-semibold">{r[field]}</span>
                            <select
                              value={picked}
                              onChange={e => setManualMap(prev => ({ ...prev, [key]: e.target.value }))}
                              className="w-48 shrink-0 px-1.5 py-1 border border-bgray-300 dark:border-darkblack-400 rounded text-xs bg-white dark:bg-darkblack-600"
                            >
                              <option value="">Skip (don't update)</option>
                              {g.lines.map(l => (
                                <option key={l.id} value={l.id} disabled={usedElsewhere.has(l.id) && picked !== l.id}>
                                  {(l.name || l.supplier_ref)}{l.color ? ` (${l.color})` : ""} — was {l[field] || "—"}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              )}
              {unmatched.length > 0 && (
                <details className="text-xs text-bgray-500">
                  <summary className="cursor-pointer">{unmatched.length} unmatched row(s)</summary>
                  <ul className="mt-1 list-disc pl-4 max-h-32 overflow-y-auto">
                    {unmatched.map((u, i) => <li key={i}>{u.supplier_ref || "(no ref)"} — {u.name}</li>)}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-bgray-200 dark:border-darkblack-400">
          <button onClick={onClose} className="px-4 py-2 text-sm text-bgray-600 hover:text-bgray-800">Cancel</button>
          <button onClick={apply} disabled={!matches || totalLines === 0} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            Apply{totalLines > 0 ? ` (${totalLines})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order: listOrder, suppliers, onBack, onChanged }) {
  const [order, setOrder] = useState(listOrder);
  const [lines, setLines] = useState([]);
  const [original, setOriginal] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [convert, setConvert] = useState(null); // {name, workflow, publish} while the convert form is open
  const [supplierNames, setSupplierNames] = useState(null); // distinct supplier names awaiting confirmation, while that modal is open
  const [fieldUpdateMode, setFieldUpdateMode] = useState(null); // "price" | "qty" | null, while that modal is open

  // Merges matched values into local line state only — doesn't write to the DB itself, so the
  // normal Save button (and its diff/history logging) handles persisting it like any other edit.
  const applyFieldUpdates = (field, valueById) => {
    setLines(prev => prev.map(l => valueById[l.id] != null ? { ...l, [field]: valueById[l.id] } : l));
  };

  const actor = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user?.email || "Staff";
  };

  const load = async () => {
    const [o, l, e] = await Promise.all([
      supabase.from("client_orders").select("*, clients(company_name)").eq("id", listOrder.id).single(),
      supabase.from("client_order_lines").select("*, suppliers(name)").eq("order_id", listOrder.id).order("sort_order"),
      supabase.from("client_order_events").select("*").eq("order_id", listOrder.id).order("created_at", { ascending: false }),
    ]);
    if (o.data) setOrder(o.data);
    const ed = (l.data || []).map(lineFromDb);
    setLines(ed); setOriginal(ed); setEvents(e.data || []);
    setLoading(false);
    // opening the order = staff has seen everything the client did so far
    supabase.from("client_orders").update({ staff_seen_at: new Date().toISOString() }).eq("id", listOrder.id).then(() => onChanged());
  };
  useEffect(() => { load(); }, [listOrder.id]);

  const diff = useMemo(() => diffLines(original, lines), [original, lines]);
  const dirty = hasChanges(diff);
  const problems = lines.filter(l => { const p = lineProblems(l); return p.id || p.qty; }).length;
  const totalQty = lines.reduce((n, l) => n + (Number(l.qty) || 0), 0);
  const lastClient = events.find(e => e.actor_type === "client");

  const logEvent = async (kind, extra = {}) => {
    await supabase.from("client_order_events").insert({
      order_id: order.id, actor_type: "staff", actor_name: await actor(), kind, note: note.trim() || null, ...extra,
    });
  };
  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); setNote(""); await load(); }
    catch (e) { setError(e.message || "Something went wrong"); sileo.error({ title: e.message || "Error" }); }
    finally { setBusy(false); }
  };

  // optimistic lock: only bump when nobody else (e.g. the client) saved in between
  const bumpRevision = async () => {
    const { data, error: e } = await supabase.from("client_orders")
      .update({ revision: order.revision + 1, updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("revision", order.revision).select("id");
    if (e) throw e;
    if (!data?.length) throw new Error("The client changed this order while you were editing. Reload to see their changes, then redo yours.");
  };

  const save = () => run(async () => {
    await bumpRevision();
    const keepIds = new Set(lines.filter(l => l.id).map(l => l.id));
    const removed = original.filter(l => !keepIds.has(l.id)).map(l => l.id);
    if (removed.length) await supabase.from("client_order_lines").delete().in("id", removed);
    for (let i = 0; i < lines.length; i++) {
      const l = { ...lines[i] };
      const prev = original.find(o => o.id === l.id);
      if (!l.supplier_id || !prev || prev.supplier !== l.supplier) l.supplier_id = matchSupplier(suppliers, l.supplier)?.id || null;
      const row = lineToDb(l, order.id, i);
      const { error: e } = l.id
        ? await supabase.from("client_order_lines").update(row).eq("id", l.id)
        : await supabase.from("client_order_lines").insert(row);
      if (e) throw e;
    }
    await logEvent("lines_edited", { changes: diff });
    sileo.success({ title: "Saved — the client will see it" });
  });

  const comment = () => run(async () => {
    await logEvent("comment");
    await supabase.from("client_orders").update({ updated_at: new Date().toISOString() }).eq("id", order.id);
  });

  const uploadPhoto = async (blob) => {
    const path = `${order.id}/${crypto.randomUUID()}.jpg`;
    const { error: e } = await supabase.storage.from("client-orders").upload(path, blob, { contentType: "image/jpeg" });
    if (e) throw e;
    return supabase.storage.from("client-orders").getPublicUrl(path).data.publicUrl;
  };

  const deleteOrder = async () => {
    const extra = order.track_id || order.quotation_id ? "\n\nEl proyecto y la cotización ligados NO se borran." : "";
    if (!window.confirm(`Delete order "${order.reference || order.source_file_name}"? Its ${lines.length} lines and history are removed. This cannot be undone.${extra}`)) return;
    setBusy(true); setError("");
    // the hidden copy of the client's file kept in client documents goes too
    if (order.source_file_url) await supabase.from("client_documents").delete().eq("client_id", order.client_id).eq("document_type", "client_order").eq("file_url", order.source_file_url);
    const { error: e } = await supabase.from("client_orders").delete().eq("id", order.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
    sileo.success({ title: "Order deleted" });
    onChanged(); onBack();
  };

  const doConvert = (supplierMap) => run(async () => {
    const t = await createProjectAndQuotation(supabase, {
      order, lines, projectName: convert.name, workflow: convert.workflow, showToClient: convert.publish, actorName: await actor(), supplierMap,
    });
    setConvert(null); setSupplierNames(null);
    sileo.success({ title: "Project and quotation created", description: t.quotation.quote_number });
  });

  // Service projects don't use suppliers; a Product project only needs the review modal when
  // at least one line actually names a supplier the client typed by hand.
  const startConvert = () => {
    if (convert.workflow === "Service") { doConvert(null); return; }
    const names = [...new Set(lines.map(l => (l.supplier || "").trim()).filter(Boolean))];
    if (names.length === 0) { doConvert({}); return; }
    setSupplierNames(names);
  };

  // Disconnects the order from its project/quotation without deleting either — lets staff redo
  // the conversion (e.g. with the supplier-mapping modal) instead of fixing 200 lines by hand.
  const unlinkProject = () => run(async () => {
    if (!window.confirm("Unlink this order from its project and quotation?\n\nThe project and quotation are NOT deleted — they just stop being connected to this order, so you can create a new one from scratch.")) return;
    const { error: e } = await supabase.from("client_orders").update({ track_id: null, quotation_id: null, updated_at: new Date().toISOString() }).eq("id", order.id);
    if (e) throw e;
    await logEvent("project_unlinked", { note: quotationEvent?.note ? `Was linked to ${quotationEvent.note}` : null });
  });

  const doSend = () => run(async () => {
    await sendQuotationToClient(supabase, { order, note, actorName: await actor() });
    sileo.success({ title: "Quotation sent to the client" });
  });

  const openProject = () => navigate("/projects", { state: { activeTrackId: order.track_id } });

  // order edited after the quotation was built -> the quotation may be stale
  const quotationEvent = events.find(e => e.kind === "quotation_created");
  const staleQuotation = quotationEvent && events.some(e => e.kind === "lines_edited" && e.created_at > quotationEvent.created_at);

  const changeStatus = (next) => run(async () => {
    const from = order.status;
    const { error: e } = await supabase.from("client_orders").update({ status: next, updated_at: new Date().toISOString() }).eq("id", order.id);
    if (e) throw e;
    await logEvent("status_changed", { changes: { from, to: next } });
  });

  if (loading) return <p className="text-sm text-bgray-500">Loading…</p>;

  return (
    <div>
      <button onClick={onBack} className="text-sm text-bgray-500 hover:text-primary mb-3">← All orders</button>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-darkblack-700 dark:text-white">{order.reference || order.source_file_name}</h2>
          <p className="text-sm text-bgray-500">{order.clients?.company_name} · {lines.length} lines · {totalQty.toLocaleString()} units</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderHistoryButton events={events} viewer="staff" />
          <select value={order.status} onChange={e => changeStatus(e.target.value)} disabled={busy} className={`${inputCls} py-1.5 text-sm`}>
            {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {order.source_file_url && <a href={order.source_file_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 border border-bgray-300 rounded-lg text-sm text-bgray-600 hover:border-primary">Original file</a>}
          <button onClick={() => setFieldUpdateMode("price")} className="px-3 py-1.5 border border-bgray-300 rounded-lg text-sm text-bgray-600 hover:border-primary">Update prices…</button>
          <button onClick={() => setFieldUpdateMode("qty")} className="px-3 py-1.5 border border-bgray-300 rounded-lg text-sm text-bgray-600 hover:border-primary">Update quantities…</button>
          <button onClick={deleteOrder} disabled={busy} className="px-3 py-1.5 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Delete order</button>
        </div>
      </div>

      {order.source === "portal" && lastClient && lastClient.kind !== "submitted" && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-900">
          <p className="font-semibold">Last client action: {lastClient.kind.replace("_", " ")} · {new Date(lastClient.created_at).toLocaleString()}</p>
          {lastClient.note && <p className="mt-0.5 whitespace-pre-wrap">{lastClient.note}</p>}
        </div>
      )}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex justify-between gap-3"><span>{error}</span><button onClick={load} className="underline text-xs">Reload</button></div>}

      <div className="mb-4 bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4">
        {!order.track_id ? (
          convert ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs text-bgray-500 mb-1">Project name</label>
                <input value={convert.name} onChange={e => setConvert({ ...convert, name: e.target.value })} className={`${inputCls} w-full py-1.5 text-sm`} />
              </div>
              <div>
                <label className="block text-xs text-bgray-500 mb-1">Workflow</label>
                <select value={convert.workflow} onChange={e => setConvert({ ...convert, workflow: e.target.value })} className={`${inputCls} py-1.5 text-sm`}>
                  <option value="Product">Product</option><option value="Service">Service</option>
                </select>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-bgray-600 pb-2"><input type="checkbox" checked={convert.publish} onChange={e => setConvert({ ...convert, publish: e.target.checked })} />Show project to client</label>
              <button onClick={startConvert} disabled={busy || dirty || !convert.name.trim()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">{busy ? "Creating…" : "Create"}</button>
              <button onClick={() => setConvert(null)} className="text-xs text-bgray-500 pb-2">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-bgray-600">Turn this order into a project with a quotation pre-filled from its lines.</p>
              <button onClick={() => setConvert({ name: order.reference || order.source_file_name || "", workflow: "Product", publish: false })} disabled={dirty}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50" title={dirty ? "Save your edits first" : ""}>Create project &amp; quotation</button>
            </div>
          )
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-darkblack-700 dark:text-white">Project and quotation created {quotationEvent?.note ? <span className="font-mono text-bgray-500">· {quotationEvent.note}</span> : null}</p>
            <div className="flex gap-2">
              <button onClick={openProject} className="px-3 py-1.5 border border-bgray-300 rounded-lg text-sm text-bgray-600 hover:border-primary">Open project</button>
              {order.status !== "confirmed" && (
                <button onClick={doSend} disabled={busy || dirty} className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  title="Publishes the quotation to the client portal and notifies them (uses the comment box below)">
                  {order.status === "quoted" ? "Re-send quotation" : "Send quotation to client"}
                </button>
              )}
              <button onClick={unlinkProject} disabled={busy} className="px-3 py-1.5 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Disconnects this order from that project/quotation so you can create a new one — the project and quotation themselves are not deleted">
                Unlink project
              </button>
            </div>
          </div>
        )}
        {staleQuotation && <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">The order changed after the quotation was created — review the quotation in the project and update it before sending.</p>}
      </div>

      <div>
        <div className="bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4">
          <OrderLinesTable lines={lines} onChange={setLines} uploadPhoto={uploadPhoto}
            exportMeta={{ title: order.reference || order.source_file_name || "Pedido", client: order.clients?.company_name }} />
          <div className="mt-4 border-t border-bgray-100 pt-4">
            {dirty && (
              <ul className="mb-3 list-disc pl-4 text-xs text-bgray-500 space-y-0.5">
                {describeChanges(diff).slice(0, 6).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder={dirty ? "Comment for the client (optional): why did you change this?" : "Write a comment for the client"}
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm mb-3 bg-white dark:bg-darkblack-600" />
            <div className="flex gap-2 items-center flex-wrap">
              <button onClick={save} disabled={busy || !dirty || problems > 0} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {busy ? "Saving…" : "Save & notify client"}
              </button>
              <button onClick={comment} disabled={busy || !note.trim() || dirty} className="px-4 py-2 border border-bgray-300 rounded-lg text-sm font-semibold text-bgray-600 disabled:opacity-50">Comment only</button>
              {dirty && <button onClick={() => setLines(original)} className="text-xs text-bgray-500">Discard changes</button>}
              {problems > 0 && <span className="text-xs text-red-600">{problems} row(s) without name/ref or quantity</span>}
            </div>
          </div>
        </div>

      </div>

      {supplierNames && (
        <SupplierMatchModal
          names={supplierNames}
          suppliers={suppliers}
          onCancel={() => setSupplierNames(null)}
          onConfirm={map => doConvert(map)}
        />
      )}

      {fieldUpdateMode && (
        <UpdateFieldModal
          field={fieldUpdateMode}
          lines={lines}
          onApply={valueById => applyFieldUpdates(fieldUpdateMode, valueById)}
          onClose={() => setFieldUpdateMode(null)}
        />
      )}
    </div>
  );
}

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState(null);
  const [unread, setUnread] = useState(new Set());

  const load = async () => {
    setLoading(true);
    const [o, c, s, u] = await Promise.all([
      supabase.from("client_orders").select("*, clients(company_name), client_order_lines(count)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("v_client_orders_unread").select("order_id"),
    ]);
    setUnread(new Set((u.data || []).map(r => r.order_id)));
    if (o.error) setError(o.error.message);
    setOrders(o.data || []);
    setClients(c.data || []);
    setSuppliers(s.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (selected) {
    return <div className="p-6 max-w-6xl mx-auto"><OrderDetail order={selected} suppliers={suppliers} onBack={() => setSelected(null)} onChanged={load} /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Client Orders</h1>
          <p className="text-sm text-bgray-500 mt-0.5">Purchase orders your clients send — import their Excel, then compare what they asked for with what we quote and buy.</p>
        </div>
        <button onClick={() => setShowImport(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition">Import Excel</button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{error}</div>}

      {loading ? (
        <p className="text-sm text-bgray-500">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-bgray-400 text-sm">No client orders yet. Import the first one.</div>
      ) : (
        <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bgray-50 dark:bg-darkblack-500 text-xs uppercase text-bgray-500">
                <th className="px-5 py-3 text-left">Order</th><th className="px-5 py-3 text-left">Client</th>
                <th className="px-5 py-3 text-right">Lines</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Imported</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} onClick={() => setSelected(o)} className="border-t border-bgray-100 hover:bg-bgray-50 dark:hover:bg-darkblack-500 cursor-pointer">
                  <td className="px-5 py-3 font-semibold text-darkblack-700 dark:text-white">{o.reference || o.source_file_name}{o.source === "portal" && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">FROM CLIENT</span>}{unread.has(o.id) && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">UPDATED BY CLIENT</span>}</td>
                  <td className="px-5 py-3 text-bgray-600">{o.clients?.company_name}</td>
                  <td className="px-5 py-3 text-right">{o.client_order_lines?.[0]?.count ?? 0}</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[o.status]}`}>{o.status}</span></td>
                  <td className="px-5 py-3 text-bgray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <ImportWizard clients={clients} suppliers={suppliers} onClose={() => setShowImport(false)} onSaved={() => { setShowImport(false); load(); }} />
      )}
    </div>
  );
}
