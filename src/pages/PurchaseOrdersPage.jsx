import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const CURRENCY_SYMBOL = { USD: "$", COP: "$", EUR: "€", CNY: "¥", HKD: "HK$" };

const formatMoney = (amount, currency) => {
  const sym = CURRENCY_SYMBOL[currency] || "";
  return `${sym}${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          purchase_order_items (id, quantity, price),
          purchase_order_payments (id, amount)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const trackIds = [...new Set((data || []).map(po => po.track_id).filter(Boolean))];
      const supplierIds = [...new Set((data || []).map(po => po.supplier_id).filter(Boolean))];

      let tracksMap = {};
      if (trackIds.length > 0) {
        const { data: tracksData } = await supabase.from("v_tracks_overview").select("track_name, client_name, track_id").in("track_id", trackIds);
        tracksMap = Object.fromEntries((tracksData || []).map(t => [t.track_id, t]));
      }
      let suppliersMap = {};
      if (supplierIds.length > 0) {
        const { data: supData } = await supabase.from("suppliers").select("id, name").in("id", supplierIds);
        suppliersMap = Object.fromEntries((supData || []).map(s => [s.id, s]));
      }

      const enriched = (data || []).map(po => {
        const total = (po.purchase_order_items || []).reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (it.quantity || 1), 0);
        const paid = (po.purchase_order_payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        return {
          ...po,
          track_name: tracksMap[po.track_id]?.track_name || "—",
          client_name: tracksMap[po.track_id]?.client_name || "—",
          supplier_name: suppliersMap[po.supplier_id]?.name || "—",
          item_count: po.purchase_order_items?.length || 0,
          total,
          paid,
        };
      });
      setOrders(enriched);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filtered = orders.filter(po => {
    if (!search) return true;
    const s = search.toLowerCase();
    return po.po_number?.toLowerCase().includes(s) || po.track_name?.toLowerCase().includes(s) || po.supplier_name?.toLowerCase().includes(s);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Purchase Orders</h1>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">Orders placed with suppliers, split by factory</p>
        </div>
        <button
          onClick={() => navigate("/purchase-orders/new")}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Purchase Order
        </button>
      </div>

      <div className="mb-5">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by PO #, project, supplier..."
            className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
          />
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{error}</div>}

      <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-500">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">PO #</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Supplier</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Project</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Items</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Total</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Paid</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-bgray-500">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span className="text-sm">Loading purchase orders...</span>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-bgray-400 text-sm">
                  {orders.length === 0 ? "No purchase orders yet." : "No results match your search."}
                </td></tr>
              ) : (
                filtered.map(po => (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    className="border-b border-bgray-100 dark:border-darkblack-400 hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4"><span className="font-mono text-sm font-semibold text-darkblack-700 dark:text-white">{po.po_number}</span></td>
                    <td className="px-5 py-4"><span className="text-sm text-darkblack-700 dark:text-white">🏭 {po.supplier_name}</span></td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-bgray-600 dark:text-bgray-300">{po.track_name}</p>
                      <p className="text-xs text-bgray-400">{po.client_name}</p>
                    </td>
                    <td className="px-5 py-4"><span className="text-sm text-bgray-600 dark:text-bgray-300">{po.item_count}</span></td>
                    <td className="px-5 py-4 text-right"><span className="text-sm font-bold text-darkblack-700 dark:text-white">{formatMoney(po.total, po.currency)}</span></td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-sm font-semibold ${po.paid >= po.total && po.total > 0 ? "text-green-600" : "text-amber-600"}`}>
                        {formatMoney(po.paid, po.currency)}
                      </span>
                    </td>
                    <td className="px-5 py-4"><span className="text-xs text-bgray-500 dark:text-bgray-400">{new Date(po.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-bgray-100 dark:border-darkblack-400 text-xs text-bgray-400 dark:text-bgray-500">
            Showing {filtered.length} of {orders.length} purchase order{orders.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
