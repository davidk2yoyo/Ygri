import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function reportNumber(report) {
  // e.g. IR-2026-001 based on created_at year + sequential id (last 3 digits)
  const year = report.created_at ? new Date(report.created_at).getFullYear() : "—";
  const seq = String(report.id ?? "").slice(-6).replace(/\D/g, "").padStart(3, "0") || "001";
  return `IR-${year}-${seq}`;
}

const STATUS_CONFIG = {
  draft: { label: "Draft", classes: "bg-gray-100 text-gray-600 dark:bg-darkblack-500 dark:text-bgray-400" },
  approved: { label: "Approved", classes: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  approved_with_observations: { label: "Approved w/ Obs.", classes: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  rejected: { label: "Rejected", classes: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ─── New Report Modal ────────────────────────────────────────────────────────

const EMPTY_FORM = { title: "", supplier_name: "", visit_date: "", inspector_name: "" };

function NewReportModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        supplier_name: form.supplier_name.trim() || null,
        visit_date: form.visit_date || null,
        inspector_name: form.inspector_name.trim() || null,
      };
      const { data, error: dbErr } = await supabase
        .from("inspection_reports")
        .insert(payload)
        .select()
        .single();
      if (dbErr) throw dbErr;
      onCreated(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-darkblack-600 rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-bgray-200 dark:border-darkblack-400">
          <h2 className="text-lg font-bold text-darkblack-700 dark:text-white">New Inspection Report</h2>
          <button
            onClick={onClose}
            className="text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-200 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">
              Report Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g. Factory Inspection – June 2026"
              autoFocus
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">
              Supplier Name
            </label>
            <input
              type="text"
              value={form.supplier_name}
              onChange={e => set("supplier_name", e.target.value)}
              placeholder="Supplier Co. Ltd"
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">
              Visit Date
            </label>
            <input
              type="date"
              value={form.visit_date}
              onChange={e => set("visit_date", e.target.value)}
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">
              Inspector Name
            </label>
            <input
              type="text"
              value={form.inspector_name}
              onChange={e => set("inspector_name", e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || busy}
              className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {busy ? "Creating..." : "Create & Edit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Report Card ─────────────────────────────────────────────────────────────

function ReportCard({ report, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-darkblack-600 rounded-xl border border-bgray-200 dark:border-darkblack-400 p-5 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
    >
      {/* Top row: badge + status */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-mono font-semibold text-bgray-500 dark:text-bgray-400 bg-bgray-100 dark:bg-darkblack-500 px-2.5 py-1 rounded-lg">
          {reportNumber(report)}
        </span>
        <StatusBadge status={report.status || "draft"} />
      </div>

      {/* Title */}
      <h3 className="font-semibold text-darkblack-700 dark:text-white text-sm mb-3 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
        {report.title}
      </h3>

      {/* Details */}
      <div className="space-y-1.5">
        {report.supplier_name && (
          <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="truncate">{report.supplier_name}</span>
          </div>
        )}

        {report.visit_date && (
          <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(report.visit_date)}</span>
          </div>
        )}

        {report.inspector_name && (
          <div className="flex items-center gap-2 text-xs text-bgray-500 dark:text-bgray-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="truncate">{report.inspector_name}</span>
          </div>
        )}
      </div>

      {/* Footer: created date + arrow */}
      <div className="mt-4 pt-3 border-t border-bgray-100 dark:border-darkblack-400 flex items-center justify-between">
        <span className="text-xs text-bgray-400 dark:text-bgray-500">
          Created {formatDate(report.created_at)}
        </span>
        <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-1">
          Open
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InspectionReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: dbErr } = await supabase
          .from("inspection_reports")
          .select("*")
          .order("created_at", { ascending: false });
        if (dbErr) throw dbErr;
        if (!cancelled) setReports(data || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleCreated = (newReport) => {
    setShowModal(false);
    navigate(`/reports/${newReport.id}/edit`, { state: { from: "/reports" } });
  };

  const handleCardClick = (report) => {
    navigate(`/reports/${report.id}/edit`, { state: { from: "/reports" } });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Inspection Reports</h1>
          {!loading && (
            <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">
              {reports.length} report{reports.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Report
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-5">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-bgray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-sm">Loading reports...</span>
        </div>
      ) : reports.length === 0 ? (
        /* Empty state */
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-bgray-100 dark:bg-darkblack-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-bgray-600 dark:text-bgray-400 font-medium mb-1">No inspection reports yet</p>
          <p className="text-bgray-400 dark:text-bgray-500 text-sm mb-5">Get started by creating your first report.</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
          >
            Create your first report
          </button>
        </div>
      ) : (
        /* Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {reports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              onClick={() => handleCardClick(report)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NewReportModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
