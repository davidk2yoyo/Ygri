import React, { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Bank details — fixed for Interasia
const BANK_DETAILS = {
  company: "INTERASIA SAS (HONGKONG) TRADE COMPANY LIMITED",
  address: "ROOM 1102-1103 KOWLOON BUILDING 555 NATHAN ROAD, MONGKOK KLN",
  accountNumber: "015-829856-838",
  bankName: "HSBC Hong Kong",
  bankAddress: "1 Queen's Road Central",
  bankCode: "004",
  swift: "HSBCHKHHHKH",
};

const COMPANY_INFO = {
  name: "INTERASIA SAS (HONGKONG) TRADE COMPANY LIMITED",
  phone: "+86 (21) 52997308",
  mobile: "+86-18616329307",
  website: "www.interasia.com.co",
};

export default function QuotationPDF({ quotation, items, clientName, projectName, totalAmount, onClose }) {
  const printRef = useRef(null);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const currency = quotation.currency || "USD";

  const formatMoney = (amount) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  const handleDownloadPDF = async () => {
    const el = printRef.current;
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`Quotation_${quotation.quote_number || "draft"}_${clientName?.replace(/\s+/g, "_") || "client"}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex flex-col items-center z-[200] overflow-y-auto py-6">
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-4 no-print">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white text-darkblack-700 rounded-lg text-sm font-medium hover:bg-bgray-100 transition shadow"
        >
          ← Back to Form
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-white text-darkblack-700 rounded-lg text-sm font-medium hover:bg-bgray-100 transition shadow flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>
        <button
          onClick={handleDownloadPDF}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition shadow flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PDF
        </button>
      </div>

      {/* PDF Document */}
      <div
        ref={printRef}
        id="quotation-pdf"
        style={{
          width: "794px",
          minHeight: "1123px",
          backgroundColor: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "13px",
          color: "#1a1a1a",
          padding: "48px 48px 60px",
          boxSizing: "border-box",
          boxShadow: "0 4px 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          {/* Logo */}
          <div style={{ width: "200px" }}>
            <img
              src="/images/interasia-logo.png"
              alt="Interasia Logo"
              style={{ width: "180px", objectFit: "contain" }}
              onError={e => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "block";
              }}
            />
            {/* Fallback text logo */}
            <div style={{ display: "none", textAlign: "left" }}>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "#1e3a5f" }}>INTERASIA SAS</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#c9922a" }}>(HONG KONG)</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e3a5f" }}>TRADE COMPANY</div>
            </div>
          </div>

          {/* Company info + title */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#1a1a1a", letterSpacing: "-0.5px", marginBottom: "8px" }}>
              COMMERCIAL INVOICE
            </div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e3a5f", marginBottom: "4px" }}>
              {COMPANY_INFO.name}
            </div>
            <div style={{ fontSize: "11px", color: "#555" }}>Phone: {COMPANY_INFO.phone}</div>
            <div style={{ fontSize: "11px", color: "#555" }}>Mobile: {COMPANY_INFO.mobile}</div>
            <div style={{ fontSize: "11px", color: "#555" }}>{COMPANY_INFO.website}</div>
          </div>
        </div>

        {/* ── Bill To + Invoice Meta ── */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "28px", gap: "24px" }}>
          {/* Bill To */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
              BILL TO
            </div>
            <div style={{ fontWeight: "700", fontSize: "14px", color: "#1a1a1a", marginBottom: "2px" }}>
              {clientName?.toUpperCase() || "CLIENT NAME"}
            </div>
            <div style={{ fontSize: "11px", color: "#555" }}>{projectName}</div>
          </div>

          {/* Invoice meta */}
          <div style={{
            backgroundColor: "#f7f8fa",
            border: "1px solid #e0e4ea",
            borderRadius: "8px",
            padding: "16px 20px",
            minWidth: "220px",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <tbody>
                <tr>
                  <td style={{ color: "#777", paddingBottom: "4px", paddingRight: "16px" }}>Invoice Number:</td>
                  <td style={{ fontWeight: "700", color: "#1a1a1a", paddingBottom: "4px" }}>{quotation.quote_number || "DRAFT"}</td>
                </tr>
                <tr>
                  <td style={{ color: "#777", paddingBottom: "4px" }}>Invoice Date:</td>
                  <td style={{ fontWeight: "600", color: "#1a1a1a", paddingBottom: "4px" }}>{today}</td>
                </tr>
                {quotation.type === "product" && quotation.incoterm && (
                  <tr>
                    <td style={{ color: "#777", paddingBottom: "4px" }}>Incoterm:</td>
                    <td style={{ fontWeight: "600", color: "#1a1a1a", paddingBottom: "4px" }}>
                      {quotation.incoterm}{quotation.incoterm_location ? ` ${quotation.incoterm_location}` : ""}
                    </td>
                  </tr>
                )}
                {quotation.type === "product" && quotation.delivery_time && (
                  <tr>
                    <td style={{ color: "#777", paddingBottom: "4px" }}>Delivery Time:</td>
                    <td style={{ fontWeight: "600", color: "#1a1a1a", paddingBottom: "4px" }}>{quotation.delivery_time}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: "#777" }}>Amount Due ({currency}):</td>
                  <td style={{ fontWeight: "900", fontSize: "14px", color: "#1a1a1a" }}>
                    ${formatMoney(totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Items Table ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
          <thead>
            <tr style={{ backgroundColor: "#1e3a5f" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700", width: "50px" }}>
                #
              </th>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700", width: "70px" }}>
                Image
              </th>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700" }}>
                Description
              </th>
              <th style={{ padding: "10px 12px", textAlign: "center", color: "#fff", fontSize: "12px", fontWeight: "700", width: "60px" }}>
                Qty
              </th>
              <th style={{ padding: "10px 12px", textAlign: "right", color: "#fff", fontSize: "12px", fontWeight: "700", width: "90px" }}>
                Price
              </th>
              <th style={{ padding: "10px 12px", textAlign: "right", color: "#fff", fontSize: "12px", fontWeight: "700", width: "100px" }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const price = parseFloat(item.price) || 0;
              const qty = parseInt(item.quantity) || 1;
              const amount = price * qty;
              return (
                <tr
                  key={item.tempId || idx}
                  style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #e8eaed" }}
                >
                  <td style={{ padding: "12px", fontSize: "12px", color: "#555", verticalAlign: "top" }}>
                    {item.item_number || (idx + 1)}
                  </td>
                  <td style={{ padding: "8px 12px", verticalAlign: "top" }}>
                    {item.picturePreview || item.picture_url ? (
                      <img
                        src={item.picturePreview || item.picture_url}
                        alt=""
                        style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", border: "1px solid #e0e4ea" }}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div style={{
                        width: "50px", height: "50px", backgroundColor: "#f0f2f5",
                        borderRadius: "4px", border: "1px solid #e0e4ea",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "10px", color: "#aaa"
                      }}>
                        No img
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px", fontSize: "12px", color: "#1a1a1a", verticalAlign: "top" }}>
                    <div style={{ fontWeight: "700" }}>{item.description || "—"}</div>
                  </td>
                  <td style={{ padding: "12px", fontSize: "12px", color: "#1a1a1a", textAlign: "center", verticalAlign: "top" }}>
                    {qty}
                  </td>
                  <td style={{ padding: "12px", fontSize: "12px", color: "#1a1a1a", textAlign: "right", verticalAlign: "top" }}>
                    ${formatMoney(price)}
                  </td>
                  <td style={{ padding: "12px", fontSize: "12px", color: "#1a1a1a", textAlign: "right", verticalAlign: "top", fontWeight: "700" }}>
                    ${formatMoney(amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── Totals ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "28px" }}>
          <div style={{ minWidth: "260px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e8eaed", fontSize: "13px" }}>
              <span style={{ color: "#555" }}>Subtotal:</span>
              <span style={{ fontWeight: "600" }}>{currency} ${formatMoney(totalAmount)}</span>
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              padding: "12px 16px",
              backgroundColor: "#1e3a5f",
              borderRadius: "6px",
              marginTop: "8px",
            }}>
              <span style={{ color: "#fff", fontWeight: "700", fontSize: "14px" }}>Amount Due ({currency}):</span>
              <span style={{ color: "#c9922a", fontWeight: "900", fontSize: "16px" }}>${formatMoney(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* ── Notes / Terms ── */}
        {(quotation.notes || quotation.negotiation_term) && (
          <div style={{ marginBottom: "28px" }}>
            <div style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontWeight: "700" }}>
              Notes / Terms
            </div>
            {quotation.negotiation_term && (
              <div style={{ fontSize: "12px", color: "#1a1a1a", marginBottom: "4px" }}>
                <strong>Negotiation Terms:</strong> {quotation.negotiation_term}
              </div>
            )}
            {quotation.notes && (
              <div style={{ fontSize: "12px", color: "#555", whiteSpace: "pre-wrap" }}>{quotation.notes}</div>
            )}
          </div>
        )}

        {/* ── Bank Details ── */}
        <div style={{
          backgroundColor: "#f7f8fa",
          border: "1px solid #e0e4ea",
          borderRadius: "8px",
          padding: "16px 20px",
          fontSize: "11px",
        }}>
          <div style={{ fontWeight: "700", fontSize: "12px", color: "#1a1a1a", marginBottom: "8px" }}>Bank Details:</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
            <div><span style={{ color: "#777" }}>Company Name: </span><span style={{ fontWeight: "600" }}>{BANK_DETAILS.company}</span></div>
            <div><span style={{ color: "#777" }}>Bank Name: </span><span style={{ fontWeight: "600" }}>{BANK_DETAILS.bankName}</span></div>
            <div><span style={{ color: "#777" }}>Address: </span><span>{BANK_DETAILS.address}</span></div>
            <div><span style={{ color: "#777" }}>Bank Address: </span><span>{BANK_DETAILS.bankAddress}</span></div>
            <div><span style={{ color: "#777" }}>Account Number: </span><span style={{ fontWeight: "600", fontFamily: "monospace" }}>{BANK_DETAILS.accountNumber}</span></div>
            <div><span style={{ color: "#777" }}>Bank Code: </span><span style={{ fontWeight: "600" }}>{BANK_DETAILS.bankCode}</span></div>
            <div><span style={{ color: "#777" }}>SWIFT Code: </span><span style={{ fontWeight: "600", fontFamily: "monospace" }}>{BANK_DETAILS.swift}</span></div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #e8eaed" }}>
          <div style={{ fontSize: "10px", color: "#aaa" }}>
            Generated by Ygri CRM · {COMPANY_INFO.website}
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #quotation-pdf, #quotation-pdf * { visibility: visible; }
          #quotation-pdf { position: fixed; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
