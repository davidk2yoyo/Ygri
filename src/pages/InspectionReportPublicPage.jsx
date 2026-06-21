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

const STATUS_LABELS = {
  en: { draft: "Draft", approved: "Approved", approved_with_observations: "Approved with Observations", rejected: "Rejected" },
  es: { draft: "Borrador", approved: "Aprobado", approved_with_observations: "Aprobado con Observaciones", rejected: "Rechazado" },
};

const STATUS_COLORS = {
  draft: "#6b7280",
  approved: "#16a34a",
  approved_with_observations: "#d97706",
  rejected: "#dc2626",
};

const CONDITION_COLORS = {
  good:        "#16a34a",
  regular:     "#d97706",
  defects:     "#ea580c",
  not_suitable:"#dc2626",
  // legacy fallbacks
  low: "#6b7280", medium: "#d97706", high: "#dc2626",
  critical: "#dc2626", major: "#d97706", minor: "#2563eb",
};

const DEFECT_LABELS = {
  en: {
    title: "Defects Found",
    item_name: "Item / Name",
    comment: "Comment",
    qty_inspected: "Qty. Inspected",
    condition: "Condition",
    no_items: "No items recorded.",
    conditions: {
      good: "Good Condition", regular: "Regular",
      defects: "Defects Found", not_suitable: "Not Suitable for Dispatch",
      low: "Low", medium: "Medium", high: "High", critical: "Critical", major: "Major", minor: "Minor",
    },
  },
  es: {
    title: "Hallazgos / Defectos",
    item_name: "Artículo / Nombre",
    comment: "Comentario",
    qty_inspected: "Cant. Inspeccionada",
    condition: "Condición",
    no_items: "Sin artículos registrados.",
    conditions: {
      good: "Buenas Condiciones", regular: "Regular",
      defects: "Defectos Encontrados", not_suitable: "No Apto para Despacho",
      low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico", major: "Mayor", minor: "Menor",
    },
  },
};

const ACTION_LABELS = {
  en: { proceed: "Proceed", proceed_with_observations: "Proceed with Observations", hold: "Hold", reject: "Reject" },
  es: { proceed: "Proceder", proceed_with_observations: "Proceder con Observaciones", hold: "En Espera", reject: "Rechazar" },
};

const CONCLUSION_LABELS = {
  en: { title: "Conclusion", summary: "Summary", positives: "Positives", risks: "Risks", recommendations: "Recommendations", action: "Action" },
  es: { title: "Conclusión", summary: "Resumen", positives: "Aspectos Positivos", risks: "Riesgos", recommendations: "Recomendaciones", action: "Acción" },
};

const ACTION_COLORS = {
  proceed: "#16a34a",
  proceed_with_observations: "#d97706",
  hold: "#d97706",
  reject: "#dc2626",
};

// Cover field label translations
const COVER_LABELS = {
  en: {
    project: "Project", report_type: "Report Type", inspector: "Inspector",
    visit_date: "Visit Date", po_number: "PO Number", client: "Client",
    supplier: "Supplier", supplier_address: "Supplier Address", country: "Country",
    attached_docs: "Attached Documents", report_label: "Inspection Report",
  },
  es: {
    project: "Proyecto", report_type: "Tipo de Reporte", inspector: "Inspector",
    visit_date: "Fecha de Visita", po_number: "Número de PO", client: "Cliente",
    supplier: "Proveedor", supplier_address: "Dirección del Proveedor", country: "País",
    attached_docs: "Documentos Adjuntos", report_label: "Reporte de Inspección",
  },
};

