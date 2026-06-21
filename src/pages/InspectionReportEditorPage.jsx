import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import RichTextEditor from "../components/RichTextEditor";

// ─── Block defaults ──────────────────────────────────────────────────────────
const BLOCK_DEFAULTS = {
  cover: {
    inspector_name: "",
    visit_date: "",
    project_id: null,
    project_name: "",
    client_id: null,
    client_name: "",
    supplier_id: null,
    supplier_name: "",
    supplier_address: "",
    po_number: "",
    country: "",
    report_type: "",
    attached_docs: [],
  },
  text: { title: "Overview", content: "" },
  gallery: { title: "Photos", images: [] },
  image: { url: "", caption: "" },
  checklist: { title: "Checklist", items: [{ label: "", status: "ok", comment: "" }] },
  table: {
    title: "",
    headers: ["Item", "Expected", "Found", "Result", "Notes"],
    rows: [["", "", "", "", ""], ["", "", "", "", ""]],
  },
  defects: {
    title: "Defects Found",
    items: [{ photo_url: "", item_name: "", condition: "good", qty_inspected: "", comment: "" }],
  },
  scoring: {
    title: "Quality Scoring",
    categories: [
      { label: "Documentation", score: null, notes: "" },
      { label: "Facilities", score: null, notes: "" },
      { label: "Production", score: null, notes: "" },
      { label: "Product Quality", score: null, notes: "" },
      { label: "Packaging", score: null, notes: "" },
      { label: "Communication", score: null, notes: "" },
    ],
  },
  conclusion: {
    summary: "",
    positives: "",
    risks: "",
    recommendations: "",
    action: "proceed",
  },
};

const BLOCK_LABELS = {
  cover: "Cover Info",
  text: "Text Block",
  gallery: "Photo Gallery",
  image: "Single Image",
  checklist: "Checklist",
  table: "Table",
  defects: "Defects Log",
  scoring: "Scoring",
  conclusion: "Conclusion",
};

