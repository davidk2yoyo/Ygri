import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import SupplierDocumentsTab from "../components/SupplierDocumentsTab";
import SupplierProductsTab from "../components/SupplierProductsTab";
import AIClientScanner from "../components/AIClientScanner";
import CountrySelect from "../components/CountrySelect";

const EMPTY_SUPPLIER = { name: "", address: "", city: "", state: "", country: "", email: "", sales_person: "", wechat_or_whatsapp: "", website: "", tags: [] };

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
        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
          {t}
          <button type="button" onClick={() => remove(t)} className="hover:text-primary/60 transition">×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={tags.length === 0 ? "e.g. machinery, valves, textiles…" : ""}
        className="flex-1 min-w-[140px] text-sm bg-transparent outline-none text-darkblack-700 dark:text-white placeholder-bgray-400"
      />
    </div>
  );
}

function SupplierDrawer({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState(supplier ? { ...supplier, tags: supplier.tags || [] } : { ...EMPTY_SUPPLIER });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [showScanner, setShowScanner] = useState(false);

  const isNew = !supplier?.id;

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    setError("");
    try {
      if (isNew) {
        const { data, error } = await supabase.from("suppliers").insert(form).select().single();
        if (error) throw error;
        onSaved(data, "created");
      } else {
        const { data, error } = await supabase.from("suppliers").update(form).eq("id", supplier.id).select().single();
        if (error) throw error;
        onSaved(data, "updated");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", supplier.id);
      if (error) throw error;
      onSaved(supplier, "deleted");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";
  const labelCls = "block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-darkblack-600 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl sm:mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-bgray-200 dark:border-darkblack-400">
          <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">
            {isNew ? "New Supplier" : supplier.name}
          </h2>
          <div className="flex items-center gap-3">
            {activeTab === "details" && (
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-bgray-50 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 border border-bgray-200 dark:border-darkblack-400 rounded-lg text-sm font-semibold hover:border-primary hover:text-primary transition"
              >
                Scan with AI
              </button>
            )}
            <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-200 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {showScanner && (
          <AIClientScanner
            onFill={(data) => setForm(prev => ({
              ...prev,
              name: data.company_name || prev.name,
              sales_person: data.contact_person || prev.sales_person,
              email: data.email || prev.email,
              wechat_or_whatsapp: data.phone || prev.wechat_or_whatsapp,
              website: data.website || prev.website,
              address: data.address || prev.address,
              country: data.country || prev.country,
            }))}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-bgray-200 dark:border-darkblack-400">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "details"
                ? "border-primary text-primary"
                : "border-transparent text-bgray-500 dark:text-bgray-400 hover:text-bgray-700 dark:hover:text-bgray-300"
            }`}
          >
            Details
          </button>
          {!isNew && (
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === "documents"
                  ? "border-primary text-primary"
                  : "border-transparent text-bgray-500 dark:text-bgray-400 hover:text-bgray-700 dark:hover:text-bgray-300"
              }`}
            >
              Documents
            </button>
          )}
          {!isNew && (
            <button
              onClick={() => setActiveTab("products")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === "products"
                  ? "border-primary text-primary"
                  : "border-transparent text-bgray-500 dark:text-bgray-400 hover:text-bgray-700 dark:hover:text-bgray-300"
              }`}
            >
              Products
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" ? (
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                {/* Company Name */}
                <div className="col-span-2">
                  <label className={labelCls}>Company Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Supplier Co. Ltd" className={inputCls} />
                </div>

                {/* Address */}
                <div className="col-span-2">
                  <label className={labelCls}>Street Address</label>
                  <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Building / street / floor" className={inputCls} />
                </div>

                {/* Country */}
                <div>
                  <label className={labelCls}>Country</label>
                  <CountrySelect value={form.country} onChange={v => setForm(p => ({ ...p, country: v }))} className={inputCls} />
                </div>

                {/* City */}
                <div>
                  <label className={labelCls}>City</label>
                  <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Shanghai" className={inputCls} />
                </div>

                {/* State / Province */}
                <div>
                  <label className={labelCls}>State / Province</label>
                  <input type="text" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} placeholder="e.g. Jiangsu" className={inputCls} />
                </div>

                {/* Email */}
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="contact@supplier.com" className={inputCls} />
                </div>

                {/* Sales Person */}
                <div>
                  <label className={labelCls}>Sales Person</label>
                  <input type="text" value={form.sales_person} onChange={e => setForm(p => ({ ...p, sales_person: e.target.value }))} placeholder="Full name" className={inputCls} />
                </div>

                {/* WeChat / WhatsApp */}
                <div>
                  <label className={labelCls}>WeChat / WhatsApp</label>
                  <input type="text" value={form.wechat_or_whatsapp} onChange={e => setForm(p => ({ ...p, wechat_or_whatsapp: e.target.value }))} placeholder="+86 123 456 7890" className={inputCls} />
                </div>

                {/* Website */}
                <div className="col-span-2">
                  <label className={labelCls}>Website</label>
                  <input type="text" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="www.supplier.com" className={inputCls} />
                </div>

                {/* Industry Tags */}
                <div className="col-span-2">
                  <label className={labelCls}>Industry / Tags</label>
                  <TagInput tags={form.tags} onChange={v => setForm(p => ({ ...p, tags: v }))} />
                  <p className="text-xs text-bgray-400 mt-1">Press Enter or comma to add. Used to identify what this supplier specializes in.</p>
                </div>
              </div>
            </div>
          ) : activeTab === "documents" ? (
            <SupplierDocumentsTab supplierId={supplier.id} />
          ) : (
            <SupplierProductsTab supplierId={supplier.id} />
          )}
        </div>

        {/* Footer - only show for details tab */}
        {activeTab === "details" && (
          <div className="flex items-center justify-between p-6 border-t border-bgray-200 dark:border-darkblack-400">
            <div>
              {!isNew && (
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || busy}
                className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {busy ? "Saving..." : isNew ? "Add Supplier" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalSupplier, setModalSupplier] = useState(undefined); // undefined = closed, null = new, obj = edit
  const [itemCounts, setItemCounts] = useState({}); // supplierId → count

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      setSuppliers(data || []);

      // Load item counts per supplier
      const { data: counts } = await supabase
        .from("quotation_items")
        .select("supplier_id")
        .not("supplier_id", "is", null);
      const countMap = {};
      (counts || []).forEach(row => {
        countMap[row.supplier_id] = (countMap[row.supplier_id] || 0) + 1;
      });
      setItemCounts(countMap);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const handleSaved = (supplier, action) => {
    if (action === "created") {
      setSuppliers(prev => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (action === "updated") {
      setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s));
    } else if (action === "deleted") {
      setSuppliers(prev => prev.filter(s => s.id !== supplier.id));
    }
    setModalSupplier(undefined);
  };

  const filtered = suppliers.filter(s =>
    !search || [s.name, s.email, s.sales_person, s.city, s.country, s.address].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Suppliers</h1>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">
            {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setModalSupplier(null)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Supplier
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, contact..."
          className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
        />
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{error}</div>}

      {/* Grid of supplier cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-bgray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-sm">Loading suppliers...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-bgray-100 dark:bg-darkblack-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-bgray-500 dark:text-bgray-400 text-sm">
            {suppliers.length === 0 ? "No suppliers yet. Add your first supplier." : "No suppliers match your search."}
          </p>
          {suppliers.length === 0 && (
            <button
              onClick={() => setModalSupplier(null)}
              className="mt-4 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
            >
              Add First Supplier
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => setModalSupplier(s)}
              className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 p-5 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
            >
              {/* Avatar */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: `hsl(${s.name.charCodeAt(0) * 7 % 360}, 60%, 45%)` }}
                >
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                {itemCounts[s.id] > 0 && (
                  <span className="text-xs bg-bgray-100 dark:bg-darkblack-500 text-bgray-500 dark:text-bgray-400 px-2 py-0.5 rounded-full">
                    {itemCounts[s.id]} item{itemCounts[s.id] !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Name */}
              <h3 className="font-semibold text-darkblack-700 dark:text-white text-sm mb-1 group-hover:text-primary transition-colors line-clamp-2">
                {s.name}
              </h3>

              {/* Details */}
              <div className="space-y-1.5 mt-3">
                {s.sales_person && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">{s.sales_person}</span>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{s.email}</span>
                  </div>
                )}
                {s.wechat_or_whatsapp && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="truncate">{s.wechat_or_whatsapp}</span>
                  </div>
                )}
                {s.website && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                    </svg>
                    <span className="truncate">{s.website}</span>
                  </div>
                )}
                {(s.city || s.country) && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{[s.city, s.country].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>

              {/* Industry tags */}
              {s.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {s.tags.slice(0, 3).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">{t}</span>
                  ))}
                  {s.tags.length > 3 && (
                    <span className="px-2 py-0.5 bg-bgray-100 dark:bg-darkblack-500 text-bgray-500 text-xs rounded-full">+{s.tags.length - 3}</span>
                  )}
                </div>
              )}

              {/* Edit hint */}
              <div className="mt-4 pt-3 border-t border-bgray-100 dark:border-darkblack-400 flex items-center justify-end">
                <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      {modalSupplier !== undefined && (
        <SupplierDrawer
          supplier={modalSupplier}
          onClose={() => setModalSupplier(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
