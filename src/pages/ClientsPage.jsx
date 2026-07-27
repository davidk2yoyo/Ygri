import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import ClientDocumentsTab from "../components/ClientDocumentsTab";
import AIClientScanner from "../components/AIClientScanner";
import CountrySelect from "../components/CountrySelect";

const EMPTY_CLIENT = {
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  rut_nit: "",
  website: "",
  tags: []
};

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
        placeholder={tags.length === 0 ? "e.g. retail, manufacturing, services…" : ""}
        className="flex-1 min-w-[140px] text-sm bg-transparent outline-none text-darkblack-700 dark:text-white placeholder-bgray-400"
      />
    </div>
  );
}

function ClientDrawer({ client, onClose, onSaved }) {
  const [form, setForm] = useState(client ? { ...client, tags: client.tags || [] } : { ...EMPTY_CLIENT });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [showScanner, setShowScanner] = useState(false);

  const isNew = !client?.id;

  const handleSave = async () => {
    if (!form.company_name.trim()) { setError("Company name is required."); return; }
    setBusy(true);
    setError("");
    try {
      if (isNew) {
        const { data, error } = await supabase.from("clients").insert(form).select().single();
        if (error) throw error;
        onSaved(data, "created");
      } else {
        const { data, error } = await supabase.from("clients").update(form).eq("id", client.id).select().single();
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
    if (!window.confirm(`Delete client "${client.company_name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", client.id);
      if (error) throw error;
      onSaved(client, "deleted");
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
            {isNew ? "New Client" : client.company_name}
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
              company_name: data.company_name || prev.company_name,
              contact_person: data.contact_person || prev.contact_person,
              email: data.email || prev.email,
              phone: data.phone || prev.phone,
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
                  <input type="text" value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} placeholder="Company Ltd." className={inputCls} />
                </div>

                {/* Contact Person */}
                <div>
                  <label className={labelCls}>Contact Person</label>
                  <input type="text" value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} placeholder="Full name" className={inputCls} />
                </div>

                {/* Email */}
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="contact@company.com" className={inputCls} />
                </div>

                {/* Phone */}
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 0123" className={inputCls} />
                </div>

                {/* Website */}
                <div>
                  <label className={labelCls}>Website</label>
                  <input type="text" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="www.company.com" className={inputCls} />
                </div>

                {/* RUT / NIT */}
                <div>
                  <label className={labelCls}>RUT / NIT</label>
                  <input type="text" value={form.rut_nit} onChange={e => setForm(p => ({ ...p, rut_nit: e.target.value }))} placeholder="Tax ID" className={inputCls} />
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
                  <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Bogotá" className={inputCls} />
                </div>

                {/* Industry Tags */}
                <div className="col-span-2">
                  <label className={labelCls}>Industry / Segment</label>
                  <TagInput tags={form.tags} onChange={v => setForm(p => ({ ...p, tags: v }))} />
                  <p className="text-xs text-bgray-400 mt-1">Press Enter or comma to add. Used to categorize client segment.</p>
                </div>
              </div>
            </div>
          ) : (
            <ClientDocumentsTab clientId={client.id} />
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
                disabled={!form.company_name.trim() || busy}
                className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {busy ? "Saving..." : isNew ? "Add Client" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalClient, setModalClient] = useState(undefined);
  const [orderCounts, setOrderCounts] = useState({});

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.from("clients").select("*").order("company_name");
      if (error) throw error;
      setClients(data || []);

      // Load order counts per client
      const { data: tracksData } = await supabase
        .from("tracks")
        .select("client_id");

      const countMap = {};
      (tracksData || []).forEach(row => {
        const cid = row.client_id;
        countMap[cid] = (countMap[cid] || 0) + 1;
      });
      setOrderCounts(countMap);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const handleSaved = (client, action) => {
    if (action === "created") {
      setClients(prev => [...prev, client].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    } else if (action === "updated") {
      setClients(prev => prev.map(c => c.id === client.id ? client : c));
    } else if (action === "deleted") {
      setClients(prev => prev.filter(c => c.id !== client.id));
    }
    setModalClient(undefined);
  };

  const filtered = clients.filter(c =>
    !search || [c.company_name, c.email, c.contact_person, c.city, c.country, c.rut_nit].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Clients</h1>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">
            {clients.length} client{clients.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setModalClient(null)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Client
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
          placeholder="Search by name, email, RUT..."
          className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
        />
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{error}</div>}

      {/* Grid of client cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-bgray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-sm">Loading clients...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-bgray-100 dark:bg-darkblack-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20a9 9 0 0118 0" />
            </svg>
          </div>
          <p className="text-bgray-500 dark:text-bgray-400 text-sm">
            {clients.length === 0 ? "No clients yet. Add your first client." : "No clients match your search."}
          </p>
          {clients.length === 0 && (
            <button
              onClick={() => setModalClient(null)}
              className="mt-4 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
            >
              Add First Client
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => setModalClient(c)}
              className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 p-5 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
            >
              {/* Avatar */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: `hsl(${c.company_name.charCodeAt(0) * 7 % 360}, 60%, 45%)` }}
                >
                  {c.company_name.slice(0, 2).toUpperCase()}
                </div>
                {orderCounts[c.id] > 0 && (
                  <span className="text-xs bg-bgray-100 dark:bg-darkblack-500 text-bgray-500 dark:text-bgray-400 px-2 py-0.5 rounded-full">
                    {orderCounts[c.id]} order{orderCounts[c.id] !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Name */}
              <h3 className="font-semibold text-darkblack-700 dark:text-white text-sm mb-1 group-hover:text-primary transition-colors line-clamp-2">
                {c.company_name}
              </h3>

              {/* Details */}
              <div className="space-y-1.5 mt-3">
                {c.contact_person && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">{c.contact_person}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 00.948.684l1.498 4.493a1 1 0 00.502.756l2.048 1.024a11.042 11.042 0 01-5.516 5.516l-1.024-2.048a1 1 0 00-.756-.502l-4.493-1.498a1 1 0 00-.684-.948V5z" />
                    </svg>
                    <span className="truncate">{c.phone}</span>
                  </div>
                )}
                {c.website && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                    </svg>
                    <span className="truncate">{c.website}</span>
                  </div>
                )}
                {c.rut_nit && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate">{c.rut_nit}</span>
                  </div>
                )}
                {(c.city || c.country) && (
                  <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{[c.city, c.country].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>

              {/* Industry tags */}
              {c.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {c.tags.slice(0, 3).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">{t}</span>
                  ))}
                  {c.tags.length > 3 && (
                    <span className="px-2 py-0.5 bg-bgray-100 dark:bg-darkblack-500 text-bgray-500 text-xs rounded-full">+{c.tags.length - 3}</span>
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
      {modalClient !== undefined && (
        <ClientDrawer
          client={modalClient}
          onClose={() => setModalClient(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
