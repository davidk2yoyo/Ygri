import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import QuotationPDF from "../components/QuotationPDF";

const CURRENCY_SYMBOL = { USD: "$", COP: "$", EUR: "€", CNY: "¥", HKD: "HK$" };

const formatMoney = (amount, currency) => {
  const sym = CURRENCY_SYMBOL[currency] || "";
  return `${sym}${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [search, setSearch] = useState("");
  const [pdfData, setPdfData] = useState(null); // { quotation, items, clientName, projectName }

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("quotations")
        .select(`
          *,
          quotation_items (*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Enrich with track/client info via tracks table
      const enriched = await Promise.all((data || []).map(async (q) => {
        // Try to get track name and client name
        const { data: trackData } = await supabase
          .from("v_tracks_overview")
          .select("track_name, company_name, track_id")
          .eq("track_id", q.track_id)
          .maybeSingle();
        return {
          ...q,
          track_name: trackData?.track_name || "—",
          company_name: trackData?.company_name || "—",
        };
      }));
      setQuotations(enriched);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQuotations(); }, [loadQuotations]);

  // Totals per currency
  const totals = quotations.reduce((acc, q) => {
    acc[q.currency] = (acc[q.currency] || 0) + Number(q.total_amount || 0);
    return acc;
  }, {});

  // Filter
  const filtered = quotations.filter(q => {
    if (filterType !== "all" && q.type !== filterType) return false;
    if (filterCurrency !== "all" && q.currency !== filterCurrency) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !q.quote_number?.toLowerCase().includes(s) &&
        !q.track_name?.toLowerCase().includes(s) &&
        !q.company_name?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const handlePreviewPDF = (q) => {
    setPdfData({
      quotation: q,
      items: (q.quotation_items || []).map(it => ({ ...it, tempId: it.id, picturePreview: it.picture_url || "" })),
      clientName: q.company_name,
      projectName: q.track_name,
      totalAmount: Number(q.total_amount || 0),
    });
  };

  if (pdfData) {
    return (
      <QuotationPDF
        quotation={pdfData.quotation}
        items={pdfData.items}
        clientName={pdfData.clientName}
        projectName={pdfData.projectName}
        totalAmount={pdfData.totalAmount}
        onClose={() => setPdfData(null)}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Invoices & Quotations</h1>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">All commercial quotations across projects</p>
        </div>
      </div>

      {/* Revenue summary cards */}
      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          {Object.entries(totals).map(([currency, total]) => (
            <div key={currency} className="bg-white dark:bg-darkblack-600 rounded-xl border border-bgray-200 dark:border-darkblack-400 px-5 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                <span className="text-amber-600 font-bold text-sm">{CURRENCY_SYMBOL[currency] || currency}</span>
              </div>
              <div>
                <p className="text-xs text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">{currency} Total</p>
                <p className="text-lg font-bold text-darkblack-700 dark:text-white">{formatMoney(total, currency)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by quote #, client, project..."
            className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
          />
        </div>

        {/* Type filter */}
        <div className="flex rounded-lg border border-bgray-300 dark:border-darkblack-400 overflow-hidden">
          {[["all", "All"], ["product", "📦 Product"], ["service", "🔧 Service"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterType(val)}
              className={`px-3 py-2 text-sm font-medium transition ${
                filterType === val
                  ? "bg-primary text-white"
                  : "bg-white dark:bg-darkblack-600 text-bgray-600 dark:text-bgray-300 hover:bg-bgray-50 dark:hover:bg-darkblack-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Currency filter */}
        <select
          value={filterCurrency}
          onChange={e => setFilterCurrency(e.target.value)}
          className="px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
        >
          <option value="all">All currencies</option>
          {["USD", "COP", "EUR", "CNY", "HKD"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-500">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Quote #</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Client</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Project</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Items</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Total</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Date</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-bgray-500">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      <span className="text-sm">Loading quotations...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-bgray-400 text-sm">
                    {quotations.length === 0 ? "No quotations yet." : "No results match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.id} className="border-b border-bgray-100 dark:border-darkblack-400 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-semibold text-darkblack-700 dark:text-white">{q.quote_number}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-darkblack-700 dark:text-white">{q.company_name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-bgray-600 dark:text-bgray-300">{q.track_name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        q.type === "product"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-purple-50 text-purple-700"
                      }`}>
                        {q.type === "product" ? "📦 Product" : "🔧 Service"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-bgray-600 dark:text-bgray-300">{q.quotation_items?.length || 0}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-bold text-darkblack-700 dark:text-white">
                        {q.currency} {formatMoney(q.total_amount, q.currency)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-bgray-500 dark:text-bgray-400">
                        {new Date(q.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePreviewPDF(q)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition"
                          style={{ backgroundColor: "#1e3a5f" }}
                          title="Preview PDF"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          PDF
                        </button>
                        <button
                          onClick={() => navigate("/projects", { state: { activeTrackId: q.track_id, openQuotation: true } })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                          title="Edit in project"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-bgray-100 dark:border-darkblack-400 text-xs text-bgray-400 dark:text-bgray-500">
            Showing {filtered.length} of {quotations.length} quotation{quotations.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
