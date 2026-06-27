import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { sileo } from "sileo";
import FileUpload from "./FileUpload";
import { DOCUMENT_TYPES } from "./DocumentCard";

function UploadModal({ trackId, suppliers, onClose, onSaved }) {
  const [form, setForm] = useState({ supplier_id: "", name: "", document_type: "catalog", notes: "" });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.supplier_id) { setError("Please select a supplier"); return; }
    if (!form.name.trim()) { setError("Document name is required"); return; }
    if (!file) { setError("Please select a file"); return; }

    setUploading(true);
    setError("");
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${form.supplier_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("supplier-documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("supplier-documents")
        .getPublicUrl(filePath);

      const { data: doc, error: insertError } = await supabase
        .from("supplier_documents")
        .insert({
          supplier_id: form.supplier_id,
          name: form.name.trim(),
          document_type: form.document_type,
          notes: form.notes.trim() || null,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      const { error: linkError } = await supabase
        .from("track_supplier_documents")
        .insert({ track_id: trackId, supplier_document_id: doc.id });
      if (linkError) throw linkError;

      sileo.success({ title: "Document uploaded & linked" });
      onSaved(doc);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-bgray-200 dark:border-darkblack-400 sticky top-0 bg-white dark:bg-darkblack-600 z-10">
          <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">Upload Document</h2>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">Supplier *</label>
            <select value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))} className={inputCls}>
              <option value="">Select supplier...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">File *</label>
            <FileUpload onFileSelect={setFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv" />
            {file && (
              <div className="mt-2 flex items-center gap-2 text-sm text-bgray-600 dark:text-bgray-300">
                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="truncate">{file.name}</span>
                <span className="text-xs text-bgray-400 flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">Document Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Product Catalog 2024 Q1" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">Document Type *</label>
            <select value={form.document_type} onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))} className={inputCls}>
              {Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">Notes (Optional)</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional notes..." className={`${inputCls} resize-none`} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-bgray-200 dark:border-darkblack-400">
          <button onClick={onClose} disabled={uploading} className="px-4 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 disabled:opacity-50 transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.supplier_id || !form.name.trim() || !file || uploading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {uploading ? "Uploading..." : "Upload & Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkModal({ trackId, suppliers, linkedDocIds, onClose, onLinked }) {
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierDocs, setSupplierDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [linking, setLinking] = useState(null);

  useEffect(() => {
    if (!selectedSupplier) { setSupplierDocs([]); return; }
    setLoadingDocs(true);
    supabase
      .from("supplier_documents")
      .select("*")
      .eq("supplier_id", selectedSupplier)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSupplierDocs((data || []).filter(d => !linkedDocIds.includes(d.id)));
        setLoadingDocs(false);
      });
  }, [selectedSupplier]);

  const handleLink = async (doc) => {
    setLinking(doc.id);
    try {
      const { error } = await supabase
        .from("track_supplier_documents")
        .insert({ track_id: trackId, supplier_document_id: doc.id });
      if (error) throw error;
      sileo.success({ title: "Document linked" });
      onLinked(doc);
      setSupplierDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (e) {
      sileo.error({ title: "Failed to link", description: e.message });
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-bgray-200 dark:border-darkblack-400">
          <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">Link Existing Document</h2>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">Select Supplier</label>
            <select
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            >
              <option value="">Choose supplier...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {selectedSupplier && (
            loadingDocs ? (
              <div className="flex items-center justify-center py-10 gap-2 text-bgray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span className="text-sm">Loading documents...</span>
              </div>
            ) : supplierDocs.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-bgray-500 dark:text-bgray-400">No documents available.</p>
                <p className="text-xs text-bgray-400 mt-1">All documents may already be linked, or this supplier has none yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {supplierDocs.map(doc => {
                  const typeInfo = DOCUMENT_TYPES[doc.document_type] || { label: doc.document_type, icon: "📄", color: "bg-gray-100 text-gray-700" };
                  return (
                    <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-bgray-200 dark:border-darkblack-400 hover:border-primary/40 hover:bg-primary/5 transition">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${typeInfo.color}`}>
                        {typeInfo.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-darkblack-700 dark:text-white truncate">{doc.name}</p>
                        <p className="text-xs text-bgray-400 truncate">{typeInfo.label} · {doc.file_name}</p>
                      </div>
                      <button
                        onClick={() => handleLink(doc)}
                        disabled={linking === doc.id}
                        className="flex-shrink-0 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
                      >
                        {linking === doc.id ? "..." : "Link"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        <div className="p-4 border-t border-bgray-200 dark:border-darkblack-400">
          <button onClick={onClose} className="w-full py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrackDocumentsTab({ trackId }) {
  const [docs, setDocs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "upload" | "link"

  useEffect(() => {
    if (!trackId) return;
    loadData();
    supabase.from("suppliers").select("id, name").order("name")
      .then(({ data }) => setSuppliers(data || []));
  }, [trackId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("track_supplier_documents")
        .select(`
          supplier_document_id,
          added_at,
          doc:supplier_documents(*, supplier:suppliers(name))
        `)
        .eq("track_id", trackId)
        .order("added_at", { ascending: false });

      if (error) throw error;
      setDocs((data || []).map(row => ({
        ...row.doc,
        supplier_name: row.doc?.supplier?.name || null,
        linked_at: row.added_at,
      })));
    } catch (e) {
      console.error("TrackDocumentsTab loadData:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (doc) => {
    if (!window.confirm(`Unlink "${doc.name}" from this project?\n\nThe document will remain in the supplier's library.`)) return;
    try {
      const { error } = await supabase
        .from("track_supplier_documents")
        .delete()
        .eq("track_id", trackId)
        .eq("supplier_document_id", doc.id);
      if (error) throw error;
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      sileo.success({ title: "Document unlinked" });
    } catch (e) {
      sileo.error({ title: "Failed to unlink", description: e.message });
    }
  };

  const linkedDocIds = docs.map(d => d.id);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-darkblack-700 dark:text-white">Supplier Documents</h3>
          <p className="text-xs text-bgray-500 dark:text-bgray-400 mt-0.5">
            {docs.length} linked to this project
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal("link")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-xs font-semibold text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Link Existing
          </button>
          <button
            onClick={() => setModal("upload")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload New
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-bgray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <span className="text-sm">Loading...</span>
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-bgray-100 dark:bg-darkblack-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-darkblack-700 dark:text-white mb-1">No documents linked yet</p>
          <p className="text-xs text-bgray-400 mb-4">Upload a new document or link an existing one from a supplier.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setModal("link")} className="px-4 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-xs font-semibold text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 transition">
              Link Existing
            </button>
            <button onClick={() => setModal("upload")} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition">
              Upload New
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const typeInfo = DOCUMENT_TYPES[doc.document_type] || { label: doc.document_type, icon: "📄", color: "bg-gray-100 text-gray-700" };
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-bgray-200 dark:border-darkblack-400 hover:border-bgray-300 dark:hover:border-darkblack-300 transition group">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${typeInfo.color}`}>
                  {typeInfo.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-darkblack-700 dark:text-white truncate">{doc.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {doc.supplier_name && (
                      <span className="text-xs text-bgray-500 dark:text-bgray-400">{doc.supplier_name}</span>
                    )}
                    {doc.supplier_name && <span className="text-bgray-300 dark:text-darkblack-400 text-xs">·</span>}
                    <span className="text-xs text-bgray-400">{typeInfo.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open document"
                    className="p-1.5 rounded-lg hover:bg-bgray-100 dark:hover:bg-darkblack-500 text-bgray-400 hover:text-primary transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <button
                    onClick={() => handleUnlink(doc)}
                    title="Unlink from project"
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-bgray-400 hover:text-red-500 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal === "upload" && (
        <UploadModal
          trackId={trackId}
          suppliers={suppliers}
          onClose={() => setModal(null)}
          onSaved={() => { loadData(); setModal(null); }}
        />
      )}
      {modal === "link" && (
        <LinkModal
          trackId={trackId}
          suppliers={suppliers}
          linkedDocIds={linkedDocIds}
          onClose={() => setModal(null)}
          onLinked={() => loadData()}
        />
      )}
    </div>
  );
}
