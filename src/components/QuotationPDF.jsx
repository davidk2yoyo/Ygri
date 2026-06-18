import React, { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "../supabaseClient";

const formatDateLong = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

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

const DOC_META = {
  quotation: { title: "QUOTATION",          refLabel: "Quote Number",    amountLabel: "Total Amount",  titleEs: "Cotización"        },
  proforma:  { title: "PROFORMA INVOICE",   refLabel: "Proforma Number", amountLabel: "Amount Due",    titleEs: "Factura Proforma"  },
  invoice:   { title: "COMMERCIAL INVOICE", refLabel: "Invoice Number",  amountLabel: "Amount Due",    titleEs: "Factura Comercial" },
};

function buildWhatsAppMessage(lang, { docMeta, quoteNumber, clientName, projectName, currency, grandTotal, deliveryTime, incoterm, validUntil, shareUrl, annexUrl, formatMoney }) {
  const total = `${currency} ${formatMoney(grandTotal)}`;
  const validLine = validUntil ? formatDateLong(validUntil) : null;

  const en = [
    `Hello *${clientName || "there"}* 👋`,
    ``,
    `Please find your *${docMeta.title} #${quoteNumber}*${projectName ? ` for _${projectName}_` : ""}.`,
    ``,
    `📦 *Total: ${total}*`,
    deliveryTime ? `📅 Delivery: ${deliveryTime}` : null,
    incoterm     ? `📋 Incoterm: ${incoterm}`      : null,
    validLine    ? `⏳ Valid until: ${validLine}`   : null,
    ``,
    `You can view the full document anytime here:`,
    shareUrl,
    annexUrl ? `` : null,
    annexUrl ? `📋 *Technical Specifications:*` : null,
    annexUrl ? annexUrl : null,
    ``,
    `Thank you for your business!`,
    `_Interasia SAS (HK) Trade Company_`,
  ].filter(l => l !== null).join("\n");

  const es = [
    `Hola *${clientName || ""}* 👋`,
    ``,
    `Le compartimos su *${docMeta.titleEs} #${quoteNumber}*${projectName ? ` para _${projectName}_` : ""}.`,
    ``,
    `📦 *Total: ${total}*`,
    deliveryTime ? `📅 Entrega: ${deliveryTime}` : null,
    incoterm     ? `📋 Incoterm: ${incoterm}`     : null,
    validLine    ? `⏳ Válido hasta: ${validLine}` : null,
    ``,
    `Puede ver el documento completo en cualquier momento aquí:`,
    shareUrl,
    annexUrl ? `` : null,
    annexUrl ? `📋 *Especificaciones Técnicas:*` : null,
    annexUrl ? annexUrl : null,
    ``,
    `¡Gracias por su confianza!`,
    `_Interasia SAS (HK) Trade Company_`,
  ].filter(l => l !== null).join("\n");

  if (lang === "en") return en;
  if (lang === "es") return es;
  return `${en}\n\n---\n\n${es}`;
}

function WhatsAppModal({ onClose, quotation, clientName, projectName, grandTotal, formatMoney }) {
  const [lang, setLang] = useState("en");
  const [copied, setCopied] = useState(false);
  const [annexUrl, setAnnexUrl] = useState(null);

  const shareUrl = `${window.location.origin}/q/${quotation.quote_number}`;
  const docMeta = DOC_META[quotation.document_type] || DOC_META.quotation;

  useEffect(() => {
    if (!quotation?.id) return;
    supabase.from("technical_annexes").select("annex_number").eq("quotation_id", quotation.id).maybeSingle()
      .then(({ data }) => {
        if (data?.annex_number) setAnnexUrl(`${window.location.origin}/a/${data.annex_number}`);
      });
  }, [quotation?.id]);

  const message = buildWhatsAppMessage(lang, {
    docMeta,
    quoteNumber: quotation.quote_number,
    clientName,
    projectName,
    currency: quotation.currency || "USD",
    grandTotal,
    deliveryTime: quotation.delivery_time,
    incoterm: quotation.incoterm ? `${quotation.incoterm}${quotation.incoterm_location ? ` ${quotation.incoterm_location}` : ""}` : null,
    validUntil: quotation.valid_until || null,
    shareUrl,
    annexUrl,
    formatMoney,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="font-semibold text-gray-800">Share via WhatsApp</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Public link */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Customer link</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-xs text-gray-600 truncate flex-1">{shareUrl}</span>
            </div>
          </div>

          {/* Language toggle */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message language</p>
            <div className="flex gap-2">
              {[["en", "English"], ["es", "Español"], ["both", "Both"]].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setLang(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    lang === v
                      ? "bg-[#25D366] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Message preview */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message preview</p>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-xs text-gray-700 whitespace-pre-wrap font-sans max-h-52 overflow-y-auto">
              {message}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1ebe5d] transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Open WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuotationPDF({
  quotation,
  items,
  clientName,
  projectName,
  totalAmount,
  commissionPct = 0,
  showCommission = false,
  onClose,
  standalone = false,
  readOnly = false,
}) {
  const printRef = useRef(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const currency = quotation.currency || "USD";
  const docMeta = DOC_META[quotation.document_type] || DOC_META.invoice;

  const formatMoney = (amount) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  const commissionAmount = totalAmount * (commissionPct / 100);
  const grandTotal = totalAmount + commissionAmount;

  const handleDownloadPDF = async () => {
    const el = printRef.current;
    if (!el) return;

    const prevMinH = el.style.minHeight;
    el.style.minHeight = "auto";
    await new Promise(r => setTimeout(r, 50));

    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: "#ffffff" });

    el.style.minHeight = prevMinH;

    // JPEG at 85% quality keeps file small (~1-2 MB instead of 10 MB)
    const imgData = canvas.toDataURL("image/jpeg", 0.85);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfPageH = pdf.internal.pageSize.getHeight();
    const imgTotalH = (canvas.height * pdfW) / canvas.width;

    let yOffset = 0;
    while (yOffset < imgTotalH) {
      pdf.addImage(imgData, "JPEG", 0, -yOffset, pdfW, imgTotalH);
      yOffset += pdfPageH;
      if (yOffset < imgTotalH) pdf.addPage();
    }

    pdf.save(`Quotation_${quotation.quote_number || "draft"}_${clientName?.replace(/\s+/g, "_") || "client"}.pdf`);
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a1a; }
      img { max-width: 100%; }
      @page { size: letter; margin: 0.5in; }
    </style></head><body>${el.outerHTML}</body></html>`);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  const actionBar = (
    <div className="flex items-center gap-3 mb-4 no-print flex-wrap">
      {!readOnly && onClose && (
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white text-darkblack-700 rounded-lg text-sm font-medium hover:bg-bgray-100 transition shadow"
        >
          ← Back to Form
        </button>
      )}
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
      {!readOnly && (
        <button
          onClick={() => setShowWhatsApp(true)}
          className="px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-semibold hover:bg-[#1ebe5d] transition shadow flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Share via WhatsApp
        </button>
      )}
      {!readOnly && quotation?.id && (
        <a
          href={`/quotations/${quotation.id}/annex`}
          className="px-4 py-2 bg-white border border-bgray-200 text-darkblack-700 rounded-lg text-sm font-semibold hover:border-primary hover:text-primary transition shadow flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Technical Annex
        </a>
      )}
    </div>
  );

  const showMoq = quotation.document_type === "quotation" && items.some(it => it.moq);

  const document = (
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
          <div style={{ display: "none", textAlign: "left" }}>
            <div style={{ fontSize: "18px", fontWeight: "900", color: "#1e3a5f" }}>INTERASIA SAS</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#c9922a" }}>(HONG KONG)</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e3a5f" }}>TRADE COMPANY</div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "28px", fontWeight: "900", color: "#1a1a1a", letterSpacing: "-0.5px", marginBottom: "8px" }}>
            {docMeta.title}
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
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
            BILL TO
          </div>
          <div style={{ fontWeight: "700", fontSize: "14px", color: "#1a1a1a", marginBottom: "2px" }}>
            {clientName?.toUpperCase() || "CLIENT NAME"}
          </div>
          <div style={{ fontSize: "11px", color: "#555" }}>{projectName}</div>
        </div>

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
                <td style={{ color: "#777", paddingBottom: "4px", paddingRight: "16px" }}>{docMeta.refLabel}:</td>
                <td style={{ fontWeight: "700", color: "#1a1a1a", paddingBottom: "4px" }}>{quotation.quote_number || "DRAFT"}</td>
              </tr>
              <tr>
                <td style={{ color: "#777", paddingBottom: "4px" }}>Invoice Date:</td>
                <td style={{ fontWeight: "600", color: "#1a1a1a", paddingBottom: "4px" }}>{today}</td>
              </tr>
              {quotation.document_type === "quotation" && quotation.valid_until && (
                <tr>
                  <td style={{ color: "#777", paddingBottom: "4px" }}>Valid Until:</td>
                  <td style={{ fontWeight: "600", color: "#c9922a", paddingBottom: "4px" }}>{formatDateLong(quotation.valid_until)}</td>
                </tr>
              )}
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
                <td style={{ color: "#777" }}>{docMeta.amountLabel} ({currency}):</td>
                <td style={{ fontWeight: "900", fontSize: "14px", color: "#1a1a1a" }}>
                  ${formatMoney(grandTotal)}
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
            <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700", width: "50px" }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700", width: "70px" }}>Image</th>
            <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: "12px", fontWeight: "700" }}>Description</th>
            <th style={{ padding: "10px 12px", textAlign: "center", color: "#fff", fontSize: "12px", fontWeight: "700", width: "60px" }}>Qty</th>
            {showMoq && <th style={{ padding: "10px 12px", textAlign: "center", color: "#fff", fontSize: "12px", fontWeight: "700", width: "60px" }}>MOQ</th>}
            <th style={{ padding: "10px 12px", textAlign: "right", color: "#fff", fontSize: "12px", fontWeight: "700", width: "90px" }}>Price</th>
            <th style={{ padding: "10px 12px", textAlign: "right", color: "#fff", fontSize: "12px", fontWeight: "700", width: "100px" }}>Amount</th>
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
                {showMoq && (
                  <td style={{ padding: "12px", fontSize: "12px", color: "#555", textAlign: "center", verticalAlign: "top" }}>
                    {item.moq || "—"}
                  </td>
                )}
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
            <span style={{ fontWeight: "600" }}>{currency} {formatMoney(totalAmount)}</span>
          </div>
          {showCommission && commissionPct > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e8eaed", fontSize: "13px" }}>
              <span style={{ color: "#555" }}>Commission ({commissionPct}%):</span>
              <span style={{ fontWeight: "600" }}>{currency} {formatMoney(commissionAmount)}</span>
            </div>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "12px 16px",
            backgroundColor: "#1e3a5f",
            borderRadius: "6px",
            marginTop: "8px",
          }}>
            <span style={{ color: "#fff", fontWeight: "700", fontSize: "14px" }}>{docMeta.amountLabel} ({currency}):</span>
            <span style={{ color: "#c9922a", fontWeight: "900", fontSize: "16px" }}>${formatMoney(grandTotal)}</span>
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
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4">
        {actionBar}
        {document}
        {showWhatsApp && (
          <WhatsAppModal
            onClose={() => setShowWhatsApp(false)}
            quotation={quotation}
            clientName={clientName}
            projectName={projectName}
            grandTotal={grandTotal}
            formatMoney={formatMoney}
          />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col items-center z-[9999] overflow-y-auto py-6">
      {actionBar}
      {document}
      {showWhatsApp && (
        <WhatsAppModal
          onClose={() => setShowWhatsApp(false)}
          quotation={quotation}
          clientName={clientName}
          projectName={projectName}
          grandTotal={grandTotal}
          formatMoney={formatMoney}
        />
      )}
    </div>
  );
}
