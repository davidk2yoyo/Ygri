import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";
import PackingListPDF from "../components/PackingListPDF";
import PackingListImportModal from "../components/PackingListImportModal";
import { goBack } from "../lib/navigateBack";

const emptyRow = () => ({
  _localId: Math.random().toString(36).slice(2),
  id: null,
  quotation_item_id: null,
  item_number: "",
  description: "",
  color: "",
  carton_qty: "",
  qty: "",
  length_cm: "",
  width_cm: "",
  height_cm: "",
  cbm: "",
  nw: "",
  gw: "",
  supplier_id: null,
  supplier_name: "",
});

const emptySupplierTotal = (supplier_id, supplier_name) => ({
  _localId: Math.random().toString(36).slice(2),
  id: null,
  supplier_id: supplier_id || null,
  supplier_name: supplier_name || "Sin proveedor",
  carton_qty: "",
  cbm: "",
  nw: "",
  gw: "",
});

const num = (v) => (v === "" || v == null ? 0 : parseFloat(v) || 0);
const supplierKey = (supplier_id, supplier_name) => supplier_id || `raw:${supplier_name || "Sin proveedor"}`;

const DOC_LABELS = {
  quotation: { linked: "Linked to quotation", ref: "Quote Ref" },
  proforma: { linked: "Linked to proforma invoice", ref: "Proforma Ref" },
  invoice: { linked: "Linked to commercial invoice", ref: "Invoice Ref" },
};
const docLabels = (documentType) => DOC_LABELS[documentType] || DOC_LABELS.quotation;

