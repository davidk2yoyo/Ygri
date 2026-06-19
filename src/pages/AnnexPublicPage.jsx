import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

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

function SpecsTable({ content }) {
  const rows = (content.rows || []).filter(r => r.label || r.value);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
            <td style={{ padding: "7px 14px", fontWeight: "600", color: "#374151", width: "42%", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>
              {row.label}
            </td>
            <td style={{ padding: "7px 14px", color: "#1f2937", borderBottom: "1px solid #e2e8f0" }}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
          <span style={{
            display: "inline-block",
            background: "#1e3a5f",
            color: "white",
            fontSize: "10px",
            fontWeight: "700",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "3px 10px",
            borderRadius: "999px",
            marginBottom: "8px",
          }}>
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
          <div
            style={{ fontSize: "13.5px", color: "#374151", lineHeight: "1.75" }}
            className="annex-text"
            dangerouslySetInnerHTML={{ __html: renderContent(content.content) }}
          />
        </>
      )}

      {type === "specs" && (
        <>
          <SectionHeading title={content.title} />
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <SpecsTable content={content} />
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

export default function AnnexPublicPage() {
  const { annexNumber } = useParams();
  const [annex, setAnnex] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
    <div className="page-outer" style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{`
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

        @media print {
          @page { size: A4; margin: 0; }

          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }

          .screen-bar { display: none !important; }
          .print-cover { display: flex !important; }

          /* Kill the gray outer background */
          .page-outer { background: white !important; min-height: unset !important; padding: 0 !important; }

          .doc-shell {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          .doc-content {
            padding: 10mm 18mm 16mm !important;
          }

          .page-break-item { break-before: page !important; }
          .content-block { break-inside: avoid; }

          /* Diagrams: let them size naturally in print */
          .diagram-img { max-height: 180mm !important; }
        }

        @media screen {
          .print-cover { display: none !important; }
        }

        .annex-text strong { font-weight: 600; color: #111827; }
        .annex-text ul { list-style: disc; padding-left: 20px; margin: 6px 0; }
        .annex-text ol { list-style: decimal; padding-left: 20px; margin: 6px 0; }
        .annex-text p { margin: 0 0 8px; }
        .annex-text li { margin-bottom: 3px; }
        .annex-text h3 { font-weight: 700; color: #111827; margin: 0 0 4px; }
      `}</style>

      {/* ── Screen top bar ── */}
      <div className="screen-bar" style={{ background: "#1e3a5f", color: "white" }}>
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
              onClick={() => window.print()}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", color: "white", fontSize: "12px", cursor: "pointer" }}
            >
              <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Export PDF
            </button>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 1px", fontSize: "11px", fontWeight: "700", color: "white" }}>Interasia SAS</p>
              <p style={{ margin: 0, fontSize: "10px", color: "#93c5fd" }}>HK Trade Company</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Print-only cover banner ── */}
      <div className="print-cover" style={{
        display: "none",
        background: "#1e3a5f",
        padding: "22mm 18mm 18mm",
        justifyContent: "space-between",
        alignItems: "flex-end",
        minHeight: "55mm",
      }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: "8pt", fontWeight: "700", letterSpacing: "0.14em", textTransform: "uppercase", color: "#93c5fd" }}>
            Technical Annex · {annex.annex_number}
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: "24pt", fontWeight: "800", color: "white", lineHeight: "1.15" }}>
            {annex.title}
          </h1>
          {quotation && (
            <p style={{ margin: 0, fontSize: "9pt", color: "#bfdbfe" }}>
              {[quotation.quote_number, quotation.client_name, quotation.project_name].filter(Boolean).join("   ·   ")}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: "10pt", fontWeight: "800", color: "white" }}>Interasia SAS</p>
          <p style={{ margin: 0, fontSize: "8.5pt", color: "#bfdbfe" }}>HK Trade Company</p>
        </div>
      </div>

      {/* ── Document body ── */}
      <div className="doc-shell" style={{ maxWidth: "740px", margin: "24px auto 48px", background: "white", borderRadius: "16px", boxShadow: "0 2px 24px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div className="doc-content" style={{ padding: "40px 48px" }}>
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
    </div>
  );
}
