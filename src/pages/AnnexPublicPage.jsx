import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logoUrl from "../assets/images/logo/logo-short.png";

// ─── helpers ──────────────────────────────────────────────────────────────────
function renderContent(text) {
  if (!text) return "";
  if (text.trimStart().startsWith("<")) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\\n/g, "\n")
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

// ─── PDF template (hidden, rendered by html2canvas) ────────────────────────────
function PdfTemplate({ annex, blocks, quotation }) {
  const NAVY = "#1e3a5f";
  const BLUE = "#2563eb";
  const LIGHT = "#f0f4f8";

  let itemCount = 0;

  return (
    <div style={{ width: "794px", fontFamily: "Arial, Helvetica, sans-serif", color: "#1a1a1a", background: "white" }}>

      {/* ── Page header ── */}
      <div style={{ background: NAVY, padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src={logoUrl} alt="Interasia" style={{ height: "44px", objectFit: "contain" }} />
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, color: "white", fontSize: "13px", fontWeight: "700", letterSpacing: "0.03em" }}>
            INTERASIA SAS (HK) TRADE COMPANY
          </p>
          <p style={{ margin: "2px 0 0", color: "#93c5fd", fontSize: "10px" }}>
            www.interasia.com.co
          </p>
        </div>
      </div>

      {/* ── Accent bar ── */}
      <div style={{ background: BLUE, height: "4px" }} />

      {/* ── Title section ── */}
      <div style={{ padding: "28px 40px 22px", borderBottom: `2px solid ${LIGHT}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: "9px", fontWeight: "700", letterSpacing: "0.18em", textTransform: "uppercase", color: BLUE }}>
              Technical Annex · {annex.annex_number}
            </p>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: NAVY, lineHeight: "1.2" }}>
              {annex.title}
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: "10px", color: "#6b7280", textAlign: "right", flexShrink: 0, paddingLeft: "24px" }}>
            {fmtDate(new Date().toISOString())}
          </p>
        </div>

        {quotation && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              quotation.quote_number && `Ref: ${quotation.quote_number}`,
              quotation.client_name,
              quotation.project_name,
            ].filter(Boolean).map((tag, i) => (
              <span key={i} style={{ background: LIGHT, color: "#374151", fontSize: "10px", fontWeight: "600", padding: "3px 10px", borderRadius: "999px" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Content blocks ── */}
      <div style={{ padding: "0 40px 32px" }}>
        {blocks.map((block) => {
          const { type, content } = block;
          const linkedItem = content._linked_item;
          const isItem = type === "item";
          const pageBreak = isItem && itemCount > 0;
          if (isItem) itemCount++;

          if (type === "item") {
            return (
              <div key={block.id} style={{ marginTop: pageBreak ? "0" : "28px", pageBreakBefore: pageBreak ? "always" : "auto" }}>
                <div style={{ background: NAVY, margin: "0 -40px", padding: "14px 40px", display: "flex", alignItems: "center", gap: "12px" }}>
                  {content.item_number && (
                    <span style={{ background: BLUE, color: "white", fontSize: "9px", fontWeight: "800", letterSpacing: "0.14em", textTransform: "uppercase", padding: "3px 10px", borderRadius: "999px" }}>
                      {content.item_number}
                    </span>
                  )}
                  <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "white", letterSpacing: "0.02em" }}>
                    {(content.label || content.description || "").toUpperCase()}
                  </h2>
                </div>
              </div>
            );
          }

          return (
            <div key={block.id} style={{ marginTop: "22px" }}>
              {linkedItem && (
                <p style={{ margin: "0 0 4px", fontSize: "9px", fontWeight: "700", color: BLUE, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {[linkedItem.item_number, linkedItem.description].filter(Boolean).join(" · ")}
                </p>
              )}

              {type === "text" && (
                <>
                  {content.title && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ display: "inline-block", width: "3px", height: "14px", background: BLUE, borderRadius: "2px", flexShrink: 0 }} />
                      <h3 style={{ margin: 0, fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#111827" }}>
                        {content.title}
                      </h3>
                    </div>
                  )}
                  <div
                    style={{ fontSize: "12px", color: "#374151", lineHeight: "1.7" }}
                    className="pdf-text"
                    dangerouslySetInnerHTML={{ __html: renderContent(content.content) }}
                  />
                </>
              )}

              {type === "specs" && (
                <>
                  {content.title && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ display: "inline-block", width: "3px", height: "14px", background: BLUE, borderRadius: "2px", flexShrink: 0 }} />
                      <h3 style={{ margin: 0, fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#111827" }}>
                        {content.title}
                      </h3>
                    </div>
                  )}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                    <tbody>
                      {(content.rows || []).filter(r => r.label || r.value).map((row, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                          <td style={{ padding: "6px 12px", fontWeight: "600", color: "#4b5563", width: "38%", border: "1px solid #e2e8f0" }}>{row.label}</td>
                          <td style={{ padding: "6px 12px", color: "#111827", border: "1px solid #e2e8f0" }}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {type === "images" && (content.images || []).length > 0 && (
                <>
                  {content.title && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ display: "inline-block", width: "3px", height: "14px", background: BLUE, borderRadius: "2px", flexShrink: 0 }} />
                      <h3 style={{ margin: 0, fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#111827" }}>
                        {content.title}
                      </h3>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {(content.images || []).map((img, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <img src={img.url} alt={img.caption || ""} crossOrigin="anonymous" style={{ width: "100%", height: "130px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2e8f0", display: "block" }} />
                        {img.caption && <p style={{ margin: "4px 0 0", fontSize: "9px", color: "#9ca3af" }}>{img.caption}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {type === "diagram" && content.url && (
                <>
                  {content.title && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ display: "inline-block", width: "3px", height: "14px", background: BLUE, borderRadius: "2px", flexShrink: 0 }} />
                      <h3 style={{ margin: 0, fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#111827" }}>
                        {content.title}
                      </h3>
                    </div>
                  )}
                  <div style={{ textAlign: "center", background: "#f8fafc", borderRadius: "8px", padding: "12px", border: "1px solid #e2e8f0" }}>
                    <img src={content.url} alt={content.caption || "Diagram"} crossOrigin="anonymous" style={{ maxWidth: "100%", maxHeight: "380px", objectFit: "contain", display: "block", margin: "0 auto" }} />
                    {content.caption && <p style={{ margin: "6px 0 0", fontSize: "9px", color: "#9ca3af" }}>{content.caption}</p>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{ background: LIGHT, borderTop: `2px solid ${NAVY}`, padding: "10px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: "9px", color: "#6b7280" }}>
          {annex.annex_number} · Interasia SAS (HK) Trade Company
        </p>
        <p style={{ margin: 0, fontSize: "9px", color: "#9ca3af" }}>
          Generated by Ygri CRM
        </p>
      </div>
    </div>
  );
}

// ─── Web block renderer (screen view) ─────────────────────────────────────────
function renderContent2(text) { return renderContent(text); }

function SectionHeading({ title }) {
  if (!title) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
      <span style={{ display: "inline-block", width: "3px", height: "16px", backgroundColor: "#2563eb", borderRadius: "2px", flexShrink: 0 }} />
      <h3 style={{ margin: 0, fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#111827" }}>
        {title}
      </h3>
    </div>
  );
}

function BlockRenderer({ block, newPage }) {
  const { type, content } = block;
  const linkedItem = content._linked_item;

  if (type === "item") {
    return (
      <div className={newPage ? "page-break-item" : "first-item"} style={{ marginBottom: "12px" }}>
        {content.item_number && (
          <span style={{ display: "inline-block", background: "#1e3a5f", color: "white", fontSize: "10px", fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 10px", borderRadius: "999px", marginBottom: "8px" }}>
            {content.item_number}
          </span>
        )}
        <h2 style={{ margin: "0 0 0", fontSize: "22px", fontWeight: "800", color: "#1e3a5f", lineHeight: "1.25", borderBottom: "2px solid #1e3a5f", paddingBottom: "12px" }}>
          {content.label || content.description}
        </h2>
      </div>
    );
  }

  return (
    <div className="content-block" style={{ marginBottom: "28px" }}>
      {linkedItem && (
        <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "700", color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {[linkedItem.item_number, linkedItem.description].filter(Boolean).join(" · ")}
        </p>
      )}

      {type === "text" && (
        <>
          <SectionHeading title={content.title} />
          <div style={{ fontSize: "13.5px", color: "#374151", lineHeight: "1.75" }} className="annex-text"
            dangerouslySetInnerHTML={{ __html: renderContent2(content.content) }}
          />
        </>
      )}

      {type === "specs" && (
        <>
          <SectionHeading title={content.title} />
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <tbody>
                {(content.rows || []).filter(r => r.label || r.value).map((row, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={{ padding: "7px 14px", fontWeight: "600", color: "#374151", width: "42%", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>{row.label}</td>
                    <td style={{ padding: "7px 14px", color: "#1f2937", borderBottom: "1px solid #e2e8f0" }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {type === "images" && (
        <>
          <SectionHeading title={content.title} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {(content.images || []).map((img, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <img src={img.url} alt={img.caption || ""} style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", display: "block" }} />
                {img.caption && <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#9ca3af" }}>{img.caption}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {type === "diagram" && content.url && (
        <>
          <SectionHeading title={content.title} />
          <div style={{ textAlign: "center" }}>
            <img src={content.url} alt={content.caption || "Diagram"} className="diagram-img" style={{ maxWidth: "100%", maxHeight: "440px", objectFit: "contain", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
            {content.caption && <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9ca3af" }}>{content.caption}</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnnexPublicPage() {
  const { annexNumber } = useParams();
  const [annex, setAnnex] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: ax } = await supabase.from("technical_annexes").select("*").eq("annex_number", annexNumber).single();
      if (!ax) { setNotFound(true); setLoading(false); return; }
      setAnnex(ax);
      const [{ data: blks }, { data: quot }] = await Promise.all([
        supabase.from("annex_blocks").select("*").eq("annex_id", ax.id).order("sort_order"),
        supabase.from("quotations").select("quote_number, client_name, project_name").eq("id", ax.quotation_id).single(),
      ]);
      setBlocks(blks || []);
      setQuotation(quot);
      setLoading(false);
    }
    load();
  }, [annexNumber]);

  const handleExportPDF = async () => {
    if (!pdfRef.current) return;
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 80)); // let images settle
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgTotalH = (canvas.height * pdfW) / canvas.width;
      let yOffset = 0;
      while (yOffset < imgTotalH) {
        pdf.addImage(imgData, "JPEG", 0, -yOffset, pdfW, imgTotalH);
        yOffset += pdfH;
        if (yOffset < imgTotalH) pdf.addPage();
      }
      pdf.save(`${annex.annex_number}_${(annex.title || "annex").replace(/\s+/g, "_")}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 text-gray-500">
      <p className="text-4xl">📄</p>
      <p className="font-semibold">Technical annex not found</p>
      <p className="text-sm">The link may be invalid or expired.</p>
    </div>
  );

  let itemCount = 0;
  const processedBlocks = blocks.map(block => {
    const isItem = block.type === "item";
    const newPage = isItem && itemCount > 0;
    if (isItem) itemCount++;
    return { block, newPage };
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{`
        .annex-text strong { font-weight: 600; color: #111827; }
        .annex-text ul { list-style: disc; padding-left: 20px; margin: 6px 0; }
        .annex-text ol { list-style: decimal; padding-left: 20px; margin: 6px 0; }
        .annex-text p { margin: 0 0 8px; }
        .annex-text li { margin-bottom: 3px; }
        .annex-text h3 { font-weight: 700; color: #111827; margin: 0 0 4px; }
        .pdf-text strong { font-weight: 700; }
        .pdf-text p { margin: 0 0 6px; }
        .pdf-text ul { list-style: disc; padding-left: 18px; margin: 4px 0; }
        .pdf-text ol { list-style: decimal; padding-left: 18px; margin: 4px 0; }
      `}</style>

      {/* ── Hidden PDF template (rendered by html2canvas) ── */}
      <div ref={pdfRef} style={{ position: "absolute", top: 0, left: "-9999px", zIndex: -1 }}>
        {annex && <PdfTemplate annex={annex} blocks={blocks} quotation={quotation} />}
      </div>

      {/* ── Screen top bar ── */}
      <div style={{ background: "#1e3a5f", color: "white" }}>
        <div style={{ maxWidth: "740px", margin: "0 auto", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd" }}>
              Technical Annex · {annex.annex_number}
            </p>
            <h1 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: "800", color: "white", lineHeight: "1.2" }}>
              {annex.title}
            </h1>
            {quotation && (
              <p style={{ margin: 0, fontSize: "12px", color: "#bfdbfe" }}>
                {[quotation.quote_number, quotation.client_name, quotation.project_name].filter(Boolean).join("  ·  ")}
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexShrink: 0 }}>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: exporting ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px", color: "white", fontSize: "12px", fontWeight: "600", cursor: exporting ? "default" : "pointer" }}
            >
              {exporting ? (
                <><span style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Generating…</>
              ) : (
                <><svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg> Export PDF</>
              )}
            </button>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 1px", fontSize: "11px", fontWeight: "700", color: "white" }}>Interasia SAS</p>
              <p style={{ margin: 0, fontSize: "10px", color: "#93c5fd" }}>HK Trade Company</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Screen document view ── */}
      <div style={{ maxWidth: "740px", margin: "24px auto 48px", background: "white", borderRadius: "16px", boxShadow: "0 2px 24px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ padding: "40px 48px" }}>
          {blocks.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "80px 0", fontSize: "14px" }}>
              This annex has no content yet.
            </p>
          ) : (
            processedBlocks.map(({ block, newPage }) => (
              <BlockRenderer key={block.id} block={block} newPage={newPage} />
            ))
          )}
          <div style={{ marginTop: "48px", paddingTop: "20px", borderTop: "1px solid #f1f5f9" }}>
            <p style={{ textAlign: "center", fontSize: "11px", color: "#d1d5db", margin: 0 }}>
              {annex.annex_number} · Interasia SAS (HK) Trade Company · Generated by Ygri CRM
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