// ─── PDF HTML builder ─────────────────────────────────────────────────────────
function buildPdfHtml({ report, blocks }) {
  const lang = report.language || "en";
  const t = COVER_LABELS[lang] || COVER_LABELS.en;
  const logoSrc = `${window.location.origin}/images/interasia-logo.png`;
  const dateLocale = lang === "es" ? "es-ES" : "en-US";
  const date = new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" });
  const statusColor = STATUS_COLORS[report.status] || "#6b7280";
  const statusLabel = (STATUS_LABELS[lang] || STATUS_LABELS.en)[report.status] || report.status || "";

  const blocksHtml = blocks.map(block => {
    const { type, content } = block;

    if (type === "cover") {
      const pairs = [
        [t.project, content.project_name],
        [t.report_type, content.report_type],
        [t.inspector, content.inspector_name],
        [t.visit_date, content.visit_date],
        [t.po_number, content.po_number],
        [t.client, content.client_name],
        [t.supplier, content.supplier_name],
        [t.supplier_address, content.supplier_address],
        [t.country, content.country],
      ].filter(([, v]) => v);
      const docs = content.attached_docs || [];
      return `
        <div class="content-block cover-info">
          <div class="info-grid">
            ${pairs.map(([label, value]) => `
              <div class="info-cell">
                <span class="info-label">${esc(label)}</span>
                <span class="info-value">${esc(value)}</span>
              </div>`).join("")}
          </div>
          ${docs.length ? `
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid #eef2f7;">
            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin:0 0 8px 0;">${esc(t.attached_docs)}</p>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              ${docs.map(d => `
                <tr style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:5px 0;color:#1e293b;font-weight:600;">${esc(d.name)}</td>
                  <td style="padding:5px 0;color:#6b7280;text-align:right;">${esc(d.document_type || "")}</td>
                  ${d.validity_date ? `<td style="padding:5px 0;color:#9ca3af;text-align:right;padding-left:12px;">exp. ${esc(d.validity_date)}</td>` : '<td></td>'}
                </tr>`).join("")}
            </table>
          </div>` : ""}
        </div>`;
    }

    if (type === "image") {
      if (!content.url) return "";
      return `
        <div class="content-block" style="break-inside:avoid;page-break-inside:avoid;">
          <img src="${esc(content.url)}" alt="${esc(content.caption || "")}" crossorigin="anonymous"
            style="width:100%;max-height:480px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;display:block;" />
          ${content.caption ? `<p class="caption" style="text-align:center;margin-top:6px;">${esc(content.caption)}</p>` : ""}
        </div>`;
    }

    const heading = (title) => title
      ? `<div class="section-heading"><span class="accent-bar"></span><h3>${esc(title)}</h3></div>`
      : "";

    if (type === "text") {
      return `
        <div class="content-block">
          ${heading(content.title)}
          <div class="text-content">${renderContent(content.content)}</div>
        </div>`;
    }

    if (type === "gallery") {
      const images = content.images || [];
      if (!images.length) return "";
      const tmpl = content.template || "g3";
      const cols = { g1: 1, g2: 2, g3: 3, g4: 4 }[tmpl] || 3;
      const pct = Math.floor(100 / cols);
      return `
        <div class="content-block">
          ${heading(content.title || "Photos")}
          <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:7px;break-inside:avoid;page-break-inside:avoid;">
            ${images.map(img => `
              <div style="${img.featured ? "grid-column:span 2;" : ""}">
                <img src="${esc(img.url)}" alt="${esc(img.caption || "")}" crossorigin="anonymous"
                  style="width:100%;height:${cols === 1 ? "360px" : cols === 2 ? "200px" : "140px"};object-fit:cover;border-radius:5px;border:1px solid #e2e8f0;display:block;" />
                ${img.caption ? `<p class="caption">${esc(img.caption)}</p>` : ""}
              </div>`).join("")}
          </div>
        </div>`;
    }

    if (type === "checklist") {
      const items = (content.items || []).filter(i => i.label);
      return `
        <div class="content-block">
          ${heading(content.title || "Checklist")}
          <table class="checklist-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style="width:80px;text-align:center;">Status</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, i) => {
                const bg = item.status === "ok" ? "#dcfce7" : item.status === "fail" ? "#fee2e2" : "#f3f4f6";
                const fg = item.status === "ok" ? "#15803d" : item.status === "fail" ? "#b91c1c" : "#6b7280";
                const label = item.status === "ok" ? "OK" : item.status === "fail" ? "FAIL" : "N/A";
                return `
                  <tr class="${i % 2 === 0 ? "even" : "odd"}">
                    <td>${esc(item.label)}</td>
                    <td style="text-align:center;">
                      <span style="display:inline-block;background:${bg};color:${fg};font-size:8px;font-weight:700;letter-spacing:.08em;padding:2px 8px;border-radius:999px;">${label}</span>
                    </td>
                    <td style="color:#6b7280;">${esc(item.comment || "")}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;
    }

    if (type === "table") {
      const headers = content.headers || [];
      const rows = content.rows || [];
      return `
        <div class="content-block">
          ${heading(content.title)}
          <table class="data-table">
            ${headers.length ? `
            <thead>
              <tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr>
            </thead>` : ""}
            <tbody>
              ${rows.map((row, i) => `
                <tr class="${i % 2 === 0 ? "even" : "odd"}">
                  ${(Array.isArray(row) ? row : []).map(cell => `<td>${esc(cell)}</td>`).join("")}
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    }

    if (type === "defects") {
      const dt = DEFECT_LABELS[lang] || DEFECT_LABELS.en;
      const items = (content.items || []).filter(d => d.item_name || d.type || d.comment || d.recommendation);
      return `
        <div class="content-block">
          ${heading(content.title || dt.title)}
          ${items.length === 0 ? `<p style="color:#9ca3af;font-size:11px;">${dt.no_items}</p>` : (() => {
            const hasPhotos = items.some(d => d.photo_url);
            return `
          <table class="data-table">
            <thead>
              <tr>
                ${hasPhotos ? "<th style='width:80px'>Photo</th>" : ""}
                <th>${dt.item_name}</th>
                <th>${dt.condition}</th>
                <th>${dt.qty_inspected}</th>
                <th>${dt.comment}</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((d, i) => {
                const condKey = d.condition || d.severity || "good";
                const condColor = CONDITION_COLORS[condKey] || "#6b7280";
                const condLabel = dt.conditions[condKey] || condKey;
                const photoCell = hasPhotos
                  ? (d.photo_url ? `<td style="padding:4px;"><img src="${esc(d.photo_url)}" style="width:72px;height:56px;object-fit:cover;border-radius:4px;" /></td>` : "<td></td>")
                  : "";
                return `
                  <tr class="${i % 2 === 0 ? "even" : "odd"}">
                    ${photoCell}
                    <td style="font-weight:600;">${esc(d.item_name || d.type || "")}</td>
                    <td><span style="display:inline-block;background:${condColor}22;color:${condColor};font-size:8px;font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:999px;">${esc(condLabel)}</span></td>
                    <td>${esc(d.qty_inspected || d.quantity || "")}</td>
                    <td style="color:#6b7280;">${esc(d.comment || d.recommendation || "")}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>`;
          })()}
        </div>`;
    }

    if (type === "scoring") {
      const categories = content.categories || [];
      const scored = categories.filter(c => c.score !== null && c.score !== undefined && c.score !== "");
      const total = scored.length ? (scored.reduce((s, c) => s + Number(c.score), 0) / scored.length).toFixed(1) : null;
      return `
        <div class="content-block">
          ${heading(content.title || "Quality Scoring")}
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style="width:80px;text-align:center;">Score /10</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map((cat, i) => `
                <tr class="${i % 2 === 0 ? "even" : "odd"}">
                  <td>${esc(cat.label)}</td>
                  <td style="text-align:center;font-weight:700;">${cat.score !== null && cat.score !== undefined && cat.score !== "" ? esc(String(cat.score)) : "—"}</td>
                  <td style="color:#6b7280;">${esc(cat.notes || "")}</td>
                </tr>`).join("")}
              ${total !== null ? `
              <tr style="background:#1e3a5f;">
                <td style="color:white;font-weight:700;" colspan="1">Overall Average</td>
                <td style="color:white;font-weight:800;text-align:center;">${total}</td>
                <td style="color:#93c5fd;"></td>
              </tr>` : ""}
            </tbody>
          </table>
        </div>`;
    }

    if (type === "conclusion") {
      const cl = CONCLUSION_LABELS[lang] || CONCLUSION_LABELS.en;
      const actionLabel = (ACTION_LABELS[lang] || ACTION_LABELS.en)[content.action] || content.action || "";
      const actionColor = ACTION_COLORS[content.action] || "#6b7280";
      const sections = [
        ["summary", cl.summary],
        ["positives", cl.positives],
        ["risks", cl.risks],
        ["recommendations", cl.recommendations],
      ].map(([key, label]) => [label, content[key]]).filter(([, v]) => v);
      return `
        <div class="content-block">
          ${heading(cl.title)}
          ${sections.map(([label, value]) => `
            <div style="margin-bottom:10px;">
              <p style="margin:0 0 3px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;">${esc(label)}</p>
              <div class="text-content">${renderContent(value)}</div>
            </div>`).join("")}
          ${content.action ? `
          <div style="margin-top:12px;">
            <p style="margin:0 0 4px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;">${esc(cl.action)}</p>
            <span style="display:inline-block;background:${actionColor};color:white;font-size:9px;font-weight:700;letter-spacing:.08em;padding:3px 14px;border-radius:999px;">${esc(actionLabel.toUpperCase())}</span>
          </div>` : ""}
        </div>`;
    }

    return "";
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(report.title || report.report_number)}</title>
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
  .report-label { font-size: 8px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #2563eb; margin: 0 0 4px; }
  .report-title { font-size: 21px; font-weight: 800; color: #1e3a5f; margin: 0 0 10px; line-height: 1.2; }
  .status-badge { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 3px 12px; border-radius: 999px; color: white; }
  .cover-date  { font-size: 9.5px; color: #6b7280; text-align: right; flex-shrink: 0; padding-left: 20px; margin: 0; }

  /* ── Info grid ── */
  .cover-info { border-bottom: 1px solid #eef2f7; }
  .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; }
  .info-cell { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; }
  .info-cell:nth-child(even) { border-right: none; }
  .info-label { display: block; font-size: 7.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #9ca3af; margin-bottom: 2px; }
  .info-value { display: block; font-size: 11px; font-weight: 600; color: #111827; }

  /* ── Content blocks ── */
  .content-block {
    padding: 16px 44px 4px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

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

  /* ── Images ── */
  .image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; break-inside: avoid; page-break-inside: avoid; }
  .image-cell img { width: 100%; height: 120px; object-fit: cover; border-radius: 5px; border: 1px solid #e2e8f0; display: block; }
  .caption { font-size: 8px; color: #9ca3af; margin: 3px 0 0; text-align: center; }

  /* ── Tables ── */
  .checklist-table,
  .data-table { width: 100%; border-collapse: collapse; font-size: 11px; break-inside: avoid; page-break-inside: avoid; }
  .checklist-table th,
  .data-table th { background: #1e3a5f; color: white; padding: 6px 12px; text-align: left; font-size: 8.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .checklist-table td,
  .data-table td { padding: 6px 12px; border: 1px solid #e2e8f0; }
  .checklist-table tr.even td,
  .data-table tr.even td { background: #ffffff; }
  .checklist-table tr.odd td,
  .data-table tr.odd td { background: #f8fafc; }

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
    <p class="report-label">Inspection Report · ${esc(report.report_number)}</p>
    <h1 class="report-title">${esc(report.title || report.report_number)}</h1>
    <span class="status-badge" style="background:${statusColor};">${esc(statusLabel.toUpperCase())}</span>
  </div>
  <p class="cover-date">${date}</p>
</div>

${blocksHtml}

<div class="doc-footer">
  <span>${esc(report.report_number)} · Interasia SAS (HK) Trade Company</span>
  <span>Generated by Ygri CRM</span>
</div>

<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
}

// ─── Screen helpers ───────────────────────────────────────────────────────────
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

function StatusBadge({ status, language = "en" }) {
  const color = STATUS_COLORS[status] || "#6b7280";
  const label = (STATUS_LABELS[language] || STATUS_LABELS.en)[status] || status || "";
  return (
    <span style={{ display: "inline-block", background: color, color: "white", fontSize: "10px", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 12px", borderRadius: "999px" }}>
      {label}
    </span>
  );
}

// ─── Screen block renderer ────────────────────────────────────────────────────
function BlockRenderer({ block, language = "en" }) {
  const { type, content } = block;
  const t = COVER_LABELS[language] || COVER_LABELS.en;

  if (type === "cover") {
    const pairs = [
      [t.project, content.project_name],
      [t.report_type, content.report_type],
      [t.inspector, content.inspector_name],
      [t.visit_date, content.visit_date],
      [t.po_number, content.po_number],
      [t.client, content.client_name],
      [t.supplier, content.supplier_name],
      [t.supplier_address, content.supplier_address],
      [t.country, content.country],
    ].filter(([, v]) => v);
    const docs = content.attached_docs || [];

    return (
      <div style={{ marginBottom: "28px" }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: "#e2e8f0" }}>
            {pairs.map(([label, value]) => (
              <div key={label} style={{ background: "white", padding: "12px 16px" }}>
                <span style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", marginBottom: "3px" }}>{label}</span>
                <span style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#111827" }}>{value}</span>
              </div>
            ))}
          </div>
          {docs.length > 0 && (
            <div style={{ background: "white", padding: "14px 16px", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", marginBottom: "10px" }}>{t.attached_docs}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {docs.map(d => (
                  <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", padding: "8px 10px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f9fafb" }}>
                    <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span style={{ flex: 1, fontSize: "13px", fontWeight: "600", color: "#111827" }}>{d.name}</span>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>{d.document_type}</span>
                    {d.validity_date && <span style={{ fontSize: "11px", color: "#9ca3af" }}>exp. {d.validity_date}</span>}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "text") {
    return (
      <div style={{ marginBottom: "28px" }}>
        <SectionHeading title={content.title} />
        <div
          style={{ fontSize: "13.5px", color: "#374151", lineHeight: "1.75" }}
          className="report-text"
          dangerouslySetInnerHTML={{ __html: renderContent(content.content) }}
        />
      </div>
    );
  }

  if (type === "image") {
    if (!content.url) return null;
    return (
      <div style={{ marginBottom: "28px", textAlign: "center" }}>
        <img src={content.url} alt={content.caption || ""} style={{ maxWidth: "100%", maxHeight: "480px", objectFit: "contain", borderRadius: "10px", border: "1px solid #e2e8f0", display: "inline-block" }} />
        {content.caption && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#9ca3af" }}>{content.caption}</p>}
      </div>
    );
  }

  if (type === "gallery") {
    const images = content.images || [];
    if (!images.length) return null;
    const tmpl = content.template || "g3";
    const cols = { g1: 1, g2: 2, g3: 3, g4: 4 }[tmpl] || 3;
    const imgH = cols === 1 ? "360px" : cols === 2 ? "220px" : "160px";
    return (
      <div style={{ marginBottom: "28px" }}>
        <SectionHeading title={content.title || "Photos"} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "10px" }}>
          {images.map((img, i) => (
            <div key={i} style={{ textAlign: "center", ...(img.featured ? { gridColumn: "span 2" } : {}) }}>
              <img src={img.url} alt={img.caption || ""} style={{ width: "100%", height: imgH, objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", display: "block" }} />
              {img.caption && <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#9ca3af" }}>{img.caption}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "checklist") {
    const items = (content.items || []).filter(i => i.label);
    return (
      <div style={{ marginBottom: "28px" }}>
        <SectionHeading title={content.title || "Checklist"} />
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#1e3a5f" }}>
                <th style={{ padding: "8px 14px", color: "white", fontWeight: "700", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>Item</th>
                <th style={{ padding: "8px 14px", color: "white", fontWeight: "700", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", width: "90px" }}>Status</th>
                <th style={{ padding: "8px 14px", color: "white", fontWeight: "700", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>Comment</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const bg = item.status === "ok" ? "#dcfce7" : item.status === "fail" ? "#fee2e2" : "#f3f4f6";
                const fg = item.status === "ok" ? "#15803d" : item.status === "fail" ? "#b91c1c" : "#6b7280";
                const label = item.status === "ok" ? "OK" : item.status === "fail" ? "FAIL" : "N/A";
                return (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={{ padding: "8px 14px", borderBottom: "1px solid #e2e8f0" }}>{item.label}</td>
                    <td style={{ padding: "8px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>
                      <span style={{ display: "inline-block", background: bg, color: fg, fontSize: "10px", fontWeight: "700", letterSpacing: "0.06em", padding: "2px 10px", borderRadius: "999px" }}>{label}</span>
                    </td>
                    <td style={{ padding: "8px 14px", borderBottom: "1px solid #e2e8f0", color: "#6b7280", fontSize: "12px" }}>{item.comment || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === "table") {
    const headers = content.headers || [];
    const rows = content.rows || [];
    return (
      <div style={{ marginBottom: "28px" }}>
        <SectionHeading title={content.title} />
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            {headers.length > 0 && (
              <thead>
                <tr style={{ background: "#1e3a5f" }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ padding: "8px 14px", color: "white", fontWeight: "700", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  {(Array.isArray(row) ? row : []).map((cell, j) => (
                    <td key={j} style={{ padding: "8px 14px", borderBottom: "1px solid #e2e8f0", borderRight: j < row.length - 1 ? "1px solid #e2e8f0" : "none" }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === "defects") {
    const dt = DEFECT_LABELS[language] || DEFECT_LABELS.en;
    const items = (content.items || []).filter(d => d.item_name || d.type || d.comment || d.recommendation);
    return (
      <div style={{ marginBottom: "28px" }}>
        <SectionHeading title={content.title || dt.title} />
        {items.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>{dt.no_items}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {items.map((defect, i) => {
              const condKey = defect.condition || defect.severity || "good";
              const condColor = CONDITION_COLORS[condKey] || "#6b7280";
              const condLabel = dt.conditions[condKey] || condKey;
              return (
                <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", display: "flex" }}>
                  {/* Left accent bar based on condition */}
                  <div style={{ width: "4px", flexShrink: 0, background: condColor }} />
                  {defect.photo_url && (
                    <img
                      src={defect.photo_url}
                      alt=""
                      style={{ width: "110px", minWidth: "110px", objectFit: "cover", borderRight: "1px solid #e2e8f0" }}
                    />
                  )}
                  <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
                    {/* Top row: name + condition badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "700", fontSize: "13px", color: "#111827" }}>
                        {defect.item_name || defect.type || "—"}
                      </span>
                      <span style={{ display: "inline-block", background: condColor + "18", color: condColor, fontSize: "10px", fontWeight: "700", letterSpacing: "0.05em", padding: "2px 10px", borderRadius: "999px", border: `1px solid ${condColor}33` }}>
                        {condLabel}
                      </span>
                    </div>
                    {/* Meta row: qty */}
                    {(defect.qty_inspected || defect.quantity) && (
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }}>
                        {dt.qty_inspected}: <strong style={{ color: "#6b7280" }}>{defect.qty_inspected || defect.quantity}</strong>
                      </div>
                    )}
                    {/* Comment */}
                    {(defect.comment || defect.recommendation) && (
                      <p style={{ margin: 0, fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>
                        {defect.comment || defect.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (type === "scoring") {
    const categories = content.categories || [];
    const scored = categories.filter(c => c.score !== null && c.score !== undefined && c.score !== "");
    const avg = scored.length
      ? (scored.reduce((s, c) => s + Number(c.score), 0) / scored.length)
      : null;
    return (
      <div style={{ marginBottom: "28px" }}>
        <SectionHeading title={content.title || "Quality Scoring"} />
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          {categories.map((cat, i) => {
            const score = cat.score !== null && cat.score !== undefined && cat.score !== "" ? Number(cat.score) : null;
            const pct = score !== null ? Math.min(100, (score / 10) * 100) : 0;
            const barColor = score === null ? "#e2e8f0" : score >= 7 ? "#16a34a" : score >= 5 ? "#d97706" : "#dc2626";
            return (
              <div key={i} style={{ padding: "10px 16px", borderBottom: i < categories.length - 1 ? "1px solid #f1f5f9" : "none", backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>{cat.label}</span>
                  <span style={{ fontSize: "13px", fontWeight: "800", color: score !== null ? "#111827" : "#d1d5db", minWidth: "40px", textAlign: "right" }}>
                    {score !== null ? `${score}/10` : "—"}
                  </span>
                </div>
                <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "3px", transition: "width 0.3s" }} />
                </div>
                {cat.notes && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9ca3af" }}>{cat.notes}</p>}
              </div>
            );
          })}
          {avg !== null && (
            <div style={{ padding: "10px 16px", background: "#1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "white" }}>Overall Average</span>
              <span style={{ fontSize: "15px", fontWeight: "800", color: "#93c5fd" }}>{avg.toFixed(1)}/10</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "conclusion") {
    const cl = CONCLUSION_LABELS[language] || CONCLUSION_LABELS.en;
    const actionLabel = (ACTION_LABELS[language] || ACTION_LABELS.en)[content.action] || content.action || "";
    const actionColor = ACTION_COLORS[content.action] || "#6b7280";
    const sections = [
      ["summary", cl.summary],
      ["positives", cl.positives],
      ["risks", cl.risks],
      ["recommendations", cl.recommendations],
    ].map(([key, label]) => [label, content[key]]).filter(([, v]) => v);
    return (
      <div style={{ marginBottom: "28px" }}>
        <SectionHeading title={cl.title} />
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          {sections.map(([label, value], i) => (
            <div key={label} style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
              <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af" }}>{label}</p>
              <div
                style={{ fontSize: "13px", color: "#374151", lineHeight: "1.7" }}
                className="report-text"
                dangerouslySetInnerHTML={{ __html: renderContent(value) }}
              />
            </div>
          ))}
          {content.action && (
            <div style={{ padding: "14px 16px", background: "#f8fafc", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>{cl.action}:</span>
              <span style={{ display: "inline-block", background: actionColor, color: "white", fontSize: "11px", fontWeight: "700", letterSpacing: "0.06em", padding: "4px 16px", borderRadius: "999px" }}>
                {actionLabel.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function InspectionReportPublicPage() {
  const { reportNumber } = useParams();
  const [report, setReport] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: rpt } = await supabase
        .from("inspection_reports")
        .select("*")
        .eq("report_number", reportNumber)
        .single();
      if (!rpt) { setNotFound(true); setLoading(false); return; }
      setReport(rpt);
      const { data: blks } = await supabase
        .from("report_blocks")
        .select("*")
        .eq("report_id", rpt.id)
        .order("sort_order");
      setBlocks(blks || []);
      setLoading(false);
    }
    load();
  }, [reportNumber]);

  const handleExportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const html = buildPdfHtml({ report, blocks });
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
      <p className="text-4xl">📋</p>
      <p className="font-semibold">Inspection report not found</p>
      <p className="text-sm">The link may be invalid or expired.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{`
        .report-text strong { font-weight: 600; color: #111827; }
        .report-text ul { list-style: disc; padding-left: 20px; margin: 6px 0; }
        .report-text ol { list-style: decimal; padding-left: 20px; margin: 6px 0; }
        .report-text p { margin: 0 0 8px; }
        .report-text li { margin-bottom: 3px; }
        .report-text h3 { font-weight: 700; color: #111827; margin: 0 0 4px; }
      `}</style>

      {/* Screen top bar — not printed */}
      <div style={{ background: "#1e3a5f" }}>
        <div style={{ maxWidth: "740px", margin: "0 auto", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd" }}>
              Inspection Report · {report.report_number}
            </p>
            <h1 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: "white", lineHeight: "1.2" }}>
              {report.title || report.report_number}
            </h1>
            <StatusBadge status={report.status} />
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
              This report has no content yet.
            </p>
          ) : (
            blocks.map(block => (
              <BlockRenderer key={block.id} block={block} language={report?.language || "en"} />
            ))
          )}
          <div style={{ marginTop: "48px", paddingTop: "20px", borderTop: "1px solid #f1f5f9" }}>
            <p style={{ textAlign: "center", fontSize: "11px", color: "#d1d5db", margin: 0 }}>
              {report.report_number} · Interasia SAS (HK) Trade Company · Generated by Ygri CRM
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
