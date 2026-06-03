import React, { useCallback, useEffect, useRef, useState } from "react";

const PROMPT = `You are extracting structured data from a supplier quotation document image.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "supplier": {
    "name": "exact company name",
    "contact_person": "person name or null",
    "phone": "phone number or null",
    "email": "email address or null",
    "address": "full address condensed to one line or null"
  },
  "currency": "ISO currency code — use CNY for RMB/yuan/人民币, USD for $, EUR for €",
  "items": [
    {
      "item_number": "product code / SKU / model number or null",
      "description": "complete product description — merge multi-line text into one string, include all specs, variants, notes",
      "quantity": 1,
      "unit_price": 0.00
    }
  ],
  "total": 0.00
}

Rules:
- Only include real product/service line items — skip header rows, empty rows, and totals rows
- quantity and unit_price must be numbers (not strings)
- If a cell spans multiple lines, merge into a single description string`;

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function AIQuotationImporter({ currency, onImport, onClose }) {
  const [step, setStep] = useState("pick"); // pick | loading | review | error
  const [dragOver, setDragOver] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [supplierInfo, setSupplierInfo] = useState(null);
  const [detectedCurrency, setDetectedCurrency] = useState(currency);
  const [errorMsg, setErrorMsg] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const fileRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImagePreview(URL.createObjectURL(file));
    setStep("loading");
    try {
      const base64 = await toBase64(file);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}`, detail: "high" } },
              { type: "text", text: PROMPT },
            ],
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${res.status}`);
      }
      const data = await res.json();
      const text = data.choices[0].message.content;
      const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const extracted = JSON.parse(jsonStr);
      setSupplierInfo(extracted.supplier || null);
      setDetectedCurrency(extracted.currency || currency);
      setEditItems(
        (extracted.items || []).map((item, i) => ({
          id: i,
          checked: true,
          item_number: item.item_number || "",
          description: item.description || "",
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
        }))
      );
      setStep("review");
    } catch (e) {
      setErrorMsg(e.message);
      setStep("error");
    }
  }, [currency]);

  // Global paste listener (Ctrl+V) — active only on pick step
  useEffect(() => {
    if (step !== "pick") return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) processFile(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [step, processFile]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const updateItem = (id, field, val) =>
    setEditItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));

  const toggleItem = (id) =>
    setEditItems(prev => prev.map(it => it.id === id ? { ...it, checked: !it.checked } : it));

  const allChecked = editItems.length > 0 && editItems.every(it => it.checked);
  const toggleAll = () => setEditItems(prev => prev.map(it => ({ ...it, checked: !allChecked })));
  const checkedCount = editItems.filter(it => it.checked).length;
  const isFx = detectedCurrency && detectedCurrency !== currency;

  const handleImport = () => {
    const items = editItems
      .filter(it => it.checked)
      .map(it => ({
        tempId: Math.random().toString(36).slice(2),
        catalog_item_id: null,
        item_number: it.item_number,
        description: it.description,
        picture_url: "",
        price: "",
        quantity: it.quantity,
        moq: "",
        supplier_id: null,
        supplier_price: it.unit_price.toString(),
        supplier_currency: isFx ? detectedCurrency : "",
        supplier_exchange_rate: "",
        pictureFile: null,
        picturePreview: "",
      }));
    onImport(items, supplierInfo);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-darkblack-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-bold text-darkblack-700 dark:text-white">AI Import</span>
            {step === "review" && (
              <span className="text-xs text-bgray-500 dark:text-bgray-400">— Review before importing</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* ── Pick step ── */}
          {step === "pick" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`
                relative flex flex-col items-center justify-center gap-5 py-12 px-6
                border-2 border-dashed rounded-2xl transition-all cursor-default
                ${dragOver
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-bgray-200 dark:border-darkblack-400 hover:border-bgray-300 dark:hover:border-darkblack-300"
                }
              `}
            >
              {/* Paste hint */}
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-14 h-14 rounded-2xl bg-bgray-50 dark:bg-darkblack-500 flex items-center justify-center text-2xl border border-bgray-100 dark:border-darkblack-400">
                  📋
                </div>
                <p className="text-base font-semibold text-darkblack-700 dark:text-white">
                  Paste your screenshot
                </p>
                <kbd className="px-2.5 py-1 bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 text-xs font-mono rounded-lg border border-bgray-200 dark:border-darkblack-400 shadow-sm">
                  Ctrl + V
                </kbd>
                <p className="text-xs text-bgray-400 dark:text-bgray-500 mt-1">
                  Works right after you take a screenshot — no need to save the file
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 w-full max-w-xs">
                <div className="flex-1 h-px bg-bgray-200 dark:bg-darkblack-400" />
                <span className="text-xs text-bgray-400 dark:text-bgray-500">or</span>
                <div className="flex-1 h-px bg-bgray-200 dark:bg-darkblack-400" />
              </div>

              {/* Upload button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 border border-bgray-200 dark:border-darkblack-400 rounded-xl text-sm font-medium text-bgray-600 dark:text-bgray-300 hover:border-primary hover:text-primary dark:hover:text-primary transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Browse file
                </button>
                <p className="text-xs text-bgray-400 dark:text-bgray-500">or drag & drop here</p>
              </div>

              {/* Drag overlay hint */}
              {dragOver && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary/5">
                  <p className="text-primary font-semibold text-sm">Drop to analyze</p>
                </div>
              )}
            </div>
          )}

          {/* ── Loading ── */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Uploaded quotation"
                  className="w-28 h-28 object-cover rounded-xl border border-gray-200 dark:border-darkblack-400 opacity-60"
                />
              )}
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-bgray-600 dark:text-bgray-300 font-medium">Analyzing your quotation…</p>
              <p className="text-xs text-bgray-400">Usually takes 5–10 seconds</p>
            </div>
          )}

          {/* ── Error ── */}
          {step === "error" && (
            <div className="py-12 text-center">
              <p className="text-2xl mb-3">❌</p>
              <p className="text-sm font-semibold text-darkblack-700 dark:text-white mb-1">Could not analyze the image</p>
              <p className="text-xs text-bgray-500 dark:text-bgray-400 mb-5 max-w-sm mx-auto">{errorMsg}</p>
              <button
                onClick={() => setStep("pick")}
                className="px-4 py-2 bg-gray-100 dark:bg-darkblack-500 rounded-lg text-sm text-gray-700 dark:text-bgray-300 hover:bg-gray-200 dark:hover:bg-darkblack-400 transition"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Review ── */}
          {step === "review" && (
            <>
              {/* Image + supplier side by side */}
              <div className="flex gap-3">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Scanned quotation"
                    className="w-20 h-20 object-cover rounded-xl border border-gray-200 dark:border-darkblack-400 shrink-0"
                  />
                )}
                {supplierInfo?.name && (
                  <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">Supplier Detected</p>
                    <p className="font-semibold text-sm text-darkblack-700 dark:text-white leading-tight">{supplierInfo.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                      {supplierInfo.contact_person && <span className="text-xs text-bgray-500 dark:text-bgray-400">👤 {supplierInfo.contact_person}</span>}
                      {supplierInfo.phone && <span className="text-xs text-bgray-500 dark:text-bgray-400">📞 {supplierInfo.phone}</span>}
                      {supplierInfo.email && <span className="text-xs text-bgray-500 dark:text-bgray-400">✉️ {supplierInfo.email}</span>}
                    </div>
                    {supplierInfo.address && (
                      <p className="text-xs text-bgray-400 dark:text-bgray-500 mt-1 leading-tight">{supplierInfo.address}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Currency warning */}
              {isFx && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-4 py-3 flex gap-2.5">
                  <span className="text-amber-500 shrink-0">⚠️</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Currency detected: <strong>{detectedCurrency}</strong> — your document is {currency}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                      Prices imported in {detectedCurrency}. Set exchange rate per item after importing.
                    </p>
                  </div>
                </div>
              )}

              {/* Items table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-bgray-600 dark:text-bgray-300 uppercase tracking-wide">
                    {editItems.length} item{editItems.length !== 1 ? "s" : ""} found
                  </p>
                  <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                    {allChecked ? "Deselect all" : "Select all"}
                  </button>
                </div>

                <div className="border border-gray-200 dark:border-darkblack-400 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[20px_90px_1fr_50px_90px] gap-2 px-3 py-2 bg-gray-50 dark:bg-darkblack-500 text-[10px] font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">
                    <span />
                    <span>Item #</span>
                    <span>Description</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">Price ({detectedCurrency})</span>
                  </div>

                  {editItems.map((item) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[20px_90px_1fr_50px_90px] gap-2 px-3 py-2.5 border-t border-gray-100 dark:border-darkblack-400 items-start transition-opacity ${!item.checked ? "opacity-35" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleItem(item.id)}
                        className="mt-2 w-3.5 h-3.5 rounded accent-primary cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={item.item_number}
                        onChange={e => updateItem(item.id, "item_number", e.target.value)}
                        placeholder="SKU"
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-darkblack-400 rounded-lg text-xs bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-1 focus:ring-primary placeholder-bgray-300"
                      />
                      <textarea
                        value={item.description}
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-darkblack-400 rounded-lg text-xs bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                        onWheel={e => e.target.blur()}
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-darkblack-400 rounded-lg text-xs bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-1 focus:ring-primary text-center"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={e => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                        onWheel={e => e.target.blur()}
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-darkblack-400 rounded-lg text-xs bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-1 focus:ring-primary text-right"
                      />
                    </div>
                  ))}
                </div>

                <p className="text-xs text-bgray-400 dark:text-bgray-500 mt-2">
                  ℹ️ Prices imported as <strong>Supplier Cost</strong> — set your client price after importing.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-darkblack-400 shrink-0">
            <p className="text-xs text-bgray-400 dark:text-bgray-500">
              {checkedCount} of {editItems.length} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-bgray-600 dark:text-bgray-300 hover:text-darkblack-700 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={checkedCount === 0}
                className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5"
              >
                Import {checkedCount} item{checkedCount !== 1 ? "s" : ""}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
