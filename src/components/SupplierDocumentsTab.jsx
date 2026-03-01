import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import FileUpload from "./FileUpload";
import DocumentCard, { DOCUMENT_TYPES } from "./DocumentCard";

function DocumentModal({ document, supplierId, quotations, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: document?.name || "",
    document_type: document?.document_type || "catalog",
    quotation_id: document?.quotation_id || "",
    notes: document?.notes || "",
    validity_date: document?.validity_date || "",
    amount: document?.amount || "",
    reference_number: document?.reference_number || "",
    status: document?.status || "pending",
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const isNew = !document?.id;
  const isQuotation = form.document_type === "quotation";

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Document name is required");
      return;
    }

    if (isNew && !file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError("");

    try {
      let fileUrl = document?.file_url;
      let fileName = document?.file_name;
      let fileSize = document?.file_size;

      // Upload file if new
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${supplierId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('supplier-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('supplier-documents')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = file.name;
        fileSize = file.size;
      }

      const docData = {
        supplier_id: supplierId,
        name: form.name.trim(),
        document_type: form.document_type,
        quotation_id: form.quotation_id || null,
        notes: form.notes.trim() || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        validity_date: form.validity_date || null,
        amount: form.amount || null,
        reference_number: form.reference_number.trim() || null,
        status: form.status,
      };

      if (isNew) {
        console.log("Attempting to insert document:", docData);
        const { data, error } = await supabase
          .from("supplier_documents")
          .insert(docData)
          .select()
          .single();

        if (error) {
          console.error("Insert error details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw error;
        }
        onSaved(data, "created");
      } else {
        const { data, error } = await supabase
          .from("supplier_documents")
          .update(docData)
          .eq("id", document.id)
          .select()
          .single();

        if (error) throw error;
        onSaved(data, "updated");
      }
    } catch (e) {
      console.error("Error saving document:", e);
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-bgray-200 dark:border-darkblack-400 sticky top-0 bg-white dark:bg-darkblack-600 z-10">
          <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">
            {isNew ? "Upload Document" : "Edit Document"}
          </h2>
          <button onClick={onClose} className="text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-200 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* File upload (only for new documents) */}
          {isNew && (
            <div>
              <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">
                File Upload *
              </label>
              <FileUpload
                onFileSelect={setFile}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv"
              />
              {file && (
                <div className="mt-2 flex items-center gap-2 text-sm text-bgray-600 dark:text-bgray-300">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{file.name}</span>
                  <span className="text-xs text-bgray-400">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Document name */}
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">
              Document Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g., Product Catalog 2024 Q1"
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
            />
          </div>

          {/* Document type */}
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">
              Document Type *
            </label>
            <select
              value={form.document_type}
              onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))}
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            >
              {Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Quotation linking */}
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">
              Link to Quotation (Optional)
            </label>
            <select
              value={form.quotation_id}
              onChange={e => setForm(p => ({ ...p, quotation_id: e.target.value }))}
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            >
              <option value="">No quotation</option>
              {quotations.map(q => (
                <option key={q.id} value={q.id}>{q.quote_number}</option>
              ))}
            </select>
          </div>

          {/* Quotation-specific fields */}
          {isQuotation && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-bgray-50 dark:bg-darkblack-500 rounded-lg">
              <div className="col-span-2 text-xs font-semibold text-bgray-600 dark:text-bgray-300 uppercase tracking-wide mb-1">
                Quotation Details
              </div>

              <div>
                <label className="block text-xs text-bgray-600 dark:text-bgray-300 mb-1.5">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={form.reference_number}
                  onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))}
                  placeholder="QT-2024-001"
                  className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
                />
              </div>

              <div>
                <label className="block text-xs text-bgray-600 dark:text-bgray-300 mb-1.5">
                  Amount
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
                />
              </div>

              <div>
                <label className="block text-xs text-bgray-600 dark:text-bgray-300 mb-1.5">
                  Validity Date
                </label>
                <input
                  type="date"
                  value={form.validity_date}
                  onChange={e => setForm(p => ({ ...p, validity_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-bgray-600 dark:text-bgray-300 mb-1.5">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-2 uppercase tracking-wide">
              Notes (Optional)
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Additional information about this document..."
              rows={3}
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-bgray-200 dark:border-darkblack-400 sticky bottom-0 bg-white dark:bg-darkblack-600">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || (isNew && !file) || uploading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {uploading ? "Uploading..." : isNew ? "Upload" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentPreviewModal({ document, onClose }) {
  const isImage = /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(document.file_name);
  const isPDF = /\.pdf$/i.test(document.file_name);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bgray-200 dark:border-darkblack-400">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-darkblack-700 dark:text-white truncate">
              {document.name}
            </h3>
            <p className="text-xs text-bgray-500 dark:text-bgray-400 truncate">
              {document.file_name}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <a
              href={document.file_url}
              download={document.file_name}
              className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded-lg text-bgray-600 dark:text-bgray-300 transition"
              title="Download"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded-lg text-bgray-600 dark:text-bgray-300 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-bgray-50 dark:bg-darkblack-500 p-4">
          {isImage ? (
            <div className="flex items-center justify-center min-h-full">
              <img
                src={document.file_url}
                alt={document.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          ) : isPDF ? (
            <iframe
              src={document.file_url}
              className="w-full h-full min-h-[600px] rounded-lg"
              title={document.name}
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-full gap-4">
              <div className="w-16 h-16 rounded-full bg-bgray-200 dark:bg-darkblack-400 flex items-center justify-center">
                <svg className="w-8 h-8 text-bgray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm text-bgray-600 dark:text-bgray-300 mb-2">
                  Preview not available for this file type
                </p>
                <a
                  href={document.file_url}
                  download={document.file_name}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download File
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupplierDocumentsTab({ supplierId }) {
  const [documents, setDocuments] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [filterType, setFilterType] = useState("");
  const [filterQuotation, setFilterQuotation] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalDocument, setModalDocument] = useState(undefined); // undefined = closed, null = new, obj = edit
  const [previewDocument, setPreviewDocument] = useState(null);

  useEffect(() => {
    loadData();
  }, [supplierId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load documents with quotation info
      const { data: docs, error: docsError } = await supabase
        .from("supplier_documents")
        .select(`
          *,
          quotation:quotations(quote_number)
        `)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });

      if (docsError) throw docsError;

      // Flatten quotation number
      const docsWithQuotation = (docs || []).map(doc => ({
        ...doc,
        quotation_number: doc.quotation?.quote_number || null,
      }));

      setDocuments(docsWithQuotation);

      // Load quotations for dropdown
      const { data: quotationsData, error: quotationsError } = await supabase
        .from("quotations")
        .select("id, quote_number")
        .order("quote_number", { ascending: false });

      if (quotationsError) throw quotationsError;
      setQuotations(quotationsData || []);
    } catch (e) {
      console.error("Error loading documents:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = (doc, action) => {
    if (action === "created") {
      loadData(); // Reload to get quotation number
    } else if (action === "updated") {
      loadData(); // Reload to get updated quotation number
    }
    setModalDocument(undefined);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;

    try {
      // Delete file from storage
      const filePath = doc.file_url.split('/').slice(-2).join('/');
      await supabase.storage.from('supplier-documents').remove([filePath]);

      // Delete database record
      const { error } = await supabase
        .from("supplier_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (e) {
      console.error("Error deleting document:", e);
      alert("Error deleting document: " + e.message);
    }
  };

  // Filter documents
  const filtered = documents.filter(doc => {
    if (filterType && doc.document_type !== filterType) return false;
    if (filterQuotation && doc.quotation_id !== filterQuotation) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        doc.name.toLowerCase().includes(query) ||
        doc.file_name.toLowerCase().includes(query) ||
        doc.notes?.toLowerCase().includes(query) ||
        doc.quotation_number?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const typeStats = {};
  documents.forEach(doc => {
    typeStats[doc.document_type] = (typeStats[doc.document_type] || 0) + 1;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-darkblack-700 dark:text-white">Documents</h2>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setModalDocument(null)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload Document
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
        >
          <option value="">All Types</option>
          {Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label} {typeStats[key] ? `(${typeStats[key]})` : ""}
            </option>
          ))}
        </select>

        {/* Quotation filter */}
        <div className="relative">
          <select
            value={filterQuotation}
            onChange={e => setFilterQuotation(e.target.value)}
            className="appearance-none px-3 py-2 pr-8 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="">All Quotations</option>
            {quotations.map(q => (
              <option key={q.id} value={q.id}>{q.quote_number}</option>
            ))}
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-bgray-100 dark:bg-darkblack-500 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded transition ${
              viewMode === "grid"
                ? "bg-white dark:bg-darkblack-600 text-primary shadow-sm"
                : "text-bgray-500 hover:text-bgray-700 dark:hover:text-bgray-300"
            }`}
            title="Grid view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded transition ${
              viewMode === "list"
                ? "bg-white dark:bg-darkblack-600 text-primary shadow-sm"
                : "text-bgray-500 hover:text-bgray-700 dark:hover:text-bgray-300"
            }`}
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Documents grid/list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-bgray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-sm">Loading documents...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-bgray-100 dark:bg-darkblack-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-bgray-500 dark:text-bgray-400 text-sm">
            {documents.length === 0
              ? "No documents yet. Upload your first document."
              : "No documents match your filters."}
          </p>
          {documents.length === 0 && (
            <button
              onClick={() => setModalDocument(null)}
              className="mt-4 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
            >
              Upload First Document
            </button>
          )}
        </div>
      ) : (
        <div className={
          viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-3"
        }>
          {filtered.map(doc => (
            <DocumentCard
              key={doc.id}
              document={doc}
              viewMode={viewMode}
              onEdit={(d) => setModalDocument(d)}
              onDelete={handleDelete}
              onPreview={(d) => setPreviewDocument(d)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modalDocument !== undefined && (
        <DocumentModal
          document={modalDocument}
          supplierId={supplierId}
          quotations={quotations}
          onClose={() => setModalDocument(undefined)}
          onSaved={handleSaved}
        />
      )}

      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}
