import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// ─── AI helpers ────────────────────────────────────────────────────────────────
const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

async function aiScan(file, type) {
  const base64 = await toBase64(file);
  const res = await fetch("/api/ai-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mimeType: file.type, type }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Error ${res.status}`); }
  return res.json();
}

// ─── Block defaults ─────────────────────────────────────────────────────────
const BLOCK_DEFAULTS = {
  text:    { title: "Overview", content: "" },
  specs:   { title: "Technical Specifications", rows: [{ label: "", value: "" }] },
  images:  { title: "Product Photos", images: [] },
  diagram: { title: "Dimensions / Drawing", url: "", caption: "" },
};

const BLOCK_LABELS = { text: "Text Block", specs: "Specs Table", images: "Image Gallery", diagram: "Diagram / Drawing" };
const BLOCK_ICONS  = {
  text:    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10" />,
  specs:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 3v18" />,
  images:  <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4 3 3 4-5 5 6" /><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} /></>,
  diagram: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v10a2 2 0 01-2 2h-4M9 17v4m0 0h6m-6 0H7" />,
};

// ─── AI Scan modal ────────────────────────────────────────────────────────────
function AIScanModal({ type, onResult, onClose }) {
  const [step, setStep] = useState("pick");
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file?.type.startsWith("image/")) return;
    setStep("loading");
    try {
      const result = await aiScan(file, type);
      onResult(result);
      onClose();
    } catch (e) { setErrorMsg(e.message); setStep("error"); }
  }, [type, onResult, onClose]);

  useEffect(() => {
    if (step !== "pick") return;
    const fn = (e) => {
      for (const item of (e.clipboardData?.items || [])) {
        if (item.type.startsWith("image/")) { processFile(item.getAsFile()); break; }
      }
    };
    window.addEventListener("paste", fn);
    return () => window.removeEventListener("paste", fn);
  }, [step, processFile]);

  const label = type === "specs" ? "Extract specs from catalog / datasheet" : "Generate description from product photo";

  return (
    <div className="fixed inset-0 z-[10002] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-800">Scan with AI</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">
          {step === "pick" && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files?.[0]); }}
              className={`flex flex-col items-center gap-4 py-10 border-2 border-dashed rounded-2xl transition-all ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <span className="text-3xl">📄</span>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Paste, drop, or browse</p>
                <kbd className="mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded border border-gray-200">Ctrl + V</kbd>
              </div>
              <button onClick={() => fileRef.current?.click()} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition">Browse file</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => processFile(e.target.files?.[0])} />
            </div>
          )}
          {step === "loading" && (
            <div className="flex flex-col items-center py-12 gap-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Analyzing image…</p>
            </div>
          )}
          {step === "error" && (
            <div className="text-center py-10">
              <p className="text-2xl mb-2">❌</p>
              <p className="text-sm text-gray-600 mb-4">{errorMsg}</p>
              <button onClick={() => setStep("pick")} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Block editors ───────────────────────────────────────────────────────────
function TextBlockEditor({ block, onChange }) {
  const [scanning, setScanning] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <input
          value={block.content.title}
          onChange={e => onChange({ ...block.content, title: e.target.value })}
          placeholder="Section title"
          className="flex-1 text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
        />
        <button
          onClick={() => setScanning(true)}
          className="ml-3 flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition shrink-0"
        >
          Generate with AI
        </button>
      </div>
      <textarea
        value={block.content.content}
        onChange={e => onChange({ ...block.content, content: e.target.value })}
        rows={5}
        placeholder="Enter technical description here, or use 'Generate with AI' to scan a product image…"
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none leading-relaxed"
      />
      {scanning && (
        <AIScanModal
          type="description"
          onResult={result => onChange({ ...block.content, title: result.title || block.content.title, content: result.description || "" })}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function SpecsBlockEditor({ block, onChange }) {
  const [scanning, setScanning] = useState(false);
  const rows = block.content.rows || [];
  const updateRow = (i, field, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange({ ...block.content, rows: next });
  };
  const addRow = () => onChange({ ...block.content, rows: [...rows, { label: "", value: "" }] });
  const removeRow = (i) => onChange({ ...block.content, rows: rows.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <input
          value={block.content.title}
          onChange={e => onChange({ ...block.content, title: e.target.value })}
          placeholder="Table title"
          className="flex-1 text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
        />
        <button
          onClick={() => setScanning(true)}
          className="ml-3 flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition shrink-0"
        >
          Scan with AI
        </button>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_32px] bg-gray-50 px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide gap-2">
          <span>Parameter</span><span>Value</span><span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_32px] px-3 py-1.5 gap-2 border-t border-gray-100 items-center">
            <input value={row.label} onChange={e => updateRow(i, "label", e.target.value)} placeholder="e.g. Voltage" className="text-sm border-0 outline-none bg-transparent text-gray-700 w-full" />
            <input value={row.value} onChange={e => updateRow(i, "value", e.target.value)} placeholder="e.g. 24V DC" className="text-sm border-0 outline-none bg-transparent text-gray-700 w-full" />
            <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-400 transition text-xs">✕</button>
          </div>
        ))}
        <div className="px-3 py-2 border-t border-gray-100">
          <button onClick={addRow} className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ Add row</button>
        </div>
      </div>

      {scanning && (
        <AIScanModal
          type="specs"
          onResult={result => onChange({
            ...block.content,
            title: result.product_name ? `Specs — ${result.product_name}` : block.content.title,
            rows: result.rows || rows,
          })}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function ImagesBlockEditor({ block, onChange, annexId }) {
  const [uploading, setUploading] = useState(false);
  const images = block.content.images || [];
  const fileRef = useRef(null);

  const handleUpload = async (files) => {
    setUploading(true);
    try {
      const newImgs = [];
      for (const file of files) {
        const path = `${annexId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("annex-images").upload(path, file, { upsert: true });
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from("annex-images").getPublicUrl(path);
          newImgs.push({ url: publicUrl, caption: "" });
        }
      }
      onChange({ ...block.content, images: [...images, ...newImgs] });
    } finally { setUploading(false); }
  };

  const updateCaption = (i, val) => {
    const next = images.map((img, idx) => idx === i ? { ...img, caption: val } : img);
    onChange({ ...block.content, images: next });
  };
  const removeImage = (i) => onChange({ ...block.content, images: images.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <input
        value={block.content.title}
        onChange={e => onChange({ ...block.content, title: e.target.value })}
        placeholder="Gallery title"
        className="w-full text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
      />
      <div className="grid grid-cols-3 gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative group">
            <img src={img.url} alt="" className="w-full h-28 object-cover rounded-xl border border-gray-200" />
            <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">✕</button>
            <input
              value={img.caption}
              onChange={e => updateCaption(i, e.target.value)}
              placeholder="Caption…"
              className="mt-1 w-full text-xs border-0 border-b border-gray-200 outline-none bg-transparent text-gray-500 pb-0.5"
            />
          </div>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition disabled:opacity-50"
        >
          {uploading ? <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
            <span className="text-xs">Add photo</span>
          </>}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(Array.from(e.target.files))} />
    </div>
  );
}

