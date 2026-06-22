import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { sileo } from "sileo";
import QuotationForm from "./components/QuotationForm";

// ─── Key Dates Section ────────────────────────────────────────────────────────
const MILESTONE_CONFIG = {
  production_ready:   { label: "Production Ready",  emoji: "🏭", color: "orange" },
  inspection:         { label: "Inspection",         emoji: "🔍", color: "blue"   },
  shipping_departure: { label: "Departure",          emoji: "🚢", color: "teal"   },
  estimated_arrival:  { label: "ETA / Arrival",      emoji: "📦", color: "purple" },
  payment_balance:    { label: "Balance Payment",    emoji: "💰", color: "green"  },
  client_delivery:    { label: "Client Delivery",    emoji: "✅", color: "emerald"},
  custom:             { label: "Custom",             emoji: "📌", color: "slate"  },
};

const MILESTONE_COLORS = {
  orange:  "bg-orange-100 text-orange-700",
  blue:    "bg-blue-100 text-blue-700",
  teal:    "bg-teal-100 text-teal-700",
  purple:  "bg-purple-100 text-purple-700",
  green:   "bg-green-100 text-green-700",
  emerald: "bg-emerald-100 text-emerald-700",
  slate:   "bg-slate-100 text-slate-600",
};

function KeyDatesSection({ trackId }) {
  const [milestones, setMilestones] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "inspection", date: "", label: "", supplier_id: "", reminder_days: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trackId) return;
    load();
    supabase.from("suppliers").select("id, name").order("name")
      .then(({ data }) => setSuppliers(data || []));
  }, [trackId]);

  const load = async () => {
    const { data } = await supabase
      .from("project_milestones")
      .select("id, type, label, date, notes, supplier_id, supplier:suppliers(name)")
      .eq("track_id", trackId)
      .order("date");
    setMilestones(data || []);
  };

  const handleAdd = async () => {
    if (!form.date) { sileo.warning({ title: "Please pick a date" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("project_milestones").insert({
        track_id: trackId,
        type: form.type,
        label: form.type === "custom" ? form.label.trim() || null : null,
        date: form.date,
        supplier_id: form.supplier_id || null,
        reminder_days: form.reminder_days !== "" ? parseInt(form.reminder_days) : null,
      });
      if (error) throw error;
      sileo.success({ title: "Key date added" });
      setForm({ type: "inspection", date: "", label: "", supplier_id: "", reminder_days: "" });
      setShowForm(false);
      load();
    } catch (e) {
      sileo.error({ title: "Failed to add date", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("project_milestones").delete().eq("id", id);
    if (error) { sileo.error({ title: "Delete failed", description: error.message }); return; }
    sileo.success({ title: "Date removed" });
    setMilestones(p => p.filter(m => m.id !== id));
  };

  const inputCls = "w-full px-2.5 py-1.5 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-darkblack-700 dark:text-white">
          Key Dates ({milestones.length})
        </h4>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Add
        </button>
      </div>

      {/* Existing milestones */}
      {milestones.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {milestones.map(m => {
            const cfg = MILESTONE_CONFIG[m.type] || MILESTONE_CONFIG.custom;
            const colors = MILESTONE_COLORS[cfg.color];
            return (
              <div key={m.id} className="group">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium flex-1 min-w-0 ${colors}`}>
                    <span className="flex-shrink-0">{cfg.emoji}</span>
                    <span className="truncate">{m.label || cfg.label}</span>
                  </span>
                  <span className="text-xs text-bgray-500 dark:text-bgray-400 flex-shrink-0 tabular-nums">
                    {m.date}
                  </span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="opacity-0 group-hover:opacity-100 transition p-0.5 text-bgray-400 hover:text-red-500"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                {m.supplier?.name && (
                  <div className="mt-0.5 ml-1 flex items-center gap-1 text-[11px] text-bgray-500 dark:text-bgray-400">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                    {m.supplier.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {milestones.length === 0 && !showForm && (
        <p className="text-xs text-bgray-400 dark:text-bgray-500 italic mb-2">No key dates yet.</p>
      )}

      {/* Inline add form */}
      {showForm && (
        <div className="p-3 bg-bgray-50 dark:bg-darkblack-500 rounded-xl border border-bgray-200 dark:border-darkblack-400 space-y-2.5">
          {/* Type grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(MILESTONE_CONFIG).map(([key, cfg]) => {
              const colors = MILESTONE_COLORS[cfg.color];
              const active = form.type === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, type: key }))}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border transition text-left ${
                    active
                      ? `${colors} border-current font-semibold`
                      : "border-bgray-200 dark:border-darkblack-400 text-bgray-500 dark:text-bgray-400 hover:bg-white dark:hover:bg-darkblack-400"
                  }`}
                >
                  <span>{cfg.emoji}</span>
                  <span className="truncate">{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {form.type === "custom" && (
            <input
              type="text"
              value={form.label}
              onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              placeholder="Custom label…"
              className={inputCls}
            />
          )}

          <input
            type="date"
            value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            className={inputCls}
          />

          {/* Supplier (optional) */}
          <div>
            <label className="block text-[11px] font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide mb-1">
              Supplier (optional)
            </label>
            <select
              value={form.supplier_id}
              onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">No supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-[11px] font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide mb-1">
              Reminder
            </label>
            <select
              value={form.reminder_days}
              onChange={e => setForm(p => ({ ...p, reminder_days: e.target.value }))}
              className={inputCls}
            >
              <option value="">No reminder</option>
              <option value="0">Same day</option>
              <option value="1">1 day before</option>
              <option value="3">3 days before</option>
              <option value="7">7 days before</option>
              <option value="14">14 days before</option>
              <option value="30">30 days before</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-1.5 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-xs text-bgray-500 dark:text-bgray-400 hover:bg-bgray-100 dark:hover:bg-darkblack-400 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!form.date || saving}
              className="flex-1 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {saving ? "Saving…" : "Save Date"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report Tab ───────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  draft:                    "bg-gray-100 text-gray-600",
  approved:                 "bg-green-100 text-green-700",
  approved_with_observations: "bg-yellow-100 text-yellow-700",
  rejected:                 "bg-red-100 text-red-700",
};

function ReportTab({ trackId, projectName, clientName, onClose }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!trackId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("inspection_reports")
      .select("id, report_number, title, status, visit_date, created_at")
      .eq("track_id", trackId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) { setReports(data || []); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [trackId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      // 1. Insert report linked to this track
      const { data: rpt, error: rptErr } = await supabase
        .from("inspection_reports")
        .insert({
          title: `${projectName || "Inspection"} — Report`,
          track_id: trackId,
        })
        .select()
        .single();
      if (rptErr) throw rptErr;

      // 2. Insert a cover block pre-filled with project + client
      await supabase.from("report_blocks").insert({
        report_id: rpt.id,
        type: "cover",
        sort_order: 0,
        content: {
          project_name: projectName || "",
          client_name:  clientName  || "",
          inspector_name: "", visit_date: "", supplier_id: null,
          supplier_name: "", supplier_address: "", po_number: "",
          country: "", report_type: "", attached_docs: [],
        },
      });

      // 3. Navigate to editor (close drawer first)
      onClose();
      navigate(`/reports/${rpt.id}/edit`, { state: { from: "drawer" } });
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const openReport = (rpt) => {
    onClose();
    navigate(`/reports/${rpt.id}/edit`, { state: { from: "drawer" } });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-bgray-500 dark:text-bgray-400">
          {loading ? "Loading…" : `${reports.length} report${reports.length !== 1 ? "s" : ""} linked to this project`}
        </p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-60"
        >
          {creating ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
          {creating ? "Creating…" : "New Report"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-bgray-100 dark:bg-darkblack-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-darkblack-700 dark:text-white">No inspection reports yet</p>
            <p className="text-xs text-bgray-400 mt-0.5">Click "New Report" to create one linked to this project</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(rpt => (
            <button
              key={rpt.id}
              onClick={() => openReport(rpt)}
              className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-bgray-200 dark:border-darkblack-400 hover:border-primary hover:bg-primary/5 transition group"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-darkblack-700 dark:text-white truncate">
                  {rpt.title || rpt.report_number}
                </p>
                <p className="text-xs text-bgray-400 mt-0.5">
                  {rpt.report_number}
                  {rpt.visit_date ? ` · ${rpt.visit_date}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {rpt.status && (
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_COLORS[rpt.status] || "bg-gray-100 text-gray-600"}`}>
                    {rpt.status.replace(/_/g, " ")}
                  </span>
                )}
                <svg className="w-4 h-4 text-bgray-300 group-hover:text-primary transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StageDrawer({ stageId, onClose, onUpdate, projectName, clientName, trackId }) {
  const [stageDetail, setStageDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  
  // Form states
  const [commentDraft, setCommentDraft] = useState("");
  const [todoDraft, setTodoDraft] = useState("");
  const [newTodoDueDate, setNewTodoDueDate] = useState("");
  const [newTodoAssignee, setNewTodoAssignee] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [fileUpload, setFileUpload] = useState(null);
  const [fileLabel, setFileLabel] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  
  // Enhanced comment states
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [showFileMentions, setShowFileMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeMenu, setActiveMenu] = useState(null);
  const [likedComments, setLikedComments] = useState({});
  const [replyingTo, setReplyingTo] = useState(null); // { id, userName }
  const commentInputRef = useRef(null);

  // Quotation tab state
  const [activeTab, setActiveTab] = useState("details"); // "details" | "quotation"
  const [quotationAmount, setQuotationAmount] = useState(null);
  const [quotationCurrency, setQuotationCurrency] = useState("USD");

  // Close active ··· menu on outside click
  useEffect(() => {
    const handler = () => setActiveMenu(null);
    if (activeMenu !== null) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [activeMenu]);

  // Load current user + profiles
  useEffect(() => {
    const init = async () => {
      const { data: { session: _s } } = await supabase.auth.getSession(); const user = _s?.user;
      setCurrentUser(user);
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      setProfiles(data || []);
    };
    init();
  }, []);

  // Load stage details
  useEffect(() => {
    if (!stageId) return;
    
    const loadStageDetail = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc("get_stage_detail", { 
          p_track_stage_id: stageId 
        });
        if (error) throw error;
        console.log('Stage detail data:', data); // Debug log to see available data
        setStageDetail(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadStageDetail();
  }, [stageId]);

  // Load existing quotation amount for display in non-quotation stages
  useEffect(() => {
    if (!trackId) return;
    const loadQuotationAmount = async () => {
      const { data } = await supabase
        .from("quotations")
        .select("total_amount, currency")
        .eq("track_id", trackId)
        .maybeSingle();
      if (data) {
        setQuotationAmount(data.total_amount);
        setQuotationCurrency(data.currency || "USD");
      }
    };
    loadQuotationAmount();
  }, [trackId]);

  // Helper functions for files
  const isImageFile = (filePath) => {
    const ext = filePath.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  };

  const getFileUrl = (filePath) => {
    const { data } = supabase.storage
      .from("crm-files")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  // File upload handler
  const handleFileUpload = async () => {
    if (!fileUpload || !currentUser) return;

    try {
      setUploadingFile(true);
      
      // Generate unique file name
      const fileExt = fileUpload.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `stage-files/${stageId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("crm-files")
        .upload(filePath, fileUpload);

      if (uploadError) throw uploadError;

      // Insert file record into database using RPC function
      const { error: dbError } = await supabase.rpc("add_stage_file", {
        p_track_stage_id: stageId,
        p_file_path: filePath,
        p_label: fileLabel.trim() || fileUpload.name,
        p_user: currentUser.id
      });

      if (dbError) throw dbError;

      // Reset form and reload data
      setFileUpload(null);
      setFileLabel("");
      const { data } = await supabase.rpc("get_stage_detail", {
        p_track_stage_id: stageId
      });
      setStageDetail(data);
      sileo.success({ title: "File uploaded" });
    } catch (err) {
      sileo.error({ title: "Upload failed", description: err.message });
      setError(err.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  // File download handler
  const handleDownloadFile = async (file) => {
    try {
      const { data, error } = await supabase.storage
        .from("crm-files")
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.label || file.file_path.split("/").pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download file");
    }
  };

  // File preview handler
  const handlePreviewFile = (file) => {
    setPreviewFile(file);
  };

  // Add comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentDraft.trim() || busy) return;
    
    try {
      setBusy(true);
      
      // Get current user
      const { data: { session: _s } } = await supabase.auth.getSession(); const user = _s?.user;
      if (!user) throw new Error("User not authenticated");
      
      // Convert clean @filename mentions to UUID storage format
      const storageText = convertMentionsForStorage(commentDraft.trim());
      
      await supabase.rpc("add_stage_comment", {
        p_track_stage_id: stageId,
        p_body: storageText,
        p_user: user.id
      });
      
      // Reload stage detail
      const { data } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(data);
      setCommentDraft("");
      setReplyingTo(null);
      onUpdate?.(); // Refresh parent component
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Edit comment
  const handleEditComment = async (commentId) => {
    try {
      setBusy(true);
      
      // Get current user
      const { data: { session: _s } } = await supabase.auth.getSession(); const user = _s?.user;
      if (!user) throw new Error("User not authenticated");
      
      // Convert clean @filename mentions to UUID storage format
      const storageText = convertMentionsForStorage(editCommentText.trim());
      
      // Try to call the RPC function
      const { data, error } = await supabase.rpc("update_stage_comment", {
        p_comment_id: commentId,
        p_new_body: storageText,
        p_user: user.id
      });
      
      if (error) {
        console.error("Update comment RPC error:", error);
        throw new Error(`Failed to update comment: ${error.message}`);
      }
      
      // Reload stage detail
      const { data: stageData } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(stageData);
      setEditingCommentId(null);
      setEditCommentText("");
      onUpdate?.();
    } catch (e) {
      console.error("Edit comment error:", e);
      setError(e.message || "Failed to edit comment");
    } finally {
      setBusy(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    
    try {
      setBusy(true);
      
      // Get current user
      const { data: { session: _s } } = await supabase.auth.getSession(); const user = _s?.user;
      if (!user) throw new Error("User not authenticated");
      
      // Try to call the RPC function
      const { data, error } = await supabase.rpc("delete_stage_comment", {
        p_comment_id: commentId,
        p_user: user.id
      });
      
      if (error) {
        console.error("Delete comment RPC error:", error);
        throw new Error(`Failed to delete comment: ${error.message}`);
      }
      
      // Reload stage detail
      const { data: stageData } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(stageData);
      onUpdate?.();
    } catch (e) {
      console.error("Delete comment error:", e);
      setError(e.message || "Failed to delete comment");
    } finally {
      setBusy(false);
    }
  };

  // Start editing comment
  const startEditingComment = (comment) => {
    setEditingCommentId(comment.id);
    // Convert from storage format to clean display format for editing
    const displayText = comment.body.replace(/@\{([a-f0-9\-]+):(.*?)\}/g, '@$2');
    setEditCommentText(displayText);
  };

  // Cancel editing comment
  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditCommentText("");
  };

  // Handle @ file mentions in comment
  const handleCommentTextChange = (e, isEdit = false) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    if (isEdit) {
      setEditCommentText(text);
    } else {
      setCommentDraft(text);
    }
    
    setCursorPosition(cursorPos);
    
    // Check for @ mentions
    const beforeCursor = text.substring(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1 && atIndex === beforeCursor.length - 1) {
      // Just typed @, show file mentions
      setShowFileMentions(true);
      setMentionQuery("");
    } else if (atIndex !== -1) {
      // Check if we're in the middle of a mention
      const afterAt = beforeCursor.substring(atIndex + 1);
      const spaceIndex = afterAt.indexOf(" ");
      
      if (spaceIndex === -1) {
        // Still typing mention
        setShowFileMentions(true);
        setMentionQuery(afterAt);
      } else {
        setShowFileMentions(false);
      }
    } else {
      setShowFileMentions(false);
    }
  };

  // Insert file mention
  const insertFileMention = (file, isEdit = false) => {
    const currentText = isEdit ? editCommentText : commentDraft;
    const beforeCursor = currentText.substring(0, cursorPosition);
    const afterCursor = currentText.substring(cursorPosition);
    
    // Find the @ that started the mention
    const atIndex = beforeCursor.lastIndexOf("@");
    const beforeAt = currentText.substring(0, atIndex);
    
    // Show only clean filename to user, but store UUID format for backend
    const fileName = file.label || file.file_path.split("/").pop();
    const mentionText = `@${fileName}`;  // Clean display format
    const newText = beforeAt + mentionText + " " + afterCursor;
    
    if (isEdit) {
      setEditCommentText(newText);
    } else {
      setCommentDraft(newText);
    }
    
    setShowFileMentions(false);
    setMentionQuery("");
  };

  // Parse file mentions in comment text
  const parseFileMentions = (text) => {
    // Updated regex to match UUID format (with hyphens)
    const mentionRegex = /@\{([a-f0-9\-]+):(.*?)\}/g;
    let lastIndex = 0;
    const parts = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: text.substring(lastIndex, match.index) });
      }
      
      // Add the mention
      parts.push({
        type: "mention",
        fileId: match[1],
        fileName: match[2],
        content: `@${match[2]}`
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.substring(lastIndex) });
    }
    
    return parts;
  };

  // Filter files for mentions
  const getFilteredFiles = () => {
    if (!stageDetail?.files) return [];
    
    return stageDetail.files.filter(file => {
      const fileName = file.label || file.file_path.split("/").pop();
      return fileName.toLowerCase().includes(mentionQuery.toLowerCase());
    });
  };

  // Convert clean @filename format to UUID storage format before saving
  const convertMentionsForStorage = (text) => {
    if (!stageDetail?.files) return text;
    
    // Replace @filename with @{uuid:filename} format
    let convertedText = text;
    
    // Find all @filename mentions
    const mentionRegex = /@([^@\s]+)/g;
    let match;
    const replacements = [];
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const fileName = match[1];
      // Find the file by filename
      const file = stageDetail.files.find(f => {
        const fName = f.label || f.file_path.split("/").pop();
        return fName === fileName;
      });
      
      if (file) {
        replacements.push({
          original: match[0],
          replacement: `@{${file.id}:${fileName}}`
        });
      }
    }
    
    // Apply replacements
    replacements.forEach(({ original, replacement }) => {
      convertedText = convertedText.replace(original, replacement);
    });
    
    return convertedText;
  };

  // Add todo
  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!todoDraft.trim() || busy) return;
    
    try {
      setBusy(true);
      
      // Get current user
      const { data: { session: _s } } = await supabase.auth.getSession(); const user = _s?.user;
      if (!user) throw new Error("User not authenticated");
      
      await supabase.rpc("add_stage_todo", {
        p_track_stage_id: stageId,
        p_title: todoDraft.trim(),
        p_due: newTodoDueDate || null,
        p_assignee: newTodoAssignee || null,
        p_user: user.id
      });

      // Reload stage detail
      const { data } = await supabase.rpc("get_stage_detail", {
        p_track_stage_id: stageId
      });
      setStageDetail(data);
      setTodoDraft("");
      setNewTodoDueDate("");
      setNewTodoAssignee("");
      sileo.success({ title: "Task added" });
      onUpdate?.();
    } catch (e) {
      sileo.error({ title: "Failed to add task", description: e.message });
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Toggle todo completion
  const handleToggleTodo = async (todoId, currentDone) => {
    try {
      setBusy(true);
      await supabase.rpc("update_stage_todo", {
        p_todo_id: todoId,
        p_done: !currentDone
      });

      const { data } = await supabase.rpc("get_stage_detail", {
        p_track_stage_id: stageId
      });
      setStageDetail(data);
      if (!currentDone) sileo.success({ title: "Task completed" });
    } catch (e) {
      sileo.error({ title: "Failed to update task", description: e.message });
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Complete stage and advance
  const handleCompleteStage = async () => {
    try {
      setBusy(true);
      await supabase.rpc("complete_stage_and_advance", {
        p_track_stage_id: stageId
      });
      sileo.success({ title: "Stage completed", description: "Moving to next stage" });
      onUpdate?.();
      onClose?.();
    } catch (e) {
      sileo.error({ title: "Failed to complete stage", description: e.message });
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!stageId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-end z-50 font-urbanist">
      <div className="w-[900px] h-full bg-white dark:bg-darkblack-600 shadow-xl flex flex-col border-l border-bgray-200 dark:border-darkblack-400">
        {/* Header */}
        <div className="border-b border-bgray-200 dark:border-darkblack-400">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">
                Stage Details
                {clientName && ` · ${clientName}`}
                {projectName && ` · ${projectName}`}
              </h2>
              {/* Order value badge — shown when quotation exists */}
              {quotationAmount != null && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-semibold">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Order: {quotationCurrency} {Number(quotationAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => setActiveTab("quotation")}
                    className="text-xs text-primary hover:underline"
                  >
                    View / Edit
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded-lg text-bgray-600 dark:text-bgray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs — show Quotation tab on all stages */}
          {stageDetail && trackId && (
            <div className="flex gap-0 px-6">
              {[
                { key: "details",  label: "Stage Details" },
                { key: "quotation", label: "📋 Quotation" },
                { key: "report",    label: "📄 Report" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-bgray-500 dark:text-bgray-400 hover:text-darkblack-700 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="spinner h-6 w-6 mr-3"></div>
              <span className="text-bgray-600 dark:text-bgray-300">Loading stage details...</span>
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-error-50 border border-error-200 rounded-lg text-error-300 text-sm m-6">
              {error}
            </div>
          )}

          {/* Quotation Tab */}
          {stageDetail && activeTab === "quotation" && trackId && (
            <div className="p-6">
              <QuotationForm
                trackId={trackId}
                clientName={clientName}
                projectName={projectName}
                onSaved={(amount, currency) => {
                  setQuotationAmount(amount);
                  setQuotationCurrency(currency);
                }}
                onClose={() => setActiveTab("details")}
              />
            </div>
          )}

          {/* Report Tab */}
          {stageDetail && activeTab === "report" && trackId && (
            <ReportTab
              trackId={trackId}
              projectName={projectName}
              clientName={clientName}
              onClose={onClose}
            />
          )}

          {stageDetail && activeTab === "details" && (
            <div className="grid grid-cols-2 gap-6 p-6 h-full">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Stage Info */}
                <div className="bg-bgray-50 dark:bg-darkblack-500 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-darkblack-700 dark:text-white mb-2">
                    {stageDetail.stage?.name}
                  </h3>
                  
                  
                  <div className="text-sm text-gray-600">
                    <p>Status: <span className="capitalize">{stageDetail.stage?.status?.replace("_", " ")}</span></p>
                    <p>Due: {stageDetail.stage?.due_date || "—"}</p>
                    {stageDetail.stage?.assignee_name && (
                      <p>Assigned to: {stageDetail.stage.assignee_name}</p>
                    )}
                  </div>
                </div>
                
                {/* Complete Stage Button */}
                <div>
                  {stageDetail.stage?.status === "in_progress" && (
                    <button
                      onClick={handleCompleteStage}
                      disabled={busy}
                      className="w-full py-2 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-green-700 transition"
                    >
                      {busy ? "Completing..." : "Complete & Advance to Next Stage"}
                    </button>
                  )}
                </div>

                {/* Todos Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Todos ({stageDetail.todos?.length || 0})</h4>
                  </div>
                  
                  {/* Todo list */}
                  <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {stageDetail.todos?.map((todo) => {
                      const assigneeProfile = profiles.find(p => p.id === todo.assignee_user_id);
                      const creatorProfile = profiles.find(p => p.id === todo.created_by);
                      return (
                        <div key={todo.id} className="flex items-start gap-3 p-3 bg-white dark:bg-darkblack-500 rounded-lg border border-bgray-200 dark:border-darkblack-400">
                          <input
                            type="checkbox"
                            checked={todo.is_done}
                            onChange={() => handleToggleTodo(todo.id, todo.is_done)}
                            className="mt-0.5 rounded border-bgray-300 text-primary focus:ring-primary"
                            disabled={busy}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${todo.is_done ? "line-through text-gray-500" : "text-darkblack-700 dark:text-white"}`}>
                              {todo.title}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {todo.due_date && (
                                <p className="text-xs text-gray-500">Due: {todo.due_date}</p>
                              )}
                              {assigneeProfile && (
                                <p className="text-xs text-violet-600 dark:text-violet-400">
                                  Assigned to: {assigneeProfile.full_name}
                                </p>
                              )}
                              {creatorProfile && (
                                <p className="text-xs text-gray-400">
                                  By: {creatorProfile.full_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add todo form */}
                  <form onSubmit={handleAddTodo} className="space-y-2">
                    <input
                      type="text"
                      value={todoDraft}
                      onChange={(e) => setTodoDraft(e.target.value)}
                      placeholder="Add a todo..."
                      disabled={busy}
                      className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white placeholder-bgray-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newTodoDueDate}
                        onChange={(e) => setNewTodoDueDate(e.target.value)}
                        disabled={busy}
                        className="flex-1 px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white"
                      />
                      <select
                        value={newTodoAssignee}
                        onChange={(e) => setNewTodoAssignee(e.target.value)}
                        disabled={busy}
                        className="flex-1 px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white"
                      >
                        <option value="">Assign to...</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={!todoDraft.trim() || busy}
                      className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {busy ? "Adding..." : "Add"}
                    </button>
                  </form>
                </div>

                {/* Key Dates Section */}
                {trackId && (
                  <div className="pt-2 border-t border-bgray-100 dark:border-darkblack-500">
                    <KeyDatesSection trackId={trackId} />
                  </div>
                )}

              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Files Section */}
                <div>
                  <h4 className="font-medium mb-3">Files ({stageDetail.files?.length || 0})</h4>
                  
                  {/* File Upload Form */}
                  <div className="mb-4 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                    <input
                      type="file"
                      onChange={(e) => setFileUpload(e.target.files[0])}
                      disabled={uploadingFile}
                      className="block w-full text-sm text-gray-500 mb-2 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                      accept="*/*"
                    />
                    {fileUpload && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={fileLabel}
                          onChange={(e) => setFileLabel(e.target.value)}
                          placeholder="File label (optional)"
                          disabled={uploadingFile}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-2 disabled:bg-gray-50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleFileUpload}
                            disabled={uploadingFile || !fileUpload}
                            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center"
                          >
                            {uploadingFile && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            )}
                            {uploadingFile ? "Uploading..." : "Upload File"}
                          </button>
                          <button
                            onClick={() => {
                              setFileUpload(null);
                              setFileLabel("");
                            }}
                            disabled={uploadingFile}
                            className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Files List */}
                  {stageDetail.files?.length > 0 && (
                    <div className="space-y-2">
                      {stageDetail.files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{file.label || file.file_path.split("/").pop()}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded by {file.uploaded_by_name || "Unknown"} on {new Date(file.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {isImageFile(file.file_path) && (
                              <button
                                onClick={() => handlePreviewFile(file)}
                                className="text-blue-600 text-sm hover:underline"
                              >
                                Preview
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadFile(file)}
                              className="text-green-600 text-sm hover:underline"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comments Section — Instagram bottom-sheet style */}
                <div className="bg-white dark:bg-darkblack-600 rounded-t-2xl shadow-lg border border-bgray-100 dark:border-darkblack-400 flex flex-col" style={{ maxHeight: "420px" }}>

                  {/* Drag handle */}
                  <div className="flex justify-center pt-2 pb-1">
                    <div className="w-10 h-1 rounded-full bg-bgray-300 dark:bg-darkblack-400"></div>
                  </div>

                  {/* Centered header */}
                  <div className="flex items-center justify-center gap-2 pb-2">
                    <h4 className="text-sm font-semibold text-darkblack-700 dark:text-white">Comments</h4>
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bgray-100 dark:bg-darkblack-500 text-xs text-bgray-500 dark:text-bgray-300">
                      {stageDetail.comments?.length || 0}
                    </span>
                  </div>

                  {/* Scrollable comment list — fills remaining space */}
                  <div className="flex-1 overflow-y-auto divide-y divide-bgray-100 dark:divide-darkblack-400 px-3">
                    {stageDetail.comments?.length === 0 && (
                      <p className="text-xs text-bgray-400 dark:text-bgray-500 text-center py-5">No comments yet. Be the first!</p>
                    )}
                    {stageDetail.comments?.map((comment) => {
                      const userName = comment.user_name ||
                        (comment.user_id === currentUser?.id ? (currentUser?.email?.split("@")[0] || "You") : "Unknown");
                      const initials = userName.slice(0, 2).toUpperCase();
                      const colors = ["from-purple-400 to-pink-400","from-blue-400 to-cyan-400","from-emerald-400 to-teal-400","from-orange-400 to-rose-400","from-indigo-400 to-violet-400"];
                      const colorClass = colors[userName.charCodeAt(0) % colors.length];
                      const isLiked = !!likedComments[comment.id];
                      const likeCount = isLiked ? 1 : 0;

                      const getRelativeTime = (date) => {
                        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
                        if (seconds < 60) return "just now";
                        const minutes = Math.floor(seconds / 60);
                        if (minutes < 60) return minutes === 1 ? "1m" : `${minutes}m`;
                        const hours = Math.floor(minutes / 60);
                        if (hours < 24) return hours === 1 ? "1h" : `${hours}h`;
                        const days = Math.floor(hours / 24);
                        if (days < 7) return days === 1 ? "1d" : `${days}d`;
                        return new Date(date).toLocaleDateString();
                      };

                      return (
                        <div key={comment.id} className="flex items-start gap-3 py-3 group">
                          {/* Avatar */}
                          <div className={`shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-sm`}>
                            <span className="text-white text-xs font-semibold">{initials}</span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {editingCommentId === comment.id ? (
                              /* ── Edit mode ── */
                              <div className="space-y-2">
                                <div className="relative">
                                  <textarea
                                    value={editCommentText}
                                    onChange={(e) => handleCommentTextChange(e, true)}
                                    rows={2}
                                    autoFocus
                                    className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-xl text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent bg-bgray-50 dark:bg-darkblack-600 text-darkblack-700 dark:text-white"
                                  />
                                  {showFileMentions && getFilteredFiles().length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                      {getFilteredFiles().map(file => (
                                        <button
                                          key={file.id}
                                          onClick={() => insertFileMention(file, true)}
                                          className="w-full text-left px-3 py-2 hover:bg-bgray-50 dark:hover:bg-darkblack-400 text-sm flex items-center gap-2"
                                        >
                                          <svg className="w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          {file.label || file.file_path.split("/").pop()}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => handleEditComment(comment.id)}
                                    disabled={!editCommentText.trim() || busy}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-500 disabled:opacity-40 transition-colors"
                                  >
                                    {busy ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    onClick={cancelEditingComment}
                                    className="text-xs text-bgray-400 dark:text-bgray-500 hover:text-bgray-600 dark:hover:text-bgray-300 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── Display mode ── */
                              <>
                                {/* username + text inline */}
                                <p className="text-sm leading-snug">
                                  <span className="font-semibold text-darkblack-700 dark:text-white">{userName} </span>
                                  <span className="text-bgray-600 dark:text-bgray-300">
                                    {parseFileMentions(comment.body).map((part, index) => (
                                      part.type === "mention" ? (
                                        <button
                                          key={index}
                                          onClick={() => {
                                            const file = stageDetail.files?.find(f => f.id === part.fileId);
                                            if (file) setPreviewFile(file);
                                          }}
                                          className="text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                                        >
                                          {part.content}
                                        </button>
                                      ) : (
                                        <span key={index}>{part.content}</span>
                                      )
                                    ))}
                                  </span>
                                </p>

                                {/* time · heart · like count · Reply row */}
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-xs text-bgray-400 dark:text-bgray-500">
                                    {getRelativeTime(comment.created_at)}
                                    {comment.updated_at && comment.updated_at !== comment.created_at && (
                                      <span className="ml-1 italic">(edited)</span>
                                    )}
                                  </span>

                                  {/* Heart like button */}
                                  <button
                                    type="button"
                                    onClick={() => setLikedComments(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                    className="flex items-center gap-1 transition-transform active:scale-90"
                                  >
                                    <svg
                                      className={`w-3.5 h-3.5 transition-colors ${isLiked ? "fill-red-500 text-red-500" : "fill-none text-bgray-400 dark:text-bgray-500 hover:text-red-400"}`}
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                  </button>

                                  {/* Like count */}
                                  {likeCount > 0 && (
                                    <span className="text-xs font-semibold text-darkblack-700 dark:text-white">{likeCount} like</span>
                                  )}

                                  {/* Reply */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingTo({ id: comment.id, userName });
                                      setCommentDraft(`@${userName} `);
                                      setTimeout(() => commentInputRef.current?.focus(), 0);
                                    }}
                                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors"
                                  >
                                    Reply
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* ··· menu — own comments only */}
                          {comment.user_id === currentUser?.id && editingCommentId !== comment.id && (
                            <div className="relative shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenu(activeMenu === comment.id ? null : comment.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-bgray-100 dark:hover:bg-darkblack-400 text-bgray-400 dark:text-bgray-500"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="5" r="1.5" />
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>
                              {activeMenu === comment.id && (
                                <div className="absolute right-0 top-6 z-10 w-28 bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-lg overflow-hidden">
                                  <button
                                    onClick={() => { startEditingComment(comment); setActiveMenu(null); }}
                                    className="w-full text-left px-4 py-2 text-sm text-darkblack-700 dark:text-white hover:bg-bgray-50 dark:hover:bg-darkblack-400 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => { handleDeleteComment(comment.id); setActiveMenu(null); }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Pinned bottom input bar ── */}
                  <div className="border-t border-bgray-100 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 rounded-b-0 px-3 py-2.5">
                    {/* Replying-to pill */}
                    {replyingTo && (
                      <div className="flex items-center justify-between mb-1.5 px-1">
                        <span className="text-xs text-bgray-500 dark:text-bgray-400">
                          Replying to <span className="font-semibold text-darkblack-700 dark:text-white">@{replyingTo.userName}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setReplyingTo(null); setCommentDraft(""); }}
                          className="text-xs text-bgray-400 dark:text-bgray-500 hover:text-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleAddComment} className="flex items-center gap-3">
                      {/* Current user avatar */}
                      <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-sm">
                        <span className="text-white text-xs font-semibold">
                          {currentUser?.email?.slice(0, 2).toUpperCase() || "ME"}
                        </span>
                      </div>

                      {/* Input + mention dropdown */}
                      <div className="relative flex-1">
                        <input
                          ref={commentInputRef}
                          type="text"
                          value={commentDraft}
                          onChange={(e) => handleCommentTextChange(e, false)}
                          placeholder="Add a comment..."
                          disabled={busy}
                          className="w-full px-4 py-2 rounded-full border border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-600 text-sm text-darkblack-700 dark:text-white placeholder-bgray-400 dark:placeholder-bgray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                        />
                        {/* File mention dropdown — pops above input */}
                        {showFileMentions && getFilteredFiles().length > 0 && (
                          <div className="absolute bottom-full mb-2 left-0 w-full bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                            {getFilteredFiles().map(file => (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => insertFileMention(file, false)}
                                className="w-full text-left px-3 py-2 hover:bg-bgray-50 dark:hover:bg-darkblack-400 text-sm flex items-center gap-2"
                              >
                                <svg className="w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {file.label || file.file_path.split("/").pop()}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Post button — IG blue text link */}
                      <button
                        type="submit"
                        disabled={!commentDraft.trim() || busy}
                        className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        {busy ? "..." : "Post"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced File Preview Modal */}
      {previewFile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" 
          onClick={() => setPreviewFile(null)}
        >
          <div 
            className="max-w-5xl max-h-5xl w-full mx-4 bg-white dark:bg-darkblack-600 rounded-lg shadow-xl" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-bgray-200 dark:border-darkblack-400">
              <h3 className="font-semibold text-lg text-darkblack-700 dark:text-white">
                {previewFile.label || previewFile.file_path.split("/").pop()}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadFile(previewFile)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 max-h-[70vh] overflow-auto">
              {isImageFile(previewFile.file_path) ? (
                <img
                  src={getFileUrl(previewFile.file_path)}
                  alt={previewFile.label || "Preview"}
                  className="max-w-full h-auto rounded-lg mx-auto"
                />
              ) : previewFile.file_path.endsWith('.pdf') ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-bgray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-bgray-600 dark:text-bgray-300 mb-4">PDF Document</p>
                  <a
                    href={getFileUrl(previewFile.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-bgray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-bgray-600 dark:text-bgray-300 mb-4">
                    File Type: {previewFile.file_path.split('.').pop()?.toUpperCase() || 'Unknown'}
                  </p>
                  <p className="text-sm text-bgray-500 dark:text-bgray-400 mb-4">
                    This file type cannot be previewed. You can download it to view the contents.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}