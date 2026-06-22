import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

// ── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const add = (raw) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  };

  const remove = (t) => onChange(tags.filter(x => x !== t));

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    if (e.key === "Backspace" && !input && tags.length) remove(tags[tags.length - 1]);
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[38px] px-2 py-1.5 border border-bgray-300 dark:border-darkblack-400 rounded-lg bg-white dark:bg-darkblack-600 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map(t => (
        <span
          key={t}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium"
        >
          {t}
          <button
            type="button"
            onClick={() => remove(t)}
            className="hover:text-primary/60 transition"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={tags.length === 0 ? "Add tags, press Enter…" : ""}
        className="flex-1 min-w-[120px] text-sm bg-transparent outline-none text-darkblack-700 dark:text-white placeholder-bgray-400"
      />
    </div>
  );
}

// ── Product modal ────────────────────────────────────────────────────────────
function ProductModal({ product, supplierId, onClose, onSaved }) {
  const isNew = !product?.id;
  const [form, setForm] = useState({
    name: product?.name || "",
    description: product?.description || "",
    specifications: product?.specifications || "",
    tags: product?.tags || [],
    price: product?.price || "",
    currency: product?.currency || "USD",
    unit: product?.unit || "",
    min_order_qty: product?.min_order_qty || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";
  const labelCls = "block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide";

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Product name is required"); return; }
    setBusy(true);
    setError("");
    try {
      const data = {
        supplier_id: supplierId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        specifications: form.specifications.trim() || null,
        tags: form.tags,
        price: form.price ? parseFloat(form.price) : null,
        currency: form.currency,
        unit: form.unit.trim() || null,
        min_order_qty: form.min_order_qty ? parseFloat(form.min_order_qty) : null,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        const { data: row, error: e } = await supabase.from("supplier_products").insert(data).select().single();
        if (e) throw e;
        onSaved(row, "created");
      } else {
        const { data: row, error: e } = await supabase.from("supplier_products").update(data).eq("id", product.id).select().single();
        if (e) throw e;
        onSaved(row, "updated");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-bgray-200 dark:border-darkblack-400 sticky top-0 bg-white dark:bg-darkblack-600 z-10">
          <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">
            {isNew ? "Add Product" : "Edit Product"}
          </h2>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-200 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

          <div>
            <label className={labelCls}>Product Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Stainless Steel Valve 1/2 inch"
              className={inputCls}
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>Tags</label>
            <TagInput tags={form.tags} onChange={v => setForm(p => ({ ...p, tags: v }))} />
            <p className="text-xs text-bgray-400 mt-1">Press Enter or comma to add. Used for search across all suppliers.</p>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Short description of the product…"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>Specifications</label>
            <textarea
              value={form.specifications}
              onChange={e => setForm(p => ({ ...p, specifications: e.target.value }))}
              placeholder="Material, dimensions, certifications, etc."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Price</label>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                placeholder="0.00"
                step="0.01"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                className={inputCls}
              >
                <option>USD</option>
                <option>EUR</option>
                <option>CNY</option>
                <option>GBP</option>
                <option>JPY</option>
                <option>KRW</option>
                <option>COP</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                placeholder="pcs / kg / m"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Min. Order Qty</label>
            <input
              type="number"
              value={form.min_order_qty}
              onChange={e => setForm(p => ({ ...p, min_order_qty: e.target.value }))}
              placeholder="e.g. 100"
              step="1"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-bgray-200 dark:border-darkblack-400 sticky bottom-0 bg-white dark:bg-darkblack-600">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || busy}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {busy ? "Saving…" : isNew ? "Add Product" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product card ─────────────────────────────────────────────────────────────
function ProductCard({ product, onEdit, onDelete }) {
  const hasPrice = product.price != null;

  return (
    <div className="bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4 hover:shadow-md transition group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-darkblack-700 dark:text-white leading-snug flex-1">
          {product.name}
        </h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => onEdit(product)}
            className="p-1.5 hover:bg-bgray-100 dark:hover:bg-darkblack-400 rounded-lg text-bgray-500 dark:text-bgray-400 transition"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(product)}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-bgray-500 hover:text-red-500 dark:text-bgray-400 dark:hover:text-red-400 transition"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {product.description && (
        <p className="text-xs text-bgray-500 dark:text-bgray-400 mb-2 line-clamp-2">{product.description}</p>
      )}

      {product.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {product.tags.map(t => (
            <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-bgray-100 dark:border-darkblack-400">
        {hasPrice ? (
          <span className="text-sm font-semibold text-darkblack-700 dark:text-white">
            {product.currency} {Number(product.price).toLocaleString()}
            {product.unit ? <span className="text-xs font-normal text-bgray-500"> / {product.unit}</span> : null}
          </span>
        ) : (
          <span className="text-xs text-bgray-400">No price</span>
        )}
        {product.min_order_qty && (
          <span className="text-xs text-bgray-400">MOQ: {product.min_order_qty}</span>
        )}
      </div>
    </div>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export default function SupplierProductsTab({ supplierId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [modal, setModal] = useState(undefined); // undefined = closed, null = new, obj = edit

  useEffect(() => { load(); }, [supplierId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("supplier_products")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("name");
      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error("Error loading products:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = (row, action) => {
    if (action === "created") setProducts(p => [...p, row].sort((a, b) => a.name.localeCompare(b.name)));
    else setProducts(p => p.map(x => x.id === row.id ? row : x));
    setModal(undefined);
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"?`)) return;
    const { error } = await supabase.from("supplier_products").delete().eq("id", product.id);
    if (error) { alert(error.message); return; }
    setProducts(p => p.filter(x => x.id !== product.id));
  };

  // All unique tags across this supplier's products
  const allTags = [...new Set(products.flatMap(p => p.tags || []))].sort();

  const filtered = products.filter(p => {
    if (activeTag && !p.tags?.includes(activeTag)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.specifications?.toLowerCase().includes(q) ||
        p.tags?.some(t => t.includes(q))
      );
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-darkblack-700 dark:text-white">Products</h2>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">
            {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setModal(null)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, description or tag…"
          className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
        />
      </div>

      {/* Tag filter pills */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button
            onClick={() => setActiveTag("")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              !activeTag
                ? "bg-primary text-white"
                : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-200 dark:hover:bg-darkblack-400"
            }`}
          >
            All
          </button>
          {allTags.map(t => (
            <button
              key={t}
              onClick={() => setActiveTag(activeTag === t ? "" : t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                activeTag === t
                  ? "bg-primary text-white"
                  : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-200 dark:hover:bg-darkblack-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-bgray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-sm">Loading products…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-bgray-100 dark:bg-darkblack-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-bgray-500 dark:text-bgray-400 text-sm">
            {products.length === 0
              ? "No products yet. Add your first product."
              : "No products match your search."}
          </p>
          {products.length === 0 && (
            <button
              onClick={() => setModal(null)}
              className="mt-4 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
            >
              Add First Product
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={(prod) => setModal(prod)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modal !== undefined && (
        <ProductModal
          product={modal}
          supplierId={supplierId}
          onClose={() => setModal(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
