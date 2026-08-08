import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { sileo } from "sileo";

const SUMMARY_FIELDS = [
  { key: "product_summary", label: "Product", icon: "📦" },
  { key: "quantity_summary", label: "Quantity", icon: "🔢" },
  { key: "key_requirements", label: "Key Requirements", icon: "📋" },
  { key: "budget_terms", label: "Budget / Terms", icon: "💰" },
  { key: "open_questions", label: "Open Questions", icon: "❓" },
];

export default function ClientRequestTab({ trackId }) {
  const [clientRequest, setClientRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [rawText, setRawText] = useState("");
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState("");
  const [files, setFiles] = useState([]);

  const [summary, setSummary] = useState({
    product_summary: "", quantity_summary: "", key_requirements: "", budget_terms: "", open_questions: "",
  });

  const fileRef = useRef(null);

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
      sileo.success({ title: "File uploaded" });
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
    if (!rawText.trim() && links.length === 0) {
      sileo.warning({ title: "Add the conversation text or a link first" });
      return;
    }
    setGenerating(true);
    try {
      const contextText = [
        rawText.trim(),
        links.length > 0 ? `\nLinks shared:\n${links.join("\n")}` : "",
      ].join("\n");
      const res = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "digest", text: contextText, language: "es" }),
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

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

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
          {hasSummary && (
            <span className="text-xs text-bgray-500 dark:text-bgray-400">
              Generated {new Date(clientRequest.summary_generated_at).toLocaleString()}
            </span>
          )}
        </div>

        {!hasSummary ? (
          <p className="text-sm text-bgray-500 dark:text-bgray-400">
            Paste the client's conversation below and click <strong>Generate Summary</strong> to get a clean brief the team can quote from.
          </p>
        ) : (
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
        )}

        <div className="flex justify-end mt-4">
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
          <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Files</label>
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
                <div key={f.id} className="flex items-center justify-between px-3 py-2 bg-bgray-50 dark:bg-darkblack-500 rounded-lg text-sm">
                  <a href={f.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{f.file_name}</a>
                  <button onClick={() => removeFile(f)} className="text-bgray-400 hover:text-red-500 shrink-0 ml-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
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
    </div>
  );
}
