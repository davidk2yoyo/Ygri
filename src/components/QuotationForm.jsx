import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import QuotationPDF from "./QuotationPDF";
import AIQuotationImporter from "./AIQuotationImporter";

const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const CURRENCIES = ["USD", "COP", "EUR", "CNY", "HKD"];

const emptyItem = () => ({
  tempId: Math.random().toString(36).slice(2),
  catalog_item_id: null,
  item_number: "",
  description: "",
  picture_url: "",
  price: "",
  quantity: 1,
  moq: "",
  supplier_id: null,
  supplier_price: "",
  supplier_currency: "",
  supplier_exchange_rate: "",
  pictureFile: null,
  picturePreview: "",
});

export default function QuotationForm({ trackId, clientName, projectName, onClose, onSaved }) {
  const [documentType, setDocumentType] = useState("quotation");
  const [type, setType] = useState("product");
  const [currency, setCurrency] = useState("USD");
  const [incoterm, setIncoterm] = useState("");
  const [incotermLocation, setIncotermLocation] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [supplierExchangeRate, setSupplierExchangeRate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [negotiationTerm, setNegotiationTerm] = useState("");
  const [notes, setNotes] = useState("");
  const [commissionPct, setCommissionPct] = useState(0);
  const [showCommission, setShowCommission] = useState(false);
  const [items, setItems] = useState([emptyItem()]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierItemIndex, setSupplierItemIndex] = useState(null);
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(null);
  const [showPDF, setShowPDF] = useState(false);
  const [showAIImporter, setShowAIImporter] = useState(false);
  const [savedQuotation, setSavedQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quoteNumber, setQuoteNumber] = useState("");
  const fileRefs = useRef({});
  const [dragOver, setDragOver] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [supplierSearches, setSupplierSearches] = useState({});
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(null);

  // New supplier form state
  const [newSupplier, setNewSupplier] = useState({
    name: "", address: "", email: "", sales_person: "", wechat_or_whatsapp: "", website: ""
  });

  useEffect(() => {
    loadInitialData();
  }, [trackId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load suppliers
      const { data: suppData } = await supabase.from("suppliers").select("*").order("name");
      setSuppliers(suppData || []);

      // Load catalog items
      const { data: catData } = await supabase.from("catalog_items").select("*").order("description");
      setCatalogItems(catData || []);

      // Load existing quotation for this track
      const { data: quotData } = await supabase
        .from("quotations")
        .select("*, quotation_items(*)")
        .eq("track_id", trackId)
        .maybeSingle();

      if (quotData) {
        setSavedQuotation(quotData);
        setQuoteNumber(quotData.quote_number || "");
        setDocumentType(quotData.document_type || "quotation");
        setType(quotData.type || "product");
        setCurrency(quotData.currency || "USD");
        setIncoterm(quotData.incoterm || "");
        setIncotermLocation(quotData.incoterm_location || "");
        setDeliveryTime(quotData.delivery_time || "");
        setSupplierExchangeRate(quotData.supplier_exchange_rate?.toString() || "");
        setValidUntil(quotData.valid_until || "");
        setNegotiationTerm(quotData.negotiation_term || "");
        setNotes(quotData.notes || "");
        setCommissionPct(parseFloat(quotData.commission_pct) || 0);
        setShowCommission(quotData.show_commission || false);
        if (quotData.quotation_items?.length > 0) {
          setItems(quotData.quotation_items.map(qi => ({
            ...emptyItem(),
            ...qi,
            tempId: qi.id,
            picturePreview: qi.picture_url || "",
          })));
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = items.reduce((sum, it) => {
    const p = parseFloat(it.price) || 0;
    const q = parseInt(it.quantity) || 1;
    return sum + p * q;
  }, 0);

  const commissionAmount = totalAmount * (parseFloat(commissionPct) || 0) / 100;
  const grandTotal = totalAmount + commissionAmount;

  // ---------- Item helpers ----------
  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleAIImport = (importedItems) => {
    setItems(prev => {
      const existing = prev.filter(it => it.description || it.item_number);
      return existing.length > 0 ? [...existing, ...importedItems] : importedItems;
    });
    setShowAIImporter(false);
  };

  const handleItemPicture = async (idx, file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    updateItem(idx, "pictureFile", file);
    updateItem(idx, "picturePreview", preview);
  };

  const selectCatalogItem = (idx, catItem) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      catalog_item_id: catItem.id,
      item_number: catItem.item_number || it.item_number,
      description: catItem.description,
      price: catItem.default_price?.toString() || it.price,
      picturePreview: catItem.picture_url || it.picturePreview,
      picture_url: catItem.picture_url || it.picture_url,
    } : it));
    setShowCatalogDropdown(null);
  };

  // ---------- Supplier helpers ----------
  const openSupplierModal = (idx) => {
    setSupplierItemIndex(idx);
    setNewSupplier({ name: "", address: "", email: "", sales_person: "", wechat_or_whatsapp: "", website: "" });
    setShowSupplierModal(true);
  };

  const withTimeout = (promise, ms = 15000) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out. Check your connection or try again.")), ms))
    ]);

  const saveNewSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await withTimeout(
        supabase.from("suppliers").insert(newSupplier).select().single()
      );
      if (error) throw error;
      setSuppliers(prev => [...prev, data]);
      if (supplierItemIndex !== null) {
        updateItem(supplierItemIndex, "supplier_id", data.id);
      }
      setShowSupplierModal(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- Upload picture to storage ----------
  const uploadItemPicture = async (file, itemKey) => {
    const ext = file.name.split(".").pop();
    const path = `quotation-items/${itemKey}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("quotation-images").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("quotation-images").getPublicUrl(path);
    return data.publicUrl;
  };

  // ---------- Save quotation ----------
  const handleSave = async () => {
    if (items.length === 0) { setError("Add at least one item."); return; }
    setBusy(true);
    setError("");
    const timeoutId = setTimeout(() => {
      setBusy(false);
      setError("Save is taking too long. Check your internet connection and try again.");
    }, 30000);
    try {
      // 1. Upsert quotation header
      const quotPayload = {
        track_id: trackId,
        type,
        currency,
        incoterm: type === "product" ? incoterm : null,
        incoterm_location: type === "product" ? incotermLocation : null,
        delivery_time: type === "product" ? deliveryTime : null,
        negotiation_term: negotiationTerm,
        notes,
        commission_pct: parseFloat(commissionPct) || 0,
        show_commission: showCommission,
        total_amount: grandTotal,
        document_type: documentType,
        client_name: clientName || null,
        project_name: projectName || null,
        valid_until: documentType === "quotation" ? (validUntil || null) : null,
        supplier_exchange_rate: type === "product" ? (parseFloat(supplierExchangeRate) || null) : null,
      };

      let quotId;
      if (savedQuotation) {
        const { data, error } = await supabase
          .from("quotations")
          .update(quotPayload)
          .eq("id", savedQuotation.id)
          .select()
          .single();
        if (error) throw error;
        quotId = data.id;
        setSavedQuotation(data);
        setQuoteNumber(data.quote_number);
      } else {
        const { data, error } = await supabase
          .from("quotations")
          .insert(quotPayload)
          .select()
          .single();
        if (error) throw error;
        quotId = data.id;
        setSavedQuotation(data);
        setQuoteNumber(data.quote_number);
      }

      // 2. Delete old items and re-insert
      await supabase.from("quotation_items").delete().eq("quotation_id", quotId);

      // 3. Upload pictures & save catalog items if new
      const itemsToInsert = await Promise.all(items.map(async (it, idx) => {
        let pictureUrl = it.picture_url || "";

        // Upload new picture if selected
        if (it.pictureFile) {
          pictureUrl = await uploadItemPicture(it.pictureFile, `item-${idx}`);
        }

        // Save to catalog if it has a description and no catalog_id yet
        let catalogId = it.catalog_item_id;
        if (!catalogId && it.description.trim()) {
          const { data: catData } = await supabase
            .from("catalog_items")
            .insert({
              item_number: it.item_number,
              description: it.description,
              picture_url: pictureUrl,
              default_price: parseFloat(it.price) || null,
            })
            .select()
            .single();
          if (catData) {
            catalogId = catData.id;
            setCatalogItems(prev => [...prev, catData]);
          }
        }

        return {
          quotation_id: quotId,
          catalog_item_id: catalogId,
          item_number: it.item_number,
          description: it.description,
          picture_url: pictureUrl,
          price: parseFloat(it.price) || 0,
          quantity: parseInt(it.quantity) || 1,
          supplier_id: type === "product" ? it.supplier_id : null,
          supplier_price: type === "product" ? (parseFloat(it.supplier_price) || null) : null,
          supplier_currency: type === "product" ? (it.supplier_currency || null) : null,
          supplier_exchange_rate: type === "product" && it.supplier_currency && it.supplier_currency !== currency
            ? (parseFloat(supplierExchangeRate) || null)
            : null,
          moq: documentType === "quotation" ? (parseInt(it.moq) || null) : null,
          sort_order: idx,
        };
      }));

      const { error: itemsError } = await supabase.from("quotation_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      if (onSaved) onSaved(grandTotal, currency);
    } catch (e) {
      setError(e.message);
    } finally {
      clearTimeout(timeoutId);
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  // ---------- PDF preview modal ----------
  if (showPDF && savedQuotation) {
    return (
      <QuotationPDF
        quotation={{ ...savedQuotation, type, currency, incoterm, incoterm_location: incotermLocation, delivery_time: deliveryTime, negotiation_term: negotiationTerm, notes, quote_number: quoteNumber, document_type: documentType, valid_until: validUntil || null }}
        items={items}
        clientName={clientName}
        projectName={projectName}
        totalAmount={totalAmount}
        commissionPct={parseFloat(commissionPct) || 0}
        showCommission={showCommission}
        onClose={() => setShowPDF(false)}
      />
    );
  }

  const DOC_STEPS = [
    { key: "quotation", label: "Quotation", short: "Quote" },
    { key: "proforma",  label: "Proforma Invoice", short: "Proforma" },
    { key: "invoice",   label: "Commercial Invoice", short: "Invoice" },
  ];
  const currentStepIdx = DOC_STEPS.findIndex(s => s.key === documentType);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-darkblack-700 dark:text-white">
            {savedQuotation ? `${DOC_STEPS[currentStepIdx].label} ${quoteNumber}` : "New Quotation"}
          </h3>
          <p className="text-xs text-bgray-500">{projectName} · {clientName}</p>
        </div>
        <div className="flex gap-2">
          {savedQuotation && (
            <>
              <a
                href={`/quotations/${savedQuotation.id}/annex`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-bgray-200 text-darkblack-700 rounded-lg text-sm font-medium hover:border-primary hover:text-primary transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Technical Annex
              </a>
              <button
                onClick={() => setShowPDF(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-600 text-white rounded-lg text-sm font-medium hover:bg-navy-700 transition"
                style={{ backgroundColor: "#1e3a5f" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Preview PDF
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {busy ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block"></span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {busy ? "Saving..." : savedQuotation ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {/* Document type stepper */}
      <div className="flex items-center gap-1">
        {DOC_STEPS.map((step, i) => {
          const isDone = i < currentStepIdx;
          const isActive = i === currentStepIdx;
          return (
            <React.Fragment key={step.key}>
              <button
                onClick={() => setDocumentType(step.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  isActive
                    ? "bg-primary text-white shadow"
                    : isDone
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-400 dark:text-bgray-400 hover:bg-bgray-200"
                }`}
              >
                {isDone && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {step.short}
              </button>
              {i < DOC_STEPS.length - 1 && (
                <svg className="w-3 h-3 text-bgray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </React.Fragment>
          );
        })}
        {currentStepIdx < DOC_STEPS.length - 1 && (
          <button
            onClick={() => setDocumentType(DOC_STEPS[currentStepIdx + 1].key)}
            className="ml-2 flex items-center gap-1 px-3 py-1.5 bg-darkblack-700 dark:bg-white text-white dark:text-darkblack-700 rounded-full text-xs font-semibold hover:opacity-80 transition"
          >
            Promote to {DOC_STEPS[currentStepIdx + 1].short}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      )}

      {/* Type + Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Type</label>
          <div className="flex rounded-lg border border-bgray-300 dark:border-darkblack-400 overflow-hidden">
            {["product", "service"].map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-sm font-medium capitalize transition ${
                  type === t
                    ? "bg-primary text-white"
                    : "bg-white dark:bg-darkblack-600 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500"
                }`}
              >
                {t === "product" ? "📦 Product" : "🔧 Service"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Currency</label>
          <div className="flex rounded-lg border border-bgray-300 dark:border-darkblack-400 overflow-hidden">
            {CURRENCIES.map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  currency === c
                    ? "bg-primary text-white"
                    : "bg-white dark:bg-darkblack-600 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product-only fields */}
      {type === "product" && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Incoterm</label>
            <select
              value={incoterm}
              onChange={e => setIncoterm(e.target.value)}
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            >
              <option value="">Select...</option>
              {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">
              Location / Port
            </label>
            <input
              type="text"
              value={incotermLocation}
              onChange={e => setIncotermLocation(e.target.value)}
              placeholder={incoterm === "EXW" ? "e.g. Guangzhou Factory" : "e.g. Shanghai Port"}
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Delivery Time</label>
            <input
              type="text"
              value={deliveryTime}
              onChange={e => setDeliveryTime(e.target.value)}
              placeholder="e.g. 30-45 days after deposit"
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
            />
          </div>
        </div>
      )}

      {/* Offer validity — quotation only */}
      {documentType === "quotation" && (
        <div className="max-w-xs">
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">
            Offer Valid Until
          </label>
          <input
            type="date"
            value={validUntil}
            onChange={e => setValidUntil(e.target.value)}
            className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      {/* Supplier exchange rate — product type only */}
      {type === "product" && (
        <div className="max-w-sm">
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">
            Supplier Exchange Rate
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-bgray-500 dark:text-bgray-400 whitespace-nowrap">1 {currency} =</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={supplierExchangeRate}
              onChange={e => setSupplierExchangeRate(e.target.value)}
              onWheel={e => e.target.blur()}
              placeholder="e.g. 7.25"
              className="w-32 px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
            />
            <span className="text-xs text-bgray-400 dark:text-bgray-500">supplier currency units</span>
          </div>
          {supplierExchangeRate && parseFloat(supplierExchangeRate) > 0 && (
            <p className="text-xs text-bgray-400 dark:text-bgray-500 mt-1">
              Used to convert supplier costs to {currency} for margin calculation
            </p>
          )}
        </div>
      )}

      {/* Shared: Negotiation Term */}
      <div>
        <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Negotiation Term</label>
        <input
          type="text"
          value={negotiationTerm}
          onChange={e => setNegotiationTerm(e.target.value)}
          placeholder="e.g. 30% deposit, 70% before shipment"
          className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
        />
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-darkblack-700 dark:text-white uppercase tracking-wide">Items</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIImporter(true)}
              className="flex items-center gap-1.5 text-sm border border-bgray-200 dark:border-darkblack-400 text-bgray-600 dark:text-bgray-300 hover:border-primary hover:text-primary font-semibold rounded-lg px-4 py-2 transition"
            >
              Import with AI
            </button>
            <button
              onClick={addItem}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.tempId} className="border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4 bg-bgray-50 dark:bg-darkblack-500 relative">
              {/* Remove button */}
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(idx)}
                  className="absolute top-3 right-3 text-bgray-400 hover:text-red-500 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              <div className="grid grid-cols-12 gap-3">
                {/* Picture */}
                <div className="col-span-2">
                  <label className="block text-xs text-bgray-500 mb-1">Picture</label>
                  <div
                    onClick={() => fileRefs.current[idx]?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(null);
                      const file = e.dataTransfer.files[0];
                      if (file?.type.startsWith("image/")) handleItemPicture(idx, file);
                    }}
                    className={`w-full h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition overflow-hidden ${
                      dragOver === idx
                        ? "border-primary bg-primary/10 scale-[1.02]"
                        : "border-bgray-300 dark:border-darkblack-400 hover:border-primary"
                    }`}
                  >
                    {item.picturePreview ? (
                      <div className="relative w-full h-full group/img">
                        <img src={item.picturePreview} alt="" className="w-full h-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setPreviewImage(item.picturePreview); }}
                          className="absolute top-1 right-1 p-1 bg-black/50 rounded-md opacity-0 group-hover/img:opacity-100 transition-opacity"
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </button>
                      </div>
                    ) : dragOver === idx ? (
                      <span className="text-xs text-primary font-semibold">Drop image here</span>
                    ) : (
                      <svg className="w-6 h-6 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={el => fileRefs.current[idx] = el}
                    onChange={e => handleItemPicture(idx, e.target.files[0])}
                  />
                </div>

                {/* Fields */}
                <div className="col-span-10 grid grid-cols-2 gap-2">
                  {/* Item # with catalog search dropdown */}
                  <div className="relative">
                    <label className="block text-xs text-bgray-500 mb-1">Item #</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={item.item_number}
                        onChange={e => {
                          updateItem(idx, "item_number", e.target.value);
                          setShowCatalogDropdown(idx);
                        }}
                        onFocus={() => setShowCatalogDropdown(idx)}
                        onBlur={() => setTimeout(() => setShowCatalogDropdown(null), 150)}
                        placeholder="SKU / Ref or search..."
                        className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
                      />
                      {showCatalogDropdown === idx && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {catalogItems
                            .filter(c =>
                              (c.item_number || "").toLowerCase().includes(item.item_number.toLowerCase()) ||
                              c.description.toLowerCase().includes(item.item_number.toLowerCase())
                            )
                            .map(c => (
                              <button
                                key={c.id}
                                onMouseDown={() => selectCatalogItem(idx, c)}
                                className="w-full text-left px-3 py-2 hover:bg-bgray-50 dark:hover:bg-darkblack-400 text-sm flex items-center gap-2"
                              >
                                {c.picture_url && <img src={c.picture_url} alt="" className="w-6 h-6 rounded object-cover shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  {c.item_number && <span className="font-mono text-xs text-bgray-500 mr-2">{c.item_number}</span>}
                                  <span className="truncate">{c.description}</span>
                                </div>
                                {c.default_price && <span className="ml-auto text-xs text-bgray-400 shrink-0">${c.default_price}</span>}
                              </button>
                            ))}
                          {catalogItems.filter(c =>
                            (c.item_number || "").toLowerCase().includes(item.item_number.toLowerCase()) ||
                            c.description.toLowerCase().includes(item.item_number.toLowerCase())
                          ).length === 0 && (
                            <p className="px-3 py-2 text-xs text-bgray-400">No matches — new item will be saved to catalog</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description — free text, filled automatically on catalog select */}
                  <div>
                    <label className="block text-xs text-bgray-500 mb-1">Description</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateItem(idx, "description", e.target.value)}
                      placeholder="Product / service description"
                      className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-bgray-500 mb-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateItem(idx, "quantity", e.target.value)}
                      onWheel={e => e.target.blur()}
                      className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
                    />
                    {documentType === "quotation" && (
                      <div className="mt-2">
                        <label className="block text-xs text-bgray-500 mb-1">MOQ</label>
                        <input
                          type="number"
                          min="1"
                          value={item.moq || ""}
                          onChange={e => updateItem(idx, "moq", e.target.value)}
                          onWheel={e => e.target.blur()}
                          placeholder="e.g. 50"
                          className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-bgray-500 mb-1">Price ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={e => updateItem(idx, "price", e.target.value)}
                      onWheel={e => e.target.blur()}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
                    />
                  </div>

                  {/* Supplier Cost — internal only, never shown in PDF */}
                  {type === "product" && (() => {
                    const supplierCurr = item.supplier_currency || "";
                    const isFx = supplierCurr && supplierCurr !== currency;
                    const rate = parseFloat(supplierExchangeRate) || 0;
                    const supplierPriceRaw = parseFloat(item.supplier_price) || 0;
                    const supplierPriceInDocCurrency = isFx && rate > 0
                      ? supplierPriceRaw / rate
                      : supplierPriceRaw;
                    return (
                      <div>
                        <label className="block text-xs text-bgray-500 mb-1 flex items-center gap-1 flex-wrap">
                          Supplier Cost
                          {/* Currency picker */}
                          <select
                            value={supplierCurr || currency}
                            onChange={e => updateItem(idx, "supplier_currency", e.target.value === currency ? "" : e.target.value)}
                            className="px-1.5 py-0.5 border border-amber-200 rounded text-xs bg-amber-50 dark:bg-amber-900/10 text-darkblack-700 dark:text-white focus:ring-1 focus:ring-amber-400 cursor-pointer"
                          >
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                            </svg>
                            Internal
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.supplier_price}
                          onChange={e => updateItem(idx, "supplier_price", e.target.value)}
                          onWheel={e => e.target.blur()}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-amber-200 dark:border-amber-700/50 rounded-lg text-sm bg-amber-50 dark:bg-amber-900/10 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-amber-400 placeholder-bgray-400"
                        />
                        {/* Converted cost display */}
                        {isFx && supplierPriceRaw > 0 && rate > 0 && (
                          <p className="text-xs text-bgray-400 mt-1">
                            = {currency} {supplierPriceInDocCurrency.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Subtotal + margin display */}
                  {(() => {
                    const supplierCurr = item.supplier_currency || "";
                    const isFx = type === "product" && supplierCurr && supplierCurr !== currency;
                    const rate = parseFloat(supplierExchangeRate) || 0;
                    const supplierPriceRaw = parseFloat(item.supplier_price) || 0;
                    const supplierPriceInDocCurrency = isFx && rate > 0
                      ? supplierPriceRaw / rate
                      : supplierPriceRaw;
                    const qty = parseInt(item.quantity) || 1;
                    const clientTotal = (parseFloat(item.price) || 0) * qty;
                    const supplierTotal = supplierPriceInDocCurrency * qty;
                    const marginAmt = clientTotal - supplierTotal;
                    const marginPct = clientTotal > 0 ? (marginAmt / clientTotal * 100) : 0;
                    const marginColor = marginPct >= 20 ? "text-green-600" : marginPct >= 10 ? "text-amber-600" : "text-red-500";
                    const showMargin = type === "product" && supplierPriceRaw > 0 && item.price &&
                      (!isFx || (isFx && rate > 0));
                    return (
                      <div className={`flex flex-col justify-end gap-0.5 ${type === "product" ? "" : "col-span-1"}`}>
                        <p className="text-sm font-semibold text-darkblack-700 dark:text-white">
                          Subtotal: <span className="text-primary">{currency} {clientTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </p>
                        {showMargin && (
                          <p className={`text-xs font-medium ${marginColor}`}>
                            Margin: {currency} {marginAmt.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({marginPct.toFixed(1)}%)
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Supplier — product only, hidden badge */}
                  {type === "product" && (
                    <div className="col-span-2">
                      <label className="block text-xs text-bgray-500 mb-1 flex items-center gap-1">
                        Supplier
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                          </svg>
                          Hidden from client
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          {(() => {
                            const selectedName = item.supplier_id ? suppliers.find(s => s.id === item.supplier_id)?.name ?? "" : "";
                            const inputVal = showSupplierDropdown === idx
                              ? (supplierSearches[item.tempId] ?? selectedName)
                              : selectedName;
                            const filterText = showSupplierDropdown === idx ? (supplierSearches[item.tempId] ?? "") : "";
                            const filtered = suppliers.filter(s => s.name.toLowerCase().includes(filterText.toLowerCase()));
                            return (
                              <>
                                <input
                                  type="text"
                                  value={inputVal}
                                  onChange={e => {
                                    setSupplierSearches(p => ({ ...p, [item.tempId]: e.target.value }));
                                    updateItem(idx, "supplier_id", null);
                                    setShowSupplierDropdown(idx);
                                  }}
                                  onFocus={() => {
                                    setSupplierSearches(p => ({ ...p, [item.tempId]: selectedName }));
                                    setShowSupplierDropdown(idx);
                                  }}
                                  onBlur={() => setTimeout(() => setShowSupplierDropdown(null), 150)}
                                  placeholder="Search supplier..."
                                  className="w-full px-3 py-2 pr-7 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
                                />
                                {item.supplier_id ? (
                                  <button
                                    type="button"
                                    onMouseDown={() => { updateItem(idx, "supplier_id", null); setSupplierSearches(p => ({ ...p, [item.tempId]: "" })); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-bgray-400 hover:text-red-500 transition"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                ) : (
                                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-bgray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                )}
                                {showSupplierDropdown === idx && (
                                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {filtered.map(s => (
                                      <button
                                        key={s.id}
                                        onMouseDown={() => {
                                          updateItem(idx, "supplier_id", s.id);
                                          setSupplierSearches(p => ({ ...p, [item.tempId]: s.name }));
                                          setShowSupplierDropdown(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-bgray-50 dark:hover:bg-darkblack-400 transition ${
                                          item.supplier_id === s.id ? "font-semibold text-primary" : "text-darkblack-700 dark:text-white"
                                        }`}
                                      >
                                        {s.name}
                                      </button>
                                    ))}
                                    {filtered.length === 0 && (
                                      <p className="px-3 py-2 text-xs text-bgray-400">No suppliers found</p>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <button
                          onClick={() => openSupplierModal(idx)}
                          className="px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-100 dark:hover:bg-darkblack-500 transition whitespace-nowrap"
                        >
                          + New
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Notes / Terms</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Additional notes, terms, or conditions..."
          className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400 resize-none"
        />
      </div>

      {/* Commission */}
      <div className="border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4 bg-bgray-50 dark:bg-darkblack-500">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-bgray-600 dark:text-bgray-300 uppercase tracking-wide">Commission</label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-bgray-500 dark:text-bgray-400">Show in invoice</span>
            <div
              onClick={() => setShowCommission(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${showCommission ? "bg-primary" : "bg-bgray-300 dark:bg-darkblack-400"}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showCommission ? "translate-x-4" : "translate-x-0"}`} />
            </div>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-[180px]">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={commissionPct}
              onChange={e => setCommissionPct(e.target.value)}
              onWheel={e => e.target.blur()}
              placeholder="0"
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            />
            <span className="text-sm font-semibold text-bgray-600 dark:text-bgray-300">%</span>
          </div>
          {commissionPct > 0 && (
            <div className="text-sm text-bgray-600 dark:text-bgray-300">
              = <span className="font-semibold text-darkblack-700 dark:text-white">
                {currency} {commissionAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Total */}
      <div className="flex justify-end">
        <div className="bg-darkblack-700 dark:bg-darkblack-400 rounded-xl px-6 py-4 text-right">
          {commissionPct > 0 && (
            <p className="text-xs text-bgray-400 mb-1">
              Subtotal: {currency} {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {" · "}Commission ({commissionPct}%): {currency} {commissionAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-xs text-bgray-300 uppercase tracking-wider mb-1">Total Amount</p>
          <p className="text-2xl font-bold text-white">
            {currency} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Image Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
            onClick={() => setPreviewImage(null)}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* New Supplier Modal */}
      {showAIImporter && (
        <AIQuotationImporter
          currency={currency}
          suppliers={suppliers}
          supabase={supabase}
          onSupplierCreated={(newSup) => setSuppliers(prev => [...prev, newSup])}
          onImport={handleAIImport}
          onClose={() => setShowAIImporter(false)}
        />
      )}

      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-darkblack-700 dark:text-white">New Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-bgray-400 hover:text-bgray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {[
                { field: "name", label: "Company Name *", placeholder: "Supplier Co. Ltd" },
                { field: "address", label: "Address", placeholder: "City, Country" },
                { field: "email", label: "Email", placeholder: "contact@supplier.com" },
                { field: "sales_person", label: "Sales Person", placeholder: "Full name" },
                { field: "wechat_or_whatsapp", label: "WeChat / WhatsApp", placeholder: "+86 123 456 7890" },
                { field: "website", label: "Website", placeholder: "www.supplier.com" },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs text-bgray-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={newSupplier[field]}
                    onChange={e => setNewSupplier(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowSupplierModal(false)}
                className="flex-1 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveNewSupplier}
                disabled={!newSupplier.name.trim() || busy}
                className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {busy ? "Saving..." : "Save Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
