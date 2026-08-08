import React, { useState, useEffect, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "../supabaseClient";
import { sileo } from "sileo";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_PDF_PAGES = 6;

const COMPANY_INFO = {
  name: "INTERASIA SAS (HONGKONG) TRADE COMPANY LIMITED",
  website: "www.interasia.com.co",
};

const SUMMARY_FIELDS = [
  { key: "product_summary", label: "Product", icon: "📦" },
  { key: "quantity_summary", label: "Quantity", icon: "🔢" },
  { key: "key_requirements", label: "Key Requirements", icon: "📋" },
  { key: "budget_terms", label: "Budget / Terms", icon: "💰" },
  { key: "open_questions", label: "Open Questions", icon: "❓" },
];

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const extractTextViaAI = async (base64, mimeType) => {
  const res = await fetch("/api/ai-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "extract", image: base64, mimeType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data.content || "";
};

const extractTextFromPdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pageTexts = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    const text = await extractTextViaAI(base64, "image/jpeg");
    pageTexts.push(`[Page ${i}]\n${text}`);
  }
  return pageTexts.join("\n\n");
};

const bulletLines = (text) => (text || "").split("\n").map(l => l.trim()).filter(Boolean);

export default function ClientRequestTab({ trackId, clientName, projectName }) {
  const [clientRequest, setClientRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const [rawText, setRawText] = useState("");
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState("");
  const [files, setFiles] = useState([]);

  const [summary, setSummary] = useState({
    product_summary: "", quantity_summary: "", key_requirements: "", budget_terms: "", open_questions: "",
  });
  const [summaryLang, setSummaryLang] = useState("es");

  const fileRef = useRef(null);
  const printRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase.from("client_requests").select("*").eq("track_id", trackId).single();
      if (existing) {
        setClientRequest(existing);
        setRawText(existing.raw_text || "");
        setLinks(existing.links || []);
        setSummary({
          product_summary: existing.product_summary || "",
          quantity_summary: existing.quantity_summary || "",
          key_requirements: existing.key_requirements || "",
          budget_terms: existing.budget_terms || "",
          open_questions: existing.open_questions || "",
        });
        const { data: fls } = await supabase.from("client_request_files").select("*").eq("client_request_id", existing.id).order("created_at");
        setFiles(fls || []);
      } else {
        setClientRequest(null);
        setRawText("");
        setLinks([]);
        setFiles([]);
        setSummary({ product_summary: "", quantity_summary: "", key_requirements: "", budget_terms: "", open_questions: "" });
      }
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => { loadData(); }, [loadData]);

  const ensureRequest = async () => {
    if (clientRequest) return clientRequest;
    const { data, error } = await supabase.from("client_requests").insert({ track_id: trackId }).select().single();
    if (error) throw error;
    setClientRequest(data);
    return data;
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    setLinks(prev => [...prev, newLink.trim()]);
    setNewLink("");
  };
  const removeLink = (idx) => setLinks(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try {
      const req = await ensureRequest();
      const { data, error } = await supabase.from("client_requests")
        .update({ raw_text: rawText, links })
        .eq("id", req.id).select().single();
      if (error) throw error;
      setClientRequest(data);
      sileo.success({ title: "Saved" });
    } catch (e) {
      sileo.error({ title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const runExtraction = async (fileRow, file) => {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      await supabase.from("client_request_files").update({ extraction_status: "skipped" }).eq("id", fileRow.id);
      setFiles(prev => prev.map(f => f.id === fileRow.id ? { ...f, extraction_status: "skipped" } : f));
      return;
    }
    setFiles(prev => prev.map(f => f.id === fileRow.id ? { ...f, extraction_status: "processing" } : f));
    await supabase.from("client_request_files").update({ extraction_status: "processing" }).eq("id", fileRow.id);
    try {
      const text = isImage
        ? await extractTextViaAI(await toBase64(file), file.type)
        : await extractTextFromPdf(file);
      await supabase.from("client_request_files").update({ extraction_status: "done", extracted_text: text }).eq("id", fileRow.id);
      setFiles(prev => prev.map(f => f.id === fileRow.id ? { ...f, extraction_status: "done", extracted_text: text } : f));
    } catch (e) {
      await supabase.from("client_request_files").update({ extraction_status: "error" }).eq("id", fileRow.id);
      setFiles(prev => prev.map(f => f.id === fileRow.id ? { ...f, extraction_status: "error" } : f));
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadingFile(true);
    try {
      const req = await ensureRequest();
      const path = `${trackId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("client-request-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("client-request-files").getPublicUrl(path);
      const { data: fileRow, error: insErr } = await supabase.from("client_request_files").insert({
        client_request_id: req.id,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
      }).select().single();
      if (insErr) throw insErr;
      setFiles(prev => [...prev, fileRow]);
      sileo.success({ title: "File uploaded — reading content…" });
      runExtraction(fileRow, file);
    } catch (e) {
      sileo.error({ title: "Upload failed", description: e.message });
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = async (fileRow) => {
    try {
      const { error } = await supabase.from("client_request_files").delete().eq("id", fileRow.id);
      if (error) throw error;
      setFiles(prev => prev.filter(f => f.id !== fileRow.id));
    } catch (e) {
      sileo.error({ title: "Delete failed", description: e.message });
    }
  };

  const updateFileDescriptionLocal = (fileId, value) =>
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, description: value } : f));

  const saveFileDescription = async (fileId, value) => {
    try {
      const { error } = await supabase.from("client_request_files").update({ description: value || null }).eq("id", fileId);
      if (error) throw error;
    } catch (e) {
      sileo.error({ title: "Could not save file description", description: e.message });
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const generateSummary = async () => {
    const filesWithText = files.filter(f => f.extraction_status === "done" && f.extracted_text?.trim());
    if (!rawText.trim() && links.length === 0 && filesWithText.length === 0) {
      sileo.warning({ title: "Add the conversation text, a link, or a file first" });
      return;
    }
    setGenerating(true);
    try {
      const contextText = [
        rawText.trim(),
        links.length > 0 ? `\nLinks shared:\n${links.join("\n")}` : "",
        filesWithText.length > 0
          ? `\nAttached files:\n${filesWithText.map(f => `--- ${f.file_name}${f.description ? ` (${f.description})` : ""} ---\n${f.extracted_text}`).join("\n\n")}`
          : "",
      ].join("\n");
      const res = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "digest", text: contextText, language: summaryLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      const nextSummary = {
        product_summary: data.product_summary || "",
        quantity_summary: data.quantity_summary || "",
        key_requirements: data.key_requirements || "",
        budget_terms: data.budget_terms || "",
        open_questions: data.open_questions || "",
      };
      setSummary(nextSummary);
      setEditingSummary(false);

      const req = await ensureRequest();
      const { data: updated, error } = await supabase.from("client_requests")
        .update({ raw_text: rawText, links, ...nextSummary, summary_generated_at: new Date().toISOString() })
        .eq("id", req.id).select().single();
      if (error) throw error;
      setClientRequest(updated);
      sileo.success({ title: "Summary generated" });
    } catch (e) {
      sileo.error({ title: "Could not generate summary", description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const saveSummaryEdits = async () => {
    try {
      const req = await ensureRequest();
      const { data, error } = await supabase.from("client_requests").update(summary).eq("id", req.id).select().single();
      if (error) throw error;
      setClientRequest(data);
      setEditingSummary(false);
      sileo.success({ title: "Summary updated" });
    } catch (e) {
      sileo.error({ title: "Save failed", description: e.message });
    }
  };

  const handleDownloadPDF = async () => {
    const el = printRef.current;
    if (!el) return;
    setDownloadingPDF(true);
    try {
      await new Promise(r => setTimeout(r, 50));

      // Measure each attached file's label position (in CSS px, relative to the
      // printed element) before capture — used to overlay real clickable links,
      // since html2canvas rasterizes everything into a plain image
      const elRect = el.getBoundingClientRect();
      const elWidthPx = elRect.width;
      const fileLinkRects = [...el.querySelectorAll("[data-file-id]")].map(node => {
        const r = node.getBoundingClientRect();
        const fileUrl = files.find(f => String(f.id) === node.getAttribute("data-file-id"))?.file_url;
        return { url: fileUrl, top: r.top - elRect.top, left: r.left - elRect.left, width: r.width, height: r.height };
      }).filter(r => r.url);

      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, pdfW, pdfH);

      // Overlay real clickable link annotations on top of each file name
      const mmPerPx = pdfW / elWidthPx;
      fileLinkRects.forEach(r => {
        pdf.link(r.left * mmPerPx, r.top * mmPerPx, r.width * mmPerPx, r.height * mmPerPx, { url: r.url });
      });

      pdf.save(`Client_Request_${(projectName || "digest").replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      sileo.error({ title: "Could not generate PDF", description: e.message });
    } finally {
      setDownloadingPDF(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  const extractionBadge = (f) => {
    if (f.extraction_status === "processing") return <span className="flex items-center gap-1 text-[10px] text-amber-600"><span className="w-2.5 h-2.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin inline-block" /> Reading…</span>;
    if (f.extraction_status === "done") return <span className="text-[10px] text-green-600">✓ Read</span>;
    if (f.extraction_status === "error") return <span className="text-[10px] text-red-500">⚠ Could not read</span>;
    if (f.extraction_status === "skipped") return <span className="text-[10px] text-bgray-400">Not readable (image/PDF only)</span>;
    return null;
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  const hasSummary = clientRequest?.summary_generated_at;

  return (
    <div className="p-6 space-y-6">
      {/* Summary card */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-darkblack-700 dark:text-white flex items-center gap-2">
            🧾 Quoting Digest
          </h3>
          <div className="flex items-center gap-3">
            {hasSummary && (
              <span className="text-xs text-bgray-500 dark:text-bgray-400">
                Generated {new Date(clientRequest.summary_generated_at).toLocaleString()}
              </span>
            )}
            {hasSummary && !editingSummary && (
              <button onClick={() => setEditingSummary(true)} className="text-xs text-primary hover:underline font-medium">✏️ Edit</button>
            )}
            {hasSummary && editingSummary && (
              <button onClick={saveSummaryEdits} className="text-xs text-primary hover:underline font-medium">✓ Done editing</button>
            )}
            {hasSummary && (
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
                className="flex items-center gap-1 text-xs text-bgray-500 dark:text-bgray-400 hover:text-primary disabled:opacity-50"
              >
                {downloadingPDF ? "Generating…" : "⬇ PDF"}
              </button>
            )}
          </div>
        </div>

        {!hasSummary ? (
          <p className="text-sm text-bgray-500 dark:text-bgray-400">
            Paste the client's conversation below and click <strong>Generate Summary</strong> to get a clean brief the team can quote from.
          </p>
        ) : editingSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SUMMARY_FIELDS.map(f => (
              <div key={f.key} className={f.key === "key_requirements" || f.key === "open_questions" ? "md:col-span-2" : ""}>
                <label className="block text-xs font-semibold text-bgray-500 dark:text-bgray-400 mb-1">
                  {f.icon} {f.label}
                </label>
                <textarea
                  rows={f.key === "key_requirements" || f.key === "open_questions" ? 3 : 2}
                  value={summary[f.key]}
                  onChange={e => setSummary(s => ({ ...s, [f.key]: e.target.value }))}
                  className={`${inputCls} resize-y`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SUMMARY_FIELDS.map(f => {
              const lines = bulletLines(summary[f.key]);
              return (
                <div key={f.key} className={f.key === "key_requirements" || f.key === "open_questions" ? "md:col-span-2" : ""}>
                  <p className="text-xs font-semibold text-bgray-500 dark:text-bgray-400 mb-1.5">{f.icon} {f.label}</p>
                  {lines.length === 0 ? (
                    <p className="text-sm text-bgray-400 italic">—</p>
                  ) : lines.length === 1 ? (
                    <p className="text-sm text-darkblack-700 dark:text-white">{lines[0]}</p>
                  ) : (
                    <ul className="space-y-1">
                      {lines.map((l, i) => (
                        <li key={i} className="text-sm text-darkblack-700 dark:text-white flex gap-2">
                          <span className="text-primary shrink-0">•</span>
                          <span>{l}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-4">
          <div className="flex items-center bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-lg p-0.5">
            <button
              onClick={() => setSummaryLang("es")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                summaryLang === "es" ? "bg-primary text-white" : "text-bgray-500 dark:text-bgray-400 hover:text-darkblack-700 dark:hover:text-white"
              }`}
            >
              Español
            </button>
            <button
              onClick={() => setSummaryLang("en")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                summaryLang === "en" ? "bg-primary text-white" : "text-bgray-500 dark:text-bgray-400 hover:text-darkblack-700 dark:hover:text-white"
              }`}
            >
              English
            </button>
          </div>
          <button
            onClick={generateSummary}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {generating ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Generating…</>
            ) : (
              <>🤖 {hasSummary ? "Regenerate Summary" : "Generate Summary"}</>
            )}
          </button>
        </div>
      </div>

      {/* Raw capture */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">
            Client Conversation (paste WhatsApp text, emails, etc.)
          </label>
          <textarea
            rows={8}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="Paste the raw conversation with the client here..."
            className={`${inputCls} resize-y`}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Links</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newLink}
              onChange={e => setNewLink(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
              placeholder="https://..."
              className={inputCls}
            />
            <button onClick={addLink} className="px-3 py-2 bg-bgray-100 dark:bg-darkblack-500 text-darkblack-700 dark:text-white rounded-lg text-sm font-medium hover:bg-bgray-200 dark:hover:bg-darkblack-400 transition shrink-0">
              Add
            </button>
          </div>
          {links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {links.map((link, idx) => (
                <span key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-bgray-100 dark:bg-darkblack-500 rounded-full text-xs">
                  <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-[240px]">{link}</a>
                  <button onClick={() => removeLink(idx)} className="text-bgray-400 hover:text-red-500 shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">
            Files <span className="font-normal text-bgray-400">— images and PDFs are read automatically for the digest</span>
          </label>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileInputChange} />
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex items-center justify-center gap-2 py-6 border-2 border-dashed rounded-xl cursor-pointer transition ${
              dragOver ? "border-primary bg-primary/5" : "border-bgray-200 dark:border-darkblack-400 hover:border-bgray-300"
            }`}
          >
            {uploadingFile ? (
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <span className="text-sm text-bgray-400">Drag & drop a file, or click to browse</span>
            )}
          </div>
          {files.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {files.map(f => (
                <div key={f.id} className="px-3 py-2 bg-bgray-50 dark:bg-darkblack-500 rounded-lg text-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <a href={f.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{f.file_name}</a>
                      {extractionBadge(f)}
                    </div>
                    <button onClick={() => removeFile(f)} className="text-bgray-400 hover:text-red-500 shrink-0 ml-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={f.description || ""}
                    onChange={e => updateFileDescriptionLocal(f.id, e.target.value)}
                    onBlur={e => saveFileDescription(f.id, e.target.value)}
                    placeholder="What is this file? e.g. Technical datasheet, Quotation, Catalog..."
                    className="w-full px-2 py-1 border border-bgray-200 dark:border-darkblack-400 rounded text-xs bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-1 focus:ring-primary placeholder-bgray-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-darkblack-700 dark:bg-white text-white dark:text-darkblack-700 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Hidden print template for PDF export */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div
          ref={printRef}
          style={{
            width: "794px",
            backgroundColor: "#ffffff",
            fontFamily: "Arial, Helvetica, sans-serif",
            color: "#1a1a1a",
            padding: "48px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", borderBottom: "2px solid #1e3a5f", paddingBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#1e3a5f" }}>CLIENT REQUEST SUMMARY</div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
                {[clientName, projectName].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "11px", color: "#777" }}>
              <div style={{ fontWeight: "700", color: "#1e3a5f" }}>{COMPANY_INFO.name}</div>
              <div>{COMPANY_INFO.website}</div>
              <div style={{ marginTop: "4px" }}>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
          </div>

          {SUMMARY_FIELDS.map(f => {
            const lines = bulletLines(summary[f.key]);
            return (
              <div key={f.key} style={{ marginBottom: "18px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e3a5f", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {f.icon} {f.label}
                </div>
                {lines.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "#aaa" }}>—</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: "18px" }}>
                    {lines.map((l, i) => (
                      <li key={i} style={{ fontSize: "13px", color: "#1a1a1a", marginBottom: "4px" }}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {links.length > 0 && (
            <div style={{ marginBottom: "18px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e3a5f", marginBottom: "6px", textTransform: "uppercase" }}>🔗 Links</div>
              <ul style={{ margin: 0, paddingLeft: "18px" }}>
                {links.map((l, i) => <li key={i} style={{ fontSize: "12px", color: "#555", marginBottom: "3px", wordBreak: "break-all" }}>{l}</li>)}
              </ul>
            </div>
          )}

          {files.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e3a5f", marginBottom: "6px", textTransform: "uppercase" }}>📎 Attached Files</div>
              <ul style={{ margin: 0, paddingLeft: "18px" }}>
                {files.map(f => (
                  <li key={f.id} data-file-id={f.id} style={{ fontSize: "12px", color: "#2563eb", textDecoration: "underline", marginBottom: "5px" }}>
                    {f.file_name}{f.description ? ` — ${f.description}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #e8eaed" }}>
            <div style={{ fontSize: "10px", color: "#aaa" }}>Generated by Ygri CRM · {COMPANY_INFO.website}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