const BLOCK_ICONS = {
  cover: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  ),
  text: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 6h16M4 10h16M4 14h10" />
  ),
  gallery: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4-4 3 3 4-5 5 6" />
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
    </>
  ),
  image: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  ),
  checklist: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  ),
  table: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 10h18M3 14h18M10 3v18" />
  ),
  defects: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  ),
  scoring: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  ),
  conclusion: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-600" },
  { value: "approved", label: "Approved", color: "bg-green-100 text-green-700" },
  { value: "approved_with_observations", label: "Approved w. Obs.", color: "bg-yellow-100 text-yellow-700" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

// ─── Upload helper ────────────────────────────────────────────────────────────
const uploadFile = async (file, prefix) => {
  const ext = file.name.split(".").pop();
  const path = `${prefix}-${Date.now()}.${ext}`;
  await supabase.storage.from("report-images").upload(path, file, { upsert: true });
  return supabase.storage.from("report-images").getPublicUrl(path).data.publicUrl;
};

// ─── Upload dropzone ──────────────────────────────────────────────────────────
function UploadDropzone({ onFiles, uploading, multiple, children }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      const files = Array.from(e.clipboardData?.items || [])
        .filter((it) => it.type.startsWith("image/"))
        .map((it) => it.getAsFile());
      if (files.length) onFiles(multiple ? files : [files[0]]);
    };
    window.addEventListener("paste", fn);
    return () => window.removeEventListener("paste", fn);
  }, [onFiles, multiple]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (files.length) onFiles(multiple ? files : [files[0]]);
      }}
      onClick={() => !uploading && fileRef.current?.click()}
      className={`w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
        ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-400 hover:text-blue-500 text-gray-400"}
        ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => onFiles(multiple ? Array.from(e.target.files) : [e.target.files[0]])}
      />
      {dragOver && <p className="text-xs text-blue-500 font-medium">Drop image here</p>}
      {!dragOver && <p className="text-xs text-gray-400">Paste · Drag & drop · Click to browse</p>}
    </div>
  );
}

// ─── Block editors ────────────────────────────────────────────────────────────

function EntityCombobox({ value, placeholder, items, labelKey, onSelect, onClear, onCreateNew, renderItem }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = query
    ? items.filter(it => it[labelKey]?.toLowerCase().includes(query.toLowerCase()))
    : items;

  const showCreate = !!onCreateNew && query.trim().length > 0;
  const showDropdown = open && (filtered.length > 0 || showCreate);

  return (
    <div className="relative" ref={ref}>
      <div className="flex gap-1">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value) onClear?.(); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        />
        {value && (
          <button type="button" onClick={() => { setQuery(""); onClear?.(); }} className="px-2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      {showDropdown && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-auto">
          {filtered.map((it, i) => (
            <li
              key={it.id ?? i}
              onMouseDown={() => { onSelect(it); setQuery(it[labelKey]); setOpen(false); }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 text-gray-700"
            >
              {renderItem ? renderItem(it) : (it._label ?? it[labelKey])}
            </li>
          ))}
          {showCreate && (
            <li
              onMouseDown={() => { onCreateNew(query.trim()); setOpen(false); }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-blue-600 font-medium border-t border-gray-100 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create &ldquo;{query.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

const COUNTRIES = [
  "China", "Vietnam", "Bangladesh", "India", "Indonesia", "Cambodia", "Pakistan",
  "Thailand", "Myanmar", "Sri Lanka", "Philippines", "Malaysia", "South Korea",
  "Japan", "Taiwan", "Hong Kong", "Turkey", "Egypt", "Ethiopia", "Morocco",
  "Colombia", "Mexico", "Brazil", "Peru", "United States", "United Kingdom",
  "Germany", "France", "Spain", "Italy", "Netherlands", "Portugal", "Other",
];

function SupplierComboboxCover({ value, onSelect, onChangeText }) {
  const [suppliers, setSuppliers] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const ref = useRef(null);

  useEffect(() => {
    supabase.from("suppliers").select("id,name,address").order("name")
      .then(({ data }) => setSuppliers(data || []));
  }, []);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query
    ? suppliers.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : suppliers;

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChangeText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Supplier Name"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
          {filtered.map(s => (
            <li
              key={s.id}
              onMouseDown={() => { onSelect(s); setQuery(s.name); setOpen(false); }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 text-gray-700"
            >
              <div className="font-medium">{s.name}</div>
              {s.address && <div className="text-xs text-gray-400 truncate">{s.address}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DOC_TYPE_LABELS = {
  catalog: "Catalog", quotation: "Quotation", contract: "Contract",
  certificate: "Certificate", product_sheet: "Product Sheet", other: "Other",
};

function CoverBlockEditor({ block, onChange }) {
  const c = block.content;
  const set = (key, val) => onChange({ ...c, [key]: val });
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierDocs, setSupplierDocs] = useState([]);
  const [creating, setCreating] = useState(null); // 'client' | 'supplier'

  useEffect(() => {
    supabase.from("v_tracks_overview").select("track_id,track_name,client_name").order("track_name")
      .then(({ data }) => setProjects((data || [])
        .filter(p => !p.track_name?.startsWith("[CANCELLED]"))
        .map(p => ({ ...p, id: p.track_id, _label: p.track_name }))));
    supabase.from("clients").select("id,company_name").order("company_name")
      .then(({ data }) => setClients((data || []).map(cl => ({ ...cl, _label: cl.company_name }))));
    supabase.from("suppliers").select("id,name,address").order("name")
      .then(({ data }) => setSuppliers((data || []).map(s => ({ ...s, _label: s.name }))));
  }, []);

  useEffect(() => {
    if (!c.supplier_id) { setSupplierDocs([]); return; }
    supabase.from("supplier_documents")
      .select("id,name,document_type,file_url,file_name,validity_date")
      .eq("supplier_id", c.supplier_id).order("name")
      .then(({ data }) => setSupplierDocs(data || []));
  }, [c.supplier_id]);

  const handleProjectSelect = (p) => {
    onChange({ ...c, project_id: p.track_id, project_name: p.track_name, client_name: p.client_name || c.client_name });
  };

  const handleClientSelect = (cl) => {
    onChange({ ...c, client_id: cl.id, client_name: cl.company_name });
  };

  const handleSupplierSelect = (s) => {
    onChange({ ...c, supplier_id: s.id, supplier_name: s.name, supplier_address: s.address || c.supplier_address, attached_docs: [] });
  };

  const handleCreateClient = async (name) => {
    setCreating("client");
    const { data, error } = await supabase.from("clients").insert({ company_name: name }).select().single();
    setCreating(null);
    if (error) { alert(error.message); return; }
    const cl = { ...data, _label: data.company_name };
    setClients(prev => [...prev, cl].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    handleClientSelect(cl);
  };

  const handleCreateSupplier = async (name) => {
    setCreating("supplier");
    const { data, error } = await supabase.from("suppliers").insert({ name }).select().single();
    setCreating(null);
    if (error) { alert(error.message); return; }
    const s = { ...data, _label: data.name };
    setSuppliers(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
    handleSupplierSelect(s);
  };

  const toggleDoc = (doc) => {
    const current = c.attached_docs || [];
    const exists = current.find(d => d.id === doc.id);
    const next = exists
      ? current.filter(d => d.id !== doc.id)
      : [...current, { id: doc.id, name: doc.name, document_type: doc.document_type, file_url: doc.file_url, file_name: doc.file_name, validity_date: doc.validity_date }];
    set("attached_docs", next);
  };

  const isAttached = (id) => (c.attached_docs || []).some(d => d.id === id);

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent";

  return (
    <div className="space-y-4">
      {/* ── Report Info ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Report Info</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Project</label>
            <EntityCombobox
              value={c.project_name || ""}
              placeholder="Search project…"
              items={projects}
              labelKey="track_name"
              onSelect={handleProjectSelect}
              onClear={() => onChange({ ...c, project_id: null, project_name: "" })}
              renderItem={p => (
                <div>
                  <div className="font-medium text-gray-700">{p.track_name}</div>
                  {p.client_name && <div className="text-xs text-gray-400">{p.client_name}</div>}
                </div>
              )}
              onCreateNew={() => navigate("/projects")}
            />
            {projects.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                No projects yet —{" "}
                <button type="button" onClick={() => navigate("/projects")} className="text-blue-500 hover:underline">create one</button>
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Report Type</label>
            <input type="text" value={c.report_type || ""} onChange={e => set("report_type", e.target.value)} placeholder="e.g. Pre-shipment" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Inspector Name</label>
            <input type="text" value={c.inspector_name || ""} onChange={e => set("inspector_name", e.target.value)} placeholder="Inspector Name" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Visit Date</label>
            <input type="date" value={c.visit_date || ""} onChange={e => set("visit_date", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">PO Number</label>
            <input type="text" value={c.po_number || ""} onChange={e => set("po_number", e.target.value)} placeholder="PO Number" className={inputCls} />
          </div>
        </div>
      </div>

      {/* ── Client ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
          Client {creating === "client" && <span className="font-normal normal-case text-blue-400 ml-1">creating…</span>}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Client</label>
            <EntityCombobox
              value={c.client_name || ""}
              placeholder="Search or create client…"
              items={clients}
              labelKey="company_name"
              onSelect={handleClientSelect}
              onClear={() => onChange({ ...c, client_id: null, client_name: "" })}
              onCreateNew={handleCreateClient}
            />
          </div>
        </div>
      </div>

      {/* ── Supplier ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
          Supplier {creating === "supplier" && <span className="font-normal normal-case text-blue-400 ml-1">creating…</span>}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Supplier Name</label>
            <EntityCombobox
              value={c.supplier_name || ""}
              placeholder="Search or create supplier…"
              items={suppliers}
              labelKey="name"
              onSelect={handleSupplierSelect}
              onClear={() => onChange({ ...c, supplier_id: null, supplier_name: "", supplier_address: "", attached_docs: [] })}
              onCreateNew={handleCreateSupplier}
              renderItem={s => (
                <div>
                  <div className="font-medium text-gray-700">{s.name}</div>
                  {s.address && <div className="text-xs text-gray-400 truncate">{s.address}</div>}
                </div>
              )}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Supplier Address</label>
            <input type="text" value={c.supplier_address || ""} onChange={e => set("supplier_address", e.target.value)} placeholder="Supplier Address" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Country</label>
            <select value={c.country || ""} onChange={e => set("country", e.target.value)} className={inputCls + " bg-white"}>
              <option value="">— Select country —</option>
              {COUNTRIES.map(co => <option key={co} value={co}>{co}</option>)}
            </select>
          </div>
        </div>

        {/* Supplier documents picker */}
        {c.supplier_id && (
          <div className="mt-3 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Supplier Documents
              {supplierDocs.length === 0 && <span className="font-normal normal-case ml-1 text-gray-400">— none uploaded yet</span>}
            </p>
            {supplierDocs.length > 0 && (
              <div className="space-y-1.5">
                {supplierDocs.map(doc => (
                  <label key={doc.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={isAttached(doc.id)} onChange={() => toggleDoc(doc)} className="rounded border-gray-300 text-blue-500 focus:ring-blue-400" />
                    <span className="text-sm text-gray-700 group-hover:text-blue-600 flex-1 truncate">{doc.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</span>
                    {doc.validity_date && <span className="text-xs text-gray-400 shrink-0">exp. {doc.validity_date}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SingleImageBlockEditor({ block, onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (files) => {
    const file = files[0];
    if (!file?.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, "img");
      onChange({ ...block.content, url });
    } finally {
      setUploading(false);
    }
  }, [block.content, onChange]);

  return (
    <div className="space-y-3">
      {block.content.url ? (
        <div className="relative group">
          <img
            src={block.content.url}
            alt={block.content.caption || ""}
            className="w-full max-h-[480px] object-contain rounded-xl border border-gray-200 bg-gray-50"
          />
          <button
            onClick={() => onChange({ ...block.content, url: "" })}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          >✕</button>
        </div>
      ) : (
        <UploadDropzone onFiles={handleUpload} uploading={uploading} multiple={false}>
          <div className="py-12 flex flex-col items-center gap-2">
            {uploading ? (
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            <p className="text-sm text-gray-400">{uploading ? "Uploading…" : "Paste · Drag & drop · Click to browse"}</p>
          </div>
        </UploadDropzone>
      )}
      <input
        value={block.content.caption || ""}
        onChange={e => onChange({ ...block.content, caption: e.target.value })}
        placeholder="Caption (optional)"
        className="w-full text-sm text-gray-500 border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent"
      />
    </div>
  );
}

function TextBlockEditor({ block, onChange, language = "en" }) {
  const [retouching, setRetouching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [retouchError, setRetouchError] = useState("");
  const scanFileRef = useRef(null);

  const stripHtml = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  const handleRetouch = async () => {
    const plainText = stripHtml(block.content.content || "").trim();
    if (!plainText) return;
    setRetouching(true);
    setRetouchError("");
    try {
      const res = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "retouch", text: plainText, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (data.content) {
        const html = data.content
          .replace(/\\n/g, "\n")
          .split(/\n{2,}/)
          .map((p) =>
            `<p>${p
              .replace(/\n/g, "<br>")
              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
              .replace(/\*(.*?)\*/g, "<em>$1</em>")}</p>`
          )
          .join("");
        onChange({ ...block.content, content: html });
      }
    } catch (e) {
      setRetouchError(e.message);
    } finally {
      setRetouching(false);
    }
  };

  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setRetouchError("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise((res, rej) => {
        reader.onload = (ev) => res(ev.target.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const apiRes = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "extract", image: base64, mimeType: file.type }),
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data.error || `Error ${apiRes.status}`);
      if (data.content) {
        const lines = data.content.replace(/\\n/g, "\n").split("\n");
        const html = lines
          .map(l => l.trim())
          .filter(l => l)
          .map(l => `<p>${l}</p>`)
          .join("");
        onChange({
          ...block.content,
          title: data.title || block.content.title,
          content: (block.content.content ? block.content.content + html : html),
        });
      }
    } catch (e) {
      setRetouchError(e.message);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input
          value={block.content.title}
          onChange={(e) => onChange({ ...block.content, title: e.target.value })}
          placeholder="Section title"
          className="flex-1 text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          {/* AI Scan */}
          <input
            ref={scanFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleScanFile}
          />
          <button
            onClick={() => scanFileRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 transition"
            title="Scan image / catalog page"
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
          {/* Retouch */}
          <button
            onClick={handleRetouch}
            disabled={retouching || !stripHtml(block.content.content || "").trim()}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-purple-400 hover:text-purple-600 disabled:opacity-40 transition"
          >
            {retouching ? (
              <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
            {retouching ? "Retouching…" : "Retouch"}
          </button>
        </div>
      </div>
      {retouchError && <p className="text-xs text-red-500">{retouchError}</p>}
      <RichTextEditor
        content={block.content.content}
        onChange={(val) => onChange({ ...block.content, content: val })}
      />
    </div>
  );
}

const GALLERY_TEMPLATES = [
  { id: "g1", label: "1 col",   cols: 1 },
  { id: "g2", label: "2 col",   cols: 2 },
  { id: "g3", label: "3 col",   cols: 3 },
  { id: "g4", label: "4 col",   cols: 4 },
];

function GalleryBlockEditor({ block, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOverIdx] = useState(null);
  const images = block.content.images || [];
  const template = block.content.template || "g3";
  const cols = GALLERY_TEMPLATES.find(t => t.id === template)?.cols || 3;

  const handleUpload = useCallback(async (files) => {
    setUploading(true);
    try {
      const newImgs = [];
      for (const file of files) {
        if (!file?.type.startsWith("image/")) continue;
        const url = await uploadFile(file, "gallery");
        newImgs.push({ url, caption: "", featured: false });
      }
      onChange({ ...block.content, images: [...images, ...newImgs] });
    } finally {
      setUploading(false);
    }
  }, [block.content, images, onChange]);

  const updateImage = (i, patch) => {
    const next = images.map((img, idx) => idx === i ? { ...img, ...patch } : img);
    onChange({ ...block.content, images: next });
  };

  const removeImage = (i) =>
    onChange({ ...block.content, images: images.filter((_, idx) => idx !== i) });

  const handleDrop = (dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...images];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropIdx, 0, moved);
    onChange({ ...block.content, images: next });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const gridCls = `grid gap-3 grid-cols-${cols}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          value={block.content.title}
          onChange={(e) => onChange({ ...block.content, title: e.target.value })}
          placeholder="Gallery title"
          className="flex-1 text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
        />
        {/* Template picker */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 shrink-0">
          {GALLERY_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => onChange({ ...block.content, template: t.id })}
              className={`px-2 py-1 text-xs font-medium rounded-md transition ${template === t.id ? "bg-white shadow text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={gridCls}>
        {images.map((img, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            className={`relative group rounded-xl transition-all ${dragOver === i && dragIdx !== i ? "ring-2 ring-blue-400 scale-[1.02]" : ""} ${img.featured ? "col-span-2" : ""}`}
          >
            {/* Drag handle */}
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing z-10">
              <div className="bg-black/50 text-white rounded px-1.5 py-0.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 6h2v2H8V6zm0 4h2v2H8v-2zm0 4h2v2H8v-2zm6-8h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                </svg>
              </div>
            </div>
            {/* Featured toggle */}
            <button
              onClick={() => updateImage(i, { featured: !img.featured })}
              className={`absolute top-1 right-6 opacity-0 group-hover:opacity-100 transition z-10 rounded px-1.5 py-0.5 text-[10px] font-bold ${img.featured ? "bg-blue-500 text-white" : "bg-black/50 text-white"}`}
              title="Toggle featured (double width)"
            >★</button>
            {/* Delete */}
            <button
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
            >✕</button>
            <img
              src={img.url}
              alt=""
              className="w-full h-28 object-cover rounded-xl border border-gray-200"
            />
            <input
              value={img.caption || ""}
              onChange={(e) => updateImage(i, { caption: e.target.value })}
              placeholder="Caption…"
              className="mt-1 w-full text-xs border-0 border-b border-gray-200 outline-none bg-transparent text-gray-500 pb-0.5"
            />
          </div>
        ))}
        <UploadDropzone onFiles={handleUpload} uploading={uploading} multiple={true}>
          <div className="py-6 flex flex-col items-center gap-1">
            {uploading ? (
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
            <span className="text-xs">{uploading ? "Uploading…" : "Add photos"}</span>
          </div>
        </UploadDropzone>
      </div>
    </div>
  );
}

const STATUS_CYCLE = { ok: "fail", fail: "na", na: "ok" };
const STATUS_STYLES = {
  ok:   { label: "OK",   cls: "bg-green-100 text-green-700 border-green-300" },
  fail: { label: "FAIL", cls: "bg-red-100 text-red-700 border-red-300" },
  na:   { label: "N/A",  cls: "bg-gray-100 text-gray-500 border-gray-300" },
};

function ChecklistBlockEditor({ block, onChange }) {
  const items = block.content.items || [];

  const updateItem = (i, field, val) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [field]: val } : it));
    onChange({ ...block.content, items: next });
  };
  const cycleStatus = (i) =>
    updateItem(i, "status", STATUS_CYCLE[items[i].status] || "ok");
  const addItem = () =>
    onChange({ ...block.content, items: [...items, { label: "", status: "ok", comment: "" }] });
  const removeItem = (i) =>
    onChange({ ...block.content, items: items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <input
        value={block.content.title}
        onChange={(e) => onChange({ ...block.content, title: e.target.value })}
        placeholder="Checklist title"
        className="w-full text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
      />
      <div className="space-y-2">
        {items.map((item, i) => {
          const st = STATUS_STYLES[item.status] || STATUS_STYLES.na;
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                value={item.label}
                onChange={(e) => updateItem(i, "label", e.target.value)}
                placeholder="Checklist item…"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-0"
              />
              <button
                onClick={() => cycleStatus(i)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${st.cls}`}
              >
                {st.label}
              </button>
              <input
                value={item.comment}
                onChange={(e) => updateItem(i, "comment", e.target.value)}
                placeholder="Comment…"
                className="w-40 shrink-0 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <button
                onClick={() => removeItem(i)}
                className="shrink-0 text-gray-300 hover:text-red-400 transition text-xs"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={addItem}
        className="text-xs text-blue-500 hover:text-blue-700 font-medium"
      >
        + Add item
      </button>
    </div>
  );
}