export default function PackingListEditorPage() {
  const { quotationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [packingList, setPackingList] = useState(null);
  const [items, setItems] = useState([]);
  const [supplierTotals, setSupplierTotals] = useState([]);
  const [quotation, setQuotation] = useState(null);
  const [quotationItems, setQuotationItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [showPDF, setShowPDF] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const fileRef = useRef(null);
  const containerRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: quot }, { data: qItems }] = await Promise.all([
        supabase.from("quotations").select("id, quote_number, client_name, project_name, document_type").eq("id", quotationId).single(),
        supabase.from("quotation_items").select("id, item_number, description, quantity, supplier_id, suppliers(name)").eq("quotation_id", quotationId).order("sort_order"),
      ]);
      setQuotation(quot);

      // so "Import items from quote" can pre-fill color too, not just name/ref/qty
      let colorByQiId = {};
      const allQiIds = (qItems || []).map(qi => qi.id);
      if (allQiIds.length > 0) {
        const { data: colorOpts } = await supabase.from("quotation_item_options")
          .select("quotation_item_id, label").eq("option_type", "color").in("quotation_item_id", allQiIds);
        (colorOpts || []).forEach(o => { if (!colorByQiId[o.quotation_item_id]) colorByQiId[o.quotation_item_id] = o.label; });
      }
      setQuotationItems((qItems || []).map(qi => ({ ...qi, supplier_name: qi.suppliers?.name || "", color: colorByQiId[qi.id] || "" })));

      const { data: existing } = await supabase.from("packing_lists").select("*").eq("quotation_id", quotationId).single();
      if (existing) {
        setPackingList(existing);
        const [{ data: rows }, { data: totalsRows }] = await Promise.all([
          supabase.from("packing_list_items").select("*, suppliers(name)").eq("packing_list_id", existing.id).order("sort_order"),
          supabase.from("packing_list_supplier_totals").select("*").eq("packing_list_id", existing.id).order("sort_order"),
        ]);

        const qiIds = [...new Set((rows || []).map(r => r.quotation_item_id).filter(Boolean))];
        let optionsByQiId = {};
        if (qiIds.length > 0) {
          const { data: opts } = await supabase.from("quotation_item_options").select("*").in("quotation_item_id", qiIds).order("sort_order");
          (opts || []).forEach(o => {
            if (!optionsByQiId[o.quotation_item_id]) optionsByQiId[o.quotation_item_id] = [];
            optionsByQiId[o.quotation_item_id].push(o);
          });
        }

        setItems((rows || []).map(r => ({
          ...r,
          _localId: Math.random().toString(36).slice(2),
          supplier_name: r.suppliers?.name || r.supplier_name_raw || "",
          options: optionsByQiId[r.quotation_item_id] || [],
        })));
        setSupplierTotals((totalsRows || []).map(r => ({ ...r, _localId: Math.random().toString(36).slice(2) })));
      } else {
        const { data: newPL, error } = await supabase.from("packing_lists").insert({ quotation_id: quotationId }).select().single();
        if (error) { setSaveError(`Could not create packing list: ${error.message}`); }
        else { setPackingList(newPL); setItems([]); setSupplierTotals([]); }
      }
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateRow = (localId, field, value) =>
    setItems(prev => prev.map(r => r._localId === localId ? { ...r, [field]: value } : r));

  const addRow = () => setItems(prev => [...prev, emptyRow()]);
  const removeRow = (localId) => setItems(prev => prev.filter(r => r._localId !== localId));

  const recalcCbm = (localId) => {
    setItems(prev => prev.map(r => {
      if (r._localId !== localId) return r;
      const cbm = (num(r.length_cm) * num(r.width_cm) * num(r.height_cm) * num(r.carton_qty)) / 1000000;
      return { ...r, cbm: cbm > 0 ? cbm.toFixed(4) : r.cbm };
    }));
  };

  const importSelected = (selectedIds) => {
    const idSet = new Set(selectedIds);
    const toAdd = quotationItems
      .filter(qi => idSet.has(qi.id))
      .map(qi => ({
        ...emptyRow(),
        quotation_item_id: qi.id,
        item_number: qi.item_number || "",
        description: qi.description || "",
        color: qi.color || "",
        qty: qi.quantity ? String(qi.quantity) : "",
        supplier_id: qi.supplier_id || null,
        supplier_name: qi.supplier_name || "",
      }));
    setItems(prev => [...prev, ...toAdd]);
    setShowImportModal(false);
  };

  // "By supplier" mode: items stay grouped for display, but cartons/CBM/
  // weights are one combined figure per group, typed directly — not summed
  // from individual items (suppliers usually give one number for the whole
  // consolidated shipment, not box-by-box).
  const itemsBySupplier = items.reduce((acc, it) => {
    const key = supplierKey(it.supplier_id, it.supplier_name);
    if (!acc[key]) acc[key] = { supplier_id: it.supplier_id || null, supplier_name: it.supplier_name || "Sin proveedor", items: [] };
    acc[key].items.push(it);
    return acc;
  }, {});

  useEffect(() => {
    if (packingList?.mode !== "by_supplier") return;
    const existingKeys = new Set(supplierTotals.map(t => supplierKey(t.supplier_id, t.supplier_name)));
    const missing = Object.values(itemsBySupplier).filter(g => !existingKeys.has(supplierKey(g.supplier_id, g.supplier_name)));
    if (missing.length) setSupplierTotals(prev => [...prev, ...missing.map(g => emptySupplierTotal(g.supplier_id, g.supplier_name))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packingList?.mode, items]);

  const updateSupplierTotal = (localId, field, value) =>
    setSupplierTotals(prev => prev.map(t => t._localId === localId ? { ...t, [field]: value } : t));

  const runScan = async (file) => {
    if (!file?.type.startsWith("image/")) return;
    setScanning(true);
    setScanError("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise((res, rej) => {
        reader.onload = ev => res(ev.target.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const apiRes = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "packing_list", image: base64, mimeType: file.type }),
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data.error || `Error ${apiRes.status}`);
      const scannedRows = (data.items || []).map(it => ({
        ...emptyRow(),
        item_number: it.item_number || "",
        description: it.description || "",
        carton_qty: it.carton_qty || "",
        qty: it.qty || "",
        length_cm: it.length_cm || "",
        width_cm: it.width_cm || "",
        height_cm: it.height_cm || "",
        cbm: it.cbm || "",
        nw: it.nw || "",
        gw: it.gw || "",
      }));
      setItems(prev => [...prev, ...scannedRows]);
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    if (file) await runScan(file);
    e.target.value = "";
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handlePaste = (e) => {
      const clipItems = Array.from(e.clipboardData?.items || []);
      const imgItem = clipItems.find(it => it.type.startsWith("image/"));
      if (!imgItem) return;
      e.preventDefault();
      runScan(imgItem.getAsFile());
    };
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = items.reduce((acc, r) => {
    acc.carton_qty += num(r.carton_qty);
    acc.qty += num(r.qty);
    acc.cbm += num(r.cbm);
    acc.nw += num(r.nw);
    acc.gw += num(r.gw);
    return acc;
  }, { carton_qty: 0, qty: 0, cbm: 0, nw: 0, gw: 0 });

  const supplierGrandTotals = supplierTotals.reduce((acc, t) => {
    acc.carton_qty += num(t.carton_qty);
    acc.cbm += num(t.cbm);
    acc.nw += num(t.nw);
    acc.gw += num(t.gw);
    return acc;
  }, { carton_qty: 0, cbm: 0, nw: 0, gw: 0 });

  const handleSave = async () => {
    if (!packingList) return;
    setSaving(true);
    setSaveError("");
    try {
      const { error: titleErr } = await supabase.from("packing_lists")
        .update({ title: packingList.title, notes: packingList.notes, mode: packingList.mode || "detailed", show_to_client: !!packingList.show_to_client })
        .eq("id", packingList.id);
      if (titleErr) throw new Error(titleErr.message);

      // Insert-then-delete: old rows are only removed after the new ones
      // are safely in the DB, so a failed save can never lose the packing list
      const { data: oldRows, error: oldErr } = await supabase
        .from("packing_list_items").select("id").eq("packing_list_id", packingList.id);
      if (oldErr) throw new Error(oldErr.message);

      const validRows = items.filter(r =>
        r.item_number?.trim() || r.description?.trim() || num(r.qty) > 0 || num(r.carton_qty) > 0
      );

      if (validRows.length > 0) {
        const { error: insErr } = await supabase.from("packing_list_items").insert(
          validRows.map((r, i) => ({
            packing_list_id: packingList.id,
            quotation_item_id: r.quotation_item_id || null,
            item_number: r.item_number || null,
            description: r.description || null,
            color: r.color || null,
            carton_qty: r.carton_qty !== "" ? parseInt(r.carton_qty) || null : null,
            qty: r.qty !== "" ? parseInt(r.qty) || null : null,
            length_cm: r.length_cm !== "" ? parseFloat(r.length_cm) || null : null,
            width_cm: r.width_cm !== "" ? parseFloat(r.width_cm) || null : null,
            height_cm: r.height_cm !== "" ? parseFloat(r.height_cm) || null : null,
            cbm: r.cbm !== "" ? parseFloat(r.cbm) || null : null,
            nw: r.nw !== "" ? parseFloat(r.nw) || null : null,
            gw: r.gw !== "" ? parseFloat(r.gw) || null : null,
            supplier_id: r.supplier_id || null,
            supplier_name_raw: r.supplier_id ? null : (r.supplier_name || null),
            sort_order: i,
          }))
        );
        if (insErr) throw new Error(insErr.message);
      }

      if (oldRows?.length) {
        const { error: delErr } = await supabase.from("packing_list_items").delete().in("id", oldRows.map(r => r.id));
        if (delErr) throw new Error(delErr.message);
      }

      // Delete-then-insert here (the reverse of the items block above) — this table
      // has a uniqueness constraint per (packing_list_id, supplier), so inserting a
      // new row for a supplier while its old row still exists always violates it.
      // Items have no such constraint, so insert-first stays safer there.
      const { error: delTotalsErr } = await supabase
        .from("packing_list_supplier_totals").delete().eq("packing_list_id", packingList.id);
      if (delTotalsErr) throw new Error(delTotalsErr.message);

      const validTotals = supplierTotals.filter(t =>
        num(t.carton_qty) > 0 || num(t.cbm) > 0 || num(t.nw) > 0 || num(t.gw) > 0
      );
      if (validTotals.length > 0) {
        const { error: insTotalsErr } = await supabase.from("packing_list_supplier_totals").insert(
          validTotals.map((t, i) => ({
            packing_list_id: packingList.id,
            supplier_id: t.supplier_id || null,
            supplier_name: t.supplier_name || null,
            carton_qty: t.carton_qty !== "" ? parseInt(t.carton_qty) || null : null,
            cbm: t.cbm !== "" ? parseFloat(t.cbm) || null : null,
            nw: t.nw !== "" ? parseFloat(t.nw) || null : null,
            gw: t.gw !== "" ? parseFloat(t.gw) || null : null,
            sort_order: i,
          }))
        );
        if (insTotalsErr) throw new Error(insTotalsErr.message);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    const bySupplier = packingList?.mode === "by_supplier";
    const rows = bySupplier
      ? Object.values(itemsBySupplier).flatMap(g => {
          const t = supplierTotals.find(st => supplierKey(st.supplier_id, st.supplier_name) === supplierKey(g.supplier_id, g.supplier_name));
          return g.items.map((it, i) => ({
            "Supplier": i === 0 ? g.supplier_name : "",
            "Item #": it.item_number || "", "Description": it.description || "", "Color": it.color || "", "Qty": it.qty || "",
            "Cartons": i === 0 ? (t?.carton_qty || "") : "",
            "CBM": i === 0 && t?.cbm ? Number(t.cbm) : "",
            "N.W. (kg)": i === 0 && t?.nw ? Number(t.nw) : "",
            "G.W. (kg)": i === 0 && t?.gw ? Number(t.gw) : "",
          }));
        })
      : items.map(r => ({
          "Item #": r.item_number || "",
          "Description": r.description || "",
          "Color": r.color || "",
          "Cartons": r.carton_qty || "",
          "Qty": r.qty || "",
          "L (cm)": r.length_cm || "",
          "W (cm)": r.width_cm || "",
          "H (cm)": r.height_cm || "",
          "CBM": r.cbm || "",
          "N.W. (kg)": r.nw || "",
          "G.W. (kg)": r.gw || "",
        }));
    rows.push(bySupplier ? {
      "Supplier": "TOTAL", "Item #": "", "Description": "", "Qty": "",
      "Cartons": supplierGrandTotals.carton_qty || "",
      "CBM": supplierGrandTotals.cbm ? Number(supplierGrandTotals.cbm.toFixed(4)) : "",
      "N.W. (kg)": supplierGrandTotals.nw ? Number(supplierGrandTotals.nw.toFixed(2)) : "",
      "G.W. (kg)": supplierGrandTotals.gw ? Number(supplierGrandTotals.gw.toFixed(2)) : "",
    } : {
      "Item #": "", "Description": "TOTAL",
      "Cartons": totals.carton_qty || "", "Qty": totals.qty || "",
      "L (cm)": "", "W (cm)": "", "H (cm)": "",
      "CBM": totals.cbm ? Number(totals.cbm.toFixed(4)) : "",
      "N.W. (kg)": totals.nw ? Number(totals.nw.toFixed(2)) : "",
      "G.W. (kg)": totals.gw ? Number(totals.gw.toFixed(2)) : "",
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Packing List");
    XLSX.writeFile(wb, `PackingList_${packingList?.pl_number || "draft"}_${quotation?.quote_number || ""}.xlsx`);
  };

  const inputCls = "w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 focus:ring-1 focus:ring-blue-400";

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading packing list…</p>
      </div>
    </div>
  );

  if (showPDF) {
    return (
      <PackingListPDF
        packingList={packingList}
        items={items}
        itemsBySupplier={itemsBySupplier}
        supplierTotals={supplierTotals}
        clientName={quotation?.client_name}
        projectName={quotation?.project_name}
        quoteNumber={quotation?.quote_number}
        quoteRefLabel={docLabels(quotation?.document_type).ref}
        notes={packingList?.notes}
        onClose={() => setShowPDF(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack(navigate, location)} className="text-gray-400 hover:text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <p className="text-xs text-gray-400">{quotation?.quote_number} · Packing List</p>
              <input
                value={packingList?.title || ""}
                onChange={e => setPackingList(pl => ({ ...pl, title: e.target.value }))}
                className="text-sm font-bold text-gray-800 border-0 outline-none bg-transparent w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-green-500 hover:text-green-600 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Excel
            </button>
            <button onClick={() => setShowPDF(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Saving…</>
                : saved
                  ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Saved</>
                  : "Save"
              }
            </button>
          </div>
        </div>
        {saveError && (
          <div className="max-w-6xl mx-auto px-6 pb-3">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-4" ref={containerRef}>
        {/* Quotation reference card */}
        {quotation && (
          <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{docLabels(quotation.document_type).linked}</p>
              <p className="font-bold text-gray-800 mt-0.5">{quotation.quote_number}</p>
              {(quotation.client_name || quotation.project_name) && (
                <p className="text-sm text-gray-500">{[quotation.client_name, quotation.project_name].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center bg-gray-100 rounded-lg p-1 text-xs font-medium">
                <button onClick={() => setPackingList(pl => ({ ...pl, mode: "detailed" }))}
                  className={`px-3 py-1.5 rounded-md transition ${(packingList?.mode || "detailed") === "detailed" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
                  Detailed
                </button>
                <button onClick={() => setPackingList(pl => ({ ...pl, mode: "by_supplier" }))}
                  className={`px-3 py-1.5 rounded-md transition ${packingList?.mode === "by_supplier" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
                  By supplier
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer">
                <input type="checkbox" checked={!!packingList?.show_to_client} onChange={e => setPackingList(pl => ({ ...pl, show_to_client: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Visible to client
              </label>
              {packingList && (
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Packing List</p>
                  <p className="font-bold text-blue-600 mt-0.5">{packingList.pl_number}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition">
            + Add row
          </button>
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition">
            Import items from quote
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScanFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 transition"
            title="Scan a packing list photo to auto-fill rows — or Ctrl+V to paste"
          >
            {scanning ? (
              <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {scanning ? "Scanning…" : "AI Scan"}
          </button>
          <span className="text-xs text-gray-400">Ctrl+V to paste a screenshot anywhere below</span>
        </div>
        {scanError && <p className="text-xs text-red-500">{scanError}</p>}

        {/* Items table */}
        {(packingList?.mode || "detailed") === "detailed" ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                <th className="p-2 text-left w-[110px]">Item #</th>
                <th className="p-2 text-left min-w-[180px]">Description</th>
                <th className="p-2 text-left w-[100px]">Color</th>
                <th className="p-2 text-center w-[80px]">Cartons</th>
                <th className="p-2 text-center w-[80px]">Qty</th>
                <th className="p-2 text-center w-[70px]">L (cm)</th>
                <th className="p-2 text-center w-[70px]">W (cm)</th>
                <th className="p-2 text-center w-[70px]">H (cm)</th>
                <th className="p-2 text-center w-[100px]">CBM</th>
                <th className="p-2 text-center w-[90px]">N.W. (kg)</th>
                <th className="p-2 text-center w-[90px]">G.W. (kg)</th>
                <th className="p-2 w-[36px]" />
              </tr>
            </thead>
            <tbody>
              {items.map(row => (
                <tr key={row._localId} className="border-t border-gray-100">
                  <td className="p-1.5">
                    <input value={row.item_number} onChange={e => updateRow(row._localId, "item_number", e.target.value)} className={inputCls} placeholder="SKU" />
                  </td>
                  <td className="p-1.5">
                    <input value={row.description} onChange={e => updateRow(row._localId, "description", e.target.value)} className={inputCls} placeholder="Description" />
                  </td>
                  <td className="p-1.5">
                    <input value={row.color} onChange={e => updateRow(row._localId, "color", e.target.value)} className={inputCls} placeholder="Color" />
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" value={row.carton_qty} onChange={e => updateRow(row._localId, "carton_qty", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" value={row.qty} onChange={e => updateRow(row._localId, "qty", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" step="0.1" value={row.length_cm} onChange={e => updateRow(row._localId, "length_cm", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" step="0.1" value={row.width_cm} onChange={e => updateRow(row._localId, "width_cm", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" step="0.1" value={row.height_cm} onChange={e => updateRow(row._localId, "height_cm", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
                  </td>
                  <td className="p-1.5">
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" step="0.0001" value={row.cbm} onChange={e => updateRow(row._localId, "cbm", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
                      <button type="button" onClick={() => recalcCbm(row._localId)} title="Recalculate from L×W×H×cartons" className="text-gray-400 hover:text-blue-500 shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </button>
                    </div>
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" step="0.01" value={row.nw} onChange={e => updateRow(row._localId, "nw", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" step="0.01" value={row.gw} onChange={e => updateRow(row._localId, "gw", e.target.value)} onWheel={e => e.target.blur()} className={`${inputCls} text-center`} />
                  </td>
                  <td className="p-1.5">
                    <button onClick={() => removeRow(row._localId)} className="text-gray-300 hover:text-red-500 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-gray-400 text-sm">
                    No items yet — add a row, import from the quote, or AI-scan a packing list photo.
                  </td>
                </tr>
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-700 text-xs">
                  <td className="p-2" colSpan={3}>TOTAL</td>
                  <td className="p-2 text-center">{totals.carton_qty || ""}</td>
                  <td className="p-2 text-center">{totals.qty || ""}</td>
                  <td colSpan={3} />
                  <td className="p-2 text-center">{totals.cbm ? totals.cbm.toFixed(4) : ""}</td>
                  <td className="p-2 text-center">{totals.nw ? totals.nw.toFixed(2) : ""}</td>
                  <td className="p-2 text-center">{totals.gw ? totals.gw.toFixed(2) : ""}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {Object.values(itemsBySupplier).length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">No items yet — import from the quote to group them by supplier.</p>
            ) : (
              <>
                {Object.values(itemsBySupplier).map(group => {
                  const key = supplierKey(group.supplier_id, group.supplier_name);
                  const t = supplierTotals.find(st => supplierKey(st.supplier_id, st.supplier_name) === key);
                  return (
                    <div key={key} className="border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center justify-between gap-4 px-5 py-3 bg-gray-50 flex-wrap">
                        <p className="text-sm font-bold text-gray-800">{group.supplier_name}</p>
                        {t && (
                          <div className="flex items-center gap-4 text-xs">
                            <label className="flex items-center gap-1.5 text-gray-500">Cartons
                              <input type="number" min="0" value={t.carton_qty} onChange={e => updateSupplierTotal(t._localId, "carton_qty", e.target.value)} onWheel={e => e.target.blur()}
                                className="w-16 px-2 py-1 border border-gray-200 rounded text-center" />
                            </label>
                            <label className="flex items-center gap-1.5 text-gray-500">CBM
                              <input type="number" min="0" step="0.0001" value={t.cbm} onChange={e => updateSupplierTotal(t._localId, "cbm", e.target.value)} onWheel={e => e.target.blur()}
                                className="w-20 px-2 py-1 border border-gray-200 rounded text-center" />
                            </label>
                            <label className="flex items-center gap-1.5 text-gray-500">N.W. (kg)
                              <input type="number" min="0" step="0.01" value={t.nw} onChange={e => updateSupplierTotal(t._localId, "nw", e.target.value)} onWheel={e => e.target.blur()}
                                className="w-20 px-2 py-1 border border-gray-200 rounded text-center" />
                            </label>
                            <label className="flex items-center gap-1.5 text-gray-500">G.W. (kg)
                              <input type="number" min="0" step="0.01" value={t.gw} onChange={e => updateSupplierTotal(t._localId, "gw", e.target.value)} onWheel={e => e.target.blur()}
                                className="w-20 px-2 py-1 border border-gray-200 rounded text-center" />
                            </label>
                          </div>
                        )}
                      </div>
                      <ul className="divide-y divide-gray-50">
                        {group.items.map(it => (
                          <li key={it._localId} className="px-5 py-2 text-sm text-gray-700 flex items-center gap-3">
                            {it.item_number && <span className="font-mono text-xs text-gray-400">{it.item_number}</span>}
                            <span className="flex-1 truncate">{it.description || "—"}{it.color && <span className="text-gray-400"> · {it.color}</span>}</span>
                            {it.qty && <span className="text-xs text-gray-400">qty {it.qty}</span>}
                            <button onClick={() => removeRow(it._localId)} className="text-gray-300 hover:text-red-500 transition">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                <div className="flex items-center justify-end gap-4 px-5 py-3 bg-gray-50 border-t-2 border-gray-300 text-xs font-bold text-gray-700">
                  <span>TOTAL</span>
                  <span>{supplierGrandTotals.carton_qty || 0} cartons</span>
                  <span>{supplierGrandTotals.cbm.toFixed(4)} CBM</span>
                  <span>{supplierGrandTotals.nw.toFixed(2)} kg NW</span>
                  <span>{supplierGrandTotals.gw.toFixed(2)} kg GW</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</label>
          <textarea
            value={packingList?.notes || ""}
            onChange={e => setPackingList(pl => ({ ...pl, notes: e.target.value }))}
            rows={3}
            placeholder="Shipping marks, container info, additional remarks..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {showImportModal && (
        <PackingListImportModal
          quotationItems={quotationItems}
          alreadyImportedIds={new Set(items.map(r => r.quotation_item_id).filter(Boolean))}
          onConfirm={importSelected}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}
