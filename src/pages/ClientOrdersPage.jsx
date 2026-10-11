import React, { useEffect, useMemo, useRef, useState } from "react";
import { sileo } from "sileo";
import { supabase } from "../supabaseClient";
import { parseClientOrderWorkbook } from "../lib/clientOrderParser";

const STATUS_STYLE = {
  submitted: "bg-purple-100 text-purple-700",
  draft: "bg-gray-100 text-gray-600",
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

function OrderDetail({ order, onBack, onChanged }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(order.status);

  useEffect(() => {
    supabase.from("client_order_lines").select("*, suppliers(name)").eq("order_id", order.id).order("sort_order")
      .then(({ data }) => { setLines(data || []); setLoading(false); });
  }, [order.id]);

  const bySheet = useMemo(() => {
    const g = {};
    lines.forEach(l => { (g[l.sheet_name || "—"] ||= []).push(l); });
    return g;
  }, [lines]);

  const changeStatus = async (next) => {
    setStatus(next);
    await supabase.from("client_orders").update({ status: next, updated_at: new Date().toISOString() }).eq("id", order.id);
    onChanged();
  };

  const totalQty = lines.reduce((n, l) => n + (Number(l.qty) || 0), 0);

  return (
    <div>
      <button onClick={onBack} className="text-sm text-bgray-500 hover:text-primary mb-3">← All orders</button>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-darkblack-700 dark:text-white">{order.reference || order.source_file_name}</h2>
          <p className="text-sm text-bgray-500">{order.clients?.company_name} · {lines.length} lines · {totalQty.toLocaleString()} units</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={status} onChange={e => changeStatus(e.target.value)} className={`${inputCls} py-1.5 text-sm`}>
            {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {order.source_file_url && <a href={order.source_file_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 border border-bgray-300 rounded-lg text-sm text-bgray-600 hover:border-primary">Original file</a>}
        </div>
      </div>

      {loading ? <p className="text-sm text-bgray-500">Loading…</p> : Object.entries(bySheet).map(([sheet, ls]) => (
        <div key={sheet} className="mb-5 bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-bgray-50 dark:bg-darkblack-500 text-sm font-semibold text-darkblack-700 dark:text-white">
            {ls[0].suppliers?.name || sheet} <span className="text-xs font-normal text-bgray-500">· {ls.length} lines</span>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {ls.map(l => (
                <tr key={l.id} className="border-t border-bgray-100">
                  <td className="px-3 py-2 w-12">{l.photo_url ? <img src={l.photo_url} alt="" className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 rounded bg-bgray-100" />}</td>
                  <td className="px-2 py-2 font-mono text-bgray-500">{l.supplier_ref}</td>
                  <td className="px-2 py-2 text-darkblack-700 dark:text-white">{l.name}{l.color ? ` · ${l.color}` : ""}</td>
                  <td className="px-2 py-2 text-right font-semibold">{Number(l.qty || 0).toLocaleString()}</td>
                  <td className="px-2 py-2 font-mono text-bgray-500">{l.client_ref}</td>
                  <td className="px-2 py-2">{l.brand}</td>
                  <td className="px-2 py-2">{l.marking === true && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">Mark</span>}</td>
                  <td className="px-2 py-2">{l.packaging}</td>
                  <td className="px-2 py-2 text-bgray-500">{l.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
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

  const load = async () => {
    setLoading(true);
    const [o, c, s] = await Promise.all([
      supabase.from("client_orders").select("*, clients(company_name), client_order_lines(count)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("suppliers").select("id, name").order("name"),
    ]);
    if (o.error) setError(o.error.message);
    setOrders(o.data || []);
    setClients(c.data || []);
    setSuppliers(s.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (selected) {
    return <div className="p-6 max-w-6xl mx-auto"><OrderDetail order={selected} onBack={() => setSelected(null)} onChanged={load} /></div>;
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
                  <td className="px-5 py-3 font-semibold text-darkblack-700 dark:text-white">{o.reference || o.source_file_name}{o.source === "portal" && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">FROM CLIENT</span>}</td>
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