function TableBlockEditor({ block, onChange }) {
  const headers = block.content.headers || [];
  const rows = block.content.rows || [];
  const colCount = headers.length;
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const scanFileRef = useRef(null);
  const containerRef = useRef(null);

  const updateHeader = (ci, val) => {
    const next = headers.map((h, idx) => (idx === ci ? val : h));
    onChange({ ...block.content, headers: next });
  };
  const updateCell = (ri, ci, val) => {
    const next = rows.map((row, idx) =>
      idx === ri ? row.map((cell, cIdx) => (cIdx === ci ? val : cell)) : row
    );
    onChange({ ...block.content, rows: next });
  };
  const addRow = () =>
    onChange({ ...block.content, rows: [...rows, Array(colCount).fill("")] });
  const removeRow = (ri) =>
    onChange({ ...block.content, rows: rows.filter((_, idx) => idx !== ri) });
  const addColumn = () => {
    onChange({
      ...block.content,
      headers: [...headers, "Column"],
      rows: rows.map(r => [...r, ""]),
    });
  };
  const removeColumn = (ci) => {
    onChange({
      ...block.content,
      headers: headers.filter((_, i) => i !== ci),
      rows: rows.map(r => r.filter((_, i) => i !== ci)),
    });
  };

  const runScan = async (file) => {
    if (!file?.type.startsWith("image/")) return;
    setScanning(true);
    setScanError("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise((res, rej) => {
        reader.onload = (ev) => res(ev.target.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const apiRes = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "table", image: base64, mimeType: file.type }),
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data.error || `Error ${apiRes.status}`);
      onChange({
        ...block.content,
        title: data.title || block.content.title,
        headers: data.headers || headers,
        rows: data.rows || rows,
      });
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

  // Ctrl+V paste image anywhere inside the block
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(it => it.type.startsWith("image/"));
      if (!imgItem) return;
      e.preventDefault();
      runScan(imgItem.getAsFile());
    };
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.content, headers, rows, onChange]);

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center gap-2">
        <input
          value={block.content.title}
          onChange={(e) => onChange({ ...block.content, title: e.target.value })}
          placeholder="Table title"
          className="flex-1 text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
        />
        <input ref={scanFileRef} type="file" accept="image/*" className="hidden" onChange={handleScanFile} />
        <button
          onClick={() => scanFileRef.current?.click()}
          disabled={scanning}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 transition"
          title="Scan image to auto-fill table — or Ctrl+V to paste"
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
      </div>
      {scanError && <p className="text-xs text-red-500">{scanError}</p>}
      {scanning && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-600">
          <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block shrink-0" />
          Analyzing image and building table…
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse text-sm min-w-[500px]">
          <thead>
            <tr className="bg-gray-50">
              {headers.map((h, ci) => (
                <th key={ci} className="border-b border-r border-gray-200 last:border-r-0 p-0 min-w-[120px]">
                  <div className="flex items-center">
                    <input
                      value={h}
                      onChange={(e) => updateHeader(ci, e.target.value)}
                      className="flex-1 px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-transparent outline-none text-center"
                    />
                    {headers.length > 1 && (
                      <button
                        onClick={() => removeColumn(ci)}
                        className="text-gray-300 hover:text-red-400 transition text-xs pr-1.5"
                        title="Remove column"
                      >✕</button>
                    )}
                  </div>
                </th>
              ))}
              <th className="border-b border-r border-gray-200 bg-gray-50 w-8">
                <button
                  onClick={addColumn}
                  className="w-full h-full text-gray-400 hover:text-blue-500 transition text-base font-bold px-2 py-2.5"
                  title="Add column"
                >+</button>
              </th>
              <th className="border-b border-gray-200 bg-gray-50 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-r border-gray-100 last:border-r-0 p-0">
                    <textarea
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm text-gray-700 bg-transparent outline-none resize-none focus:bg-blue-50/40 transition leading-snug"
                    />
                  </td>
                ))}
                <td className="border-b border-r border-gray-100 w-8" />
                <td className="border-b border-gray-100 w-8 text-center align-middle">
                  <button
                    onClick={() => removeRow(ri)}
                    className="text-gray-300 hover:text-red-400 transition text-xs"
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="text-xs text-blue-500 hover:text-blue-700 font-medium"
      >
        + Add row
      </button>
    </div>
  );
}

