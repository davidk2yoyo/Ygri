import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";
import { ShipmentCard } from "./MisEnviosPage";
import { SupplierProductionCard } from "../../components/ProductionBoard";
import PackingListPDF from "../../components/PackingListPDF";
import { exportPackingListExcel } from "../../lib/packingListExcel";
import { exportQuotationExcel, fetchPortalQuotation, readyNumbersFromPOs } from "../../lib/quotationExcel";

// track_stages.status is one of these four — NOT "pending" (that key never matched,
// so a not-yet-started stage leaked the raw DB string straight into the UI).
const STAGE_COLOR = {
  done: "bg-green-500",
  in_progress: "bg-blue-500",
  blocked: "bg-red-500",
  not_started: "bg-gray-200",
};
const STAGE_LABEL = { done: "Completado", in_progress: "En proceso", blocked: "Bloqueado", not_started: "Pendiente" };
const STAGE_BADGE = {
  done: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  blocked: "bg-red-100 text-red-700",
  not_started: "bg-gray-100 text-gray-500",
};
// stage_templates.name is plain English, stored once in the database with no
// translation layer — and the staff Kanban (PipelineView.jsx's PIPELINES
// constant) string-matches against these exact English names to group its
// columns, so they can't be renamed in the database without breaking that.
// This translates them for display here only.
const STAGE_NAME_ES = {
  "Lead or Inquiry": "Consulta inicial",
  "Quotation": "Cotización",
  "Service delivery": "Entrega del servicio",
  "Payment": "Pago",
  "Samples approval": "Aprobación de muestras",
  "Deposit payment": "Pago de anticipo",
  "Production": "Producción",
  "Goods inspection": "Inspección de mercancía",
  "Balance payment": "Pago final",
  "Shipment": "Envío",
};
const DOC_LABEL = { quotation: "Cotización", proforma: "Proforma", invoice: "Factura comercial" };
const TRACK_STATUS = {
  active: "bg-blue-100 text-blue-700", completed: "bg-green-100 text-green-700",
  on_hold: "bg-amber-100 text-amber-700", cancelled: "bg-red-100 text-red-700",
};
const TRACK_STATUS_LABEL = { active: "Activa", completed: "Completada", on_hold: "En pausa", cancelled: "Cancelada" };