function DiagramBlockEditor({ block, onChange, annexId }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const path = `${annexId}/diagram-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("annex-images").upload(path, file, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("annex-images").getPublicUrl(path);
        onChange({ ...block.content, url: publicUrl });
      }
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-3">
      <input
        value={block.content.title}
        onChange={e => onChange({ ...block.content, title: e.target.value })}
        placeholder="Diagram title"
        className="w-full text-base font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1 bg-transparent text-gray-800"
      />
      {block.content.url ? (
        <div className="relative group">
          <img src={block.content.url} alt="diagram" className="w-full rounded-xl border border-gray-200 object-contain max-h-80" />
          <button
            onClick={() => onChange({ ...block.content, url: "" })}
            className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition"
          >Remove</button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition disabled:opacity-50"
        >
          {uploading
            ? <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            : <>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span className="text-sm">Upload drawing or diagram</span>
              </>
          }
        </button>
      )}
      <input
        value={block.content.caption}
        onChange={e => onChange({ ...block.content, caption: e.target.value })}
        placeholder="Caption (optional)"
        className="w-full text-xs border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-0.5 bg-transparent text-gray-500"
      />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files[0])} />
    </div>
  );
}

// ─── Main block card ──────────────────────────────────────────────────────────
function BlockCard({ block, index, total, onMoveUp, onMoveDown, onDelete, onChange, annexId }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      {/* Block header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">{BLOCK_ICONS[block.type]}</svg>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{BLOCK_LABELS[block.type]}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={index === 0} className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button onClick={onDelete} className="p-1 rounded text-gray-300 hover:text-red-500 transition ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
      {/* Block content */}
      <div className="p-4">
        {block.type === "text"    && <TextBlockEditor   block={block} onChange={content => onChange({ ...block, content })} />}
        {block.type === "specs"   && <SpecsBlockEditor  block={block} onChange={content => onChange({ ...block, content })} />}
        {block.type === "images"  && <ImagesBlockEditor block={block} onChange={content => onChange({ ...block, content })} annexId={annexId} />}
        {block.type === "diagram" && <DiagramBlockEditor block={block} onChange={content => onChange({ ...block, content })} annexId={annexId} />}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function AnnexEditorPage() {
  const { quotationId } = useParams();
  const navigate = useNavigate();

  const [annex, setAnnex] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [saved, setSaved] = useState(false);
  const addMenuRef = useRef(null);

  // Close add menu on outside click
  useEffect(() => {
    const fn = (e) => { if (addMenuRef.current && !addMenuRef.current.contains(e.target)) setShowAddMenu(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load quotation info
      const { data: quot } = await supabase.from("quotations").select("id, quote_number, client_name, project_name, document_type").eq("id", quotationId).single();
      setQuotation(quot);

      // Check for existing annex
      const { data: existing } = await supabase.from("technical_annexes").select("*").eq("quotation_id", quotationId).single();
      if (existing) {
        setAnnex(existing);
        const { data: blks } = await supabase.from("annex_blocks").select("*").eq("annex_id", existing.id).order("sort_order");
        setBlocks((blks || []).map(b => ({ ...b, _localId: Math.random().toString(36).slice(2) })));
      } else {
        // Create new annex
        const { data: newAnnex } = await supabase.from("technical_annexes").insert({
          quotation_id: quotationId,
          annex_number: "AX-0001",
          title: "Technical Annex",
        }).select().single();
        setAnnex(newAnnex);
        setBlocks([]);
      }
    } finally { setLoading(false); }
  }, [quotationId]);

  useEffect(() => { loadData(); }, [loadData]);

  const addBlock = (type) => {
    setBlocks(prev => [...prev, {
      _localId: Math.random().toString(36).slice(2),
      id: null,
      annex_id: annex?.id,
      type,
      content: { ...BLOCK_DEFAULTS[type] },
      sort_order: prev.length,
    }]);
    setShowAddMenu(false);
  };

  const updateBlock = (localId, updated) => setBlocks(prev => prev.map(b => b._localId === localId ? updated : b));
  const deleteBlock = (localId) => setBlocks(prev => prev.filter(b => b._localId !== localId));
  const moveBlock = (localId, dir) => setBlocks(prev => {
    const idx = prev.findIndex(b => b._localId === localId);
    const next = [...prev];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return prev;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    return next;
  });

  const handleSave = async () => {
    if (!annex) return;
    setSaving(true);
    try {
      // Update annex title
      await supabase.from("technical_annexes").update({ title: annex.title }).eq("id", annex.id);

      // Delete all existing blocks and re-insert (simple approach)
      await supabase.from("annex_blocks").delete().eq("annex_id", annex.id);
      if (blocks.length > 0) {
        await supabase.from("annex_blocks").insert(
          blocks.map((b, i) => ({ annex_id: annex.id, type: b.type, content: b.content, sort_order: i }))
        );
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const publicUrl = annex ? `${window.location.origin}/a/${annex.annex_number}` : "";
  const copyLink = () => { navigator.clipboard.writeText(publicUrl); };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading annex editor…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <p className="text-xs text-gray-400">{quotation?.quote_number} · Technical Annex</p>
              <input
                value={annex?.title || ""}
                onChange={e => setAnnex(a => ({ ...a, title: e.target.value }))}
                className="text-sm font-bold text-gray-800 border-0 outline-none bg-transparent w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {annex && (
              <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                Copy link
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {/* Quotation reference card */}
        {quotation && (
          <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Linked to quotation</p>
              <p className="font-bold text-gray-800 mt-0.5">{quotation.quote_number}</p>
              {(quotation.client_name || quotation.project_name) && (
                <p className="text-sm text-gray-500">{[quotation.client_name, quotation.project_name].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            {annex && (
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Annex</p>
                <p className="font-bold text-blue-600 mt-0.5">{annex.annex_number}</p>
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
            onChange={updated => updateBlock(block._localId, updated)}
            annexId={annex?.id}
          />
        ))}

        {/* Add block */}
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu(v => !v)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-medium text-gray-400 hover:border-blue-400 hover:text-blue-500 transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Block
          </button>
          {showAddMenu && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 flex gap-2 z-20">
              {Object.keys(BLOCK_DEFAULTS).map(type => (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl hover:bg-gray-50 transition min-w-[80px]"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">{BLOCK_ICONS[type]}</svg>
                  <span className="text-xs text-gray-600 font-medium text-center leading-tight">{BLOCK_LABELS[type]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {blocks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Add blocks above to build your technical annex.</p>
            <p className="text-xs mt-1">Try: Specs Table to list technical parameters, or Text Block for a product overview.</p>
          </div>
        )}
      </div>
    </div>
  );
}