const CONDITION_STYLES = {
  good:        "bg-green-50 text-green-700 border-green-200",
  regular:     "bg-yellow-50 text-yellow-700 border-yellow-200",
  defects:     "bg-orange-50 text-orange-700 border-orange-200",
  not_suitable:"bg-red-50 text-red-700 border-red-200",
};

const CONDITION_LABELS = {
  good:        "Good Condition",
  regular:     "Regular",
  defects:     "Defects Found",
  not_suitable:"Not Suitable for Dispatch",
};

function DefectsBlockEditor({ block, onChange, language = "en" }) {
  const [uploading, setUploading] = useState({});
  const [retouchingIdx, setRetouchingIdx] = useState(null);
  const items = block.content.items || [];

  const updateItem = (i, field, val) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [field]: val } : it));
    onChange({ ...block.content, items: next });
  };

  const handleRetouchComment = async (i) => {
    const text = (items[i].comment || items[i].recommendation || "").trim();
    if (!text) return;
    setRetouchingIdx(i);
    try {
      const res = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "retouch", text, language }),
      });
      const data = await res.json();
      if (data.content) {
        const plain = data.content.replace(/\\n/g, " ").replace(/\n/g, " ").trim();
        updateItem(i, "comment", plain);
      }
    } catch {
      // silently ignore
    } finally {
      setRetouchingIdx(null);
    }
  };

  const handlePhotoUpload = useCallback(async (i, files) => {
    const file = files[0];
    if (!file?.type.startsWith("image/")) return;
    setUploading((prev) => ({ ...prev, [i]: true }));
    try {
      const url = await uploadFile(file, `defect-${i}`);
      updateItem(i, "photo_url", url);
    } finally {
      setUploading((prev) => ({ ...prev, [i]: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, block.content, onChange]);

  const addItem = () =>
    onChange({
      ...block.content,
      items: [
        ...items,
        { photo_url: "", item_name: "", condition: "good", qty_inspected: "", comment: "" },
      ],
    });
  const removeItem = (i) =>
    onChange({ ...block.content, items: items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <input
        value={block.content.title}
        onChange={(e) => onChange({ ...block.content, title: e.target.value })}
        placeholder="Block title"
        className="w-full text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
      />
      {items.map((item, i) => {
        const condStyle = CONDITION_STYLES[item.condition] || "bg-gray-50 text-gray-700 border-gray-200";
        return (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden relative">
            <button
              onClick={() => removeItem(i)}
              className="absolute top-2 right-2 text-gray-300 hover:text-red-400 transition text-xs z-10"
            >
              ✕
            </button>
            <div className="flex">
              {/* Photo column */}
              <div className="shrink-0 w-28 bg-gray-50 border-r border-gray-100">
                {item.photo_url ? (
                  <div className="relative group h-full min-h-[96px]">
                    <img
                      src={item.photo_url}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ minHeight: "96px" }}
                    />
                    <button
                      onClick={() => updateItem(i, "photo_url", "")}
                      className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <UploadDropzone
                    onFiles={(files) => handlePhotoUpload(i, files)}
                    uploading={!!uploading[i]}
                    multiple={false}
                  >
                    <div className="w-full h-full min-h-[96px] flex flex-col items-center justify-center gap-1 text-gray-300">
                      {uploading[i] ? (
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      <span className="text-[10px] text-center leading-tight px-1">
                        {uploading[i] ? "Uploading…" : "Add Photo"}
                      </span>
                    </div>
                  </UploadDropzone>
                )}
              </div>
              {/* Fields */}
              <div className="flex-1 p-3 grid grid-cols-2 gap-2 min-w-0">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-400 mb-0.5 block">Item / Name</label>
                  <input
                    value={item.item_name ?? item.type ?? ""}
                    onChange={(e) => updateItem(i, "item_name", e.target.value)}
                    placeholder="Item number or name…"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-0.5 block">Condition</label>
                  <select
                    value={item.condition ?? item.severity ?? "good"}
                    onChange={(e) => updateItem(i, "condition", e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent ${condStyle}`}
                  >
                    <option value="good">Good Condition</option>
                    <option value="regular">Regular</option>
                    <option value="defects">Defects Found</option>
                    <option value="not_suitable">Not Suitable for Dispatch</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-0.5 block">Qty. Inspected</label>
                  <input
                    value={item.qty_inspected ?? item.quantity ?? ""}
                    onChange={(e) => updateItem(i, "qty_inspected", e.target.value)}
                    placeholder="e.g. 50 pcs"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] text-gray-400">Comment</label>
                    <button
                      type="button"
                      onClick={() => handleRetouchComment(i)}
                      disabled={retouchingIdx === i || !(item.comment || item.recommendation)}
                      title="Retouch with AI"
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-purple-600 disabled:opacity-30 transition"
                    >
                      {retouchingIdx === i ? (
                        <span className="w-2.5 h-2.5 border border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      )}
                      Retouch
                    </button>
                  </div>
                  <input
                    value={item.comment ?? item.recommendation ?? ""}
                    onChange={(e) => updateItem(i, "comment", e.target.value)}
                    placeholder="Observations or notes…"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <button
        onClick={addItem}
        className="text-xs text-blue-500 hover:text-blue-700 font-medium"
      >
        + Add item
      </button>
    </div>
  );
}

function getScoringResult(avg) {
  if (avg === null) return null;
  if (avg >= 85) return { label: "Approved", cls: "bg-green-100 text-green-700" };
  if (avg >= 70) return { label: "Approved w. Observations", cls: "bg-yellow-100 text-yellow-700" };
  if (avg >= 50) return { label: "Medium Risk", cls: "bg-orange-100 text-orange-700" };
  return { label: "Not Recommended", cls: "bg-red-100 text-red-700" };
}

function ScoringBlockEditor({ block, onChange }) {
  const categories = block.content.categories || [];

  const updateCategory = (i, field, val) => {
    const next = categories.map((cat, idx) =>
      idx === i ? { ...cat, [field]: val } : cat
    );
    onChange({ ...block.content, categories: next });
  };

  const scored = categories.filter((c) => c.score !== null && c.score !== "" && !isNaN(Number(c.score)));
  const total = scored.reduce((sum, c) => sum + Number(c.score), 0);
  const avg = scored.length > 0 ? Math.round((total / (scored.length * 10)) * 100) : null;
  const result = getScoringResult(avg);

  return (
    <div className="space-y-3">
      <input
        value={block.content.title}
        onChange={(e) => onChange({ ...block.content, title: e.target.value })}
        placeholder="Block title"
        className="w-full text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
      />
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_1fr_32px] bg-gray-50 px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide gap-2">
          <span>Category</span>
          <span className="text-center">Score /10</span>
          <span>Notes</span>
          <span />
        </div>
        {categories.map((cat, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_80px_1fr_32px] px-3 py-2 gap-2 border-t border-gray-100 items-center"
          >
            <input
              value={cat.label}
              onChange={(e) => updateCategory(i, "label", e.target.value)}
              className="text-sm border-0 outline-none bg-transparent text-gray-700 w-full"
            />
            <input
              type="number"
              min="0"
              max="10"
              value={cat.score ?? ""}
              onChange={(e) =>
                updateCategory(i, "score", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="—"
              className="w-full text-center text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <input
              value={cat.notes}
              onChange={(e) => updateCategory(i, "notes", e.target.value)}
              placeholder="Notes…"
              className="text-sm border-0 outline-none bg-transparent text-gray-500 w-full"
            />
            <button
              onClick={() =>
                onChange({
                  ...block.content,
                  categories: categories.filter((_, idx) => idx !== i),
                })
              }
              className="text-gray-300 hover:text-red-400 transition text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="px-3 py-2 border-t border-gray-100">
          <button
            onClick={() =>
              onChange({
                ...block.content,
                categories: [...categories, { label: "", score: null, notes: "" }],
              })
            }
            className="text-xs text-blue-500 hover:text-blue-700 font-medium"
          >
            + Add category
          </button>
        </div>
      </div>
      {avg !== null && result && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Overall Score</p>
            <p className="text-2xl font-bold text-gray-800 leading-none mt-0.5">{avg}%</p>
          </div>
          <span className={`ml-auto px-3 py-1.5 rounded-full text-sm font-semibold ${result.cls}`}>
            {result.label}
          </span>
        </div>
      )}
    </div>
  );
}

const ACTIONS = [
  { value: "proceed", label: "Proceed" },
  { value: "proceed_with_corrections", label: "Proceed with corrections" },
  { value: "reinspect", label: "Re-inspect" },
  { value: "reject", label: "Reject" },
];
const ACTION_ACTIVE = {
  proceed:                   "bg-green-500 text-white border-green-500",
  proceed_with_corrections:  "bg-yellow-500 text-white border-yellow-500",
  reinspect:                 "bg-orange-500 text-white border-orange-500",
  reject:                    "bg-red-500 text-white border-red-500",
};

function ConclusionBlockEditor({ block, onChange }) {
  const fields = [
    { key: "summary", label: "Summary", placeholder: "Overall summary of inspection findings…" },
    { key: "positives", label: "Positives", placeholder: "What was satisfactory…" },
    { key: "risks", label: "Risks", placeholder: "Issues or risks identified…" },
    { key: "recommendations", label: "Recommendations", placeholder: "Actions recommended…" },
  ];

  return (
    <div className="space-y-4">
      {fields.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="text-xs text-gray-400 mb-1 block font-medium">{label}</label>
          <textarea
            value={block.content[key] || ""}
            onChange={(e) => onChange({ ...block.content, [key]: e.target.value })}
            placeholder={placeholder}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
          />
        </div>
      ))}
      <div>
        <label className="text-xs text-gray-400 mb-2 block font-medium">Action</label>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => onChange({ ...block.content, action: a.value })}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                block.content.action === a.value
                  ? ACTION_ACTIVE[a.value]
                  : "border-gray-200 text-gray-500 hover:border-gray-400"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Block card ───────────────────────────────────────────────────────────────
function BlockCard({ block, index, total, onMoveUp, onMoveDown, onDelete, onChange, language }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-4 h-4 shrink-0 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {BLOCK_ICONS[block.type]}
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 shrink-0">
            {BLOCK_LABELS[block.type]}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-gray-300 hover:text-red-500 transition ml-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="p-4">
        {block.type === "cover"     && <CoverBlockEditor     block={block} onChange={(c) => onChange({ ...block, content: c })} />}
        {block.type === "text"      && <TextBlockEditor      block={block} onChange={(c) => onChange({ ...block, content: c })} language={language} />}
        {block.type === "gallery"   && <GalleryBlockEditor   block={block} onChange={(c) => onChange({ ...block, content: c })} />}
        {block.type === "image"     && <SingleImageBlockEditor block={block} onChange={(c) => onChange({ ...block, content: c })} />}
        {block.type === "checklist" && <ChecklistBlockEditor block={block} onChange={(c) => onChange({ ...block, content: c })} />}
        {block.type === "table"     && <TableBlockEditor     block={block} onChange={(c) => onChange({ ...block, content: c })} />}
        {block.type === "defects"   && <DefectsBlockEditor   block={block} onChange={(c) => onChange({ ...block, content: c })} language={language} />}
        {block.type === "scoring"   && <ScoringBlockEditor   block={block} onChange={(c) => onChange({ ...block, content: c })} />}
        {block.type === "conclusion" && <ConclusionBlockEditor block={block} onChange={(c) => onChange({ ...block, content: c })} />}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function InspectionReportEditorPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [report, setReport] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef(null);

  // Close add menu on outside click
  useEffect(() => {
    const fn = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target))
        setShowAddMenu(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // Load report + blocks
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("inspection_reports")
        .select("*")
        .eq("id", reportId)
        .single();

      if (existing) {
        setReport(existing);
        const { data: blks } = await supabase
          .from("report_blocks")
          .select("*")
          .eq("report_id", existing.id)
          .order("sort_order");
        setBlocks(
          (blks || []).map((b) => ({ ...b, _localId: Math.random().toString(36).slice(2) }))
        );
      } else {
        setSaveError(`Report not found (id: ${reportId})`);
      }
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Block management
  const addBlock = (type) => {
    setBlocks((prev) => [
      ...prev,
      {
        _localId: Math.random().toString(36).slice(2),
        id: null,
        report_id: report?.id,
        type,
        content: { ...BLOCK_DEFAULTS[type] },
        sort_order: prev.length,
      },
    ]);
    setShowAddMenu(false);
  };

  const updateBlock = (localId, updated) =>
    setBlocks((prev) => prev.map((b) => (b._localId === localId ? updated : b)));

  const deleteBlock = (localId) =>
    setBlocks((prev) => prev.filter((b) => b._localId !== localId));

  const moveBlock = (localId, dir) =>
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b._localId === localId);
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });

  // Save
  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    setSaveError("");
    try {
      const { error: updErr } = await supabase
        .from("inspection_reports")
        .update({ title: report.title, status: report.status, language: report.language || "en" })
        .eq("id", report.id);
      if (updErr) throw new Error(updErr.message);

      const { error: delErr } = await supabase
        .from("report_blocks")
        .delete()
        .eq("report_id", report.id);
      if (delErr) throw new Error(delErr.message);

      if (blocks.length > 0) {
        const { error: insErr } = await supabase.from("report_blocks").insert(
          blocks.map((b, i) => ({
            report_id: report.id,
            type: b.type,
            content: b.content,
            sort_order: i,
          }))
        );
        if (insErr) throw new Error(insErr.message);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === report?.status) || STATUS_OPTIONS[0];

  const openPreview = () => {
    if (report?.report_number) {
      window.open(`/r/${report.report_number}`, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading report editor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: back + title + status */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(location.state?.from || "/reports")}
              className="text-gray-400 hover:text-gray-600 transition shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Inspection Report</p>
              <p className="text-sm font-bold text-gray-800 truncate max-w-xs">{report?.title || "Untitled Report"}</p>
            </div>
            {/* Status dropdown */}
            <div className="relative shrink-0">
              <select
                value={report?.status || "draft"}
                onChange={(e) => setReport((r) => ({ ...r, status: e.target.value }))}
                className={`appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${currentStatus.color}`}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-current opacity-60"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Right: Language + Preview + Save */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Language toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {["en", "es"].map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setReport(r => ({ ...r, language: lang }))}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                    (report?.language || "en") === lang
                      ? "bg-white shadow text-gray-800"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            {report?.report_number && (
              <button
                onClick={openPreview}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="max-w-4xl mx-auto px-6 pb-3">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError}
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {/* Report meta card */}
        {report && (
          <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">
                Inspection Report
              </p>
              <input
                value={report.title || ""}
                onChange={e => setReport(r => ({ ...r, title: e.target.value }))}
                placeholder="Report title…"
                className="font-bold text-gray-800 text-base bg-transparent border-0 outline-none w-full focus:ring-2 focus:ring-blue-400 focus:bg-blue-50 rounded px-1 -mx-1 transition"
              />
            </div>
            {report.report_number && (
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Ref</p>
                <p className="font-bold text-blue-600 mt-0.5">{report.report_number}</p>
              </div>
            )}
          </div>
        )}

        {/* Blocks */}
        {blocks.map((block, i) => (
          <BlockCard
            key={block._localId}
            block={block}
            index={i}
            total={blocks.length}
            onMoveUp={() => moveBlock(block._localId, -1)}
            onMoveDown={() => moveBlock(block._localId, 1)}
            onDelete={() => deleteBlock(block._localId)}
            onChange={(updated) => updateBlock(block._localId, updated)}
            language={report?.language || "en"}
          />
        ))}

        {/* Add block */}
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu((v) => !v)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-medium text-gray-400 hover:border-blue-400 hover:text-blue-500 transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Block
          </button>
          {showAddMenu && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 flex flex-wrap gap-2 z-20 max-w-lg">
              {Object.keys(BLOCK_DEFAULTS).map((type) => (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl hover:bg-gray-50 transition min-w-[80px]"
                >
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {BLOCK_ICONS[type]}
                  </svg>
                  <span className="text-xs font-medium text-gray-600 text-center leading-tight">
                    {BLOCK_LABELS[type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {blocks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Add blocks above to build your inspection report.</p>
            <p className="text-xs mt-1">
              Tip: Start with a <strong>Cover Info</strong> block to set the inspection details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
