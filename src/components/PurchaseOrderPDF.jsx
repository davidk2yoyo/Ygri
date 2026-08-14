import React, { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const COMPANY_INFO = {
  name: "INTERASIA SAS (HONGKONG) TRADE COMPANY LIMITED",
  phone: "+86 (21) 52997308",
  mobile: "+86-18616329307",
  website: "www.interasia.com.co",
};

export default function PurchaseOrderPDF({ purchaseOrder, items, supplierName, projectName, quoteNumber, payments = [], onClose }) {
  const printRef = useRef(null);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmt = (n) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  const total = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (it.quantity || 1), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const balanceDue = Math.max(total - totalPaid, 0);

  const handleDownloadPDF = async () => {
    const el = printRef.current;
    if (!el) return;
    const prevMinH = el.style.minHeight;
    el.style.minHeight = "auto";
    await new Promise(r => setTimeout(r, 50));

    const scale = 1.5;
    const canvas = await html2canvas(el, { scale, useCORS: true, backgroundColor: "#ffffff" });
    const elTop = el.getBoundingClientRect().top;
    const blocks = [...el.querySelectorAll("tbody tr, .pdf-block")].map(b => {
      const r = b.getBoundingClientRect();
      return { top: (r.top - elTop) * scale, bottom: (r.bottom - elTop) * scale };
    });
    el.style.minHeight = prevMinH;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfPageH = pdf.internal.pageSize.getHeight();
    const pxPerMm = canvas.width / pdfW;
    const topM = 8, botM = 8;
    const fullHpx = pdfPageH * pxPerMm;
    const topMpx = topM * pxPerMm;
    const botMpx = botM * pxPerMm;

    const cuts = [];
    let cursor = 0;
    let cap = fullHpx - botMpx;
    while (cursor + cap < canvas.height) {
      let cut = cursor + cap;
      const straddling = blocks.filter(b => b.top < cut && b.bottom > cut && b.top > cursor);
      if (straddling.length) {
        const minTop = Math.min(...straddling.map(b => b.top));
        if (minTop > cursor + cap * 0.25) cut = minTop;
      }
      cuts.push(cut);
      cursor = cut;
      cap = fullHpx - topMpx - botMpx;
    }

    const pageEnds = [...cuts, canvas.height];
    let prev = 0;
    pageEnds.forEach((end, i) => {
      const sliceH = Math.ceil(end - prev);
      if (sliceH <= 0) return;
      const tmp = window.document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = sliceH;
      const ctx = tmp.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(canvas, 0, prev, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const img = tmp.toDataURL("image/jpeg", 0.85);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, i === 0 ? 0 : topM, pdfW, (sliceH * pdfW) / canvas.width);
      prev = end;
    });

    pdf.save(`${purchaseOrder?.po_number || "PO"}_${supplierName?.replace(/\s+/g, "_") || "supplier"}.pdf`);
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${purchaseOrder?.po_number || "Purchase Order"} · ${supplierName || ""}</title><style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a1a; }
      img { max-width: 100%; }
      @page { size: letter; margin: 0.5in; }
      tr, .pdf-block { page-break-inside: avoid; break-inside: avoid; }
      thead { display: table-header-group; }
    </style></head><body>${el.outerHTML}</body></html>`);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  const document_ = (
    <div
      ref={printRef}
      style={{
        width: "794px", minHeight: "1123px", backgroundColor: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif", fontSize: "13px", color: "#1a1a1a",
        padding: "48px 48px 60px", boxSizing: "border-box", boxShadow: "0 4px 40px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div style={{ width: "200px" }}>
          <img
            src="/images/interasia-logo.png"
            alt="Interasia Logo"
            style={{ width: "180px", objectFit: "contain" }}
            onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }}
          />
          <div style={{ display: "none", textAlign: "left" }}>
            <div style={{ fontSize: "18px", fontWeight: "900", color: "#1e3a5f" }}>INTERASIA SAS</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#c9922a" }}>(HONG KONG)</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e3a5f" }}>TRADE COMPANY</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "28px", fontWeight: "900", color: "#1a1a1a", letterSpacing: "-0.5px", marginBottom: "8px" }}>PURCHASE ORDER</div>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e3a5f", marginBottom: "4px" }}>{COMPANY_INFO.name}</div>
          <div style={{ fontSize: "11px", color: "#555" }}>Phone: {COMPANY_INFO.phone}</div>
          <div style={{ fontSize: "11px", color: "#555" }}>Mobile: {COMPANY_INFO.mobile}</div>
          <div style={{ fontSize: "11px", color: "#555" }}>{COMPANY_INFO.website}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "28px", gap: "24px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>SUPPLIER</div>
          <div style={{ fontWeight: "700", fontSize: "14px", color: "#1a1a1a", marginBottom: "2px" }}>{supplierName?.toUpperCase() || "SUPPLIER NAME"}</div>
          {projectName && <div style={{ fontSize: "11px", color: "#555" }}>For project: {projectName}</div>}
        </div>
        <div style={{ backgroundColor: "#f7f8fa", border: "1px solid #e0e4ea", borderRadius: "8px", padding: "16px 20px", minWidth: "220px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <tbody>
              <tr>
                <td style={{ color: "#777", paddingBottom: "4px", paddingRight: "16px" }}>PO Number:</td>
                <td style={{ fontWeight: "700", color: "#1a1a1a", paddingBottom: "4px" }}>{purchaseOrder?.po_number || "DRAFT"}</td>
              </tr>
              {quoteNumber && (
                <tr>
                  <td style={{ color: "#777", paddingBottom: "4px" }}>Client Ref:</td>
                  <td style={{ fontWeight: "600", color: "#1a1a1a", paddingBottom: "4px" }}>{quoteNumber}</td>
                </tr>
              )}
              <tr>
                <td style={{ color: "#777" }}>Date:</td>
                <td style={{ fontWeight: "600", color: "#1a1a1a" }}>{today}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
        <thead>
          <tr style={{ backgroundColor: "#1e3a5f" }}>
            <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700", width: "50px" }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700", width: "70px" }}>Image</th>
            <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700" }}>Description</th>
            <th style={{ padding: "10px 12px", textAlign: "center", color: "#fff", fontSize: "12px", fontWeight: "700", width: "60px" }}>Qty</th>
            <th style={{ padding: "10px 12px", textAlign: "right", color: "#fff", fontSize: "12px", fontWeight: "700", width: "90px" }}>Price</th>
            <th style={{ padding: "10px 12px", textAlign: "right", color: "#fff", fontSize: "12px", fontWeight: "700", width: "100px" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const price = parseFloat(item.price) || 0;
            const qty = parseInt(item.quantity) || 1;
            return (
              <tr key={item.id || idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #e8eaed" }}>
                <td style={{ padding: "12px", fontSize: "12px", color: "#555", verticalAlign: "top" }}>{item.item_number || (idx + 1)}</td>
                <td style={{ padding: "8px 12px", verticalAlign: "top" }}>
                  {item.picture_url ? (
                    <img src={item.picture_url} alt="" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", border: "1px solid #e0e4ea" }} crossOrigin="anonymous" />
                  ) : (
                    <div style={{ width: "50px", height: "50px", backgroundColor: "#f0f2f5", borderRadius: "4px", border: "1px solid #e0e4ea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#aaa" }}>No img</div>
                  )}
                </td>
                <td style={{ padding: "12px", fontSize: "12px", color: "#1a1a1a", verticalAlign: "top" }}><div style={{ fontWeight: "700" }}>{item.description || "—"}</div></td>
                <td style={{ padding: "12px", fontSize: "12px", color: "#1a1a1a", textAlign: "center", verticalAlign: "top" }}>{qty}</td>
                <td style={{ padding: "12px", fontSize: "12px", color: "#1a1a1a", textAlign: "right", verticalAlign: "top" }}>{purchaseOrder.currency} {fmt(price)}</td>
                <td style={{ padding: "12px", fontSize: "12px", color: "#1a1a1a", textAlign: "right", verticalAlign: "top", fontWeight: "700" }}>{purchaseOrder.currency} {fmt(price * qty)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="pdf-block" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "28px" }}>
        <div style={{ minWidth: "260px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#1e3a5f", borderRadius: "6px" }}>
            <span style={{ color: "#fff", fontWeight: "700", fontSize: "14px" }}>Total ({purchaseOrder.currency}):</span>
            <span style={{ color: "#c9922a", fontWeight: "900", fontSize: "16px" }}>${fmt(total)}</span>
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="pdf-block" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "28px" }}>
          <div style={{ minWidth: "260px", border: "1px solid #e0e4ea", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", backgroundColor: "#f7f8fa", fontSize: "11px", fontWeight: "700", color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.5px" }}>Payment Status</div>
            <div style={{ padding: "12px 16px" }}>
              {payments.map((p, i) => (
                <div key={p.id || i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#555", marginBottom: "4px" }}>
                  <span>{p.payment_date}{p.method ? ` · ${p.method}` : ""}</span>
                  <span style={{ fontWeight: "600", color: "#1a1a1a" }}>{p.currency} {fmt(p.amount)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: "6px", borderTop: "1px solid #e8eaed", fontSize: "13px" }}>
                <span style={{ color: "#16a34a", fontWeight: "700" }}>Paid:</span>
                <span style={{ fontWeight: "700", color: "#16a34a" }}>{purchaseOrder.currency} {fmt(totalPaid)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", fontSize: "13px" }}>
                <span style={{ color: balanceDue > 0.004 ? "#c9922a" : "#16a34a", fontWeight: "700" }}>Balance Due:</span>
                <span style={{ fontWeight: "900", color: balanceDue > 0.004 ? "#c9922a" : "#16a34a" }}>{purchaseOrder.currency} {fmt(balanceDue)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #e8eaed" }}>
        <div style={{ fontSize: "10px", color: "#aaa" }}>Generated by Ygri CRM · {COMPANY_INFO.website}</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col items-center z-[9999] overflow-y-auto py-6">
      <div className="flex items-center gap-3 mb-4 no-print flex-wrap">
        {onClose && (
          <button onClick={onClose} className="px-4 py-2 bg-white text-darkblack-700 rounded-lg text-sm font-medium hover:bg-bgray-100 transition shadow">← Back</button>
        )}
        <button onClick={handlePrint} className="px-4 py-2 bg-white text-darkblack-700 rounded-lg text-sm font-medium hover:bg-bgray-100 transition shadow flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print
        </button>
        <button onClick={handleDownloadPDF} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition shadow flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Download PDF
        </button>
      </div>
      {document_}
    </div>
  );
}