const money = (n, cur) => `${cur || ""} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "";

function StageTimeline({ stages }) {
  if (!stages?.length) return <p className="text-xs text-gray-400">Sin etapas definidas</p>;
  return (
    <ol className="space-y-2">
      {stages.map(s => (
        <li key={s.id} className="flex items-center gap-3">
          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${STAGE_COLOR[s.status] || STAGE_COLOR.not_started} ${s.status === "in_progress" ? "animate-pulse" : ""}`}>
            {s.status === "done" && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
            )}
          </span>
          <span className={`text-sm flex-1 ${s.status === "not_started" ? "text-gray-400" : "text-gray-800 font-medium"}`}>{STAGE_NAME_ES[s.name] || s.name}</span>
          {s.due_date && s.status !== "done" && <span className="text-xs text-gray-400">{fmtDate(s.due_date)}</span>}
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STAGE_BADGE[s.status] || STAGE_BADGE.not_started}`}>
            {STAGE_LABEL[s.status] || s.status}
          </span>
        </li>
      ))}
    </ol>
  );
}

function OrderCard({ order, profile }) {
  const { session } = useClientPortal();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("progress");
  const [pdfPacking, setPdfPacking] = useState(null); // the packing list currently shown as PDF, or null
  const [excelBusy, setExcelBusy] = useState(null);
  const downloadExcel = async (pl) => {
    setExcelBusy(pl.id);
    try {
      await exportPackingListExcel({
        packingList: pl, items: pl.items, supplierTotals: pl.supplier_totals || [], clientName: session.client_name,
        clientDetails: profile, projectName: order.track_name, quoteNumber: pl.quote_number, notes: pl.notes,
      });
    } catch (e) { window.alert("No pudimos generar el Excel: " + (e.message || e)); }
    finally { setExcelBusy(null); }
  };
  const [quoteBusy, setQuoteBusy] = useState(null); // `${quotationId}:all|ready`
  const downloadQuoteExcel = async (q, readyOnly) => {
    setQuoteBusy(`${q.id}:${readyOnly ? "ready" : "all"}`);
    try {
      const detail = await fetchPortalQuotation(supabase, session.session_id, q.id);
      await exportQuotationExcel({
        quotation: detail.quotation, items: detail.items, payments: detail.payments,
        clientName: session.client_name, clientDetails: profile, projectName: order.track_name,
        readyNumbers: readyNumbersFromPOs(order.purchase_orders), readyOnly,
      });
    } catch (e) { window.alert("No pudimos generar el Excel: " + (e.message || e)); }
    finally { setQuoteBusy(null); }
  };
  const tabs = [
    ["progress", "Progreso"],
    ["production", `Producción (${order.purchase_orders.length})`],
    ["quotes", `Cotizaciones y facturas (${order.quotations.length})`],
    ["packing", `Packing List (${order.packing_lists.length})`],
    ["shipments", `Envíos y muestras (${order.shipments.length})`],
    ["docs", `Documentos (${order.documents.length})`],
  ];
  const current = order.stages.find(s => s.status === "in_progress");
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left p-5 hover:bg-gray-50 transition">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{order.track_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {current ? `Etapa actual: ${STAGE_NAME_ES[current.name] || current.name}` : TRACK_STATUS_LABEL[order.status] || order.status} · desde {fmtDate(order.created_at)}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${TRACK_STATUS[order.status] || "bg-gray-100 text-gray-600"}`}>
            {TRACK_STATUS_LABEL[order.status] || order.status}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${order.progress_pct || 0}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-600 w-10 text-right">{Math.round(order.progress_pct || 0)}%</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5">
          <div className="flex gap-1 flex-wrap mb-4">
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "progress" && <StageTimeline stages={order.stages} />}

          {tab === "production" && (order.purchase_orders.length === 0
            ? <p className="text-sm text-gray-400">Aún no hay órdenes de compra en producción.</p>
            : <div className="space-y-3">{order.purchase_orders.map(po => <SupplierProductionCard key={po.id} po={po} readOnly />)}</div>)}

          {tab === "quotes" && (order.quotations.length === 0
            ? <p className="text-sm text-gray-400">Aún no hay cotizaciones publicadas.</p>
            : <div className="space-y-3">
                {order.quotations.map(q => {
                  const total = Number(q.total_amount || 0);
                  const paid = Number(q.paid_total || 0);
                  const readyValue = Number(q.ready_value || 0);
                  const depositPct = Number(q.deposit_pct || 0) / 100;
                  const balanceTotal = Math.max(total - paid, 0);
                  // The deposit is a down payment on the WHOLE order, not specifically on
                  // the items that happen to be ready — so it isn't fair to subtract the
                  // full paid amount from readyValue. Only payments beyond what the
                  // deposit covers ("extra") count against the ready items' non-deposit share.
                  const depositDue = total * depositPct;
                  const extraPaid = Math.max(paid - depositDue, 0);
                  const readyBalance = Math.max(readyValue * (1 - depositPct) - extraPaid, 0);
                  return (
                    <div key={q.id} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{q.quote_number}
                            <span className="ml-2 text-xs font-medium text-gray-500">{DOC_LABEL[q.document_type] || "Cotización"}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {[q.incoterm, q.delivery_time].filter(Boolean).join(" · ") || fmtDate(q.created_at)}
                            {depositPct > 0 && <span className="text-gray-400"> · Anticipo {q.deposit_pct}%</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-gray-900">{money(total, q.currency)}</span>
                          <a href={`/q/${q.quote_number}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-700">Ver</a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap px-4 pb-3">
                        <button onClick={() => downloadQuoteExcel(q, false)} disabled={!!quoteBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-60">
                          {quoteBusy === `${q.id}:all` ? "Generando…" : "⬇ Excel completo"}
                        </button>
                        {readyValue > 0 && (
                          <button onClick={() => downloadQuoteExcel(q, true)} disabled={!!quoteBusy}
                            title="Solo los productos que ya están listos en producción, con su balance"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 transition disabled:opacity-60">
                            {quoteBusy === `${q.id}:ready` ? "Generando…" : "⬇ Excel de lo ya listo"}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border-t border-gray-100 text-xs">
                        <div className="bg-white px-4 py-2.5">
                          <p className="text-gray-400">Pagado</p>
                          <p className="font-semibold text-green-700">{money(paid, q.currency)}</p>
                        </div>
                        <div className="bg-white px-4 py-2.5">
                          <p className="text-gray-400">Balance total</p>
                          <p className="font-semibold text-gray-900">{money(balanceTotal, q.currency)}</p>
                        </div>
                        <div className="bg-white px-4 py-2.5 col-span-2 sm:col-span-2">
                          <p className="text-gray-400">Balance de lo ya listo en producción</p>
                          <p className="font-semibold text-amber-700">{readyValue > 0 ? money(readyBalance, q.currency) : "—"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>)}

          {tab === "packing" && (order.packing_lists.length === 0
            ? <p className="text-sm text-gray-400">Aún no hay packing list publicado.</p>
            : <div className="space-y-4">
                {order.packing_lists.map(pl => (
                  <div key={pl.id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{pl.pl_number}</p>
                          <p className="text-xs text-gray-500">Cotización {pl.quote_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                      <button onClick={() => downloadExcel(pl)} disabled={excelBusy === pl.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:border-green-500 hover:text-green-600 transition shadow-sm whitespace-nowrap disabled:opacity-60">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1M7 11l5 5 5-5M12 15V4" /></svg>
                        {excelBusy === pl.id ? "Generando…" : "Excel"}
                      </button>
                      <button onClick={() => setPdfPacking(pl)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition shadow-sm whitespace-nowrap">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1M7 11l5 5 5-5M12 15V4" /></svg>
                        PDF
                      </button>
                      </div>
                    </div>
                    {pl.mode === "by_supplier" ? (
                      <div className="p-4 space-y-3 bg-gray-50/40">
                        {(() => {
                          const bySupplier = pl.items.reduce((acc, it) => {
                            const key = it.supplier_name || "Sin proveedor";
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(it);
                            return acc;
                          }, {});
                          return Object.entries(bySupplier).map(([supplierName, groupItems]) => {
                            const t = pl.supplier_totals.find(st => (st.supplier_name || "Sin proveedor") === supplierName);
                            const stats = t ? [
                              t.carton_qty && { label: "cartones", value: t.carton_qty },
                              t.cbm && { label: "CBM", value: t.cbm },
                              t.nw && { label: "kg NW", value: t.nw },
                              t.gw && { label: "kg GW", value: t.gw },
                            ].filter(Boolean) : [];
                            return (
                              <div key={supplierName} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap border-b border-gray-100">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                      {supplierName.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="text-sm font-bold text-gray-900">{supplierName}</p>
                                  </div>
                                  {stats.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {stats.map((s, i) => (
                                        <span key={i} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-md text-[11px] font-medium text-gray-600">
                                          <span className="font-bold text-gray-800">{s.value}</span> {s.label}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <ul className="divide-y divide-gray-50">
                                  {groupItems.map(it => (
                                    <li key={it.id} className="px-4 py-2 text-sm text-gray-700 flex items-center gap-3 hover:bg-gray-50/70 transition">
                                      {it.item_number && (
                                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-mono text-gray-500">{it.item_number}</span>
                                      )}
                                      <span className="flex-1 truncate">{it.description}</span>
                                      {it.color && <span className="flex-shrink-0 px-1.5 py-0.5 bg-gray-100 rounded-full text-[11px] text-gray-500">{it.color}</span>}
                                      {it.qty && <span className="flex-shrink-0 text-xs font-semibold text-gray-500">×{it.qty}</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]"><tr>
                            <th className="px-4 py-2 text-left font-semibold">Item #</th>
                            <th className="px-4 py-2 text-left font-semibold">Descripción</th>
                            <th className="px-4 py-2 text-left font-semibold">Color</th>
                            <th className="px-4 py-2 text-center font-semibold">Cartones</th>
                            <th className="px-4 py-2 text-center font-semibold">Cant.</th>
                            <th className="px-4 py-2 text-right font-semibold">CBM</th>
                            <th className="px-4 py-2 text-right font-semibold">N.W.</th>
                            <th className="px-4 py-2 text-right font-semibold">G.W.</th>
                          </tr></thead>
                          <tbody>
                            {pl.items.map((it, i) => (
                              <tr key={it.id} className={`border-t border-gray-50 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                                <td className="px-4 py-2 font-mono text-gray-500">{it.item_number}</td>
                                <td className="px-4 py-2 text-gray-800 font-medium">{it.description}</td>
                                <td className="px-4 py-2 text-gray-500">{it.color}</td>
                                <td className="px-4 py-2 text-center text-gray-600">{it.carton_qty}</td>
                                <td className="px-4 py-2 text-center text-gray-600">{it.qty}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{it.cbm}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{it.nw}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{it.gw}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>)}

          {tab === "shipments" && (order.shipments.length === 0
            ? <p className="text-sm text-gray-400">Aún no hay envíos ni muestras.</p>
            : <div className="space-y-3">{order.shipments.map(s => <ShipmentCard key={s.id} row={s} />)}</div>)}

          {tab === "docs" && (order.documents.length === 0
            ? <p className="text-sm text-gray-400">Aún no hay documentos publicados.</p>
            : <div className="space-y-2">
                {order.documents.map(d => (
                  <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-4 py-3 hover:bg-gray-50 transition">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                      <p className="text-xs text-gray-500">{[d.reference_number && `Ref: ${d.reference_number}`, fmtDate(d.created_at)].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className="text-xs font-medium text-blue-600">Descargar</span>
                  </a>
                ))}
              </div>)}
        </div>
      )}

      {pdfPacking && (() => {
        const itemsBySupplier = pdfPacking.items.reduce((acc, it) => {
          const key = it.supplier_name || "Sin proveedor";
          if (!acc[key]) acc[key] = { supplier_id: null, supplier_name: key, items: [] };
          acc[key].items.push(it);
          return acc;
        }, {});
        return (
          <PackingListPDF
            packingList={pdfPacking}
            items={pdfPacking.items}
            itemsBySupplier={itemsBySupplier}
            supplierTotals={pdfPacking.supplier_totals}
            clientName={session.client_name}
            clientDetails={profile}
            projectName={order.track_name}
            quoteNumber={pdfPacking.quote_number}
            notes={pdfPacking.notes}
            onClose={() => setPdfPacking(null)}
          />
        );
      })()}
    </div>
  );
}

export default function MisOrdenesPage() {
  const { session } = useClientPortal();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);

  // the client's own company details, for the documents generated here (null if unavailable)
  useEffect(() => {
    supabase.rpc("client_portal_get_profile", { p_session_id: session.session_id }).then(({ data }) => setProfile(data || null));
  }, [session.session_id]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("client_portal_get_orders", { p_session_id: session.session_id });
      if (error) setError(error.message);
      else setOrders((data || []).map(o => ({
        ...o,
        stages: o.stages || [], quotations: o.quotations || [], shipments: o.shipments || [], documents: o.documents || [],
        purchase_orders: o.purchase_orders || [], packing_lists: o.packing_lists || [],
      })));
      setLoading(false);
    }
    load();
  }, [session.session_id]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mis Órdenes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cada orden con su avance, cotizaciones, envíos y documentos</p>
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
      {!loading && !error && orders.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">No hay órdenes disponibles aún</p>
          <p className="text-xs mt-1">Tu asesor las publicará a medida que avance el proceso</p>
        </div>
      )}
      <div className="space-y-3">{orders.map(o => <OrderCard key={o.track_id} order={o} profile={profile} />)}</div>
    </div>
  );
}
