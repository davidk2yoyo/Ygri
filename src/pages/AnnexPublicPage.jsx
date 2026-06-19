import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

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

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── PDF HTML builder ─────────────────────────────────────────────────────────
function buildPdfHtml({ annex, blocks, quotation }) {
  const logoSrc = `${window.location.origin}/images/interasia-logo.png`;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" });

  const metaTags = quotation
    ? [
        quotation.quote_number && `Ref: ${quotation.quote_number}`,
        quotation.client_name,
        quotation.project_name,
      ].filter(Boolean).map(t => `<span class="meta-tag">${esc(t)}</span>`).join("")
    : "";

  let itemCount = 0;
  const blocksHtml = blocks.map(block => {
    const { type, content } = block;
    const linkedItem = content._linked_item;

    if (type === "item") {
      const isFirst = itemCount === 0;
      itemCount++;
      return `
        <div class="item-section${isFirst ? " first-item" : ""}">
          ${content.item_number ? `<span class="sku-badge">${esc(content.item_number)}</span>` : ""}
          <h2 class="item-title">${esc((content.label || content.description || "").toUpperCase())}</h2>
        </div>`;
    }

    const refLine = linkedItem
      ? `<p class="ref-line">${esc([linkedItem.item_number, linkedItem.description].filter(Boolean).join(" · "))}</p>`
      : "";

    const heading = (title) => title
      ? `<div class="section-heading"><span class="accent-bar"></span><h3>${esc(title)}</h3></div>`
      : "";

    if (type === "text") {
      return `
        <div class="content-block">
          ${refLine}
          ${heading(content.title)}
          <div class="text-content">${renderContent(content.content)}</div>
        </div>`;
    }

    if (type === "specs") {
      const rows = (content.rows || []).filter(r => r.label || r.value);
      return `
        <div class="content-block">
          ${refLine}
          ${heading(content.title)}
          <table class="specs-table">
            <tbody>
              ${rows.map((r, i) => `
                <tr class="${i % 2 === 0 ? "even" : "odd"}">
                  <td class="spec-label">${esc(r.label)}</td>
                  <td class="spec-value">${esc(r.value)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    }

    if (type === "images") {
      const images = (content.images || []);
      if (!images.length) return "";
      return `
        <div class="content-block">
          ${refLine}
          ${heading(content.title)}
          <div class="image-grid">
            ${images.map(img => `
              <div class="image-cell">
                <img src="${esc(img.url)}" alt="${esc(img.caption || "")}" crossorigin="anonymous" />
                ${img.caption ? `<p class="caption">${esc(img.caption)}</p>` : ""}
              </div>`).join("")}
          </div>
        </div>`;
    }

    if (type === "diagram" && content.url) {
      return `
        <div class="content-block">
          ${refLine}
          ${heading(content.title)}
          <div class="diagram-wrap">
            <img src="${esc(content.url)}" alt="${esc(content.caption || "Diagram")}" crossorigin="anonymous" />
            ${content.caption ? `<p class="caption">${esc(content.caption)}</p>` : ""}
          </div>
        </div>`;
    }

    return "";
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(annex.title || annex.annex_number)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

  @page { size: A4; margin: 0; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
    background: white;
  }

  /* ── Document header ── */
  .doc-header {
    background: #1e3a5f;
    padding: 16px 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .doc-header img { height: 44px; object-fit: contain; }
  .company-name { color: white; font-size: 12.5px; font-weight: 700; letter-spacing: .02em; }
  .company-web  { color: #93c5fd; font-size: 9px; margin-top: 3px; }
  .accent-line  { background: #2563eb; height: 3px; }

  /* ── Cover ── */
  .cover {
    padding: 22px 44px 18px;
    border-bottom: 2px solid #eef2f7;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .cover-left { flex: 1; }
  .annex-label { font-size: 8px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #2563eb; margin: 0 0 4px; }
  .annex-title { font-size: 21px; font-weight: 800; color: #1e3a5f; margin: 0 0 12px; line-height: 1.2; }
  .meta-tags   { display: flex; gap: 6px; flex-wrap: wrap; }
  .meta-tag    { background: #eef2f7; color: #374151; font-size: 9.5px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
  .cover-date  { font-size: 9.5px; color: #6b7280; text-align: right; flex-shrink: 0; padding-left: 20px; margin: 0; }

  /* ── Item section divider ── */
  .item-section {
    background: #1e3a5f;
    padding: 13px 44px;
    display: flex;
    align-items: center;
    gap: 12px;
    break-before: page;
    page-break-before: always;
    margin: 0;
  }
  .first-item { break-before: auto !important; page-break-before: auto !important; }
  .sku-badge  { background: #2563eb; color: white; font-size: 8px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
  .item-title { margin: 0; font-size: 13px; font-weight: 800; color: white; letter-spacing: .02em; }

  /* ── Content blocks ── */
  .content-block {
    padding: 16px 44px 4px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ref-line { margin: 0 0 4px; font-size: 8px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: .1em; }

  /* ── Section heading ── */
  .section-heading { display: flex; align-items: center; gap: 8px; margin: 0 0 7px; }
  .accent-bar { display: inline-block; width: 3px; height: 13px; background: #2563eb; border-radius: 2px; flex-shrink: 0; }
  .section-heading h3 { margin: 0; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #111827; }

  /* ── Text ── */
  .text-content { font-size: 11.5px; line-height: 1.72; color: #374151; }
  .text-content p { margin: 0 0 6px; }
  .text-content strong { font-weight: 700; color: #111827; }
  .text-content ul { list-style: disc; padding-left: 18px; margin: 4px 0; }
  .text-content ol { list-style: decimal; padding-left: 18px; margin: 4px 0; }
  .text-content li { margin-bottom: 2px; }

  /* ── Specs table ── */
  .specs-table { width: 100%; border-collapse: collapse; font-size: 11px; break-inside: avoid; page-break-inside: avoid; }
  .specs-table td { padding: 6px 12px; border: 1px solid #e2e8f0; }
  .specs-table tr.even td { background: #ffffff; }
  .specs-table tr.odd  td { background: #f8fafc; }
  .spec-label { font-weight: 600; color: #4b5563; width: 38%; }
  .spec-value { color: #111827; }

  /* ── Images ── */
  .image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; break-inside: avoid; page-break-inside: avoid; }
  .image-cell img { width: 100%; height: 120px; object-fit: cover; border-radius: 5px; border: 1px solid #e2e8f0; display: block; }
  .caption { font-size: 8px; color: #9ca3af; margin: 3px 0 0; text-align: center; }

  /* ── Diagram ── */
  .diagram-wrap { text-align: center; background: #f8fafc; border-radius: 7px; padding: 14px; border: 1px solid #e2e8f0; break-inside: avoid; page-break-inside: avoid; }
  .diagram-wrap img { max-width: 100%; max-height: 320px; object-fit: contain; display: block; margin: 0 auto; }

  /* ── Footer ── */
  .doc-footer {
    background: #eef2f7;
    border-top: 2px solid #1e3a5f;
    padding: 9px 44px;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #64748b;
    font-weight: 600;
    margin-top: 28px;
  }
</style>
</head>
<body>

<div class="doc-header">
  <img src="${logoSrc}" alt="Interasia" />
  <div>
    <div class="company-name">INTERASIA SAS (HK) TRADE COMPANY</div>
    <div class="company-web">www.interasia.com.co</div>
  </div>
</div>
<div class="accent-line"></div>

<div class="cover">
  <div class="cover-left">
    <p class="annex-label">Technical Annex · ${esc(annex.annex_number)}</p>
    <h1 class="annex-title">${esc(annex.title)}</h1>
    <div class="meta-tags">${metaTags}</div>
  </div>
  <p class="cover-date">${date}</p>
</div>

${blocksHtml}

<div class="doc-footer">
  <span>${esc(annex.annex_number)} · Interasia SAS (HK) Trade Company</span>
  <span>Generated by Ygri CRM</span>
</div>

<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
}

// ─── Screen block renderer ─────────────────────────────────────────────────────
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
      <div style={{ marginBottom: "12px" }}>
        {content.item_number && (
          <span style={{ display: "inline-block", background: "#1e3a5f", color: "white", fontSize: "10px", fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 10px", borderRadius: "999px", marginBottom: "8px" }}>
            {content.item_number}
          </span>
        )}
        <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#1e3a5f", lineHeight: "1.25", borderBottom: "2px solid #1e3a5f", paddingBottom: "12px" }}>
          {content.label || content.description}
        </h2>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "28px" }}>
      {linkedItem && (
        <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "700", color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {[linkedItem.item_number, linkedItem.description].filter(Boolean).join(" · ")}
        </p>
      )}
      {type === "text" && (
        <>
          <SectionHeading title={content.title} />
          <div style={{ fontSize: "13.5px", color: "#374151", lineHeight: "1.75" }} className="annex-text"
            dangerouslySetInnerHTML={{ __html: renderContent(content.content) }}
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
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
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
            <img src={content.url} alt={content.caption || "Diagram"} style={{ maxWidth: "100%", maxHeight: "440px", objectFit: "contain", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
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

  const handleExportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const html = buildPdfHtml({ annex, blocks, quotation });
    win.document.open();
    win.document.write(html);
    win.document.close();
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
      `}</style>

      {/* Screen top bar */}
      <div style={{ background: "#1e3a5f" }}>
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
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px", color: "white", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
            >
              <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

      {/* Screen document */}
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
    </div>
  );
}
